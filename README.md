# Sonora — Clinical Neuromotor Speech Assessment & Rehabilitation Platform
**Powered by `DysarthriaNet-XC`: Cross-Corpus Generalization, Layer Representation, and Domain Adaptation Benchmark in Speech-Based Dysarthria Assessment**

[![GitHub Repository](https://img.shields.io/badge/GitHub-LovishManchanda719%2FSonora-0284c7?logo=github)](https://github.com/LovishManchanda719/Sonora)
[![Download Android APK](https://img.shields.io/badge/Download_Android_APK-Sonora_v2.4-0d9488?logo=android)](https://github.com/LovishManchanda719/Sonora/raw/main/android/sonora-android.apk)

> **Direct Android APK Download:** [**Click here to download `sonora-android.apk`**](https://github.com/LovishManchanda719/Sonora/raw/main/android/sonora-android.apk)
---

## 1. Platform Overview

**Sonora** is an end-to-end clinical speech telemetry, screening, and neuro-rehabilitation ecosystem built around the **DysarthriaNet-XC** acoustic engine (`TORGO` + `EasyCall` + `Italian Parkinson's` multi-corpus domain-aligned architecture).

### Core Product Capabilities (Web + Native Android APK)
1. **Dual-Mode Acoustic Screening Protocol**:
   - **Standard 3-Task Clinical Battery (`~5s × 3`)**: Sustained Vowel `/a/` (5s), Diadochokinetic (DDK) `Pa-Ta-Ka` (5s), and Connected Sentence Reading (`"The grandfather clock chimes every hour."`).
   - **Advanced Extended Statement Protocol (`3 × 15s / 30s ★ Sweet Spot / 45s`)**: Continuous multi-sentence standardized reading passages with a live high-contrast reading teleprompter, progress bar, and auto-stop to detect articulatory fatigue, respiratory phrasing decay, and prosodic drift.
   - **Robust 2.0s Trimmed-Median Ambient Calibration**: Automatically trims the top 25% transient mic pops and bottom 15% silence drop-outs to establish an accurate room noise floor (`dB`).
2. **Interactive Neuro-Rehabilitation Suite**:
   - **Real-Time Visual Decibel (`dB SPL`) Biofeedback Meter** (`65 dB` clinical LSVT LOUD target line + sustained hold timer).
   - **Digital Multi-Slot Pacing Board** (`45–120 BPM` metronome with syllable tap-to-pace slots and custom phrase builder).
   - **Minimal Contrast Word Pair Drills** (`Voicing`, `Place`, `Manner`, `Cluster` phoneme contrasts with acoustic self-check).
3. **Care & Clinical Directory**:
   - **India RCI-Certified Speech-Language Pathologist (SLP) Locator** with live Haversine GPS distance sorting (`km`), hospital filters, and direct call/maps links (AIIMS New Delhi, NIMHANS Bengaluru, AYJNISHD Mumbai, AIISH Mysuru, PGIMER Chandigarh, CMC Vellore).
   - **6 Practical Conversation Rules for Family & Caregivers** with clinical illustrations and printable communication cards.
4. **Longitudinal Clinical Dossier & India Legal Compliance**:
   - Multi-session trajectory comparison, CSV & Printable Clinical Dossier export, Google OAuth & Email/Password sync, and full regulatory modals (**India DPDP Act 2023**, **CDSCO Software-as-a-Medical-Device SaMD Non-Diagnostic Notice**, and **RCI Act 1992 Scope of Practice**).

---

## 2. Monorepo Architecture

```text
Sonora/
├── web/                               # Next.js 16 + React 19 + Tailwind CSS v4 Web Application
│   ├── public/
│   │   ├── downloads/
│   │   │   └── sonora-android.apk     # Signed Android APK served directly from the web app
│   │   ├── icon.svg                   # Custom Sonora acoustic wave vector icon
│   │   └── favicon.ico                # Multi-resolution browser tab icon
│   └── src/
│       ├── app/                       # App Router pages (/screen, /therapy/*, /find-slp, /profile, /about, /contact)
│       ├── components/                # AudioRecorder, Navbar, Footer, LegalModal, Caregiver visuals
│       └── lib/                       # Client acoustic fallback DSP, Firebase auth/storage, session store
│
├── android/                           # Native Android Application (ai.sonora.speech)
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml        # Permissions for Mic, Location, Vibration, Hardware WebView
│   │   ├── java/ai/sonora/speech/     # MainActivity.java + SonoraNative JS Bridge (Haptics, Print PDF, Share)
│   │   └── assets/sonora_app.html     # 60 FPS Mobile UI + 16 kHz WAV Recorder + Hybrid Cloud/On-Device DSP
│   ├── build_apk.py                   # Reproducible Android SDK build-tools APK compiler & signer
│   └── sonora-android.apk             # Ready-to-install signed Android package
│
├── backend/                           # Production FastAPI Microservice
│   ├── app/
│   │   ├── main.py                    # FastAPI entrypoint with CORS, rate-limiting & lifespan warmup
│   │   ├── schemas/                   # Pydantic v2 contracts (Clip & Multi-Task Session response)
│   │   ├── services/                  # 16 kHz Audio DSP, DysarthriaNet-XC inference & Clinical Report Agent
│   │   └── api/                       # REST endpoints (/api/v1/health, /api/v1/screen/clip, /session)
│   └── models/                        # Self-contained production model bundle (dysarthrianet_unified_v1.joblib)
│
└── ml_model/                          # DysarthriaNet-XC Research Benchmark, Experiments (exp1-exp7) & Tests
```

---

## 3. Quick Start

### A. Web Application (`web/`) — Vercel Ready
```bash
cd web
npm install
npm run dev
```
Open `http://localhost:3000`. When deploying to **Vercel**, set the **Root Directory** to `web` (or deploy from root using the root `vercel.json`). The signed Android APK is automatically served at `/downloads/sonora-android.apk`.

### B. FastAPI Backend (`backend/`)
```bash
python -m uvicorn backend.app.main:app --reload --reload-dir backend --port 8000
```

### C. Android Application (`android/`)
Install directly onto a connected Android device (USB or Wireless Debugging):
```bash
adb install -r android/sonora-android.apk
```
Or rebuild from source using the Android SDK `build-tools`:
```bash
python android/build_apk.py
```

---

## 4. DysarthriaNet-XC Research Summary

1. **The Cross-Corpus Generalization Gap**: Models achieving 66%–87% balanced accuracy within-corpus drop to 41.8%–56.3% when transferred zero-shot to unseen external corpora.
2. **Heterogeneous CORAL Adaptation**: Regularized Correlation Alignment (CORAL) yields `+6.14 pp` on `TORGO -> EasyCall`, while domain-standardized multi-source pooling stabilizes cross-device inference.
3. **Layer Representation Dynamics**: Early acoustic transformer layers (`Wav2Vec 2.0 Layer 1`) outperform semantic layers (`Layer 12`) by `+8.30 pp` on phonatory tremor and vocal stability detection.
4. **Cost-Sensitive Severity Calibration**: Asymmetric clinical risk weighting recovers severe dysarthria recall without inflating false-positive screening rates.

### Primary Citations
- **TORGO Database**: Rudzicz, F., Namasivayam, A. K., & Wolff, T. (2012). *Language Resources and Evaluation*, 46(4), 523–541.
- **EasyCall Corpus**: Turrisi, R., et al. (2021). *Proc. Interspeech 2021*, 41–45.
