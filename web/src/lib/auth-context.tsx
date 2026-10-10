"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updatePassword,
  linkWithPopup,
  linkWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import {
  ADMIN_EMAIL,
  clearLocalScreenings,
  getUserProfilePhoto,
  saveUserProfilePhoto,
} from "./firestore";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  profilePhotoUrl: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  updateUserPassword: (newPass: string) => Promise<void>;
  linkGoogleAccount: () => Promise<void>;
  updateUserPhoto: (photoDataUrl: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  profilePhotoUrl: null,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  updateUserPassword: async () => {},
  linkGoogleAccount: async () => {},
  updateUserPhoto: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const storedPhoto = await getUserProfilePhoto(currentUser.uid);
        setProfilePhotoUrl(storedPhoto || currentUser.photoURL || null);
      } else {
        setProfilePhotoUrl(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = Boolean(
    user?.email && user.email.trim().toLowerCase() === ADMIN_EMAIL
  );

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  const updateUserPassword = async (newPass: string) => {
    if (!auth.currentUser) {
      throw new Error("Please sign in to set or update your password.");
    }
    const currentUser = auth.currentUser;
    const hasPasswordProvider = currentUser.providerData.some(
      (p) => p.providerId === "password"
    );

    if (!hasPasswordProvider && currentUser.email) {
      try {
        const credential = EmailAuthProvider.credential(
          currentUser.email,
          newPass
        );
        await linkWithCredential(currentUser, credential);
        return;
      } catch {
        // Fallback to direct updatePassword
      }
    }
    await updatePassword(currentUser, newPass);
  };

  const linkGoogleAccount = async () => {
    if (!auth.currentUser) {
      await signInWithPopup(auth, googleProvider);
      return;
    }
    try {
      await linkWithPopup(auth.currentUser, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (
        code === "auth/credential-already-in-use" ||
        code === "auth/email-already-in-use" ||
        code === "auth/provider-already-linked"
      ) {
        await signInWithPopup(auth, googleProvider);
      } else {
        throw err;
      }
    }
  };

  const updateUserPhoto = async (photoDataUrl: string) => {
    if (!auth.currentUser) {
      throw new Error("Please sign in to save your profile picture.");
    }
    setProfilePhotoUrl(photoDataUrl);
    await saveUserProfilePhoto(
      auth.currentUser.uid,
      photoDataUrl,
      auth.currentUser.email
    );
  };

  const signOut = async () => {
    clearLocalScreenings(auth.currentUser?.uid);
    setProfilePhotoUrl(null);
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        profilePhotoUrl,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        updateUserPassword,
        linkGoogleAccount,
        updateUserPhoto,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
