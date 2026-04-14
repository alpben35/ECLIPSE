import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Heart, Coffee, CreditCard, Gift } from 'lucide-react';
import { cn } from '../lib/utils';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTeacher?: boolean;
}

export default function SupportModal({ isOpen, onClose, isTeacher }: SupportModalProps) {
  const options = [
    { icon: Coffee, name: 'Buy us a coffee', price: '$5', description: 'A small token of appreciation.' },
    { icon: Heart, name: 'Monthly Supporter', price: '$10/mo', description: 'Help us keep the servers running.' },
    { icon: Gift, name: 'Education Hero', price: '$50', description: 'Support new feature development.' },
    { icon: CreditCard, name: 'Custom Amount', price: 'Any', description: 'Every bit helps the mission.' },
  ];

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
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={cn(
              "relative w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl border overflow-hidden",
              isTeacher 
                ? "bg-royal-red border-gold/20 text-gold" 
                : "bg-white dark:bg-black border-black/10 dark:border-white/10 text-black dark:text-white"
            )}
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
            >
              <X size={24} />
            </button>

            <div className="flex flex-col items-center text-center gap-4 mb-8">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center",
                isTeacher ? "bg-gold/10 text-gold" : "bg-black/5 dark:bg-white/5 text-black dark:text-white"
              )}>
                <Heart size={32} className="fill-current" />
              </div>
              <h2 className="text-3xl font-black tracking-tight">Support Eclipse</h2>
              <p className="opacity-60 max-w-xs">
                We're a small team dedicated to revolutionizing education. Your support keeps us going.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {options.map((opt) => (
                <button 
                  key={opt.name}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] text-left",
                    isTeacher 
                      ? "bg-gold/5 border-gold/10 hover:bg-gold/10" 
                      : "bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-xl",
                      isTeacher ? "bg-gold/10" : "bg-black/10 dark:bg-white/10"
                    )}>
                      <opt.icon size={20} />
                    </div>
                    <div>
                      <p className="font-bold">{opt.name}</p>
                      <p className="text-xs opacity-50">{opt.description}</p>
                    </div>
                  </div>
                  <span className="font-black text-lg">{opt.price}</span>
                </button>
              ))}
            </div>

            <p className="text-[10px] text-center mt-8 opacity-40 uppercase font-bold tracking-widest">
              Secure payments powered by Stripe
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
