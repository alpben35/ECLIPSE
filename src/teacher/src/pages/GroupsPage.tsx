import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Plus, Search, ChevronRight, Lock, Globe, Hash, Filter, Loader2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, onSnapshot, where, addDoc, updateDoc, doc, arrayUnion, orderBy, or } from 'firebase/firestore';
import { AuthContext, ThemeContext } from '@/lib/contexts';
import { SUBJECTS, GRADE_LEVELS } from '@/lib/constants';
import { Link } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function GroupsPage() {
  const { user, profile, isOwner } = useContext(AuthContext);
  const { isDark } = useContext(ThemeContext);
  const [groups, setGroups] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterGrade, setFilterGrade] = useState('All');

  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    subject: SUBJECTS[0].name,
    gradeLevel: GRADE_LEVELS[0],
    isPrivate: false
  });

  useEffect(() => {
    if (!user) return;

    const groupsRef = collection(db, 'groups');
    const q = isOwner 
      ? query(groupsRef)
      : query(groupsRef, or(where('isPrivate', '==', false), where('members', 'array-contains', user.uid)));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let loadedGroups = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Filter in memory to avoid complex index requirements
      loadedGroups = loadedGroups.filter(g => !g.isPrivate || g.members?.includes(user.uid));

      // Sort by createdAt desc
      loadedGroups.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      
      setGroups(loadedGroups);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'groups');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

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
    const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase()) || 
                         g.description.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = filterSubject === 'All' || g.subject === filterSubject;
    const matchesGrade = filterGrade === 'All' || g.gradeLevel === filterGrade;
    return matchesSearch && matchesSubject && matchesGrade;
  });

  const myGroups = filteredGroups.filter(g => g.members.includes(user?.uid));
  const otherGroups = filteredGroups.filter(g => !g.members.includes(user?.uid));

    if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className={cn("animate-spin opacity-20", isDark ? "text-gold" : "text-royal-red")} size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className={cn("text-4xl font-bold tracking-tight", isDark ? "text-gold" : "text-royal-red")}>Study Groups</h1>
          <p className={cn("opacity-80 mt-2", isDark ? "text-gold" : "text-royal-red/80")}>Collaborate with peers on subjects and assignments.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold hover:scale-105 transition-all shadow-xl",
            isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white"
          )}
        >
          <Plus size={20} />
          Create Group
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2", isDark ? "text-gold/60" : "text-royal-red/40")} size={20} />
          <input 
            type="text"
            placeholder="Search groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full pl-12 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 transition-all",
              isDark 
                ? "bg-gold/5 focus:ring-gold/10 text-gold placeholder:text-gold/50" 
                : "bg-white border border-royal-red/10 focus:ring-royal-red/5 text-royal-red placeholder:text-royal-red/30 shadow-sm"
            )}
          />
        </div>
        <select 
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className={cn(
            "px-4 py-3 rounded-2xl focus:outline-none font-medium transition-colors",
            isDark ? "bg-gold/5 text-gold" : "bg-white border border-royal-red/10 text-royal-red"
          )}
        >
          <option value="All">All Subjects</option>
          {SUBJECTS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select 
          value={filterGrade}
          onChange={(e) => setFilterGrade(e.target.value)}
          className={cn(
            "px-4 py-3 rounded-2xl focus:outline-none font-medium transition-colors",
            isDark ? "bg-gold/5 text-gold" : "bg-white border border-royal-red/10 text-royal-red"
          )}
        >
          <option value="All">All Grades</option>
          {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Group Sections */}
      <div className="space-y-12">
        {myGroups.length > 0 && (
          <section className="space-y-6">
            <h2 className={cn("text-2xl font-bold flex items-center gap-2", isDark ? "text-gold" : "text-royal-red")}>
              <Users size={24} className="opacity-50" />
              My Groups
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myGroups.map(group => (
                <GroupCard key={group.id} group={group} isMember={true} isDark={isDark} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-6">
          <h2 className={cn("text-2xl font-bold flex items-center gap-2", isDark ? "text-gold" : "text-royal-red")}>
            <Globe size={24} className="opacity-50" />
            Discover Groups
          </h2>
          {otherGroups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherGroups.map(group => (
                <GroupCard key={group.id} group={group} isMember={false} onJoin={() => joinGroup(group.id)} isDark={isDark} />
              ))}
            </div>
          ) : (
            <div className={cn("text-center py-20 rounded-[3rem] opacity-30", isDark ? "bg-gold/5" : "bg-royal-red/5")}>
              <p className={cn("text-lg", isDark ? "text-gold" : "text-royal-red")}>No other groups found. Why not create one?</p>
            </div>
          )}
        </section>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreating(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "relative w-full max-w-lg rounded-[2.5rem] p-8 md:p-12 shadow-2xl border transition-colors",
                isDark ? "bg-royal-red border-gold/20" : "bg-white border-royal-red/10"
              )}
            >
              <h3 className={cn("text-3xl font-bold mb-8", isDark ? "text-gold" : "text-royal-red")}>Create Study Group</h3>
              <form onSubmit={handleCreateGroup} className="space-y-6">
                <div className="space-y-2">
                  <label className={cn("text-xs font-bold uppercase tracking-widest opacity-50 ml-2", isDark ? "text-gold" : "text-royal-red")}>Group Name</label>
                  <input 
                    type="text"
                    required
                    value={newGroup.name}
                    onChange={e => setNewGroup({...newGroup, name: e.target.value})}
                    placeholder="e.g. Advanced Calculus Squad"
                    className={cn(
                      "w-full p-4 rounded-2xl focus:outline-none font-bold transition-all",
                      isDark 
                        ? "bg-gold/5 text-gold placeholder:text-gold/30" 
                        : "bg-royal-red/5 text-royal-red placeholder:text-royal-red/30"
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <label className={cn("text-xs font-bold uppercase tracking-widest opacity-50 ml-2", isDark ? "text-gold" : "text-royal-red")}>Description</label>
                  <textarea 
                    value={newGroup.description}
                    onChange={e => setNewGroup({...newGroup, description: e.target.value})}
                    placeholder="What's this group about?"
                    className={cn(
                      "w-full p-4 rounded-2xl focus:outline-none min-h-[100px] resize-none transition-all",
                      isDark 
                        ? "bg-gold/5 text-gold placeholder:text-gold/30" 
                        : "bg-royal-red/5 text-royal-red placeholder:text-royal-red/30"
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={cn("text-xs font-bold uppercase tracking-widest opacity-50 ml-2", isDark ? "text-gold" : "text-royal-red")}>Subject</label>
                    <select 
                      value={newGroup.subject}
                      onChange={e => setNewGroup({...newGroup, subject: e.target.value})}
                      className={cn(
                        "w-full p-4 rounded-2xl focus:outline-none font-bold transition-colors",
                        isDark ? "bg-gold/5 text-gold" : "bg-royal-red/5 text-royal-red"
                      )}
                    >
                      {SUBJECTS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className={cn("text-xs font-bold uppercase tracking-widest opacity-50 ml-2", isDark ? "text-gold" : "text-royal-red")}>Grade Level</label>
                    <select 
                      value={newGroup.gradeLevel}
                      onChange={e => setNewGroup({...newGroup, gradeLevel: e.target.value})}
                      className={cn(
                        "w-full p-4 rounded-2xl focus:outline-none font-bold transition-colors",
                        isDark ? "bg-gold/5 text-gold" : "bg-royal-red/5 text-royal-red"
                      )}
                    >
                      {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>

                <div className={cn("flex items-center gap-4 p-4 rounded-2xl transition-colors", isDark ? "bg-gold/5" : "bg-royal-red/5")}>
                  <div className="flex-1">
                    <p className={cn("font-bold", isDark ? "text-gold" : "text-royal-red")}>Private Group</p>
                    <p className={cn("text-xs opacity-50", isDark ? "text-gold" : "text-royal-red")}>Only members with an invite code can join.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setNewGroup({...newGroup, isPrivate: !newGroup.isPrivate})}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      newGroup.isPrivate ? "bg-gold" : (isDark ? "bg-gold/10" : "bg-royal-red/10")
                    )}
                  >
                    <motion.div 
                      animate={{ x: newGroup.isPrivate ? 24 : 4 }}
                      className={cn("absolute top-1 left-0 w-4 h-4 rounded-full", isDark ? "bg-royal-red" : "bg-white shadow-sm")}
                    />
                  </button>
                </div>

                <button 
                  type="submit"
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold shadow-xl hover:scale-105 transition-all text-lg",
                    isDark ? "bg-gold text-royal-red shadow-gold/10" : "bg-royal-red text-white shadow-royal-red/20"
                  )}
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

function GroupCard({ group, isMember, onJoin, isDark }: { group: any, isMember: boolean, onJoin?: () => void, isDark: boolean }) {
  return (
    <motion.div 
      whileHover={{ y: -8 }}
      className={cn(
        "group relative rounded-[2.5rem] p-8 border transition-all",
        isDark 
          ? "bg-gold/5 border-transparent hover:border-gold/20" 
          : "bg-white border-royal-red/10 shadow-sm hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between mb-6">
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
          isDark 
            ? "bg-gold/10 text-gold group-hover:bg-gold group-hover:text-royal-red" 
            : "bg-royal-red/5 text-royal-red group-hover:bg-royal-red group-hover:text-white"
        )}>
          <Hash size={28} />
        </div>
        {group.isPrivate && (
          <div className={cn("p-2 rounded-xl", isDark ? "bg-gold/5" : "bg-royal-red/5")}>
            <Lock size={16} className={isDark ? "text-gold/50" : "text-royal-red/50"} />
          </div>
        )}
      </div>

      <div className="space-y-2 mb-8">
        <h3 className={cn("text-2xl font-bold tracking-tight truncate", isDark ? "text-gold" : "text-royal-red")}>{group.name}</h3>
        <p className={cn("text-sm opacity-60 line-clamp-2 min-h-[2.5rem]", isDark ? "text-gold" : "text-royal-red/60")}>{group.description || 'No description provided.'}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <span className={cn(
          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
          isDark ? "bg-gold/5 text-gold" : "bg-royal-red/5 text-royal-red"
        )}>
          {group.subject}
        </span>
        <span className={cn(
          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
          isDark ? "bg-gold/5 text-gold" : "bg-royal-red/5 text-royal-red"
        )}>
          {group.gradeLevel}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {group.members.slice(0, 3).map((m: string, i: number) => (
            <div key={i} className={cn(
              "w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold",
              isDark ? "border-royal-red bg-gold/10 text-gold" : "border-white bg-royal-red/10 text-royal-red"
            )}>
              {m.substring(0, 1).toUpperCase()}
            </div>
          ))}
          {group.members.length > 3 && (
            <div className={cn(
              "w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold",
              isDark ? "border-royal-red bg-gold/5 text-gold" : "border-white bg-royal-red/5 text-royal-red"
            )}>
              +{group.members.length - 3}
            </div>
          )}
        </div>

        {isMember ? (
          <Link 
            to={`/teacher/groups/${group.id}`}
            className={cn(
              "flex items-center gap-2 text-sm font-bold transition-colors",
              isDark ? "text-gold/80 hover:text-gold" : "text-royal-red/80 hover:text-royal-red"
            )}
          >
            Enter Group
            <ChevronRight size={16} />
          </Link>
        ) : (
          <button 
            onClick={onJoin}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold hover:scale-105 transition-all",
              isDark ? "bg-gold text-royal-red shadow-lg" : "bg-royal-red text-white shadow-md shadow-royal-red/20"
            )}
          >
            Join
          </button>
        )}
      </div>
    </motion.div>
  );
}
