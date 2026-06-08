import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB5BreWUldOJhtCVEuy4O1V6eR0JDEDdLM",
  authDomain: "dreamsim-ea1ee.firebaseapp.com",
  projectId: "dreamsim-ea1ee",
  storageBucket: "dreamsim-ea1ee.firebasestorage.app",
  messagingSenderId: "1078538123947",
  appId: "1:1078538123947:web:e69136a6b291ed7b2b95ee",
  measurementId: "G-K7KX68MXQ6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
