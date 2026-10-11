import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

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

export default app;
