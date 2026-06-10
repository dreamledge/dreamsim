import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB5BreWUldOJhtCVEuy4O1V6eR0JDEDdLM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dreamsim-ea1ee.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dreamsim-ea1ee",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dreamsim-ea1ee.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1078538123947",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1078538123947:web:e69136a6b291ed7b2b95ee",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-K7KX68MXQ6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
