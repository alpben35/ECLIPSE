import React, { useState, useEffect, useContext } from 'react';
import { motion } from 'motion/react';
import { Search, Trash2, Shield, User as UserIcon, Loader2, ArrowUp, ArrowDown, Ban, UserPlus, UserMinus, Bug, Settings, Sparkles, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, doc, deleteDoc, where, updateDoc, addDoc, orderBy, limit, setDoc, getDoc } from 'firebase/firestore';
import { AuthContext } from '../App';
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
    try {
      await addDoc(collection(db, 'audit_logs'), {
        adminUid: currentUser?.uid,
        adminEmail: profile?.email,
        action,
        targetUid,
        targetEmail,
        details,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Failed to add audit log:", error);
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
    } catch (error) {
      console.error("Failed to send email simulation:", error);
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

    // Boundary checks
    if (nextIndex < 0 || nextIndex >= RANKS.length) return;
    
    // Prevent temp owners from creating other owners or temp owners
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
      const body = `Hello,\n\nYour rank on Eclipse AI has been updated from ${currentRank} to ${newRank}.\n\nBest regards,\nThe Eclipse Team`;
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
    if (bugs.length === 0 || summarizing) return;
    setSummarizing(true);
    try {
      const bugDescriptions = bugs.map(b => `[${b.type}] ${b.description}`).join('\n');
      const prompt = `Summarize these bug reports for the app owner. Group them by type and highlight critical issues:\n\n${bugDescriptions}`;
      const result = await summarizeChat([{ role: 'user', content: prompt }]);
      setSummary(result);
    } catch (error) {
      console.error("Failed to summarize bugs:", error);
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
            <h1 className="text-4xl font-bold tracking-tight">Admin Console</h1>
            <p className="opacity-50 mt-2">Manage users and system access.</p>
          </div>
          
          {(isOwner || isTempOwner) && (
            <div className="flex items-center gap-4 p-4 bg-black/5 dark:bg-white/5 rounded-3xl border border-black/10 dark:border-white/10">
              <div className="flex flex-col">
                <span className="text-sm font-bold">System Maintenance</span>
                <span className="text-[10px] opacity-50 uppercase tracking-widest">Restrict user access</span>
              </div>
              <button 
                onClick={handleToggleMaintenance}
                className={cn(
                  "relative w-14 h-7 rounded-full transition-all duration-300",
                  maintenance ? "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "bg-black/10 dark:bg-white/10"
                )}
              >
                <motion.div 
                  animate={{ x: maintenance ? 32 : 4 }}
                  className="absolute top-1 left-0 w-5 h-5 rounded-full bg-white dark:bg-black shadow-sm flex items-center justify-center"
                >
                  <Settings size={10} className={maintenance ? "animate-spin text-red-500" : "opacity-30"} />
                </motion.div>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 overflow-x-auto">
            <button 
              onClick={() => setActiveTab('users')}
              className={cn(
                "px-6 py-2 rounded-xl font-bold text-sm transition-all whitespace-nowrap",
                activeTab === 'users' ? "bg-black text-white dark:bg-white dark:text-black" : "opacity-50 hover:opacity-100"
              )}
            >
              Users
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={cn(
                "px-6 py-2 rounded-xl font-bold text-sm transition-all whitespace-nowrap",
                activeTab === 'logs' ? "bg-black text-white dark:bg-white dark:text-black" : "opacity-50 hover:opacity-100"
              )}
            >
              Audit Log
            </button>
            {(isOwner || isTempOwner) && (
              <button 
                onClick={() => setActiveTab('bugs')}
                className={cn(
                  "px-6 py-2 rounded-xl font-bold text-sm transition-all whitespace-nowrap",
                  activeTab === 'bugs' ? "bg-black text-white dark:bg-white dark:text-black" : "opacity-50 hover:opacity-100"
                )}
              >
                Bugs
              </button>
            )}
          </div>

          {activeTab === 'users' && (
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={20} />
              <input 
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-black/5 dark:bg-white/5 text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all"
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
              className="flex items-center justify-between p-6 bg-black/5 dark:bg-white/5 rounded-3xl border border-transparent hover:border-black/10 dark:hover:border-white/10 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-black/10 dark:bg-white/10 rounded-2xl flex items-center justify-center">
                  {user.email === OWNER_EMAIL || user.rank === 'Owner' ? (
                    <Shield className="text-orange-500" size={24} />
                  ) : user.rank === 'Temporary Owner' ? (
                    <Shield className="text-blue-500" size={24} />
                  ) : (
                    <UserIcon className="opacity-50" size={24} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold">{user.displayName || 'Anonymous'}</h4>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                      user.banned ? "bg-red-500 text-white" : "bg-black/10 dark:bg-white/10 opacity-50"
                    )}>
                      {user.rank || 'Welcome'} {user.banned && '• BANNED'}
                    </span>
                  </div>
                  <p className="text-sm opacity-50">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {user.email !== OWNER_EMAIL && (
                  <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
                    <button 
                      onClick={() => handleUpdateRank(user.uid, user.email, user.rank || 'Welcome', 'down')}
                      className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
                      title="Demote"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button 
                      onClick={() => handleUpdateRank(user.uid, user.email, user.rank || 'Welcome', 'up')}
                      className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
                      title="Promote"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button 
                      onClick={() => handleToggleBan(user.uid, user.email, !!user.banned)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        user.banned ? "bg-red-500 text-white" : "hover:bg-black/10 dark:hover:bg-white/10"
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
                          user.rank === 'Temporary Owner' ? "bg-blue-500 text-white" : "hover:bg-black/10 dark:hover:bg-white/10"
                        )}
                        title={user.rank === 'Temporary Owner' ? "Remove Temp Owner" : "Make Temp Owner"}
                      >
                        {user.rank === 'Temporary Owner' ? <UserMinus size={14} /> : <UserPlus size={14} />}
                      </button>
                    )}
                  </div>
                )}

                <div className="text-right hidden sm:block min-w-[100px]">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-30">Joined</p>
                  <p className="text-sm font-medium">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
                
                {user.email !== OWNER_EMAIL && user.uid !== currentUser?.uid && (
                  <button 
                    onClick={() => handleDeleteUser(user.uid, user.email)}
                    className="p-3 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="text-center py-20 opacity-30">
              <p className="text-lg">No users found matching your search.</p>
            </div>
          )}
        </div>
      ) : activeTab === 'logs' ? (
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="p-6 bg-black/5 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-black text-white dark:bg-white dark:text-black rounded-lg text-[10px] font-black uppercase tracking-widest">
                    {log.action}
                  </span>
                  <span className="text-xs opacity-50">{format(new Date(log.timestamp), 'MMM d, yyyy HH:mm')}</span>
                </div>
                <p className="text-xs font-medium opacity-50">Admin: {log.adminEmail}</p>
              </div>
              <p className="text-sm font-medium">{log.details}</p>
              <p className="text-[10px] opacity-30 mt-2 uppercase tracking-tighter">Target: {log.targetEmail} ({log.targetUid})</p>
            </div>
          ))}
          {logs.length === 0 && <div className="text-center py-20 opacity-30">No logs found.</div>}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Bug Reports ({bugs.length})</h2>
            <button 
              onClick={handleSummarizeBugs}
              disabled={summarizing || bugs.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl text-sm font-bold disabled:opacity-50"
            >
              {summarizing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              Summarize with AI
            </button>
          </div>

          {summary && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 bg-black/5 dark:bg-white/5 rounded-[2.5rem] border border-black/10 dark:border-white/10 relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-black dark:bg-white opacity-20" />
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Sparkles size={18} />
                AI Summary
              </h3>
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap opacity-80 leading-relaxed">
                {summary}
              </div>
              <button 
                onClick={() => setSummary('')}
                className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
              >
                <X size={16} />
              </button>
            </motion.div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {bugs.map((bug) => (
              <div key={bug.id} className="p-6 bg-black/5 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-black/10 dark:bg-white/10 rounded-xl">
                      <Bug size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-sm uppercase tracking-tight">{bug.type}</p>
                      <p className="text-[10px] opacity-50">{format(new Date(bug.createdAt), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium opacity-50">{bug.email}</span>
                </div>
                <p className="text-sm opacity-80 leading-relaxed">{bug.description}</p>
              </div>
            ))}
            {bugs.length === 0 && <div className="text-center py-20 opacity-30">No bug reports found.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
