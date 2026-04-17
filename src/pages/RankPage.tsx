import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Award, CreditCard, ChevronRight, Shield, Zap, Star, Crown, Check, Info, Lightbulb, XCircle } from 'lucide-react';
import { AuthContext } from '../lib/contexts';
import { RANKS, OWNER_EMAIL } from '../constants';
import { Link } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

import confetti from 'canvas-confetti';

const RANK_PERKS: Record<string, string[]> = {
  'Welcome': ['Basic AI Tutoring', 'Daily Progress Tracking'],
  'Member': ['Custom Profile Themes', 'Priority AI Response'],
  'Elder': ['Idea Submission Power', 'Community Badge'],
  'Master': ['Advanced Analytics', 'Early Feature Access'],
  'Champion': ['Idea Review Authority', 'Exclusive UI Elements'],
  'Olympian': ['Direct Line to Admins', 'Priority Support'],
  'Admin': ['Full User Management', 'System Monitoring'],
  'Supreme Admin': ['Global Announcements', 'Ultimate Authority'],
  'Owner': ['System Customization', 'Full Database Access'],
};

export default function RankPage() {
  const { user, profile } = useContext(AuthContext);
  const [selectedRank, setSelectedRank] = useState<{ name: string, price: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const currentRankIndex = Math.max(0, RANKS.findIndex(r => r.name === profile?.rank));
  const userRank = profile?.email === OWNER_EMAIL ? 'Owner' : profile?.rank || 'Welcome';

  const handlePurchase = async () => {
    if (!user || !profile || !selectedRank) return;

    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        rank: selectedRank.name
      });
      
      // Dopamine hit: Confetti!
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 200 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      setShowSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 4000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const calculatePrice = (targetIndex: number) => {
    if (targetIndex <= currentRankIndex) return { original: 0, discounted: 0, hasDiscount: false };
    
    let total = 0;
    for (let i = currentRankIndex + 1; i <= targetIndex; i++) {
      total += RANKS[i].price;
    }

    // 20% discount for skips of more than 2 stops
    const stops = targetIndex - currentRankIndex;
    if (stops > 2) {
      return { original: total, discounted: Math.round(total * 0.8), hasDiscount: true };
    }
    return { original: total, discounted: total, hasDiscount: false };
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-16">
      <div className="text-center space-y-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 text-orange-500 rounded-full text-xs font-black tracking-widest uppercase"
        >
          <Star size={14} />
          Your Current Rank: {userRank}
        </motion.div>
        <h1 className="text-6xl font-black tracking-tighter italic">ASCENSION</h1>
        <p className="opacity-50 max-w-xl mx-auto text-lg leading-relaxed">
          The hierarchy of Eclipse is built on merit and commitment. 
          Ascend to unlock deeper levels of authority and influence.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {RANKS.filter(r => r.name !== 'Temporary Owner' && r.name !== 'Owner').map((rank, index) => {
          const isCurrent = rank.name === profile?.rank;
          const isLocked = index < currentRankIndex;
          const isAvailable = index > currentRankIndex;
          const isNext = index === currentRankIndex + 1;
          const pricing = calculatePrice(index);
          const canBuySupreme = rank.name === 'Supreme Admin' ? currentRankIndex >= RANKS.findIndex(r => r.name === 'Champion') : true;
          const perks = RANK_PERKS[rank.name] || [];

          return (
            <motion.div 
              key={rank.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={isAvailable ? { y: -10 } : {}}
              className={`relative p-8 rounded-[2.5rem] flex flex-col justify-between border-2 transition-all duration-500 ${
                isCurrent ? 'bg-black text-white dark:bg-white dark:text-black border-transparent shadow-2xl scale-105 z-10' : 
                isNext ? 'bg-black/5 dark:bg-white/5 border-orange-500/50 shadow-[0_0_30px_rgba(249,115,22,0.1)]' :
                isLocked ? 'bg-black/5 dark:bg-white/5 border-transparent opacity-40' :
                'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5'
              }`}
            >
              {isNext && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-orange-500 text-white text-[10px] font-black rounded-full shadow-lg z-20">
                  RECOMMENDED PATH
                </div>
              )}
              
              {pricing.hasDiscount && isAvailable && !isNext && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-black text-white dark:bg-white dark:text-black text-[10px] font-black rounded-full shadow-lg z-20">
                  -20% BUNDLE OFFER
                </div>
              )}

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-2xl ${isCurrent ? 'bg-white/10' : 'bg-black/5 dark:bg-white/5'}`}>
                    <Award size={24} className={isCurrent ? 'opacity-100' : 'opacity-40'} />
                  </div>
                  {isCurrent && <Check size={20} className="text-green-500" />}
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-2xl font-black tracking-tight uppercase leading-none">{rank.name}</h3>
                  <p className="text-[10px] opacity-50 font-bold tracking-widest uppercase">
                    {rank.minDays} Days Milestone
                  </p>
                </div>

                <div className="space-y-2">
                  {perks.map((perk, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] font-medium opacity-70">
                      <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                      {perk}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-12 space-y-6">
                {isAvailable ? (
                  <div className="space-y-4">
                    <div className="flex flex-col">
                      {pricing.hasDiscount && (
                        <span className="text-sm line-through opacity-30 font-bold">${pricing.original}</span>
                      )}
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black tracking-tighter">${pricing.discounted}</span>
                        <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest">One-time</span>
                      </div>
                    </div>
                    
                    {!canBuySupreme && rank.name === 'Supreme Admin' ? (
                      <div className="flex items-start gap-2 p-3 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-bold">
                        <Info size={14} className="shrink-0" />
                        REQUIRE CHAMPION RANK TO PURCHASE
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <button 
                          onClick={() => setSelectedRank({ name: rank.name, price: pricing.discounted })}
                          className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                            isNext ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:scale-105' : 'bg-black text-white dark:bg-white dark:text-black hover:scale-105'
                          }`}
                        >
                          <CreditCard size={18} /> Upgrade
                        </button>
                        <Link 
                          to="/ideas"
                          className="w-full py-3 bg-black/5 dark:bg-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <Lightbulb size={12} /> View Ideas
                        </Link>
                      </div>
                    )}
                  </div>
                ) : isCurrent ? (
                  <div className="py-4 text-center font-bold text-[10px] opacity-50 uppercase tracking-[0.2em] border border-current/10 rounded-xl">
                    Active Rank
                  </div>
                ) : (
                  <div className="py-4 text-center font-bold text-[10px] opacity-20 uppercase tracking-[0.2em]">
                    Ascended
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedRank && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-black/10 dark:border-white/10"
            >
              {showSuccess ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-12 text-center space-y-8 relative overflow-hidden"
                >
                  <div className="absolute inset-0 pointer-events-none">
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 400, opacity: [0, 1, 0] }}
                        transition={{ 
                          duration: Math.random() * 2 + 1, 
                          repeat: Infinity, 
                          delay: Math.random() * 2,
                          ease: "linear"
                        }}
                        className="absolute text-[8px] font-mono text-orange-500/20"
                        style={{ left: `${Math.random() * 100}%` }}
                      >
                        {Math.random().toString(36).substring(7)}
                      </motion.div>
                    ))}
                  </div>
                  <motion.div 
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 12, stiffness: 100 }}
                    className="w-32 h-32 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto shadow-[0_0_60px_rgba(34,197,94,0.6)] relative z-10"
                  >
                    <Check size={64} className="text-white" />
                  </motion.div>
                  <div className="space-y-2 relative z-10">
                    <motion.h2 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-5xl font-black tracking-tighter italic bg-gradient-to-b from-black to-black/50 dark:from-white dark:to-white/50 bg-clip-text text-transparent"
                    >
                      ASCENDED
                    </motion.h2>
                    <motion.p 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="opacity-50 font-bold uppercase tracking-[0.3em] text-sm"
                    >
                      Authority Synchronized
                    </motion.p>
                  </div>
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="p-6 bg-black/5 dark:bg-white/5 rounded-3xl border border-black/10 dark:border-white/10 relative z-10"
                  >
                    <p className="text-xs opacity-50 leading-relaxed font-medium">
                      Your neural signature has been updated. The Eclipse network now recognizes your {selectedRank.name} status.
                    </p>
                  </motion.div>
                </motion.div>
              ) : (
                <div className="p-8 space-y-8 relative overflow-hidden">
                  {/* Background Data Stream Effect */}
                  <div className="absolute inset-0 pointer-events-none opacity-20">
                    {[...Array(15)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 600, opacity: [0, 1, 0] }}
                        transition={{ 
                          duration: Math.random() * 3 + 2, 
                          repeat: Infinity, 
                          delay: Math.random() * 2,
                          ease: "linear"
                        }}
                        className="absolute text-[6px] font-mono text-orange-500"
                        style={{ left: `${Math.random() * 100}%` }}
                      >
                        {Math.random().toString(16).substring(2, 8).toUpperCase()}
                      </motion.div>
                    ))}
                  </div>
                  
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent pointer-events-none" />
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-black tracking-tight">SECURE CHECKOUT</h2>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Encrypted Connection Active</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedRank(null)}
                      className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                    >
                      <XCircle size={24} />
                    </button>
                  </div>

                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="p-6 bg-black text-white dark:bg-white dark:text-black rounded-3xl flex items-center justify-between border border-white/10 shadow-2xl relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Target Rank</p>
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter">{selectedRank.name}</h3>
                    </div>
                    <div className="text-right relative z-10">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Investment</p>
                      <h3 className="text-3xl font-black tracking-tighter">${selectedRank.price}</h3>
                    </div>
                  </motion.div>

                  <div className="space-y-6 relative z-10">
                    <div className="space-y-3">
                      <div className="flex justify-between items-end px-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-50">Authority Surge Meter</label>
                        <span className="text-[10px] font-black text-orange-500">READY TO SYNC</span>
                      </div>
                      <div className="h-2 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 2, ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-orange-500 to-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.5)]"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-2">Card Information</label>
                        <div className="relative">
                          <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                          <input 
                            type="text" 
                            placeholder="Card Number" 
                            className="w-full pl-12 pr-4 py-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <input 
                            type="text" 
                            placeholder="MM / YY" 
                            className="w-full px-6 py-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                          />
                          <input 
                            type="text" 
                            placeholder="CVC" 
                            className="w-full px-6 py-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-2">Billing Address</label>
                        <input 
                          type="text" 
                          placeholder="Country" 
                          className="w-full px-6 py-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 relative z-10">
                    <motion.button 
                      onClick={handlePurchase}
                      disabled={isProcessing}
                      whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(249,115,22,0.2)" }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-6 bg-orange-500 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 disabled:opacity-50 transition-all shadow-xl relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
                      {isProcessing ? (
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-6 h-6 border-3 border-white border-t-transparent rounded-full"
                        />
                      ) : (
                        <>
                          <Zap size={20} className="animate-pulse" />
                          Initiate Ascension
                        </>
                      )}
                    </motion.button>
                    <p className="text-[10px] text-center mt-6 opacity-30 font-black tracking-widest uppercase">
                      Protocol: Secure-Sync v4.0 • Eclipse Network
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-black/5 dark:bg-white/5 p-12 rounded-[3rem] space-y-8">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-orange-500 rounded-3xl text-white">
            <Zap size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight">THE ASCENSION PATH</h2>
            <p className="opacity-50">How the hierarchy works in Eclipse.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <h4 className="font-bold text-lg">Time-Based Progression</h4>
            <p className="text-sm opacity-50 leading-relaxed">Log in daily to naturally climb the ranks. Your status upgrades automatically once you hit the required login milestones.</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-lg">Instant Ascension</h4>
            <p className="text-sm opacity-50 leading-relaxed">Skip the wait by purchasing ranks. Skipping more than 2 ranks at once triggers a 20% discount on the total cost.</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-lg">Authority & Ideas</h4>
            <p className="text-sm opacity-50 leading-relaxed">Higher ranks can review and approve ideas. Ideas flow from Members up to the Owner through a chain of command.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
