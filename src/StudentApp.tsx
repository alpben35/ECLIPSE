import React, { useState, useContext } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Moon, Sun, BarChart2, MessageSquare, 
  LogOut, Menu, X, Users, Lightbulb, Award
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { OWNER_EMAIL } from './constants';
import { AuthContext, ThemeContext, ProtectedRoute } from './App';
import { cn } from './lib/utils';

import SupportModal from './components/SupportModal';
import BugReportModal from './components/BugReportModal';

import TutorPage from './pages/TutorPage';
import ProgressPage from './pages/ProgressPage';
import LandingPage from './pages/LandingPage';
import AdminPage from './pages/AdminPage';
import IdeaPage from './pages/IdeaPage';
import RankPage from './pages/RankPage';
import AuthPage from './pages/AuthPage';
import GroupsPage from './pages/GroupsPage';
import GroupDetailPage from './pages/GroupDetailPage';

export default function StudentApp() {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const { user, profile } = useContext(AuthContext);
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);

  const navItems = [
    { name: 'Tutor', path: '/tutor', icon: MessageSquare },
    { name: 'Groups', path: '/groups', icon: Users },
    { name: 'Progress', path: '/progress', icon: BarChart2 },
    { name: 'Ideas', path: '/ideas', icon: Lightbulb },
    { name: 'Ranks', path: '/ranks', icon: Award },
  ];

  const isOwner = profile?.email === OWNER_EMAIL || profile?.rank === 'Owner';
  const isTempOwner = profile?.rank === 'Temporary Owner';

  if (isOwner || isTempOwner) {
    navItems.push({ name: 'Admin', path: '/admin', icon: Users });
  }

  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    signInWithPopup(auth, provider);
  };
  const handleLogout = () => signOut(auth);

  const xpForNextLevel = Math.pow(profile?.level || 1, 2) * 100;
  const currentLevelXp = Math.pow((profile?.level || 1) - 1, 2) * 100;
  const progress = profile ? ((profile.xp - currentLevelXp) / (xpForNextLevel - currentLevelXp)) * 100 : 0;

  return (
    <div className={cn("min-h-screen transition-colors duration-500", isDark ? "dark bg-black text-white" : "bg-white text-black")}>
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-50 border-b border-black/10 dark:border-white/10 bg-inherit/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
                <div className="flex flex-col">
                  <Link to="/" className="flex items-center gap-2 group">
                    <div className="relative w-8 h-8">
                      <div className="absolute inset-0 bg-black dark:bg-white rounded-full" />
                      <motion.div 
                        animate={{ x: isDark ? 4 : -4 }}
                        className="absolute inset-0 bg-white dark:bg-black rounded-full translate-x-1 translate-y-1" 
                      />
                    </div>
                    <span className="font-bold text-xl tracking-tighter">ECLIPSE</span>
                  </Link>
                  <Link 
                    to="/teacher"
                    className="text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity text-left mt-1"
                  >
                    Switch
                  </Link>
                </div>

              {user && (
                <div className="hidden lg:flex items-center gap-4 pl-8 border-l border-black/10 dark:border-white/10">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                          {profile?.email === OWNER_EMAIL ? 'Owner' : profile?.rank || 'Welcome'}
                        </span>
                        <span className="text-[8px] font-bold text-orange-500 uppercase tracking-widest">
                          Level {profile?.level || 1}
                        </span>
                      </div>
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className={cn("w-1 h-1 rounded-full", i < (profile?.streak % 5 || 0) ? "bg-orange-500" : "bg-black/10 dark:bg-white/10")} />
                        ))}
                      </div>
                    </div>
                    <div className="w-32 h-1 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-black/40 dark:bg-white/40" 
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
              <button 
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              
              {user ? (
                <div className="flex items-center gap-4">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    alt="Avatar" 
                    className="w-8 h-8 rounded-full border border-black/10 dark:border-white/10"
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
                  className="px-4 py-2 rounded-full bg-black text-white dark:bg-white dark:text-black font-medium text-sm hover:scale-105 transition-transform"
                >
                  Get Started
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
              <Routes>
                <Route path="/" element={user ? <Navigate to="/tutor" /> : <LandingPage />} />
                <Route path="/auth" element={user ? <Navigate to="/tutor" /> : <AuthPage />} />
                <Route path="/tutor" element={<ProtectedRoute><TutorPage /></ProtectedRoute>} />
                <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
                <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetailPage /></ProtectedRoute>} />
                <Route path="/progress" element={<ProtectedRoute><ProgressPage /></ProtectedRoute>} />
                <Route path="/ideas" element={<ProtectedRoute><IdeaPage /></ProtectedRoute>} />
                <Route path="/ranks" element={<ProtectedRoute><RankPage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="py-12 border-t border-black/10 dark:border-white/10">
          <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowBugReport(true)}
                className="px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl text-xs font-bold transition-all border border-black/10 dark:border-white/10"
              >
                Bug Report
              </button>
              <button 
                onClick={() => setShowSupport(true)}
                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black hover:scale-105 rounded-xl text-xs font-bold transition-all shadow-lg"
              >
                Donate
              </button>
            </div>
            <p className="text-sm opacity-50">© 2024 Eclipse AI. Your ultimate study companion.</p>
          </div>
        </footer>

        <SupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} />
        <BugReportModal isOpen={showBugReport} onClose={() => setShowBugReport(false)} />

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              className="fixed inset-0 z-[60] bg-white dark:bg-black p-6 flex flex-col gap-8"
            >
              <div className="flex justify-end">
                <button onClick={() => setIsMenuOpen(false)}><X size={32} /></button>
              </div>
              <div className="flex flex-col gap-6 text-2xl font-bold">
                {user ? (
                  <>
                    {navItems.map(item => (
                      <Link key={item.path} to={item.path} onClick={() => setIsMenuOpen(false)}>{item.name}</Link>
                    ))}
                    <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="text-left text-red-500">Sign Out</button>
                  </>
                ) : (
                  <Link to="/auth" onClick={() => setIsMenuOpen(false)}>Sign In</Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
