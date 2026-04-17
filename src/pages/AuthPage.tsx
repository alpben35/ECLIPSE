import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, AlertCircle, Loader2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { 
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { Link } from 'react-router-dom';
import Logo from '../components/ui/Logo';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError("Google Login is not enabled in the Firebase Console. Please go to Authentication -> Sign-in method and enable 'Google'.");
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-[3rem] p-8 md:p-12 shadow-2xl overflow-hidden relative"
      >
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-purple-500 to-blue-500" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/10 blur-[100px] rounded-full" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/10 blur-[100px] rounded-full" />

        <div className="text-center mb-10 relative z-10">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none mb-4">
            Eclipse <span className="text-orange-500">AI</span>
          </h1>
          <p className="text-sm opacity-50 px-4">
            Master your future with the most powerful AI tutor ever built. Sign in to continue your journey.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-sm"
            >
              <AlertCircle size={18} className="shrink-0" />
              <p className="font-medium leading-tight">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4 relative z-10">
          <button 
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-5 bg-black text-white dark:bg-white dark:text-black rounded-3xl font-black uppercase italic tracking-tight flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl disabled:opacity-50 group"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                <div className="w-8 h-8 bg-white dark:bg-black rounded-xl flex items-center justify-center shadow-inner group-hover:rotate-[360deg] transition-transform duration-700">
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" referrerPolicy="no-referrer" />
                </div>
                <span className="text-lg">Sign in with Google</span>
              </>
            )}
          </button>

          <p className="text-[10px] text-center opacity-30 mt-8 leading-relaxed font-bold uppercase tracking-widest px-8">
            By signing in, you agree to our terms of service and acknowledge you are using advanced AI tools.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-black/5 dark:border-white/5 text-center relative z-10">
          <Link 
            to="/privacy" 
            className="text-[10px] font-bold uppercase tracking-widest opacity-30 hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
          >
            <Shield size={12} />
            Privacy & Security
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
