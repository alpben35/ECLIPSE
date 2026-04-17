import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bug, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType, encryptData } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTeacher?: boolean;
  userEmail?: string;
  userUid?: string;
}

export default function BugReportModal({ isOpen, onClose, isTeacher, userEmail, userUid }: BugReportModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [issueType, setIssueType] = useState('ui');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await addDoc(collection(db, 'bugs'), {
        uid: userUid || 'anonymous',
        email: userEmail || 'anonymous',
        type: issueType,
        description: encryptData(description),
        status: 'new',
        createdAt: new Date().toISOString()
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
        setDescription('');
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bugs');
    } finally {
      setLoading(false);
    }
  };

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
              "relative w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border overflow-hidden",
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

            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center text-center py-12 gap-4"
                >
                  <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center">
                    <CheckCircle2 size={48} />
                  </div>
                  <h2 className="text-2xl font-black">Report Received!</h2>
                  <p className="opacity-60">Thanks for helping us improve Eclipse.</p>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="flex items-center gap-4 mb-8">
                    <div className={cn(
                      "p-3 rounded-2xl",
                      isTeacher ? "bg-gold/10 text-gold" : "bg-black/5 dark:bg-white/5 text-black dark:text-white"
                    )}>
                      <Bug size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tight">Report a Bug</h2>
                      <p className="text-sm opacity-60">Found a glitch? Let us know.</p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2 block">Issue Type</label>
                      <select 
                        value={issueType}
                        onChange={(e) => setIssueType(e.target.value)}
                        className={cn(
                          "w-full p-4 rounded-2xl border focus:outline-none focus:ring-2 transition-all",
                          isTeacher 
                            ? "bg-gold/5 border-gold/10 focus:ring-gold/20" 
                            : "bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 focus:ring-black/10 dark:focus:ring-white/10"
                        )}
                      >
                        <option value="ui">UI/Design Issue</option>
                        <option value="ai">AI Response Issue</option>
                        <option value="performance">Performance/Lag</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2 block">Description</label>
                      <textarea 
                        required
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What happened? How can we reproduce it?"
                        className={cn(
                          "w-full p-4 rounded-2xl border focus:outline-none focus:ring-2 transition-all min-h-[120px] resize-none",
                          isTeacher 
                            ? "bg-gold/5 border-gold/10 focus:ring-gold/20" 
                            : "bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 focus:ring-black/10 dark:focus:ring-white/10"
                        )}
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={loading}
                      className={cn(
                        "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg",
                        isTeacher 
                          ? "bg-gold text-royal-red" 
                          : "bg-black text-white dark:bg-white dark:text-black"
                      )}
                    >
                      {loading ? (
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        >
                          <Send size={20} />
                        </motion.div>
                      ) : (
                        <>
                          <Send size={20} />
                          Submit Report
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
