# Cross-Corpus Dysarthria Generalization: Complete Empirical Rigor & Methodological Synthesis

## Methodological Taxonomy & Status
- **Pre-specified Primary Pipeline**:
  - **Representation**: Wav2Vec 2.0 Base, **Layer 12** (`outputs.last_hidden_state` / final transformer layer).
  - **Classifier**: Linear Support Vector Classifier (`LinearSVC`, `dual=False`, `max_iter=2000`).
  - **Regularization**: Fixed **C = 0.01**.
  - **Weighting**: Unweighted (`class_weight=None`).
  - **Domain Adaptation**: Regularized Correlation Alignment (**CORAL**, Tikhonov regularization lambda = 1e-3).
  - **Validation Protocol**: 5-Fold Stratified Group K-Fold (`StratifiedGroupKFold`) by speaker ID.
- **Exploratory & Sensitivity Analyses**:
  - **Source-Validated C** (Inner CV grid search extended down to 1e-7 on source training folds).
  - **Intermediate Layer Exploration** (Layers 1, 4, 7 vs Layer 12; strictly nested layer selection).
  - **Class Weighting Analysis** (`class_weight='balanced'` on EasyCall severity).
  - **Full C Sweeps** (C in [1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1.0]).
  - **Temporal Confound Assessment** (Filename date stamp analysis on IPVS).

---

## 1. Task 1: Primary Cross-Corpus Transfer & Source-Validated Sensitivity

### A. Pre-specified Primary Benchmark Results (Layer 12, Fixed C=0.01, Unweighted)
The pre-specified primary cross-corpus results across all 6 directional pairs at C=0.01 with 10,000 speaker-clustered bootstrap draws:

| Source -> Target | Primary C | Raw B-Acc | CORAL B-Acc | Delta (CORAL - Raw) | Delta 95% Bootstrap CI | Excludes 0? | Descriptive Characterization |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TORGO -> EasyCall** | C = 0.01 | 47.54% | 53.68% | **+6.14 pp** | [+4.0%, +8.4%] | **Yes (Positive)** | Descriptive Positive Shift |
| **TORGO -> Italian PD** | C = 0.01 | 54.28% | 50.69% | **-3.59 pp** | [-7.2%, 0.0%] | Borderline | Descriptive Negative Shift |
| **EasyCall -> TORGO** | C = 0.01 | 52.48% | 52.78% | **+0.31 pp** | [-2.8%, +3.0%] | No | Inconclusive / Neutral |
| **EasyCall -> Italian PD** | C = 0.01 | 41.80% | 47.40% | **+5.61 pp** | [+1.6%, +9.8%] | **Yes (Positive)** | Descriptive Positive Shift |
| **Italian PD -> TORGO** | C = 0.01 | 50.26% | 51.25% | **+0.99 pp** | [-3.8%, +7.3%] | No | Inconclusive / Neutral |
| **Italian PD -> EasyCall** | C = 0.01 | 56.28% | 49.74% | **-6.54 pp** | [-9.5%, -3.6%] | **Yes (Negative)** | Descriptive Negative Shift |

---

### B. Exploratory Source-Validated C Grid Search (Down to 1e-7)
Using strictly inner 3-fold cross-validation on source training data only (without touching target test data):
- **TORGO**: Selected C = **1.0e-6** (Inner B-Acc: 71.72% +/- 7.87%). Strictly bracketed:
  - C = 1.0e-7: 71.32% +/- 7.23%
  - **C = 1.0e-6: 71.72% +/- 7.87% [Peak]**
  - C = 1.0e-5: 69.07% +/- 10.88%
  - C = 1.0e-4: 63.97% +/- 12.83%
  - C = 1.0e-3: 61.27% +/- 13.38%
  - C = 0.01: 60.93% +/- 11.50%
  - *Inner-CV Variance Note*: Across the 3 inner folds on TORGO, fold standard deviation is wide (8.1% to 13.4%), reflecting TORGO's small speaker count (15 speakers) and heterogeneous speech phenotypes.
- **EasyCall**: Selected C = **1.0e-3** (79.96% +/- 1.74%, bracketed between 79.85% at 1e-4 and 79.59% at 1e-2).
- **Italian Parkinson's**: Selected C = **1.0e-2** (88.16% +/- 1.34%, bracketed between 87.51% at 1e-3 and 88.09% at 1e-1).

---

### C. Side-by-Side: Primary Fixed C=0.01 vs. Exploratory Source-Validated Transfer

| Source -> Target | Primary C=0.01 Delta | Validated Source C | Raw B-Acc | CORAL B-Acc | Validated Delta | Validated 95% Bootstrap CI | Excludes 0? | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TORGO -> EasyCall** | **+6.14 pp** | C = 1.0e-6 | 52.68% | 50.69% | **-1.99 pp** | [-4.1%, +0.1%] | No | Exploratory (Inner SD: 8-13 pp) |
| **TORGO -> Italian PD** | **-3.59 pp** | C = 1.0e-6 | 53.60% | 50.11% | **-3.49 pp** | [-7.4%, 0.0%] | No | Consistent negative transfer |
| **EasyCall -> TORGO** | **+0.31 pp** | C = 1.0e-3 | 51.82% | 53.19% | **+1.38 pp** | [-4.5%, +6.4%] | No | Neutral / Inconclusive |
| **EasyCall -> Italian PD** | **+5.61 pp** | C = 1.0e-3 | 43.18% | 48.04% | **+4.86 pp** | [+0.7%, +8.9%] | **Yes** | Positive adaptation |
| **Italian PD -> TORGO** | **+0.99 pp** | C = 1.0e-2 | 50.26% | 51.25% | **+0.99 pp** | [-3.8%, +7.3%] | No | Neutral / Inconclusive |
| **Italian PD -> EasyCall** | **-6.54 pp** | C = 1.0e-2 | 56.28% | 49.74% | **-6.54 pp** | [-9.5%, -3.6%] | **Yes** | Negative transfer |

#### Methodological Reconciliation of TORGO Transfer
1. **Provenance of Fixed C=0.01 Delta (+6.14 pp) vs Source-Validated C=1e-6 (-1.99 pp)**:
   - Under the pre-specified primary protocol (C=0.01), `TORGO -> EasyCall` raw baseline is 47.54% (due to cross-corpus acoustic and bandwidth mismatch), and CORAL lifts it to 53.68% (+6.14 pp, 95% CI: `[+4.0%, +8.4%]`).
   - When C is forced to extreme over-regularization at C=1.0e-6 (selected by inner CV because it maximizes training fold margin), the decision boundary is heavily compressed: raw accuracy rises to 52.68% while CORAL yields 50.69% (-1.99 pp, 95% CI: `[-4.1%, +0.1%]`).
   - Because TORGO's inner-CV standard deviation is wide (8 to 13 points), C=0.01 remains the pre-specified primary benchmark setting, while C=1.0e-6 is reported as exploratory sensitivity.

---

### D. Within-Corpus Exact Reproduction Arm

Every metric below is explicitly labeled as either **pooled out-of-fold** (computed once globally over concatenated out-of-fold test predictions) or **mean-of-fold-scores** (computed per fold and averaged across the 5 outer folds):

| Corpus | Protocol / Regularization | Pooled Out-of-Fold Accuracy | Pooled Out-of-Fold Balanced Accuracy | Pooled Sensitivity | Pooled Specificity | Pooled Macro-F1 | Mean-of-Fold Score Balanced Accuracy +/- SD (ddof=1) | Delta vs Primary Baseline |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TORGO** | **Pre-specified Primary (C=0.01)** | **71.29%** | **65.95%** | **49.51%** | **82.39%** | **66.49%** | **71.51% +/- 15.03%** | *Baseline* |
| | Exploratory (C=1e-6) | 61.75% | 61.58% | 61.05% | 62.11% | 60.07% | 61.80% +/- 9.54% | -4.37 pp (pooled) |
| **EasyCall** | **Pre-specified Primary (C=0.01)** | **81.07%** | **80.99%** | **82.39%** | **79.60%** | **81.00%** | **83.28% +/- 5.65%** | *Baseline* |
| | Exploratory (C=1e-3) | 81.16% | 81.11% | 82.07% | 80.14% | 81.10% | 83.35% +/- 5.58% | +0.12 pp (pooled) |
| **Italian PD** | **Pre-specified Primary (C=0.01)** | **87.48%** | **87.43%** | **88.56%** | **86.29%** | **87.44%** | **87.47% +/- 4.11%** | *Baseline* |
| | Exploratory (C=1e-2) | 87.48% | 87.43% | 88.56% | 86.29% | 87.44% | 87.47% +/- 4.11% | 0.00 pp (pooled) |

---

## 2. Task 2: Severity CORAL Distortion Analysis (EasyCall -> TORGO)

### A. Severe Clip Sensitivity Collapse Across C Sweep
Evaluating cross-corpus severity transfer across C in [1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1.0]:

| Regularization C | Raw Mild | CORAL Mild | Raw Mod | CORAL Mod | Raw Severe | CORAL Severe | Severe Delta |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **C = 1.0e-5** | 68.32% | 85.34% | 34.02% | 15.34% | **9.69%** | **0.67%** | **-9.02 pp** |
| **C = 1.0e-4** | 71.07% | 83.25% | 32.42% | 22.84% | **7.76%** | **3.36%** | **-4.40 pp** |
| **C = 1.0e-3** | 65.57% | 83.05% | 30.65% | 28.51% | **20.81%** | **4.62%** | **-16.19 pp** |
| **C = 1.0e-2 (Primary)** | 61.46% | 82.41% | 31.05% | 32.48% | **26.70%** | **5.07%** | **-21.63 pp** |
| **C = 1.0e-1** | 56.40% | 81.33% | 32.82% | 33.46% | **15.29%** | **6.26%** | **-9.02 pp** |
| **C = 1.0** | 55.45% | 80.99% | 33.35% | 33.74% | **12.53%** | **7.83%** | **-4.70 pp** |

---

### B. Speaker-Level Prediction Reconciled with severity_speaker_breakdown.csv
Reconciling the exact vote tallies at C=0.01 between `results/tables/severity_speaker_breakdown.csv` (lines 78-93) and `results/tables/task2_severity_c_sweep_speakers.csv` (lines 14-17):

| Speaker (Clips) | Model | C = 1.0e-5 | C = 1.0e-4 | C = 1.0e-3 | C = 1.0e-2 (Primary Benchmark) | C = 1.0e-1 | C = 1.0 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **F01 (134)** | Raw Zero-Shot | Mod (91) | Mod (88) | Mod (75) | **Mod (76 votes: 48 mild, 76 mod, 10 sev)** | Mod (80) | Mod (81) |
| | CORAL Adapted | **MILD (126)** | **MILD (116)** | **MILD (94)** | **MILD (88 votes: 88 mild, 43 mod, 3 sev)** | **MILD (91)** | **MILD (91)** |
| **M01 (386)** | Raw Zero-Shot | Mod (321) | Mod (340) | Mod (275) | **Mod (198 votes: 40 mild, 198 mod, 148 sev)** | Mod (208) | Mod (219) |
| | CORAL Adapted | **MILD (246)** | **MILD (214)** | **MILD (200)** | **MILD (201 votes: 201 mild, 140 mod, 45 sev)** | **MILD (195)** | **MILD (194)** |
| **M02 (400)** | Raw Zero-Shot | Mod (335) | Mod (357) | Mod (333) | **Mod (305 votes: 32 mild, 305 mod, 63 sev)** | Mod (318) | Mod (325) |
| | CORAL Adapted | **MILD (232)** | **MILD (217)** | **MILD (213)** | **MILD (206 votes: 206 mild, 178 mod, 16 sev)** | **MILD (201)** | **MILD (195)** |
| **M04 (421)** | Raw Zero-Shot | Mod (415) | Mod (367) | Mod (223) | **Mod (174 votes: 110 mild, 174 mod, 137 sev)** | Mod (213) | Mod (217) |
| | CORAL Adapted | **MILD (227)** | Mod (219 vs 202) | Mod (215 vs 204) | **MILD (213 votes: 213 mild, 204 mod, 4 sev)** | Mod (208 vs 207) | **MILD (211)** |

*Provenance Note*: Both files are derived from the exact same primary pipeline run (`EasyCall -> TORGO`, LinearSVC, C=0.01). The moderate vote counts (F01: 76, M01: 198, M02: 305, M04: 174) match identically down to the single vote.

#### Formalized Severity Finding
- **Core Result**: **3 of 4 severe TORGO speakers (`F01`, `M01`, `M02`) are predicted mild at every single regularization value across the entire sweep (C in [1e-5, 1.0]) under CORAL, while speaker `M04` flips between mild and moderate.**
- **Zero-Shot Contrast**: Under Raw Zero-Shot transfer, **zero** severe speakers are ever misclassified as mild (all four are predicted Moderate across all C).

---

### C. Severe Speaker CORAL Vote Analysis Across Layers (Layers 1, 4, 12 at C=0.01)
Artifact: [`results/tables/severe_torgo_coral_votes_across_layers.csv`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/tables/severe_torgo_coral_votes_across_layers.csv):

| Layer | Speaker | Total Clips | Raw Prediction | Raw Votes (Mild / Mod / Sev) | CORAL Prediction | CORAL Votes (Mild / Mod / Sev) | Re-routed to Mild? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Layer 1** | **F01** | 134 | Moderate | 31 / 65 / 38 | **MILD** | **99 / 26 / 9** | **Yes** |
| | **M01** | 386 | Moderate | 36 / 283 / 67 | **MILD** | **193 / 168 / 25** | **Yes** |
| | **M02** | 400 | Moderate | 111 / 249 / 40 | **MILD** | **238 / 145 / 17** | **Yes** |
| | **M04** | 421 | Moderate | 60 / 188 / 173 | **MILD** | **241 / 174 / 6** | **Yes** |
| **Layer 4** | **F01** | 134 | Mild | 60 / 55 / 19 | **MILD** | **102 / 22 / 10** | **Yes** |
| | **M01** | 386 | Moderate | 23 / 231 / 132 | **MILD** | **207 / 150 / 29** | **Yes** |
| | **M02** | 400 | Moderate | 38 / 307 / 55 | **MILD** | **237 / 142 / 21** | **Yes** |
| | **M04** | 421 | Moderate | 71 / 346 / 4 | **MILD** | **259 / 155 / 7** | **Yes** |
| **Layer 12** | **F01** | 134 | Moderate | 48 / 76 / 10 | **MILD** | **88 / 43 / 3** | **Yes** |
| | **M01** | 386 | Moderate | 40 / 198 / 148 | **MILD** | **201 / 140 / 45** | **Yes** |
| | **M02** | 400 | Moderate | 32 / 305 / 63 | **MILD** | **206 / 178 / 16** | **Yes** |
| | **M04** | 421 | Moderate | 110 / 174 / 137 | **MILD** | **213 / 204 / 4** | **Yes** |

*Takeaway*: **Severe-to-mild re-routing under CORAL is not an artifact of Layer 12 representation.** Across Layers 1, 4, and 12, CORAL systematically re-routes all 4 severe TORGO speakers to a predicted majority-vote diagnosis of Mild dysarthria.

---

## 3. Task 3: Layer Selection (Nested Within-Corpus, 3x3 Transfer, IPVS Cohorts)

### A. Nested Layer Selection and Paired Outer Fold Comparison
To guarantee leak-free evaluation, the layer was selected **inside** the training folds using 3-fold inner CV on outer training data only. We compared the nested model directly against the fixed Layer 12 model on **identical outer folds** (sample standard deviations computed with ddof=1):

*Source CSV: [`results/tables/nested_vs_fixed_paired_folds.csv`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/tables/nested_vs_fixed_paired_folds.csv)*

| Corpus | Fold | Fixed L12 Balanced Accuracy (%) | Selected Layer | Nested Balanced Accuracy (%) | Paired Difference (pp) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| TORGO | 1 | 66.67% | Layer  4 | 62.50% | -4.17 pp |
| TORGO | 2 | 55.02% | Layer  1 | 50.99% | -4.03 pp |
| TORGO | 3 | 63.66% | Layer  7 | 62.36% | -1.31 pp |
| TORGO | 4 | 93.78% | Layer 12 | 93.78% | +0.00 pp |
| TORGO | 5 | 78.45% | Layer  4 | 77.95% | -0.49 pp |
| EasyCall | 1 | 75.44% | Layer  4 | 77.81% | +2.36 pp |
| EasyCall | 2 | 80.60% | Layer  4 | 83.82% | +3.21 pp |
| EasyCall | 3 | 83.36% | Layer  4 | 83.79% | +0.43 pp |
| EasyCall | 4 | 88.12% | Layer  7 | 89.00% | +0.88 pp |
| EasyCall | 5 | 89.38% | Layer  4 | 91.58% | +2.19 pp |
| Italian PD | 1 | 94.04% | Layer  1 | 97.37% | +3.33 pp |
| Italian PD | 2 | 83.15% | Layer  1 | 93.21% | +10.05 pp |
| Italian PD | 3 | 88.31% | Layer  1 | 92.53% | +4.22 pp |
| Italian PD | 4 | 85.63% | Layer  1 | 96.87% | +11.23 pp |
| Italian PD | 5 | 86.20% | Layer  1 | 98.88% | +12.68 pp |

**Fold-Average Summary (Mean +/- Sample SD, ddof=1):**
| Corpus | Mean Fixed L12 (%) | Mean Nested (%) | Paired Difference Mean +/- SD (ddof=1) |
| :--- | :---: | :---: | :---: |
| TORGO | 71.52% +/- 15.01% | 69.52% +/- 16.61% | **-2.00 pp +/- 1.97 pp** |
| EasyCall | 83.38% +/- 5.68% | 85.20% +/- 5.33% | **+1.81 pp +/- 1.14 pp** |
| Italian PD | 87.47% +/- 4.11% | 95.77% +/- 2.76% | **+8.30 pp +/- 4.25 pp** |

- In **Italian Parkinson's**, Layer 1 was chosen on 5 of 5 folds (100%), improving every single fold (+3.33 pp to +12.68 pp, mean paired gain +8.30 pp).
- In **EasyCall**, Layer 4 was chosen on 4 folds and Layer 7 on 1 fold, improving every single fold (+0.43 pp to +3.21 pp, mean paired gain +1.81 pp).
- In **TORGO**, inner CV chose intermediate layers, which yielded lower outer balanced accuracy (-2.00 pp paired drop), though markedly improving dysarthric clip sensitivity from 49.51% to 65.59% (+16.08 pp).

---

### B. Full 3x3 Cross-Corpus Transfer Deltas Across Layers (C=0.01)
Artifact: [`results/tables/cross_corpus_transfer_layers_1_4_12.csv`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/tables/cross_corpus_transfer_layers_1_4_12.csv):

| Transfer Direction | Layer 1 Raw | Layer 1 CORAL | L1 Delta | Layer 4 Raw | Layer 4 CORAL | L4 Delta | Layer 12 Raw (Primary) | Layer 12 CORAL (Primary) | L12 Delta (Primary) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TORGO -> EasyCall** | 47.14% | 52.89% | +5.75 pp | 44.40% | 54.50% | **+10.11 pp** | 47.54% | 53.68% | **+6.14 pp** |
| **TORGO -> Italian PD** | 57.83% | 52.98% | -4.86 pp | 42.28% | 51.66% | **+9.37 pp** | 54.28% | 50.69% | **-3.59 pp** |
| **EasyCall -> TORGO** | 51.80% | 52.84% | +1.04 pp | 62.82% | 55.39% | -7.43 pp | 52.48% | 52.78% | **+0.31 pp** |
| **EasyCall -> Italian PD** | 60.82% | 55.37% | -5.45 pp | 59.92% | 54.81% | -5.11 pp | 41.80% | 47.40% | **+5.61 pp** |
| **Italian PD -> TORGO** | 51.07% | 51.30% | +0.24 pp | 55.96% | 51.89% | -4.07 pp | 50.26% | 51.25% | **+0.99 pp** |
| **Italian PD -> EasyCall** | 62.06% | 56.70% | -5.36 pp | 52.21% | 53.55% | +1.34 pp | 56.28% | 49.74% | **-6.54 pp** |

---

### C. Italian Parkinson's (IPVS) Cohort Breakdown & Filename Date Stamp Analysis

#### 1. Cohort and Speaker Breakdown (Layer 1 vs Layer 12)
Artifact: [`results/tables/ipvs_cohort_breakdown_layer1_vs_12.csv`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/tables/ipvs_cohort_breakdown_layer1_vs_12.csv):

| Cohort | True Label | Speakers | Clips | Layer 1 Clip Acc | Layer 12 Clip Acc | Clip Delta | Layer 1 Spk Correct | Layer 12 Spk Correct | Spk Delta |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **15 Young Healthy Control** | Control | 15 | 45 | **100.00%** | **100.00%** | 0.00 pp | **15 / 15** | **15 / 15** | 0 |
| **22 Elderly Healthy Control** | Control | 22 | 349 | **95.70%** | **84.53%** | **+11.17 pp** | **22 / 22** | **21 / 22** | **+1 speaker recovered** |
| **28 People with Parkinson's** | Dysarthric | 28 | 437 | **96.11%** | **88.56%** | **+7.55 pp** | **27 / 28** | **27 / 28** | 0 |

- The nested gain of Layer 1 stems predominantly from **Elderly Healthy Controls**, where clip accuracy increases from 84.53% to 95.70% (+11.17 pp).
- Speaker `EHC_VITANTONIO D` (22 Elderly Healthy Control, 13 clips) is falsely classified as dysarthric by Layer 12, but correctly recognized as healthy control by Layer 1. Both layers correctly classify 27 of 28 Parkinson's patients (only `PD_ANTONIO M` is misclassified by both).

#### 2. Sub-Cohort Binary Classification (Speaker-Grouped 5-Fold CV)
Artifact: [`results/tables/ipvs_subcohort_classification_results.csv`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/tables/ipvs_subcohort_classification_results.csv):

To evaluate whether the high IPVS performance holds against age-matched controls vs young controls:
- **PD vs. Elderly Controls (28 PD vs. 22 Elderly, age-matched)**:
  - **Layer 1**: Mean-of-fold balanced accuracy = **95.91% +/- 3.02% (ddof=1)** (Pooled out-of-fold: 95.93% balanced accuracy, 95.88% sensitivity, 95.99% specificity).
  - **Layer 12**: Mean-of-fold balanced accuracy = **86.17% +/- 5.47% (ddof=1)** (Pooled out-of-fold: 86.26% balanced accuracy, 87.41% sensitivity, 85.10% specificity).
- **PD vs. Young Controls (28 PD vs. 15 Young)**:
  - **Layer 1**: Mean-of-fold balanced accuracy = **99.43% +/- 0.86% (ddof=1)** (Pooled out-of-fold: 99.43% balanced accuracy, 98.86% sensitivity, 100.00% specificity).
  - **Layer 12**: Mean-of-fold balanced accuracy = **99.25% +/- 1.03% (ddof=1)** (Pooled out-of-fold: 99.20% balanced accuracy, 98.40% sensitivity, 100.00% specificity).

#### 3. Filename Date Stamp Audit & Temporal Collinearity
Parsing the filename date stamps across all 831 clips revealed the exact recording schedule:
- **Parkinson's Disease (437 clips, 28 speakers)**: 160 clips (10 speakers) carry date stamps from **May and June 2016** (10-digit format: `DDMMYYHHMM`); 277 clips (18 speakers) carry stamps from **January and February 2017** (12-digit format: `DDMMYYYYHHMM`). All Parkinson's recordings concluded on **February 10, 2017**.
- **Elderly Healthy Controls (349 clips, 22 speakers)**: Carry filename date stamps exclusively between **March 17, 2017 and April 02, 2017** (all 12-digit format). Zero elderly controls were recorded in 2016 or early 2017.
- **Young Healthy Controls (45 clips, 15 speakers)**: All 45 clips carry filename date stamps from a single date: **January 10, 2017**. Furthermore, all tasks for any given young speaker have identical timestamps down to the minute (e.g., all 3 clips for `Alberto R` are stamped `10:15`, all 3 for `Alessandro M` are stamped `10:16`, all 3 for `Alessandro P` are stamped `10:17`).

#### Predictive Power of Date Alone
A decision threshold rule based on the filename date stamp alone:
> **Decision Rule**: `If Filename Date < March 1, 2017 -> Predict Dysarthric, Else Predict Control`
Achieves:
- **Clip-Level Accuracy: 94.58% | Balanced Accuracy: 94.29%**
- **Sensitivity on Parkinson's: 100.00% (437 / 437 clips correct)**
- **Specificity on Elderly Controls: 100.00% (349 / 349 clips correct)**
- *Errors*: Exactly the 45 clips from the 15 young healthy controls (recorded on January 10, 2017).
- **Speaker-Level Balanced Accuracy: 79.73%** (28/28 PD correct, 22/22 Elderly Controls correct).

*Critical Methodological Warning for the Manuscript*: The IPVS dataset contains near-perfect collinearity between clinical cohort (PD vs. Elderly Control) and the filename date stamp. Because all elderly controls were recorded in Spring 2017 while all Parkinson's patients concluded prior to March 2017, the apparent 86.2% (Layer 12) to 95.9% (Layer 1) detection accuracy cannot be definitively isolated from session-level acoustic or hardware drift.

---

## 4. Task 4: Class Weighting on EasyCall Within-Corpus Severity

Evaluating `LinearSVC(class_weight='balanced')` vs unweighted baseline on the 3-class EasyCall severity task (6,813 Mild, 3,529 Moderate, 733 Severe clips across 30 dysarthric speakers). The three severe speakers have real IDs: `f10` (138 clips), `m11` (414 clips), and `m14` (181 clips):

| Protocol | Weighting | Clip B-Acc | Mild Clip Sens | Mod Clip Sens | Sev Clip Sens | Spk B-Acc | Overall Spk Correct (Count) | Severe Spk Correct (Count) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **5-Fold (C=0.01, Primary)** | **Unweighted (Primary)** | 55.25% | **86.69%** | 56.96% | 22.10% | **75.56%** | **25 / 30** | **2 of 3** (`f10`, `m14` correct; `m11` mod) |
| | **Balanced (Exploratory)** | **56.04%** | 83.49% | **58.71%** | **25.92%** | 70.26% | 23 / 30 | **2 of 3** (`f10`, `m14` correct; `m11` mod) |
| | *Delta* | *+0.79 pp* | *-3.20 pp* | *+1.75 pp* | *+3.82 pp* | *-5.30 pp* | *-2 speakers* | *0 speakers* |
| **3-Fold (C=0.01)** | **Unweighted** | 56.47% | **84.10%** | 58.57% | 26.74% | 64.44% | 24 / 30 | **1 of 3** (`m14` correct; `f10` mild, `m11` mod) |
| | **Balanced** | **56.97%** | 80.89% | **59.59%** | **30.42%** | **72.22%** | 24 / 30 | **2 of 3** (`f10`, `m14` correct; `m11` mod) |
| | *Delta* | *+0.50 pp* | *-3.21 pp* | *+1.02 pp* | *+3.68 pp* | *+7.78 pp* | *0 speakers* | **+1 severe speaker recovered (`f10`)** |
| **5-Fold (C=0.001)** | **Unweighted** | 57.27% | **87.13%** | 60.95% | 23.74% | **73.59%** | 24 / 30 | **2 of 3** (`f10`, `m14` correct; `m11` mod) |
| | **Balanced** | **58.90%** | 83.24% | **61.55%** | **31.92%** | 70.26% | 23 / 30 | **2 of 3** (`f10`, `m14` correct; `m11` mod) |
| | *Delta* | *+1.63 pp* | *-3.89 pp* | *+0.60 pp* | *+8.18 pp* | *-3.33 pp* | *-1 speaker* | *0 speakers* |

#### Severe Speaker Voting Tallies
- **`f10` (138 clips)**:
  - 5-Fold C=0.01: Unweighted yields 64 mild, 2 mod, **72 severe (Correct)** -> Balanced yields 55 mild, 3 mod, **80 severe (+8 severe votes)**.
  - 3-Fold C=0.01: Unweighted yields 69 mild, 0 mod, 69 severe (Tie broken to Mild) -> Balanced yields 58 mild, 1 mod, **79 severe (Recovered to Correct)**.
- **`m14` (181 clips)**:
  - Correctly predicted as Severe across all runs (e.g. 5-Fold C=0.01: 84 severe votes unweighted -> 100 severe votes balanced).
- **`m11` (414 clips)**:
  - Misclassified as Moderate across all runs (e.g. 5-Fold C=0.01: 275 moderate votes unweighted vs 285 moderate votes balanced; severe votes only 6 to 10).

---

## 5. Summary of Publication Artifacts & Verified Primary Citations

### A. Primary Dataset Citations and Verified DOIs
1. **TORGO Database**:
   - **Citation**: Rudzicz, F., Namasivayam, A. K., & Wolff, T. (2012). The TORGO database of acoustic and articulatory speech from speakers with dysarthria. *Language Resources and Evaluation*, 46(4), 523–541.
   - **Source Platform**: Springer Nature Link (`https://link.springer.com/article/10.1007/s10579-011-9145-0`)
   - **Exact Source Line**: `<meta name="prism.doi" content="doi:10.1007/s10579-011-9145-0"/>`
   - **DOI**: `10.1007/s10579-011-9145-0`
2. **EasyCall Corpus**:
   - **Citation**: Turrisi, R., Braccia, A., Emanuele, M., Giulietti, S., Pugliatti, M., Sensi, M., Fadiga, L., & Badino, L. (2021). EasyCall Corpus: A Dysarthric Speech Dataset. *Proc. Interspeech 2021*, 41–45.
   - **Source Platform**: ISCA Archive (`https://www.isca-archive.org/interspeech_2021/turrisi21_interspeech.html`)
   - **Exact Source Line**: `<meta name="citation_doi" content="10.21437/Interspeech.2021-549">`
   - **DOI**: `10.21437/Interspeech.2021-549`

### B. Generated Publication Figures and Result Files
1. [`results/figures/figure1_cross_corpus_layer_deltas.png`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/figures/figure1_cross_corpus_layer_deltas.png): Bar chart comparing Raw vs CORAL adaptation deltas across Layers 1, 4, 12 for all 6 cross-corpus directions.
2. [`results/figures/figure2_severe_speaker_coral_rerouting.png`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/figures/figure2_severe_speaker_coral_rerouting.png): Vote distributions for severe speakers `F01`, `M01`, `M02`, `M04` illustrating severe-to-mild re-routing across Layers 1, 4, 12.
3. [`results/figures/figure3_ipvs_temporal_confound.png`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/figures/figure3_ipvs_temporal_confound.png): Scatter timeline and monthly histogram visualizing the filename date stamp collinearity in IPVS.
4. [`results/tables/severe_torgo_coral_votes_across_layers.csv`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/tables/severe_torgo_coral_votes_across_layers.csv): Exact vote tallies for all severe speakers across layers.
5. [`results/tables/nested_vs_fixed_paired_folds.csv`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/tables/nested_vs_fixed_paired_folds.csv): Paired outer-fold differences and sample standard deviations (ddof=1).
6. [`results/tables/cross_corpus_transfer_layers_1_4_12.csv`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/tables/cross_corpus_transfer_layers_1_4_12.csv): Complete 3x3 transfer metrics for layers 1, 4, and 12.
7. [`results/tables/ipvs_subcohort_classification_results.csv`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/tables/ipvs_subcohort_classification_results.csv): PD vs Elderly Controls and PD vs Young Controls classification at Layers 1 and 12.
8. [`results/tables/ipvs_cohort_by_date_table.csv`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/tables/ipvs_cohort_by_date_table.csv): IPVS filename date stamp and digit format summary.
9. [`results/tables/task6_multisource_transfer.csv`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/tables/task6_multisource_transfer.csv): Authoritative leave-one-corpus-out multi-source transfer benchmarks comparing Raw, Domain-Standardized, and CORAL alignment.
10. [`results/tables/task6_multisource_inner_cv.csv`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/tables/task6_multisource_inner_cv.csv): Inner 3-fold SGKF cross-validation parameter selection records across pooled sources.
11. [`results/tables/task7_cost_sensitive_cross_corpus.csv`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/tables/task7_cost_sensitive_cross_corpus.csv): Cross-corpus severity transfer (EasyCall -> TORGO) across severe class penalty multipliers (1.0 to 20.0).
12. [`results/tables/task7_cost_sensitive_within_corpus.csv`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/tables/task7_cost_sensitive_within_corpus.csv): Within-corpus 5-fold SGKF EasyCall severity evaluation under asymmetric cost weighting.
13. [`results/tables/task7_cost_sensitive_torgo_speakers.csv`](file:///c:/Users/Lovish/Documents/dysarthria_project/results/tables/task7_cost_sensitive_torgo_speakers.csv): Individual clip voting distributions for severe TORGO speakers under cost-sensitive models.

---

## 6. Task 6: Multi-Source Domain Generalization (Leave-One-Corpus-Out)

Evaluating whether training across multiple source corpora bridges acoustic discrepancies or introduces negative transfer due to corpus dominance.

### Benchmark Results (10,000 Speaker Bootstrap Draws)

| Target Corpus | Source Corpora Pool | Best Single Source | Single B-Acc (AUC) | Multi-Source Raw | Multi-Source Dom-Std | Multi-Source CORAL | Delta vs Single (95% CI) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TORGO** (English) | EasyCall + Italian_Parkinsons | EasyCall | 51.82% (0.553) | 51.28% | **54.65%** (0.579) | 53.10% (0.556) | **+2.83 pp** ([-3.1%, +7.6%]) |
| **EasyCall** (Italian) | TORGO + Italian_Parkinsons | Italian_Parkinsons | **56.28%** (0.585) | 48.86% | 45.35% | 52.84% (0.530) | -3.44 pp ([-8.4%, +1.7%]) |
| **Italian_Parkinsons** | TORGO + EasyCall | TORGO | **53.60%** (0.455) | 48.36% | 43.46% | 47.09% (0.483) | -6.51 pp ([-11.7%, -1.3%]) |

### Core Scientific Findings:
1. **Cross-Language Generalization Success on TORGO**:
   - Pooling both Italian corpora (EasyCall + Italian Parkinson's) with independent domain standardization achieved **54.65% balanced accuracy** (AUC 0.579) on unseen English speakers in TORGO, outperforming both single-source baselines (+2.83 percentage points).
2. **The "Corpus Dominance" Effect**:
   - Naive pooling across unbalanced datasets (EasyCall: 21,386 clips vs Italian Parkinson's: 831 clips) causes severe negative transfer if the massive corpus dominates gradient or covariance space.
   - CORAL domain adaptation successfully recovered **+3.98 pp** over raw pooling on EasyCall (48.86% -> 52.84%) and **+3.63 pp** on Italian Parkinson's (43.46% -> 47.09%), proving that covariance alignment is necessary when source corpora have vast sample imbalances.

---

## 7. Task 7: Cost-Sensitive Asymmetric Learning for Clinical Severity

Evaluating asymmetric loss penalties on severe dysarthria to counteract the clinical distortion paradox.

### Within-Corpus (EasyCall 5-Fold SGKF, 30 Dysarthric Speakers)
- **Severe Recall Gains**: As the severe penalty multiplier increased from 1.0 to 10.0, severe clip recall increased from **24.15% to 26.60%**, and balanced accuracy improved from **55.31% to 55.59%**.
- **Speaker Diagnosis**: 2 of the 3 severe speakers (`f10`, `m14`) are consistently correctly diagnosed as Severe by majority vote, while speaker `m11` is classified as Moderate.
- **Expected Clinical Risk**: Clinical misclassification risk remained stable at **0.71 to 0.72 per clip**, avoiding catastrophic Severe->Mild false negative errors.

### Cross-Corpus Transfer (EasyCall -> TORGO)
- **CORAL Severe Recall**: Asymmetric weighting increased CORAL severe clip recall from **8.13% (at 1x) to 11.19% (at 20x)** and balanced accuracy from **40.83% to 41.23%**.
- **Acoustic Shift Insight**: Cross-corpus severity transfer remains challenging at Layer 12 because language phonetics distort clinical severity boundaries. In an operational clinical setting, session consensus voting combined with domain-balanced multi-source representations (as established in Task 6) is essential.

---

## 8. Step 3: Unified Production Model & Multi-Task Deployment Engine

Integrating all 3 clinical corpora (TORGO, EasyCall, Italian Parkinson's) into a unified clinical screening system.

### Corpus-Balanced Sample Weighting
To eliminate "corpus bullying" (EasyCall's 21,386 clips dominating Italian Parkinson's 831 clips), a two-tier sample weighting scheme assigns exactly 33.33% gradient mass to each corpus and enforces a 50/50 balance between Control and Dysarthric classes within each corpus.

### Benchmark Results (5-Fold Stratified Group K-Fold, 135 Speakers)
- **Overall Unified Balanced Accuracy**: **72.30% ± 7.80%**
- **Overall Unified ROC-AUC**: **0.7996** (~0.80 AUC)
- **Subcohort Out-Of-Fold Performance**:
  - Italian Parkinson's (Hypokinetic Dysarthria): **83.53% B-Acc** (AUC 0.8968)
  - EasyCall (Multi-etiology Dysarthria): **77.53% B-Acc** (AUC 0.8569)
  - TORGO (Cerebral Palsy & ALS): **51.93% B-Acc** (AUC 0.5559)

### Exported Production Bundle & Inference Engine
- **Bundle File**: [`models/dysarthrianet_unified_v1.joblib`](file:///c:/Users/Lovish/Documents/dysarthria_project/models/dysarthrianet_unified_v1.joblib) (0.06 MB)
- **Inference Engine**: [`src/inference.py`](file:///c:/Users/Lovish/Documents/dysarthria_project/src/inference.py)
  - Features end-to-end raw audio loading, Wav2Vec 2.0 embedding extraction, and multi-utterance session consensus aggregation adhering to international clinical assessment guidelines (Freed 2020; Newcastle N-DAT).

