import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Shield, UserMinus } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';

interface MemberCardProps {
  userId: string;
  isCreator: boolean;
  canKick?: boolean;
  onKick?: () => void;
  hideAvatar?: boolean;
}

export function MemberCard({ userId, isCreator, canKick, onKick, hideAvatar }: MemberCardProps) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    getDoc(doc(db, 'users', userId)).then(snap => {
      if (snap.exists()) setProfile(snap.data());
    }).catch(err => handleFirestoreError(err, OperationType.GET, `users/${userId}`));
  }, [userId]);

  if (!profile) return <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl animate-pulse h-16" />;

  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-black rounded-2xl border border-black/5 dark:border-white/5 group">
      {!hideAvatar && (
        <img 
          src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`} 
          alt="Avatar" 
          className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 object-cover shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm truncate text-black dark:text-white">{profile.displayName || 'Anonymous'}</p>
          {isCreator && <Shield size={12} className="text-black dark:text-white" />}
        </div>
        {!hideAvatar && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Level {profile.level || 1} • {profile.rank || 'Welcome'}</p>
        )}
      </div>
      {canKick && (
        <button 
          onClick={onKick}
          className="p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded-xl transition-all"
          title="Kick Member"
        >
          <UserMinus size={16} />
        </button>
      )}
    </div>
  );
}
