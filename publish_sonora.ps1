# ============================================================================
# Sonora one-click publish
#   1. Builds the signed Android APK (Gradle) and copies it to the website
#   2. Installs it on the phone connected over wireless debugging (if any)
#   3. Commits everything and pushes to GitHub  -> Vercel redeploys the website
#   4. Pushes the backend code to the Hugging Face Space
# Log: publish_log.txt in the project folder.
# ============================================================================
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
Start-Transcript -Path (Join-Path $root "publish_log.txt") -Force | Out-Null

function Step($t) { Write-Host ""; Write-Host "==== $t ====" -ForegroundColor Cyan }
$ok = @{}

# ---------------------------------------------------------------- 1. APK build
Step "1/4  Building Android APK"
$gradleCandidates = @(
  "$env:USERPROFILE\.gradle\wrapper\dists\gradle-8.14.3-all\10utluxaxniiv4wxiphsi49nj\gradle-8.14.3\bin\gradle.bat"
) + (Get-ChildItem "$env:USERPROFILE\.gradle\wrapper\dists" -Recurse -Filter gradle.bat -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | ForEach-Object { $_.FullName })
$javaCandidates = @(
  "$env:USERPROFILE\.jdks\jbr-21.0.11",
  "C:\Program Files\Android\Android Studio\jbr"
) + (Get-ChildItem "$env:USERPROFILE\.gradle\jdks" -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })

$apk = Join-Path $root "android\app\build\outputs\apk\release\app-release.apk"
$before = if (Test-Path $apk) { (Get-Item $apk).LastWriteTime } else { [datetime]::MinValue }
$built = $false
Push-Location (Join-Path $root "android")
foreach ($g in ($gradleCandidates | Select-Object -Unique)) {
  if (-not (Test-Path $g)) { continue }
  foreach ($j in ($javaCandidates | Select-Object -Unique)) {
    if (-not (Test-Path (Join-Path $j "bin\java.exe"))) { continue }
    Write-Host "Trying Gradle: $g"; Write-Host "      Java:   $j"
    $env:JAVA_HOME = $j
    $jh = $j -replace '\\', '/'
    & $g assembleRelease --console=plain "-Dorg.gradle.java.home=$jh"
    if ($LASTEXITCODE -eq 0 -and (Test-Path $apk) -and ((Get-Item $apk).LastWriteTime -gt $before)) { $built = $true; break }
  }
  if ($built) { break }
}
Pop-Location
if ($built) {
  Copy-Item $apk (Join-Path $root "android\sonora-android.apk") -Force
  New-Item -ItemType Directory -Force -Path (Join-Path $root "web\public\downloads") | Out-Null
  Copy-Item $apk (Join-Path $root "web\public\downloads\sonora-android.apk") -Force
  Write-Host "APK built and copied." -ForegroundColor Green
  $ok["APK build"] = "OK"
} else {
  Write-Host "APK build FAILED - continuing with the rest (old APK kept)." -ForegroundColor Red
  $ok["APK build"] = "FAILED (see log)"
}

# ---------------------------------------------------------------- 2. Install on phone
Step "2/4  Installing on phone"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
if ((Test-Path $adb) -and $built) {
  $devices = (& $adb devices) | Select-String "\tdevice$"
  if ($devices) {
    & $adb install -r $apk
    if ($LASTEXITCODE -eq 0) { $ok["Phone install"] = "OK" } else { $ok["Phone install"] = "FAILED" }
  } else { Write-Host "No phone connected (wireless debugging off) - skipped."; $ok["Phone install"] = "skipped (no phone)" }
} else { $ok["Phone install"] = "skipped" }

# ---------------------------------------------------------------- 3. GitHub
Step "3/4  Pushing to GitHub (Vercel redeploys automatically)"
git add -A
git commit -m "Mobile navigation, Facebook + phone sign-in on web and Android, auth flow matrix, backend hardening"
git push origin HEAD
if ($LASTEXITCODE -eq 0) { $ok["GitHub push"] = "OK" } else { $ok["GitHub push"] = "FAILED (see log)" }

# ---------------------------------------------------------------- 4. Hugging Face Space
Step "4/4  Updating Hugging Face Space"
$tokenFile = Join-Path $root ".secrets\hf_token.txt"
if (Test-Path $tokenFile) {
  $token = (Get-Content $tokenFile -Raw).Trim()
  $space = "lumosmaximus/dysarthrianet-api"
  $tmp = Join-Path $env:TEMP ("sonora_space_" + [guid]::NewGuid().ToString("N").Substring(0, 8))
  $env:GIT_LFS_SKIP_SMUDGE = "1"
  git clone --depth 1 "https://user:$token@huggingface.co/spaces/$space" $tmp
  if ($LASTEXITCODE -eq 0) {
    Copy-Item (Join-Path $root "backend\app.py") (Join-Path $tmp "app.py") -Force
    Copy-Item (Join-Path $root "backend\requirements.txt") (Join-Path $tmp "requirements.txt") -Force
    if (Test-Path (Join-Path $root "backend\packages.txt")) { Copy-Item (Join-Path $root "backend\packages.txt") (Join-Path $tmp "packages.txt") -Force }
    New-Item -ItemType Directory -Force -Path (Join-Path $tmp "app") | Out-Null
    Copy-Item (Join-Path $root "backend\app\*") (Join-Path $tmp "app") -Recurse -Force -Exclude "__pycache__"
    Get-ChildItem $tmp -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Push-Location $tmp
    git -c user.name="Lovish Manchanda" -c user.email="lovishmanchanda719@gmail.com" add -A
    git -c user.name="Lovish Manchanda" -c user.email="lovishmanchanda719@gmail.com" commit -m "Sync backend from Sonora repo"
    git push
    if ($LASTEXITCODE -eq 0) { $ok["Hugging Face push"] = "OK (Space rebuilds in a few minutes)" } else { $ok["Hugging Face push"] = "nothing new or FAILED (see log)" }
    Pop-Location
  } else { $ok["Hugging Face push"] = "FAILED to clone Space (token or name)" }
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
} else { $ok["Hugging Face push"] = "skipped (no .secrets\hf_token.txt)" }

Step "Summary"
$ok.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Host ("{0,-20} {1}" -f $_.Name, $_.Value) }
Stop-Transcript | Out-Null
Write-Host ""
Read-Host "Done. Press Enter to close"
