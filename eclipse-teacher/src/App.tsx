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
import { cn } from './lib/utils';

const ThemeContext = createContext<{
  isDark: boolean;
  toggleTheme: () => void;
}>({ isDark: false, toggleTheme: () => {} });

export const AuthContext = createContext<{
  user: User | null;
  profile: any | null;
  loading: boolean;
  addXp: (amount: number) => Promise<void>;
}>({ user: null, profile: null, loading: true, addXp: async () => {} });

import TutorPage from './pages/TutorPage';
import ProgressPage from './pages/ProgressPage';
import LandingPage from './pages/LandingPage';
import AdminPage from './pages/AdminPage';
import IdeaPage from './pages/IdeaPage';
import RankPage from './pages/RankPage';
import AuthPage from './pages/AuthPage';

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState(false);

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

            if (data.banned) {
              await signOut(auth);
              alert("Your account has been banned.");
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
    maintenance
  }), [user, profile, loading, addXp, maintenance]);

  const themeContextValue = React.useMemo(() => ({ 
    isDark, 
    toggleTheme 
  }), [isDark, toggleTheme]);

  const isOwner = profile?.email === OWNER_EMAIL || profile?.rank === 'Owner';

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-royal-red">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-12 h-12 rounded-full border-4 border-gold border-t-transparent"
        />
      </div>
    );
  }

  if (maintenance && !isOwner) {
    return (
      <div className="min-h-screen bg-royal-red flex items-center justify-center p-4 text-center">
        <div className="max-w-md space-y-8">
          <div className="w-24 h-24 bg-gold/10 rounded-3xl flex items-center justify-center mx-auto animate-pulse">
            <Settings className="text-gold" size={48} />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tighter text-gold italic uppercase">System Maintenance</h1>
            <p className="text-gold opacity-60 leading-relaxed">
              Eclipse Teacher is currently undergoing scheduled maintenance to improve your experience. 
              We'll be back online shortly.
            </p>
          </div>
          <div className="pt-8">
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-gold text-royal-red rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform"
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
        <ErrorBoundary>
          <div className="min-h-screen bg-royal-red text-gold selection:bg-gold selection:text-royal-red">
            <Router basename="/teacher">
              <Layout>
                <Routes>
                  <Route path="/" element={user ? <Navigate to="/tutor" /> : <LandingPage />} />
                  <Route path="/auth" element={user ? <Navigate to="/tutor" /> : <AuthPage />} />
                  <Route path="/tutor" element={<ProtectedRoute><TutorPage /></ProtectedRoute>} />
                  <Route path="/progress" element={<ProtectedRoute><ProgressPage /></ProtectedRoute>} />
                  <Route path="/ideas" element={<ProtectedRoute><IdeaPage /></ProtectedRoute>} />
                  <Route path="/ranks" element={<ProtectedRoute><RankPage /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
                </Routes>
              </Layout>
            </Router>
          </div>
        </ErrorBoundary>
      </ThemeContext.Provider>
    </AuthContext.Provider>
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
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) displayError = `Firestore Error: ${parsed.error} (${parsed.operationType} on ${parsed.path})`;
      } catch (e) {
        displayError = this.state.error.message || String(this.state.error);
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-royal-red text-gold">
          <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mb-6">
            <X className="text-gold" size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Application Error</h1>
          <p className="opacity-50 max-w-md mb-8">{displayError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gold text-royal-red rounded-2xl font-bold shadow-lg"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, profile } = useContext(AuthContext);
  if (!user) return <Navigate to="/" />;
  const isOwner = profile?.email === OWNER_EMAIL || profile?.rank === 'Owner';
  const isTempOwner = profile?.rank === 'Temporary Owner';
  
  if (adminOnly && !isOwner && !isTempOwner) return <Navigate to="/tutor" />;
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const { user, profile } = useContext(AuthContext);
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { name: 'Assistant', path: '/tutor', icon: MessageSquare },
    { name: 'Class Progress', path: '/progress', icon: BarChart2 },
    { name: 'Ideas', path: '/ideas', icon: Lightbulb },
    { name: 'Teacher Ranks', path: '/ranks', icon: Award },
  ];

  const isOwner = profile?.email === OWNER_EMAIL || profile?.rank === 'Owner';
  const isTempOwner = profile?.rank === 'Temporary Owner';

  if (isOwner || isTempOwner) {
    navItems.push({ name: 'Admin', path: '/admin', icon: Users });
  }

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        console.log('Login cancelled by user or multiple requests.');
      } else {
        console.error('Login error:', error);
      }
    } finally {
      setIsLoggingIn(true); // Keep it true for a bit to debounce, or set to false
      setTimeout(() => setIsLoggingIn(false), 2000);
    }
  };
  const handleLogout = () => signOut(auth);

  const xpForNextLevel = Math.pow(profile?.level || 1, 2) * 100;
  const currentLevelXp = Math.pow((profile?.level || 1) - 1, 2) * 100;
  const progress = profile ? ((profile.xp - currentLevelXp) / (xpForNextLevel - currentLevelXp)) * 100 : 0;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 border-b border-gold/20 bg-royal-red/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="relative w-8 h-8">
                  <div className="absolute inset-0 bg-gold rounded-full" />
                  <motion.div 
                    animate={{ x: 4 }}
                    className="absolute inset-0 bg-royal-red rounded-full translate-x-1 translate-y-1" 
                  />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-bold text-2xl tracking-tighter text-gold">ECLIPSE</span>
                  <span className="text-lg handwriting text-gold ml-1 -mt-1">Teacher</span>
                </div>
              </Link>
              <button 
                onClick={() => window.location.href = '/'}
                className="text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity text-left mt-1 ml-10"
              >
                Switch
              </button>
            </div>

            {user && (
              <div className="hidden lg:flex items-center gap-4 pl-8 border-l border-black/10 dark:border-white/10">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                        {profile?.email === OWNER_EMAIL ? 'Owner' : profile?.rank || 'Welcome'}
                      </span>
                      <span className="text-[8px] font-bold text-gold uppercase tracking-widest">
                        Level {profile?.level || 1}
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={cn("w-1 h-1 rounded-full", i < (profile?.streak % 5 || 0) ? "bg-gold" : "bg-gold/10")} />
                      ))}
                    </div>
                  </div>
                  <div className="w-32 h-1 bg-gold/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-gold/40" 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {user && navItems.map((item) => (
              <Link 
                key={item.path} 
                to={item.path}
                className={cn(
                  "text-sm font-medium transition-opacity hover:opacity-100",
                  location.pathname === item.path ? "opacity-100" : "opacity-50"
                )}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <img 
                  src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                  alt="Avatar" 
                  className="w-8 h-8 rounded-full border border-gold/20"
                />
                <button 
                  onClick={handleLogout}
                  className="hidden md:flex items-center gap-2 text-sm font-medium opacity-50 hover:opacity-100 transition-opacity"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            ) : (
              <Link 
                to="/auth"
                className="px-4 py-2 rounded-full bg-gold text-royal-red font-bold text-sm hover:scale-105 transition-transform shadow-lg"
              >
                Teacher Login
              </Link>
            )}

            <button 
              className="md:hidden p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="py-12 border-t border-gold/10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm opacity-50">© 2024 Eclipse Teacher. Empowering educators with AI.</p>
        </div>
      </footer>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="fixed inset-0 z-[60] bg-royal-red p-6 flex flex-col gap-8 text-gold"
          >
            <div className="flex justify-end">
              <button onClick={() => setIsMenuOpen(false)} className="text-gold"><X size={32} /></button>
            </div>
            <div className="flex flex-col gap-6 text-2xl font-bold">
              {user ? (
                <>
                  {navItems.map(item => (
                    <Link key={item.path} to={item.path} onClick={() => setIsMenuOpen(false)} className="text-gold">{item.name}</Link>
                  ))}
                  <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="text-left text-gold opacity-50">Sign Out</button>
                </>
              ) : (
                <button onClick={() => { handleLogin(); setIsMenuOpen(false); }} className="text-gold">Sign In</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
