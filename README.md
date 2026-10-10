# DysarthriaNet-XC

**Cross-Corpus Generalization, Layer Representation, and Domain Adaptation Benchmark in Speech-Based Dysarthria Assessment**

---

## 1. Executive Summary

DysarthriaNet-XC is an empirical benchmarking framework investigating **cross-corpus generalizability, domain shift, and unsupervised domain adaptation** in speech-based dysarthria detection and severity classification.

While state-of-the-art speech models routinely report 80% to 95% detection accuracy within single datasets, this repository demonstrates that such evaluations suffer from severe dataset overfitting: models memorize recording acoustics, background noise, or language phonetics rather than genuine neuromotor speech impairment. 

### Key Discoveries:
1. **The Cross-Corpus Generalization Gap**: Models achieving 66% to 87% balanced accuracy within-corpus collapse to near-chance levels (41.8% to 56.3%) when transferred zero-shot to unseen external corpora.
2. **Heterogeneous CORAL Adaptation**: Regularized Correlation Alignment (CORAL) produces positive shifts in some pairs (e.g., TORGO -> EasyCall: +6.14 pp), but negative transfer in others (e.g., IPVS -> EasyCall: -6.54 pp).
3. **The Severity Distortion Paradox**: Under CORAL adaptation, 3 of 4 severe TORGO speakers (`F01`, `M01`, `M02`) are systematically misclassified as **Mild** across the entire regularization sweep (`C` in `[1e-5, 1.0]`), collapsing severe clip recall from 26.7% to 5.1%.
4. **Layer Representation Dynamics**: Low-level acoustic representations (Layer 1 of Wav2Vec 2.0) outperform final transformer representations (Layer 12) by **+8.30 pp** on Italian Parkinson's, capturing phonatory tremor and vocal stability better than semantic representations.
5. **Forensic Recording Date Audit**: Analysis of Italian Parkinson's filenames revealed severe temporal collinearity: all Parkinson's patients concluded before March 2017, while all elderly controls were recorded after March 2017. A decision rule based solely on the filename date stamp achieves **94.29% balanced accuracy**.

---

## 2. Monorepo Repository Structure

```
dysarthria_project/
├── .gitignore                         # Excludes raw audio, large embeddings, node_modules, and build artifacts
├── README.md                          # High-level monorepo architectural documentation
├── pyrefly.toml                       # Python type checker / workspace configuration
│
├── ml_model/                          # Machine Learning Research, Benchmarking & Training
│   ├── data/                          # Structured datasets (raw audio gitignored, metadata tracked)
│   ├── src/                           # Reusable Python library package (CORAL, features, inference)
│   ├── experiments/                   # Numbered experiment runners (exp1 to exp7)
│   ├── models/                        # Serialized production bundles (dysarthrianet_unified_v1.joblib)
│   ├── results/                       # Authoritative figures & 21+ CSV tables
│   ├── tests/                         # Full ML test suite (28 passing unit tests)
│   ├── notebooks/                     # Exploratory research notebooks
│   └── requirements.txt               # Research dependencies (PyTorch, transformers, scikit-learn)
│
├── backend/                           # Production FastAPI Microservice
│   ├── app/
│   │   ├── main.py                    # FastAPI entrypoint with CORS & lifespan warmup
│   │   ├── core/                      # Configuration & settings
│   │   ├── schemas/                   # Pydantic v2 data contracts (Clip & Session response)
│   │   ├── services/                  # Audio preprocessing, decoding & model inference service
│   │   └── api/                       # REST endpoints (/api/v1/health, /api/v1/screen/clip, /session)
│   ├── models/                        # Self-contained production model bundle (59 KB)
│   ├── tests/                         # Integration test suite (5 passing TestClient tests)
│   ├── Dockerfile                     # Zero-cost container for HuggingFace Spaces / Render
│   └── requirements.txt               # Lightweight backend dependencies
│
├── web/                               # Next.js 14 + Tailwind CSS Web Application (Ready for setup)
│
└── android/                           # Native Android Application (Kotlin + Jetpack Compose)
```

---

## 3. Installation & Setup

### Environment Setup
```bash
# Clone the repository
git clone https://github.com/your-repo/dysarthrianet-xc.git
cd dysarthria_project

# Create a clean Python 3.10+ environment
conda create -n dysarthria python=3.10 -y
conda activate dysarthria

# Install dependencies
pip install -r requirements.txt
```

---

## 4. Reproducing the Experiments

All experiments read from pre-computed feature representations in `data/` and save artifacts to `results/`.

### Task 1: Source-Validated Cross-Corpus Transfer
Evaluates inner 3-fold cross-validation on source data down to `C = 1e-7` and evaluates all 6 directional cross-corpus pairs with 10,000 speaker bootstrap draws:
```bash
python -m experiments.exp1_cross_corpus_transfer
```

### Task 2: CORAL Severity Distortion & C Sweep
Evaluates the 4 severe TORGO speakers under CORAL adaptation across `C` in `[1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1.0]` and across Layers 1, 4, 12:
```bash
python -m experiments.exp2_severity_distortion
```

### Task 3: Layer Representation & Paired Nested CV
Evaluates Layers 1, 4, 7, and 12, running strictly nested inner-CV layer selection against fixed Layer 12 models on identical outer folds:
```bash
python -m experiments.exp3_layer_representations
```

### Task 4: Class Weighting on EasyCall Severity
Compares unweighted vs `class_weight='balanced'` on the imbalanced 3-class EasyCall severity task:
```bash
python -m experiments.exp4_class_weighting
```

### Task 5: Forensic Temporal Audit on Italian Parkinson's (IPVS)
Audits filename date stamps across all 831 clips and runs subcohort evaluations:
```bash
python -m experiments.exp5_ipvs_temporal_audit
```

### Task 6: Multi-Source Domain Generalization
Evaluates leave-one-corpus-out multi-source training across TORGO, EasyCall, and Italian Parkinson's, benchmarking Raw Pooling, Domain-Standardization, and CORAL Alignment against single-source baselines with 10,000 bootstrap draws:
```bash
python -m experiments.exp6_multisource_transfer
```

### Task 7: Cost-Sensitive Asymmetric Learning for Clinical Severity
Evaluates asymmetric penalty multipliers on the severe class across cross-corpus (EasyCall -> TORGO) and within-corpus (EasyCall) settings, measuring expected clinical risk and severe speaker recovery:
```bash
python -m experiments.exp7_cost_sensitive_severity
```

### Generate Manuscript Figures & Tables
```bash
python -m src.visualization
python -m src.tables
```

### Quality Assurance & Verification
Run the 25-test unit suite validating data paths, audio preprocessing, model pipelines, SGKF group isolation, foundation model representations, multi-source structures, and cost-sensitive severity logic:
```bash
python -m unittest discover tests
```

---

## 5. Primary Citations & References

1. **TORGO Database**:
   - Rudzicz, F., Namasivayam, A. K., & Wolff, T. (2012). The TORGO database of acoustic and articulatory speech from speakers with dysarthria. *Language Resources and Evaluation*, 46(4), 523–541.
   - DOI: `10.1007/s10579-011-9145-0`
2. **EasyCall Corpus**:
   - Turrisi, R., Braccia, A., Emanuele, M., Giulietti, S., Pugliatti, M., Sensi, M., Fadiga, L., & Badino, L. (2021). EasyCall Corpus: A Dysarthric Speech Dataset. *Proc. Interspeech 2021*, 41–45.
   - DOI: `10.21437/Interspeech.2021-549`
3. **Clinical Grounding**:
   - Freed, D. B. (2020). *Motor Speech Disorders: Diagnosis and Treatment* (3rd ed.). Plural Publishing.
   - NSW Adult Speech Pathology EBP Group. (2015). *Newcastle Dysarthria Assessment Tool (N-DAT)*.
