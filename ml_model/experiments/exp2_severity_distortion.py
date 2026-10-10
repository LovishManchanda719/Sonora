"""
Experiment 2: Multi-Class Severity Transfer & CORAL Distortion (Task 2).
1. Evaluates cross-corpus severity transfer (EasyCall -> TORGO) across C in [1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1.0].
2. Tracks severe speaker voting distributions and majority predictions across C.
3. Evaluates severe speaker voting distributions across Layers 1, 4, and 12 under CORAL.
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
from sklearn.metrics import balanced_accuracy_score, confusion_matrix

from src.project_paths import TABLES_DIR, METADATA_CSV, EASYCALL_METADATA_CSV, get_layer_embedding_path
from src.data_loading import load_severity_data, REV_MAP
from src.coral import coral_align

C_SWEEP_SEV = [1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1.0]


def run_severity_c_sweep():
    print("=" * 80)
    print("EXP 2 - PART 1: SEVERITY CORAL TRANSFER ACROSS C SWEEP (EASYCALL -> TORGO)")
    print("=" * 80)

    (X_t, y_t, grp_t, meta_t), (X_e, y_e, grp_e, meta_e) = load_severity_data()

    severe_mask = (y_t == 2)
    severe_spks = sorted(list(np.unique(grp_t[severe_mask])))
    print(f"Identified {len(severe_spks)} severe TORGO speakers: {severe_spks}")

    scaler = StandardScaler()
    X_e_norm = scaler.fit_transform(X_e)
    X_t_norm = scaler.transform(X_t)
    X_e_coral = coral_align(X_e_norm, X_t_norm, regularization=1e-3)

    speaker_rows = []
    summary_rows = []

    for c_val in C_SWEEP_SEV:
        clf_r = LinearSVC(C=c_val, dual=False, tol=1e-4, max_iter=2000, random_state=42)
        clf_r.fit(X_e_norm, y_e)
        pred_r = clf_r.predict(X_t_norm)

        clf_c = LinearSVC(C=c_val, dual=False, tol=1e-4, max_iter=2000, random_state=42)
        clf_c.fit(X_e_coral, y_e)
        pred_c = clf_c.predict(X_t_norm)

        bacc_r = balanced_accuracy_score(y_t, pred_r)
        bacc_c = balanced_accuracy_score(y_t, pred_c)
        cm_r = confusion_matrix(y_t, pred_r, labels=[0, 1, 2])
        cm_c = confusion_matrix(y_t, pred_c, labels=[0, 1, 2])

        sens_sev_r = cm_r[2, 2] / cm_r[2].sum() if cm_r[2].sum() > 0 else 0.0
        sens_sev_c = cm_c[2, 2] / cm_c[2].sum() if cm_c[2].sum() > 0 else 0.0

        summary_rows.append({
            "C": c_val,
            "raw_bacc": round(bacc_r * 100, 2),
            "coral_bacc": round(bacc_c * 100, 2),
            "raw_sens_severe": round(sens_sev_r * 100, 2),
            "coral_sens_severe": round(sens_sev_c * 100, 2),
        })

        print(f"  C={c_val:<7.1e} | Raw Severe Recall: {sens_sev_r*100:5.2f}% | CORAL Severe Recall: {sens_sev_c*100:5.2f}%")

        for s in severe_spks:
            m = (grp_t == s)
            n_c = int(np.sum(m))
            v_r = [int(np.sum(pred_r[m] == 0)), int(np.sum(pred_r[m] == 1)), int(np.sum(pred_r[m] == 2))]
            v_c = [int(np.sum(pred_c[m] == 0)), int(np.sum(pred_c[m] == 1)), int(np.sum(pred_c[m] == 2))]
            lbls = ["mild", "moderate", "severe"]

            speaker_rows.append({
                "C": c_val,
                "speaker_id": s,
                "clips": n_c,
                "raw_pred": lbls[np.argmax(v_r)],
                "raw_votes_mild": v_r[0], "raw_votes_mod": v_r[1], "raw_votes_sev": v_r[2],
                "coral_pred": lbls[np.argmax(v_c)],
                "coral_votes_mild": v_c[0], "coral_votes_mod": v_c[1], "coral_votes_sev": v_c[2],
            })

    pd.DataFrame(summary_rows).to_csv(TABLES_DIR / "task2_severity_c_sweep_summary.csv", index=False)
    pd.DataFrame(speaker_rows).to_csv(TABLES_DIR / "task2_severity_c_sweep_speakers.csv", index=False)


def run_severe_speaker_votes_across_layers():
    print("\n" + "=" * 80)
    print("EXP 2 - PART 2: SEVERE TORGO SPEAKER VOTES ACROSS LAYERS 1, 4, 12 UNDER CORAL")
    print("=" * 80)

    (X_t_full, y_t, grp_t, meta_t), (X_e_full, y_e, grp_e, meta_e) = load_severity_data()
    severe_spks = ["F01", "M01", "M02", "M04"]

    df_t = pd.read_csv(METADATA_CSV)
    idx_t = df_t[(df_t["label"] == "dysarthric") & (df_t["severity_3class"].isin(["mild", "moderate", "severe"]))].index.values

    df_e = pd.read_csv(EASYCALL_METADATA_CSV)
    idx_e = df_e[(df_e["label"] == "dysarthric") & (df_e["severity_3class"].isin(["mild", "moderate", "severe"]))].index.values

    results = []

    for layer in [1, 4, 12]:
        emb_e = np.load(get_layer_embedding_path("EasyCall", layer))[idx_e]
        emb_t = np.load(get_layer_embedding_path("TORGO", layer))[idx_t]

        scaler = StandardScaler()
        X_e_norm = scaler.fit_transform(emb_e)
        X_t_norm = scaler.transform(emb_t)
        X_e_coral = coral_align(X_e_norm, X_t_norm, regularization=1e-3)

        clf_r = LinearSVC(C=0.01, dual=False, max_iter=2000, random_state=42)
        clf_r.fit(X_e_norm, y_e)
        pred_r = clf_r.predict(X_t_norm)

        clf_c = LinearSVC(C=0.01, dual=False, max_iter=2000, random_state=42)
        clf_c.fit(X_e_coral, y_e)
        pred_c = clf_c.predict(X_t_norm)

        for s in severe_spks:
            s_mask = (grp_t == s)
            n_c = int(np.sum(s_mask))

            r_mild, r_mod, r_sev = int(np.sum(pred_r[s_mask] == 0)), int(np.sum(pred_r[s_mask] == 1)), int(np.sum(pred_r[s_mask] == 2))
            c_mild, c_mod, c_sev = int(np.sum(pred_c[s_mask] == 0)), int(np.sum(pred_c[s_mask] == 1)), int(np.sum(pred_c[s_mask] == 2))

            r_pred = ["mild", "moderate", "severe"][np.argmax([r_mild, r_mod, r_sev])]
            c_pred = ["mild", "moderate", "severe"][np.argmax([c_mild, c_mod, c_sev])]

            results.append({
                "layer": layer,
                "speaker_id": s,
                "clips": n_c,
                "raw_pred": r_pred,
                "raw_votes_mild": r_mild, "raw_votes_mod": r_mod, "raw_votes_sev": r_sev,
                "coral_pred": c_pred,
                "coral_votes_mild": c_mild, "coral_votes_mod": c_mod, "coral_votes_sev": c_sev,
                "rerouted_to_mild": (c_pred == "mild"),
            })
            print(f"  Layer {layer:2d} | Speaker {s} | Raw: {r_pred} ({r_mild}/{r_mod}/{r_sev}) -> CORAL: {c_pred} ({c_mild}/{c_mod}/{c_sev})")

    out_csv = TABLES_DIR / "severe_torgo_coral_votes_across_layers.csv"
    pd.DataFrame(results).to_csv(out_csv, index=False)
    print(f"Saved severe speaker layer breakdown to: {out_csv}")


if __name__ == "__main__":
    t_start = time.time()
    run_severity_c_sweep()
    run_severe_speaker_votes_across_layers()
    print(f"\nExperiment 2 completed in {time.time()-t_start:.2f}s!")
