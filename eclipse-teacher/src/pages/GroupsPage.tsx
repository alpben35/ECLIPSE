import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Plus, Search, ChevronRight, Lock, Globe, Hash, Filter, Loader2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../../src/lib/firebase';
import { collection, query, onSnapshot, where, addDoc, updateDoc, doc, arrayUnion, orderBy, or } from 'firebase/firestore';
import { AuthContext } from '../../../src/App';
import { SUBJECTS, GRADE_LEVELS } from '../../../src/lib/constants';
import { Link } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function GroupsPage() {
  const { user, profile } = useContext(AuthContext);
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

    const q = query(
      collection(db, 'groups'), 
      or(
        where('isPrivate', '==', false),
        where('members', 'array-contains', user.uid)
      ),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedGroups = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setGroups(loadedGroups);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'groups'));

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
        <Loader2 className="animate-spin opacity-20 text-gold" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gold">Study Groups</h1>
          <p className="opacity-80 mt-2 text-gold">Collaborate with peers on subjects and assignments.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gold text-royal-red rounded-2xl font-bold hover:scale-105 transition-transform shadow-xl"
        >
          <Plus size={20} />
          Create Group
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/60" size={20} />
          <input 
            type="text"
            placeholder="Search groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gold/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gold/10 transition-all text-gold placeholder:text-gold/50"
          />
        </div>
        <select 
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="px-4 py-3 bg-gold/5 rounded-2xl focus:outline-none font-medium text-gold"
        >
          <option value="All">All Subjects</option>
          {SUBJECTS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select 
          value={filterGrade}
          onChange={(e) => setFilterGrade(e.target.value)}
          className="px-4 py-3 bg-gold/5 rounded-2xl focus:outline-none font-medium text-gold"
        >
          <option value="All">All Grades</option>
          {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Group Sections */}
      <div className="space-y-12">
        {myGroups.length > 0 && (
          <section className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-gold">
              <Users size={24} className="opacity-50" />
              My Groups
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myGroups.map(group => (
                <GroupCard key={group.id} group={group} isMember={true} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-gold">
            <Globe size={24} className="opacity-50" />
            Discover Groups
          </h2>
          {otherGroups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherGroups.map(group => (
                <GroupCard key={group.id} group={group} isMember={false} onJoin={() => joinGroup(group.id)} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-gold/5 rounded-[3rem] opacity-30">
              <p className="text-lg text-gold">No other groups found. Why not create one?</p>
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
              className="relative w-full max-w-lg bg-royal-red rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-gold/20"
            >
              <h3 className="text-3xl font-bold mb-8 text-gold">Create Study Group</h3>
              <form onSubmit={handleCreateGroup} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2 text-gold">Group Name</label>
                  <input 
                    type="text"
                    required
                    value={newGroup.name}
                    onChange={e => setNewGroup({...newGroup, name: e.target.value})}
                    placeholder="e.g. Advanced Calculus Squad"
                    className="w-full p-4 bg-gold/5 rounded-2xl focus:outline-none font-bold text-gold placeholder:text-gold/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2 text-gold">Description</label>
                  <textarea 
                    value={newGroup.description}
                    onChange={e => setNewGroup({...newGroup, description: e.target.value})}
                    placeholder="What's this group about?"
                    className="w-full p-4 bg-gold/5 rounded-2xl focus:outline-none min-h-[100px] resize-none text-gold placeholder:text-gold/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2 text-gold">Subject</label>
                    <select 
                      value={newGroup.subject}
                      onChange={e => setNewGroup({...newGroup, subject: e.target.value})}
                      className="w-full p-4 bg-gold/5 rounded-2xl focus:outline-none font-bold text-gold"
                    >
                      {SUBJECTS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2 text-gold">Grade Level</label>
                    <select 
                      value={newGroup.gradeLevel}
                      onChange={e => setNewGroup({...newGroup, gradeLevel: e.target.value})}
                      className="w-full p-4 bg-gold/5 rounded-2xl focus:outline-none font-bold text-gold"
                    >
                      {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gold/5 rounded-2xl">
                  <div className="flex-1">
                    <p className="font-bold text-gold">Private Group</p>
                    <p className="text-xs opacity-50 text-gold">Only members with an invite code can join.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setNewGroup({...newGroup, isPrivate: !newGroup.isPrivate})}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      newGroup.isPrivate ? "bg-gold" : "bg-gold/10"
                    )}
                  >
                    <motion.div 
                      animate={{ x: newGroup.isPrivate ? 24 : 4 }}
                      className="absolute top-1 left-0 w-4 h-4 rounded-full bg-royal-red"
                    />
                  </button>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-gold text-royal-red rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform"
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

function GroupCard({ group, isMember, onJoin }: { group: any, isMember: boolean, onJoin?: () => void }) {
  return (
    <motion.div 
      whileHover={{ y: -8 }}
      className="group relative bg-gold/5 rounded-[2.5rem] p-8 border border-transparent hover:border-gold/20 transition-all"
    >
      <div className="flex items-start justify-between mb-6">
        <div className="w-14 h-14 bg-gold/10 rounded-2xl flex items-center justify-center group-hover:bg-gold group-hover:text-royal-red transition-all text-gold">
          <Hash size={28} />
        </div>
        {group.isPrivate && (
          <div className="p-2 bg-gold/5 rounded-xl">
            <Lock size={16} className="text-gold/50" />
          </div>
        )}
      </div>

      <div className="space-y-2 mb-8">
        <h3 className="text-2xl font-bold tracking-tight truncate text-gold">{group.name}</h3>
        <p className="text-sm opacity-60 line-clamp-2 min-h-[2.5rem] text-gold">{group.description || 'No description provided.'}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <span className="px-3 py-1 bg-gold/5 rounded-full text-[10px] font-bold uppercase tracking-widest text-gold">
          {group.subject}
        </span>
        <span className="px-3 py-1 bg-gold/5 rounded-full text-[10px] font-bold uppercase tracking-widest text-gold">
          {group.gradeLevel}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {group.members.slice(0, 3).map((m: string, i: number) => (
            <div key={i} className="w-8 h-8 rounded-full border-2 border-royal-red bg-gold/10 flex items-center justify-center text-[10px] font-bold text-gold">
              {m.substring(0, 1)}
            </div>
          ))}
          {group.members.length > 3 && (
            <div className="w-8 h-8 rounded-full border-2 border-royal-red bg-gold/5 flex items-center justify-center text-[10px] font-bold text-gold">
              +{group.members.length - 3}
            </div>
          )}
        </div>

        {isMember ? (
          <Link 
            to={`/teacher/groups/${group.id}`}
            className="flex items-center gap-2 text-sm font-bold text-gold/80 hover:text-gold transition-colors"
          >
            Enter Group
            <ChevronRight size={16} />
          </Link>
        ) : (
          <button 
            onClick={onJoin}
            className="px-6 py-2 bg-gold text-royal-red rounded-xl text-sm font-bold hover:scale-105 transition-transform"
          >
            Join
          </button>
        )}
      </div>
    </motion.div>
  );
}
