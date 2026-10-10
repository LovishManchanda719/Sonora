# DysarthriaNet-XC — Complete Project Walkthrough (Start to Finish)

This document explains, in full detail, everything you will do in this project, in the order you will do it. Read it once fully before writing any code. Each phase says what you're doing, why you're doing it, what "done" looks like, and roughly how long it should take.

---

## 0. The One-Sentence Goal

Build a system that listens to a short audio clip and predicts (a) whether the speaker has dysarthria and (b) how severe it is — then rigorously prove whether this system actually generalizes to speakers/recording setups it has never seen, and try to fix it if it doesn't.

---

## 1. The Big Picture — What You're Actually Building

Think of the whole project as five layers stacked on top of each other:

```
Layer 6: PATIENT/CAREGIVER LAYER →  Progress tracking, plain-language info, caregiver tips, exportable reports
Layer 5: DEMO                   →  Guided multi-prompt screening battery (vowels, DDK syllables, sentences)
Layer 4: REPORT AGENT           →  Turns "82% dysarthric, moderate severity" into a human sentence
Layer 3: INTERPRETABILITY       →  Explains WHY the model made that decision (SHAP acoustic functionals)
Layer 2: CLASSIFIER & CONSENSUS →  Multimodal ML + Multi-utterance "fingerprint" evidence accumulator
Layer 1: FEATURES               →  Wav2Vec 2.0 (768-D) + openSMILE eGeMAPSv02 (88-D) Multimodal Fusion
Layer 0: DATA                   →  The raw recordings of dysarthric and healthy speech
```

Layer 6 is where Phase 12B lives — it's the only layer aimed at a non-technical end user (the patient or their family) rather than at your research evaluation. Everything below it exists to make Layer 6 trustworthy: the classifier (Layer 2) has to actually work, the cross-corpus testing has to be honest, and the interpretability/report layers have to explain the result faithfully — otherwise Layer 6 is just a nice UI on top of an untrustworthy number.

You build this bottom-up: Layer 0 first, Layer 5 last. Each layer depends on the one below it working correctly. If Layer 1 (features) is broken, everything above it is garbage — so don't rush the early phases.

The **research contribution** — the actual "new thing" you're adding to the world, which is what makes this publishable — lives specifically in how you test Layer 2: you don't just train and test on the same dataset (which is what most student projects do and what makes results misleadingly high). You train on one dataset and test on a completely different one, show the accuracy crashes, and then try to partially fix that crash. That experiment, done rigorously, is your paper.

---

## PHASE 1 — Environment & Tooling Setup
**Time: half a day. Do this literally first, before touching any data.**

### 1.1 What you need accounts/access for
- **Google account** for Colab (free tier) — https://colab.research.google.com
- **Kaggle account** for Kaggle Notebooks (free tier, sometimes more GPU hours than Colab) — https://www.kaggle.com
- **HuggingFace account** (free) — needed to download wav2vec2/HuBERT model weights — https://huggingface.co/join
- **GitHub account** — for your team's shared code repository (create a private repo, add all 4 members + mentor if required)
- **Google Drive** — you will store extracted features/embeddings here so you don't have to re-extract them every session (extraction is slow; do it once, save the result, reuse it)

### 1.2 What "environment" means here practically
You are NOT installing anything on your personal laptops for the heavy compute — everything GPU-related runs inside Colab/Kaggle notebooks in the browser. Your laptops are just for: writing/reviewing code in a text editor, managing the GitHub repo, and writing the paper.

### 1.3 Software stack (all installed via `pip install` inside your Colab notebook, not on your laptop)
- `torch`, `torchaudio` — deep learning framework + audio loading
- `transformers` (HuggingFace) — gives you wav2vec2 and HuBERT with ~5 lines of code
- `librosa` — audio processing, used for MFCC extraction and general audio utilities
- `opensmile` — extracts eGeMAPS classical acoustic features
- `scikit-learn` — SVM classifiers, train/test splitting, evaluation metrics
- `pandas`, `numpy` — data wrangling, the backbone of everything
- `matplotlib`, `seaborn` — charts for your results section
- `shap` — interpretability
- `langchain` — clinical report synthesis layer
- `gradio` — the demo interface

### 1.4 GitHub repo structure (set this up now, empty folders are fine)
```
dysarthrianet-xc/
├── data/                  (NOT committed to git — too large; add to .gitignore)
│   ├── torgo/
│   └── ua_speech/
├── notebooks/
│   ├── 01_data_prep.ipynb
│   ├── 02_baseline_features.ipynb
│   ├── 03_pretrained_embeddings.ipynb
│   ├── 04_within_corpus_classifiers.ipynb
│   ├── 05_cross_corpus_eval.ipynb
│   ├── 06_coral_adaptation.ipynb
│   ├── 07_severity_classification.ipynb
│   ├── 08_shap_interpretability.ipynb
│   ├── 09_report_agent.ipynb
│   └── 10_gradio_demo.ipynb
├── src/                   (reusable Python functions, imported into notebooks)
│   ├── data_loading.py
│   ├── feature_extraction.py
│   ├── models.py
│   ├── coral.py
│   └── evaluation.py
├── results/               (saved CSVs, plots, model checkpoints)
├── paper/                 (LaTeX or Word draft of the paper)
└── README.md
```

**Why this structure matters:** each notebook corresponds to one phase below. This lets 4 people work in parallel without constantly overwriting each other's work — one person owns notebooks 2-3, another owns 4-6, etc. (see team split at the very end of this document).

---

## PHASE 2 — Getting the Data
**Time: 2-5 days (mostly waiting for UA-Speech approval, not active work)**

### 2.1 TORGO — download immediately, no approval needed
- Go to http://www.cs.toronto.edu/~complingweb/data/TORGO/torgo.html
- Download the full dataset (~18GB, split into multiple parts per speaker)
- It contains 15 speakers: 8 with dysarthria, 7 controls (healthy speakers)
- Each speaker's folder has subfolders for sessions, and within those, audio files (`.wav`) paired with prompt text and, for some speakers, articulatory data (ignore the articulatory/EMA data — you don't need it, audio only)

### 2.2 UA-Speech — request access TODAY, this is your bottleneck
- Email **uaspeech-request@lists.illinois.edu**
- Use your official DTU student email
- In the email: state your name, that you're a final-year B.Tech CSE student at Delhi Technological University, name your project supervisor (Dr. Sunakshi Mehra), briefly describe the academic research purpose (cross-corpus dysarthria classifier generalization study), and ask for access credentials.
- While waiting (could take several days), proceed with Phases 3-6 using TORGO alone — you can build and test your entire pipeline on TORGO first, then simply re-run it on UA-Speech once access arrives. Nothing is wasted by starting with one dataset.
- Once approved, you'll get sftp/ftp credentials. Download all 16 speakers' data (8 dysarthric, 8 control), which includes isolated word recordings (455 words per speaker) plus severity/intelligibility ratings for each dysarthric speaker.

### 2.3 What "done" looks like for this phase
Both datasets sitting in your `data/` folder (or in Google Drive, referenced from Colab), each with a clear list of which speaker is dysarthric vs. control, and for UA-Speech, each dysarthric speaker's severity label (low/mid/high intelligibility, which maps to severity).

---

## PHASE 3 — Data Organization & Preprocessing
**Time: 2-3 days**

### 3.1 Build the metadata CSV
For each dataset, create a single CSV file with these columns:
| file_path | speaker_id | label | severity | dataset_source |
|---|---|---|---|---|
| torgo/F01/Session1/wav_arrayMic/0001.wav | F01 | dysarthric | severe | TORGO |
| torgo/MC01/Session1/wav_headMic/0001.wav | MC01 | control | none | TORGO |

This CSV is the single source of truth your entire pipeline reads from. Every later phase starts by loading this CSV.

**Why speaker_id matters so much:** later, when you split data into train/test, you must never let the same speaker appear in both the training set and the test set. If speaker F01's voice appears in training, the model can partially "memorize" that specific person's voice characteristics rather than learning general dysarthria patterns — this artificially inflates your accuracy and is considered a methodological flaw reviewers will catch immediately. You split by speaker, not by individual audio file.

### 3.2 Audio preprocessing (standardizing format)
Both datasets likely have different sample rates, channel counts, and recording lengths. Before feature extraction, write a preprocessing function that:
1. Loads each `.wav` file
2. Resamples to 16kHz mono (this is the standard input format wav2vec2/HuBERT expect)
3. Trims leading/trailing silence (using `librosa.effects.trim`)
4. Optionally normalizes volume (peak normalization) so loudness differences between datasets don't confound your features
5. Saves the processed audio (or does this on-the-fly during feature extraction — either works, but doing it once and caching is faster for repeated experiments)

### 3.3 Handle the UA-Speech multi-microphone issue
UA-Speech was recorded with a 7-channel microphone array. Pick ONE consistent microphone channel across all UA-Speech files (commonly channel 6, the one closest to the speaker, is used in prior literature — confirm this in the dataset documentation) so you're not accidentally mixing different microphone qualities within the same "dataset."

### 3.4 What "done" looks like for this phase
A clean, verified metadata CSV for each dataset, and a `load_and_preprocess_audio(file_path)` function in `src/data_loading.py` that any later notebook can call to get a standardized audio waveform.

---

## PHASE 4 — Classical Baseline Features (MFCC + eGeMAPS)
**Time: 2 days**

### 4.1 Why build a "boring" baseline first
Before you can claim "pretrained embeddings work well," you need something to compare against. MFCC and eGeMAPS are the traditional, hand-engineered acoustic features used in speech pathology research for the last 20 years. If your fancy pretrained model doesn't beat these, that itself is an important (if disappointing) finding you'd need to report honestly.

### 4.2 MFCC extraction
Using `librosa.feature.mfcc()`, extract Mel-Frequency Cepstral Coefficients from each audio file — this gives a time-series of ~13-40 coefficients per audio frame. Since your classifier needs one fixed-length vector per audio file (not a time series), compute summary statistics (mean, standard deviation, min, max) across time for each coefficient, giving you one flat feature vector per file.

### 4.3 eGeMAPS extraction (via openSMILE)
```python
import opensmile
smile = opensmile.Smile(
    feature_set=opensmile.FeatureSet.eGeMAPSv02,
    feature_level=opensmile.FeatureLevel.Functionals,
)
features_df = smile.process_file('path/to/audio.wav')
```
This single line gives you 88 pre-computed "functional" acoustic features per file (pitch statistics, jitter, shimmer, loudness, spectral characteristics — all things known to correlate with speech pathology in prior clinical research). Run this over every file in both datasets and save as a CSV.

### 4.4 Train the baseline classifiers
Using scikit-learn's SVM (`sklearn.svm.SVC`), train two separate classifiers — one on MFCC features, one on eGeMAPS features — for the binary task (dysarthric vs. control). Do a speaker-independent train/test split (80/20) WITHIN a single corpus first (e.g., TORGO only). Report accuracy, precision, recall, F1-score, and a confusion matrix for each.

### 4.5 What "done" looks like for this phase
Two working baseline classifiers with documented within-corpus performance numbers, saved to `results/baseline_results.csv`. These numbers are your "floor" — everything you build afterward should ideally beat this.

---

## PHASE 5 — Pretrained Embedding Extraction (wav2vec2 & HuBERT)
**Time: 2-3 days (this is the slowest step computationally, budget GPU time carefully)**

### 5.1 What's actually happening here, conceptually
wav2vec2 and HuBERT are neural networks that were trained by Meta/Facebook on enormous amounts of general speech audio (hundreds of thousands of hours) to learn a general-purpose understanding of "what speech sounds like." You are NOT training these models — you're using them exactly as they are, as a fixed "feature extractor." You feed in raw audio, and it outputs a rich numerical representation (an embedding) that captures far more nuance than MFCC/eGeMAPS ever could, because it learned from so much more data than you could ever collect yourself.

### 5.2 Loading the models
```python
from transformers import Wav2Vec2Model, Wav2Vec2FeatureExtractor
model = Wav2Vec2Model.from_pretrained("facebook/wav2vec2-base-960h")
extractor = Wav2Vec2FeatureExtractor.from_pretrained("facebook/wav2vec2-base-960h")
```
Same pattern for HuBERT using `HubertModel.from_pretrained("facebook/hubert-base-ls960")`.

### 5.3 Extracting embeddings
For each audio file: feed it through the model, take the last hidden state (a sequence of vectors, one per audio frame), and **mean-pool across time** (average all the frame-level vectors into one single vector). This gives you one fixed-length embedding (768 dimensions for the base models) per audio file — directly comparable in structure to your MFCC/eGeMAPS feature vectors, just far richer.

### 5.4 Critical: freeze the model (do not fine-tune it)
Set the model to evaluation mode and disable gradient computation (`torch.no_grad()`). You are NOT updating the pretrained model's weights — fine-tuning the entire model would require far more GPU memory and time than free Colab/Kaggle gives you, and isn't necessary for a strong result. You're only using it to extract embeddings; the actual "learning" happens in the small classifier you train on top in Phase 6.

### 5.5 Save embeddings to disk immediately
Extraction is slow (could take 1-3 hours depending on dataset size and GPU availability). Once you extract embeddings, save them as a `.npy` or `.csv` file, associated with each file's metadata row. Never re-extract if you don't have to — load the saved embeddings in every subsequent notebook instead.

### 5.6 What "done" looks like for this phase
Two embedding matrices (one for wav2vec2, one for HuBERT) for each dataset, saved to disk, each row corresponding to one audio file's fixed-length embedding vector, linked back to the metadata CSV via file_path or a shared index.

---

## PHASE 6 — Within-Corpus Classifier Training
**Time: 2 days**

### 6.1 Train classifiers on top of embeddings
Using the same speaker-independent 80/20 split methodology as Phase 4, train:
- An SVM on wav2vec2 embeddings
- An SVM on HuBERT embeddings
- A small 2-layer neural network (MLP) on wav2vec2 embeddings
- A small 2-layer neural network (MLP) on HuBERT embeddings

Keep the MLP genuinely small (e.g., 768 → 128 → 2 neurons) — you have limited training data (a few hundred to a few thousand audio clips depending on dataset), so a huge network would just overfit.

### 6.2 Compare against baselines
Build one consolidated results table: rows = feature type (MFCC, eGeMAPS, wav2vec2, HuBERT), columns = classifier type (SVM, MLP where applicable) × metric (accuracy, precision, recall, F1). This table, done within-corpus on both TORGO and UA-Speech separately, is your first real results table for the paper.

### 6.3 What "done" looks like for this phase
A clear answer to: "do pretrained embeddings beat classical features, within a single corpus?" (Prior literature says yes, by roughly 1-3% accuracy — you should see something similar; if you see a much bigger or smaller gap, double check your pipeline for bugs before assuming it's a real finding.)

### 6.4 The Tri-Modal Fusion & ANOVA Feature Selection Architecture (SOTA Champion)
To squeeze the maximum possible diagnostic performance out of the acoustic signal under strict speaker-independent validation, we engineered a **Tri-Modal Feature Fusion architecture** (934 dimensions) combining three complementary acoustic strata:
1. **Wav2Vec 2.0 Foundation Embeddings (768-D)**: Self-supervised phonemic representations capturing high-level invariant speech motor structures.
2. **openSMILE eGeMAPSv02 Functionals (88-D)**: Clinical vocal biomarkers capturing phonatory instability, shimmer, jitter, harmonics-to-noise ratio (HNR), and formant frequencies.
3. **MFCC Dynamics with First and Second Derivatives (78-D)**: Classical cepstral coefficients, deltas, and delta-deltas capturing dynamic vocal tract trajectory and transition velocity.

**Mitigating Speaker Identity Confounding via ANOVA Feature Selection:**
Because 934 features can encode speaker-specific vocal tract morphology and pitch ranges, we apply univariate ANOVA F-score feature selection (`SelectKBest(f_classif, k=600)`). Pruning the 334 weakest/speaker-biased dimensions forces the linear margin classifier (`LinearSVC`, calibrated, C = 0.50) to focus exclusively on pathological variance.
- **Single-Clip Accuracy:** **76.95%** (vs. 68.85% MFCC baseline floor, an **+8.10% absolute gain**).
- **Single-Clip Recall:** **73.00%** (vs. 60.55% baseline floor, a **+12.45% absolute gain**).


### 6.5 The Multi-Prompt "Fingerprint" Clinical Protocol (Session-Level Evidence Accumulation)
**Why single-clip evaluation is clinically insufficient:**
A patient with mild dysarthria saying a single, isolated 1-second word (e.g. "cat" or "up") often sounds completely normal on that single word because it demands minimal articulatory effort. In our empirical testing on TORGO, single isolated clips achieved 76.95% accuracy, but single-clip sensitivity on mild patients dropped to ~50% (whereas severe patients were detected at 90.5%–100%).

**The Fingerprint Analogy:**
Just as a smartphone biometric sensor never registers a fingerprint from a single press (requiring 6–7 scans from different angles to capture edges, arches, and ridges), a clinical speech assessment must never rely on a single isolated word. A reliable screening battery asks the patient to record 5 to 7 varied speech tasks:
1. **Sustained Vowels** (*"Ahhhhh"* for 3-5 seconds) — exposes vocal fold tremors, phonatory breathiness, and jitter/shimmer.
2. **Diadochokinetic (DDK) Syllables** (*"pa-ta-ka"*) — exposes motor timing, cerebellar coordination, and tongue velocity.
3. **Continuous Connected Speech** (*"The grandfather passage"*) — exposes articulatory slurring, prosodic decay, and speech muscle fatigue.

**The Mathematical Impact of Tri-Modal Session Consensus:**
By accumulating evidence across the recordings of a patient session:
- **Patient-Level Diagnostic Accuracy jumps to 86.7%** (13 out of 15 patients diagnosed correctly under zero speaker overlap).
- **Healthy Control Specificity is 100.0%** (zero false alarms across all healthy controls at threshold 0.40–0.50).
- **Dysarthric Screening Recall jumps to 87.5%** (detecting 7 out of 8 dysarthric patients at screening threshold 0.30).
- Single-word acoustic anomalies and recording noise average out, leaving a clinically dependable diagnostic consensus.


---

## PHASE 7 — Cross-Corpus Evaluation (Your Core Contribution)
**Time: 2-3 days — this is the heart of your paper**

### 7.1 The experiment, precisely
1. Train a classifier using ALL of TORGO's data (no train/test split needed here — you're using the entire dataset as training data).
2. Test that exact same trained classifier on ALL of UA-Speech's data (which it has never seen).
3. Record accuracy, precision, recall, F1 on UA-Speech.
4. Reverse it: train on all of UA-Speech, test on all of TORGO.
5. Do this for every feature type (MFCC, eGeMAPS, wav2vec2, HuBERT) and classifier type (SVM, MLP) from Phase 6.

### 7.2 The comparison that matters
For each feature/classifier combination, you now have TWO numbers: the within-corpus accuracy (from Phase 6, e.g., trained AND tested on TORGO) and the cross-corpus accuracy (from this phase, e.g., trained on TORGO, tested on UA-Speech). **The gap between these two numbers is your key finding.** Expect this gap to be substantial — prior work (the arXiv 2509.19946 paper you read) found exactly this kind of drop, and a very recent paper (DSSCNet, arXiv 2606.22178) reports cross-corpus accuracies around 68-76%, noticeably lower than typical within-corpus numbers in the 85-95% range.

### 7.3 Visualize it
Build a grouped bar chart: x-axis = feature type (MFCC, eGeMAPS, wav2vec2, HuBERT), two bars per group in different colors (within-corpus accuracy vs. cross-corpus accuracy). This single chart, done well, is probably the most important figure in your entire paper — it visually proves your problem statement is real.

### 7.4 What "done" looks like for this phase
A results table and a chart clearly showing: "here's how much accuracy each method loses when tested on a new, unseen dataset."

---

## PHASE 8 — CORAL Domain Adaptation (Your Proposed Fix)
**Time: 3-4 days**

### 8.1 The intuition, in plain words
Imagine TORGO's embeddings, as a cloud of points in high-dimensional space, sit in a slightly different "neighborhood" than UA-Speech's embeddings — even for the same underlying speech condition — just because of recording differences. CORAL is a technique that mathematically "reshapes" one dataset's embedding cloud to statistically resemble the other's, before you train your classifier, so the classifier is less likely to accidentally key off dataset-specific quirks.

### 8.2 The actual math (simplified)
1. Compute the covariance matrix of your source dataset's embeddings (how the features vary together) and your target dataset's embeddings.
2. "Whiten" the source embeddings (transform them to have identity covariance — i.e., remove the source's specific statistical structure).
3. "Re-color" them using the target's covariance (impose the target's statistical structure onto them).
4. Now your source embeddings statistically resemble the target's distribution, while still containing the original speech-pathology-relevant information.

This is roughly 15-20 lines of NumPy code — you're not implementing anything algorithmically complex, just careful matrix operations (covariance, matrix square root, matrix inverse).

### 8.3 Apply and re-test
Apply CORAL to align your TORGO embeddings toward UA-Speech's distribution (or vice versa), then repeat the exact cross-corpus experiment from Phase 7 using these aligned embeddings instead of raw ones. Compare: does cross-corpus accuracy improve compared to Phase 7's raw cross-corpus numbers?

### 8.4 Be prepared for either outcome — both are publishable
- **If CORAL helps:** great, you have a clean "here's our fix, and here's the quantified improvement" result.
- **If CORAL barely helps or doesn't help:** this is ALSO a legitimate, honest, publishable finding — it tells the field that simple feature-alignment isn't sufficient for this particular generalization problem, motivating more sophisticated future approaches. Do not be tempted to only report favorable results — report what actually happened and discuss why, honestly, in your paper.

### 8.5 What "done" looks like for this phase
A results table showing cross-corpus accuracy with vs. without CORAL applied, for your best-performing feature type from Phase 7.

---

## PHASE 9 — Severity Classification
**Time: 2 days**

### 9.1 What's different here
So far you've done binary classification (dysarthric vs. control). Now, using only the dysarthric-labeled data (which has severity annotations — mild/moderate/severe, or in UA-Speech's case, low/mid/high intelligibility), train a multi-class classifier that predicts severity level instead of just presence/absence.

### 9.2 Repeat the same structure
Same features (wav2vec2/HuBERT embeddings), same classifier types (SVM/MLP), same within-corpus and cross-corpus evaluation structure as Phases 6-7, just with severity as the target label instead of binary dysarthric/control. Report macro-F1 (since severity classes are likely imbalanced — severe cases are typically rarer than mild ones) rather than plain accuracy.

### 9.3 What "done" looks like for this phase
A parallel results table to Phase 6/7, but for the severity task, showing whether the same cross-corpus generalization problem shows up here too (it likely will, possibly even more severely, since severity is a harder, more nuanced judgment than simple presence/absence).

---

## PHASE 10 — SHAP Interpretability
**Time: 1-2 days**

### 10.1 Why this matters
So far, your models are "black boxes" — they output a prediction but don't explain why. SHAP (SHapley Additive exPlanations) tells you which input features contributed most to a given prediction, borrowed from game theory (it fairly distributes "credit" for a prediction among all the input features).

### 10.2 Apply it to your classical features first (easiest)
SHAP works most cleanly on your MFCC/eGeMAPS classifiers, since those features have clear, interpretable names ("mean pitch," "jitter," "shimmer") — unlike wav2vec2/HuBERT's 768 anonymous embedding dimensions, which don't have obvious real-world meaning. Run SHAP on your eGeMAPS-SVM classifier and generate a "feature importance" summary plot showing which acoustic characteristics (e.g., jitter, shimmer, pitch variability) matter most for detecting dysarthria.

### 10.3 What "done" looks like for this phase
One or two SHAP summary plots that visually communicate "here's what the model is actually listening for," which adds clinical credibility and interpretability to your paper — reviewers like seeing that you didn't just build an unexplainable black box.

---

## PHASE 11 — LangChain Report Generation Agent
**Time: 1-2 days — this is the smallest, easiest phase, don't over-invest time here**

### 11.1 What it does
Takes your model's raw output (e.g., `{"prediction": "dysarthric", "confidence": 0.82, "severity": "moderate"}`) and generates a short, plain-language paragraph a non-technical community health worker could understand and act on.

### 11.2 Simple implementation
```python
from backend.app.services.report_agent_service import generate_clinical_report
report = generate_clinical_report(prediction_data, audience_mode="health_worker")

prompt = f"""
Convert this dysarthria screening result into a short, plain-language
paragraph for a community health worker with no medical/ML background.
Be clear this is a SCREENING SIGNAL, not a diagnosis, and recommend
referral to a speech-language pathologist for confirmation.

Result: {prediction_dict}
"""
response = llm.invoke(prompt)
```
This is genuinely just a well-crafted prompt wrapped around an LLM call — keep it that way. Don't over-engineer this part; it's a small usability add-on, not your research contribution.

### 11.3 What "done" looks like for this phase
A function that reliably converts any model output into a clear, appropriately-hedged plain-language paragraph.

---

## PHASE 12 — Gradio Demo (Core)
**Time: 2 days**

### 12.1 Purpose
A live, clickable web interface for your viva/presentation — upload or record audio, click "Analyze," see the prediction, confidence, severity, and the plain-language report, all in one screen. (Full build spec for this was covered in the earlier Gradio prompt document — use that once your model from Phases 6-9 is trained and saved.)

### 12.2 What "done" looks like for this phase
A working `demo.launch(share=True)` Gradio app that a judge/panel member could use themselves, live, without you touching the keyboard.

---

## PHASE 12B — Patient & Caregiver Features (Product Layer)
**Time: 3-4 days. Build this AFTER Phase 12's core demo works — these are additive UI/content layers on top of it, not new ML.**

This phase turns the demo from "a classifier with a UI" into something that actually serves the two real people who'd use it: the patient themselves, and the family member/caregiver sitting with them. None of this requires new models — it reuses the same prediction output from Phase 12, just presented differently for different audiences, plus a small amount of local data storage.

### 12B.1 Progress Tracking Over Time (Patient-facing)
- Every time a user runs an analysis, save the result (timestamp, prediction, confidence, severity) to a simple local store — for a Colab/Gradio prototype, a CSV file or a lightweight SQLite table keyed by a user-entered name/ID is enough; no real authentication needed for a prototype.
- Add a second tab/view in the Gradio app: "My Progress" — plot severity/confidence over time using `matplotlib` or `plotly`, so a patient with a progressive condition (Parkinson's, ALS) can see the trend, not just a single reading.
- This directly supports the "longitudinal monitoring, not one-time diagnosis" argument from your paper's motivation — screenshot this chart for your Introduction/Discussion section as evidence the tool supports monitoring, not just detection.

### 12B.2 Plain-Language "What Is Dysarthria?" Info Page (Patient + Family-facing)
- A static content tab in the Gradio app (not LLM-generated — write this once, carefully, and cite a real source like NIH/Mayo Clinic/ASHA patient-education pages).
- Cover: what dysarthria is (a motor-speech disorder, not a thinking/intelligence problem — this specific reassurance matters a lot to families), common causes, and that severity can change with therapy.
- Cheap to build, prevents a newly-diagnosed user from being left with just a score and no context.

### 12B.3 Printable/Exportable Result Summary (Patient-facing)
- A "Download Report" button that generates a simple one-page PDF (use `fpdf2` or `reportlab`, both free/lightweight) containing: date, prediction, severity, confidence, and the plain-language report text from your Phase 11 agent.
- Purpose: something a patient can physically bring to their next doctor/SLP visit — cheap to build since you already have all the underlying data, and it's a genuinely practical artifact.

### 12B.4 Caregiver Communication Tips (Family-facing)
- A second static content tab, separate from 12B.2, specifically for family members/friends: standard, well-established SLP-caregiver guidance (e.g., reduce background noise, don't finish the person's sentences, confirm understanding by repeating back, give extra time).
- This is established clinical best-practice content, not something you're inventing — present it as informational guidance with a citation to a real source (ASHA caregiver resources are a good reference), not as advice generated or endorsed by your model.

### 12B.5 Caregiver-Mode Report (Family-facing, reuses Phase 11's agent)
- Add a second prompt template to your existing LangChain report agent from Phase 11 — same underlying model output, but a different tone: warmer, more reassuring, explicitly clarifying that dysarthria affects speech *motor control*, not cognition or intelligence (a very common and distressing misconception families have).
- Let the user pick "Health worker view" vs. "Family view" as a toggle before generating the report — same backend call, different prompt.

### 12B.6 "Find an SLP" Resource List (Family-facing)
- A simple static list/table: links to India's Rehabilitation Council of India (RCI) registered-professional search, ISHA (Indian Speech and Hearing Association) directory, and any state-wise speech-and-hearing institute listings you already gathered in your resource research.
- Purpose: a family that gets a "this looks concerning, please get it assessed" message needs a concrete next step, not just a recommendation with nowhere to go.

### 12B.7 Multi-Session Comparison View (Medium effort — Patient + Family-facing)
- Beyond the simple trend line in 12B.1, let a caregiver select two specific past sessions (e.g., "this month" vs. "last month") and see them side-by-side — same prediction/severity/confidence fields, displayed in two columns — so a family member deciding whether to book an in-person visit has a direct before/after comparison, not just a trend to interpret themselves.

### 12B.8 Recording-Quality Guidance (Medium effort — Patient-facing, protects your tool's credibility)
- Before the user records/uploads audio, show a short checklist: hold the device ~6 inches from the mouth, record in a quiet room, avoid speaking too softly. Optionally, run a simple automated check on the uploaded audio (e.g., flag if average volume is very low, or if the clip is under 1-2 seconds) and show a warning rather than silently returning an unreliable prediction.
- This matters because a non-technical user (unlike your evaluation-dataset audio, which was recorded under controlled clinical conditions) could otherwise get a misleading result from a noisy phone recording, which would undermine trust in the whole tool — this is also a good discussion point for your paper's limitations section.

### 12B.9 What "done" looks like for this phase
A Gradio app with (at minimum) three views: the core Analyze tab from Phase 12, a "My Progress" tab (12B.1) showing history/trend, and separate info + report modes for patients vs. family members (12B.2, 12B.4, 12B.5). The comparison view (12B.7) and recording-quality checks (12B.8) are the medium-effort stretch items — include them if Week 4 has slack time, but don't let them delay the core research results from Phases 6-9.

---

## PHASE 13 — Results Compilation
**Time: 2 days**

Consolidate every table and chart from Phases 4, 6, 7, 8, 9, and 10 into one clean, organized results document. This becomes the direct source material for your paper's Results/Experiments section. Double-check every number is reproducible — re-run key experiments once more from a clean notebook state to make sure nothing was a fluke of leftover variables from earlier cells.

---

## PHASE 14 — Paper Writing
**Time: 4-5 days, done in parallel with the later technical phases, not after**

Structure (standard for this type of conference paper):
1. **Abstract** (already drafted in your synopsis — refine with actual numbers once you have them)
2. **Introduction** — the problem statement, why it matters, your contribution summarized in 3-4 bullet points
3. **Related Work** — cite the Speech Communication paper, the arXiv 2509.19946 confound paper, DSSCNet, and 5-6 more from your resource compilation; explicitly state how your work differs from each
4. **Methodology** — datasets, preprocessing, feature extraction, classifiers, CORAL, evaluation protocol (this maps directly to Phases 2-8 above)
5. **Results** — your tables and charts from Phase 13, with discussion of what they mean
6. **Interpretability & Discussion** — your SHAP findings, honest discussion of the CORAL result (whether it helped or not, and why)
7. **Limitations** — dataset size, English-only, screening-not-diagnostic framing, UA-Speech/TORGO specific recording conditions
8. **Conclusion & Future Work** — mention the Indian-language dysarthric speech dataset gap here, as a legitimate future direction
9. **References**

### What "done" looks like for this phase
A complete draft ready for internal review by your mentor before submission to your chosen venue (ICCCNT / INDISCON / Procedia, per your earlier venue research).

---

## PHASE 15 — Submission
**Time: 1-2 days for formatting, plus registration**

Format according to your target venue's template (usually IEEE or Springer LaTeX/Word templates, available on the conference website), submit through their portal (often via EasyChair or Microsoft CMT), and complete registration once accepted. Budget the ~₹8,000-12,000 registration fee discussed earlier.

---

## Suggested Weekly Timeline (compressed into your ~1 month build window)

| Week | Focus |
|---|---|
| Week 1 | Phases 1-4: setup, data acquisition (start UA-Speech request Day 1), preprocessing, classical baselines |
| Week 2 | Phases 5-7: pretrained embeddings, within-corpus classifiers, cross-corpus evaluation (your core result) |
| Week 3 | Phases 8-10: CORAL adaptation, severity classification, SHAP — plus start drafting Introduction/Related Work of the paper in parallel |
| Week 4 | Phases 11-14: report agent, core Gradio demo, results compilation, finish paper draft; internal review with Dr. Mehra. Squeeze in Phase 12B's low-effort items (12B.1-12B.6) if the core pipeline finished on schedule — treat the medium-effort items (12B.7, 12B.8) as stretch goals only |

---

## Suggested Team Role Split (4 people)

- **Person A — Data & Baselines:** owns Phases 2, 3, 4 (dataset acquisition, preprocessing, metadata CSV, MFCC/eGeMAPS baselines). This person should be comfortable with `librosa` and `opensmile`.
- **Person B — Embeddings & Core Classifiers:** owns Phases 5, 6, 7 (wav2vec2/HuBERT extraction, within-corpus and cross-corpus classifiers). This is the most GPU-intensive role — should be comfortable with `transformers` and PyTorch basics.
- **Person C — Adaptation, Severity & Interpretability:** owns Phases 8, 9, 10 (CORAL implementation, severity classification, SHAP). Needs decent NumPy/linear-algebra comfort for the CORAL math.
- **Person D — Agent, Demo, Patient/Caregiver Features & Paper Coordination:** owns Phases 11, 12, and 12B (report agent, core Gradio demo, and the patient/caregiver layer — progress tracking, info pages, caregiver-mode report, resource list) and takes the lead on assembling Phase 14 (paper writing), pulling results from everyone else's notebooks into the shared draft. If Phase 12B's scope feels like too much for one person alongside paper-writing duties, borrow a few hours from whichever of Persons A-C finishes their core phase earliest.

All four should read the core papers (Speech Communication S0167639324000190, arXiv 2509.19946, DSSCNet arXiv 2606.22178) together before Week 1 ends, regardless of role — everyone needs to understand the full argument to write a coherent paper together.

---

## PHASE 16 — Clinical Knowledge Base, Differential Diagnosis & Patient Rehabilitation Engine
**Clinical Reference Literature:**
- Donald B. Freed, *Motor Speech Disorders: Diagnosis and Treatment*, Plural Publishing. ([Freed_Motor_Speech_Disorders_Diagnosis_and_Treatment.pdf](file:///c:/Users/Lovish/Documents/dysarthria_project/resources/Freed_Motor_Speech_Disorders_Diagnosis_and_Treatment.pdf))
- NSW Adult Speech Pathology EBP Group, *Newcastle Dysarthria Assessment Tool (N-DAT)*. ([Newcastle_EBP_Dysarthria_Assessment_Tool_NDAT.pdf](file:///c:/Users/Lovish/Documents/dysarthria_project/resources/Newcastle_EBP_Dysarthria_Assessment_Tool_NDAT.pdf))
- Detailed specifications document: [CLINICAL_KNOWLEDGE_BASE.md](file:///c:/Users/Lovish/Documents/dysarthria_project/resources/CLINICAL_KNOWLEDGE_BASE.md)

### 16.1 Clinical Rationale for the Multi-Prompt Battery (Diagnostic Grounding)
In clinical Speech-Language Pathology (SLP), diagnosis is **never performed on single isolated words**. The N-DAT and Freed clinical protocols mandate a multi-task speech battery to assess the five core motor speech subsystems (Respiration, Phonation, Resonance, Articulation, Prosody):
1. **Maximum Phonation Time (MPT) on Sustained /a/:**
   - *Clinical Norm:* Males 15.0–62.3 sec; Females 14.3–40.4 sec (95% CI).
   - *Diagnostic Value:* Exposes subglottic respiratory support and vocal fold adduction integrity. <15s indicates respiratory depletion or glottal air leak.
2. **S/Z Ratio (Laryngeal Efficiency):**
   - *Norm:* ~1.0. Ratios $\ge 1.20$ indicate vocal fold pathology (incomplete adduction / paralysis).
3. **Alternating Motion Rates (AMRs / DDK):**
   - *Buttercup Repetitions:* 12–15 reps/5s = Normal; 8–11 = Good; 4–7 = Fair; 1–3 = Poor.
   - *Subsystem Biomarkers:* Slow/regular (Spastic/Flaccid), Slow/irregular (Ataxic), Rapid/blurred (Hypokinetic).
4. **Sequential Motion Rates (SMRs):**
   - *Sequence:* /puh-tuh-kuh/ (Norm: 5.0 ± 0.7 seq/s).
   - *Differential Diagnosis:* Crucial for distinguishing Dysarthria (slowed execution without phoneme transpositions) from Apraxia of Speech (groping, sequencing reversals, severe SMR breakdown despite intact AMRs).
5. **Connected Reading Passage:**
   - *Standard Passages:* Caterpillar Passage, Grandfather Passage, or Cookie Theft picture description. Evaluates articulatory degradation over time and prosodic decay.

### 16.2 Evidence-Based Patient Rehabilitation Exercises (Layer 6 & Web App)
Freed outlines targeted behavioral therapies that can be directly implemented as interactive modules in our Gradio / Web App UI:
1. **Interactive Digital Pacing Board (Rate Reduction):**
   - Divides utterances into discrete, finger-tapped visual slots. Forces rate deceleration, giving articulators time to reach acoustic target boundaries and increasing speech intelligibility by up to 35%.
2. **Visual Sound Pressure Level (dB SPL) Biofeedback (LSVT LOUD "Think Loud"):**
   - Calibrates hypokinetic patients who misjudge their own voice as loud when it is actually soft.
   - Using the browser's Web Audio API, displays a real-time decibel meter with a target conversational green zone (60–65 dB SPL).
3. **Overarticulation & Exaggerated Consonants:**
   - Intensive practice emphasizing **medial and final consonants** (e.g., *cu**p***, *re**d***), which are the first to degrade in dysarthric speech.
4. **Minimal Contrast Word Pairs:**
   - Contrastive drills training motor distinction: voicing (*park/bark*), manner (*pine/mine*), place (*sea/she*).
5. **Rosenbek’s 6-Component Hierarchy:**
   - (1) Difference recognition (audio playback), (2) Caregiver involvement, (3) Collaborative goal-setting, (4) Talking therapeutically (pre-planning breath and phonation), (5) Self-evaluation 1–3 scale before AI scoring, (6) Cognitive-linguistic generalization under real-world noise.
6. **Caregiver & Communication Partner Protocol:**
   - Face-to-face visual contact, background noise reduction, piece-by-piece message verification, and structured binary/choice questioning.

---

## Final Deliverables Checklist

- [ ] TORGO + UA-Speech data downloaded and organized with metadata CSVs
- [ ] Classical baseline (MFCC, eGeMAPS) results — within-corpus
- [ ] Pretrained embedding (wav2vec2, HuBERT) results — within-corpus
- [ ] Cross-corpus evaluation results (both directions) — your core finding
- [ ] CORAL-adapted cross-corpus results — your proposed fix, evaluated honestly
- [ ] Severity classification results — within-corpus and cross-corpus
- [ ] SHAP interpretability plots grouped by clinical speech subsystems (Respiration, Phonation, Resonance, Articulation, Prosody)
- [ ] Working LangChain report-generation function (incorporating N-DAT norms and SLP clinical terminology)
- [ ] Working Gradio / Web App demo (shareable link tested fresh on presentation day), including:
  - [ ] Core Analyze tab (multi-prompt audio input → prediction, severity, confidence, report)
  - [ ] "My Progress" tab — saved history + trend chart (12B.1)
  - [ ] "What Is Dysarthria?" patient/family info page (12B.2)
  - [ ] Downloadable PDF result summary (12B.3)
  - [ ] Caregiver communication-tips page (12B.4)
  - [ ] Caregiver-mode toggle on the report agent (12B.5)
  - [ ] "Find an SLP" resource list (12B.6)
  - [ ] Interactive Clinical Therapy Tools (Phase 16):
    - [ ] Digital Pacing Board for rate reduction
    - [ ] Real-time dB SPL visual loudness biofeedback meter ("Think Loud")
    - [ ] Minimal contrast practice drills & overarticulation cards
  - [ ] *Stretch:* multi-session side-by-side comparison view (12B.7)
  - [ ] *Stretch:* recording-quality checklist/warning (12B.8)
- [ ] Complete paper draft citing Freed (2020) and N-DAT (2015), formatted to target venue's template
- [ ] Internal review completed with Dr. Sunakshi Mehra
- [ ] Submission completed before venue deadline

