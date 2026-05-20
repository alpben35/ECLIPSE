import React, { useState, useContext } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogOut, Menu, X, Users, MessageSquare, BarChart2, Lightbulb, Award, Shield, Lock, Zap,
  Sun, Moon
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, useConnectivity } from '@/lib/firebase';
import { OWNER_EMAIL } from '@/constants';
import { AuthContext, ThemeContext } from '@/lib/contexts';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { cn } from '@/lib/utils';
import Logo from '@/components/ui/Logo';

import SupportModal from '@/components/SupportModal';
import BugReportModal from '@/components/BugReportModal';
import ProfileSettingsModal from '@/components/ProfileSettingsModal';

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
const SubscriptionPage = React.lazy(() => import('@/pages/SubscriptionPage'));
const DnsPage = React.lazy(() => import('@/pages/DnsPage'));

export default function TeacherApp() {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const { user, profile } = useContext(AuthContext);
  const connectivity = useConnectivity();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);

  const isOwner = profile?.email === OWNER_EMAIL || user?.email === OWNER_EMAIL || profile?.rank === 'Owner' || profile?.rank === 'Temporary Owner';
  const isTempOwner = profile?.rank === 'Temporary Owner';

  const isAdminPlus = profile?.email === OWNER_EMAIL || 
                      user?.email === OWNER_EMAIL ||
                      profile?.rank === 'Owner' || 
                      profile?.rank === 'Temporary Owner' || 
                      profile?.rank === 'Admin' ||
                      user?.uid === 'GTk39aFMkFTSARasXr2F4XgdtMM2';

  const navItems = React.useMemo(() => {
    const base = [
      { name: 'Assistant', path: '/teacher/tutor', icon: MessageSquare },
      { name: 'Groups', path: '/teacher/groups', icon: Users },
      { name: 'Class Progress', path: '/teacher/progress', icon: BarChart2 },
      { name: 'Ideas', path: '/teacher/ideas', icon: Lightbulb },
      { name: 'Shop', path: '/teacher/subscription', icon: Zap },
    ];
    if (isOwner || isTempOwner || isAdminPlus) {
      base.push({ name: 'Admin', path: '/teacher/admin', icon: Users });
      base.push({ name: 'Council', path: '/teacher/groups/admin_council', icon: Shield });
    }
    return base;
  }, [isOwner, isTempOwner, isAdminPlus]);

  const handleLogout = () => signOut(auth);

  const xpForNextLevel = Math.max(1, Math.pow(profile?.level || 1, 2) * 100);
  const currentLevelXp = Math.pow(Math.max(0, (profile?.level || 1) - 1), 2) * 100;
  const progress = profile && xpForNextLevel > currentLevelXp 
    ? Math.min(100, Math.max(0, ((profile.xp - currentLevelXp) / (xpForNextLevel - currentLevelXp)) * 100)) 
    : 0;

  return (
    <div className={cn("min-h-screen transition-colors duration-500 selection:bg-gold selection:text-royal-red", isDark ? "bg-royal-red text-gold" : "bg-[#FAF7F0] text-royal-red")}>
      <AnimatePresence>
        {location.pathname !== '/teacher/auth' && !connectivity.isAuthorized && window.location.hostname !== 'localhost' && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-royal-red text-gold py-2 px-4 text-center text-xs font-black uppercase tracking-widest z-[100] relative border-b border-gold/20"
          >
            Domain {window.location.hostname} is not authorized in Firebase. Features may not work.
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-col min-h-screen">
        {location.pathname !== '/teacher/auth' && (
          <header className={cn("sticky top-0 z-50 border-b backdrop-blur-md transition-colors shadow-2xl", isDark ? "border-gold/20 bg-royal-red/90 text-gold" : "border-royal-red/25 bg-[#FAF7F0]/90 text-royal-red")}>
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4 lg:gap-8 min-w-0">
              <div className="flex flex-col justify-center min-w-0">
                <div className="flex items-center gap-2 lg:gap-3 shrink-0">
                  <Link to="/" className="group shrink-0">
                    <Logo size="sm" variant="teacher" className="w-8 h-8 lg:w-10 lg:h-10" />
                  </Link>
                  <div className="flex flex-col min-w-0">
                    <Link to="/" className="flex items-center gap-2 lg:gap-3 hover:opacity-70 transition-opacity">
                      <span className={cn("font-bold text-lg lg:text-2xl tracking-tighter transition-colors", isDark ? "text-gold" : "text-royal-red")}>ECLIPSE</span>
                      <span className={cn("text-base lg:text-xl handwriting inline-block transition-colors", isDark ? "text-gold" : "text-royal-red")}>Teacher</span>
                    </Link>
                    <button 
                      onClick={() => window.location.href = '/'}
                      className={cn("text-[9px] font-black uppercase tracking-widest transition-colors whitespace-nowrap text-left mt-1", isDark ? "text-gold/40 hover:text-gold" : "text-royal-red/60 hover:text-royal-red")}
                    >
                      Student Portal
                    </button>
                  </div>
                </div>
              </div>

              <div className={cn(
                "hidden xl:flex items-center gap-2 px-3 py-1 rounded-full ml-4 border transition-colors",
                isDark 
                  ? "bg-gold/10 border-gold/20 text-gold" 
                  : "bg-royal-red/10 border-royal-red/20 text-royal-red"
              )}>
                <Shield size={10} className={isDark ? "text-gold" : "text-royal-red"} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Secure Connection</span>
              </div>

              {user && (
                <div className={cn(
                  "hidden lg:flex items-center gap-4 pl-4 lg:pl-8 border-l",
                  isDark ? "border-gold/10" : "border-royal-red/10"
                )}>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                          {profile?.email === OWNER_EMAIL ? 'Owner' : profile?.rank || 'Welcome'}
                        </span>
                        <span className={cn("text-[8px] font-bold uppercase tracking-widest", isDark ? "text-gold" : "text-royal-red")}>
                          Level {profile?.level || 1}
                        </span>
                      </div>
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className={cn("w-1 h-1 rounded-full", i < (profile?.streak % 5 || 0) ? (isDark ? "bg-gold" : "bg-royal-red") : (isDark ? "bg-gold/10" : "bg-royal-red/10"))} />
                        ))}
                      </div>
                    </div>
                    <div className={cn("w-32 h-1 rounded-full overflow-hidden", isDark ? "bg-gold/10" : "bg-royal-red/10")}>
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className={cn("h-full", isDark ? "bg-gold/40" : "bg-royal-red/40")} 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <nav className="flex items-center gap-1 sm:gap-2 lg:gap-4 xl:gap-8 overflow-x-auto no-scrollbar py-2 mx-1 lg:mx-4 flex-1 justify-center min-w-0">
              {navItems.map((item) => (
                  <Link 
                  key={item.path} 
                  to={item.path}
                  className={cn(
                    "text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-widest transition-all px-2 py-1 rounded-lg whitespace-nowrap",
                    location.pathname === item.path 
                      ? (isDark ? "bg-gold text-royal-red opacity-100 shadow-lg animate-pulse" : "bg-royal-red text-white opacity-100 shadow-lg") 
                      : (isDark ? "text-gold opacity-60 hover:opacity-100" : "text-royal-red opacity-60 hover:opacity-100")
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <button 
                onClick={toggleTheme}
                className={cn(
                  "p-2.5 rounded-xl border transition-all active:scale-95 shrink-0",
                  isDark ? "bg-gold/10 hover:bg-gold/20 border-gold/20" : "bg-royal-red/10 hover:bg-royal-red/20 border-royal-red/20"
                )}
                title="Toggle Theme"
              >
                {isDark ? <Sun size={22} strokeWidth={2.5} className="text-green-500" /> : <Moon size={22} strokeWidth={2.5} className={isDark ? "text-gold" : "text-royal-red"} />}
              </button>
              
              {user ? (
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <button 
                      onClick={() => setShowProfilePopover(!showProfilePopover)}
                      className="relative group"
                    >
                      <img 
                        src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                        alt="Avatar" 
                        className={cn("w-8 h-8 rounded-full border transition-colors", isDark ? "border-gold/20 group-hover:border-gold/50" : "border-royal-red/20 group-hover:border-royal-red/50")}
                      />
                    </button>

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
                            className="absolute right-0 w-72 pt-4 z-50"
                          >
                            <div className={cn(
                              "border shadow-2xl p-6 overflow-hidden rounded-[2rem] transition-colors",
                              isDark ? "bg-royal-red border-gold/20 text-gold" : "bg-[#FAF7F0] border-royal-red/25 text-royal-red"
                            )}>
                            <div className="space-y-6">
                              <div className={cn("flex items-center gap-4 pb-6 border-b", isDark ? "border-gold/10" : "border-royal-red/10")}>
                                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", isDark ? "bg-gold/10" : "bg-royal-red/10")}>
                                  <Award size={24} className={cn("opacity-50", isDark ? "text-gold" : "text-royal-red")} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <p className={cn("text-[10px] font-bold uppercase tracking-widest opacity-35", isDark ? "text-gold" : "text-royal-red")}>Teacher Profile</p>
                                  <p className={cn("font-bold truncate text-lg tracking-tight", isDark ? "text-gold" : "text-royal-red")}>{profile?.displayName || user.displayName || 'Anonymous'}</p>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <p className={cn("text-[10px] font-bold uppercase tracking-widest opacity-35 ml-1", isDark ? "text-gold" : "text-royal-red")}>Account Security</p>
                                <div className={cn("p-4 rounded-2xl flex items-center justify-between", isDark ? "bg-gold/5" : "bg-royal-red/5")}>
                                  <div className="flex items-center gap-3">
                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isDark ? "bg-gold/10" : "bg-royal-red/10")}>
                                      <Lock size={14} className={cn("opacity-50", isDark ? "text-gold" : "text-royal-red")} />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className={cn("text-xs font-bold", isDark ? "text-gold" : "text-royal-red")}>Password</span>
                                      <span className={cn("text-[10px] opacity-30 tracking-widest", isDark ? "text-gold" : "text-royal-red")}>••••••••</span>
                                    </div>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => {
                                    setShowProfileSettings(true);
                                    setShowProfilePopover(false);
                                  }}
                                  className={cn(
                                    "w-full py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg",
                                    isDark ? "bg-gold text-royal-red shadow-gold/10" : "bg-gold text-royal-red shadow-gold/20"
                                  )}
                                >
                                  Manage Account
                                </button>
                              </div>

                              <div className={cn("pt-4 border-t flex flex-col gap-2", isDark ? "border-gold/10" : "border-royal-red/10")}>
                                <button 
                                  onClick={() => {
                                    handleLogout();
                                    setShowProfilePopover(false);
                                  }}
                                  className={cn("w-full flex items-center justify-center gap-2 py-3 text-xs font-bold opacity-50 hover:opacity-100 transition-opacity", isDark ? "text-gold" : "text-royal-red")}
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
                                  className={cn("text-[10px] font-bold transition-colors uppercase tracking-widest", isDark ? "text-gold/30 hover:text-gold/60" : "text-royal-red/40 hover:text-royal-red/70")}
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
                    className={cn("hidden md:flex items-center gap-2 text-sm font-medium opacity-50 hover:opacity-100 transition-opacity", isDark ? "text-gold" : "text-royal-red")}
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link 
                  to="/teacher/auth"
                  className={cn("px-4 py-2 rounded-full font-bold text-sm hover:scale-105 transition-all shadow-lg", isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white")}
                >
                  Teacher Login
                </Link>
              )}

              {/* Standard Mobile Menu Trigger */}
              <button 
                className={cn("lg:hidden p-2 transition-colors", isDark ? "text-gold" : "text-royal-red")}
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
                  <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <Routes>
                  <Route path="/" element={user ? <Navigate to="/teacher/tutor" /> : <LandingPage />} />
                  <Route path="/auth" element={user ? <Navigate to="/teacher/tutor" /> : <AuthPage />} />
                  <Route path="/tutor" element={<ProtectedRoute><TutorPage /></ProtectedRoute>} />
                  <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
                  <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetailPage /></ProtectedRoute>} />
                  <Route path="/progress" element={<ProtectedRoute><ProgressPage /></ProtectedRoute>} />
                  <Route path="/ideas" element={<ProtectedRoute><IdeaPage /></ProtectedRoute>} />
                  <Route path="/ranks" element={<ProtectedRoute><RankPage /></ProtectedRoute>} />
                  <Route path="/subscription" element={<SubscriptionPage />} />
                  <Route path="/dns" element={<ProtectedRoute adminOnly><DnsPage /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
                </Routes>
              </React.Suspense>
            </motion.div>
          </AnimatePresence>
        </main>

        {location.pathname !== '/teacher/auth' && (
          <footer className="py-12 border-t border-gold/10">
            <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-6">
              <div className="flex items-center gap-4">
                <Link to="/privacy" className="text-xs font-bold opacity-50 hover:opacity-100 transition-opacity">Privacy Policy</Link>
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
        )}

        <SupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} isTeacher />
        <BugReportModal isOpen={showBugReport} onClose={() => setShowBugReport(false)} isTeacher />

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
              className={cn("fixed inset-0 z-[60] p-6 flex flex-col gap-8 transition-colors", isDark ? "bg-royal-red text-gold" : "bg-[#FAF7F0] text-royal-red")}
            >
              <div className="flex justify-end">
                <button onClick={() => setIsMenuOpen(false)} className={cn("transition-colors", isDark ? "text-gold" : "text-royal-red")}><X size={32} /></button>
              </div>
              <div className="flex flex-col gap-6 text-2xl font-bold">
                {user ? (
                   <>
                     {navItems.map(item => (
                       <Link key={item.path} to={item.path} onClick={() => setIsMenuOpen(false)} className={cn("transition-colors", isDark ? "text-gold" : "text-royal-red")}>{item.name}</Link>
                     ))}
                     <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className={cn("text-left opacity-50 transition-colors", isDark ? "text-gold" : "text-royal-red")}>Sign Out</button>
                   </>
                ) : (
                  <Link to="/teacher/auth" onClick={() => setIsMenuOpen(false)} className={cn("transition-colors", isDark ? "text-gold" : "text-royal-red")}>Sign In</Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
