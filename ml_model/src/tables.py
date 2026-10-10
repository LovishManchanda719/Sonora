"""
Manuscript Table Formatter for DysarthriaNet-XC.
Extracts and formats all tables directly from verified CSV artifacts in results/:
- Table 1: Cross-Corpus Transfer Deltas Across Layers (Layers 1, 4, 12).
- Table 2: Nested vs. Fixed Layer 12 Paired Outer-Fold Comparison.
- Table 3: Severe Speaker Vote Tallies Across Layers Under CORAL Adaptation.
- Table 4: Italian Parkinson's (IPVS) Cohort by Recording Date Summary.
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.project_paths import RESULTS_DIR, TABLES_DIR


def _find_csv(filename: str) -> Path:
    """Find CSV in TABLES_DIR or RESULTS_DIR."""
    p = TABLES_DIR / filename
    return p if p.exists() else RESULTS_DIR / filename


def format_table_1() -> str:
    """Format Table 1: Cross-Corpus Transfer Deltas Across Layers."""
    csv_path = _find_csv("cross_corpus_transfer_layers_1_4_12.csv")
    if not csv_path.exists():
        return f"Error: {csv_path} not found."
    df = pd.read_csv(csv_path)

    lines = []
    lines.append("| Layer | Source | Target | Raw B-Acc (%) | CORAL B-Acc (%) | CORAL Delta (pp) | Raw AUC | CORAL AUC | Raw Sens (%) | CORAL Sens (%) | Raw Spec (%) | CORAL Spec (%) |")
    lines.append("| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")

    for _, r in df.iterrows():
        lines.append(
            f"| {int(r['layer']):2d} | {r['source']} | {r['target']} | {r['raw_bacc']:.2f}% | {r['coral_bacc']:.2f}% | {r['delta_pp']:+.2f} pp | {r['raw_auc']:.4f} | {r['coral_auc']:.4f} | {r['raw_sens']:.2f}% | {r['coral_sens']:.2f}% | {r['raw_spec']:.2f}% | {r['coral_spec']:.2f}% |"
        )
    return "\n".join(lines)


def format_table_2() -> str:
    """Format Table 2: Nested vs Fixed Layer 12 Paired Folds."""
    csv_path = _find_csv("nested_vs_fixed_paired_folds.csv")
    if not csv_path.exists():
        return f"Error: {csv_path} not found."
    df = pd.read_csv(csv_path)

    lines = []
    lines.append("| Corpus | Fold | Fixed L12 B-Acc (%) | Selected Layer | Nested B-Acc (%) | Paired Difference (pp) |")
    lines.append("| :--- | :---: | :---: | :---: | :---: | :---: |")

    for _, r in df.iterrows():
        lines.append(
            f"| {r['corpus']} | {int(r['fold'])} | {r['fixed_l12_bacc']:.2f}% | Layer {int(r['selected_layer']):2d} | {r['nested_bacc']:.2f}% | {r['paired_diff_pp']:+.2f} pp |"
        )
    lines.append("\n**Fold-Average Summary (Mean +/- Sample SD, ddof=1):**")
    lines.append("| Corpus | Mean Fixed L12 (%) | Mean Nested (%) | Paired Difference (pp) |")
    lines.append("| :--- | :---: | :---: | :---: |")
    for corpus, grp in df.groupby("corpus", sort=False):
        m_fix = grp["fixed_l12_bacc"].mean()
        s_fix = grp["fixed_l12_bacc"].std()
        m_nest = grp["nested_bacc"].mean()
        s_nest = grp["nested_bacc"].std()
        m_diff = grp["paired_diff_pp"].mean()
        s_diff = grp["paired_diff_pp"].std()
        lines.append(f"| {corpus} | {m_fix:.2f}% +/- {s_fix:.2f}% | {m_nest:.2f}% +/- {s_nest:.2f}% | {m_diff:+.2f} pp +/- {s_diff:.2f} pp |")

    return "\n".join(lines)


def format_table_3() -> str:
    """Format Table 3: Severe Speaker CORAL Votes Across Layers."""
    csv_path = _find_csv("severe_torgo_coral_votes_across_layers.csv")
    if not csv_path.exists():
        return f"Error: {csv_path} not found."
    df = pd.read_csv(csv_path)

    lines = []
    lines.append("| Speaker | Layer | Total Clips | Raw Mild | Raw Mod | Raw Sev | Raw Pred | CORAL Mild | CORAL Mod | CORAL Sev | CORAL Pred | Clinical Shift |")
    lines.append("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |")

    for _, r in df.iterrows():
        shift = "Moderate -> Mild" if r["raw_pred"].lower() == "moderate" and r["coral_pred"].lower() == "mild" else f"{r['raw_pred']} -> {r['coral_pred']}"
        lines.append(
            f"| {r['speaker_id']} | {int(r['layer']):2d} | {int(r['clips'])} | {int(r['raw_votes_mild'])} | {int(r['raw_votes_mod'])} | {int(r['raw_votes_sev'])} | **{r['raw_pred'].capitalize()}** | {int(r['coral_votes_mild'])} | {int(r['coral_votes_mod'])} | {int(r['coral_votes_sev'])} | **{r['coral_pred'].capitalize()}** | {shift} |"
        )
    return "\n".join(lines)


def format_table_4() -> str:
    """Format Table 4: IPVS Cohort by Date Summary."""
    csv_path = _find_csv("ipvs_cohort_by_date_table.csv")
    if not csv_path.exists():
        return f"Error: {csv_path} not found."
    df = pd.read_csv(csv_path)

    lines = []
    lines.append("| Cohort | Speakers | Total Clips | Min Date | Max Date | Year Distribution | Filename Digit Format |")
    lines.append("| :--- | :---: | :---: | :---: | :---: | :--- | :--- |")

    for _, r in df.iterrows():
        lines.append(
            f"| {r['cohort']} | {int(r['speakers'])} | {int(r['clips'])} | {r['min_date']} | {r['max_date']} | {r['years']} | {r['digit_format']} |"
        )
    return "\n".join(lines)


def print_all_tables():
    """Prints all formatted manuscript tables."""
    print("=== TABLE 1: CROSS-CORPUS TRANSFER ACROSS LAYERS ===")
    print(format_table_1())
    print("\n=== TABLE 2: NESTED VS FIXED PAIRED FOLD ANALYSIS ===")
    print(format_table_2())
    print("\n=== TABLE 3: SEVERE SPEAKER CORAL VOTES ACROSS LAYERS ===")
    print(format_table_3())
    print("\n=== TABLE 4: IPVS COHORT BY DATE SUMMARY ===")
    print(format_table_4())


if __name__ == "__main__":
    print_all_tables()
