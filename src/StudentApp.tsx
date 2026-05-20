import React, { useState, useContext } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart2, MessageSquare, 
  LogOut, Menu, X, Users, Lightbulb, Award, Zap, Shield,
  User, Lock, Sun, Moon, Wand2
} from 'lucide-react';
import { signOut, sendPasswordResetEmail } from 'firebase/auth';
import { auth, useConnectivity } from './lib/firebase';
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
const DnsPage = React.lazy(() => import('./pages/DnsPage'));

export default function StudentApp() {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const { user, profile } = useContext(AuthContext);
  const connectivity = useConnectivity();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ isOpen: boolean; limit: number; tier: string }>({
    isOpen: false,
    limit: 20,
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

  const isAdminPlus = profile?.email === OWNER_EMAIL || 
                      user?.email === OWNER_EMAIL ||
                      profile?.rank === 'Owner' || 
                      profile?.rank === 'Temporary Owner' || 
                      profile?.rank === 'Admin' ||
                      user?.uid === 'GTk39aFMkFTSARasXr2F4XgdtMM2';

  const isOwner = profile?.email === OWNER_EMAIL || user?.email === OWNER_EMAIL || profile?.rank === 'Owner' || profile?.rank === 'Temporary Owner';

  const navItems = React.useMemo(() => {
    const base = [
      { name: 'Tutor', path: '/tutor', icon: MessageSquare },
      { name: 'Teams', path: '/groups', icon: Users },
      { name: 'Progress', path: '/progress', icon: BarChart2 },
      { name: 'Ideas', path: '/ideas', icon: Lightbulb },
      { name: 'Shop', path: '/subscription', icon: Zap },
      { name: 'Profile', path: '#profile', icon: User },
    ];
    if (isAdminPlus || isOwner) {
      base.push({ name: 'Admin', path: '/admin', icon: Users });
      base.push({ name: 'Council', path: '/groups/admin_council', icon: Shield });
    }
    return base;
  }, [isAdminPlus, isOwner]);

  const handleLogout = () => signOut(auth);

  const xpForNextLevel = Math.max(1, Math.pow(profile?.level || 1, 2) * 100);
  const currentLevelXp = Math.pow(Math.max(0, (profile?.level || 1) - 1), 2) * 100;
  const progress = profile && xpForNextLevel > currentLevelXp 
    ? Math.min(100, Math.max(0, (((profile.xp || 0) - currentLevelXp) / (xpForNextLevel - currentLevelXp)) * 100)) 
    : 0;

  const [easterEggs, setEasterEggs] = useState<any[]>([]);

  React.useEffect(() => {
    const handleEasterEgg = (e: any) => {
      const id = Math.random().toString(36).substring(7);
      setEasterEggs(prev => [...prev, { id, ...e.detail }]);
      setTimeout(() => {
        setEasterEggs(prev => prev.filter(egg => egg.id !== id));
      }, 3000);
    };
    window.addEventListener('easter-egg-sparkle', handleEasterEgg);
    return () => window.removeEventListener('easter-egg-sparkle', handleEasterEgg);
  }, []);

  return (
    <div className={cn("min-h-screen transition-colors duration-500", isDark ? "dark bg-black text-white" : "bg-white text-black")}>
      <AnimatePresence>
        {location.pathname !== '/auth' && !connectivity.isAuthorized && window.location.hostname !== 'localhost' && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-royal-red text-white py-2 px-4 text-center text-xs font-black uppercase tracking-widest z-[100] relative"
          >
            Domain {window.location.hostname} is not authorized in Firebase. Features may not work.
          </motion.div>
        )}
        {easterEggs.map(egg => (
          <motion.div
            key={egg.id}
            initial={{ opacity: 0, scale: 0.5, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: -100 }}
            exit={{ opacity: 0, scale: 1.5, y: -200 }}
            className="fixed bottom-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none"
          >
            <div 
              style={{ color: egg.color }}
              className="text-6xl font-black italic uppercase tracking-tighter drop-shadow-2xl whitespace-nowrap"
            >
              {egg.message}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <div className="flex flex-col min-h-screen">
        {location.pathname !== '/auth' && (
          <header className="sticky top-0 z-50 bg-transparent">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 lg:gap-6 shrink-0 min-w-0">
                <div className="flex flex-col justify-center shrink-0 min-w-0">
                  <div className="flex items-center gap-2 lg:gap-3 shrink-0">
                    <Link to="/" className="flex items-center gap-2 lg:gap-3 group shrink-0">
                      <Logo size="sm" className="w-8 h-8 lg:w-10 lg:h-10" />
                    </Link>
                    <div className="flex flex-col shrink-0 min-w-0">
                      <Link to="/" className="font-bold text-base lg:text-xl tracking-tighter leading-none hover:opacity-70 transition-opacity truncate">
                        ECLIPSE
                      </Link>
                      <Link 
                        to={"/teacher" + (location.pathname === '/' ? '' : location.pathname)}
                        className="text-[9px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity whitespace-nowrap mt-1"
                      >
                        Teacher Portal
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full ml-2 lg:ml-4">
                  <Shield size={10} className="text-green-500" />
                  <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Secure Connection</span>
                </div>

              {user && (
                <div className="hidden lg:flex items-center gap-4 pl-4 lg:pl-8 border-l border-black/10 dark:border-white/10">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                          {profile?.email === OWNER_EMAIL ? 'Owner' : profile?.rank || 'Basic'}
                        </span>
                        <span className="text-[8px] font-bold text-black dark:text-white uppercase tracking-widest">
                          Level {profile?.level || 1}
                        </span>
                      </div>
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className={cn("w-1 h-1 rounded-full", i < (profile?.streak % 5 || 0) ? "bg-black dark:bg-white" : "bg-black/10 dark:bg-white/10")} />
                        ))}
                      </div>
                    </div>
                    <div className="w-32 h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-black dark:bg-white" 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <nav className="flex items-center gap-1 sm:gap-4 md:gap-8 overflow-x-auto no-scrollbar py-2">
              {navItems.map((item) => {
                const isActive = item.path === '#profile' ? showProfilePopover : location.pathname === item.path;
                
                if (item.path === '#profile') {
                  return (
                    <button 
                      key={item.path} 
                      onClick={() => setShowProfilePopover(!showProfilePopover)}
                      className={cn(
                        "text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-widest transition-all px-2 py-1 rounded-lg whitespace-nowrap",
                        isActive 
                          ? "bg-black text-white dark:bg-white dark:text-black opacity-100 shadow-lg" 
                          : "opacity-40 hover:opacity-100"
                      )}
                    >
                      {item.name}
                    </button>
                  );
                }

                return (
                  <Link 
                    key={item.path} 
                    to={item.path}
                    className={cn(
                      "text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-widest transition-all px-2 py-1 rounded-lg whitespace-nowrap",
                      isActive
                        ? "bg-black text-white dark:bg-white dark:text-black opacity-100 shadow-lg" 
                        : "opacity-60 hover:opacity-100"
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 sm:gap-4 shrink-0 px-2 sm:px-0">
              <button 
                onClick={toggleTheme}
                className="p-2.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition-all active:scale-95 shrink-0"
                title="Toggle Theme"
              >
                {isDark ? <Sun size={24} strokeWidth={2.5} className="text-green-500" /> : <Moon size={24} strokeWidth={2.5} className="text-green-500" />}
              </button>
              
              {user ? (
                <div className="flex items-center gap-2 sm:gap-4 relative shrink-0">
                  <div className="relative shrink-0">
                    <button 
                      onClick={() => setShowProfilePopover(!showProfilePopover)}
                      className="relative cursor-pointer group block shrink-0"
                    >
                      <img 
                        src={profile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                        alt="Avatar" 
                        className="w-10 h-10 min-w-[40px] rounded-full border-2 border-black/10 dark:border-white/10 group-hover:border-black dark:group-hover:border-white transition-all object-cover shrink-0"
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
                                <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center overflow-hidden">
                                  {profile?.photoURL || user.photoURL ? (
                                    <img src={profile?.photoURL || user.photoURL} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <User size={24} className="opacity-50" />
                                  )}
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

              {/* Standard Mobile Menu Trigger */}
              <button 
                className="md:hidden p-2"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </header>
        )}

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
                  <Route path="/dns" element={<ProtectedRoute adminOnly><DnsPage /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
                  <Route path="/auth" element={user ? <Navigate to="/tutor" /> : <AuthPage />} />
                </Routes>
              </React.Suspense>
            </motion.div>
          </AnimatePresence>
        </main>

        {location.pathname !== '/auth' && (
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
        )}

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
          currentPhotoURL={profile?.photoURL || user?.photoURL || ''}
          currentPhone={profile?.phone || ''}
          profile={profile}
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
                    {navItems.map(item => {
                      if (item.path === '#profile') {
                        return (
                          <button 
                            key={item.path} 
                            onClick={() => { setShowProfilePopover(true); setIsMenuOpen(false); }}
                            className="text-left text-black dark:text-white hover:opacity-70 transition-opacity"
                          >
                            {item.name}
                          </button>
                        );
                      }
                      return (
                        <Link 
                          key={item.path} 
                          to={item.path} 
                          onClick={() => setIsMenuOpen(false)}
                          className="text-black dark:text-white hover:opacity-70 transition-opacity"
                        >
                          {item.name}
                        </Link>
                      );
                    })}
                    <div className="pt-6 mt-6 border-t border-black/10 dark:border-white/10">
                      <button 
                        onClick={() => { handleLogout(); setIsMenuOpen(false); }} 
                        className="text-left text-red-500 hover:opacity-70 transition-opacity flex items-center gap-2"
                      >
                        <LogOut size={24} />
                        Sign Out
                      </button>
                    </div>
                  </>
                ) : (
                  <Link 
                    to="/auth" 
                    onClick={() => setIsMenuOpen(false)}
                    className="text-black dark:text-white"
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
