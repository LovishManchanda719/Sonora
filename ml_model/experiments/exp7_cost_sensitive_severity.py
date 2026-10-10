"""
Experiment 7: Cost-Sensitive Asymmetric Learning for Clinical Severity Classification (Step 2).
- Addresses the Clinical Distortion Paradox: Severe patients misdiagnosed as Mild/Moderate.
- Evaluates Asymmetric Loss / Cost Weighting:
  * Penalty multiplier W_sev on Severe class in [1.0, 2.5, 5.0, 7.5, 10.0, 15.0, 20.0].
  * Evaluates on Cross-Corpus Severity Transfer (EasyCall -> TORGO) for both Raw and CORAL.
  * Evaluates on Within-Corpus 5-Fold Stratified Group K-Fold on EasyCall (30 dysarthric speakers).
- Tracks clinical risk using a formal Asymmetric Clinical Cost Matrix:
  * Cost(Mild->Sev) = 2, Cost(Mod->Mild) = 2, Cost(Sev->Mod) = 5, Cost(Sev->Mild) = 10 (catastrophic).
- Tracks individual voting and majority diagnosis for severe TORGO speakers (F01, M01, M02, M04)
  and severe EasyCall speakers (f10, m11, m14).
- Saves authoritative tables to results/tables/task7_cost_sensitive_cross_corpus.csv and
  results/tables/task7_cost_sensitive_within_corpus.csv.
"""

import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sklearn.preprocessing import StandardScaler
from sklearn.svm import LinearSVC
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.metrics import balanced_accuracy_score, confusion_matrix, accuracy_score

from src.project_paths import TABLES_DIR, EASYCALL_METADATA_CSV, EASYCALL_EMBEDDINGS_WAV2VEC2_NPY
from src.data_loading import load_severity_data
from src.coral import coral_align

PENALTY_GRID = [1.0, 2.5, 5.0, 7.5, 10.0, 15.0, 20.0]

# Clinical Cost Matrix: C[true_class, pred_class]
# 0: Mild, 1: Moderate, 2: Severe
CLINICAL_COST_MATRIX = np.array([
    [0, 1, 2],   # True Mild:   Pred Mild=0,  Pred Mod=1, Pred Sev=2
    [2, 0, 1],   # True Mod:    Pred Mild=2,  Pred Mod=0, Pred Sev=1
    [10, 5, 0],  # True Severe: Pred Mild=10, Pred Mod=5, Pred Sev=0
], dtype=float)


def compute_expected_clinical_cost(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Compute average clinical misclassification penalty per patient/clip."""
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1, 2])
    total_cost = np.sum(cm * CLINICAL_COST_MATRIX)
    return float(total_cost / len(y_true))


def run_cross_corpus_cost_sensitive():
    """Evaluate asymmetric loss on cross-corpus transfer: EasyCall -> TORGO."""
    print("=" * 90)
    print("STEP 2 - PART 1: CROSS-CORPUS COST-SENSITIVE SEVERITY TRANSFER (EasyCall -> TORGO)")
    print("=" * 90)

    (X_t, y_t, grp_t, meta_t), (X_e, y_e, grp_e, meta_e) = load_severity_data()

    severe_mask = (y_t == 2)
    severe_spks = sorted(list(np.unique(grp_t[severe_mask])))
    print(f"Loaded EasyCall train samples: {len(y_e)} | TORGO test samples: {len(y_t)}")
    print(f"Tracking severe TORGO speakers: {severe_spks}")

    scaler = StandardScaler()
    X_e_norm = scaler.fit_transform(X_e)
    X_t_norm = scaler.transform(X_t)
    X_e_coral = coral_align(X_e_norm, X_t_norm, regularization=1e-3)

    results = []
    speaker_records = []

    # Count samples in EasyCall classes
    n_mild = np.sum(y_e == 0)
    n_mod = np.sum(y_e == 1)
    n_sev = np.sum(y_e == 2)
    base_weight_sev = (n_mild / n_sev)

    for w_mult in PENALTY_GRID:
        # Base class weights adjusted by severe multiplier
        weights = {
            0: 1.0,
            1: float(n_mild / n_mod),
            2: float(base_weight_sev * w_mult),
        }

        for method, X_train in [("Raw", X_e_norm), ("CORAL", X_e_coral)]:
            clf = LinearSVC(C=0.01, class_weight=weights, dual=False, tol=1e-4, max_iter=2000, random_state=42)
            clf.fit(X_train, y_e)
            preds = clf.predict(X_t_norm)

            bacc = balanced_accuracy_score(y_t, preds)
            cost = compute_expected_clinical_cost(y_t, preds)
            cm = confusion_matrix(y_t, preds, labels=[0, 1, 2])

            sens_mild = cm[0, 0] / cm[0].sum() if cm[0].sum() > 0 else 0.0
            sens_mod = cm[1, 1] / cm[1].sum() if cm[1].sum() > 0 else 0.0
            sens_sev = cm[2, 2] / cm[2].sum() if cm[2].sum() > 0 else 0.0

            # Count correctly diagnosed severe speakers by majority clip voting
            sev_spk_correct = 0
            for s in severe_spks:
                m = (grp_t == s)
                s_preds = preds[m]
                votes = [np.sum(s_preds == 0), np.sum(s_preds == 1), np.sum(s_preds == 2)]
                pred_label = np.argmax(votes)
                is_correct = bool(pred_label == 2)
                if is_correct:
                    sev_spk_correct += 1

                speaker_records.append({
                    "method": method,
                    "severe_penalty_mult": w_mult,
                    "speaker_id": s,
                    "n_clips": int(np.sum(m)),
                    "votes_mild": int(votes[0]),
                    "votes_mod": int(votes[1]),
                    "votes_sev": int(votes[2]),
                    "pred_majority": ["mild", "moderate", "severe"][pred_label],
                    "is_correct": is_correct,
                })

            results.append({
                "method": method,
                "severe_penalty_mult": w_mult,
                "balanced_accuracy": round(bacc * 100, 2),
                "clinical_cost_per_clip": round(cost, 3),
                "recall_mild": round(sens_mild * 100, 2),
                "recall_mod": round(sens_mod * 100, 2),
                "recall_severe": round(sens_sev * 100, 2),
                "severe_speakers_correct": f"{sev_spk_correct} / {len(severe_spks)}",
            })

            print(f"  [{method:<5}] Mult={w_mult:>4.1f} | B-Acc: {bacc*100:5.2f}% | "
                  f"Sev Recall: {sens_sev*100:5.2f}% | Clinical Cost: {cost:5.2f} | "
                  f"Sev Spk Diagnosed: {sev_spk_correct}/{len(severe_spks)}")

    df_res = pd.DataFrame(results)
    out_path = TABLES_DIR / "task7_cost_sensitive_cross_corpus.csv"
    df_res.to_csv(out_path, index=False)
    print(f"\nSaved cross-corpus cost-sensitive results to: {out_path}")

    pd.DataFrame(speaker_records).to_csv(TABLES_DIR / "task7_cost_sensitive_torgo_speakers.csv", index=False)
    return df_res


def run_within_corpus_cost_sensitive():
    """Evaluate asymmetric loss on within-corpus EasyCall 5-Fold cross-validation."""
    print("\n" + "=" * 90)
    print("STEP 2 - PART 2: WITHIN-CORPUS COST-SENSITIVE EVALUATION (EasyCall 5-Fold SGKF)")
    print("=" * 90)

    df_e = pd.read_csv(EASYCALL_METADATA_CSV)
    emb_e_full = np.load(EASYCALL_EMBEDDINGS_WAV2VEC2_NPY)
    mask_e = (df_e["label"] == "dysarthric") & (df_e["severity_3class"].isin(["mild", "moderate", "severe"]))
    idx_e = df_e[mask_e].index.values
    meta_e = df_e[mask_e].copy().reset_index(drop=True)

    SEV_MAP = {"mild": 0, "moderate": 1, "severe": 2}
    X = emb_e_full[idx_e]
    y = np.asarray(meta_e["severity_3class"].map(SEV_MAP).to_numpy(), dtype=np.int64)
    spk = np.asarray(meta_e["speaker_id"].to_numpy())

    severe_spks = sorted(list(np.unique(spk[y == 2])))
    print(f"EasyCall dysarthric dataset: {len(y)} clips across {len(np.unique(spk))} speakers")
    print(f"Severe speakers: {severe_spks}")

    n_mild = np.sum(y == 0)
    n_mod = np.sum(y == 1)
    n_sev = np.sum(y == 2)
    base_weight_sev = (n_mild / n_sev)

    cv = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
    within_results = []

    for w_mult in PENALTY_GRID:
        weights = {
            0: 1.0,
            1: float(n_mild / n_mod),
            2: float(base_weight_sev * w_mult),
        }

        all_preds = np.zeros_like(y)
        for tr_idx, val_idx in cv.split(X, y, spk):
            scaler = StandardScaler()
            X_tr = scaler.fit_transform(X[tr_idx])
            X_val = scaler.transform(X[val_idx])

            clf = LinearSVC(C=0.01, class_weight=weights, dual=False, tol=1e-4, max_iter=2000, random_state=42)
            clf.fit(X_tr, y[tr_idx])
            all_preds[val_idx] = clf.predict(X_val)

        bacc = balanced_accuracy_score(y, all_preds)
        cost = compute_expected_clinical_cost(y, all_preds)
        cm = confusion_matrix(y, all_preds, labels=[0, 1, 2])

        sens_mild = cm[0, 0] / cm[0].sum() if cm[0].sum() > 0 else 0.0
        sens_mod = cm[1, 1] / cm[1].sum() if cm[1].sum() > 0 else 0.0
        sens_sev = cm[2, 2] / cm[2].sum() if cm[2].sum() > 0 else 0.0

        # Check speaker diagnosis
        sev_spk_correct = 0
        spk_status = {}
        for s in severe_spks:
            m = (spk == s)
            votes = [np.sum(all_preds[m] == 0), np.sum(all_preds[m] == 1), np.sum(all_preds[m] == 2)]
            pred_diag = np.argmax(votes)
            if pred_diag == 2:
                sev_spk_correct += 1
            spk_status[s] = ["mild", "mod", "sev"][pred_diag]

        within_results.append({
            "severe_penalty_mult": w_mult,
            "balanced_accuracy": round(bacc * 100, 2),
            "clinical_cost_per_clip": round(cost, 3),
            "recall_mild": round(sens_mild * 100, 2),
            "recall_mod": round(sens_mod * 100, 2),
            "recall_severe": round(sens_sev * 100, 2),
            "severe_speakers_correct": f"{sev_spk_correct} / {len(severe_spks)}",
            "speaker_diagnoses": str(spk_status),
        })

        print(f"  EasyCall 5-Fold | Mult={w_mult:>4.1f} | B-Acc: {bacc*100:5.2f}% | "
              f"Sev Recall: {sens_sev*100:5.2f}% | Clinical Cost: {cost:5.2f} | "
              f"Severe Correct: {sev_spk_correct}/{len(severe_spks)} {spk_status}")

    df_within = pd.DataFrame(within_results)
    out_within_path = TABLES_DIR / "task7_cost_sensitive_within_corpus.csv"
    df_within.to_csv(out_within_path, index=False)
    print(f"\nSaved within-corpus cost-sensitive results to: {out_within_path}")
    return df_within


def main():
    t0 = time.time()
    run_cross_corpus_cost_sensitive()
    run_within_corpus_cost_sensitive()
    print(f"\nExperiment 7 completed in {time.time() - t0:.1f} seconds.")


if __name__ == "__main__":
    main()
