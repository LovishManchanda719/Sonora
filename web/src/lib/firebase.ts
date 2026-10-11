import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDd4ElwFoZ46NzcmLZoR0VUYqGFZDfyBX0",
  authDomain: "dysarthia-detector.firebaseapp.com",
  projectId: "dysarthia-detector",
  storageBucket: "dysarthia-detector.firebasestorage.app",
  messagingSenderId: "84888531802",
  appId: "1:84888531802:web:e95bd4beee8a7291407963",
};

// Initialize Firebase (singleton pattern across Next.js reloads)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();
facebookProvider.addScope("email");
facebookProvider.addScope("public_profile");

// Facebook app used by Firebase Auth (Meta app "Sonora"). Public value.
export const FACEBOOK_APP_ID = "1617146723541803";
export default app;
