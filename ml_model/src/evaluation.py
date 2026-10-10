"""Evaluation utilities for speaker-independent cross-validation and metrics."""

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
    classification_report,
)
from sklearn.model_selection import StratifiedGroupKFold


def evaluate_speaker_independent(
    pipeline,
    X,
    y,
    groups,
    n_splits: int = 5,
    labels: list | None = None,
    random_state: int = 42,
) -> dict:
    """
    Performs speaker-independent cross-validation using StratifiedGroupKFold.

    Ensures that recordings from the same speaker never appear in both
    training and test sets simultaneously, while preserving balanced class
    proportions (control vs dysarthric) across every fold.

    Parameters:
    - pipeline: Scikit-learn estimator or Pipeline
    - X: Feature matrix (DataFrame or 2D array)
    - y: Ground truth labels (Series or 1D array)
    - groups: Speaker IDs (Series or 1D array)
    - n_splits: Number of speaker folds (default 5)
    - labels: Target label order for confusion matrix (default sorted unique y)
    - random_state: Seed for reproducible fold assignments (default 42)

    Returns:
    - Dict with aggregated metrics, fold-level scores, and confusion matrix.
    """
    X_arr = np.array(X)
    y_arr = np.array(y)
    groups_arr = np.array(groups)

    if labels is None:
        labels = sorted(list(pd.Series(y_arr).unique()))

    sgkf = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=random_state)

    all_y_true = []
    all_y_pred = []
    fold_accuracies = []
    fold_macro_f1s = []

    for fold_idx, (train_idx, test_idx) in enumerate(sgkf.split(X_arr, y_arr, groups=groups_arr)):
        X_train, X_test = X_arr[train_idx], X_arr[test_idx]
        y_train, y_test = y_arr[train_idx], y_arr[test_idx]

        pipeline.fit(X_train, y_train)
        preds = pipeline.predict(X_test)

        all_y_true.extend(y_test)
        all_y_pred.extend(preds)

        fold_acc = float(accuracy_score(y_test, preds))
        p, r, fold_f1, _ = precision_recall_fscore_support(
            y_test, preds, average="macro", zero_division=0
        )
        fold_accuracies.append(fold_acc)
        fold_macro_f1s.append(float(fold_f1))

    all_y_true_arr = np.array(all_y_true)
    all_y_pred_arr = np.array(all_y_pred)

    overall_acc = float(accuracy_score(all_y_true_arr, all_y_pred_arr))
    macro_p, macro_r, macro_f1, _ = precision_recall_fscore_support(
        all_y_true_arr, all_y_pred_arr, average="macro", zero_division=0
    )
    weighted_p, weighted_r, weighted_f1, _ = precision_recall_fscore_support(
        all_y_true_arr, all_y_pred_arr, average="weighted", zero_division=0
    )
    cm = confusion_matrix(all_y_true_arr, all_y_pred_arr, labels=labels)
    report_dict = classification_report(
        all_y_true_arr, all_y_pred_arr, target_names=labels, output_dict=True, zero_division=0
    )

    return {
        "accuracy": overall_acc,
        "macro_precision": float(macro_p),
        "macro_recall": float(macro_r),
        "macro_f1": float(macro_f1),
        "weighted_f1": float(weighted_f1),
        "fold_accuracies": fold_accuracies,
        "fold_accuracies_std": float(np.std(np.array(fold_accuracies))),
        "fold_macro_f1s": fold_macro_f1s,
        "confusion_matrix": cm,
        "labels": labels,
        "report_dict": report_dict,
        "y_true": all_y_true_arr,
        "y_pred": all_y_pred_arr,
    }
