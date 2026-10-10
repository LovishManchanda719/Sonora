"""
Experiment 5: Italian Parkinson's (IPVS) Recording Date Audit & Subcohort Analysis.
1. Parses recording datetimes by digit count after sex letter (10 vs 12 digits).
2. Tabulates cohorts by date range, year, and format (ipvs_cohort_by_date_table.csv).
3. Classifies PD-2016-batch vs PD-2017-batch using speaker-grouped cross-validation.
4. Evaluates binary classification for:
   - PD vs Elderly Controls (age-matched, 28 PD vs 22 Elderly)
   - PD vs Young Controls (28 PD vs 15 Young)
   across Layers 1 and 12 (ipvs_subcohort_classification_results.csv).
"""

import re
import sys
import time
from pathlib import Path
from datetime import datetime
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.preprocessing import StandardScaler
from sklearn.svm import LinearSVC
from sklearn.metrics import balanced_accuracy_score, accuracy_score, confusion_matrix, precision_recall_fscore_support

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.project_paths import PARKINSONS_METADATA_CSV, TABLES_DIR, get_layer_embedding_path


def parse_ipvs_filename(path_str: str):
    stem = Path(path_str).stem.rstrip(".")
    m = re.search(r"[0-9]{2}([MF])([0-9]+)$", stem, re.IGNORECASE)
    if not m:
        return None
    sex = m.group(1).upper()
    digits = m.group(2)
    n = len(digits)

    if n == 10:
        dd, mm, yy = int(digits[0:2]), int(digits[2:4]), int(digits[4:6]) + 2000
        hh, mi = int(digits[6:8]), int(digits[8:10])
    elif n == 12:
        dd, mm, yy = int(digits[0:2]), int(digits[2:4]), int(digits[4:8])
        hh, mi = int(digits[8:10]), int(digits[10:12])
    else:
        return None

    return {
        "stem": stem, "sex": sex, "digits": digits, "n_digits": n,
        "day": dd, "month": mm, "year": yy, "hour": hh, "minute": mi,
        "date_str": f"{yy:04d}-{mm:02d}-{dd:02d}",
        "time_str": f"{hh:02d}:{mi:02d}",
        "datetime_str": f"{yy:04d}-{mm:02d}-{dd:02d} {hh:02d}:{mi:02d}",
    }


def run_date_audit(df: pd.DataFrame):
    print("=" * 80)
    print("EXP 5 - PART 1: IPVS FILENAME DATE STAMP AUDIT")
    print("=" * 80)

    parsed_info = [parse_ipvs_filename(p) for p in df["file_path"]]
    df["parsed_date"] = [p["date_str"] for p in parsed_info]
    df["parsed_datetime"] = [p["datetime_str"] for p in parsed_info]
    df["year"] = [p["year"] for p in parsed_info]
    df["n_digits"] = [p["n_digits"] for p in parsed_info]

    summary_rows = []
    for cohort, grp in df.groupby("cohort"):
        summary_rows.append({
            "cohort": cohort,
            "speakers": grp["speaker_id"].nunique(),
            "clips": len(grp),
            "min_date": grp["parsed_date"].min(),
            "max_date": grp["parsed_date"].max(),
            "years": dict(grp["year"].value_counts()),
            "digit_format": dict(grp["n_digits"].value_counts()),
        })

    sum_df = pd.DataFrame(summary_rows)
    sum_df.to_csv(TABLES_DIR / "ipvs_cohort_by_date_table.csv", index=False)
    print(sum_df.to_string(index=False))


def run_subcohort_evaluations(df: pd.DataFrame):
    print("\n" + "=" * 80)
    print("EXP 5 - PART 2: SUB-COHORT BINARY CLASSIFICATION (LAYERS 1 & 12)")
    print("=" * 80)

    emb_l1 = np.load(get_layer_embedding_path("Italian_Parkinsons", 1))
    emb_l12 = np.load(get_layer_embedding_path("Italian_Parkinsons", 12))

    tasks = [
        ("PD vs Elderly Controls", "28 People with Parkinson's disease", "22 Elderly Healthy Control"),
        ("PD vs Young Controls", "28 People with Parkinson's disease", "15 Young Healthy Control"),
    ]

    results = []

    for task_name, cohort1, cohort2 in tasks:
        sub_df = df[df["cohort"].isin([cohort1, cohort2])].copy()
        sub_df["target"] = (sub_df["cohort"] == cohort1).astype(int)
        y = sub_df["target"].to_numpy()
        groups = sub_df["speaker_id"].to_numpy()
        indices = sub_df.index.to_numpy()

        print(f"\n--- Task: {task_name} (Positive={cohort1}, Negative={cohort2}) ---")

        for layer_num, emb_full in [(1, emb_l1), (12, emb_l12)]:
            X = emb_full[indices]
            sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)

            fold_bacc = []
            fold_acc = []
            y_true_all, y_pred_all = [], []

            for tr, te in sgkf.split(X, y, groups):
                scaler = StandardScaler()
                X_tr = scaler.fit_transform(X[tr])
                X_te = scaler.transform(X[te])

                clf = LinearSVC(C=0.01, dual=False, max_iter=2000, random_state=42)
                clf.fit(X_tr, y[tr])
                preds = clf.predict(X_te)

                fold_bacc.append(balanced_accuracy_score(y[te], preds))
                fold_acc.append(accuracy_score(y[te], preds))
                y_true_all.extend(y[te])
                y_pred_all.extend(preds)

            mean_bacc = np.mean(fold_bacc) * 100
            std_bacc = np.std(fold_bacc, ddof=1) * 100
            mean_acc = np.mean(fold_acc) * 100
            std_acc = np.std(fold_acc, ddof=1) * 100
            pooled_bacc = balanced_accuracy_score(y_true_all, y_pred_all) * 100
            pooled_acc = accuracy_score(y_true_all, y_pred_all) * 100
            cm = confusion_matrix(y_true_all, y_pred_all)
            sens = cm[1, 1] / cm[1].sum() * 100
            spec = cm[0, 0] / cm[0].sum() * 100

            results.append({
                "task": task_name,
                "layer": layer_num,
                "mean_fold_bacc": round(mean_bacc, 2),
                "std_fold_bacc_ddof1": round(std_bacc, 2),
                "mean_fold_acc": round(mean_acc, 2),
                "std_fold_acc_ddof1": round(std_acc, 2),
                "pooled_bacc": round(pooled_bacc, 2),
                "pooled_acc": round(pooled_acc, 2),
                "sensitivity": round(sens, 2),
                "specificity": round(spec, 2),
                "n_pos": int(np.sum(y == 1)),
                "n_neg": int(np.sum(y == 0)),
            })

            print(f"  Layer {layer_num:2d} | Mean Fold B-Acc: {mean_bacc:.2f}% +/- {std_bacc:.2f}% | Sensitivity: {sens:.2f}% | Specificity: {spec:.2f}%")

    pd.DataFrame(results).to_csv(TABLES_DIR / "ipvs_subcohort_classification_results.csv", index=False)
    print(f"\nSaved subcohort results to results/tables/!")


if __name__ == "__main__":
    t_start = time.time()
    df = pd.read_csv(PARKINSONS_METADATA_CSV)
    run_date_audit(df)
    run_subcohort_evaluations(df)
    print(f"\nExperiment 5 completed in {time.time()-t_start:.2f}s!")
