"""
Experiment 3: Layer Representation & Paired Nested Cross-Validation (Task 3).
1. Evaluates within-corpus binary detection across Wav2Vec 2.0 Layers 1, 4, 7, 12.
2. Evaluates strictly nested inner-CV layer selection vs fixed Layer 12 on identical outer folds.
3. Evaluates 3x3 directional cross-corpus transfer deltas across Layers 1, 4, and 12.
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

from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import LinearSVC
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.metrics import balanced_accuracy_score, roc_auc_score

from src.project_paths import (
    DATA_DIR,
    TABLES_DIR,
    METADATA_CSV,
    EASYCALL_METADATA_CSV,
    PARKINSONS_METADATA_CSV,
    get_layer_embedding_path,
)
from src.coral import coral_align
from src.evaluation import evaluate_speaker_independent

LAYERS = [1, 4, 7, 12]


def load_all_corpora():
    corpora = {}
    for name, m_csv in [
        ("TORGO", METADATA_CSV),
        ("EasyCall", EASYCALL_METADATA_CSV),
        ("Italian_Parkinsons", PARKINSONS_METADATA_CSV),
    ]:
        df = pd.read_csv(m_csv)
        y = (df["label"].str.lower() == "dysarthric").astype(int).to_numpy()
        spk = df["speaker_id"].to_numpy()
        embs = {l: np.load(get_layer_embedding_path(name, l)) for l in LAYERS}
        corpora[name] = {"df": df, "y": y, "spk": spk, "embs": embs}
    return corpora


def run_nested_vs_fixed_paired_folds(corpora):
    print("=" * 80)
    print("EXP 3 - PART 1: NESTED VS FIXED LAYER-12 EVALUATION (IDENTICAL OUTER FOLDS)")
    print("=" * 80)

    all_fold_rows = []

    for name in ["TORGO", "EasyCall", "Italian_Parkinsons"]:
        data = corpora[name]
        y = data["y"]
        spk = data["spk"]
        embs = data["embs"]

        outer_cv = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
        fold_l12 = []
        fold_nested = []
        fold_best_l = []

        for tr_idx, te_idx in outer_cv.split(embs[12], y, spk):
            # Fixed L12
            scaler12 = StandardScaler()
            X_tr12 = scaler12.fit_transform(embs[12][tr_idx])
            X_te12 = scaler12.transform(embs[12][te_idx])
            clf12 = LinearSVC(C=0.01, dual=False, tol=1e-2, max_iter=2000, random_state=42)
            clf12.fit(X_tr12, y[tr_idx])
            bacc12 = balanced_accuracy_score(y[te_idx], clf12.predict(X_te12))
            fold_l12.append(bacc12)

            # Nested layer selection on training fold only
            inner_cv = StratifiedGroupKFold(n_splits=3, shuffle=True, random_state=42)
            inner_scores = {}
            for l in LAYERS:
                X_l = embs[l][tr_idx]
                scores_l = []
                for in_tr, in_val in inner_cv.split(X_l, y[tr_idx], spk[tr_idx]):
                    s_in = StandardScaler()
                    X_in_tr = s_in.fit_transform(X_l[in_tr])
                    X_in_val = s_in.transform(X_l[in_val])
                    c_in = LinearSVC(C=0.01, dual=False, tol=1e-2, max_iter=2000, random_state=42)
                    c_in.fit(X_in_tr, y[tr_idx][in_tr])
                    scores_l.append(balanced_accuracy_score(y[tr_idx][in_val], c_in.predict(X_in_val)))
                inner_scores[l] = np.mean(scores_l)

            best_l = max(inner_scores.keys(), key=lambda k: inner_scores[k])
            fold_best_l.append(best_l)

            # Train on outer train with best_l
            scaler_nest = StandardScaler()
            X_tr_nest = scaler_nest.fit_transform(embs[best_l][tr_idx])
            X_te_nest = scaler_nest.transform(embs[best_l][te_idx])
            clf_nest = LinearSVC(C=0.01, dual=False, tol=1e-2, max_iter=2000, random_state=42)
            clf_nest.fit(X_tr_nest, y[tr_idx])
            bacc_nest = balanced_accuracy_score(y[te_idx], clf_nest.predict(X_te_nest))
            fold_nested.append(bacc_nest)

        diffs = [n - f for n, f in zip(fold_nested, fold_l12)]
        print(f"\n=== {name} ===")
        for i in range(5):
            print(f"  Fold {i+1}: Fixed L12 = {fold_l12[i]*100:5.2f}%, Nested (Layer {fold_best_l[i]:2d}) = {fold_nested[i]*100:5.2f}%, Paired Diff = {diffs[i]*100:+5.2f} pp")
            all_fold_rows.append({
                "corpus": name,
                "fold": i + 1,
                "fixed_l12_bacc": round(fold_l12[i] * 100, 2),
                "selected_layer": int(fold_best_l[i]),
                "nested_bacc": round(fold_nested[i] * 100, 2),
                "paired_diff_pp": round(diffs[i] * 100, 2),
            })

        m_fix = np.mean(fold_l12) * 100
        s_fix = np.std(fold_l12, ddof=1) * 100
        m_nest = np.mean(fold_nested) * 100
        s_nest = np.std(fold_nested, ddof=1) * 100
        m_diff = np.mean(diffs) * 100
        s_diff = np.std(diffs, ddof=1) * 100
        print(f"  Mean Fixed: {m_fix:5.2f}% +/- {s_fix:4.2f}% | Mean Nested: {m_nest:5.2f}% +/- {s_nest:4.2f}% | Paired Diff: {m_diff:+5.2f} pp +/- {s_diff:4.2f} pp")

    out_csv = TABLES_DIR / "nested_vs_fixed_paired_folds.csv"
    pd.DataFrame(all_fold_rows).to_csv(out_csv, index=False)
    print(f"Saved paired fold differences to: {out_csv}")


def run_cross_corpus_transfer_layers(corpora):
    print("\n" + "=" * 80)
    print("EXP 3 - PART 2: 3x3 CROSS-CORPUS TRANSFER ACROSS LAYERS 1, 4, 12 (C=0.01)")
    print("=" * 80)

    pairs = [
        ("TORGO", "EasyCall"),
        ("TORGO", "Italian_Parkinsons"),
        ("EasyCall", "TORGO"),
        ("EasyCall", "Italian_Parkinsons"),
        ("Italian_Parkinsons", "TORGO"),
        ("Italian_Parkinsons", "EasyCall"),
    ]

    results = []

    for l in [1, 4, 12]:
        for src, tgt in pairs:
            X_s = corpora[src]["embs"][l]
            y_s = corpora[src]["y"]
            X_t = corpora[tgt]["embs"][l]
            y_t = corpora[tgt]["y"]

            scaler = StandardScaler()
            X_s_norm = scaler.fit_transform(X_s)
            X_t_norm = scaler.transform(X_t)
            X_s_coral = coral_align(X_s_norm, X_t_norm, regularization=1e-3)

            clf_r = LinearSVC(C=0.01, dual=False, max_iter=2000, random_state=42)
            clf_r.fit(X_s_norm, y_s)
            pred_r = clf_r.predict(X_t_norm)
            score_r = clf_r.decision_function(X_t_norm)

            clf_c = LinearSVC(C=0.01, dual=False, max_iter=2000, random_state=42)
            clf_c.fit(X_s_coral, y_s)
            pred_c = clf_c.predict(X_t_norm)
            score_c = clf_c.decision_function(X_t_norm)

            bacc_r = balanced_accuracy_score(y_t, pred_r)
            bacc_c = balanced_accuracy_score(y_t, pred_c)
            auc_r = roc_auc_score(y_t, score_r)
            auc_c = roc_auc_score(y_t, score_c)

            sens_r = float(np.sum((y_t == 1) & (pred_r == 1)) / np.sum(y_t == 1))
            spec_r = float(np.sum((y_t == 0) & (pred_r == 0)) / np.sum(y_t == 0))
            sens_c = float(np.sum((y_t == 1) & (pred_c == 1)) / np.sum(y_t == 1))
            spec_c = float(np.sum((y_t == 0) & (pred_c == 0)) / np.sum(y_t == 0))

            delta = (bacc_c - bacc_r) * 100

            results.append({
                "layer": l,
                "source": src,
                "target": tgt,
                "raw_bacc": round(bacc_r * 100, 2),
                "coral_bacc": round(bacc_c * 100, 2),
                "delta_pp": round(delta, 2),
                "raw_auc": round(auc_r, 4),
                "coral_auc": round(auc_c, 4),
                "raw_sens": round(sens_r * 100, 2),
                "coral_sens": round(sens_c * 100, 2),
                "raw_spec": round(spec_r * 100, 2),
                "coral_spec": round(spec_c * 100, 2),
            })
            print(f"  Layer {l:2d} | {src:<18} -> {tgt:<18} | Raw: {bacc_r*100:5.2f}% -> CORAL: {bacc_c*100:5.2f}% | Delta: {delta:+5.2f} pp")

    out_csv = TABLES_DIR / "cross_corpus_transfer_layers_1_4_12.csv"
    pd.DataFrame(results).to_csv(out_csv, index=False)
    print(f"Saved layer transfer deltas to: {out_csv}")


if __name__ == "__main__":
    t_start = time.time()
    corpora = load_all_corpora()
    run_nested_vs_fixed_paired_folds(corpora)
    run_cross_corpus_transfer_layers(corpora)
    print(f"\nExperiment 3 completed in {time.time()-t_start:.2f}s!")
