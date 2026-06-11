import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import audioManager from '../engine/audioManager';

export default function AudioProvider({ children }) {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      audioManager.play();
    } else {
      audioManager.pause();
    }
  }, [!!user]);

  return children;
}
