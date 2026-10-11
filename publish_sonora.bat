@echo off
rem Builds the APK, installs it on your phone, pushes to GitHub (Vercel) and Hugging Face.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish_sonora.ps1"
