import { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, updateProfile
} from 'firebase/auth';
import { getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { userDoc } from '../lib/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(userDoc(firebaseUser.uid));
        const data = snap.exists() ? snap.data() : {};
        setUser({
          id: firebaseUser.uid,
          username: firebaseUser.email?.split('@')[0] || '',
          email: firebaseUser.email,
          displayName: data.displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0],
          isPremium: data.isPremium || false,
          avatar: data.avatar || null,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await setDoc(userDoc(cred.user.uid), {
      displayName: displayName || email.split('@')[0],
      email,
      isPremium: false,
      createdAt: new Date().toISOString(),
    });
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
