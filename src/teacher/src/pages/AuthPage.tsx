import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, Phone, Shield, Camera, Mic, ArrowRight, CheckCircle2, AlertCircle, Loader2, Cookie, Info } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { ThemeContext } from '@/lib/contexts';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import Logo from '@/components/ui/Logo';
import { cn } from '@/lib/utils';

type AuthMode = 'login' | 'register' | 'forgot' | 'verify';

export default function AuthPage() {
  const { isDark } = useContext(ThemeContext);
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
        setSuccess("Reset link triggered! Check your inbox & SPAM folder.");
        setMode('login');
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError("Invalid credentials.");
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(`Security Warning: The domain "${window.location.hostname}" is not yet authorized in the Firebase Console. Please add it to "Authorized Domains" under Authentication > Settings to enable access.`);
      } else if (err.code === 'auth/too-many-requests') {
        setError("Security limit reached. Please wait a few minutes.");
      } else {
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
        username: username.toLowerCase(),
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
        username: username.toLowerCase(),
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
    <div className={cn("min-h-screen flex items-center justify-center px-4 py-12 transition-colors duration-500")}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "w-full max-w-md border rounded-[3rem] p-8 md:p-12 shadow-2xl transition-all relative overflow-hidden",
          isDark 
            ? "bg-gold/10 border-gold/20 shadow-gold/10" 
            : "bg-white border-gold shadow-xl"
        )}
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gold/30" />
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <Logo size="lg" variant="teacher" />
          </div>
          <h1 className={cn("text-5xl font-black tracking-tighter uppercase italic leading-none mb-4", isDark ? "text-gold" : "text-royal-red")}>
            {mode === 'login' ? 'Teacher Portal' : mode === 'register' ? 'Join Eclipse' : mode === 'forgot' ? 'Reset Password' : 'Verify Email'}
          </h1>
          <p className={cn("text-sm px-4 opacity-70", isDark ? "text-gold" : "text-royal-red")}>
            {mode === 'login' ? 'Empower your classroom with the most advanced AI helper ever built. Sign in to continue your journey.' : 
             mode === 'register' ? 'Join thousands of teachers supercharging their classroom with Eclipse.' : 
             mode === 'forgot' ? 'Recover your password and resume your lessons in seconds.' :
             'Securely verify your identity to protect student privacy and classrooms.'}
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
              <label className={cn("text-[10px] font-bold uppercase tracking-widest opacity-50 ml-2", isDark ? "text-gold" : "text-royal-red")}>Verification Code</label>
              <div className="relative">
                <Shield className={cn("absolute left-4 top-1/2 -translate-y-1/2 opacity-30", isDark ? "text-gold" : "text-royal-red")} size={20} />
                <input 
                  type="text"
                  required
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="000000"
                  className={cn(
                    "w-full pl-12 pr-4 py-4 rounded-2xl border focus:outline-none focus:ring-2 transition-all text-center text-2xl tracking-[1em] font-black placeholder:opacity-20",
                    isDark ? "bg-gold/10 text-gold border-gold/20 focus:ring-gold/10" : "bg-royal-red/5 text-royal-red border-royal-red/10 focus:ring-royal-red/5"
                  )}
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className={cn(
                "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl disabled:opacity-50",
                isDark ? "bg-gold text-royal-red" : "bg-royal-red text-gold"
              )}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify & Create Account'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
              <label className={cn("text-[10px] font-bold uppercase tracking-widest opacity-80 ml-2", isDark ? "text-gold" : "text-royal-red")}>Email Address</label>
                <div className="relative">
                  <Mail className={cn("absolute left-4 top-1/2 -translate-y-1/2 opacity-30", isDark ? "text-gold" : "text-royal-red")} size={20} />
                    <input 
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="teacher@school.edu"
                      className={cn(
                        "w-full pl-12 pr-4 py-4 rounded-2xl border focus:outline-none focus:ring-2 transition-all",
                        isDark ? "bg-gold/15 text-gold border-gold/40 focus:ring-gold/30" : "bg-royal-red/10 text-royal-red border-royal-red/30 focus:ring-royal-red/20 placeholder:text-royal-red/50"
                      )}
                    />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-2">
                  <label className={cn("text-[10px] font-bold uppercase tracking-widest opacity-80 ml-2", isDark ? "text-gold" : "text-royal-red")}>Password</label>
                  <div className="relative">
                    <Lock className={cn("absolute left-4 top-1/2 -translate-y-1/2 opacity-30", isDark ? "text-gold" : "text-royal-red")} size={20} />
                  <input 
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={cn(
                      "w-full pl-12 pr-4 py-4 rounded-2xl border focus:outline-none focus:ring-2 transition-all",
                      isDark ? "bg-gold/15 text-gold border-gold/40 focus:ring-gold/30" : "bg-royal-red/10 text-royal-red border-royal-red/30 focus:ring-royal-red/20 placeholder:text-royal-red/50"
                    )}
                  />
                  </div>
                </div>
              )}

              {mode === 'register' && (
                <>
                  <div className="space-y-2">
                    <label className={cn("text-[10px] font-bold uppercase tracking-widest opacity-80 ml-2", isDark ? "text-gold" : "text-royal-red")}>Username</label>
                    <div className="relative">
                      <User className={cn("absolute left-4 top-1/2 -translate-y-1/2 opacity-30", isDark ? "text-gold" : "text-royal-red")} size={20} />
                      <input 
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Professor X"
                        className={cn(
                          "w-full pl-12 pr-4 py-4 rounded-2xl border focus:outline-none focus:ring-2 transition-all",
                          isDark ? "bg-gold/15 text-gold border-gold/40 focus:ring-gold/30" : "bg-royal-red/10 text-royal-red border-royal-red/30 focus:ring-royal-red/20 placeholder:text-royal-red/50"
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={cn("text-[10px] font-bold uppercase tracking-widest opacity-80 ml-2", isDark ? "text-gold" : "text-royal-red")}>Phone Number</label>
                    <div className="relative">
                      <Phone className={cn("absolute left-4 top-1/2 -translate-y-1/2 opacity-30", isDark ? "text-gold" : "text-royal-red")} size={20} />
                      <input 
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000 (Optional)"
                        className={cn(
                          "w-full pl-12 pr-4 py-4 rounded-2xl border focus:outline-none focus:ring-2 transition-all",
                          isDark ? "bg-gold/15 text-gold border-gold/40 focus:ring-gold/30" : "bg-royal-red/10 text-royal-red border-royal-red/30 focus:ring-royal-red/20 placeholder:text-royal-red/50"
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={cn(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                        isDark ? (consentMic ? "bg-gold border-gold" : "border-gold/20") : (consentMic ? "bg-royal-red border-royal-red" : "border-royal-red/20")
                      )} onClick={() => setConsentMic(!consentMic)}>
                        {consentMic && <Mic size={14} className={isDark ? "text-royal-red" : "text-white"} />}
                      </div>
                      <span className={cn("text-xs opacity-70", isDark ? "text-gold" : "text-royal-red")}>I consent to microphone usage for AI tutoring.</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={cn(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                        isDark ? (consentCam ? "bg-gold border-gold" : "border-gold/20") : (consentCam ? "bg-royal-red border-royal-red" : "border-royal-red/20")
                      )} onClick={() => setConsentCam(!consentCam)}>
                        {consentCam && <Camera size={14} className={isDark ? "text-royal-red" : "text-white"} />}
                      </div>
                      <span className={cn("text-xs opacity-70", isDark ? "text-gold" : "text-royal-red")}>I consent to camera usage for student monitoring.</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            <button 
              type="submit"
              disabled={loading}
              className={cn(
                "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl disabled:opacity-50 bg-gold text-royal-red shadow-gold/20"
              )}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}
                  <ArrowRight size={20} />
                </>
              )}
            </button>


            <div className="flex flex-col gap-4 text-center">
              <button 
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className={cn("text-sm font-bold opacity-50 hover:opacity-100 transition-opacity", isDark ? "text-gold" : "text-royal-red")}
              >
                {mode === 'login' ? "Don't have an account? Register" : "Already have an account? Sign In"}
              </button>
              {mode === 'login' && (
                <button 
                  type="button"
                  onClick={() => setMode('forgot')}
                  className={cn("text-xs font-medium opacity-30 hover:opacity-100 transition-opacity", isDark ? "text-gold" : "text-royal-red")}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="pt-8 text-center">
              <Link 
                to="/privacy" 
                className={cn("text-[10px] font-bold uppercase tracking-widest opacity-30 hover:opacity-100 transition-opacity", isDark ? "text-gold" : "text-royal-red")}
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
