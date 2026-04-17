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
import { db, auth, handleFirestoreError, OperationType, decryptData } from './lib/firebase';
import { RANKS, OWNER_EMAIL } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { ThemeContext, AuthContext } from './lib/contexts';
import { ProtectedRoute } from './components/ProtectedRoute';

// --- Constants ---
// Moved to constants.ts

// --- Components ---
const TutorPage = React.lazy(() => import('./pages/TutorPage'));
const ProgressPage = React.lazy(() => import('./pages/ProgressPage'));
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const IdeaPage = React.lazy(() => import('./pages/IdeaPage'));
const RankPage = React.lazy(() => import('./pages/RankPage'));
const AuthPage = React.lazy(() => import('./pages/AuthPage'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const SubscriptionPage = React.lazy(() => import('./pages/SubscriptionPage'));
const TeacherApp = React.lazy(() => import('../eclipse-teacher/src/TeacherApp'));
const StudentApp = React.lazy(() => import('./StudentApp'));
import SplashScreen from './components/PWA/SplashScreen';
import AddToHomeScreen from './components/PWA/AddToHomeScreen';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const isOnline = useOnlineStatus();
  const location = useLocation();

  useEffect(() => {
    // Hide splash screen after 1.5 seconds
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);
    
    // Safety timeout: ensure loading is turned off after 8 seconds no matter what
    const loadingTimer = setTimeout(() => {
      setLoading(current => {
        if (current) {
          console.warn("Auth initialization timed out. Forcing loading to false.");
          return false;
        }
        return current;
      });
    }, 8000);

    return () => {
      clearTimeout(splashTimer);
      clearTimeout(loadingTimer);
    };
  }, []);

  useEffect(() => {
    const unsubscribeMaintenance = onSnapshot(doc(db, 'system', 'maintenance'), (doc) => {
      if (doc.exists()) {
        setMaintenance(doc.data().active || false);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'system/maintenance'));

    return () => unsubscribeMaintenance();
  }, []);

  useEffect(() => {
    console.log("Setting up auth listener...");
    let profileUnsubscribe: (() => void) | null = null;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed. User:", currentUser?.uid, "Email:", currentUser?.email);
      
      // Cleanup previous profile listener
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      try {
        if (currentUser) {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            console.log("No user profile found. Creating new profile...");
            const userData = {
              uid: currentUser.uid,
              displayName: currentUser.displayName || 'Anonymous',
              email: currentUser.email,
              theme: isDark ? 'dark' : 'light',
              createdAt: new Date().toISOString(),
              xp: 0,
              level: 1,
              streak: 0,
              lastActive: new Date().toISOString(),
              rank: currentUser.email === OWNER_EMAIL ? 'Owner' : 'Free Student',
              loginDays: 1,
              tier: currentUser.email === OWNER_EMAIL ? 'admin' : 'free',
              promptsToday: 0,
              lastPromptDate: new Date().toISOString().split('T')[0],
              consents: {
                microphone: true,
                camera: true
              }
            };
            await setDoc(userRef, userData);
            console.log("New profile created.");
          }

          // Start real-time listener for profile
          profileUnsubscribe = onSnapshot(userRef, async (docSnap) => {
            if (docSnap.exists()) {
              let userData = docSnap.data();
              console.log("Profile update received. Rank:", userData.rank, "Tier:", userData.tier);
              
              const today = new Date().toISOString().split('T')[0];
              const updates: any = {};
              
              if (currentUser.email === OWNER_EMAIL) {
                if (userData.rank !== 'Owner') updates.rank = 'Owner';
                if (userData.tier !== 'admin') updates.tier = 'admin';
              }
              
              if (userData.lastPromptDate !== today) {
                updates.promptsToday = 0;
                updates.lastPromptDate = today;
              }

              if (Object.keys(updates).length > 0) {
                await updateDoc(userRef, updates);
                // The next snapshot will trigger with updated data
                return;
              }

              if (userData.phone) userData.phone = decryptData(userData.phone);
              setProfile(userData);

              // Update public profile logic
              const publicRef = doc(db, 'public_profiles', currentUser.uid);
              const displayName = userData.displayName || currentUser.displayName || 'Anonymous';
              await setDoc(publicRef, {
                uid: currentUser.uid,
                displayName: displayName,
                displayName_lowercase: displayName.toLowerCase(),
                photoURL: userData.photoURL || currentUser.photoURL || null,
                level: userData.level || 1,
                rank: userData.rank || 'Student',
                xp: userData.xp || 0
              }, { merge: true });

              if (userData.banned) {
                setIsBanned(true);
                await signOut(auth);
              }
            }
          }, (err) => {
            console.error("Profile sync error:", err);
          });
        } else {
          setProfile(null);
        }
        setUser(currentUser);
        setError(null);
      } catch (err: any) {
        console.error("Auth initialization error:", err);
        setError(`Auth Error: ${err.message || "Failed to initialize"}`);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, [isDark]);

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

  const isAdmin = (profile?.email === OWNER_EMAIL || user?.email === OWNER_EMAIL || user?.uid === 'GTk39aFMkFTSARasXr2F4XgdtMM2') || 
                  profile?.rank === 'Owner' || 
                  profile?.rank === 'Temporary Owner' || 
                  profile?.rank === 'Admin';

  const authContextValue = React.useMemo(() => ({ 
    user, 
    profile, 
    loading, 
    addXp,
    maintenance,
    isOwner: profile?.email === OWNER_EMAIL || profile?.rank === 'Owner',
    isAdmin
  }), [user, profile, loading, addXp, maintenance, isAdmin]);

  const themeContextValue = React.useMemo(() => ({ 
    isDark, 
    toggleTheme 
  }), [isDark, toggleTheme]);

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

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-4 text-center">
        <div className="max-w-md space-y-8">
          <div className="w-24 h-24 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto">
            <XCircle className="text-red-500" size={48} />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tighter text-black dark:text-white italic uppercase">Access Denied</h1>
            <p className="opacity-60 leading-relaxed font-mono text-xs">
              {error}
            </p>
          </div>
          <div className="pt-8 flex flex-col gap-4">
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform"
            >
              Retry Connection
            </button>
            <button 
              onClick={() => signOut(auth)}
              className="px-8 py-3 text-sm font-bold opacity-50 hover:opacity-100 transition-opacity"
            >
              Sign Out
            </button>
          </div>
        </div>
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

  if (maintenance && !isAdmin && !location.pathname.startsWith('/teacher') && location.pathname !== '/auth') {
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
          <div className="pt-8 flex flex-col gap-4">
            <Link 
              to="/auth"
              className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform"
            >
              Admin Sign In
            </Link>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 text-sm font-bold opacity-50 hover:opacity-100 transition-opacity"
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
        <AnimatePresence mode="wait">
          {showSplash && <SplashScreen key="splash" />}
        </AnimatePresence>

        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ y: -100 }}
              animate={{ y: 0 }}
              exit={{ y: -100 }}
              className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white py-2 px-4 flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest shadow-lg"
            >
              <WifiOff size={14} />
              <span>You are offline. AI features are unavailable.</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        <ErrorBoundary>
          <React.Suspense fallback={
            <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-black">
              <div className="w-12 h-12 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <Routes>
              <Route path="/teacher/*" element={<TeacherApp />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/*" element={<StudentApp />} />
            </Routes>
          </React.Suspense>
        </ErrorBoundary>

        <AddToHomeScreen />
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



