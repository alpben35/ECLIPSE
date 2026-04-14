import React, { useState, useEffect, useContext } from 'react';
import { motion } from 'motion/react';
import { Search, Trash2, Shield, User as UserIcon, Loader2, ArrowUp, ArrowDown, Ban, UserPlus, UserMinus, Bug, Settings, Sparkles } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, doc, deleteDoc, where, updateDoc, addDoc, orderBy, limit, setDoc, getDoc } from 'firebase/firestore';
import { AuthContext } from '../../../src/App';
import { OWNER_EMAIL, RANKS } from '../constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { summarizeChat } from '../lib/gemini';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role?: string;
  rank?: string;
  banned?: boolean;
  createdAt: string;
}

interface AuditLog {
  id: string;
  adminUid: string;
  adminEmail: string;
  action: string;
  targetUid: string;
  targetEmail: string;
  details: string;
  timestamp: string;
}

interface BugReport {
  id: string;
  uid: string;
  email: string;
  type: string;
  description: string;
  status: string;
  createdAt: string;
}

export default function AdminPage() {
  const { user: currentUser, profile } = useContext(AuthContext);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [maintenance, setMaintenance] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'bugs'>('users');
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (!currentUser || !profile) return;

    const usersQ = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQ, (snapshot) => {
      const loadedUsers = snapshot.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id
      })) as UserProfile[];
      setUsers(loadedUsers);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const logsQ = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribeLogs = onSnapshot(logsQ, (snapshot) => {
      const loadedLogs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as AuditLog[];
      setLogs(loadedLogs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'audit_logs'));

    const bugsQ = query(collection(db, 'bugs'), orderBy('createdAt', 'desc'));
    const unsubscribeBugs = onSnapshot(bugsQ, (snapshot) => {
      const loadedBugs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as BugReport[];
      setBugs(loadedBugs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'bugs'));

    const unsubscribeMaintenance = onSnapshot(doc(db, 'system', 'maintenance'), (doc) => {
      if (doc.exists()) {
        setMaintenance(doc.data().active || false);
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribeLogs();
      unsubscribeBugs();
      unsubscribeMaintenance();
    };
  }, [currentUser]);

  const addAuditLog = async (action: string, targetUid: string, targetEmail: string, details: string) => {
    if (!currentUser || !profile) return;
    try {
      await addDoc(collection(db, 'audit_logs'), {
        adminUid: currentUser.uid,
        adminEmail: profile.email,
        action,
        targetUid,
        targetEmail,
        details,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'audit_logs');
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (userEmail === OWNER_EMAIL) {
      alert("Cannot delete the primary owner account.");
      return;
    }

    const isOwner = profile?.email === OWNER_EMAIL || profile?.rank === 'Owner';
    if (!isOwner && profile?.rank !== 'Temporary Owner') {
      alert("Only owners can delete accounts.");
      return;
    }

    if (!window.confirm(`Are you sure you want to remove user ${userEmail}? This action is irreversible.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));
      await addAuditLog('DELETE_USER', userId, userEmail, `User ${userEmail} was deleted.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  };

  const sendEmail = async (to: string, subject: string, body: string) => {
    try {
      await addDoc(collection(db, 'sent_emails'), {
        to,
        subject,
        body,
        sentAt: new Date().toISOString()
      });
      console.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      console.error("Failed to log email:", error);
    }
  };

  const handleUpdateRank = async (userId: string, userEmail: string, currentRank: string, direction: 'up' | 'down') => {
    if (userEmail === OWNER_EMAIL) {
      alert("Cannot change rank of the primary owner.");
      return;
    }

    const isOwner = profile?.email === OWNER_EMAIL || profile?.rank === 'Owner';
    const isTempOwner = profile?.rank === 'Temporary Owner';
    
    if (!isOwner && !isTempOwner) return;

    const currentIndex = RANKS.findIndex(r => r.name === currentRank);
    let nextIndex = direction === 'up' ? currentIndex + 1 : currentIndex - 1;

    if (nextIndex < 0 || nextIndex >= RANKS.length) return;
    
    if (isTempOwner && (RANKS[nextIndex].name === 'Owner' || RANKS[nextIndex].name === 'Temporary Owner')) {
      alert("Temporary owners cannot assign owner ranks.");
      return;
    }

    try {
      const newRank = RANKS[nextIndex].name;
      await updateDoc(doc(db, 'users', userId), { rank: newRank });
      await updateDoc(doc(db, 'public_profiles', userId), { rank: newRank });
      await addAuditLog('RANK_CHANGE', userId, userEmail, `Rank changed from ${currentRank} to ${newRank}.`);
      
      const subject = direction === 'up' ? "Congratulations! You've been promoted!" : "Notification: Rank Change";
      const body = `Hello,\n\nYour rank on Eclipse Teacher has been updated from ${currentRank} to ${newRank}.\n\nBest regards,\nThe Eclipse Team`;
      await sendEmail(userEmail, subject, body);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleToggleBan = async (userId: string, userEmail: string, isBanned: boolean) => {
    if (userEmail === OWNER_EMAIL) {
      alert("Cannot ban the primary owner.");
      return;
    }

    const isOwner = profile?.email === OWNER_EMAIL || profile?.rank === 'Owner';
    if (!isOwner && profile?.rank !== 'Temporary Owner') return;

    try {
      const newBanStatus = !isBanned;
      await updateDoc(doc(db, 'users', userId), { banned: newBanStatus });
      await addAuditLog(newBanStatus ? 'BAN_USER' : 'UNBAN_USER', userId, userEmail, `User ${userEmail} was ${newBanStatus ? 'banned' : 'unbanned'}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleToggleTempOwner = async (userId: string, userEmail: string, currentRank: string) => {
    if (userEmail === OWNER_EMAIL) return;
    
    const isOwner = profile?.email === OWNER_EMAIL || profile?.rank === 'Owner';
    if (!isOwner) {
      alert("Only the primary owner can assign temporary owners.");
      return;
    }

    const isTemp = currentRank === 'Temporary Owner';
    const newRank = isTemp ? 'Welcome' : 'Temporary Owner';
    try {
      await updateDoc(doc(db, 'users', userId), { 
        rank: newRank 
      });
      await addAuditLog('TEMP_OWNER_TOGGLE', userId, userEmail, `Temporary Owner status ${isTemp ? 'removed' : 'granted'}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleToggleMaintenance = async () => {
    const isOwner = profile?.email === OWNER_EMAIL || profile?.rank === 'Owner';
    if (!isOwner) return;

    const action = maintenance ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${action} maintenance mode? This will restrict access for all non-admin users.`)) {
      return;
    }

    try {
      const newStatus = !maintenance;
      await setDoc(doc(db, 'system', 'maintenance'), { 
        active: newStatus,
        updatedBy: profile.email,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      await addAuditLog('MAINTENANCE_TOGGLE', 'system', 'system', `Maintenance mode ${newStatus ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'system/maintenance');
    }
  };

  const handleSummarizeBugs = async () => {
    if (bugs.length === 0) return;
    setSummarizing(true);
    try {
      const bugTexts = bugs.map(b => `[${b.type}] ${b.description}`).join('\n\n');
      const prompt = `Please summarize these bug reports for the system administrator. Identify common themes and critical issues:\n\n${bugTexts}`;
      
      // Re-using summarizeChat logic but with bug prompt
      const result = await summarizeChat([{ role: 'user', content: prompt }]);
      setSummary(result || 'No summary generated.');
    } catch (error) {
      console.error("Summarization error:", error);
      alert("Failed to summarize bugs.");
    } finally {
      setSummarizing(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(search.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin opacity-20" size={48} />
      </div>
    );
  }

  const isOwner = profile?.email === OWNER_EMAIL || profile?.rank === 'Owner';
  const isTempOwner = profile?.rank === 'Temporary Owner';

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-gold">Teacher Admin Console</h1>
            <p className="opacity-50 mt-2 text-gold">Manage educators and system access.</p>
          </div>
          
          {(isOwner || isTempOwner) && (
            <div className="flex items-center gap-4 p-4 bg-gold/5 rounded-3xl border border-gold/10">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gold">System Maintenance</span>
                <span className="text-[10px] opacity-50 uppercase tracking-widest text-gold">Restrict user access</span>
              </div>
              <button 
                onClick={handleToggleMaintenance}
                className={cn(
                  "relative w-14 h-7 rounded-full transition-all duration-300",
                  maintenance ? "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "bg-gold/10"
                )}
              >
                <motion.div 
                  animate={{ x: maintenance ? 32 : 4 }}
                  className="absolute top-1 left-0 w-5 h-5 rounded-full bg-gold shadow-sm flex items-center justify-center"
                >
                  <Settings size={10} className={maintenance ? "animate-spin text-red-500" : "opacity-30 text-royal-red"} />
                </motion.div>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 p-1 bg-gold/5 rounded-2xl border border-gold/10 overflow-x-auto">
            <button 
              onClick={() => setActiveTab('users')}
              className={cn(
                "px-6 py-2 rounded-xl font-bold text-sm transition-all whitespace-nowrap",
                activeTab === 'users' ? "bg-gold text-royal-red" : "text-gold opacity-50 hover:opacity-100"
              )}
            >
              Educators
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={cn(
                "px-6 py-2 rounded-xl font-bold text-sm transition-all whitespace-nowrap",
                activeTab === 'logs' ? "bg-gold text-royal-red" : "text-gold opacity-50 hover:opacity-100"
              )}
            >
              Audit Log
            </button>
            {(isOwner || isTempOwner) && (
              <button 
                onClick={() => setActiveTab('bugs')}
                className={cn(
                  "px-6 py-2 rounded-xl font-bold text-sm transition-all whitespace-nowrap",
                  activeTab === 'bugs' ? "bg-gold text-royal-red" : "text-gold opacity-50 hover:opacity-100"
                )}
              >
                Bugs
              </button>
            )}
          </div>

          {activeTab === 'users' && (
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-gold" size={20} />
              <input 
                type="text"
                placeholder="Search educators..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gold/10 text-gold placeholder:text-gold/40 rounded-2xl border border-gold/20 focus:outline-none focus:ring-2 focus:ring-gold/10 transition-all"
              />
            </div>
          )}
        </div>
      </div>

      {activeTab === 'users' ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredUsers.map((user) => (
            <motion.div 
              key={user.uid}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-6 bg-gold/10 rounded-3xl border border-gold/20 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center">
                  {user.email === OWNER_EMAIL || user.rank === 'Owner' ? (
                    <Shield className="text-gold" size={24} />
                  ) : user.rank === 'Temporary Owner' ? (
                    <Shield className="text-gold" size={24} />
                  ) : (
                    <UserIcon className="opacity-50 text-gold" size={24} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gold">{user.displayName || 'Anonymous'}</h4>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                      user.banned ? "bg-red-500 text-royal-red" : "bg-gold/20 text-gold opacity-50"
                    )}>
                      {user.rank || 'Welcome'} {user.banned && '• BANNED'}
                    </span>
                  </div>
                  <p className="text-sm opacity-50 text-gold">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {user.email !== OWNER_EMAIL && (
                  <div className="flex items-center gap-1 bg-gold/10 p-1 rounded-xl">
                    <button 
                      onClick={() => handleUpdateRank(user.uid, user.email, user.rank || 'Welcome', 'down')}
                      className="p-2 hover:bg-gold/20 rounded-lg transition-colors text-gold"
                      title="Demote"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button 
                      onClick={() => handleUpdateRank(user.uid, user.email, user.rank || 'Welcome', 'up')}
                      className="p-2 hover:bg-gold/20 rounded-lg transition-colors text-gold"
                      title="Promote"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button 
                      onClick={() => handleToggleBan(user.uid, user.email, !!user.banned)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        user.banned ? "bg-red-500 text-royal-red" : "hover:bg-gold/20 text-gold"
                      )}
                      title={user.banned ? "Unban" : "Ban"}
                    >
                      <Ban size={14} />
                    </button>
                    {(profile?.email === OWNER_EMAIL || profile?.rank === 'Owner') && (
                      <button 
                        onClick={() => handleToggleTempOwner(user.uid, user.email, user.rank || 'Welcome')}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          user.rank === 'Temporary Owner' ? "bg-gold text-royal-red" : "hover:bg-gold/20 text-gold"
                        )}
                        title={user.rank === 'Temporary Owner' ? "Remove Temp Owner" : "Make Temp Owner"}
                      >
                        {user.rank === 'Temporary Owner' ? <UserMinus size={14} /> : <UserPlus size={14} />}
                      </button>
                    )}
                  </div>
                )}

                <div className="text-right hidden sm:block min-w-[100px]">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-30 text-gold">Joined</p>
                  <p className="text-sm font-medium text-gold">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
                
                {user.email !== OWNER_EMAIL && user.uid !== currentUser?.uid && (
                  <button 
                    onClick={() => handleDeleteUser(user.uid, user.email)}
                    className="p-3 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all text-gold"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="text-center py-20 opacity-30">
              <p className="text-lg">No educators found matching your search.</p>
            </div>
          )}
        </div>
      ) : activeTab === 'logs' ? (
        <div className="space-y-4">
          {logs.map((log) => (
            <motion.div 
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 bg-gold/5 rounded-2xl border border-gold/10 flex items-start justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                    log.action.includes('BAN') ? "bg-red-500/20 text-red-500" :
                    log.action.includes('DELETE') ? "bg-red-500/20 text-red-500" :
                    "bg-gold/20 text-gold"
                  )}>
                    {log.action.replace('_', ' ')}
                  </span>
                  <span className="text-xs opacity-30 font-bold text-gold">
                    {format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}
                  </span>
                </div>
                <p className="text-sm font-medium text-gold">
                  <span className="opacity-50">Admin:</span> {log.adminEmail}
                </p>
                <p className="text-sm text-gold">
                  {log.details}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-30 text-gold">Target</p>
                <p className="text-xs font-bold text-gold">{log.targetEmail}</p>
              </div>
            </motion.div>
          ))}
          {logs.length === 0 && (
            <div className="text-center py-20 opacity-30">
              <p className="text-lg">No audit logs recorded yet.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gold">Reported Bugs</h2>
            <button 
              onClick={handleSummarizeBugs}
              disabled={summarizing || bugs.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-gold text-royal-red rounded-2xl font-bold hover:scale-105 transition-all disabled:opacity-50"
            >
              {summarizing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
              Summarize with AI
            </button>
          </div>

          {summary && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-gold/10 border border-gold/20 rounded-3xl space-y-4"
            >
              <div className="flex items-center gap-2 text-gold">
                <Sparkles size={20} />
                <h3 className="font-bold">AI Summary</h3>
              </div>
              <div className="text-gold opacity-80 whitespace-pre-wrap leading-relaxed">
                {summary}
              </div>
              <button 
                onClick={() => setSummary('')}
                className="text-xs font-bold text-gold opacity-50 hover:opacity-100"
              >
                Clear Summary
              </button>
            </motion.div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {bugs.map((bug) => (
              <motion.div 
                key={bug.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-gold/5 border border-gold/10 rounded-3xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gold/10 rounded-xl text-gold">
                      <Bug size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-gold/20 text-gold rounded-full">
                        {bug.type}
                      </span>
                      <p className="text-xs opacity-50 text-gold mt-1">
                        {format(new Date(bug.createdAt), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gold">{bug.email}</p>
                    <p className="text-[10px] opacity-30 text-gold uppercase font-black">Reporter</p>
                  </div>
                </div>
                <p className="text-gold leading-relaxed">
                  {bug.description}
                </p>
              </motion.div>
            ))}
            {bugs.length === 0 && (
              <div className="text-center py-20 opacity-30">
                <p className="text-lg">No bugs reported yet. System is stable.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
