"""Unit tests for src.coral."""

import unittest
import numpy as np

from src.coral import coral_align


class TestCoral(unittest.TestCase):
    def test_shape_preservation(self):
        """Verify output shape matches input source shape."""
        rng = np.random.default_rng(42)
        Xs = rng.normal(0, 1, size=(50, 20))
        Xt = rng.normal(2, 3, size=(80, 20))
        aligned = coral_align(Xs, Xt, regularization=1e-3)
        self.assertEqual(aligned.shape, Xs.shape)

    def test_identity_when_distributions_equal(self):
        """Verify alignment is approximately identity when source equals target."""
        rng = np.random.default_rng(42)
        X = rng.normal(1.0, 2.0, size=(100, 10))
        aligned = coral_align(X, X, regularization=1e-4)
        np.testing.assert_allclose(aligned, X, atol=1e-3)

    def test_mean_and_covariance_alignment(self):
        """Verify aligned source adopts target first and second-order statistics."""
        rng = np.random.default_rng(123)
        # Source: mean 0, variance 1
        Xs = rng.normal(loc=0.0, scale=1.0, size=(1000, 5))
        # Target: mean 5, variance 4
        Xt = rng.normal(loc=5.0, scale=2.0, size=(1000, 5))

        aligned = coral_align(Xs, Xt, regularization=1e-5)

        # Mean should shift from 0 to approximately 5
        np.testing.assert_allclose(np.mean(aligned, axis=0), np.mean(Xt, axis=0), atol=0.2)
        # Covariance diagonal should shift from 1 to approximately 4
        np.testing.assert_allclose(np.var(aligned, axis=0), np.var(Xt, axis=0), atol=0.3)


if __name__ == "__main__":
    unittest.main()
