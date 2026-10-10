"""
Experiment 4: Class Weighting on EasyCall Severity Classification (Task 4).
Compares default (class_weight=None) vs balanced (class_weight='balanced').
Evaluates across 5-Fold and 3-Fold StratifiedGroupKFold at C=0.01 and C=0.001.
Tracks clip metrics and per-speaker voting classifications for severe speakers (f10, m11, m14).
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
from sklearn.metrics import accuracy_score, balanced_accuracy_score, precision_recall_fscore_support, confusion_matrix

from src.project_paths import TABLES_DIR, EASYCALL_METADATA_CSV, EASYCALL_EMBEDDINGS_WAV2VEC2_NPY

SEV_MAP = {"mild": 0, "moderate": 1, "severe": 2}
REV_MAP = {0: "mild", 1: "moderate", 2: "severe"}


def load_easycall_severity():
    df_e = pd.read_csv(EASYCALL_METADATA_CSV)
    emb_e_full = np.load(EASYCALL_EMBEDDINGS_WAV2VEC2_NPY)
    mask_e = (df_e["label"] == "dysarthric") & (df_e["severity_3class"].isin(["mild", "moderate", "severe"]))
    idx_e = df_e[mask_e].index.values
    meta_e = df_e[mask_e].copy().reset_index(drop=True)
    X_e = emb_e_full[idx_e]
    y_e = np.asarray(meta_e["severity_3class"].map(SEV_MAP).to_numpy(), dtype=np.int64)
    groups_e = np.asarray(meta_e["speaker_id"].to_numpy())
    return X_e, y_e, groups_e, meta_e


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict:
    acc = accuracy_score(y_true, y_pred)
    bacc = balanced_accuracy_score(y_true, y_pred)
    p, r, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="macro", zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1, 2])

    sens_mild = cm[0, 0] / cm[0].sum() if cm[0].sum() > 0 else 0.0
    sens_mod = cm[1, 1] / cm[1].sum() if cm[1].sum() > 0 else 0.0
    sens_sev = cm[2, 2] / cm[2].sum() if cm[2].sum() > 0 else 0.0

    return {
        "clip_accuracy": round(float(acc), 4),
        "clip_balanced_accuracy": round(float(bacc), 4),
        "clip_macro_f1": round(float(f1), 4),
        "sens_mild": round(float(sens_mild), 4),
        "sens_mod": round(float(sens_mod), 4),
        "sens_sev": round(float(sens_sev), 4),
        "cm": cm.tolist(),
    }


def compute_speaker_metrics(y_true: np.ndarray, y_pred: np.ndarray, groups: np.ndarray) -> Tuple[Dict, List[Dict]]:
    unique_speakers = np.unique(groups)
    spk_records = []
    y_spk_true = []
    y_spk_pred = []

    for spk in unique_speakers:
        idx = np.where(groups == spk)[0]
        spk_true = y_true[idx[0]]
        preds_spk = y_pred[idx]

        counts = np.bincount(preds_spk, minlength=3)
        spk_pred = int(np.argmax(counts))

        y_spk_true.append(spk_true)
        y_spk_pred.append(spk_pred)

        spk_records.append({
            "speaker_id": spk,
            "true_severity": REV_MAP[spk_true],
            "pred_severity": REV_MAP[spk_pred],
            "correct": bool(spk_true == spk_pred),
            "votes_mild": int(counts[0]),
            "votes_moderate": int(counts[1]),
            "votes_severe": int(counts[2]),
            "total_clips": len(idx),
        })

    y_spk_true = np.array(y_spk_true)
    y_spk_pred = np.array(y_spk_pred)

    spk_acc = accuracy_score(y_spk_true, y_spk_pred)
    spk_bacc = balanced_accuracy_score(y_spk_true, y_spk_pred)
    p, r, f1, _ = precision_recall_fscore_support(y_spk_true, y_spk_pred, average="macro", zero_division=0)
    cm = confusion_matrix(y_spk_true, y_spk_pred, labels=[0, 1, 2])

    sens_mild = cm[0, 0] / cm[0].sum() if cm[0].sum() > 0 else 0.0
    sens_mod = cm[1, 1] / cm[1].sum() if cm[1].sum() > 0 else 0.0
    sens_sev = cm[2, 2] / cm[2].sum() if cm[2].sum() > 0 else 0.0

    summary = {
        "speaker_accuracy": round(float(spk_acc), 4),
        "speaker_balanced_accuracy": round(float(spk_bacc), 4),
        "speaker_macro_f1": round(float(f1), 4),
        "speaker_sens_mild": round(float(sens_mild), 4),
        "speaker_sens_mod": round(float(sens_mod), 4),
        "speaker_sens_sev": round(float(sens_sev), 4),
        "speaker_correct": int(np.sum(y_spk_true == y_spk_pred)),
        "speaker_total": len(unique_speakers),
    }

    return summary, spk_records


def run_experiment(X: np.ndarray, y: np.ndarray, groups: np.ndarray, n_splits: int, C: float, class_weight: str | None) -> Tuple[Dict, Dict, List[Dict]]:
    sgkf = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=42)
    y_pred_all = np.zeros_like(y)

    for train_idx, test_idx in sgkf.split(X, y, groups=groups):
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X[train_idx])
        X_test_scaled = scaler.transform(X[test_idx])

        clf = LinearSVC(C=C, class_weight=class_weight, dual=False, max_iter=2000, random_state=42)
        clf.fit(X_train_scaled, y[train_idx])
        y_pred_all[test_idx] = clf.predict(X_test_scaled)

    clip_res = compute_metrics(y, y_pred_all)
    spk_res, spk_records = compute_speaker_metrics(y, y_pred_all, groups)
    return clip_res, spk_res, spk_records


def run_all_evaluations():
    print("=" * 80)
    print("EXP 4: CLASS WEIGHTING ON EASYCALL SEVERITY CLASSIFICATION")
    print("=" * 80)

    X_e, y_e, groups_e, meta_e = load_easycall_severity()
    print(f"Loaded EasyCall: N={len(y_e)} clips across {len(np.unique(groups_e))} speakers.")
    print(f"Class distribution: Mild={np.sum(y_e==0)}, Mod={np.sum(y_e==1)}, Severe={np.sum(y_e==2)}")

    configs = [
        ("SGKF-5 | C=0.01 | None (Fixed baseline)", 5, 0.01, None),
        ("SGKF-5 | C=0.01 | Balanced", 5, 0.01, "balanced"),
        ("SGKF-3 | C=0.01 | None (Fixed baseline)", 3, 0.01, None),
        ("SGKF-3 | C=0.01 | Balanced", 3, 0.01, "balanced"),
        ("SGKF-5 | C=0.001 | None", 5, 0.001, None),
        ("SGKF-5 | C=0.001 | Balanced", 5, 0.001, "balanced"),
    ]

    summary_rows = []
    all_spk_records = []

    for name, n_splits, C, cw in configs:
        clip_res, spk_res, spk_records = run_experiment(X_e, y_e, groups_e, n_splits, C, cw)

        summary_rows.append({
            "config": name,
            "n_splits": n_splits,
            "C": C,
            "class_weight": str(cw),
            "clip_acc": clip_res["clip_accuracy"],
            "clip_bacc": clip_res["clip_balanced_accuracy"],
            "clip_macro_f1": clip_res["clip_macro_f1"],
            "clip_sens_mild": clip_res["sens_mild"],
            "clip_sens_mod": clip_res["sens_mod"],
            "clip_sens_sev": clip_res["sens_sev"],
            "spk_acc": spk_res["speaker_accuracy"],
            "spk_bacc": spk_res["speaker_balanced_accuracy"],
            "spk_macro_f1": spk_res["speaker_macro_f1"],
            "spk_sens_mild": spk_res["speaker_sens_mild"],
            "spk_sens_mod": spk_res["speaker_sens_mod"],
            "spk_sens_sev": spk_res["speaker_sens_sev"],
            "spk_correct": spk_res["speaker_correct"],
            "spk_total": spk_res["speaker_total"],
            "cm": str(clip_res["cm"]),
        })

        for r in spk_records:
            r_copy = dict(r)
            r_copy["config"] = name
            all_spk_records.append(r_copy)

        print(f"\n[{name}]")
        print(f"  Clip B-Acc: {clip_res['clip_balanced_accuracy']*100:.2f}% | Severe Recall: {clip_res['sens_sev']*100:.2f}% | Mod Recall: {clip_res['sens_mod']*100:.2f}%")
        print(f"  Speaker B-Acc: {spk_res['speaker_balanced_accuracy']*100:.2f}% | Correct: {spk_res['speaker_correct']}/{spk_res['speaker_total']}")

    pd.DataFrame(summary_rows).to_csv(TABLES_DIR / "task4_easycall_class_weighting_summary.csv", index=False)
    pd.DataFrame(all_spk_records).to_csv(TABLES_DIR / "task4_easycall_class_weighting_speakers.csv", index=False)
    print(f"\nSaved summary and speaker breakdowns to results/tables/!")


if __name__ == "__main__":
    t_start = time.time()
    run_all_evaluations()
    print(f"\nExperiment 4 completed in {time.time()-t_start:.2f}s!")
