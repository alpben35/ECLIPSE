import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lightbulb, Send, CheckCircle2, XCircle, ChevronRight, User as UserIcon, Shield, Award, Star, FileText, Save } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, addDoc, query, onSnapshot, orderBy, doc, updateDoc, where, getDoc, setDoc } from 'firebase/firestore';
import { AuthContext, ThemeContext } from '@/lib/contexts';
import { OWNER_EMAIL, RANKS } from '@/constants';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Idea {
  id: string;
  uid: string;
  authorName: string;
  authorEmail: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  currentReviewerRank: string;
}

const REVIEW_CAPABLE_RANKS = RANKS.filter(r => r.name !== 'Welcome' && r.name !== 'Member' && r.name !== 'Temporary Owner');

export default function IdeaPage() {
  const { user, profile } = useContext(AuthContext);
  const { isDark } = useContext(ThemeContext);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [newIdea, setNewIdea] = useState({ title: '', description: '' });
  const [notepad, setNotepad] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingNotepad, setIsSavingNotepad] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'review' | 'notepad'>('my');

  const [activeRanks, setActiveRanks] = useState<Set<string>>(new Set());

  const userRank = profile?.email === OWNER_EMAIL || profile?.rank === 'Owner' ? 'Owner' : profile?.rank || 'Welcome';
  const isOwner = userRank === 'Owner';

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ranks = new Set(snapshot.docs.map(doc => doc.data().rank || 'Welcome'));
      setActiveRanks(ranks);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !profile) return;

    const q = query(collection(db, 'ideas'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedIdeas = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Idea[];
      setIdeas(loadedIdeas);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'ideas'));

    if (isOwner) {
      const notepadRef = doc(db, 'users', user.uid, 'private', 'notepad');
      getDoc(notepadRef).then(snap => {
        if (snap.exists()) setNotepad(snap.data().content || '');
      });
    }

    return () => unsubscribe();
  }, [user, profile, isOwner]);

  const handleSaveNotepad = async () => {
    if (!user || !isOwner) return;
    setIsSavingNotepad(true);
    try {
      await setDoc(doc(db, 'users', user.uid, 'private', 'notepad'), {
        content: notepad,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/private/notepad`);
    } finally {
      setIsSavingNotepad(false);
    }
  };

  const getNextReviewer = (currentRank: string) => {
    const currentRankIndex = RANKS.findIndex(r => r.name === currentRank);
    const nextRank = RANKS.slice(currentRankIndex + 1).find(next => 
      REVIEW_CAPABLE_RANKS.some(capable => capable.name === next.name) && 
      (activeRanks.has(next.name) || next.name === 'Owner')
    )?.name || 'Owner';
    return nextRank;
  };

  const handleSubmitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdea.title || !newIdea.description || !user) return;

    setIsSubmitting(true);
    try {
      const nextRank = getNextReviewer(profile?.rank || 'Welcome');

      await addDoc(collection(db, 'ideas'), {
        uid: user.uid,
        authorName: profile?.displayName || 'Anonymous',
        authorEmail: profile?.email,
        title: newIdea.title,
        description: newIdea.description,
        status: 'pending',
        createdAt: new Date().toISOString(),
        currentReviewerRank: nextRank
      });
      setNewIdea({ title: '', description: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'ideas');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReview = async (ideaId: string, approve: boolean) => {
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) return;

    const canUserReview = isOwner || REVIEW_CAPABLE_RANKS.some(r => r.name === userRank);
    if (!canUserReview) return;

    try {
      if (approve) {
        if (userRank === 'Owner') {
          await updateDoc(doc(db, 'ideas', ideaId), { status: 'approved_by_owner' });
        } else {
          const nextReviewer = getNextReviewer(userRank);
          await updateDoc(doc(db, 'ideas', ideaId), {
            status: `approved_by_${userRank.toLowerCase().replace(/\s+/g, '_')}`,
            currentReviewerRank: nextReviewer
          });
        }
      } else {
        await updateDoc(doc(db, 'ideas', ideaId), { status: 'rejected' });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `ideas/${ideaId}`);
    }
  };

  const myIdeas = ideas.filter(i => i.uid === user?.uid);
  const reviewIdeas = ideas.filter(i => {
    if (i.status === 'rejected' || i.status === 'approved_by_owner') return false;
    if (isOwner) return true;
    return i.currentReviewerRank === userRank;
  });

  const nextRank = getNextReviewer(profile?.rank || 'Welcome');

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
      <div className="text-center space-y-4">
        <h1 className={cn("text-5xl font-black tracking-tighter italic", isDark ? "text-gold" : "text-royal-red")}>IDEAS HUB</h1>
        <p className={cn("opacity-50 max-w-xl mx-auto text-lg leading-relaxed", isDark ? "text-gold" : "text-royal-red/80")}>
          The forge of Eclipse Teacher. Propose new teaching ideas and let the community refine them.
        </p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="flex justify-center gap-4">
          {!isOwner && (
            <button 
              onClick={() => setActiveTab('my')}
              className={cn(
                "px-8 py-3 rounded-full font-bold transition-all",
                activeTab === 'my' 
                  ? (isDark ? "bg-gold text-royal-red shadow-lg" : "bg-royal-red text-white shadow-lg")
                  : (isDark ? "bg-gold/10 text-gold opacity-50" : "bg-royal-red/10 text-royal-red opacity-50 hover:bg-royal-red/20")
              )}
            >
              My Proposals
            </button>
          )}
          {isOwner && (
            <button 
              onClick={() => setActiveTab('notepad')}
              className={cn(
                "px-8 py-3 rounded-full font-bold transition-all",
                activeTab === 'notepad' 
                  ? (isDark ? "bg-gold text-royal-red shadow-lg" : "bg-royal-red text-white shadow-lg")
                  : (isDark ? "bg-gold/10 text-gold opacity-50" : "bg-royal-red/10 text-royal-red opacity-50 hover:bg-royal-red/20")
              )}
            >
              Private Notes
            </button>
          )}
          {(userRank !== 'Welcome' && userRank !== 'Member') && (
            <button 
              onClick={() => setActiveTab('review')}
              className={cn(
                "px-8 py-3 rounded-full font-bold transition-all",
                activeTab === 'review' 
                  ? (isDark ? "bg-gold text-royal-red shadow-lg" : "bg-royal-red text-white shadow-lg")
                  : (isDark ? "bg-gold/10 text-gold opacity-50" : "bg-royal-red/10 text-royal-red opacity-50 hover:bg-royal-red/20")
              )}
            >
              Review Queue {reviewIdeas.length > 0 && <span className={cn("ml-2 px-2 py-0.5 text-[10px] rounded-full", isDark ? "bg-gold text-royal-red" : "bg-white text-royal-red")}>{reviewIdeas.length}</span>}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'notepad' && isOwner ? (
          <motion.div 
            key="notepad"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className={cn("border p-8 rounded-[2.5rem] space-y-6", isDark ? "bg-gold/10 border-gold/20" : "bg-white border-royal-red/10 shadow-sm")}>
              <div className="flex items-center justify-between">
                <h3 className={cn("text-xl font-bold flex items-center gap-2", isDark ? "text-gold" : "text-royal-red")}>
                  <FileText size={20} className={isDark ? "text-gold" : "text-royal-red"} />
                  Private Teaching Notes
                </h3>
                <button 
                  onClick={handleSaveNotepad}
                  disabled={isSavingNotepad}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50",
                    isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white"
                  )}
                >
                  <Save size={14} />
                  {isSavingNotepad ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
              <textarea 
                value={notepad}
                onChange={e => setNotepad(e.target.value)}
                placeholder="Write your private teaching plans or system notes here..."
                rows={15}
                className={cn(
                  "w-full px-6 py-4 rounded-2xl border focus:outline-none focus:ring-2 resize-none font-mono text-sm",
                  isDark ? "bg-royal-red/50 text-gold border-gold/20 focus:ring-gold/10 placeholder:text-gold/40" : "bg-royal-red/5 text-royal-red border-royal-red/10 focus:ring-royal-red/10 placeholder:text-royal-red/40"
                )}
              />
            </div>
          </motion.div>
        ) : activeTab === 'my' ? (
          <motion.div 
            key="my"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <form onSubmit={handleSubmitIdea} className={cn("border p-10 rounded-[3rem] space-y-8", isDark ? "bg-gold/10 border-gold/20" : "bg-white border-royal-red/10 shadow-sm")}>
              <div className="flex items-center justify-between">
                <h3 className={cn("text-2xl font-black tracking-tight flex items-center gap-3", isDark ? "text-gold" : "text-royal-red")}>
                  <Lightbulb size={28} className={isDark ? "text-gold" : "text-royal-red"} />
                  PROPOSE IDEA
                </h3>
                <div className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest opacity-50", isDark ? "bg-gold/10 text-gold" : "bg-royal-red/10 text-royal-red")}>
                  Reviewer: {nextRank}
                </div>
              </div>

              <div className="space-y-4">
                <input 
                  type="text"
                  placeholder="Title of your proposal"
                  value={newIdea.title}
                  onChange={e => setNewIdea({ ...newIdea, title: e.target.value })}
                  className={cn(
                    "w-full px-8 py-5 rounded-[2rem] border focus:outline-none focus:ring-2 transition-all",
                    isDark ? "bg-royal-red/50 text-gold border-gold/20 focus:ring-gold/10 placeholder:text-gold/40" : "bg-royal-red/5 text-royal-red border-royal-red/10 focus:ring-royal-red/10 placeholder:text-royal-red/40"
                  )}
                />
                <textarea 
                  placeholder="Describe your proposal in detail..."
                  value={newIdea.description}
                  onChange={e => setNewIdea({ ...newIdea, description: e.target.value })}
                  rows={4}
                  className={cn(
                    "w-full px-8 py-5 rounded-[2rem] border focus:outline-none focus:ring-2 resize-none transition-all",
                    isDark ? "bg-royal-red/50 text-gold border-gold/20 focus:ring-gold/10 placeholder:text-gold/40" : "bg-royal-red/5 text-royal-red border-royal-red/10 focus:ring-royal-red/10 placeholder:text-royal-red/40"
                  )}
                />
              </div>
              <button 
                type="submit"
                disabled={isSubmitting || !newIdea.title || !newIdea.description}
                className={cn(
                  "w-full py-5 rounded-[2rem] font-black uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-all shadow-xl",
                  isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white"
                )}
              >
                {isSubmitting ? 'Transmitting...' : <><Send size={20} /> Submit to {nextRank}</>}
              </button>
            </form>

            <div className="space-y-4">
              {myIdeas.map(idea => (
                <IdeaCard key={idea.id} idea={idea} isDark={isDark} />
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {reviewIdeas.length === 0 ? (
              <div className="text-center py-20 opacity-30">
                <CheckCircle2 size={48} className="mx-auto mb-4" />
                <p className="text-lg font-medium">Your review queue is clear.</p>
              </div>
            ) : (
              reviewIdeas.map(idea => (
                <IdeaCard 
                  key={idea.id} 
                  idea={idea} 
                  onReview={handleReview}
                  canReview
                  isDark={isDark}
                />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IdeaCard({ idea, onReview, canReview, isDark }: { idea: Idea, onReview?: (id: string, approve: boolean) => void, canReview?: boolean, isDark?: boolean }) {
  const getStatusLabel = (status: string) => {
    if (status === 'pending') return `Awaiting ${idea.currentReviewerRank}s`;
    if (status === 'rejected') return 'Rejected';
    if (status.startsWith('approved_by_')) {
      const rank = status.replace('approved_by_', '').replace(/_/g, ' ');
      return `Approved by ${rank.charAt(0).toUpperCase() + rank.slice(1)}`;
    }
    return status;
  };

  const getStatusColor = (status: string) => {
    if (status === 'pending') return isDark ? 'bg-gold/10 text-gold' : 'bg-royal-red/10 text-royal-red';
    if (status === 'rejected') return 'bg-red-500/10 text-red-500';
    return isDark ? 'bg-gold/20 text-gold' : 'bg-royal-red/20 text-royal-red';
  };

  return (
    <div className={cn("border p-8 rounded-[2.5rem] space-y-4 transition-all text-left", isDark ? "bg-gold/10 border-gold/20" : "bg-white border-royal-red/10 shadow-sm")}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest", getStatusColor(idea.status))}>
            {getStatusLabel(idea.status)}
          </div>
          <h4 className={cn("text-2xl font-bold tracking-tight", isDark ? "text-gold" : "text-royal-red")}>{idea.title}</h4>
          <p className={cn("text-xs opacity-50 flex items-center gap-2", isDark ? "text-gold" : "text-royal-red")}>
            <UserIcon size={12} /> {idea.authorName} • {new Date(idea.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      
      <p className={cn("opacity-70 leading-relaxed", isDark ? "text-gold" : "text-royal-red")}>{idea.description}</p>

      {canReview && onReview && (
        <div className={cn("flex gap-3 pt-4 border-t", isDark ? "border-gold/10" : "border-royal-red/10")}>
          <button 
            onClick={() => onReview(idea.id, true)}
            className={cn(
              "flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform",
              isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white"
            )}
          >
            <CheckCircle2 size={18} /> Approve
          </button>
          <button 
            onClick={() => onReview(idea.id, false)}
            className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
          >
            <XCircle size={18} /> Reject
          </button>
        </div>
      )}
    </div>
  );
}
