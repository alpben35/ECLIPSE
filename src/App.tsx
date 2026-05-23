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
  Lightbulb, CheckCircle2, XCircle, CreditCard, Award,
  Loader2, WifiOff
} from 'lucide-react';
import { onAuthStateChanged, signOut, User, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment, onSnapshot, query, where, collection, getDocs } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, decryptData } from './lib/firebase';
import { RANKS, OWNER_EMAIL } from './constants';
import Logo from './components/ui/Logo';

import { cn } from './lib/utils';
import { ThemeContext, AuthContext } from './lib/contexts';
import { ProtectedRoute } from './components/ProtectedRoute';

// --- Constants ---
// Moved to constants.ts

// --- Components ---
const TutorPage = React.lazy(() => import('@/pages/TutorPage'));
const ProgressPage = React.lazy(() => import('@/pages/ProgressPage'));
const LandingPage = React.lazy(() => import('@/pages/LandingPage'));
const AdminPage = React.lazy(() => import('@/pages/AdminPage'));
const IdeaPage = React.lazy(() => import('@/pages/IdeaPage'));
const RankPage = React.lazy(() => import('@/pages/RankPage'));
const AuthPage = React.lazy(() => import('@/pages/AuthPage'));
const PrivacyPolicy = React.lazy(() => import('@/pages/PrivacyPolicy'));
const SubscriptionPage = React.lazy(() => import('@/pages/SubscriptionPage'));
const TeacherApp = React.lazy(() => import('./teacher/src/TeacherApp'));
const StudentApp = React.lazy(() => import('./StudentApp'));
import SplashScreen from './components/PWA/SplashScreen';
import AddToHomeScreen from './components/PWA/AddToHomeScreen';
import { useOnlineStatus } from './hooks/useOnlineStatus';

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const isOnline = useOnlineStatus();
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    let pollInterval: any = null;

    const checkBackend = async () => {
      try {
        // 1. Check health API first
        const healthRes = await fetch('/api/health');
        if (!healthRes.ok) {
          console.log('[Backend Health] /api/health returned non-200. Retrying...');
          return false;
        }
        const healthCt = healthRes.headers.get('content-type') || '';
        if (healthCt.includes('text/html')) {
          console.log('[Backend Health] Received HTML instead of JSON from health route. Polling again...');
          return false;
        }
        const healthData = await healthRes.json();
        if (!healthData || healthData.ok !== true) {
          return false;
        }

        // 2. Also prove that /api/tutor/ask responds with valid JSON (ready tutor state)
        const tutorRes = await fetch('/api/tutor/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ probe: true })
        });

        if (!tutorRes.ok) {
          console.log('[Backend Health] /api/tutor/ask probe returned non-200. Retrying...');
          return false;
        }
        const tutorCt = tutorRes.headers.get('content-type') || '';
        if (tutorCt.includes('text/html')) {
          console.log('[Backend Health] /api/tutor/ask probe received HTML. Polling again...');
          return false;
        }

        const tutorData = await tutorRes.json();
        if (tutorData && tutorData.ok === true) {
          if (isMounted) {
            setBackendReady(true);
            setShowSplash(false);
          }
          if (pollInterval) {
            clearInterval(pollInterval);
          }
          console.log('[Backend Health & Tutor Probe] Both verified ready. App fully unlocked!');
          return true;
        }
      } catch (err) {
        console.log('[Backend Health & Tutor Probe] Polling server status offline...', err);
      }
      return false;
    };

    checkBackend().then((ready) => {
      if (!ready && isMounted) {
        pollInterval = setInterval(checkBackend, 1500);
      }
    });

    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  useEffect(() => {
    // Sync dark mode class with document root
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

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
    }, (err) => {
      console.warn('System maintenance check failed:', err);
    });

    return () => unsubscribeMaintenance();
  }, []);

  useEffect(() => {
    // Set persistence to Local so the session lasts across app closes
    setPersistence(auth, browserLocalPersistence);
    
    console.log("Setting up auth listener...");
    let profileUnsubscribe: (() => void) | null = null;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed. User:", currentUser?.uid);
      
      setUser(currentUser);

      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        
        // Use onSnapshot for real-time profile updates
        profileUnsubscribe = onSnapshot(userRef, async (docSnap) => {
          if (!docSnap.exists()) {
            console.log("Creating new user profile...");
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
              rank: currentUser.email === OWNER_EMAIL ? 'Owner' : 'Welcome',
              photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=😊`,
              loginDays: 1,
              tier: currentUser.email === OWNER_EMAIL ? 'admin' : 'free',
              promptsToday: 0,
              lastPromptDate: new Date().toISOString().split('T')[0],
              imagesToday: 0,
              lastImageDate: new Date().toISOString().split('T')[0],
              consents: { microphone: true, camera: true }
            };
            await setDoc(userRef, userData);
            // setProfile will be called in the next snapshot
            return;
          }

          const userData = docSnap.data();
          const today = new Date().toISOString().split('T')[0];
          const updates: any = {};
          
          // Profile theme should dictate local theme on load
          if (userData.theme && userData.theme !== (isDark ? 'dark' : 'light')) {
            setIsDark(userData.theme === 'dark');
          }
          
          if (currentUser.email === OWNER_EMAIL) {
            if (userData.rank !== 'Owner') updates.rank = 'Owner';
            if (userData.tier !== 'admin') updates.tier = 'admin';
          }
          
          if (userData.lastPromptDate !== today) {
            updates.promptsToday = 0;
            updates.lastPromptDate = today;
          }

          if (userData.lastImageDate !== today) {
            updates.imagesToday = 0;
            updates.lastImageDate = today;
          }

          if (Object.keys(updates).length > 0) {
            await updateDoc(userRef, updates);
            return;
          }

          if (userData.phone) userData.phone = decryptData(userData.phone);
          
          if (!userData.username) {
            userData.displayName = 'anonymous';
          }
          
          setProfile(userData);
          setLoading(false); // FINALLY ready to show the app

          // Update public profile logic
          const publicRef = doc(db, 'public_profiles', currentUser.uid);
          const displayName = userData.username ? (userData.displayName || currentUser.displayName || 'Anonymous') : 'anonymous';
          const publicData: any = {
            uid: currentUser.uid,
            displayName: displayName,
            displayName_lowercase: displayName.toLowerCase(),
            photoURL: userData.photoURL || currentUser.photoURL || null,
            level: userData.level || 1,
            rank: userData.rank || 'Student',
            xp: userData.xp || 0
          };
          if (userData.username) {
            publicData.username = userData.username;
          }
          setDoc(publicRef, publicData, { merge: true })
            .catch(err => console.error("Error writing public profile:", err));

          if (userData.banned) {
            setIsBanned(true);
            signOut(auth);
          }
        }, (err) => {
          console.error("Profile sync error:", err);
          setLoading(false);
          setError(`Failed to sync profile: ${err instanceof Error ? err.message : String(err)}. Please verify your network and domain settings in Firebase.`);
        });

      } catch (err: any) {
        console.error("Auth process error:", err);
        setError(`Initialization Error: ${err.message}`);
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

  const isTeacherPath = location.pathname.startsWith('/teacher');

  useEffect(() => {
    // Dynamically change favicon (gravicon) based on student vs teacher path
    const faviconElement = document.querySelector("link[rel='icon']");
    const alternateFaviconElement = document.querySelector("link[rel='alternate icon']");
    const appleTouchIconElement = document.querySelector("link[rel='apple-touch-icon']");
    const iconPath = isTeacherPath ? '/app-icon-teacher.svg' : '/app-icon.svg';

    if (faviconElement) faviconElement.setAttribute('href', iconPath);
    if (alternateFaviconElement) alternateFaviconElement.setAttribute('href', iconPath);
    if (appleTouchIconElement) appleTouchIconElement.setAttribute('href', iconPath);
  }, [isTeacherPath]);

  // Backend is treated as ready by default to prevent blocking real users on loading/offline pages
  // Splash screen handles its own 1.5s automatic fade-out overlay over the mounted app

  if (loading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center transition-colors duration-500", isDark ? "bg-black" : "bg-white")}>
        <div className="flex flex-col items-center gap-6">
          <Logo size="lg" className="animate-pulse" />
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: 240 }}
            className="h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden"
          >
            <motion.div 
              animate={{ x: [-240, 240] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="w-1/2 h-full bg-black dark:bg-white"
            />
          </motion.div>
        </div>
      </div>
    );
  }

  // FORCE USERNAME SETUP REMOVED


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
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/teacher/*" element={<TeacherApp />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/*" element={<StudentApp />} />
              </Routes>
            </AnimatePresence>
          </React.Suspense>
        </ErrorBoundary>

        <AddToHomeScreen />
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}


export { ErrorBoundary };

function UsernameSetup({ profile, onComplete }: { profile: any, onComplete: (username: string) => void }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Check if username is taken in public_profiles
      const q = query(collection(db, 'public_profiles'), where('username', '==', username.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setError('This username is already taken');
        setLoading(false);
        return;
      }

      await updateDoc(doc(db, 'users', profile.uid), {
        username: username.toLowerCase(),
        displayName: username
      });

      // Also update public profile with username
      await setDoc(doc(db, 'public_profiles', profile.uid), {
        username: username.toLowerCase(),
        displayName: username
      }, { merge: true });
      
      onComplete(username);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-zinc-50 dark:bg-zinc-950 transition-colors duration-500">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-black/10 dark:bg-white/10" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-black/5 dark:bg-white/5 blur-[100px] rounded-full" />
        
        <div className="text-center mb-10">
          <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-4 text-black dark:text-white">Complete <span className="opacity-50">Profile</span></h2>
          <p className="text-sm opacity-50 px-4 leading-relaxed font-medium text-black dark:text-white">
            Every user needs a unique designation. Choose yours carefully—this is how you will be known in the hub.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-black dark:text-white opacity-50">@</div>
            <input 
              type="text"
              required
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="YOUR_USERNAME"
              className="w-full pl-10 pr-6 py-5 bg-black/5 dark:bg-white/5 text-black dark:text-white rounded-2xl focus:outline-none focus:ring-1 focus:ring-black/20 dark:focus:ring-white/20 transition-all font-black uppercase italic tracking-widest placeholder:opacity-20"
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center justify-center gap-2"
              >
                <XCircle size={16} className="text-red-500" />
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest leading-none">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-black text-white dark:bg-white dark:text-black rounded-3xl font-black uppercase italic tracking-widest flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : (
              <>
                Confirm Identity
                <ChevronRight size={24} />
              </>
            )}
          </button>
        </form>

        <p className="text-[10px] text-center opacity-30 mt-8 leading-relaxed font-bold uppercase tracking-[0.3em] text-black dark:text-white">
          ECLIPSE CORE AUTH v2.0
        </p>
      </motion.div>
    </div>
  );
}

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
        if (typeof this.state.error.message === 'string') {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed && typeof parsed === 'object' && parsed.error) {
            displayError = `Firestore Error: ${parsed.error}`;
            if (parsed.operationType) displayError += ` (${parsed.operationType} on ${parsed.path})`;
          }
        }
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



