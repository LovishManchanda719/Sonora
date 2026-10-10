"""
Publication-Quality Visualization Suite for DysarthriaNet-XC.
Generates:
1. Figure 1: Cross-Corpus Transfer Deltas Across Wav2Vec 2.0 Layers (Layers 1, 4, 12).
2. Figure 2: Severe TORGO Speaker Re-Routing Under CORAL Across Layers.
3. Figure 3: Italian Parkinson's (IPVS) Recording Timeline and Cohort Distribution.
4. Transfer Heatmap: 3x3 Cross-Corpus Transfer Matrix with CORAL Adaptation Deltas.
"""

import os
import sys
import re
from pathlib import Path
from datetime import datetime
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import seaborn as sns

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.project_paths import RESULTS_DIR, FIGURES_DIR, TABLES_DIR, PARKINSONS_METADATA_CSV, CROSS_CORPUS_RESULTS_CSV

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.size": 11,
    "axes.labelsize": 12,
    "axes.titlesize": 13,
    "xtick.labelsize": 10,
    "ytick.labelsize": 10,
    "legend.fontsize": 10,
    "figure.titlesize": 14,
})


def _find_csv(filename: str) -> Path:
    """Find CSV in TABLES_DIR or RESULTS_DIR."""
    p = TABLES_DIR / filename
    return p if p.exists() else RESULTS_DIR / filename


def plot_figure1_layer_deltas():
    """Figure 1: Cross-Corpus Transfer Deltas Across Layers."""
    csv_path = _find_csv("cross_corpus_transfer_layers_1_4_12.csv")
    if not csv_path.exists():
        print(f"Skipping Figure 1: {csv_path} not found.")
        return
    df = pd.read_csv(csv_path)

    pairs = [
        ("TORGO", "EasyCall"),
        ("TORGO", "Italian_Parkinsons"),
        ("EasyCall", "TORGO"),
        ("EasyCall", "Italian_Parkinsons"),
        ("Italian_Parkinsons", "TORGO"),
        ("Italian_Parkinsons", "EasyCall"),
    ]

    pair_labels = [
        "TORGO -> EasyCall",
        "TORGO -> IPVS",
        "EasyCall -> TORGO",
        "EasyCall -> IPVS",
        "IPVS -> TORGO",
        "IPVS -> EasyCall",
    ]

    fig, ax = plt.subplots(figsize=(11, 5.5), dpi=300)
    x = np.arange(len(pairs))
    width = 0.25

    layers = [1, 4, 12]
    colors = ["#2b5c8f", "#d95f02", "#7570b3"]
    labels = ["Layer 1 (Early Acoustic)", "Layer 4 (Intermediate)", "Layer 12 (Primary Final Layer)"]

    for i, (layer, col, lbl) in enumerate(zip(layers, colors, labels)):
        sub = df[df["layer"] == layer].copy()
        deltas = []
        for src, tgt in pairs:
            r = sub[(sub["source"] == src) & (sub["target"] == tgt)]
            deltas.append(r["delta_pp"].iloc[0] if len(r) > 0 else 0.0)

        rects = ax.bar(x + (i - 1) * width, deltas, width, label=lbl, color=col, alpha=0.9, edgecolor="black", linewidth=0.6)

        for rect in rects:
            h = rect.get_height()
            va = "bottom" if h >= 0 else "top"
            ax.annotate(f"{h:+.1f}",
                        xy=(rect.get_x() + rect.get_width() / 2, h),
                        xytext=(0, 3 if h >= 0 else -3),
                        textcoords="offset points",
                        ha="center", va=va, fontsize=8, fontweight="bold")

    ax.axhline(0, color="black", linestyle="--", linewidth=0.8, alpha=0.7)
    ax.set_ylabel("CORAL Adaptation Delta (pp, Balanced Accuracy)")
    ax.set_title("Cross-Corpus Domain Adaptation Effect Across Wav2Vec 2.0 Layers (C=0.01)")
    ax.set_xticks(x)
    ax.set_xticklabels(pair_labels, rotation=15, ha="right", fontweight="medium")
    ax.legend(frameon=True, facecolor="white", edgecolor="none")
    ax.grid(axis="y", linestyle=":", alpha=0.6)

    plt.tight_layout()
    out_png = FIGURES_DIR / "figure1_cross_corpus_layer_deltas.png"
    plt.savefig(out_png)
    plt.close()
    print(f"Saved Figure 1 to: {out_png}")


def plot_figure2_severe_rerouting():
    """Figure 2: Severe TORGO Speaker Re-Routing Under CORAL Across Layers."""
    csv_path = _find_csv("severe_torgo_coral_votes_across_layers.csv")
    if not csv_path.exists():
        print(f"Skipping Figure 2: {csv_path} not found.")
        return
    df = pd.read_csv(csv_path)

    speakers = ["F01", "M01", "M02", "M04"]
    layers = [1, 4, 12]

    fig, axes = plt.subplots(len(speakers), len(layers), figsize=(12, 10), sharey=True, dpi=300)

    for i, spk in enumerate(speakers):
        for j, lay in enumerate(layers):
            ax = axes[i, j]
            row = df[(df["speaker_id"] == spk) & (df["layer"] == lay)]
            if len(row) == 0:
                continue
            r = row.iloc[0]
            n_clips = r["clips"]

            raw_pcts = [r["raw_votes_mild"] / n_clips * 100,
                        r["raw_votes_mod"] / n_clips * 100,
                        r["raw_votes_sev"] / n_clips * 100]

            coral_pcts = [r["coral_votes_mild"] / n_clips * 100,
                          r["coral_votes_mod"] / n_clips * 100,
                          r["coral_votes_sev"] / n_clips * 100]

            x_indices = np.arange(3)
            bar_w = 0.35

            ax.bar(x_indices - bar_w/2, raw_pcts, bar_w, label="Raw Zero-Shot", color="#4393c3", edgecolor="black", linewidth=0.5)
            ax.bar(x_indices + bar_w/2, coral_pcts, bar_w, label="CORAL Adapted", color="#d6604d", edgecolor="black", linewidth=0.5)

            ax.set_xticks(x_indices)
            ax.set_xticklabels(["Mild", "Mod", "Severe"], fontsize=9)
            ax.set_ylim(0, 105)
            ax.grid(axis="y", linestyle=":", alpha=0.5)

            if i == 0:
                ax.set_title(f"Layer {lay}", fontweight="bold", pad=8)
            if j == 0:
                ax.set_ylabel(f"{spk} ({n_clips} clips)\nVote Share (%)", fontweight="medium")

            if i == 0 and j == len(layers) - 1:
                ax.legend(loc="upper right", frameon=True, facecolor="white", fontsize=8)

            coral_mild_pct = coral_pcts[0]
            ax.annotate(f"Mild: {coral_mild_pct:.1f}%",
                        xy=(0 + bar_w/2, coral_mild_pct),
                        xytext=(0, 4), textcoords="offset points",
                        ha="center", fontsize=7.5, fontweight="bold", color="#b2182b")

    plt.suptitle("Clinical Re-Routing: Severe TORGO Speakers Classified as 'Mild' Under CORAL (EasyCall -> TORGO)", y=0.995, weight="bold")
    plt.tight_layout()
    out_png = FIGURES_DIR / "figure2_severe_speaker_coral_rerouting.png"
    plt.savefig(out_png)
    plt.close()
    print(f"Saved Figure 2 to: {out_png}")


def plot_figure3_ipvs_timeline():
    """Figure 3: Italian Parkinson's (IPVS) Recording Timeline and Cohort Distribution."""
    if not PARKINSONS_METADATA_CSV.exists():
        print(f"Skipping Figure 3: {PARKINSONS_METADATA_CSV} not found.")
        return
    df = pd.read_csv(PARKINSONS_METADATA_CSV)

    parsed_dates = []
    cohorts = []

    for _, row in df.iterrows():
        p = Path(row["file_path"]).stem.rstrip(".")
        m = re.search(r"[0-9]{2}([MF])([0-9]+)$", p, re.IGNORECASE)
        if m:
            digits = m.group(2)
            if len(digits) == 10:
                dd, mm, yy = int(digits[0:2]), int(digits[2:4]), int(digits[4:6]) + 2000
                parsed_dates.append(datetime(yy, mm, dd))
                cohorts.append(row["cohort"])
            elif len(digits) == 12:
                dd, mm, yy = int(digits[0:2]), int(digits[2:4]), int(digits[4:8])
                parsed_dates.append(datetime(yy, mm, dd))
                cohorts.append(row["cohort"])

    time_df = pd.DataFrame({"date": parsed_dates, "cohort": cohorts})

    cohort_order = [
        "28 People with Parkinson's disease",
        "15 Young Healthy Control",
        "22 Elderly Healthy Control",
    ]
    cohort_display = {
        "28 People with Parkinson's disease": "Parkinson's Disease (N=28 spk, 437 clips)",
        "15 Young Healthy Control": "Young Healthy Controls (N=15 spk, 45 clips)",
        "22 Elderly Healthy Control": "Elderly Healthy Controls (N=22 spk, 349 clips)",
    }
    cohort_colors = {
        "28 People with Parkinson's disease": "#d95f02",
        "15 Young Healthy Control": "#7570b3",
        "22 Elderly Healthy Control": "#1b9e77",
    }

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(11, 7), sharex=True, gridspec_kw={"height_ratios": [1.5, 2]}, dpi=300)

    for idx, c in enumerate(cohort_order):
        sub = time_df[time_df["cohort"] == c]
        jitter = np.random.uniform(-0.15, 0.15, size=len(sub))
        ax1.scatter(sub["date"], [idx] + jitter, color=cohort_colors[c], alpha=0.5, s=25, edgecolor="none")

    ax1.axvline(datetime(2017, 3, 1), color="black", linestyle="--", linewidth=1.5, label="March 1, 2017 Decision Boundary")
    ax1.set_yticks(range(len(cohort_order)))
    ax1.set_yticklabels([cohort_display[c] for c in cohort_order], fontweight="medium")
    ax1.set_title("A. Individual Recording Dates per Clinical Cohort", pad=10)
    ax1.grid(axis="x", linestyle=":", alpha=0.6)
    ax1.legend(loc="upper left", frameon=True, facecolor="white")

    time_df["year_month"] = time_df["date"].apply(lambda d: datetime(d.year, d.month, 1))
    hist_data = time_df.groupby(["year_month", "cohort"]).size().unstack(fill_value=0)

    for c in cohort_order:
        if c not in hist_data.columns:
            hist_data[c] = 0
    hist_data = hist_data[cohort_order]

    bottom = np.zeros(len(hist_data))
    dates_num = mdates.date2num(hist_data.index.to_pydatetime())
    width = 20

    for c in cohort_order:
        counts = hist_data[c].values
        ax2.bar(dates_num, counts, width, bottom=bottom, label=cohort_display[c], color=cohort_colors[c], edgecolor="black", linewidth=0.5)
        bottom += counts

    ax2.axvline(datetime(2017, 3, 1), color="black", linestyle="--", linewidth=1.5)
    ax2.set_title("B. Monthly Audio Clip Ingestion Volume", pad=10)
    ax2.set_ylabel("Audio Clips Recorded")
    ax2.set_xlabel("Recording Date")
    ax2.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    ax2.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    plt.xticks(rotation=20, ha="right")
    ax2.legend(loc="upper left", frameon=True, facecolor="white")
    ax2.grid(axis="y", linestyle=":", alpha=0.6)

    fig.text(0.5, 0.50, "Complete Separation: All Parkinson's recordings ended by Feb 10, 2017;\nall Elderly Controls were recorded from March 17, 2017 onwards.",
             ha="center", va="center", fontsize=9.5, fontweight="bold",
             bbox=dict(boxstyle="round,pad=0.5", facecolor="#fff2cc", edgecolor="#d6b656"))

    plt.suptitle("Italian Parkinson's Voice Corpus (IPVS): Recording Timeline & Temporal Collinearity", y=0.995, weight="bold")
    plt.tight_layout()
    out_png = FIGURES_DIR / "figure3_ipvs_temporal_confound.png"
    plt.savefig(out_png)
    plt.close()
    print(f"Saved Figure 3 to: {out_png}")


def plot_transfer_heatmap():
    """3x3 Cross-Corpus Transfer Matrix Heatmap with Within-Corpus Diagonals."""
    if not CROSS_CORPUS_RESULTS_CSV.exists():
        print(f"Skipping 3x3 Heatmap: {CROSS_CORPUS_RESULTS_CSV} not found.")
        return
    df = pd.read_csv(CROSS_CORPUS_RESULTS_CSV)

    corpora = ["TORGO", "EasyCall", "Italian_Parkinsons"]
    corpus_labels = {
        "TORGO": "TORGO (EN)",
        "EasyCall": "EasyCall (IT)",
        "Italian_Parkinsons": "IPVS (IT)",
    }

    fig, axes = plt.subplots(1, 2, figsize=(15, 6), sharey=True, dpi=300)
    mat_raw = np.zeros((3, 3))
    mat_coral = np.zeros((3, 3))
    mat_diff = np.zeros((3, 3))

    for i, src in enumerate(corpora):
        for j, tgt in enumerate(corpora):
            if src == tgt:
                val = df[(df["train_corpus"] == src) & (df["test_corpus"] == tgt) & (df["evaluation_mode"] == "Within-Corpus")]["balanced_accuracy"].values[0]
                mat_raw[i, j] = val * 100
                mat_coral[i, j] = val * 100
            else:
                val_raw = df[(df["train_corpus"] == src) & (df["test_corpus"] == tgt) & (df["adaptation"].str.contains("Raw"))]["balanced_accuracy"].values[0]
                val_coral = df[(df["train_corpus"] == src) & (df["test_corpus"] == tgt) & (df["adaptation"].str.contains("CORAL"))]["balanced_accuracy"].values[0]
                mat_raw[i, j] = val_raw * 100
                mat_coral[i, j] = val_coral * 100
                mat_diff[i, j] = (val_coral - val_raw) * 100

    labels = [corpus_labels[c] for c in corpora]
    cmap = sns.color_palette("mako", as_cmap=True)
    vmin, vmax = 40, 90

    sns.heatmap(mat_raw, ax=axes[0], annot=True, fmt=".1f", cmap=cmap, vmin=vmin, vmax=vmax,
                cbar=False, xticklabels=labels, yticklabels=labels, annot_kws={"size": 13, "weight": "bold"})
    axes[0].set_title("A. Raw Transfer (Zero-Shot)\nDiagonal = Within-Corpus 5-Fold SGKF", pad=12)
    axes[0].set_xlabel("Target Corpus (Evaluation)")
    axes[0].set_ylabel("Source Corpus (Training)")

    im = sns.heatmap(mat_coral, ax=axes[1], annot=True, fmt=".1f", cmap=cmap, vmin=vmin, vmax=vmax,
                     cbar=False, xticklabels=labels, yticklabels=labels, annot_kws={"size": 13, "weight": "bold"})
    axes[1].set_title("B. Domain-Adapted Transfer (CORAL)\nRegularized Covariance Alignment", pad=12)
    axes[1].set_xlabel("Target Corpus (Evaluation)")

    for i in range(3):
        for j in range(3):
            if i != j:
                delta = mat_diff[i, j]
                sign = "+" if delta >= 0 else ""
                color = "#00e676" if delta > 0 else "#ff5252"
                axes[1].text(j + 0.5, i + 0.75, f"({sign}{delta:.1f}%)", ha="center", va="center",
                             color=color, fontsize=10, weight="semibold")

    cbar_ax = fig.add_axes((0.92, 0.2, 0.02, 0.6))
    cbar = fig.colorbar(axes[1].collections[0], cax=cbar_ax)
    cbar.set_label("Balanced Accuracy (%)", rotation=270, labelpad=18)

    plt.suptitle("Cross-Corpus Transfer Matrix: Wav2Vec 2.0 Base + Linear Margin Classifier", y=1.02, weight="bold")
    out_png = FIGURES_DIR / "cross_corpus_3x3_heatmap.png"
    fig.savefig(out_png, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved 3x3 Heatmap to: {out_png}")


def generate_all_figures():
    """Generates all manuscript publication figures."""
    print("=" * 80)
    print("GENERATING ALL PUBLICATION FIGURES (300 DPI)")
    print("=" * 80)
    plot_figure1_layer_deltas()
    plot_figure2_severe_rerouting()
    plot_figure3_ipvs_timeline()
    plot_transfer_heatmap()
    print("All publication figures successfully created in results/!")


if __name__ == "__main__":
    generate_all_figures()
