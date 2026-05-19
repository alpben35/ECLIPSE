import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Lock, Loader2, Check, AlertCircle, Camera, Link as LinkIcon, Upload, Eye, EyeOff } from 'lucide-react';
import { auth, db, storage, encryptData, decryptData } from '../lib/firebase';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { cn } from '../lib/utils';
import { OWNER_EMAIL } from '../constants';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername: string;
  currentPhotoURL?: string;
  currentPhone?: string;
  profile: any;
}

export default function ProfileSettingsModal({ isOpen, onClose, currentUsername, currentPhotoURL, currentPhone, profile }: ProfileSettingsModalProps) {
  const [username, setUsername] = useState(currentUsername);
  const [photoURL, setPhotoURL] = useState(currentPhotoURL || '');
  const [phone, setPhone] = useState(currentPhone || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState(''); // Added for verification
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState<'options' | 'username' | 'password' | 'phone' | 'photo'>('options');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rank = profile?.rank || 'Welcome';
  const isOwner = profile?.email === OWNER_EMAIL || auth.currentUser?.email === OWNER_EMAIL || rank === 'Owner' || rank === 'Temporary Owner';
  const isAdmin = rank === 'Admin' || isOwner;
  const isPremium = ['Intermediate', 'Champion', 'Master'].includes(rank) || isAdmin || profile?.tier === 'premium' || profile?.tier === 'admin' || profile?.tier === 'intermediate';

  const reauthenticate = async (password: string) => {
    if (!auth.currentUser || !auth.currentUser.email) return;
    const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  const handleUpdatePhotoURL = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);
    try {
      await updateProfile(auth.currentUser, { photoURL: photoURL });
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { photoURL: photoURL });
      await updateDoc(doc(db, 'public_profiles', auth.currentUser.uid), { photoURL: photoURL });
      setSuccess("Profile picture updated successfully!");
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;
    
    if (!isPremium) {
      setError("Basic accounts cannot upload custom profile pictures. Upgrade to Champion or higher!");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const storageRef = ref(storage, `users/${auth.currentUser.uid}/profile_pic_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      await updateProfile(auth.currentUser, { photoURL: url });
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { photoURL: url });
      await updateDoc(doc(db, 'public_profiles', auth.currentUser.uid), { photoURL: url });
      
      setPhotoURL(url);
      setSuccess("Profile picture uploaded successfully!");
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
    if (!auth.currentUser) return;
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await updatePassword(auth.currentUser, newPassword);
      setSuccess("Password updated successfully!");
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccess(null);
        setStep('options');
      }, 2000);
    } catch (err: any) {
      if (err.message?.includes('recent-login')) {
        setError("For security, please log out and log back in before changing your password.");
      } else {
        setError(err.message);
      }
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
                    onClick={() => setStep('photo')}
                    className="w-full p-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-2xl flex items-center justify-between transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black">
                        <Camera size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold">Profile Picture</p>
                        <p className="text-xs opacity-50">Upload or link your avatar</p>
                      </div>
                    </div>
                  </button>

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
                </div>
              )}

              {step === 'photo' && (
                <div className="space-y-6">
                  <div className="flex flex-col items-center gap-4 mb-4">
                    <img 
                      src={photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser?.uid}`} 
                      alt="Preview" 
                      className="w-24 h-24 rounded-full border-2 border-black/10 dark:border-white/10 object-cover"
                    />
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      className="hidden" 
                      accept="image/*" 
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className="flex items-center gap-2 px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-bold hover:scale-105 transition-all disabled:opacity-50"
                    >
                      <Upload size={14} />
                      Upload Photo
                    </button>
                  </div>

                  <div className="relative flex items-center gap-4 py-2">
                    <div className="h-px flex-1 bg-black/5 dark:bg-white/5"></div>
                    <span className="text-[10px] font-bold opacity-30">OR PROVIDE URL</span>
                    <div className="h-px flex-1 bg-black/5 dark:bg-white/5"></div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 ml-2">Image URL</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                      <input 
                        type="url"
                        value={photoURL}
                        onChange={(e) => setPhotoURL(e.target.value)}
                        placeholder="https://example.com/photo.jpg"
                        className="w-full pl-12 pr-4 py-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
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
                      onClick={handleUpdatePhotoURL}
                      disabled={loading || !photoURL}
                      className="flex-[2] py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : "Update URL"}
                    </button>
                  </div>
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
                        placeholder="Enter current password"
                        className="w-full px-4 py-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 ml-2">New Password</label>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          className="w-full px-4 py-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all pr-12"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 ml-2">Confirm New Password</label>
                      <input 
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full px-4 py-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setStep('options');
                        setNewPassword('');
                        setConfirmPassword('');
                        setCurrentPassword('');
                      }}
                      className="flex-1 py-4 font-bold opacity-50 hover:opacity-100 transition-opacity"
                    >
                      Back
                    </button>
                    <button 
                      onClick={async () => {
                        setLoading(true);
                        setError(null);
                        try {
                          await reauthenticate(currentPassword);
                          await handleUpdatePassword();
                        } catch (err: any) {
                          setError("Re-authentication failed. Please check your current password.");
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || !newPassword || !confirmPassword || !currentPassword}
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

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
