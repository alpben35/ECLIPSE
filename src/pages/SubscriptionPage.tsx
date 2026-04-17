import React, { useContext, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Check, Zap, Crown, Infinity as InfinityIcon, ArrowRight, CreditCard, Building2, ShieldCheck, ExternalLink, Settings as SettingsIcon } from 'lucide-react';
import { AuthContext } from '../lib/contexts';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { cn } from '../lib/utils';
import { useLocation } from 'react-router-dom';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    description: 'Perfect for casual learning',
    features: [
      '40 AI prompts per day',
      'Basic progress tracking',
      'Standard tutor response speed',
      'Access to all subjects'
    ],
    buttonText: 'Current Plan',
    highlight: false
  },
  {
    id: 'champion',
    name: 'Champion',
    price: '$25',
    period: '/month',
    description: 'For serious students',
    features: [
      '120 AI prompts per day',
      'Advanced analytics & charts',
      'Faster response times',
      'Priority support',
      'Exclusive study materials'
    ],
    buttonText: 'Upgrade to Champion',
    highlight: true,
    icon: <Crown className="text-amber-500" />
  },
  {
    id: 'master',
    name: 'Master',
    price: '$150',
    period: '/month',
    description: 'Master your subjects',
    features: [
      '500 AI prompts per day',
      'Personalized learning paths',
      'Early access to new features',
      '1-on-1 AI mentorship',
      'Customizable AI personality'
    ],
    buttonText: 'Go Master',
    highlight: false,
    icon: <Zap className="text-blue-500" />
  },
  {
    id: 'admin',
    name: 'Admin',
    price: '$500',
    period: '/month',
    description: 'The ultimate power',
    features: [
      'Unlimited AI prompts',
      'Admin group chat access',
      'Ability to approve ideas',
      'Send ideas to the community',
      'Full platform access'
    ],
    buttonText: 'Become Admin',
    highlight: false,
    icon: <InfinityIcon className="text-purple-500" />
  }
];

import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe((import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY || '');

export default function SubscriptionPage() {
  const { user, profile } = useContext(AuthContext);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showConfigGuide, setShowConfigGuide] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const location = useLocation();
  const isTeacherPortal = location.pathname.startsWith('/teacher');

  useEffect(() => {
    return onSnapshot(doc(db, 'system', 'settings'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data());
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'system/settings'));
  }, []);

  const handleUpgrade = async (tierId: string) => {
    if (!user) return;
    if (tierId === profile?.tier) return;
    setStatusMessage(null);

    // Owner always has admin tier
    const isSystemOwner = user.email === 'alp.ben@gmail.com' || profile?.rank === 'Owner';
    if (isSystemOwner && tierId === 'admin') {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { tier: 'admin', rank: 'Owner' });
        setStatusMessage({ type: 'success', text: "Welcome back, Boss! Owner privileges enabled." });
        return;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
        return;
      }
    }

    const stripeKey = (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY;
    const isMockMode = !stripeKey || stripeKey === 'TODO_STRIPE_KEY' || stripeKey === '' || stripeKey === 'DZ';

    if (isMockMode) {
      setShowConfigGuide(true);
      return;
    }

    try {
      setLoading(true);
      const idToken = await user.getIdToken();
      console.log('[SubscriptionPage] Fetching checkout session for:', tierId);
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ tierId })
      });

      const session = await response.json();
      if (!response.ok || session.error) {
        // If server returns key missing error, show configuration guide
        if (session.error?.includes('missing or invalid')) {
           setShowConfigGuide(true);
           return;
        }
        throw new Error(session.error || 'Failed to create checkout session');
      }

      console.log('[SubscriptionPage] Redirecting to checkout:', session.id);
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to load. Please check your publishable key.');

      const { error } = await (stripe as any).redirectToCheckout({
        sessionId: session.id
      });

      if (error) throw error;
    } catch (error: any) {
      if (!error.message.includes('missing or invalid')) {
        console.error("Upgrade error:", error);
        setStatusMessage({ type: 'error', text: `Failed to upgrade: ${error.message}` });
      } else {
        setShowConfigGuide(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const idToken = await user.getIdToken();
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to open billing portal');
      }

      window.location.href = data.url;
    } catch (error: any) {
      console.error("Portal error:", error);
      setStatusMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const themeClasses = isTeacherPortal ? {
    bg: "bg-royal-red",
    text: "text-gold",
    accent: "text-gold",
    card: "bg-gold/5 border-gold/10",
    cardHighlight: "bg-gold text-royal-red border-transparent shadow-2xl scale-105 z-10",
    button: "bg-gold text-royal-red hover:scale-105",
    buttonHighlight: "bg-white text-royal-red hover:bg-white/90",
    badge: "bg-white text-royal-red",
    icon: "text-gold"
  } : {
    bg: "bg-white dark:bg-black",
    text: "text-black dark:text-white",
    accent: "text-orange-500",
    card: "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10",
    cardHighlight: "bg-black text-white dark:bg-white dark:text-black border-transparent shadow-2xl scale-105 z-10",
    button: "bg-black text-white dark:bg-white dark:text-black hover:scale-105",
    buttonHighlight: "bg-orange-500 text-white hover:bg-orange-600",
    badge: "bg-orange-500 text-white",
    icon: "text-orange-500"
  };

  return (
    <div className={cn("min-h-screen transition-colors duration-500", themeClasses.bg, themeClasses.text)}>
      {(!((import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY) || (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY === 'DZ') && (
        <div className="bg-orange-500 text-white py-2 px-4 text-center text-xs font-bold uppercase tracking-widest animate-pulse">
          Demo Mode Active: Real payments are not configured.
        </div>
      )}
      
      {/* Configuration Guide Modal */}
      {showConfigGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={cn("max-w-xl w-full p-10 rounded-[3rem] border shadow-2xl overflow-hidden relative", themeClasses.card)}
          >
            {/* Background elements for technical feel */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-3xl -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 blur-3xl -ml-16 -mb-16" />
            
            <div className="relative">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-orange-500 rounded-3xl animate-bounce shadow-lg shadow-orange-500/20">
                  <CreditCard className="text-white" size={32} />
                </div>
                <div>
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter leading-none">Configure Payments</h3>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-40 mt-1">Status: Configuration Missing</p>
                </div>
              </div>

              <div className="space-y-6 mb-10">
                <p className="text-sm opacity-70 leading-relaxed font-medium">
                  To enable real payments in your application, you must configure your <span className="text-orange-500 font-bold">Stripe API Keys</span> in the project settings.
                </p>

                <div className="space-y-4">
                  <div className="flex gap-4 p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 group hover:border-orange-500/30 transition-all">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center font-black text-orange-500 italic">01</div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold">Open Project Settings</p>
                      <p className="text-xs opacity-50">Click the gear icon in the AI Studio editor to open your application settings.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 group hover:border-orange-500/30 transition-all">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center font-black text-orange-500 italic">02</div>
                    <div className="space-y-2">
                      <p className="text-sm font-bold">Add Environment Variables</p>
                      <div className="space-y-2">
                        <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 font-mono text-[10px] break-all text-amber-600 dark:text-amber-400">
                          STRIPE_SECRET_KEY = sk_test_...
                        </div>
                        <div className="bg-blue-500/10 p-2 rounded-lg border border-blue-500/20 font-mono text-[10px] break-all text-blue-600 dark:text-blue-400">
                          VITE_STRIPE_PUBLISHABLE_KEY = pk_test_...
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 group hover:border-orange-500/30 transition-all">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center font-black text-orange-500 italic">03</div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold">Restart Dev Server</p>
                      <p className="text-xs opacity-50">The application will refresh and real Stripe Checkout will be enabled.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setShowConfigGuide(false)}
                  className={cn("w-full py-5 rounded-[2rem] font-black uppercase tracking-tighter text-xl transition-all shadow-xl shadow-orange-500/10 hover:scale-[1.02] active:scale-[0.98]", themeClasses.buttonHighlight)}
                >
                  Got it, I'll set it up!
                </button>
                <button 
                  onClick={() => setShowConfigGuide(false)}
                  className="w-full py-4 rounded-2xl font-bold opacity-30 hover:opacity-100 transition-all text-sm tracking-widest uppercase italic"
                >
                  Close Guide
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Status Overlay */}
      {statusMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "fixed top-12 left-1/2 -translate-x-1/2 z-[60] px-8 py-4 rounded-full font-bold shadow-2xl border flex items-center gap-4 min-w-[320px] justify-center",
            statusMessage.type === 'success' ? "bg-green-500 text-white border-green-400" : "bg-red-500 text-white border-red-400"
          )}
        >
          {statusMessage.type === 'success' ? <Check size={20} /> : <Zap size={20} />}
          <span className="text-sm">{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="ml-4 opacity-70 hover:opacity-100">✕</button>
        </motion.div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <button 
              onClick={() => window.history.back()}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all mb-8",
                isTeacherPortal ? "bg-gold/10 hover:bg-gold/20" : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
              )}
            >
              <ArrowRight className="rotate-180" size={18} />
              Back
            </button>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4 italic uppercase">
              Eclipse <span className={themeClasses.accent}>Shop</span>
            </h1>
            <p className="text-xl opacity-50 max-w-xl">
              Level up your learning with powerful AI features and unlimited potential.
            </p>
          </div>

          {profile && (
            <div className={cn("p-8 rounded-[2rem] border flex flex-col items-center text-center min-w-[240px]", themeClasses.card)}>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-2">Current Status</p>
              <div className="flex items-center gap-3 mb-2">
                <Crown size={24} className={themeClasses.icon} />
                <span className="text-3xl font-black italic uppercase tracking-tighter">
                  {profile.tier || 'Free'}
                </span>
              </div>
              <p className="text-xs font-medium opacity-50 uppercase tracking-widest">
                {profile.tier === 'admin' ? 'Unlimited Access' : 'Active Subscription'}
              </p>
              
              {profile.tier && profile.tier !== 'free' && (
                <button 
                  onClick={handleManageSubscription}
                  disabled={loading}
                  className={cn(
                    "mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                    isTeacherPortal ? "bg-white/10 hover:bg-white/20" : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                  )}
                >
                  <SettingsIcon size={12} />
                  Manage / Cancel
                  <ExternalLink size={10} />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {TIERS.map((tier, index) => {
            const tierOrder = ['free', 'champion', 'master', 'admin'];
            const userTierIndex = (profile?.tier === 'admin' || profile?.rank === 'Owner' || profile?.rank === 'Admin' || profile?.rank === 'Temporary Owner') 
              ? 3 
              : tierOrder.indexOf(profile?.tier || 'free');
            const thisTierIndex = tierOrder.indexOf(tier.id);
            const isCurrent = profile?.tier === tier.id || (tier.id === 'admin' && userTierIndex === 3 && !profile?.tier);
            const isLegacy = thisTierIndex < userTierIndex;

            return (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className={cn(
                  "relative p-8 rounded-[3rem] border flex flex-col h-full transition-all duration-500",
                  tier.highlight 
                    ? themeClasses.cardHighlight
                    : themeClasses.card,
                  isCurrent && "ring-4 ring-orange-500 ring-offset-4 dark:ring-offset-black"
                )}
              >
                {tier.highlight && (
                  <div className={cn(
                    "absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full",
                    themeClasses.badge
                  )}>
                    Most Popular
                  </div>
                )}

                <div className="flex items-center justify-between mb-8">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter">{tier.name}</h3>
                    <p className="text-sm opacity-50">{tier.description}</p>
                  </div>
                  {tier.icon}
                </div>

                <div className="mb-8">
                  <span className="text-5xl font-black tracking-tighter">{tier.price}</span>
                  {tier.period && <span className="text-xl opacity-50">{tier.period}</span>}
                </div>

                <div className="space-y-4 mb-12 flex-grow">
                  {tier.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={cn(
                        "mt-1 p-0.5 rounded-full",
                        tier.highlight ? (isTeacherPortal ? "bg-royal-red/20" : "bg-orange-500") : (isTeacherPortal ? "bg-gold/20" : "bg-black/10 dark:bg-white/10")
                      )}>
                        <Check size={12} className={tier.highlight ? (isTeacherPortal ? "text-royal-red" : "text-white") : (isTeacherPortal ? "text-gold" : "text-black dark:text-white")} />
                      </div>
                      <span className="text-sm opacity-80">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleUpgrade(tier.id)}
                  disabled={isCurrent || isLegacy}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                    (isCurrent || isLegacy)
                      ? (isTeacherPortal ? "bg-gold/10 cursor-default opacity-50" : "bg-black/10 dark:bg-white/10 cursor-default opacity-50")
                      : tier.highlight
                        ? themeClasses.buttonHighlight
                        : themeClasses.button
                  )}
                >
                  {isCurrent ? 'Current Plan' : isLegacy ? 'Included' : tier.buttonText}
                  {(!isCurrent && !isLegacy) && <ArrowRight size={18} />}
                </button>
              </motion.div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className={cn("p-8 rounded-[3rem] border", themeClasses.card)}>
            <div className="flex items-center gap-4 mb-6">
              <div className={cn("p-3 rounded-2xl", themeClasses.card)}>
                <ShieldCheck className={themeClasses.icon} size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold">Secure Payment</h3>
                <p className="text-sm opacity-50">Choose your preferred method</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
                <CreditCard size={16} />
                <span className="text-xs font-bold">Credit/Debit Card</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
                <Building2 size={16} />
                <span className="text-xs font-bold">Bank Account (ACH/Direct)</span>
              </div>
            </div>
            
            <p className="mt-6 text-xs opacity-50 leading-relaxed">
              All transactions are encrypted and processed securely via Stripe. We do not store your sensitive payment information on our servers.
            </p>
          </div>

          {settings?.bankAccount && !settings.bankAccount.startsWith('acct_') && (
            <div className={cn("p-8 rounded-[3rem] border border-orange-500/20 bg-orange-500/5", themeClasses.text)}>
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-orange-500 text-white rounded-2xl">
                  <Building2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Manual Bank Transfer</h3>
                  <p className="text-sm opacity-50">Direct deposit available</p>
                </div>
              </div>
              
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-black/10 dark:border-white/10 mb-4">
                <p className="text-xs opacity-50 mb-1 uppercase tracking-widest font-bold">Account Details</p>
                <p className="font-mono text-sm break-all">{settings.bankAccount}</p>
              </div>

              <p className="text-xs opacity-50 leading-relaxed">
                If you prefer to pay manually, please use the details above. After transfer, send your receipt to <strong>support@eclipse.ai</strong> or use the chat to notify our team.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
