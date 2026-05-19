import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Award, CreditCard, ChevronRight, Shield, Zap, Star, Crown, Check, Info, Lightbulb, XCircle } from 'lucide-react';
import { AuthContext, ThemeContext } from '@/lib/contexts';
import { RANKS, OWNER_EMAIL } from '@/constants';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

import confetti from 'canvas-confetti';

const RANK_PERKS: Record<string, string[]> = {
  'Welcome': ['Basic AI Support', 'Class Progress Tracking'],
  'Intermediate': ['Step towards Authority', 'Enhanced AI Speed'],
  'Champion': ['Idea Submission Power', 'Priority AI Response'],
  'Master': ['Advanced Class Analytics', 'Early Feature Access'],
  'Admin': ['Full User Management', 'System Monitoring'],
  'Owner': ['System Customization', 'Full Database Access'],
};

export default function RankPage() {
  const { user, profile } = useContext(AuthContext);
  const { isDark } = useContext(ThemeContext);
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
      
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 200, colors: ['#7B0000', '#FFD700'] };

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
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black tracking-widest uppercase border",
            isDark ? "bg-gold/10 text-gold border-gold/20" : "bg-royal-red/5 text-royal-red border-royal-red/10"
          )}
        >
          <Star size={14} />
          Your Current Rank: {userRank}
        </motion.div>
        <h1 className={cn("text-6xl font-black tracking-tighter italic", isDark ? "" : "text-royal-red")}>TEACHER ASCENSION</h1>
        <p className={cn("opacity-50 max-w-xl mx-auto text-lg leading-relaxed", isDark ? "" : "text-black")}>
          The hierarchy of Eclipse Teacher is built on professional excellence. 
          Ascend to unlock deeper levels of authority and influence in the classroom.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {RANKS.filter(r => r.name !== 'Temporary Owner' && r.name !== 'Owner').map((rank, index) => {
          const isCurrent = rank.name === profile?.rank;
          const isLocked = index < currentRankIndex;
          const isAvailable = index > currentRankIndex;
          const isNext = index === currentRankIndex + 1;
          const pricing = calculatePrice(index);
          const perks = RANK_PERKS[rank.name] || [];

          return (
            <motion.div 
              key={rank.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={isAvailable ? { y: -10 } : {}}
              className={cn(
                "relative p-8 rounded-[2.5rem] flex flex-col justify-between border-2 transition-all duration-500",
                isCurrent 
                  ? "bg-gold text-royal-red border-transparent shadow-2xl scale-105 z-10" 
                  : (isDark 
                      ? (isNext ? "bg-gold/10 border-gold/50 shadow-[0_0_30px_rgba(255,215,0,0.1)]" : isLocked ? "bg-gold/5 border-transparent opacity-40" : "bg-gold/5 border-gold/10")
                      : (isNext ? "bg-white border-royal-red/50 shadow-xl" : isLocked ? "bg-royal-red/5 border-transparent opacity-40" : "bg-white border-royal-red/10 shadow-sm")
                    )
              )}
            >
              {isNext && (
                <div className={cn(
                  "absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-[10px] font-black rounded-full shadow-lg z-20",
                  isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white"
                )}>
                  RECOMMENDED PATH
                </div>
              )}
              
              <div className="space-y-6">
                <div className="flex items-center justify-between text-left">
                  <div className={cn("p-3 rounded-2xl", isCurrent ? (isDark ? "bg-royal-red/10" : "bg-white/20") : (isDark ? "bg-gold/10" : "bg-royal-red/5"))}>
                    <Award size={24} className={isCurrent ? 'opacity-100' : cn('opacity-40', isDark ? 'text-gold' : 'text-royal-red')} />
                  </div>
                  {isCurrent && <Check size={20} className={isDark ? "text-royal-red" : "text-white"} />}
                </div>
                
                <div className="space-y-1 text-left">
                  <h3 className={cn("text-2xl font-black tracking-tight uppercase leading-none", isCurrent ? "" : (isDark ? "text-gold" : "text-royal-red"))}>{rank.name}</h3>
                  <p className={cn("text-[10px] font-bold tracking-widest uppercase", isCurrent ? "opacity-60" : (isDark ? "opacity-50 text-gold" : "opacity-50 text-royal-red"))}>
                    {rank.minDays} Days Milestone
                  </p>
                </div>

                <div className="space-y-2 text-left">
                  {perks.map((perk, i) => (
                    <div key={i} className={cn("flex items-center gap-2 text-[11px] font-medium text-left", isCurrent ? "opacity-90" : (isDark ? "opacity-70 text-gold" : "opacity-70 text-royal-red"))}>
                      <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                      {perk}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-12 space-y-6 text-left">
                {isAvailable ? (
                  <div className="space-y-4">
                    <div className="flex flex-col">
                      {pricing.hasDiscount && (
                        <span className={cn("text-sm line-through opacity-30 font-bold", isDark ? "text-gold" : "text-royal-red")}>${pricing.original}</span>
                      )}
                      <div className={cn("flex items-baseline gap-1", isDark ? "text-gold" : "text-royal-red")}>
                        <span className="text-4xl font-black tracking-tighter">${pricing.discounted}</span>
                        <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest">One-time</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <button 
                        onClick={() => setSelectedRank({ name: rank.name, price: pricing.discounted })}
                        className={cn(
                          "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                          isDark ? "bg-gold text-royal-red hover:scale-105 shadow-gold/10" : "bg-royal-red text-white hover:scale-105 shadow-royal-red/10 shadow-lg"
                        )}
                      >
                        <CreditCard size={18} /> Upgrade
                      </button>
                    </div>
                  </div>
                ) : isCurrent ? (
                  <div className={cn(
                    "py-4 text-center font-bold text-[10px] uppercase tracking-[0.2em] border rounded-xl",
                    isDark ? "border-royal-red/20 text-royal-red opacity-50" : "border-white/20 text-white opacity-50"
                  )}>
                    Active Rank
                  </div>
                ) : (
                  <div className={cn(
                    "py-4 text-center font-bold text-[10px] opacity-20 uppercase tracking-[0.2em]",
                    isDark ? "text-gold" : "text-royal-red"
                  )}>
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
              className={cn(
                "w-full max-w-md rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border transition-colors",
                isDark ? "bg-royal-red border-gold/20" : "bg-white border-royal-red/10"
              )}
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
                        className={cn("absolute text-[8px] font-mono", isDark ? "text-gold/20" : "text-royal-red/20")}
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
                    className={cn(
                      "w-32 h-32 rounded-full flex items-center justify-center mx-auto shadow-2xl relative z-10",
                      isDark ? "bg-gradient-to-br from-gold to-gold/50 shadow-gold/40" : "bg-gradient-to-br from-royal-red to-royal-red/80 shadow-royal-red/40"
                    )}
                  >
                    <Check size={64} className={isDark ? "text-royal-red" : "text-white"} />
                  </motion.div>
                  <div className="space-y-2 relative z-10">
                    <motion.h2 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className={cn(
                        "text-5xl font-black tracking-tighter italic bg-clip-text text-transparent",
                        isDark ? "bg-gradient-to-b from-gold to-gold/50" : "bg-gradient-to-b from-royal-red to-royal-red/70"
                      )}
                    >
                      ASCENDED
                    </motion.h2>
                    <motion.p 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className={cn("opacity-50 font-bold uppercase tracking-[0.3em] text-sm", isDark ? "text-gold" : "text-royal-red")}
                    >
                      Authority Synchronized
                    </motion.p>
                  </div>
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className={cn(
                      "p-6 rounded-3xl border relative z-10",
                      isDark ? "bg-gold/10 border-gold/20" : "bg-royal-red/5 border-royal-red/10"
                    )}
                  >
                    <p className={cn("text-xs opacity-50 leading-relaxed font-medium", isDark ? "text-gold" : "text-royal-red")}>
                      Your neural signature has been updated. The Eclipse Teacher network now recognizes your {selectedRank.name} status.
                    </p>
                  </motion.div>
                </motion.div>
              ) : (
                <div className="p-8 space-y-8 relative overflow-hidden text-left">
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
                        className={cn("absolute text-[6px] font-mono", isDark ? "text-gold" : "text-royal-red")}
                        style={{ left: `${Math.random() * 100}%` }}
                      >
                        {Math.random().toString(16).substring(2, 8).toUpperCase()}
                      </motion.div>
                    ))}
                  </div>
                  
                  <div className={cn(
                    "absolute inset-0 pointer-events-none",
                    isDark ? "bg-gradient-to-br from-gold/10 via-transparent to-transparent" : "bg-gradient-to-br from-royal-red/5 via-transparent to-transparent"
                  )} />
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div className="space-y-1">
                      <h2 className={cn("text-2xl font-black tracking-tight", isDark ? "text-gold" : "text-royal-red")}>SECURE CHECKOUT</h2>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full animate-pulse", isDark ? "bg-gold" : "bg-royal-red")} />
                        <span className={cn("text-[10px] font-black uppercase tracking-widest opacity-50", isDark ? "text-gold" : "text-royal-red")}>Encrypted Connection Active</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedRank(null)}
                      className={cn("p-2 rounded-full transition-colors", isDark ? "hover:bg-gold/10 text-gold" : "hover:bg-royal-red/5 text-royal-red")}
                    >
                      <XCircle size={24} />
                    </button>
                  </div>

                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className={cn(
                      "p-6 rounded-3xl flex items-center justify-between border shadow-2xl relative overflow-hidden group",
                      isDark ? "bg-gold text-royal-red border-gold/20" : "bg-royal-red text-white border-royal-red/10"
                    )}
                  >
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Target Rank</p>
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter">{selectedRank.name}</h3>
                    </div>
                    <div className="text-right relative z-10">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Investment</p>
                      <h3 className="text-3xl font-black tracking-tighter">${selectedRank.price}</h3>
                    </div>
                  </motion.div>

                  <div className="pt-4 relative z-10">
                    <motion.button 
                      onClick={handlePurchase}
                      disabled={isProcessing}
                      whileHover={{ scale: 1.02, boxShadow: isDark ? "0 20px 40px rgba(255,215,0,0.2)" : "0 20px 40px rgba(123,0,0,0.2)" }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "w-full py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 disabled:opacity-50 transition-all shadow-xl relative overflow-hidden group",
                        isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white"
                      )}
                    >
                      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
                      {isProcessing ? (
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className={cn("w-6 h-6 border-3 rounded-full", isDark ? "border-royal-red border-t-transparent" : "border-white border-t-transparent")}
                        />
                      ) : (
                        <>
                          <Zap size={20} className="animate-pulse" />
                          Initiate Ascension
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
