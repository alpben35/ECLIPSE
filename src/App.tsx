/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Moon, Sun, BookOpen, BarChart2, MessageSquare, 
  Settings, LogOut, Menu, X, Mic, Send, 
  Upload, FileText, Plus, ChevronRight, Share2, Users, Search, Trash2,
  Lightbulb, CheckCircle2, XCircle, CreditCard, Award
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './lib/firebase';
import { RANKS, OWNER_EMAIL } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Contexts ---
const ThemeContext = createContext<{
  isDark: boolean;
  toggleTheme: () => void;
}>({ isDark: false, toggleTheme: () => {} });

export const AuthContext = createContext<{
  user: User | null;
  profile: any | null;
  loading: boolean;
  addXp: (amount: number) => Promise<void>;
  isOwner: boolean;
  maintenance: boolean;
}>({ user: null, profile: null, loading: true, addXp: async () => {}, isOwner: false, maintenance: false });

// --- Constants ---
// Moved to constants.ts

// --- Components ---
import TutorPage from './pages/TutorPage';
import ProgressPage from './pages/ProgressPage';
import LandingPage from './pages/LandingPage';
import AdminPage from './pages/AdminPage';
import IdeaPage from './pages/IdeaPage';
import RankPage from './pages/RankPage';
import AuthPage from './pages/AuthPage';

import StudentApp from './StudentApp';
import TeacherApp from '../eclipse-teacher/src/TeacherApp';

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const unsubscribeMaintenance = onSnapshot(doc(db, 'system', 'maintenance'), (doc) => {
      if (doc.exists()) {
        setMaintenance(doc.data().active || false);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            const newProfile = {
              uid: currentUser.uid,
              displayName: currentUser.displayName,
              email: currentUser.email,
              theme: isDark ? 'dark' : 'light',
              createdAt: new Date().toISOString(),
              xp: 0,
              level: 1,
              streak: 0,
              lastActive: new Date().toISOString(),
              rank: 'Welcome',
              loginDays: 1
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          } else {
            const data = userSnap.data();
            setIsDark(data.theme === 'dark');
            
            const today = new Date().toDateString();
            const lastActiveDate = data.lastActive ? new Date(data.lastActive) : null;
            const lastActive = lastActiveDate ? lastActiveDate.toDateString() : null;
            
            let updates: any = {};
            if (today !== lastActive) {
              const newLoginDays = (data.loginDays || 0) + 1;
              updates.lastActive = new Date().toISOString();
              updates.loginDays = newLoginDays;
              updates.streak = increment(1);

              const currentRankIndex = RANKS.findIndex(r => r.name === data.rank);
              const nextRank = RANKS.find((r, i) => i > currentRankIndex && newLoginDays >= r.minDays);
              if (nextRank && data.email !== OWNER_EMAIL) {
                updates.rank = nextRank.name;
              }
            }

            if (Object.keys(updates).length > 0) {
              await updateDoc(userRef, updates);
              setProfile({ ...data, ...updates });
            } else {
              setProfile(data);
            }

            // Sync to public_profiles
            const publicRef = doc(db, 'public_profiles', currentUser.uid);
            await setDoc(publicRef, {
              uid: currentUser.uid,
              displayName: data.displayName || currentUser.displayName || 'Anonymous',
              photoURL: data.photoURL || currentUser.photoURL || null,
              level: data.level || 1,
              rank: data.rank || 'Welcome',
              xp: data.xp || 0
            }, { merge: true });

            if (data.banned) {
              setIsBanned(true);
              await signOut(auth);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setUser(currentUser);
      setLoading(false);
    });
    return () => {
      unsubscribe();
      unsubscribeMaintenance();
    };
  }, []);

  const addXp = React.useCallback(async (amount: number) => {
    if (!user || !profile) return;
    const userRef = doc(db, 'users', user.uid);
    const newXp = (profile.xp || 0) + amount;
    const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;
    
    const updates: any = { xp: increment(amount) };
    if (newLevel > profile.level) {
      updates.level = newLevel;
    }
    
    try {
      await updateDoc(userRef, updates);
      setProfile((prev: any) => ({
        ...prev,
        xp: prev.xp + amount,
        level: Math.max(prev.level, newLevel)
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  }, [user, profile]);

  const toggleTheme = React.useCallback(() => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    if (user) {
      setDoc(doc(db, 'users', user.uid), { theme: newTheme ? 'dark' : 'light' }, { merge: true })
        .catch(error => handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`));
    }
  }, [isDark, user]);

  const authContextValue = React.useMemo(() => ({ 
    user, 
    profile, 
    loading, 
    addXp,
    maintenance,
    isOwner: profile?.email === OWNER_EMAIL || profile?.rank === 'Owner' || profile?.rank === 'Temporary Owner'
  }), [user, profile, loading, addXp, maintenance]);

  const themeContextValue = React.useMemo(() => ({ 
    isDark, 
    toggleTheme 
  }), [isDark, toggleTheme]);

  const isOwner = profile?.email === OWNER_EMAIL || profile?.rank === 'Owner' || profile?.rank === 'Temporary Owner';

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-black">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-12 h-12 rounded-full border-4 border-black dark:border-white border-t-transparent"
        />
      </div>
    );
  }

  if (isBanned) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-4 text-center">
        <div className="max-w-md space-y-8">
          <div className="w-24 h-24 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto">
            <XCircle className="text-red-500" size={48} />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tighter text-black dark:text-white italic uppercase">Account Banned</h1>
            <p className="opacity-60 leading-relaxed">
              Your account has been suspended for violating our terms of service. 
              If you believe this is a mistake, please contact support.
            </p>
          </div>
          <div className="pt-8">
            <button 
              onClick={() => setIsBanned(false)}
              className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (maintenance && !isOwner && !location.pathname.startsWith('/teacher') && location.pathname !== '/auth') {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-4 text-center">
        <div className="max-w-md space-y-8">
          <div className="w-24 h-24 bg-black/5 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto animate-pulse">
            <Settings className="text-black dark:text-white" size={48} />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tighter text-black dark:text-white italic uppercase">System Maintenance</h1>
            <p className="opacity-60 leading-relaxed">
              Eclipse AI is currently undergoing scheduled maintenance to improve your experience. 
              We'll be back online shortly.
            </p>
          </div>
          <div className="pt-8">
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform"
            >
              Check Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isTeacherPath = location.pathname.startsWith('/teacher');

  return (
    <AuthContext.Provider value={authContextValue}>
      <ThemeContext.Provider value={themeContextValue}>
        <ErrorBoundary>
          <Routes>
            <Route path="/teacher/*" element={<TeacherApp />} />
            <Route path="/*" element={<StudentApp />} />
          </Routes>
        </ErrorBoundary>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}

export { ThemeContext };

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let displayError = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) displayError = `Firestore Error: ${parsed.error} (${parsed.operationType} on ${parsed.path})`;
      } catch (e) {
        displayError = this.state.error.message || String(this.state.error);
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-white dark:bg-black text-black dark:text-white">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <X className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Application Error</h1>
          <p className="opacity-50 max-w-md mb-8">{displayError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, profile } = useContext(AuthContext);
  const location = useLocation();
  
  if (!user) {
    if (location.pathname.startsWith('/teacher')) {
      return <Navigate to="/teacher/auth" />;
    }
    return <Navigate to="/auth" />;
  }
  
  const isOwner = profile?.email === OWNER_EMAIL || profile?.rank === 'Owner';
  const isTempOwner = profile?.rank === 'Temporary Owner';
  
  if (adminOnly && !isOwner && !isTempOwner) return <Navigate to="/tutor" />;
  return <>{children}</>;
}

