import React, { useState, useEffect, useContext } from 'react';
import { motion } from 'motion/react';
import { Search, Trash2, Shield, User as UserIcon, Loader2, ArrowUp, ArrowDown, Ban, UserPlus, UserMinus, Bug, Settings, Sparkles, Globe, ChevronRight } from 'lucide-react';
import { db, handleFirestoreError, OperationType, decryptData } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, deleteDoc, where, updateDoc, addDoc, orderBy, limit, setDoc, getDoc } from 'firebase/firestore';
import { AuthContext, ThemeContext } from '@/lib/contexts';
import { OWNER_EMAIL, RANKS } from '@/constants';
import { clsx, type ClassValue } from 'clsx';
import { Link } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { summarizeChat } from '@/lib/gemini';

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
  const { isDark } = useContext(ThemeContext);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [maintenance, setMaintenance] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'bugs' | 'settings'>('users');
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
    const isAdmin = profile?.email === OWNER_EMAIL || 
                    profile?.rank === 'Owner' || 
                    profile?.rank === 'Temporary Owner' || 
                    profile?.rank === 'Admin';

    if (!isAdmin) {
      alert("Access Denied: Only admins can toggle maintenance mode.");
      return;
    }

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
      alert(`Maintenance mode successfully ${newStatus ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'system/maintenance');
    }
  };

  const handleCompleteBug = async (bugId: string) => {
    try {
      await updateDoc(doc(db, 'bugs', bugId), { status: 'completed' });
      alert("Bug marked as completed.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bugs/${bugId}`);
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
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-8 text-center">
      <div className="flex flex-col gap-6 text-left">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className={cn("text-4xl font-bold tracking-tight", isDark ? "text-gold" : "text-royal-red")}>Teacher Admin Console</h1>
            <p className={cn("opacity-50 mt-2", isDark ? "text-gold" : "text-royal-red/80")}>Manage educators and system access.</p>
          </div>
          
          {(isOwner || isTempOwner) && (
            <div className={cn("flex items-center gap-4 p-4 rounded-3xl border", isDark ? "bg-gold/5 border-gold/10" : "bg-white border-royal-red/10 shadow-sm")}>
              <div className="flex flex-col">
                <span className={cn("text-sm font-bold", isDark ? "text-gold" : "text-royal-red")}>System Maintenance</span>
                <span className={cn("text-[10px] opacity-50 uppercase tracking-widest", isDark ? "text-gold" : "text-royal-red")}>Restrict user access</span>
              </div>
              <button 
                onClick={handleToggleMaintenance}
                className={cn(
                  "relative w-14 h-7 rounded-full transition-all duration-300",
                  maintenance ? "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]" : (isDark ? "bg-gold/10" : "bg-royal-red/10")
                )}
              >
                <motion.div 
                  animate={{ x: maintenance ? 32 : 4 }}
                  className={cn("absolute top-1 left-0 w-5 h-5 rounded-full shadow-sm flex items-center justify-center", isDark ? "bg-gold" : "bg-royal-red")}
                >
                  <Settings size={10} className={cn("transition-colors", maintenance ? "animate-spin text-white" : (isDark ? "opacity-30 text-royal-red" : "opacity-30 text-white"))} />
                </motion.div>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className={cn("flex items-center gap-2 p-1 rounded-2xl border overflow-x-auto", isDark ? "bg-gold/5 border-gold/10" : "bg-royal-red/5 border-royal-red/10")}>
            <button 
              onClick={() => setActiveTab('users')}
              className={cn(
                "px-6 py-2 rounded-xl font-bold text-sm transition-all whitespace-nowrap",
                activeTab === 'users' 
                  ? (isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white shadow-sm")
                  : (isDark ? "text-gold opacity-50 hover:opacity-100" : "text-royal-red opacity-50 hover:opacity-100")
              )}
            >
              Educators
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={cn(
                "px-6 py-2 rounded-xl font-bold text-sm transition-all whitespace-nowrap",
                activeTab === 'logs' 
                  ? (isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white shadow-sm")
                  : (isDark ? "text-gold opacity-50 hover:opacity-100" : "text-royal-red opacity-50 hover:opacity-100")
              )}
            >
              Audit Log
            </button>
            {(isOwner || isTempOwner) && (
              <button 
                onClick={() => setActiveTab('bugs')}
                className={cn(
                  "px-6 py-2 rounded-xl font-bold text-sm transition-all whitespace-nowrap",
                  activeTab === 'bugs' 
                    ? (isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white shadow-sm")
                    : (isDark ? "text-gold opacity-50 hover:opacity-100" : "text-royal-red opacity-50 hover:opacity-100")
                )}
              >
                Bugs
              </button>
            )}
            {(isOwner || isTempOwner) && (
              <button 
                onClick={() => setActiveTab('settings')}
                className={cn(
                  "px-6 py-2 rounded-xl font-bold text-sm transition-all whitespace-nowrap",
                  activeTab === 'settings' 
                    ? (isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white shadow-sm")
                    : (isDark ? "text-gold opacity-50 hover:opacity-100" : "text-royal-red opacity-50 hover:opacity-100")
                )}
              >
                Settings
              </button>
            )}
          </div>

          {activeTab === 'users' && (
            <div className="relative w-full md:w-96">
              <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 opacity-30", isDark ? "text-gold" : "text-royal-red")} size={20} />
              <input 
                type="text"
                placeholder="Search educators..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  "w-full pl-12 pr-4 py-3 rounded-2xl border focus:outline-none focus:ring-2 transition-all",
                  isDark 
                    ? "bg-gold/10 text-gold border-gold/20 focus:ring-gold/10 placeholder:text-gold/40" 
                    : "bg-white text-royal-red border-royal-red/10 focus:ring-royal-red/10 placeholder:text-royal-red/40"
                )}
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
              className={cn(
                "flex items-center justify-between p-6 rounded-3xl border transition-all text-left",
                isDark ? "bg-gold/10 border-gold/20" : "bg-white border-royal-red/10 shadow-sm"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", isDark ? "bg-gold/10" : "bg-royal-red/5")}>
                  {user.email === OWNER_EMAIL || user.rank === 'Owner' ? (
                    <Shield className={isDark ? "text-gold" : "text-royal-red"} size={24} />
                  ) : user.rank === 'Temporary Owner' ? (
                    <Shield className={isDark ? "text-gold" : "text-royal-red"} size={24} />
                  ) : (
                    <UserIcon className={cn("opacity-50", isDark ? "text-gold" : "text-royal-red")} size={24} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className={cn("font-bold", isDark ? "text-gold" : "text-royal-red")}>{user.displayName || 'Anonymous'}</h4>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                      user.banned ? "bg-red-500 text-white" : (isDark ? "bg-gold/20 text-gold opacity-50" : "bg-royal-red/10 text-royal-red opacity-50")
                    )}>
                      {user.rank || 'Welcome'} {user.banned && '• BANNED'}
                    </span>
                  </div>
                  <p className={cn("text-sm opacity-50", isDark ? "text-gold" : "text-royal-red")}>{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {user.email !== OWNER_EMAIL && (
                  <div className={cn("flex items-center gap-1 p-1 rounded-xl", isDark ? "bg-gold/10" : "bg-royal-red/5")}>
                    <button 
                      onClick={() => handleUpdateRank(user.uid, user.email, user.rank || 'Welcome', 'down')}
                      className={cn("p-2 rounded-lg transition-colors", isDark ? "hover:bg-gold/20 text-gold" : "hover:bg-royal-red/10 text-royal-red")}
                      title="Demote"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button 
                      onClick={() => handleUpdateRank(user.uid, user.email, user.rank || 'Welcome', 'up')}
                      className={cn("p-2 rounded-lg transition-colors", isDark ? "hover:bg-gold/20 text-gold" : "hover:bg-royal-red/10 text-royal-red")}
                      title="Promote"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button 
                      onClick={() => handleToggleBan(user.uid, user.email, !!user.banned)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        user.banned ? "bg-red-500 text-white" : (isDark ? "hover:bg-gold/20 text-gold" : "hover:bg-royal-red/10 text-royal-red")
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
                          user.rank === 'Temporary Owner' ? (isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white") : (isDark ? "hover:bg-gold/20 text-gold" : "hover:bg-royal-red/10 text-royal-red")
                        )}
                        title={user.rank === 'Temporary Owner' ? "Remove Temp Owner" : "Make Temp Owner"}
                      >
                        {user.rank === 'Temporary Owner' ? <UserMinus size={14} /> : <UserPlus size={14} />}
                      </button>
                    )}
                  </div>
                )}

                <div className="text-right hidden sm:block min-w-[100px]">
                  <p className={cn("text-xs font-bold uppercase tracking-widest opacity-30", isDark ? "text-gold" : "text-royal-red")}>Joined</p>
                  <p className={cn("text-sm font-medium", isDark ? "text-gold" : "text-royal-red")}>
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
                
                {user.email !== OWNER_EMAIL && user.uid !== currentUser?.uid && (
                  <button 
                    onClick={() => handleDeleteUser(user.uid, user.email)}
                    className={cn("p-3 rounded-xl transition-all", isDark ? "hover:bg-red-500/10 hover:text-red-500 text-gold" : "hover:bg-red-500/10 hover:text-red-500 text-royal-red")}
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
        <div className="space-y-4 text-left">
          {logs.map((log) => (
            <motion.div 
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "p-4 rounded-2xl border flex items-start justify-between gap-4 transition-colors",
                isDark ? "bg-gold/5 border-gold/10" : "bg-white border-royal-red/10 shadow-sm"
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                    log.action.includes('BAN') ? "bg-red-500/20 text-red-500" :
                    log.action.includes('DELETE') ? "bg-red-500/20 text-red-500" :
                    (isDark ? "bg-gold/20 text-gold" : "bg-royal-red/10 text-royal-red")
                  )}>
                    {log.action.replace('_', ' ')}
                  </span>
                  <span className={cn("text-xs opacity-30 font-bold", isDark ? "text-gold" : "text-royal-red")}>
                    {format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}
                  </span>
                </div>
                <p className={cn("text-sm font-medium", isDark ? "text-gold" : "text-royal-red")}>
                  <span className="opacity-50">Admin:</span> {log.adminEmail}
                </p>
                <p className={cn("text-sm", isDark ? "text-gold" : "text-royal-red")}>
                  {log.details}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={cn("text-[10px] font-black uppercase tracking-widest opacity-30", isDark ? "text-gold" : "text-royal-red")}>Target</p>
                <p className={cn("text-xs font-bold", isDark ? "text-gold" : "text-royal-red")}>{log.targetEmail}</p>
              </div>
            </motion.div>
          ))}
          {logs.length === 0 && (
            <div className="text-center py-20 opacity-30">
              <p className="text-lg">No audit logs recorded yet.</p>
            </div>
          )}
        </div>
      ) : activeTab === 'bugs' ? (
        <div className="space-y-8 text-left">
          <div className="flex items-center justify-between">
            <h2 className={cn("text-2xl font-bold", isDark ? "text-gold" : "text-royal-red")}>Reported Bugs</h2>
            <button 
              onClick={handleSummarizeBugs}
              disabled={summarizing || bugs.length === 0}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold hover:scale-105 transition-all disabled:opacity-50",
                isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white"
              )}
            >
              {summarizing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
              Summarize with AI
            </button>
          </div>

          {summary && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("p-6 border rounded-3xl space-y-4", isDark ? "bg-gold/10 border-gold/20" : "bg-royal-red/5 border-royal-red/10")}
            >
              <div className={cn("flex items-center gap-2", isDark ? "text-gold" : "text-royal-red")}>
                <Sparkles size={20} />
                <h3 className="font-bold">AI Summary</h3>
              </div>
              <div className={cn("opacity-80 whitespace-pre-wrap leading-relaxed", isDark ? "text-gold" : "text-royal-red")}>
                {summary}
              </div>
              <button 
                onClick={() => setSummary('')}
                className={cn("text-xs font-bold opacity-50 hover:opacity-100", isDark ? "text-gold" : "text-royal-red")}
              >
                Clear Summary
              </button>
            </motion.div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {bugs.filter(b => b.status !== 'completed').map((bug) => (
              <motion.div 
                key={bug.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("p-6 border rounded-3xl space-y-4 flex items-center justify-between gap-4", isDark ? "bg-gold/5 border-gold/10" : "bg-white border-royal-red/10 shadow-sm")}
              >
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-xl", isDark ? "bg-gold/10 text-gold" : "bg-royal-red/10 text-royal-red")}>
                        <Bug size={20} />
                      </div>
                      <div>
                        <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full", isDark ? "bg-gold/20 text-gold" : "bg-royal-red/10 text-royal-red")}>
                          {bug.type}
                        </span>
                        <p className={cn("text-xs opacity-50 mt-1", isDark ? "text-gold" : "text-royal-red")}>
                          {format(new Date(bug.createdAt), 'MMM d, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-bold", isDark ? "text-gold" : "text-royal-red")}>{bug.email}</p>
                      <p className={cn("text-[10px] opacity-30 uppercase font-black", isDark ? "text-gold" : "text-royal-red")}>Reporter</p>
                    </div>
                  </div>
                  <p className={cn("leading-relaxed", isDark ? "text-gold" : "text-royal-red")}>
                    {decryptData(bug.description)}
                  </p>
                </div>
                <button 
                  onClick={() => handleCompleteBug(bug.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold hover:scale-105 transition-all whitespace-nowrap",
                    isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white"
                  )}
                >
                  Complete
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-8 text-left">
          <div className={cn("p-8 rounded-[2rem] border transition-colors", isDark ? "bg-gold/5 border-gold/10" : "bg-white border-royal-red/10 shadow-sm")}>
            <h3 className={cn("text-xl font-bold mb-6 flex items-center gap-2", isDark ? "text-gold" : "text-royal-red")}>
              <Settings size={20} />
              System Settings
            </h3>
            
            <div className="space-y-6">
              <div className={cn("flex items-center justify-between p-4 rounded-2xl border transition-colors", isDark ? "bg-gold/5 border-gold/10" : "bg-royal-red/5 border-royal-red/10")}>
                <div className="text-left">
                  <p className={cn("font-bold", isDark ? "text-gold" : "text-royal-red")}>Maintenance Mode</p>
                  <p className={cn("text-sm opacity-50", isDark ? "text-gold" : "text-royal-red/80")}>Restrict access to the platform for maintenance.</p>
                </div>
                <button 
                  onClick={handleToggleMaintenance}
                  className={cn(
                    "px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ml-4",
                    maintenance ? "bg-red-500 text-white" : (isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white")
                  )}
                >
                  {maintenance ? 'Disable' : 'Enable'}
                </button>
              </div>

              <div className={cn("pt-8 border-t", isDark ? "border-gold/10" : "border-royal-red/10")}>
                <h4 className={cn("font-bold mb-4 flex items-center gap-2", isDark ? "text-gold" : "text-royal-red")}>
                  <Globe size={18} />
                  Infrastructure
                </h4>
                <Link 
                  to="/teacher/dns"
                  className={cn(
                    "inline-flex items-center gap-3 p-6 rounded-3xl font-bold hover:scale-105 transition-all shadow-xl group",
                    isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white"
                  )}
                >
                  <div className={cn("p-3 rounded-2xl group-hover:scale-110 transition-transform", isDark ? "bg-royal-red/10" : "bg-white/10")}>
                    <Globe size={24} />
                  </div>
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-lg">DNS Management</span>
                    <span className="text-[10px] opacity-50 uppercase tracking-widest mt-1">Configure Zones & Records</span>
                  </div>
                  <ChevronRight className="ml-4 opacity-50" size={20} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
