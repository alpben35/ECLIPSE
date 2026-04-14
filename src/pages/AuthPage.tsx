import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, Phone, Shield, Camera, Mic, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AuthMode = 'login' | 'register' | 'forgot' | 'verify';

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [consentMic, setConsentMic] = useState(false);
  const [consentCam, setConsentCam] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (mode === 'register') {
        if (!consentMic || !consentCam) {
          throw new Error("Please provide consent for microphone and camera to continue.");
        }
        // Simulate sending verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedCode(code);
        setMode('verify');
        console.log("Verification Code (Simulated):", code);
        setSuccess("A verification code has been 'sent' to your email.");
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setSuccess("Password reset email sent! Check your inbox.");
        setMode('login');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode !== generatedCode) {
      setError("Invalid verification code.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: username });

      // Create profile
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: username,
        email: email,
        phone: phone,
        rank: 'Welcome',
        createdAt: new Date().toISOString(),
        xp: 0,
        level: 1,
        streak: 0,
        loginDays: 1,
        consents: {
          microphone: consentMic,
          camera: consentCam
        }
      });

      // Create public profile
      await setDoc(doc(db, 'public_profiles', user.uid), {
        uid: user.uid,
        displayName: username,
        photoURL: null,
        level: 1,
        rank: 'Welcome',
        xp: 0
      });

      setSuccess("Account created successfully!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-[3rem] p-8 md:p-12 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-black/10 dark:bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="opacity-50" size={32} />
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">
            {mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Join Eclipse' : mode === 'forgot' ? 'Reset Password' : 'Verify Email'}
          </h1>
          <p className="text-sm opacity-50 mt-2">
            {mode === 'login' ? 'Enter your credentials to access your dashboard.' : 
             mode === 'register' ? 'Create your account to start learning.' : 
             mode === 'forgot' ? 'We will send you a link to reset your password.' :
             'Enter the 6-digit code sent to your email.'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-sm"
            >
              <AlertCircle size={18} className="shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 text-green-500 text-sm"
            >
              <CheckCircle2 size={18} className="shrink-0" />
              <p>{success}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {mode === 'verify' ? (
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 ml-2">Verification Code</label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={20} />
                <input 
                  type="text"
                  required
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="000000"
                  className="w-full pl-12 pr-4 py-4 bg-black/5 dark:bg-white/5 placeholder:opacity-20 rounded-2xl border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all text-center text-2xl tracking-[1em] font-black"
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify & Create Account'}
            </button>
            <button 
              type="button"
              onClick={() => setMode('register')}
              className="w-full text-sm font-bold opacity-50 hover:opacity-100 transition-opacity"
            >
              Back to Registration
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 ml-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={20} />
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@school.edu"
                    className="w-full pl-12 pr-4 py-4 bg-black/5 dark:bg-white/5 placeholder:opacity-20 rounded-2xl border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 ml-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={20} />
                    <input 
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-4 bg-black/5 dark:bg-white/5 placeholder:opacity-20 rounded-2xl border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                    />
                  </div>
                </div>
              )}

              {mode === 'register' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 ml-2">Username</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={20} />
                      <input 
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="John Doe"
                        className="w-full pl-12 pr-4 py-4 bg-black/5 dark:bg-white/5 placeholder:opacity-20 rounded-2xl border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 ml-2">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={20} />
                      <input 
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full pl-12 pr-4 py-4 bg-black/5 dark:bg-white/5 placeholder:opacity-20 rounded-2xl border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={cn(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                        consentMic ? "bg-black dark:bg-white border-black dark:border-white" : "border-black/20 dark:border-white/20 group-hover:border-black/40 dark:group-hover:border-white/40"
                      )} onClick={() => setConsentMic(!consentMic)}>
                        {consentMic && <Mic size={14} className="text-white dark:text-black" />}
                      </div>
                      <span className="text-xs opacity-70">I consent to microphone usage for AI tutoring.</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={cn(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                        consentCam ? "bg-black dark:bg-white border-black dark:border-white" : "border-black/20 dark:border-white/20 group-hover:border-black/40 dark:group-hover:border-white/40"
                      )} onClick={() => setConsentCam(!consentCam)}>
                        {consentCam && <Camera size={14} className="text-white dark:text-black" />}
                      </div>
                      <span className="text-xs opacity-70">I consent to camera usage for student monitoring.</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}
                  <ArrowRight size={20} />
                </>
              )}
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-black/10 dark:border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-zinc-900 px-2 text-black/30 dark:text-white/30 font-bold tracking-widest">Or continue with</span>
              </div>
            </div>

            <button 
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-4 bg-white dark:bg-black text-black dark:text-white border border-black/10 dark:border-white/10 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-all disabled:opacity-50"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" referrerPolicy="no-referrer" />
              Sign in with Google
            </button>

            <div className="flex flex-col gap-4 text-center">
              {mode === 'login' ? (
                <>
                  <button 
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-sm font-bold opacity-50 hover:opacity-100 transition-opacity"
                  >
                    Don't have an account? <span className="opacity-100 underline underline-offset-4">Register</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs font-medium opacity-30 hover:opacity-100 transition-opacity"
                  >
                    Forgot password?
                  </button>
                </>
              ) : (
                <button 
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-sm font-bold opacity-50 hover:opacity-100 transition-opacity"
                >
                  Already have an account? <span className="opacity-100 underline underline-offset-4">Sign In</span>
                </button>
              )}
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
