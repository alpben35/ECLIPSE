import React, { useState, useContext } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Moon, Sun, BarChart2, MessageSquare, 
  LogOut, Menu, X, Users, Lightbulb, Award, Zap, Shield,
  User, Lock
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './lib/firebase';
import { OWNER_EMAIL } from './constants';
import { ThemeContext, AuthContext } from './lib/contexts';
import { ProtectedRoute } from './components/ProtectedRoute';
import { cn } from './lib/utils';
import Logo from './components/ui/Logo';

import SupportModal from './components/SupportModal';
import BugReportModal from './components/BugReportModal';
import LimitReachedModal from './components/LimitReachedModal';
import ProfileSettingsModal from './components/ProfileSettingsModal';

// --- Components ---
const TutorPage = React.lazy(() => import('./pages/TutorPage'));
const ProgressPage = React.lazy(() => import('./pages/ProgressPage'));
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const IdeaPage = React.lazy(() => import('./pages/IdeaPage'));
const RankPage = React.lazy(() => import('./pages/RankPage'));
const GroupsPage = React.lazy(() => import('./pages/GroupsPage'));
const GroupDetailPage = React.lazy(() => import('./pages/GroupDetailPage'));
const AuthPage = React.lazy(() => import('./pages/AuthPage'));
const SubscriptionPage = React.lazy(() => import('./pages/SubscriptionPage'));

export default function StudentApp() {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const { user, profile } = useContext(AuthContext);
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ isOpen: boolean; limit: number; tier: string }>({
    isOpen: false,
    limit: 40,
    tier: 'free'
  });

  React.useEffect(() => {
    const handleLimitReached = (e: any) => {
      setLimitInfo({
        isOpen: true,
        limit: e.detail.limit,
        tier: e.detail.tier
      });
    };
    window.addEventListener('prompt-limit-reached', handleLimitReached);
    return () => window.removeEventListener('prompt-limit-reached', handleLimitReached);
  }, []);

  const navItems = [
    { name: 'Tutor', path: '/tutor', icon: MessageSquare },
    { name: 'Groups', path: '/groups', icon: Users },
    { name: 'Progress', path: '/progress', icon: BarChart2 },
    { name: 'Ideas', path: '/ideas', icon: Lightbulb },
    { name: 'Shop', path: '/subscription', icon: Zap },
  ];

  const isAdminPlus = profile?.email === OWNER_EMAIL || 
                      profile?.rank === 'Owner' || 
                      profile?.rank === 'Temporary Owner' || 
                      profile?.rank === 'Admin';

  if (isAdminPlus) {
    navItems.splice(2, 0, { name: 'Council', path: '/groups/admin_council', icon: Shield });
  }

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
                <div className="flex flex-col justify-center">
                  <Link to="/" className="flex items-center gap-3 group">
                    <Logo size="sm" />
                    <span className="font-bold text-xl tracking-tighter leading-none">ECLIPSE</span>
                  </Link>
                  <Link 
                    to="/teacher"
                    className="text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity text-left -mt-1.5 ml-11"
                  >
                    Switch to Teacher
                  </Link>
                </div>

                <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full ml-4">
                  <Shield size={10} className="text-green-500" />
                  <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Secure Connection</span>
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
                    <div className="w-32 h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" 
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
                <div className="flex items-center gap-4 relative">
                  <div className="relative">
                    <button 
                      onClick={() => setShowProfilePopover(!showProfilePopover)}
                      className="relative cursor-pointer group"
                    >
                      <img 
                        src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                        alt="Avatar" 
                        className="w-8 h-8 rounded-full border border-black/10 dark:border-white/10 group-hover:scale-110 transition-transform"
                      />
                    </button>
                    
                    {/* Profile Popover */}
                    <AnimatePresence>
                      {showProfilePopover && (
                        <>
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowProfilePopover(false)}
                            className="fixed inset-0 z-40"
                          />
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute top-full right-0 w-72 pt-4 z-50"
                          >
                            <div className="bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-[2rem] shadow-2xl p-6 overflow-hidden">
                            <div className="space-y-6">
                              <div className="flex items-center gap-4 pb-6 border-b border-black/5 dark:border-white/5">
                                <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                                  <User size={24} className="opacity-50" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-30">Student Profile</p>
                                  <p className="font-bold truncate text-lg tracking-tight">{profile?.displayName || user.displayName || 'Anonymous'}</p>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-30 ml-1">Account Security</p>
                                <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center justify-between group/item">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center">
                                      <Lock size={14} className="opacity-50" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold">Password</span>
                                      <span className="text-[10px] opacity-30 tracking-widest">••••••••</span>
                                    </div>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => {
                                    setShowProfileSettings(true);
                                    setShowProfilePopover(false);
                                  }}
                                  className="w-full py-4 text-[10px] font-black uppercase tracking-widest bg-black text-white dark:bg-white dark:text-black rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-black/10 dark:shadow-white/5"
                                >
                                  Manage Account
                                </button>
                              </div>

                              <div className="pt-4 border-t border-black/5 dark:border-white/5 flex flex-col gap-2">
                                <button 
                                  onClick={() => {
                                    handleLogout();
                                    setShowProfilePopover(false);
                                  }}
                                  className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold opacity-50 hover:opacity-100 transition-opacity"
                                >
                                  <LogOut size={16} />
                                  Sign Out
                                </button>
                                
                                <button 
                                  onClick={() => {
                                    if (window.confirm("Are you absolutely sure? This will permanently delete your account and all your progress. This action cannot be undone.")) {
                                      user.delete()
                                        .then(() => window.location.reload())
                                        .catch(err => {
                                          if (err.code === 'auth/requires-recent-login') {
                                            alert("Please sign out and sign back in to delete your account for security reasons.");
                                          } else {
                                            alert(err.message);
                                          }
                                        });
                                    }
                                  }}
                                  className="text-[10px] font-bold text-red-500/50 hover:text-red-500 transition-colors uppercase tracking-widest"
                                >
                                  Delete Account
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                  
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
              <React.Suspense fallback={
                <div className="flex items-center justify-center p-12">
                  <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <Routes>
                  <Route path="/" element={user ? <Navigate to="/tutor" /> : <LandingPage />} />
                  <Route path="/tutor" element={<ProtectedRoute><TutorPage /></ProtectedRoute>} />
                  <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
                  <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetailPage /></ProtectedRoute>} />
                  <Route path="/progress" element={<ProtectedRoute><ProgressPage /></ProtectedRoute>} />
                  <Route path="/ideas" element={<ProtectedRoute><IdeaPage /></ProtectedRoute>} />
                  <Route path="/ranks" element={<ProtectedRoute><RankPage /></ProtectedRoute>} />
                  <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
                  <Route path="/auth" element={user ? <Navigate to="/tutor" /> : <AuthPage />} />
                </Routes>
              </React.Suspense>
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="py-12 border-t border-black/10 dark:border-white/10">
          <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              <Link to="/privacy" className="text-xs font-bold opacity-50 hover:opacity-100 transition-opacity">Privacy Policy</Link>
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
        <LimitReachedModal 
          isOpen={limitInfo.isOpen} 
          onClose={() => setLimitInfo(prev => ({ ...prev, isOpen: false }))} 
          limit={limitInfo.limit}
          tier={limitInfo.tier}
        />

        <ProfileSettingsModal 
          isOpen={showProfileSettings}
          onClose={() => setShowProfileSettings(false)}
          currentUsername={profile?.displayName || user?.displayName || ''}
          currentPhone={profile?.phone || ''}
          currentBankAccount={profile?.bankAccount || ''}
        />

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
