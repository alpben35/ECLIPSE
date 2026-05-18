import React, { useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Zap, Crown, Infinity as InfinityIcon, ArrowRight, Building2, ShieldCheck, ExternalLink, Settings as SettingsIcon, Key } from 'lucide-react';
import { AuthContext } from '../lib/contexts';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { cn } from '../lib/utils';
import { useLocation } from 'react-router-dom';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '£0',
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
    id: 'premium',
    priceId: import.meta.env.VITE_STRIPE_PRICE_ID_PREMIUM,
    name: 'Eclipse Premium',
    price: '£40',
    period: '/month',
    description: 'Full educational power',
    features: [
      '500 AI prompts per day',
      'Advanced analytics & diagnostics',
      'Faster response times',
      'Priority support',
      'AI personality customization'
    ],
    buttonText: 'Get Premium',
    highlight: true,
    icon: <Zap className="text-black dark:text-white" />
  },
  {
    id: 'admin',
    priceId: import.meta.env.VITE_STRIPE_PRICE_ID_ADMIN,
    name: 'Eclipse Admin',
    price: '£500',
    period: '/month',
    description: 'The ultimate power',
    features: [
      'Unlimited AI prompts',
      'Admin group chat access',
      'Ability to approve ideas',
      'Send ideas to the community',
      'Full platform access'
    ],
    buttonText: 'Enter Admin Tier',
    highlight: false,
    icon: <InfinityIcon className="text-gold dark:text-white" />
  }
];

export default function SubscriptionPage() {
  const { user, profile } = useContext(AuthContext);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState('Preparing your secure connection...');
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
    console.log(`[Shop] Attempting upgrade to ${tierId}...`);
    if (!user) {
      setStatusMessage({ type: 'error', text: 'Auth Error: No user identified. Please refresh or sign in again.' });
      return;
    }
    if (tierId === profile?.tier) {
      setStatusMessage({ type: 'success', text: 'You are already on this tier!' });
      return;
    }
    setStatusMessage(null);

    const tier = TIERS.find(t => t.id === tierId);
    if (!tier) {
      console.warn(`[Shop] Tier ${tierId} not found in TIERS configuration.`);
      return;
    }

    if (tierId === 'free') return;

    try {
      setRedirecting(true);
      setRedirectMessage('Establishing secure connection to Stripe...');
      
      const payload = { 
        priceId: tier.priceId,
        tierId: tier.id,
        userId: user.uid,
        userEmail: user.email || profile?.email
      };
      
      console.log(`[Shop] Sending request to /api/create-checkout-session`, payload);

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        setRedirecting(false);
        const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json();
      console.log(`[Shop] Server response:`, data);
      
      if (data.url) {
        setRedirectMessage('Redirecting to Checkout...');
        window.location.href = data.url;
      } else {
        setRedirecting(false);
        throw new Error("The server did not return a checkout URL. Please check server logs.");
      }
    } catch (error: any) {
      setRedirecting(false);
      console.error("Stripe Checkout Error:", error);
      setStatusMessage({ 
        type: 'error', 
        text: `Stripe Integration Error: ${error.message}` 
      });
    }
  };

  const handleManageBilling = async () => {
    if (!user) return;
    if (!profile?.stripeCustomerId) {
      setStatusMessage({
        type: 'success',
        text: "Please email support@eclipse.ai with your account details to manage your manual subscription."
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: profile.stripeCustomerId })
      });

      const { url, error } = await response.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err: any) {
      console.error("Portal Error:", err);
      setStatusMessage({ type: 'error', text: `Portal Error: ${err.message}` });
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
    bg: "bg-zinc-950",
    text: "text-white",
    accent: "text-white",
    card: "bg-white/5 border-white/10",
    cardHighlight: "bg-white text-black border-transparent shadow-2xl scale-105 z-10",
    button: "bg-white text-black hover:scale-105",
    buttonHighlight: "bg-black text-white hover:bg-zinc-900 dark:bg-white dark:text-black dark:hover:bg-zinc-200",
    badge: "bg-black text-white dark:bg-white dark:text-black",
    icon: "text-white"
  };

  return (
    <div className={cn("min-h-screen transition-colors duration-500", themeClasses.bg, themeClasses.text)}>
      <AnimatePresence>
        {redirecting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl text-white"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: 360
              }}
              transition={{ 
                duration: 1.5,
                repeat: Infinity,
                ease: "linear"
              }}
              className="mb-8"
            >
              <Zap size={64} className="text-yellow-400 fill-yellow-400 drop-shadow-[0_0_25px_rgba(250,204,21,0.6)]" />
            </motion.div>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2">{redirectMessage}</h2>
            <p className="text-white/50 font-medium tracking-wide">Secure protocol initiated. Do not close this window.</p>
          </motion.div>
        )}
      </AnimatePresence>

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
            <p className="text-xl opacity-50 max-w-xl text-balance">
              Level up your learning with exclusive premium features.
            </p>
          </div>

          {profile && (
            <div className={cn("p-8 rounded-[2rem] border flex flex-col items-center text-center min-w-[240px]", themeClasses.card)}>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-2">Current Status</p>
              <div className="flex items-center gap-3 mb-1">
                <Crown size={24} className={themeClasses.icon} />
                <span className="text-3xl font-black italic uppercase tracking-tighter">
                  {profile.tier ? (profile.tier === 'premium' ? 'Premium' : profile.tier.charAt(0).toUpperCase() + profile.tier.slice(1)) : 'Free'}
                </span>
              </div>
              <p className="text-[10px] font-bold opacity-80 mb-2 truncate max-w-[200px]">
                {profile.email}
              </p>
              <p className="text-xs font-medium opacity-100 uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                {profile.tier === 'admin' ? 'Unlimited Access' : 'Active Subscription'}
              </p>
              
              {profile.tier && profile.tier !== 'free' && (
                <button 
                  onClick={handleManageBilling}
                  disabled={loading}
                  className={cn(
                    "mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                    isTeacherPortal 
                      ? "bg-white/10 hover:bg-white/20 text-white" 
                      : "bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-black dark:text-white"
                  )}
                >
                  <SettingsIcon size={12} className={loading ? "animate-spin" : ""} />
                  {loading ? "Connecting..." : "Manage Billing"}
                  <ExternalLink size={10} />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 max-w-5xl mx-auto">
          {TIERS.map((tier, index) => {
            const tierOrder = ['free', 'premium', 'admin'];
            const userTierIndex = (profile?.tier === 'admin' || profile?.rank === 'Owner' || profile?.rank === 'Admin' || profile?.rank === 'Temporary Owner') 
              ? 2 
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
                  isCurrent && "ring-4 ring-white ring-offset-4 dark:ring-offset-black"
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

                <div className="mb-8 flex flex-col">
                  <span className="text-5xl font-black tracking-tighter">{tier.price}</span>
                  {tier.period && <span className="text-xs opacity-50 font-bold uppercase tracking-widest mt-1">{tier.period}</span>}
                </div>

                <div className="space-y-4 mb-12 flex-grow">
                  {tier.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={cn(
                        "mt-1 p-0.5 rounded-full",
                        tier.highlight ? (isTeacherPortal ? "bg-royal-red/20" : "bg-black dark:bg-white") : (isTeacherPortal ? "bg-gold/20" : "bg-black/10 dark:bg-white/10")
                      )}>
                        <Check size={12} className={tier.highlight ? (isTeacherPortal ? "text-royal-red" : "text-white") : (isTeacherPortal ? "text-gold" : "text-black dark:text-white")} />
                      </div>
                      <span className="text-sm opacity-80">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    console.log(`[Shop] Upgrade requested for ${tier.id}`);
                    handleUpgrade(tier.id);
                  }}
                  disabled={isCurrent || isLegacy || loading}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                    (isCurrent || isLegacy)
                      ? (isTeacherPortal ? "bg-gold/10 cursor-default opacity-50" : "bg-black/10 dark:bg-white/10 cursor-default opacity-50")
                      : tier.highlight
                        ? themeClasses.buttonHighlight
                        : themeClasses.button,
                    loading && "opacity-70 cursor-wait"
                  )}
                >
                  {loading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                      <Zap size={18} />
                    </motion.div>
                  ) : (
                    <>
                      {isCurrent ? 'Current Plan' : isLegacy ? 'Included' : tier.buttonText}
                      {(!isCurrent && !isLegacy) && <ArrowRight size={18} />}
                    </>
                  )}
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
                <h3 className="text-xl font-bold">Secure Upgrade</h3>
                <p className="text-sm opacity-50">Request a tier change</p>
              </div>
            </div>
            
            <p className="text-sm opacity-70 leading-relaxed font-medium">
              Click any plan above to submit an upgrade request. Our administration team will review your account and contact you within 24 hours to complete the process.
            </p>
            
            <p className="mt-6 text-xs opacity-50 leading-relaxed">
              For immediate assistance, please use the platform chat or email support@eclipse.ai.
            </p>
          </div>

          <div className={cn("p-8 rounded-[3rem] border border-white/10 bg-white/5", themeClasses.text)}>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl shadow-lg">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold">Safe & Secure</h3>
                <p className="text-sm opacity-50">Verified Upgrades</p>
              </div>
            </div>
            <p className="text-sm opacity-70 leading-relaxed">
              Your security is our priority. All account changes are manually verified to ensure the highest level of integrity and protection for your data.
            </p>
            <div className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-black dark:bg-white text-white dark:text-black w-fit px-3 py-1 rounded-full">
              Identity Verified
            </div>
          </div>

          <div className={cn("p-8 rounded-[3rem] border border-white/10 bg-white/5 md:col-span-2", themeClasses.text)}>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl shadow-xl">
                <Check size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold">Account Verification</h3>
                <p className="text-sm opacity-50">Verified status & Tier management</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <p className="text-sm opacity-70 leading-relaxed font-medium">
                  Your <strong className="text-black dark:text-white">Profile</strong> is securely synced across all your devices. All educational content and progress are stored in your private cloud vault.
                </p>
              </div>
              <div className="space-y-4">
                <p className="text-sm opacity-70 leading-relaxed font-medium">
                  Memberships are processed via <strong className="text-black dark:text-white">secure encrypted channels</strong>. Tier upgrades grant immediate access to advanced AI modules and priority servers.
                </p>
              </div>
            </div>
          </div>

          {settings?.bankAccount && !settings.bankAccount.startsWith('acct_') && (
            <div className={cn("p-8 rounded-[3rem] border border-white/10 bg-white/5", themeClasses.text)}>
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl">
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
