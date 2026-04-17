import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share, PlusSquare, X } from 'lucide-react';

export default function AddToHomeScreen() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if it's iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    // Check if it's already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    // Show only if on iOS and not already installed
    if (isIOS && !isStandalone) {
      const hasSeen = localStorage.getItem('hasSeenPWAPrompt');
      if (!hasSeen) {
        setShow(true);
      }
    }
  }, []);

  const handleClose = () => {
    setShow(false);
    localStorage.setItem('hasSeenPWAPrompt', 'true');
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 left-4 right-4 z-[100] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-black/10 dark:border-white/10 p-6"
        >
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 p-1 opacity-50 hover:opacity-100"
          >
            <X size={20} />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-red-900 rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
              <span className="text-white font-black text-xl">E</span>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Install Eclipse AI</h3>
              <p className="text-sm opacity-60 mt-1 leading-relaxed">
                Add this app to your home screen for a full-screen experience and quick access.
              </p>
              
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-black/5 dark:bg-white/5 rounded-lg flex items-center justify-center">
                    <Share size={16} className="text-blue-500" />
                  </div>
                  <span>Tap the <strong>Share</strong> button below</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-black/5 dark:bg-white/5 rounded-lg flex items-center justify-center">
                    <PlusSquare size={16} />
                  </div>
                  <span>Select <strong>Add to Home Screen</strong></span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
