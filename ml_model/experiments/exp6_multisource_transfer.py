"""
Experiment 6: Multi-Source Domain Generalization (Step 1).
- Evaluates Leave-One-Corpus-Out (LOCO) multi-source training across TORGO, EasyCall, and Italian Parkinson's.
  * Train: (EasyCall + Italian_Parkinsons) -> Test: TORGO
  * Train: (TORGO + Italian_Parkinsons) -> Test: EasyCall
  * Train: (TORGO + EasyCall) -> Test: Italian_Parkinsons
- Evaluates 3 training strategies:
  1. Multi-Source Raw Pooled (direct concatenation + pooled scaling)
  2. Multi-Source Domain-Standardized (independent per-source z-score normalization before pooling)
  3. Multi-Source CORAL-Aligned (unsupervised covariance alignment to target domain)
- Selects source-optimal C via Stratified Group K-Fold cross-validation on combined sources (grouped by speaker).
- Benchmarks against Single-Source transfer baselines.
- Computes 10,000 speaker-clustered bootstrap draws for 95% Confidence Intervals and delta significance.
- Saves results to results/tables/task6_multisource_transfer.csv and results/tables/task6_multisource_inner_cv.csv.
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

C_GRID = [1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1.0]
N_BOOT = 10000


def load_corpora():
    """Load embeddings, labels, and speaker IDs for all 3 corpora."""
    corpora = {}
    configs = [
        ("TORGO", METADATA_CSV, WAV2VEC2_EMBEDDINGS_NPY),
        ("EasyCall", EASYCALL_METADATA_CSV, EASYCALL_EMBEDDINGS_WAV2VEC2_NPY),
        ("Italian_Parkinsons", PARKINSONS_METADATA_CSV, PARKINSONS_EMBEDDINGS_WAV2VEC2_NPY),
    ]
    for name, m_csv, e_npy in configs:
        df = pd.read_csv(m_csv)
        X = np.load(e_npy)
        y = (df["label"].str.lower() == "dysarthric").astype(int).to_numpy()
        # Add corpus prefix to speaker ID to avoid cross-corpus collision in pooled data
        spk = (name + "_" + df["speaker_id"].astype(str)).to_numpy()
        corpora[name] = {
            "X": X,
            "y": y,
            "spk": spk,
            "raw_spk": df["speaker_id"].astype(str).to_numpy(),
            "df": df,
            "n_samples": len(y),
            "n_speakers": len(np.unique(df["speaker_id"])),
        }
    return corpora


def run_inner_cv_selection(X_pool, y_pool, spk_pool, setup_name):
    """Perform Stratified Group K-Fold cross-validation on pooled sources to select C."""
    cv = StratifiedGroupKFold(n_splits=3, shuffle=True, random_state=42)
    best_c = None
    best_bacc = -1.0
    cv_records = []

    for c_val in C_GRID:
        fold_scores = []
        for tr_idx, val_idx in cv.split(X_pool, y_pool, spk_pool):
            scaler = StandardScaler()
            X_tr = scaler.fit_transform(X_pool[tr_idx])
            X_val = scaler.transform(X_pool[val_idx])
            clf = LinearSVC(C=c_val, dual=False, tol=1e-4, max_iter=2000, random_state=42)
            clf.fit(X_tr, y_pool[tr_idx])
            preds = clf.predict(X_val)
            fold_scores.append(balanced_accuracy_score(y_pool[val_idx], preds))

        mean_b = float(np.mean(fold_scores))
        std_b = float(np.std(fold_scores))
        cv_records.append({
            "setup": setup_name,
            "C": c_val,
            "mean_inner_bacc": round(mean_b * 100, 2),
            "std_inner_bacc": round(std_b * 100, 2),
            "fold_scores": [round(x * 100, 2) for x in fold_scores],
        })

        if mean_b > best_bacc:
            best_bacc = mean_b
            best_c = c_val

    return best_c, best_bacc, cv_records


def compute_bootstrap_metrics(y_true, preds, scores, unique_spk, draws, spk_clip_masks):
    """Compute balanced accuracy, ROC-AUC, and 95% bootstrap CI grouped by speaker."""
    bacc_obs = balanced_accuracy_score(y_true, preds)
    auc_obs = roc_auc_score(y_true, scores)

    # Pre-calculate counts per speaker for fast vectorization
    spk_stats = {}
    for s in unique_spk:
        m = spk_clip_masks[s]
        y_m = y_true[m]
        p_m = preds[m]
        spk_stats[s] = (
            int(np.sum((y_m == 1) & (p_m == 1))),
            int(np.sum(y_m == 1)),
            int(np.sum((y_m == 0) & (p_m == 0))),
            int(np.sum(y_m == 0)),
        )

    boot_baccs = []
    for sample_spks in draws:
        tp = sum(spk_stats[s][0] for s in sample_spks)
        p = sum(spk_stats[s][1] for s in sample_spks)
        tn = sum(spk_stats[s][2] for s in sample_spks)
        n = sum(spk_stats[s][3] for s in sample_spks)
        if p == 0 or n == 0:
            continue
        boot_baccs.append(0.5 * ((tp / p) + (tn / n)))

    ci_low = float(np.percentile(boot_baccs, 2.5))
    ci_high = float(np.percentile(boot_baccs, 97.5))
    return bacc_obs, auc_obs, ci_low, ci_high, np.array(boot_baccs)


def main():
    t0 = time.time()
    print("=" * 90)
    print("EXPERIMENT 6: MULTI-SOURCE DOMAIN GENERALIZATION (LEAVE-ONE-CORPUS-OUT)")
    print("=" * 90)

    corpora = load_corpora()
    for name, d in corpora.items():
        print(f"Loaded {name:<18}: {d['n_samples']:>5} samples, {d['n_speakers']:>3} speakers")

    all_names = ["TORGO", "EasyCall", "Italian_Parkinsons"]
    cv_all_records = []
    results = []

    # Prepare bootstrap draws for each target corpus
    target_bootstraps = {}
    for tgt_name in all_names:
        tgt_spks = corpora[tgt_name]["raw_spk"]
        u_spk = np.unique(tgt_spks)
        rng = np.random.RandomState(42)
        draws = [rng.choice(u_spk, size=len(u_spk), replace=True) for _ in range(N_BOOT)]
        masks = {s: np.where(tgt_spks == s)[0] for s in u_spk}
        target_bootstraps[tgt_name] = (u_spk, draws, masks)

    for tgt in all_names:
        sources = [s for s in all_names if s != tgt]
        s1, s2 = sources[0], sources[1]
        print(f"\n{'#' * 90}")
        print(f"TARGET CORPUS: {tgt} | MULTI-SOURCE TRAINING POOL: [{s1} + {s2}]")
        print(f"{'#' * 90}")

        u_spk, draws, spk_masks = target_bootstraps[tgt]
        X_tgt, y_tgt = corpora[tgt]["X"], corpora[tgt]["y"]

        # ---------------------------------------------------------
        # 1. Single-Source Baselines (from each source individually)
        # ---------------------------------------------------------
        single_baselines = {}
        for src in [s1, s2]:
            X_s, y_s, spk_s = corpora[src]["X"], corpora[src]["y"], corpora[src]["spk"]
            best_c_src, _, recs_s = run_inner_cv_selection(X_s, y_s, spk_s, f"Single_{src}")
            cv_all_records.extend(recs_s)

            scaler = StandardScaler()
            X_s_sc = scaler.fit_transform(X_s)
            X_t_sc = scaler.transform(X_tgt)

            clf = LinearSVC(C=best_c_src, dual=False, tol=1e-4, max_iter=2000, random_state=42)
            clf.fit(X_s_sc, y_s)
            p_s = clf.predict(X_t_sc)
            d_s = clf.decision_function(X_t_sc)

            b_obs, a_obs, ci_l, ci_h, boot_vec = compute_bootstrap_metrics(
                y_tgt, p_s, d_s, u_spk, draws, spk_masks
            )
            single_baselines[src] = {
                "bacc": b_obs,
                "auc": a_obs,
                "ci_low": ci_l,
                "ci_high": ci_h,
                "c": best_c_src,
                "boot_vec": boot_vec,
            }
            print(f"  [Single-Source Baseline] {src:<18} -> {tgt}: B-Acc = {b_obs*100:5.2f}% "
                  f"(95% CI: [{ci_l*100:4.1f}%, {ci_h*100:4.1f}%]), AUC = {a_obs:.4f} (C={best_c_src:.1e})")

        # Best single-source baseline for comparison
        best_single_name = max(single_baselines.keys(), key=lambda k: single_baselines[k]["bacc"])
        best_single = single_baselines[best_single_name]
        print(f"  --> Best Single Baseline: {best_single_name} ({best_single['bacc']*100:.2f}%)")

        # ---------------------------------------------------------
        # 2. Multi-Source Strategy A: Raw Pooled
        # ---------------------------------------------------------
        X_s1, y_s1, spk_s1 = corpora[s1]["X"], corpora[s1]["y"], corpora[s1]["spk"]
        X_s2, y_s2, spk_s2 = corpora[s2]["X"], corpora[s2]["y"], corpora[s2]["spk"]

        X_pool = np.vstack([X_s1, X_s2])
        y_pool = np.concatenate([y_s1, y_s2])
        spk_pool = np.concatenate([spk_s1, spk_s2])

        best_c_raw, _, recs_raw = run_inner_cv_selection(X_pool, y_pool, spk_pool, f"MultiRaw_{s1}+{s2}")
        cv_all_records.extend(recs_raw)

        scaler_raw = StandardScaler()
        X_pool_sc = scaler_raw.fit_transform(X_pool)
        X_tgt_sc_raw = scaler_raw.transform(X_tgt)

        clf_raw = LinearSVC(C=best_c_raw, dual=False, tol=1e-4, max_iter=2000, random_state=42)
        clf_raw.fit(X_pool_sc, y_pool)
        p_raw = clf_raw.predict(X_tgt_sc_raw)
        d_raw = clf_raw.decision_function(X_tgt_sc_raw)

        b_raw, a_raw, ci_l_raw, ci_h_raw, boot_raw = compute_bootstrap_metrics(
            y_tgt, p_raw, d_raw, u_spk, draws, spk_masks
        )

        delta_raw_vs_single = (b_raw - best_single["bacc"]) * 100
        delta_boot_raw = (boot_raw - best_single["boot_vec"]) * 100
        ci_d_raw = (np.percentile(delta_boot_raw, 2.5), np.percentile(delta_boot_raw, 97.5))

        print(f"\n  [Multi-Source Raw Pooled] [{s1}+{s2}] -> {tgt}:")
        print(f"    B-Acc: {b_raw*100:5.2f}% (95% CI: [{ci_l_raw*100:4.1f}%, {ci_h_raw*100:4.1f}%]) | AUC: {a_raw:.4f}")
        print(f"    Delta vs Best Single ({best_single_name}): {delta_raw_vs_single:+5.2f} pp "
              f"(95% CI: [{ci_d_raw[0]:+4.1f}%, {ci_d_raw[1]:+4.1f}%])")

        # ---------------------------------------------------------
        # 3. Multi-Source Strategy B: Domain-Standardized Pooled
        #    (Z-score normalize each domain separately to cancel mic/room offset)
        # ---------------------------------------------------------
        scaler_s1 = StandardScaler()
        scaler_s2 = StandardScaler()
        scaler_tgt = StandardScaler()

        X_s1_dom = scaler_s1.fit_transform(X_s1)
        X_s2_dom = scaler_s2.fit_transform(X_s2)
        X_pool_dom = np.vstack([X_s1_dom, X_s2_dom])
        X_tgt_dom = scaler_tgt.fit_transform(X_tgt)

        best_c_dom, _, recs_dom = run_inner_cv_selection(X_pool_dom, y_pool, spk_pool, f"MultiDom_{s1}+{s2}")
        cv_all_records.extend(recs_dom)

        clf_dom = LinearSVC(C=best_c_dom, dual=False, tol=1e-4, max_iter=2000, random_state=42)
        clf_dom.fit(X_pool_dom, y_pool)
        p_dom = clf_dom.predict(X_tgt_dom)
        d_dom = clf_dom.decision_function(X_tgt_dom)

        b_dom, a_dom, ci_l_dom, ci_h_dom, boot_dom = compute_bootstrap_metrics(
            y_tgt, p_dom, d_dom, u_spk, draws, spk_masks
        )

        delta_dom_vs_single = (b_dom - best_single["bacc"]) * 100
        delta_boot_dom = (boot_dom - best_single["boot_vec"]) * 100
        ci_d_dom = (np.percentile(delta_boot_dom, 2.5), np.percentile(delta_boot_dom, 97.5))

        print(f"\n  [Multi-Source Domain-Standardized] [{s1}+{s2}] -> {tgt}:")
        print(f"    B-Acc: {b_dom*100:5.2f}% (95% CI: [{ci_l_dom*100:4.1f}%, {ci_h_dom*100:4.1f}%]) | AUC: {a_dom:.4f}")
        print(f"    Delta vs Best Single ({best_single_name}): {delta_dom_vs_single:+5.2f} pp "
              f"(95% CI: [{ci_d_dom[0]:+4.1f}%, {ci_d_dom[1]:+4.1f}%])")

        # ---------------------------------------------------------
        # 4. Multi-Source Strategy C: Multi-Source CORAL Alignment
        #    Align pooled source covariance to target covariance
        # ---------------------------------------------------------
        X_pool_coral = coral_align(X_pool_sc, X_tgt_sc_raw, regularization=1e-3)

        clf_coral = LinearSVC(C=best_c_raw, dual=False, tol=1e-4, max_iter=2000, random_state=42)
        clf_coral.fit(X_pool_coral, y_pool)
        p_coral = clf_coral.predict(X_tgt_sc_raw)
        d_coral = clf_coral.decision_function(X_tgt_sc_raw)

        b_coral, a_coral, ci_l_coral, ci_h_coral, boot_coral = compute_bootstrap_metrics(
            y_tgt, p_coral, d_coral, u_spk, draws, spk_masks
        )

        delta_coral_vs_single = (b_coral - best_single["bacc"]) * 100
        delta_boot_coral = (boot_coral - best_single["boot_vec"]) * 100
        ci_d_coral = (np.percentile(delta_boot_coral, 2.5), np.percentile(delta_boot_coral, 97.5))

        print(f"\n  [Multi-Source CORAL-Aligned] [{s1}+{s2}] -> {tgt}:")
        print(f"    B-Acc: {b_coral*100:5.2f}% (95% CI: [{ci_l_coral*100:4.1f}%, {ci_h_coral*100:4.1f}%]) | AUC: {a_coral:.4f}")
        print(f"    Delta vs Best Single ({best_single_name}): {delta_coral_vs_single:+5.2f} pp "
              f"(95% CI: [{ci_d_coral[0]:+4.1f}%, {ci_d_coral[1]:+4.1f}%])")

        # Record results for table
        results.append({
            "target_corpus": tgt,
            "sources": f"{s1} + {s2}",
            "best_single_source": best_single_name,
            "best_single_bacc": round(best_single["bacc"] * 100, 2),
            "best_single_auc": round(best_single["auc"], 4),
            "multi_raw_bacc": round(b_raw * 100, 2),
            "multi_raw_auc": round(a_raw, 4),
            "multi_raw_ci95": f"[{ci_l_raw*100:.1f}%, {ci_h_raw*100:.1f}%]",
            "delta_raw_pp": round(delta_raw_vs_single, 2),
            "delta_raw_ci95": f"[{ci_d_raw[0]:+.1f}%, {ci_d_raw[1]:+.1f}%]",
            "multi_dom_bacc": round(b_dom * 100, 2),
            "multi_dom_auc": round(a_dom, 4),
            "multi_dom_ci95": f"[{ci_l_dom*100:.1f}%, {ci_h_dom*100:.1f}%]",
            "delta_dom_pp": round(delta_dom_vs_single, 2),
            "delta_dom_ci95": f"[{ci_d_dom[0]:+.1f}%, {ci_d_dom[1]:+.1f}%]",
            "multi_coral_bacc": round(b_coral * 100, 2),
            "multi_coral_auc": round(a_coral, 4),
            "multi_coral_ci95": f"[{ci_l_coral*100:.1f}%, {ci_h_coral*100:.1f}%]",
            "delta_coral_pp": round(delta_coral_vs_single, 2),
            "delta_coral_ci95": f"[{ci_d_coral[0]:+.1f}%, {ci_d_coral[1]:+.1f}%]",
        })

    # Save CSV outputs
    df_results = pd.DataFrame(results)
    out_table_path = os.path.join(TABLES_DIR, "task6_multisource_transfer.csv")
    df_results.to_csv(out_table_path, index=False)
    print(f"\nSaved authoritative multi-source benchmark table to: {out_table_path}")

    df_cv = pd.DataFrame(cv_all_records)
    out_cv_path = os.path.join(TABLES_DIR, "task6_multisource_inner_cv.csv")
    df_cv.to_csv(out_cv_path, index=False)
    print(f"Saved inner CV selection records to: {out_cv_path}")

    # Print summary table
    print("\n" + "=" * 90)
    print("FINAL BENCHMARK SUMMARY: MULTI-SOURCE GENERALIZATION")
    print("=" * 90)
    for r in results:
        print(f"Target: {r['target_corpus']:<18} | Sources: {r['sources']}")
        print(f"  Best Single Baseline: {r['best_single_source']} -> {r['best_single_bacc']:.2f}% (AUC {r['best_single_auc']:.3f})")
        print(f"  Multi-Source Raw:     {r['multi_raw_bacc']:.2f}% (Delta: {r['delta_raw_pp']:+5.2f} pp, CI: {r['delta_raw_ci95']})")
        print(f"  Multi-Source Dom-Std: {r['multi_dom_bacc']:.2f}% (Delta: {r['delta_dom_pp']:+5.2f} pp, CI: {r['delta_dom_ci95']})")
        print(f"  Multi-Source CORAL:   {r['multi_coral_bacc']:.2f}% (Delta: {r['delta_coral_pp']:+5.2f} pp, CI: {r['delta_coral_ci95']})")
        print("-" * 90)

    elapsed = time.time() - t0
    print(f"Experiment completed successfully in {elapsed:.1f} seconds.")


if __name__ == "__main__":
    main()
