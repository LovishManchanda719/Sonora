"""Correlation Alignment (CORAL) for unsupervised domain adaptation."""

import numpy as np
import scipy.linalg


def coral_align(
    source_features: np.ndarray,
    target_features: np.ndarray,
    regularization: float = 1e-3,
) -> np.ndarray:
    """
    Applies regularized Correlation Alignment (CORAL) to adapt source features
    to the statistical distribution of the target domain.

    Whitens the source domain covariance and re-colors with target covariance:
        C_S = Cov(X_S) + lambda * I
        C_T = Cov(X_T) + lambda * I
        X_S_aligned = (X_S - mu_S) * C_S^(-1/2) * C_T^(1/2) + mu_T

    Tikhonov regularization (lambda * I) prevents numerical instability and
    singular matrix inversion when feature dimensions (768-D) exceed or approach
    effective sample size in smaller subsets.

    Parameters:
    - source_features: Array of shape (N_s, D)
    - target_features: Array of shape (N_t, D)
    - regularization: Tikhonov shrinkage term (default 1e-3)

    Returns:
    - Aligned source features of shape (N_s, D)
    """
    Xs = np.asarray(source_features, dtype=np.float64)
    Xt = np.asarray(target_features, dtype=np.float64)

    Ns, D = Xs.shape
    Nt, _ = Xt.shape

    # Mean centering
    mu_s = np.mean(Xs, axis=0, keepdims=True)
    mu_t = np.mean(Xt, axis=0, keepdims=True)

    Xs_centered = Xs - mu_s
    Xt_centered = Xt - mu_t

    # Covariances with Tikhonov regularization
    eye = np.eye(D, dtype=np.float64)
    Cs = (Xs_centered.T @ Xs_centered) / (Ns - 1) + regularization * eye
    Ct = (Xt_centered.T @ Xt_centered) / (Nt - 1) + regularization * eye

    # Fractional matrix powers via Schur decomposition (scipy.linalg.fractional_matrix_power)
    # C_S^(-1/2) whitening operator
    Cs_inv_sqrt = scipy.linalg.fractional_matrix_power(Cs, -0.5)
    # C_T^(1/2) re-coloring operator
    Ct_sqrt = scipy.linalg.fractional_matrix_power(Ct, 0.5)

    # Transform: Xs_aligned = Xs_centered @ Cs^(-1/2) @ Ct^(1/2) + mu_t
    # Take real part in case of tiny numerical imaginary artifacts
    transformation_matrix = np.real(Cs_inv_sqrt @ Ct_sqrt)
    Xs_aligned = np.real(Xs_centered @ transformation_matrix) + mu_t

    return Xs_aligned.astype(source_features.dtype)
