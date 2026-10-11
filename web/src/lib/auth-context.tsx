"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
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
  updateProfile,
} from "firebase/auth";
import { useSession, useUser, useDescope } from "@descope/nextjs-sdk/client";
import { auth, googleProvider } from "./firebase";
import {
  ADMIN_EMAIL,
  clearLocalScreenings,
  getUserProfilePhoto,
  saveUserProfilePhoto,
} from "./firestore";

export type AuthProviderType = "google" | "password" | "phone";

export interface LinkedIdentityInfo {
  uid: string;
  phoneKey: string;
  formattedPhone: string;
  linkedEmail: string;
  googleLinked: boolean;
  hasCustomPassword: boolean;
}

export function isInternalPhoneEmail(email?: string | null): boolean {
  return Boolean(
    email &&
      email.startsWith("phone_") &&
      email.endsWith("@sonora.speech.ai")
  );
}

export function formatUserIdentifier(
  email?: string | null,
  displayName?: string | null,
  linkedIdentity?: LinkedIdentityInfo | null
): string {
  if (
    linkedIdentity?.linkedEmail &&
    !isInternalPhoneEmail(linkedIdentity.linkedEmail)
  ) {
    return linkedIdentity.linkedEmail;
  }
  if (isInternalPhoneEmail(email)) {
    if (linkedIdentity?.formattedPhone) {
      return linkedIdentity.formattedPhone;
    }
    const digits = (email || "")
      .replace("phone_", "")
      .replace("@sonora.speech.ai", "");
    if (digits.startsWith("91") && digits.length === 12) {
      const ten = digits.slice(2);
      return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
    }
    return `+${digits}`;
  }
  return displayName || email || "";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  authProvider: AuthProviderType | null;
  linkedIdentity: LinkedIdentityInfo | null;
  profilePhotoUrl: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  signInWithPhoneVerified: (
    firebaseEmail: string,
    firebasePassword: string,
    formattedDisplay: string,
    mobileNumber?: string
  ) => Promise<void>;
  updateUserPassword: (newPass: string, linkedEmail?: string) => Promise<void>;
  linkGoogleAccount: () => Promise<void>;
  linkPhoneWithOtp: (
    countryCode: string,
    mobileNumber: string,
    code: string
  ) => Promise<void>;
  refreshIdentityLinks: () => Promise<void>;
  updateUserPhoto: (photoDataUrl: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  authProvider: null,
  linkedIdentity: null,
  profilePhotoUrl: null,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signInWithPhoneVerified: async () => {},
  updateUserPassword: async () => {},
  linkGoogleAccount: async () => {},
  linkPhoneWithOtp: async () => {},
  refreshIdentityLinks: async () => {},
  updateUserPhoto: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firebaseLoading, setFirebaseLoading] = useState(true);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [linkedIdentity, setLinkedIdentity] =
    useState<LinkedIdentityInfo | null>(null);

  const { isAuthenticated: isDescopeAuth, isSessionLoading } = useSession();
  const { user: descopeUser, isUserLoading } = useUser();
  const descopeSdk = useDescope();

  const fetchIdentityLink = useCallback(async (uid: string) => {
    try {
      const res = await fetch(
        `/api/auth/otp?uid=${encodeURIComponent(uid)}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setLinkedIdentity(data.identityLink || null);
      }
    } catch {
      // ignore offline error
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);
      if (currentUser) {
        const storedPhoto = await getUserProfilePhoto(currentUser.uid);
        setProfilePhotoUrl(storedPhoto || currentUser.photoURL || null);
        void fetchIdentityLink(currentUser.uid);
      } else {
        setProfilePhotoUrl(null);
        setLinkedIdentity(null);
      }
      setFirebaseLoading(false);
    });
    return () => unsubscribe();
  }, [fetchIdentityLink]);

  const descopeMappedUser: User | null =
    !firebaseUser && isDescopeAuth && descopeUser
      ? ({
          uid: descopeUser.userId || "descope_user",
          email:
            descopeUser.email ||
            (descopeUser.phone
              ? `phone_${descopeUser.phone.replace(/\D/g, "")}@sonora.speech.ai`
              : ""),
          displayName:
            descopeUser.name || descopeUser.phone || "Signed-In User",
          phoneNumber: descopeUser.phone || null,
          photoURL: descopeUser.picture || null,
          providerData: [{ providerId: "phone" }],
        } as unknown as User)
      : null;

  const user = firebaseUser || descopeMappedUser;
  const loading = firebaseLoading && (isSessionLoading || isUserLoading);

  const authProvider: AuthProviderType | null = user
    ? isInternalPhoneEmail(user.email) ||
      user.providerData?.some((p) => p.providerId === "phone")
      ? "phone"
      : user.providerData?.some((p) => p.providerId === "google.com")
      ? "google"
      : "password"
    : null;

  const effectiveEmail = (
    linkedIdentity?.linkedEmail ||
    user?.email ||
    ""
  )
    .trim()
    .toLowerCase();
  const isAdmin = Boolean(
    effectiveEmail === ADMIN_EMAIL ||
      (user?.email && user.email.trim().toLowerCase() === ADMIN_EMAIL)
  );

  const syncIdentityOnServer = async (payload: {
    uid: string;
    mobileNumber?: string;
    firebaseAuthEmail?: string;
    plainFirebasePassword?: string;
    linkedEmail?: string;
    googleLinked?: boolean;
    hasCustomPassword?: boolean;
  }) => {
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_identity",
          ...payload,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.identityLink) {
          setLinkedIdentity(data.identityLink);
        }
      }
    } catch {
      // ignore network error
    }
  };

  const refreshIdentityLinks = async () => {
    if (user?.uid) {
      await fetchIdentityLink(user.uid);
    }
  };

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    await syncIdentityOnServer({
      uid: cred.user.uid,
      firebaseAuthEmail: cred.user.email || undefined,
      linkedEmail: cred.user.email || undefined,
      googleLinked: true,
    });
  };

  const signInWithEmail = async (email: string, pass: string) => {
    let targetEmail = email.trim();
    // Permutation A1: Check if this email was linked to a Phone-originated Firebase account
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve_email",
          linkedEmail: targetEmail,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.firebaseAuthEmail) {
          targetEmail = data.firebaseAuthEmail;
        }
      }
    } catch {
      // fallback to raw email
    }

    const cred = await signInWithEmailAndPassword(auth, targetEmail, pass);
    await syncIdentityOnServer({
      uid: cred.user.uid,
      firebaseAuthEmail: cred.user.email || targetEmail,
      plainFirebasePassword: pass,
      linkedEmail: !isInternalPhoneEmail(email) ? email.trim() : undefined,
      hasCustomPassword: true,
    });
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    await syncIdentityOnServer({
      uid: cred.user.uid,
      firebaseAuthEmail: cred.user.email || email.trim(),
      plainFirebasePassword: pass,
      linkedEmail: email.trim(),
      hasCustomPassword: true,
    });
  };

  const signInWithPhoneVerified = async (
    firebaseEmail: string,
    firebasePassword: string,
    formattedDisplay: string,
    mobileNumber?: string
  ) => {
    let signedInUser: User;
    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        firebaseEmail,
        firebasePassword
      );
      signedInUser = cred.user;
      if (!cred.user.displayName && formattedDisplay) {
        await updateProfile(cred.user, { displayName: formattedDisplay });
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (
        code === "auth/user-not-found" ||
        code === "auth/invalid-credential" ||
        code === "auth/invalid-login-credentials"
      ) {
        const cred = await createUserWithEmailAndPassword(
          auth,
          firebaseEmail,
          firebasePassword
        );
        signedInUser = cred.user;
        if (formattedDisplay) {
          await updateProfile(cred.user, { displayName: formattedDisplay });
        }
      } else {
        throw err;
      }
    }

    const extractedMobile =
      mobileNumber ||
      (isInternalPhoneEmail(firebaseEmail)
        ? firebaseEmail
            .replace("phone_91", "")
            .replace("phone_", "")
            .replace("@sonora.speech.ai", "")
        : undefined);

    await syncIdentityOnServer({
      uid: signedInUser.uid,
      mobileNumber: extractedMobile,
      firebaseAuthEmail: signedInUser.email || firebaseEmail,
      plainFirebasePassword: firebasePassword,
    });
  };

  const updateUserPassword = async (newPass: string, customEmail?: string) => {
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
      } catch {
        await updatePassword(currentUser, newPass);
      }
    } else {
      await updatePassword(currentUser, newPass);
    }

    const cleanCustomEmail = (
      customEmail ||
      (!isInternalPhoneEmail(currentUser.email) ? currentUser.email : "") ||
      ""
    ).trim();

    await syncIdentityOnServer({
      uid: currentUser.uid,
      firebaseAuthEmail: currentUser.email || undefined,
      plainFirebasePassword: newPass,
      linkedEmail: cleanCustomEmail || undefined,
      hasCustomPassword: true,
    });
  };

  const linkGoogleAccount = async () => {
    if (!auth.currentUser) {
      await signInWithGoogle();
      return;
    }
    const prevEmail = auth.currentUser.email;
    try {
      const cred = await linkWithPopup(auth.currentUser, googleProvider);
      await syncIdentityOnServer({
        uid: cred.user.uid,
        firebaseAuthEmail: prevEmail || cred.user.email || undefined,
        linkedEmail: cred.user.email || undefined,
        googleLinked: true,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (
        code === "auth/credential-already-in-use" ||
        code === "auth/email-already-in-use" ||
        code === "auth/provider-already-linked"
      ) {
        const cred = await signInWithPopup(auth, googleProvider);
        await syncIdentityOnServer({
          uid: cred.user.uid,
          firebaseAuthEmail: cred.user.email || undefined,
          linkedEmail: cred.user.email || undefined,
          googleLinked: true,
        });
      } else {
        throw err;
      }
    }
  };

  const linkPhoneWithOtp = async (
    countryCode: string,
    mobileNumber: string,
    code: string
  ) => {
    if (!auth.currentUser) {
      throw new Error("Please sign in first to link a mobile number.");
    }
    const currentUser = auth.currentUser;
    const isGoogleConnected = currentUser.providerData.some(
      (p) => p.providerId === "google.com"
    );

    const res = await fetch("/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "link_phone",
        uid: currentUser.uid,
        countryCode,
        mobileNumber,
        code,
        firebaseAuthEmail: currentUser.email || "",
        linkedEmail: !isInternalPhoneEmail(currentUser.email)
          ? currentUser.email || ""
          : linkedIdentity?.linkedEmail || "",
        googleLinked: isGoogleConnected || linkedIdentity?.googleLinked,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to verify and link phone number.");
    }

    // Permutation B3: If Google-only user doesn't have a password provider yet, link bridgePassword
    const hasPasswordProvider = currentUser.providerData.some(
      (p) => p.providerId === "password"
    );
    if (!hasPasswordProvider && currentUser.email && data.bridgePassword) {
      try {
        const credential = EmailAuthProvider.credential(
          currentUser.email,
          data.bridgePassword
        );
        await linkWithCredential(currentUser, credential);
      } catch {
        // Ignore if already linked
      }
    }

    if (data.identityLink) {
      setLinkedIdentity(data.identityLink);
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
    clearLocalScreenings(user?.uid);
    setProfilePhotoUrl(null);
    setLinkedIdentity(null);
    if (isDescopeAuth && descopeSdk?.logout) {
      try {
        await descopeSdk.logout();
      } catch {
        // ignore Descope logout error
      }
    }
    if (auth.currentUser) {
      await firebaseSignOut(auth);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        authProvider,
        linkedIdentity,
        profilePhotoUrl,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signInWithPhoneVerified,
        updateUserPassword,
        linkGoogleAccount,
        linkPhoneWithOtp,
        refreshIdentityLinks,
        updateUserPhoto,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
