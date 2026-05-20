import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, AlertCircle, Loader2, Sparkles, Mail, Lock, User as UserIcon, Cookie, Info } from 'lucide-react';
import { auth } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { Link } from 'react-router-dom';
import Logo from '../components/ui/Logo';
import { cn } from '../lib/utils';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ThemeContext } from '../lib/contexts';

export default function AuthPage() {
  const { isDark } = useContext(ThemeContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'email-in' | 'email-up' | 'forgot'>('email-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'phone' | 'success'>('email');

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return setError("Please enter your email address.");
    
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setForgotStep('success');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError("No account found with this email.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'email-up') {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (!phoneNumber) {
        setError("Phone number is required for account security.");
        return;
      }
    }

    setLoading(true);
    
    try {
      if (mode === 'email-up') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        const name = displayName || email.split('@')[0];
        const usernameVal = name.toLowerCase().replace(/[^a-z0-9_]/g, '');
        
        // Create initial profile
        await setDoc(doc(db, 'users', uid), {
          uid,
          email,
          phoneNumber,
          username: usernameVal,
          displayName: name,
          rank: 'Student',
          level: 1,
          xp: 0,
          tier: 'free',
          joinedAt: new Date().toISOString()
        });

        // Initialize public profile
        await setDoc(doc(db, 'public_profiles', uid), {
          uid,
          username: usernameVal,
          displayName: name,
          rank: 'Student',
          level: 1,
          xp: 0
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered. Please sign in instead.");
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError("Invalid credentials. If you previously used a different login method, please use 'Forgot Password' to set a new password.");
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(`Security Warning: The domain "${window.location.hostname}" is not yet authorized in the Firebase Console. Please add it to "Authorized Domains" under Authentication > Settings to enable access.`);
      } else if (err.code === 'auth/operation-not-allowed') {
        setError("Login service restricted. Please contact the system administrator.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Sign-in popup was closed before completion.");
      } else {
        setError(err.message || "Failed to sign in with Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("min-h-screen flex items-center justify-center px-4 py-12 transition-colors duration-500", isDark ? "bg-zinc-950" : "bg-white")}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "w-full max-w-md border rounded-[3rem] p-8 md:p-12 shadow-2xl overflow-hidden relative",
          isDark ? "bg-zinc-900 border-white/10" : "bg-white border-black/10"
        )}
      >
        {/* Decorative Background Elements */}
        <div className={cn("absolute top-0 left-0 w-full h-1", isDark ? "bg-white/20" : "bg-black/10")} />
        <div className={cn("absolute -top-24 -right-24 w-48 h-48 blur-[100px] rounded-full", isDark ? "bg-white/5" : "bg-black/5")} />
        <div className={cn("absolute -bottom-24 -left-24 w-48 h-48 blur-[100px] rounded-full", isDark ? "bg-white/5" : "bg-black/5")} />

        <div className="text-center mb-10 relative z-10">
          <div className="flex justify-center mb-6 relative">
            <Logo size="lg" />
            <div className={cn("absolute inset-0 blur-3xl rounded-full -z-10", isDark ? "bg-white/5" : "bg-black/5")} />
          </div>
          <h1 className={cn("text-5xl font-black tracking-tighter uppercase italic leading-none mb-4", isDark ? "text-white" : "text-black")}>
            Eclipse <span className="opacity-50">AI</span>
          </h1>
          <p className={cn("text-sm px-4 opacity-70", isDark ? "text-white" : "text-black")}>
            Master your future with the most powerful AI tutor ever built. Sign in to continue your journey.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm"
            >
              <AlertCircle size={18} className="shrink-0" />
              <p className="font-medium leading-tight">{error}</p>
            </motion.div>
          )}

              {resetSent && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-8 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex flex-col gap-2 text-indigo-400 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles size={18} className="shrink-0" />
                    <p className="font-bold">Reset Email Triggered!</p>
                  </div>
                  <p className="text-xs opacity-70 leading-relaxed">
                    Check your inbox and <strong className={isDark ? "text-white" : "text-indigo-600"}>SPAM folder</strong>. If you still don't see it:
                    <br/>1. Verfiy <strong className={isDark ? "text-white" : "text-indigo-600"}>Authorized Domains</strong> in Firebase Settings.
                    <br/>2. Ensure "Email/Password" is enabled (NOT Email Link).
                    <br/>3. Check "Templates" in Firebase Console to see the sender email.
                  </p>
                </motion.div>
              )}
        </AnimatePresence>

        <div className="space-y-4 relative z-10">
          <AnimatePresence mode="wait">
            {mode === 'forgot' ? (
              <motion.form 
                key="forgot"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onSubmit={handleResetPassword}
                className="space-y-4"
              >
                <div className="text-center mb-6">
                  <h2 className={cn("text-xl font-bold mb-2 italic uppercase", isDark ? "text-white" : "text-black")}>
                    {forgotStep === 'email' ? 'Reset Password' : forgotStep === 'phone' ? 'Verify Phone' : 'Success!'}
                  </h2>
                  <p className={cn("text-xs", isDark ? "text-white/60" : "text-black/60")}>
                    {forgotStep === 'email' 
                      ? "Enter your email address to begin recovery." 
                      : forgotStep === 'phone' 
                        ? "Enter your linked phone number to verify identity."
                        : "Verification complete. Check your inbox for the reset link."}
                  </p>
                </div>
                
                {forgotStep === 'email' && (
                  <div className="relative">
                    <Mail size={18} className={cn("absolute left-5 top-1/2 -translate-y-1/2", isDark ? "text-white/30" : "text-black/30")} />
                    <input 
                      type="email"
                      required
                      placeholder="Email Address"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className={cn(
                        "w-full pl-12 pr-6 py-4 rounded-2xl focus:outline-none focus:ring-1 transition-all font-bold",
                        isDark ? "bg-white/5 text-white focus:ring-white/20" : "bg-black/5 text-black focus:ring-black/20"
                      )}
                    />
                  </div>
                )}

                {forgotStep === 'phone' && (
                  <div className="relative">
                    <Shield size={18} className={cn("absolute left-5 top-1/2 -translate-y-1/2", isDark ? "text-white/30" : "text-black/30")} />
                    <input 
                      type="tel"
                      required
                      placeholder="Enter Linked Phone Number"
                      value={forgotPhone}
                      onChange={e => setForgotPhone(e.target.value)}
                      className={cn(
                        "w-full pl-12 pr-6 py-4 rounded-2xl focus:outline-none focus:ring-1 transition-all font-bold",
                        isDark ? "bg-white/5 text-white focus:ring-white/20" : "bg-black/5 text-black focus:ring-black/20"
                      )}
                    />
                  </div>
                )}

                {forgotStep !== 'success' ? (
                  <button 
                    type="submit"
                    disabled={loading}
                    className={cn(
                      "w-full py-5 rounded-3xl font-black uppercase italic tracking-tight flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl disabled:opacity-50",
                      isDark ? "bg-white text-black shadow-white/10" : "bg-black text-white shadow-black/20"
                    )}
                  >
                    {loading ? <Loader2 className="animate-spin" size={24} /> : forgotStep === 'email' ? 'Continue' : 'Verify & Send'}
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={() => { setMode('email-in'); setForgotStep('email'); }}
                    className={cn(
                      "w-full py-5 rounded-3xl font-black uppercase italic tracking-tight flex items-center justify-center gap-4 transition-all shadow-xl",
                      isDark ? "bg-white text-black" : "bg-black text-white"
                    )}
                  >
                    Return to Login
                  </button>
                )}
                
                {forgotStep !== 'success' && (
                  <button 
                    type="button"
                    onClick={() => { setMode('email-in'); setForgotStep('email'); setResetSent(false); }}
                    className={cn(
                      "w-full text-[10px] font-black uppercase tracking-widest transition-all py-2",
                      isDark ? "text-white/30 hover:text-white" : "text-black/40 hover:text-black"
                    )}
                  >
                    Back to Sign In
                  </button>
                )}
              </motion.form>
            ) : (
              <motion.div 
                key={mode}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div className="text-center mb-6">
                    <div className={cn("inline-flex p-1 rounded-2xl", isDark ? "bg-white/5" : "bg-black/5")}>
                      <button 
                        type="button"
                        onClick={() => { setMode('email-in'); setResetSent(false); }}
                        className={cn(
                          "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                          mode === 'email-in' 
                            ? (isDark ? "bg-white text-black shadow-lg" : "bg-black text-white shadow-lg") 
                            : (isDark ? "text-white/40 hover:text-white" : "text-black/40 hover:text-black")
                        )}
                      >
                        Login
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setMode('email-up'); setResetSent(false); }}
                        className={cn(
                          "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                          mode === 'email-up' 
                            ? (isDark ? "bg-white text-black shadow-lg" : "bg-black text-white shadow-lg") 
                            : (isDark ? "text-white/40 hover:text-white" : "text-black/40 hover:text-black")
                        )}
                      >
                        Register
                      </button>
                    </div>
                  </div>

                  {mode === 'email-up' && (
                    <>
                      <div className="relative">
                        <UserIcon size={18} className={cn("absolute left-5 top-1/2 -translate-y-1/2", isDark ? "text-white/30" : "text-black/30")} />
                        <input 
                          type="text"
                          required
                          placeholder="Display Name"
                          value={displayName}
                          onChange={e => setDisplayName(e.target.value)}
                          className={cn(
                            "w-full pl-12 pr-6 py-4 rounded-2xl focus:outline-none focus:ring-1 transition-all font-bold",
                            isDark ? "bg-white/5 text-white focus:ring-white/20" : "bg-black/5 text-black focus:ring-black/20"
                          )}
                        />
                      </div>
                      <div className="relative">
                        <Shield size={18} className={cn("absolute left-5 top-1/2 -translate-y-1/2", isDark ? "text-white/30" : "text-black/30")} />
                        <input 
                          type="tel"
                          required
                          placeholder="Phone Number"
                          value={phoneNumber}
                          onChange={e => setPhoneNumber(e.target.value)}
                          className={cn(
                            "w-full pl-12 pr-6 py-4 rounded-2xl focus:outline-none focus:ring-1 transition-all font-bold",
                            isDark ? "bg-white/5 text-white focus:ring-white/20" : "bg-black/5 text-black focus:ring-black/20"
                          )}
                        />
                      </div>
                    </>
                  )}
                  <div className="relative">
                    <Mail size={18} className={cn("absolute left-5 top-1/2 -translate-y-1/2", isDark ? "text-white/30" : "text-black/30")} />
                    <input 
                      type="email"
                      required
                      placeholder="Email Address"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className={cn(
                        "w-full pl-12 pr-6 py-4 rounded-2xl focus:outline-none focus:ring-1 transition-all font-bold",
                        isDark ? "bg-white/5 text-white focus:ring-white/20" : "bg-black/5 text-black focus:ring-black/20"
                      )}
                    />
                  </div>
                  <div className="relative">
                    <Lock size={18} className={cn("absolute left-5 top-1/2 -translate-y-1/2", isDark ? "text-white/30" : "text-black/30")} />
                    <input 
                      type="password"
                      required
                      placeholder={mode === 'email-up' ? "Create Password" : "Enter Password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className={cn(
                        "w-full pl-12 pr-6 py-4 rounded-2xl focus:outline-none focus:ring-1 transition-all font-bold",
                        isDark ? "bg-white/5 text-white focus:ring-white/20" : "bg-black/5 text-black focus:ring-black/20"
                      )}
                    />
                  </div>
                  {mode === 'email-up' && (
                    <div className="relative">
                      <Lock size={18} className={cn("absolute left-5 top-1/2 -translate-y-1/2", isDark ? "text-white/30" : "text-black/30")} />
                      <input 
                        type="password"
                        required
                        placeholder="Confirm Password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className={cn(
                          "w-full pl-12 pr-6 py-4 rounded-2xl focus:outline-none focus:ring-1 transition-all font-bold",
                          isDark ? "bg-white/5 text-white focus:ring-white/20" : "bg-black/10 text-black focus:ring-black/20"
                        )}
                      />
                    </div>
                  )}
                  <div className="flex justify-end px-2">
                    <button 
                      type="button"
                      onClick={() => setMode('forgot')}
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-widest transition-opacity",
                        isDark ? "text-white/30 hover:text-white" : "text-black/40 hover:text-black"
                      )}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className={cn(
                      "w-full py-5 rounded-3xl font-black uppercase italic tracking-tight flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl disabled:opacity-50",
                      isDark ? "bg-white text-black" : "bg-black text-white"
                    )}
                  >
                    {loading ? <Loader2 className="animate-spin" size={24} /> : (mode === 'email-up' ? 'Deploy Account' : 'Sign In')}
                  </button>
                  
                  <div className="flex items-center gap-4 py-2">
                    <div className={cn("h-px flex-1", isDark ? "bg-white/10" : "bg-black/10")} />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-30">OR</span>
                    <div className={cn("h-px flex-1", isDark ? "bg-white/10" : "bg-black/10")} />
                  </div>

                  <button 
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={loading}
                    className={cn(
                      "w-full py-4 rounded-2xl font-bold uppercase tracking-tight flex items-center justify-center gap-3 transition-all border disabled:opacity-50",
                      isDark ? "bg-white/5 text-white border-white/10 hover:bg-white/10" : "bg-black/5 text-black border-black/10 hover:bg-black/10"
                    )}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <p className={cn("text-[10px] text-center mt-8 leading-relaxed font-bold uppercase tracking-widest px-8", isDark ? "text-white/60" : "text-black/60")}>
            By signing in, you agree to our Terms of Service and Privacy Policy. This application uses advanced AI and does not replace human professional advice.
          </p>
        </div>

        <div className={cn("mt-12 pt-8 border-t text-center relative z-10 flex flex-col items-center gap-4", isDark ? "border-white/5" : "border-black/5")}>
          <div className="flex items-center gap-2 opacity-40">
              <Sparkles size={12} className={isDark ? "text-white" : "text-black"} />
              <span className={cn("text-[10px] font-mono tracking-tighter uppercase italic font-bold", isDark ? "text-white" : "text-black")}>hello, world!</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
              <p className={cn("text-[8px] font-black uppercase tracking-[0.3em] leading-none", isDark ? "text-white/20" : "text-black/20")}>Eclipse OS v2.0.4-UK</p>
          </div>
          <Link 
            to="/privacy" 
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest transition-opacity flex items-center justify-center gap-2 mt-2",
              isDark ? "text-white/30 hover:text-white" : "text-black/40 hover:text-black"
            )}
          >
            <Shield size={12} />
            Privacy & Security
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
