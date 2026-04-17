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
  OAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import Logo from '../../../src/components/ui/Logo';
import { cn } from '../lib/utils';

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

  const handleAppleSignIn = async () => {
    setError(null);
    setLoading(true);
    const provider = new OAuthProvider('apple.com');
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if profile exists
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          uid: user.uid,
          displayName: user.displayName || 'Anonymous',
          email: user.email,
          rank: 'Welcome',
          createdAt: new Date().toISOString(),
          xp: 0,
          level: 1,
          streak: 0,
          loginDays: 1,
          consents: {
            microphone: true,
            camera: true
          }
        });

        await setDoc(doc(db, 'public_profiles', user.uid), {
          uid: user.uid,
          displayName: user.displayName || 'Anonymous',
          photoURL: user.photoURL,
          level: 1,
          rank: 'Welcome',
          xp: 0
        });
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message);
      }
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
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if profile exists
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        // Create initial profile if it doesn't exist
        await setDoc(docRef, {
          uid: user.uid,
          displayName: user.displayName || 'Anonymous',
          email: user.email,
          rank: 'Welcome',
          createdAt: new Date().toISOString(),
          xp: 0,
          level: 1,
          streak: 0,
          loginDays: 1,
          consents: {
            microphone: true,
            camera: true
          }
        });

        await setDoc(doc(db, 'public_profiles', user.uid), {
          uid: user.uid,
          displayName: user.displayName || 'Anonymous',
          photoURL: user.photoURL,
          level: 1,
          rank: 'Welcome',
          xp: 0
        });
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-gold/5 border border-gold/10 rounded-[3rem] p-8 md:p-12 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <Logo size="lg" variant="teacher" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-gold uppercase italic">
            {mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Join Eclipse' : mode === 'forgot' ? 'Reset Password' : 'Verify Email'}
          </h1>
          <p className="text-sm opacity-50 text-gold mt-2">
            {mode === 'login' ? 'Enter your credentials to access the teacher console.' : 
             mode === 'register' ? 'Create your educator account to start teaching.' : 
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
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 text-gold ml-2">Verification Code</label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-gold" size={20} />
                <input 
                  type="text"
                  required
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="000000"
                  className="w-full pl-12 pr-4 py-4 bg-gold/10 text-gold placeholder:text-gold/20 rounded-2xl border border-gold/20 focus:outline-none focus:ring-2 focus:ring-gold/10 transition-all text-center text-2xl tracking-[1em] font-black"
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gold text-royal-red rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify & Create Account'}
            </button>
            <button 
              type="button"
              onClick={() => setMode('register')}
              className="w-full text-sm font-bold text-gold opacity-50 hover:opacity-100 transition-opacity"
            >
              Back to Registration
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 text-gold ml-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-gold" size={20} />
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@school.edu"
                    className="w-full pl-12 pr-4 py-4 bg-gold/10 text-gold placeholder:text-gold/20 rounded-2xl border border-gold/20 focus:outline-none focus:ring-2 focus:ring-gold/10 transition-all"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 text-gold ml-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-gold" size={20} />
                    <input 
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-4 bg-gold/10 text-gold placeholder:text-gold/20 rounded-2xl border border-gold/20 focus:outline-none focus:ring-2 focus:ring-gold/10 transition-all"
                    />
                  </div>
                </div>
              )}

              {mode === 'register' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 text-gold ml-2">Username</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-gold" size={20} />
                      <input 
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Professor X"
                        className="w-full pl-12 pr-4 py-4 bg-gold/10 text-gold placeholder:text-gold/20 rounded-2xl border border-gold/20 focus:outline-none focus:ring-2 focus:ring-gold/10 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 text-gold ml-2">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-gold" size={20} />
                      <input 
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full pl-12 pr-4 py-4 bg-gold/10 text-gold placeholder:text-gold/20 rounded-2xl border border-gold/20 focus:outline-none focus:ring-2 focus:ring-gold/10 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={cn(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                        consentMic ? "bg-gold border-gold" : "border-gold/20 group-hover:border-gold/40"
                      )} onClick={() => setConsentMic(!consentMic)}>
                        {consentMic && <Mic size={14} className="text-royal-red" />}
                      </div>
                      <span className="text-xs text-gold opacity-70">I consent to microphone usage for AI tutoring.</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={cn(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                        consentCam ? "bg-gold border-gold" : "border-gold/20 group-hover:border-gold/40"
                      )} onClick={() => setConsentCam(!consentCam)}>
                        {consentCam && <Camera size={14} className="text-royal-red" />}
                      </div>
                      <span className="text-xs text-gold opacity-70">I consent to camera usage for student monitoring.</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gold text-royal-red rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl disabled:opacity-50"
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
                <div className="w-full border-t border-gold/10"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-royal-red px-2 text-gold opacity-30 font-bold tracking-widest">Or continue with</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-4 bg-gold/5 border border-gold/20 text-gold rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gold/10 transition-all disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.27.81-.57z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>

              <button 
                type="button"
                onClick={handleAppleSignIn}
                disabled={loading}
                className="w-full py-4 bg-gold/5 border border-gold/20 text-gold rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gold/10 transition-all disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M17.05 20.28c-.96.95-2.44 1.78-3.99 1.72-1.55-.06-2.69-.94-3.56-.94-.87 0-2.23.94-3.56.94-1.55.06-3.03-.77-3.99-1.72-1.92-1.91-1.92-5.01 0-6.92.96-.95 2.44-1.78 3.99-1.72 1.55.06 2.69.94 3.56.94.87 0 2.23-.94 3.56-.94 1.55-.06 3.03.77 3.99 1.72 1.92 1.91 1.92 5.01 0 6.92zM12 10.1c-.12-2.61 2.04-4.84 4.59-5.1.26 2.61-2.04 4.84-4.59 5.1z" />
                </svg>
                Sign in with Apple
              </button>
            </div>

            <div className="flex flex-col gap-4 text-center">
              {mode === 'login' ? (
                <>
                  <button 
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-sm font-bold text-gold opacity-50 hover:opacity-100 transition-opacity"
                  >
                    Don't have an account? <span className="text-gold opacity-100 underline underline-offset-4">Register</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs font-medium text-gold opacity-30 hover:opacity-100 transition-opacity"
                  >
                    Forgot password?
                  </button>
                </>
              ) : (
                <button 
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-sm font-bold text-gold opacity-50 hover:opacity-100 transition-opacity"
                >
                  Already have an account? <span className="text-gold opacity-100 underline underline-offset-4">Sign In</span>
                </button>
              )}
            </div>

            <div className="pt-8 text-center">
              <Link 
                to="/privacy" 
                className="text-[10px] font-bold uppercase tracking-widest opacity-30 hover:opacity-100 transition-opacity text-gold"
              >
                Privacy Policy
              </Link>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
