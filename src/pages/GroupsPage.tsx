import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Plus, Search, ChevronRight, Lock, Globe, Hash, Filter, Loader2, UserPlus, UserCheck, UserMinus, UserX, Check, X, User as UserIcon, Trash2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, where, addDoc, updateDoc, doc, arrayUnion, orderBy, or, deleteDoc, getDocs, limit } from 'firebase/firestore';
import { AuthContext } from '../lib/contexts';
import { SUBJECTS, GRADE_LEVELS, OWNER_EMAIL } from '../lib/constants';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

// Groups Management Page - Integrated with Eclipse Hub
export default function GroupsPage() {
  const { user, profile, isOwner, isAdmin } = useContext(AuthContext);
  const [groups, setGroups] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterGrade, setFilterGrade] = useState('All');
  const [activeTab, setActiveTab] = useState<'groups' | 'friends'>('groups');

  // Friends states
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Listen to friendships
    const friendshipsQ = query(
      collection(db, 'friendships'),
      where('users', 'array-contains', user.uid)
    );
    const unsubFriends = onSnapshot(friendshipsQ, async (snapshot) => {
      const friendIds = snapshot.docs.map(doc => {
        const data = doc.data();
        return data.users.find((id: string) => id !== user.uid);
      });
      
      const friendProfiles = await Promise.all(
        friendIds.map(async (id) => {
          const snap = await getDocs(query(collection(db, 'public_profiles'), where('uid', '==', id)));
          return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
        })
      );
      setFriends(friendProfiles.filter(p => p !== null));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'friendships'));

    // Listen to friend requests
    const requestsQ = query(
      collection(db, 'friend_requests'),
      where('to', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsubRequests = onSnapshot(requestsQ, async (snapshot) => {
      const reqData = await Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data();
        const userSnap = await getDocs(query(collection(db, 'public_profiles'), where('uid', '==', data.from)));
        return {
          id: d.id,
          ...data,
          user: userSnap.empty ? null : userSnap.docs[0].data()
        };
      }));
      setRequests(reqData.filter(r => r.user !== null));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'friend_requests'));

    return () => {
      unsubFriends();
      unsubRequests();
    };
  }, [user]);

  useEffect(() => {
    if (userSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      setSearchingUsers(true);
      try {
        const searchTerm = userSearch.toLowerCase().trim();
        const q = query(
          collection(db, 'public_profiles'),
          where('displayName_lowercase', '>=', searchTerm),
          where('displayName_lowercase', '<=', searchTerm + '\uf8ff'),
          limit(10)
        );
        const snap = await getDocs(q);
        setSearchResults(snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(u => u.uid !== user?.uid)
        );
      } catch (err) {
        console.error(err);
      } finally {
        setSearchingUsers(false);
      }
    };

    const timer = setTimeout(searchUsers, 500);
    return () => clearTimeout(timer);
  }, [userSearch, user]);

  const sendFriendRequest = async (targetUid: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'friend_requests'), {
        from: user.uid,
        to: targetUid,
        status: 'pending',
        timestamp: new Date().toISOString()
      });
      setUserSearch('');
      setSearchResults([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'friend_requests');
    }
  };

  const handleRequest = async (requestId: string, fromUid: string, status: 'accepted' | 'rejected') => {
    if (!user) return;
    try {
      if (status === 'accepted') {
        await addDoc(collection(db, 'friendships'), {
          users: [user.uid, fromUid],
          timestamp: new Date().toISOString()
        });
      }
      await deleteDoc(doc(db, 'friend_requests', requestId));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'friend_requests');
    }
  };

  const removeFriend = async (friendUid: string) => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'friendships'),
        where('users', 'array-contains', user.uid)
      );
      const snap = await getDocs(q);
      const friendship = snap.docs.find(d => d.data().users.includes(friendUid));
      if (friendship) {
        await deleteDoc(doc(db, 'friendships', friendship.id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'friendships');
    }
  };

  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    subject: SUBJECTS[0].name,
    gradeLevel: GRADE_LEVELS[0],
    isPrivate: false
  });

  useEffect(() => {
    if (!user) return;

    // Listen to all public groups OR groups where the user is a member OR all groups if admin
    const groupsRef = collection(db, 'groups');
    const q = isAdmin 
      ? query(groupsRef)
      : query(groupsRef, or(where('isPrivate', '==', false), where('members', 'array-contains', user.uid)));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let loadedGroups = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Filter in memory to avoid complex index requirements for 'or' queries with 'orderBy'
      if (!isAdmin) {
        loadedGroups = loadedGroups.filter(g => !g.isPrivate || g.members?.includes(user.uid));
      }

      // Sort by createdAt desc
      loadedGroups.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      
      const isAdminPlus = profile?.email === OWNER_EMAIL || 
                          profile?.rank === 'Owner' || 
                          profile?.rank === 'Temporary Owner' || 
                          profile?.rank === 'Admin';

      if (isAdminPlus && !loadedGroups.some(g => g.id === 'admin_council')) {
        loadedGroups.unshift({
          id: 'admin_council',
          name: 'Admin Council',
          description: 'Private group for Admins and Owners to discuss system vision.',
          subject: 'System',
          gradeLevel: 'All',
          isPrivate: true,
          members: [], // Will be handled in GroupDetailPage
          createdAt: new Date().toISOString()
        });
      }

      setGroups(loadedGroups);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'groups');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isOwner, profile]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const groupData = {
        ...newGroup,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        members: [user.uid],
        inviteCode: newGroup.isPrivate ? Math.random().toString(36).substring(2, 8).toUpperCase() : null
      };

      await addDoc(collection(db, 'groups'), groupData);
      setIsCreating(false);
      setNewGroup({
        name: '',
        description: '',
        subject: SUBJECTS[0].name,
        gradeLevel: GRADE_LEVELS[0],
        isPrivate: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'groups');
    }
  };

  const joinGroup = async (groupId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        members: arrayUnion(user.uid)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${groupId}`);
    }
  };

  const filteredGroups = groups.filter(g => {
    const matchesSearch = (g.name || '').toLowerCase().includes(search.toLowerCase()) || 
                          (g.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesSubject = filterSubject === 'All' || g.subject === filterSubject;
    const matchesGrade = filterGrade === 'All' || g.gradeLevel === filterGrade;
    return matchesSearch && matchesSubject && matchesGrade;
  });

  const myGroups = filteredGroups.filter(g => (g.members || []).includes(user?.uid));
  const otherGroups = filteredGroups.filter(g => !(g.members || []).includes(user?.uid));

  const handleDeleteGroup = async (groupId: string) => {
    if (!window.confirm("Are you sure you want to delete this group? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'groups', groupId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `groups/${groupId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin opacity-20" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter italic uppercase">Study <span className="opacity-50">Teams</span></h1>
          <p className="opacity-60 mt-2 font-medium">Coordinate with your squad and dominate the leaderboard.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl">
            <button 
              onClick={() => setActiveTab('groups')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'groups' ? "bg-white dark:bg-zinc-800 shadow-sm" : "opacity-30 hover:opacity-100"
              )}
            >
              Teams
            </button>
            <button 
              onClick={() => setActiveTab('friends')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'friends' ? "bg-white dark:bg-zinc-800 shadow-sm" : "opacity-30 hover:opacity-100"
              )}
            >
              Friends {requests.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-black dark:bg-white text-white dark:text-black text-[10px] rounded-full">{requests.length}</span>}
            </button>
          </div>
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-xl"
          >
            <Plus size={20} />
            Create Team
          </button>
        </div>
      </div>

      {activeTab === 'groups' ? (
        <>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-60 dark:opacity-30" size={20} />
              <input 
                type="text"
                placeholder="Search groups..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 text-black dark:text-white transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
              />
            </div>
            <select 
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="px-4 py-3 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none font-medium"
            >
              <option value="All">All Subjects</option>
              {SUBJECTS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select 
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="px-4 py-3 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none font-medium"
            >
              <option value="All">All Grades</option>
              {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* Group Sections */}
          <div className="space-y-12">
            {myGroups.length > 0 && (
              <section className="space-y-6">
                <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                  <Users size={20} className="text-black dark:text-white" />
                  My Teams
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myGroups.map(group => (
                    <GroupCard 
                      key={group.id} 
                      group={group} 
                      isMember={true} 
                      isAdmin={isAdmin}
                      currentUserId={user?.uid}
                      onDelete={() => handleDeleteGroup(group.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-6">
              <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                <Globe size={20} className="text-black dark:text-white" />
                Discover Teams
              </h2>
              {otherGroups.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {otherGroups.map(group => (
                    <GroupCard 
                      key={group.id} 
                      group={group} 
                      isMember={false} 
                      isAdmin={isAdmin}
                      currentUserId={user?.uid}
                      onJoin={() => joinGroup(group.id)} 
                      onDelete={() => handleDeleteGroup(group.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-black/5 dark:bg-white/5 rounded-[3rem] border-2 border-dashed border-black/5 dark:border-white/5">
                  <p className="text-sm font-bold uppercase tracking-widest opacity-30">No active teams found</p>
                </div>
              )}
            </section>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Search & Requests */}
          <div className="lg:col-span-1 space-y-8">
            <section className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Search size={20} className="opacity-50" />
                Find Friends
              </h2>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Search by name..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none font-bold"
                />
                {searchingUsers && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin opacity-30" size={20} />}
              </div>
              
              <div className="space-y-2">
                {searchResults.map(u => {
                  const isFriend = friends.some(f => f.uid === u.uid);
                  return (
                    <div key={u.id} className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                        <div>
                          <p className="text-sm font-bold">{u.displayName}</p>
                          <p className="text-[10px] opacity-50 uppercase tracking-widest font-bold">{u.rank}</p>
                        </div>
                      </div>
                      {!isFriend && (
                        <button 
                          onClick={() => sendFriendRequest(u.uid)}
                          className="p-2 bg-black text-white dark:bg-white dark:text-black rounded-xl hover:scale-110 transition-transform"
                        >
                          <UserPlus size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {requests.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <UserCheck size={20} className="opacity-50" />
                  Friend Requests
                </h2>
                <div className="space-y-3">
                  {requests.map(req => (
                    <div key={req.id} className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={req.user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.from}`} className="w-10 h-10 rounded-full object-cover shrink-0" alt="" />
                        <div>
                          <p className="text-sm font-bold">{req.user.displayName}</p>
                          <p className="text-[10px] opacity-50 uppercase tracking-widest font-bold">Wants to be friends</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleRequest(req.id, req.from, 'accepted')}
                          className="p-2 bg-green-500 text-white rounded-xl hover:scale-110 transition-transform"
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          onClick={() => handleRequest(req.id, req.from, 'rejected')}
                          className="p-2 bg-red-500 text-white rounded-xl hover:scale-110 transition-transform"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Friends List */}
          <div className="lg:col-span-2">
            <section className="space-y-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Users size={24} className="opacity-50" />
                My Friends ({friends.length})
              </h2>
              {friends.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {friends.map(friend => (
                    <div key={friend.id} className="p-6 bg-black/5 dark:bg-white/5 rounded-[2rem] flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <img src={friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`} className="w-12 h-12 rounded-2xl object-cover shrink-0" alt="" />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">{friend.displayName}</p>
                          <p className="text-xs opacity-50 font-bold uppercase tracking-widest">{friend.rank} • Level {friend.level}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeFriend(friend.uid)}
                        className="p-3 bg-red-500/10 text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                      >
                        <UserMinus size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-black/5 dark:bg-white/5 rounded-[3rem] opacity-30">
                  <p className="text-lg">No friends yet. Start searching to connect!</p>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreating(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[3rem] p-10 shadow-2xl border border-black/5 dark:border-white/5"
            >
              <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-8">Deploy New <span className="opacity-50">Team</span></h3>
              <form onSubmit={handleCreateGroup} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-4">Full Team Designation</label>
                  <input 
                    type="text"
                    required
                    value={newGroup.name}
                    onChange={e => setNewGroup({...newGroup, name: e.target.value})}
                    placeholder="e.g. ALPHA SQUAD - BIOLOGY"
                    className="w-full p-5 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none font-bold placeholder:opacity-30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2">Description</label>
                  <textarea 
                    value={newGroup.description}
                    onChange={e => setNewGroup({...newGroup, description: e.target.value})}
                    placeholder="What's this group about?"
                    className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none min-h-[100px] resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2">Subject</label>
                    <select 
                      value={newGroup.subject}
                      onChange={e => setNewGroup({...newGroup, subject: e.target.value})}
                      className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none font-bold"
                    >
                      {SUBJECTS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2">Grade Level</label>
                    <select 
                      value={newGroup.gradeLevel}
                      onChange={e => setNewGroup({...newGroup, gradeLevel: e.target.value})}
                      className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none font-bold"
                    >
                      {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
                  <div className="flex-1">
                    <p className="font-bold">Private Group</p>
                    <p className="text-xs opacity-50">Only members with an invite code can join.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setNewGroup({...newGroup, isPrivate: !newGroup.isPrivate})}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      newGroup.isPrivate ? "bg-black dark:bg-white" : "bg-black/10 dark:bg-white/10"
                    )}
                  >
                    <motion.div 
                      animate={{ x: newGroup.isPrivate ? 24 : 4 }}
                      className="absolute top-1 left-0 w-4 h-4 rounded-full bg-white dark:bg-black"
                    />
                  </button>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform"
                >
                  Create Group
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GroupCard({ group, isMember, isAdmin, currentUserId, onJoin, onDelete }: { group: any, isMember: boolean, isAdmin?: boolean, currentUserId?: string, onJoin?: () => void, onDelete?: () => void }) {
  return (
    <motion.div 
      whileHover={{ y: -8 }}
      className="group relative bg-black/5 dark:bg-white/5 rounded-[2.5rem] p-8 border border-transparent hover:border-black/10 dark:hover:border-white/10 transition-all"
    >
      <div className="flex items-start justify-between mb-6">
        <div className="w-14 h-14 bg-black/10 dark:bg-white/10 rounded-2xl flex items-center justify-center group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-all font-black text-xl italic tracking-tighter">
          {group.name ? group.name.substring(0, 2).toUpperCase() : 'TM'}
        </div>
        <div className="flex items-center gap-2">
          {group.isPrivate && (
            <div className="p-2 bg-black/5 dark:bg-white/5 rounded-xl">
              <Lock size={16} className="opacity-50" />
            </div>
          )}
          {(isAdmin || group.createdBy === currentUserId) && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete?.();
              }}
              className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-8">
        <h3 className="text-2xl font-bold tracking-tight truncate text-black dark:text-white">{group.name}</h3>
        <p className="text-sm text-black/60 dark:text-white/60 line-clamp-2 min-h-[2.5rem]">{group.description || 'No description provided.'}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <span className="px-3 py-1 bg-black/5 dark:bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest opacity-80">
          {group.subject}
        </span>
        <span className="px-3 py-1 bg-black/5 dark:bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest opacity-80">
          {group.gradeLevel}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {(group.members || []).slice(0, 3).map((m: string, i: number) => (
            <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-black bg-black/10 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold">
              {(m || '').substring(0, 1)}
            </div>
          ))}
          {(group.members || []).length > 3 && (
            <div className="w-8 h-8 rounded-full border-2 border-white dark:border-black bg-black/5 dark:bg-white/5 flex items-center justify-center text-[10px] font-bold">
              +{(group.members || []).length - 3}
            </div>
          )}
        </div>

        {isMember || isAdmin ? (
          <Link 
            to={`/groups/${group.id}`}
            className="flex items-center gap-2 text-sm font-bold opacity-80 dark:opacity-70 hover:opacity-100 transition-opacity"
          >
            Enter Group
            <ChevronRight size={16} />
          </Link>
        ) : (
          <button 
            onClick={onJoin}
            className="px-6 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl text-sm font-bold hover:scale-105 transition-transform"
          >
            Join
          </button>
        )}
      </div>
    </motion.div>
  );
}
