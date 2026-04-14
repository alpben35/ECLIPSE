import React, { useState, useContext } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogOut, Menu, X, Users, MessageSquare, BarChart2, Lightbulb, Award
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '../../src/lib/firebase';
import { OWNER_EMAIL } from '../../src/constants';
import { AuthContext, ProtectedRoute } from '../../src/App';
import { cn } from '../../src/lib/utils';

import SupportModal from '../../src/components/SupportModal';
import BugReportModal from '../../src/components/BugReportModal';

import TutorPage from './pages/TutorPage';
import ProgressPage from './pages/ProgressPage';
import LandingPage from './pages/LandingPage';
import AdminPage from './pages/AdminPage';
import IdeaPage from './pages/IdeaPage';
import RankPage from './pages/RankPage';
import AuthPage from './pages/AuthPage';
import GroupsPage from './pages/GroupsPage';
import GroupDetailPage from './pages/GroupDetailPage';

export default function TeacherApp() {
  const { user, profile } = useContext(AuthContext);
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);

  const navItems = [
    { name: 'Assistant', path: '/teacher/tutor', icon: MessageSquare },
    { name: 'Groups', path: '/teacher/groups', icon: Users },
    { name: 'Class Progress', path: '/teacher/progress', icon: BarChart2 },
    { name: 'Ideas', path: '/teacher/ideas', icon: Lightbulb },
    { name: 'Teacher Ranks', path: '/teacher/ranks', icon: Award },
  ];

  const isOwner = profile?.email === OWNER_EMAIL || profile?.rank === 'Owner';
  const isTempOwner = profile?.rank === 'Temporary Owner';

  if (isOwner || isTempOwner) {
    navItems.push({ name: 'Admin', path: '/teacher/admin', icon: Users });
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
        console.log('Login cancelled by user.');
      } else {
        console.error('Login error:', error);
      }
    } finally {
      setTimeout(() => setIsLoggingIn(false), 2000);
    }
  };
  const handleLogout = () => signOut(auth);

  const xpForNextLevel = Math.pow(profile?.level || 1, 2) * 100;
  const currentLevelXp = Math.pow((profile?.level || 1) - 1, 2) * 100;
  const progress = profile ? ((profile.xp - currentLevelXp) / (xpForNextLevel - currentLevelXp)) * 100 : 0;

  return (
    <div className="min-h-screen bg-royal-red text-gold selection:bg-gold selection:text-royal-red dark">
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
                <Link 
                  to="/"
                  className="text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity text-left mt-1 ml-10"
                >
                  Switch
                </Link>
              </div>

              {user && (
                <div className="hidden lg:flex items-center gap-4 pl-8 border-l border-gold/10">
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
                  to="/teacher/auth"
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
              <Routes>
                <Route path="/" element={user ? <Navigate to="/teacher/tutor" /> : <LandingPage />} />
                <Route path="/auth" element={user ? <Navigate to="/teacher/tutor" /> : <AuthPage />} />
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

        <footer className="py-12 border-t border-gold/10">
          <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowBugReport(true)}
                className="px-4 py-2 bg-gold/10 hover:bg-gold/20 text-gold rounded-xl text-xs font-bold transition-all border border-gold/20"
              >
                Bug Report
              </button>
              <button 
                onClick={() => setShowSupport(true)}
                className="px-4 py-2 bg-gold text-royal-red hover:scale-105 rounded-xl text-xs font-bold transition-all shadow-lg"
              >
                Donate
              </button>
            </div>
            <p className="text-sm opacity-50">© 2024 Eclipse Teacher. Empowering educators with AI.</p>
          </div>
        </footer>

        <SupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} isTeacher />
        <BugReportModal isOpen={showBugReport} onClose={() => setShowBugReport(false)} isTeacher />

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
                  <Link to="/teacher/auth" onClick={() => setIsMenuOpen(false)} className="text-gold">Sign In</Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
