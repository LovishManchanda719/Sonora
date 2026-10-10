"""
Experiment 1: Cross-Corpus Transfer & Source-Validated Sensitivity (Task 1).
- Evaluates inner CV on source over C in [1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1.0].
- Selects source-validated C per corpus.
- Evaluates 6 cross-corpus pairs at source-validated C with 10,000 shared-draw bootstrap CIs and ROC-AUC.
- Reproduces main-table within-corpus fixed C=0.01 numbers exactly alongside nested-tuned within-corpus.
"""

import os
import sys
import time
from pathlib import Path
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sklearn.preprocessing import StandardScaler
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.metrics import balanced_accuracy_score, roc_auc_score, accuracy_score, precision_recall_fscore_support

from src.project_paths import (
    TABLES_DIR,
    METADATA_CSV,
    EASYCALL_METADATA_CSV,
    PARKINSONS_METADATA_CSV,
    WAV2VEC2_EMBEDDINGS_NPY,
    EASYCALL_EMBEDDINGS_WAV2VEC2_NPY,
    PARKINSONS_EMBEDDINGS_WAV2VEC2_NPY,
)
from src.coral import coral_align
from src.evaluation import evaluate_speaker_independent

C_GRID_TASK1 = [1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1.0]


def load_data():
    corpora = {}
    for name, m_csv, e_npy in [
        ("TORGO", METADATA_CSV, WAV2VEC2_EMBEDDINGS_NPY),
        ("EasyCall", EASYCALL_METADATA_CSV, EASYCALL_EMBEDDINGS_WAV2VEC2_NPY),
        ("Italian_Parkinsons", PARKINSONS_METADATA_CSV, PARKINSONS_EMBEDDINGS_WAV2VEC2_NPY),
    ]:
        df = pd.read_csv(m_csv)
        X = np.load(e_npy)
        y = (df["label"].str.lower() == "dysarthric").astype(int).to_numpy()
        spk = df["speaker_id"].to_numpy()
        corpora[name] = {"X": X, "y": y, "spk": spk, "df": df}
    return corpora


def run_inner_cv_search(corpora):
    print("=" * 80)
    print("EXP 1 - PART 1: INNER CV GRID SEARCH ON SOURCE ONLY (DOWN TO 1e-7)")
    print("=" * 80)
    rows = []
    source_validated_c = {}

    for name in ["TORGO", "EasyCall", "Italian_Parkinsons"]:
        X, y, spk = corpora[name]["X"], corpora[name]["y"], corpora[name]["spk"]
        cv = StratifiedGroupKFold(n_splits=3, shuffle=True, random_state=42)
        print(f"\nCorpus: {name} (N={len(y)}, {len(np.unique(spk))} speakers)")

        best_c = None
        best_bacc = -1.0

        for c_val in C_GRID_TASK1:
            fold_scores = []
            for tr_idx, val_idx in cv.split(X, y, spk):
                scaler = StandardScaler()
                X_tr = scaler.fit_transform(X[tr_idx])
                X_val = scaler.transform(X[val_idx])
                clf = LinearSVC(C=c_val, dual=False, tol=1e-4, max_iter=2000, random_state=42)
                clf.fit(X_tr, y[tr_idx])
                preds = clf.predict(X_val)
                fold_scores.append(balanced_accuracy_score(y[val_idx], preds))

            mean_b = float(np.mean(fold_scores))
            std_b = float(np.std(fold_scores))

            rows.append({
                "corpus": name,
                "C": c_val,
                "mean_inner_bacc": round(mean_b * 100, 2),
                "std_inner_bacc": round(std_b * 100, 2),
                "fold_scores": [round(x * 100, 2) for x in fold_scores],
            })

            print(f"  C={c_val:<7.1e} | Inner B-Acc: {mean_b*100:6.2f}% +/- {std_b*100:5.2f}% | Folds: {[round(x*100,1) for x in fold_scores]}")

            if mean_b > best_bacc:
                best_bacc = mean_b
                best_c = c_val

        source_validated_c[name] = best_c
        print(f"  --> Selected Source-Validated C for {name}: {best_c:.1e} (Inner B-Acc: {best_bacc*100:.2f}%)")

    df_inner = pd.DataFrame(rows)
    df_inner.to_csv(os.path.join(TABLES_DIR, "task1_inner_cv_grid_down_to_1e7.csv"), index=False)
    return df_inner, source_validated_c


def run_source_validated_transfer(corpora, source_validated_c):
    print("\n" + "=" * 80)
    print("EXP 1 - PART 2: CROSS-CORPUS TRANSFER AT SOURCE-VALIDATED C (WITH 10k BOOTSTRAP)")
    print("=" * 80)

    N_BOOT = 10000
    boot_draws = {}
    for tgt_name, d in corpora.items():
        spk = d["spk"]
        unique_spk = np.unique(spk)
        n_spk = len(unique_spk)
        rng = np.random.RandomState(42)
        draws = [rng.choice(unique_spk, size=n_spk, replace=True) for _ in range(N_BOOT)]
        boot_draws[tgt_name] = (unique_spk, draws)

    names = ["TORGO", "EasyCall", "Italian_Parkinsons"]
    transfer_rows = []

    for src in names:
        for tgt in names:
            if src == tgt:
                continue

            X_src, y_src = corpora[src]["X"], corpora[src]["y"]
            X_tgt, y_tgt = corpora[tgt]["X"], corpora[tgt]["y"]
            spk_tgt = corpora[tgt]["spk"]
            unique_spk, draws = boot_draws[tgt]
            spk_clip_masks = {s: np.where(spk_tgt == s)[0] for s in unique_spk}

            scaler = StandardScaler()
            X_s_norm = scaler.fit_transform(X_src)
            X_t_norm = scaler.transform(X_tgt)
            X_s_coral = coral_align(X_s_norm, X_t_norm, regularization=1e-3)

            c_val = source_validated_c[src]

            # 1. Raw
            clf_r = LinearSVC(C=c_val, dual=False, tol=1e-4, max_iter=2000, random_state=42)
            clf_r.fit(X_s_norm, y_src)
            pred_r = clf_r.predict(X_t_norm)
            score_r = clf_r.decision_function(X_t_norm)
            bacc_r = balanced_accuracy_score(y_tgt, pred_r)
            auc_r = roc_auc_score(y_tgt, score_r)

            # 2. CORAL
            clf_c = LinearSVC(C=c_val, dual=False, tol=1e-4, max_iter=2000, random_state=42)
            clf_c.fit(X_s_coral, y_src)
            pred_c = clf_c.predict(X_t_norm)
            score_c = clf_c.decision_function(X_t_norm)
            bacc_c = balanced_accuracy_score(y_tgt, pred_c)
            auc_c = roc_auc_score(y_tgt, score_c)

            # Precompute speaker stats
            spk_stats_r = {}
            spk_stats_c = {}
            for s in unique_spk:
                m = spk_clip_masks[s]
                y_m = y_tgt[m]
                pr_m, pc_m = pred_r[m], pred_c[m]
                spk_stats_r[s] = (int(np.sum((y_m == 1) & (pr_m == 1))), int(np.sum(y_m == 1)),
                                  int(np.sum((y_m == 0) & (pr_m == 0))), int(np.sum(y_m == 0)))
                spk_stats_c[s] = (int(np.sum((y_m == 1) & (pc_m == 1))), int(np.sum(y_m == 1)),
                                  int(np.sum((y_m == 0) & (pc_m == 0))), int(np.sum(y_m == 0)))

            boot_raw_bacc = []
            boot_coral_bacc = []
            boot_deltas = []
            for sample_spks in draws:
                tot_tp_r = sum(spk_stats_r[s][0] for s in sample_spks)
                tot_p_r = sum(spk_stats_r[s][1] for s in sample_spks)
                tot_tn_r = sum(spk_stats_r[s][2] for s in sample_spks)
                tot_n_r = sum(spk_stats_r[s][3] for s in sample_spks)
                if tot_p_r == 0 or tot_n_r == 0:
                    continue
                b_r = 0.5 * ((tot_tp_r / tot_p_r) + (tot_tn_r / tot_n_r))

                tot_tp_c = sum(spk_stats_c[s][0] for s in sample_spks)
                tot_p_c = sum(spk_stats_c[s][1] for s in sample_spks)
                tot_tn_c = sum(spk_stats_c[s][2] for s in sample_spks)
                tot_n_c = sum(spk_stats_c[s][3] for s in sample_spks)
                if tot_p_c == 0 or tot_n_c == 0:
                    continue
                b_c = 0.5 * ((tot_tp_c / tot_p_c) + (tot_tn_c / tot_n_c))

                boot_raw_bacc.append(b_r)
                boot_coral_bacc.append(b_c)
                boot_deltas.append(b_c - b_r)

            ci_r = (np.percentile(boot_raw_bacc, 2.5), np.percentile(boot_raw_bacc, 97.5))
            ci_c = (np.percentile(boot_coral_bacc, 2.5), np.percentile(boot_coral_bacc, 97.5))
            ci_d = (np.percentile(boot_deltas, 2.5), np.percentile(boot_deltas, 97.5))
            excl_zero = bool(ci_d[0] > 0 or ci_d[1] < 0)

            delta_val = (bacc_c - bacc_r) * 100

            transfer_rows.append({
                "source": src,
                "target": tgt,
                "source_validated_c": c_val,
                "raw_bacc": round(bacc_r * 100, 2),
                "coral_bacc": round(bacc_c * 100, 2),
                "delta_pp": round(delta_val, 2),
                "raw_ci_95": f"[{ci_r[0]*100:.1f}%, {ci_r[1]*100:.1f}%]",
                "coral_ci_95": f"[{ci_c[0]*100:.1f}%, {ci_c[1]*100:.1f}%]",
                "delta_ci_95": f"[{ci_d[0]*100:.1f}%, {ci_d[1]*100:.1f}%]",
                "excludes_zero": excl_zero,
                "raw_auc": round(auc_r, 4),
                "coral_auc": round(auc_c, 4),
            })

            print(f"  {src:<18} -> {tgt:<18} (C={c_val:.1e}) | Raw: {bacc_r*100:5.2f}% (AUC {auc_r:.3f}) | "
                  f"CORAL: {bacc_c*100:5.2f}% (AUC {auc_c:.3f}) | Delta: {delta_val:+5.2f} pp {transfer_rows[-1]['delta_ci_95']} | "
                  f"Excludes Zero: {excl_zero}")

    df_transfer = pd.DataFrame(transfer_rows)
    df_transfer.to_csv(os.path.join(TABLES_DIR, "task1_source_validated_transfer.csv"), index=False)
    return df_transfer


def run_within_corpus_exact_reproduction(corpora, source_validated_c):
    print("\n" + "=" * 80)
    print("EXP 1 - PART 3: WITHIN-CORPUS EXACT REPRODUCTION (FIXED C=0.01 VS SOURCE-VALIDATED C)")
    print("=" * 80)

    within_rows = []

    for name in ["TORGO", "EasyCall", "Italian_Parkinsons"]:
        X, y, spk = corpora[name]["X"], corpora[name]["y"], corpora[name]["spk"]

        # 1. Fixed Baseline C=0.01
        pipe_fixed = Pipeline([
            ("scaler", StandardScaler()),
            ("svc", LinearSVC(C=0.01, dual=False, max_iter=2000, random_state=42))
        ])
        res_fixed = evaluate_speaker_independent(pipe_fixed, X, y, spk, n_splits=5)

        cm_fix = res_fixed["confusion_matrix"]
        spec_fix = float(cm_fix[0, 0] / (cm_fix[0, 0] + cm_fix[0, 1])) if cm_fix.shape == (2, 2) else np.nan
        sens_fix = float(cm_fix[1, 1] / (cm_fix[1, 0] + cm_fix[1, 1])) if cm_fix.shape == (2, 2) else np.nan
        bacc_fix = (spec_fix + sens_fix) / 2.0

        # 2. Source-Validated C
        c_src = source_validated_c[name]
        pipe_val = Pipeline([
            ("scaler", StandardScaler()),
            ("svc", LinearSVC(C=c_src, dual=False, max_iter=2000, random_state=42))
        ])
        res_val = evaluate_speaker_independent(pipe_val, X, y, spk, n_splits=5)

        cm_val = res_val["confusion_matrix"]
        spec_val = float(cm_val[0, 0] / (cm_val[0, 0] + cm_val[0, 1])) if cm_val.shape == (2, 2) else np.nan
        sens_val = float(cm_val[1, 1] / (cm_val[1, 0] + cm_val[1, 1])) if cm_val.shape == (2, 2) else np.nan
        bacc_val = (spec_val + sens_val) / 2.0

        within_rows.append({
            "corpus": name,
            "fixed_C": 0.01,
            "fixed_raw_acc": round(res_fixed["accuracy"] * 100, 2),
            "fixed_bacc": round(bacc_fix * 100, 2),
            "fixed_sens": round(sens_fix * 100, 2),
            "fixed_spec": round(spec_fix * 100, 2),
            "fixed_macro_f1": round(res_fixed["macro_f1"] * 100, 2),
            "fixed_fold_std": round(res_fixed["fold_accuracies_std"] * 100, 2),
            "source_validated_C": c_src,
            "val_raw_acc": round(res_val["accuracy"] * 100, 2),
            "val_bacc": round(bacc_val * 100, 2),
            "val_sens": round(sens_val * 100, 2),
            "val_spec": round(spec_val * 100, 2),
            "val_macro_f1": round(res_val["macro_f1"] * 100, 2),
            "val_fold_std": round(res_val["fold_accuracies_std"] * 100, 2),
            "delta_bacc_pp": round((bacc_val - bacc_fix) * 100, 2)
        })

        print(f"  {name:<18} | Fixed (C=0.01): B-Acc={bacc_fix*100:5.2f}%, Fold-SD={res_fixed['fold_accuracies_std']*100:5.2f}%, F1={res_fixed['macro_f1']*100:5.2f}% | "
              f"Source-Val (C={c_src:.1e}): B-Acc={bacc_val*100:5.2f}%, Fold-SD={res_val['fold_accuracies_std']*100:5.2f}%, F1={res_val['macro_f1']*100:5.2f}% | "
              f"Delta: {(bacc_val - bacc_fix)*100:+5.2f} pp")

    df_within = pd.DataFrame(within_rows)
    df_within.to_csv(os.path.join(TABLES_DIR, "task1_within_corpus_comparison.csv"), index=False)
    return df_within


if __name__ == "__main__":
    t_start = time.time()
    corpora = load_data()
    df_inner, source_validated_c = run_inner_cv_search(corpora)
    df_transfer = run_source_validated_transfer(corpora, source_validated_c)
    df_within = run_within_corpus_exact_reproduction(corpora, source_validated_c)
    print(f"\nExperiment 1 completed in {time.time()-t_start:.2f}s!")
