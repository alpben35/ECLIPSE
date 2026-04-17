import React from 'react';
import { motion } from 'motion/react';
import Logo from '../ui/Logo';

export default function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[200] bg-white dark:bg-zinc-950 flex items-center justify-center overflow-hidden"
    >
      <div className="relative flex flex-col items-center">
        {/* Animated Background Glow */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute inset-0 bg-black dark:bg-white blur-[100px] rounded-full scale-150"
        />

        {/* Logo Container */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center"
        >
          <Logo size="xl" className="mb-8" />
          
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-5xl font-black text-black dark:text-white tracking-tighter italic uppercase"
          >
            Eclipse
          </motion.h1>
          
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: 120 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="h-1 bg-gradient-to-r from-transparent via-black/20 dark:via-white/20 to-transparent mt-4"
          />
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="text-black dark:text-white text-[10px] font-bold uppercase tracking-[0.3em] mt-8"
          >
            Illuminating Education
          </motion.p>
        </motion.div>
      </div>

      {/* Loading Bar */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="w-full h-full bg-black dark:bg-white"
        />
      </div>
    </motion.div>
  );
}
