import os
import shutil
import subprocess
from PIL import Image, ImageDraw

BASE_DIR = r"c:\Users\Lovish\Documents\dysarthria_project\android"
APP_MAIN = os.path.join(BASE_DIR, "app", "src", "main")
RES_DIR = os.path.join(APP_MAIN, "res")
BUILD_DIR = os.path.join(BASE_DIR, "build_apk_out")

SDK_DIR = r"C:\Users\Lovish\AppData\Local\Android\Sdk"
BUILD_TOOLS = os.path.join(SDK_DIR, "build-tools", "36.0.0")
ANDROID_JAR = os.path.join(SDK_DIR, "platforms", "android-36", "android.jar")

AAPT2 = os.path.join(BUILD_TOOLS, "aapt2.exe")
D8 = os.path.join(BUILD_TOOLS, "d8.bat")
ZIPALIGN = os.path.join(BUILD_TOOLS, "zipalign.exe")
APKSIGNER = os.path.join(BUILD_TOOLS, "apksigner.bat")

def generate_icons():
    sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    for folder, size in sizes.items():
        out_dir = os.path.join(RES_DIR, folder)
        os.makedirs(out_dir, exist_ok=True)
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Draw rounded gradient-like background (#0284c7 -> #4f46e5 -> #0d9488)
        pad = max(2, int(size * 0.04))
        radius = int(size * 0.24)
        for y in range(pad, size - pad):
            t = (y - pad) / max(1, (size - 2 * pad))
            r = int(2 * (1 - t) + 79 * t)
            g = int(132 * (1 - t) + 70 * t)
            b = int(199 * (1 - t) + 229 * t)
            draw.line([(pad, y), (size - pad, y)], fill=(r, g, b, 255))

        # Apply rounded mask
        mask = Image.new("L", (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=255)
        bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        bg.paste(img, (0, 0), mask)
        draw = ImageDraw.Draw(bg)

        # Draw Sonora acoustic waveform bars in white
        cx, cy = size / 2.0, size / 2.0
        bar_w = max(2, int(size * 0.075))
        gap = max(3, int(size * 0.135))
        heights = [0.22, 0.42, 0.62, 0.42, 0.22]
        offsets = [-2, -1, 0, 1, 2]
        for off, h_ratio in zip(offsets, heights):
            bx = cx + off * gap
            bh = size * h_ratio
            x0 = bx - bar_w / 2
            y0 = cy - bh / 2
            x1 = bx + bar_w / 2
            y1 = cy + bh / 2
            draw.rounded_rectangle([x0, y0, x1, y1], radius=bar_w / 2, fill=(255, 255, 255, 255))

        bg.save(os.path.join(out_dir, "ic_launcher.png"), "PNG")
    print("Generated Sonora launcher icons across mdpi..xxxhdpi.")

def run_cmd(cmd, cwd=None):
    print("Running:", " ".join(cmd))
    res = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if res.returncode != 0:
        print("STDOUT:", res.stdout)
        print("STDERR:", res.stderr)
        raise RuntimeError(f"Command failed with exit code {res.returncode}")
    return res

def build_apk():
    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR)
    os.makedirs(BUILD_DIR, exist_ok=True)

    compiled_res_zip = os.path.join(BUILD_DIR, "compiled_res.zip")
    gen_java_dir = os.path.join(BUILD_DIR, "gen")
    classes_dir = os.path.join(BUILD_DIR, "classes")
    os.makedirs(gen_java_dir, exist_ok=True)
    os.makedirs(classes_dir, exist_ok=True)

    # 1. Compile resources with aapt2
    run_cmd([
        AAPT2, "compile",
        "--dir", RES_DIR,
        "-o", compiled_res_zip
    ])

    # 2. Link resources + AndroidManifest.xml + assets with aapt2
    unaligned_apk = os.path.join(BUILD_DIR, "sonora-unaligned.apk")
    manifest_path = os.path.join(APP_MAIN, "AndroidManifest.xml")
    assets_dir = os.path.join(APP_MAIN, "assets")

    run_cmd([
        AAPT2, "link",
        "-o", unaligned_apk,
        "-I", ANDROID_JAR,
        "--manifest", manifest_path,
        "-A", assets_dir,
        "--java", gen_java_dir,
        compiled_res_zip,
        "--auto-add-overlay"
    ])

    # 3. Compile Java sources (R.java + MainActivity.java)
    r_java = os.path.join(gen_java_dir, "ai", "sonora", "speech", "R.java")
    main_java = os.path.join(APP_MAIN, "java", "ai", "sonora", "speech", "MainActivity.java")
    run_cmd([
        "javac",
        "--release", "11",
        "-cp", ANDROID_JAR,
        "-d", classes_dir,
        r_java,
        main_java
    ])

    # 4. Convert .class files to classes.dex using d8
    class_files = []
    for root, _, files in os.walk(classes_dir):
        for f in files:
            if f.endswith(".class"):
                class_files.append(os.path.join(root, f))

    run_cmd([
        D8,
        "--lib", ANDROID_JAR,
        "--output", BUILD_DIR,
        *class_files
    ])

    # 5. Add classes.dex into unaligned APK
    import zipfile
    dex_path = os.path.join(BUILD_DIR, "classes.dex")
    with zipfile.ZipFile(unaligned_apk, "a", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(dex_path, "classes.dex")

    # 6. Zipalign APK
    aligned_apk = os.path.join(BUILD_DIR, "sonora-aligned.apk")
    run_cmd([
        ZIPALIGN, "-f", "-p", "4",
        unaligned_apk,
        aligned_apk
    ])

    # 7. Generate signing keystore if not exists & sign APK (v1 + v2 + v3)
    keystore_path = os.path.join(BASE_DIR, "sonora-release.keystore")
    if not os.path.exists(keystore_path):
        run_cmd([
            "keytool", "-genkeypair",
            "-v",
            "-keystore", keystore_path,
            "-alias", "sonora",
            "-keyalg", "RSA",
            "-keysize", "2048",
            "-validity", "10000",
            "-storepass", "sonora123",
            "-keypass", "sonora123",
            "-dname", "CN=Sonora AI, OU=Clinical Acoustic AI, O=Sonora, L=New Delhi, ST=Delhi, C=IN"
        ])

    final_apk_android = os.path.join(BASE_DIR, "sonora-android.apk")
    run_cmd([
        APKSIGNER, "sign",
        "--ks", keystore_path,
        "--ks-key-alias", "sonora",
        "--ks-pass", "pass:sonora123",
        "--key-pass", "pass:sonora123",
        "--out", final_apk_android,
        aligned_apk
    ])

    # Verify APK signature
    run_cmd([APKSIGNER, "verify", "-v", final_apk_android])

    # Copy to web/public/downloads/sonora-android.apk
    web_dl_dir = r"c:\Users\Lovish\Documents\dysarthria_project\web\public\downloads"
    os.makedirs(web_dl_dir, exist_ok=True)
    web_apk_path = os.path.join(web_dl_dir, "sonora-android.apk")
    shutil.copy2(final_apk_android, web_apk_path)

    size_kb = os.path.getsize(final_apk_android) / 1024.0
    print(f"SUCCESS! Built & signed sonora-android.apk ({size_kb:.1f} KB)")
    print(f" -> {final_apk_android}")
    print(f" -> {web_apk_path}")

if __name__ == "__main__":
    generate_icons()
    build_apk()
