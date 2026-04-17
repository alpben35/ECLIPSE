import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, Crown, Infinity as InfinityIcon, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  limit: number;
  tier: string;
}

export default function LimitReachedModal({ isOpen, onClose, limit, tier }: LimitReachedModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[3rem] p-8 shadow-2xl overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-500/20 blur-[100px] rounded-full" />
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-8">
                <div className="w-16 h-16 bg-orange-500/10 rounded-3xl flex items-center justify-center">
                  <Zap className="text-orange-500" size={32} />
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4 mb-10">
                <h2 className="text-4xl font-black tracking-tighter italic uppercase leading-none">
                  Daily Limit <span className="text-orange-500">Reached</span>
                </h2>
                <p className="opacity-60 text-lg leading-relaxed">
                  You've used all <span className="font-bold text-black dark:text-white">{limit}</span> of your daily prompts on the <span className="font-bold uppercase tracking-widest text-orange-500">{tier}</span> plan.
                </p>
              </div>

              <div className="space-y-4">
                <Link 
                  to="/subscription" 
                  onClick={onClose}
                  className="w-full py-5 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase italic tracking-tighter text-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
                >
                  Upgrade Now
                  <ArrowRight size={24} />
                </Link>
                
                <button 
                  onClick={onClose}
                  className="w-full py-4 text-sm font-bold opacity-40 hover:opacity-100 transition-opacity"
                >
                  Maybe later, I'll wait until tomorrow
                </button>
              </div>

              <div className="mt-10 pt-8 border-t border-black/5 dark:border-white/5 grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/10 rounded-xl">
                    <Crown className="text-yellow-500" size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold uppercase opacity-40">Premium</p>
                    <p className="text-xs font-bold">120 Prompts</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-xl">
                    <InfinityIcon className="text-purple-500" size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold uppercase opacity-40">Infinite</p>
                    <p className="text-xs font-bold">Unlimited</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
