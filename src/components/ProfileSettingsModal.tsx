import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Lock, Loader2, Check, AlertCircle, CreditCard } from 'lucide-react';
import { auth, db, encryptData, decryptData } from '../lib/firebase';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername: string;
  currentPhone?: string;
  currentBankAccount?: string;
}

export default function ProfileSettingsModal({ isOpen, onClose, currentUsername, currentPhone, currentBankAccount }: ProfileSettingsModalProps) {
  const [username, setUsername] = useState(currentUsername);
  const [phone, setPhone] = useState(currentPhone || '');
  const [bankAccount, setBankAccount] = useState(currentBankAccount ? decryptData(currentBankAccount) : '');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState<'options' | 'username' | 'password' | 'phone' | 'bankAccount'>('options');

  const handleUpdateBankAccount = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { 
        bankAccount: bankAccount ? encryptData(bankAccount) : null 
      });
      setSuccess("Bank account updated successfully!");
      setTimeout(() => {
        setSuccess(null);
        setStep('options');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUsername = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);
    try {
      await updateProfile(auth.currentUser, { displayName: username });
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { displayName: username });
      await updateDoc(doc(db, 'public_profiles', auth.currentUser.uid), { displayName: username });
      setSuccess("Username updated successfully!");
      setTimeout(() => {
        setSuccess(null);
        setStep('options');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePhone = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { 
        phone: phone ? encryptData(phone) : null 
      });
      setSuccess("Phone number updated successfully!");
      setTimeout(() => {
        setSuccess(null);
        setStep('options');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!auth.currentUser || !auth.currentUser.email) return;
    setLoading(true);
    setError(null);
    try {
      // Re-authenticate first
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Update password
      await updatePassword(auth.currentUser, newPassword);
      setSuccess("Password updated successfully!");
      setNewPassword('');
      setCurrentPassword('');
      setTimeout(() => {
        setSuccess(null);
        setStep('options');
      }, 2000);
    } catch (err: any) {
      setError(err.message === 'auth/wrong-password' ? 'Incorrect current password' : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-black/5 dark:border-white/5"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Account Settings</h2>
                  <p className="text-sm opacity-50">Manage your profile and security</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-sm">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 text-green-500 text-sm">
                  <Check size={18} />
                  {success}
                </div>
              )}

              {step === 'options' && (
                <div className="space-y-4">
                  <button 
                    onClick={() => setStep('username')}
                    className="w-full p-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-2xl flex items-center justify-between transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black">
                        <User size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold">Change Username</p>
                        <p className="text-xs opacity-50">Currently: {currentUsername}</p>
                      </div>
                    </div>
                  </button>

                  <button 
                    onClick={() => setStep('password')}
                    className="w-full p-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-2xl flex items-center justify-between transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black">
                        <Lock size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold">Change Password</p>
                        <p className="text-xs opacity-50">Update your account security</p>
                      </div>
                    </div>
                  </button>

                  <button 
                    onClick={() => setStep('phone')}
                    className="w-full p-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-2xl flex items-center justify-between transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black">
                        <User size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold">Update Phone</p>
                        <p className="text-xs opacity-50">Currently: {currentPhone || 'Not set'}</p>
                      </div>
                    </div>
                  </button>

                  <button 
                    onClick={() => setStep('bankAccount')}
                    className="w-full p-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-2xl flex items-center justify-between transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black">
                        <CreditCard size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold">Bank Account</p>
                        <p className="text-xs opacity-50">Manage your payout details</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {step === 'username' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 ml-2">New Username</label>
                    <input 
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setStep('options')}
                      className="flex-1 py-4 font-bold opacity-50 hover:opacity-100 transition-opacity"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleUpdateUsername}
                      disabled={loading || username === currentUsername}
                      className="flex-[2] py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : "Update Username"}
                    </button>
                  </div>
                </div>
              )}

              {step === 'password' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 ml-2">Current Password</label>
                      <input 
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 ml-2">New Password</label>
                      <input 
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setStep('options')}
                      className="flex-1 py-4 font-bold opacity-50 hover:opacity-100 transition-opacity"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleUpdatePassword}
                      disabled={loading || !newPassword || !currentPassword}
                      className="flex-[2] py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : "Update Password"}
                    </button>
                  </div>
                </div>
              )}
              {step === 'phone' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 ml-2">Phone Number</label>
                    <input 
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-4 py-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setStep('options')}
                      className="flex-1 py-4 font-bold opacity-50 hover:opacity-100 transition-opacity"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleUpdatePhone}
                      disabled={loading || phone === currentPhone}
                      className="flex-[2] py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : "Update Phone"}
                    </button>
                  </div>
                </div>
              )}

              {step === 'bankAccount' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 ml-2">Bank Account IBAN / Number</label>
                    <input 
                      type="text"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      placeholder="Enter your bank account for payouts"
                      className="w-full px-4 py-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setStep('options')}
                      className="flex-1 py-4 font-bold opacity-50 hover:opacity-100 transition-opacity"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleUpdateBankAccount}
                      disabled={loading || bankAccount === (currentBankAccount ? decryptData(currentBankAccount) : '')}
                      className="flex-[2] py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : "Update Bank Account"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
