import React, { useState, useEffect, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { Plus, Upload, FileText, Trash2, TrendingUp, Award, Clock, Loader2, Folder } from 'lucide-react';
import { db, auth, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { SUBJECTS } from '../lib/constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { AuthContext } from '../App';
import confetti from 'canvas-confetti';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function ProgressPage() {
  const { user, profile, addXp } = useContext(AuthContext);
  const [scores, setScores] = useState<any[]>([]);
  const [papers, setPapers] = useState<any[]>([]);
  const [newScore, setNewScore] = useState({ 
    subject: SUBJECTS[SUBJECTS.length - 1].name, 
    percentage: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [lastSubject, setLastSubject] = useState<string | null>(null);
  const [isAddingScore, setIsAddingScore] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSubject, setUploadSubject] = useState(SUBJECTS[0].name);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterSubject, setFilterSubject] = useState<string>('All');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openAddScore = (subjectName?: string) => {
    setNewScore({ 
      subject: subjectName || lastSubject || SUBJECTS[SUBJECTS.length - 1].name, 
      percentage: '',
      date: new Date().toISOString().split('T')[0]
    });
    setIsAddingScore(true);
  };

  useEffect(() => {
    if (!user) return;

    const scoresQuery = query(
      collection(db, 'users', user.uid, 'scores'),
      orderBy('date', 'asc')
    );
    const papersQuery = query(
      collection(db, 'users', user.uid, 'papers'),
      orderBy('uploadedAt', 'desc')
    );

    const unsubScores = onSnapshot(scoresQuery, (snap) => {
      setScores(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}/scores`));

    const unsubPapers = onSnapshot(papersQuery, (snap) => {
      setPapers(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}/papers`));

    return () => {
      unsubScores();
      unsubPapers();
    };
  }, [user]);

  const handleAddScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      const scorePercentage = Number(newScore.percentage);
      const testDate = new Date(newScore.date).toISOString();

      await addDoc(collection(db, 'users', user.uid, 'scores'), {
        uid: user.uid,
        subject: newScore.subject,
        percentage: scorePercentage,
        date: testDate
      });

      // Add XP for logging progress
      addXp(50);
      setLastSubject(newScore.subject);

      // Confetti for 100%
      if (scorePercentage === 100) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#000000', '#ffffff', '#ffa500']
        });
      }

      setNewScore({ 
        subject: SUBJECTS[SUBJECTS.length - 1].name, 
        percentage: '',
        date: new Date().toISOString().split('T')[0]
      });
      setIsAddingScore(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/scores`);
    }
  };

  const deleteScore = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'scores', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/scores/${id}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `users/${user.uid}/papers/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, 'users', user.uid, 'papers'), {
        uid: user.uid,
        subject: uploadSubject,
        fileName: file.name,
        paperUrl: downloadURL,
        storagePath: storageRef.fullPath,
        uploadedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deletePaper = async (paper: any) => {
    if (!user) return;
    try {
      if (paper.storagePath) {
        const storageRef = ref(storage, paper.storagePath);
        await deleteObject(storageRef);
      }
      await deleteDoc(doc(db, 'users', user.uid, 'papers', paper.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/papers/${paper.id}`);
    }
  };

  const latestScoresPerSubject = SUBJECTS.map(s => {
    const subjectScores = scores.filter(score => score.subject === s.name);
    if (subjectScores.length === 0) return null;
    return [...subjectScores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }).filter((s): s is any => s !== null);

  const overallAverageHistory = [...new Set(scores.map(s => s.date))].sort().map(date => {
    const scoresOnDate = scores.filter(s => s.date <= date);
    const latestScoresBySubject: Record<string, number> = {};
    scoresOnDate.forEach(s => {
      latestScoresBySubject[s.subject] = s.percentage;
    });
    const values = Object.values(latestScoresBySubject);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      date: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(date)),
      percentage: Math.round(avg),
      fullDate: date
    };
  });

  const chartData = filterSubject === 'All' 
    ? overallAverageHistory 
    : scores.filter(s => s.subject === filterSubject)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((s) => ({
          date: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(s.date)),
          percentage: Number(s.percentage) || 0,
          fullDate: s.date
        }));

  const filteredScores = filterSubject === 'All' ? scores : scores.filter(s => s.subject === filterSubject);
  
  const absoluteLatestScore = scores.length > 0 
    ? [...scores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    : null;

  const displayScore = filterSubject === 'All'
    ? (absoluteLatestScore ? Number(absoluteLatestScore.percentage) : 0)
    : (filteredScores.length > 0 
        ? Number(filteredScores[filteredScores.length - 1].percentage) 
        : 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Your Progress</h1>
          <p className="opacity-50 mt-2">Track your scores and study materials.</p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl text-sm font-semibold focus:outline-none border border-transparent hover:border-black/10 dark:hover:border-white/10 transition-all"
          >
            <option value="All">All Subjects</option>
            {SUBJECTS.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
          <button 
            onClick={() => openAddScore()}
            className="flex items-center gap-2 px-6 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl text-sm font-bold shadow-lg hover:scale-105 transition-all"
          >
            <Plus size={16} />
            Add Score
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className={cn(
        "grid gap-6",
        filterSubject === 'All' ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"
      )}>
        <div className="p-8 bg-black/5 dark:bg-white/5 rounded-3xl">
          <TrendingUp className="mb-4 opacity-50" />
          <h3 className="text-3xl font-bold">{filteredScores.length}</h3>
          <p className="text-sm opacity-50">Tests Completed</p>
        </div>
        
        <div className="p-8 bg-black/5 dark:bg-white/5 rounded-3xl">
          <Award className="mb-4 opacity-50" />
          <h3 className="text-3xl font-bold">
            {displayScore}%
          </h3>
          <p className="text-sm opacity-50">{filterSubject === 'All' ? 'Overall Mastery' : 'Latest Score'}</p>
        </div>

        <div className="p-8 bg-black/5 dark:bg-white/5 rounded-3xl">
          <Clock className="mb-4 opacity-50" />
          <h3 className="text-3xl font-bold">{new Set(filteredScores.map(s => s.subject)).size}</h3>
          <p className="text-sm opacity-50">Subjects Tracked</p>
        </div>
      </div>

      {/* Progress Chart */}
      <div className="p-8 bg-black/5 dark:bg-white/5 rounded-3xl">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">{filterSubject === 'All' ? 'Overall Progress' : `${filterSubject} Progress`}</h2>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPct" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888888" opacity={0.1} />
              <XAxis 
                dataKey="date" 
                stroke="#888888" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis stroke="#888888" fontSize={12} unit="%" tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip 
                shared={true}
                cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  borderColor: 'rgba(0,0,0,0.1)',
                  borderRadius: '12px',
                  color: 'black',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="percentage" 
                stroke="#3b82f6" 
                fillOpacity={1} 
                fill="url(#colorPct)" 
                strokeWidth={3}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Subjects as Files Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Subject Folders</h2>
          <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-white dark:bg-black shadow-sm" : "opacity-50")}
            >
              <Plus size={16} className="rotate-45" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-white dark:bg-black shadow-sm" : "opacity-50")}
            >
              <FileText size={16} />
            </button>
          </div>
        </div>
        
        <div className={cn(
          "grid gap-6",
          viewMode === 'grid' ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-6" : "grid-cols-1"
        )}>
          {SUBJECTS.filter(s => {
            const hasData = scores.some(score => score.subject === s.name) || papers.some(paper => paper.subject === s.name);
            return (filterSubject === 'All' || s.name === filterSubject) && hasData;
          }).map(s => {
            const subjectScores = scores.filter(score => score.subject === s.name);
            const avg = subjectScores.length > 0 
              ? Math.round(subjectScores.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0) / subjectScores.length)
              : null;

            return (
              <motion.div 
                key={s.id}
                whileHover={{ y: -8, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => openAddScore(s.name)}
                className={cn(
                  "group relative bg-black/5 dark:bg-white/5 rounded-3xl p-8 transition-all border border-transparent hover:border-black/10 dark:hover:border-white/10 cursor-pointer shadow-sm hover:shadow-xl",
                  viewMode === 'list' && "flex items-center justify-between py-4"
                )}
              >
                <div className={cn("flex flex-col gap-4", viewMode === 'list' && "flex-row items-center")}>
                  <div className="w-14 h-14 bg-black/10 dark:bg-white/10 rounded-2xl flex items-center justify-center text-black dark:text-white group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-all shadow-sm group-hover:rotate-6 group-hover:shadow-lg">
                    <Folder size={28} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg truncate">{s.name}</h4>
                    <p className="text-xs opacity-50 uppercase font-bold tracking-widest">
                      {subjectScores.length} Entries
                    </p>
                  </div>
                </div>
                {avg !== null && (
                  <div className={cn("mt-4", viewMode === 'list' && "mt-0")}>
                    <div className="h-1 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-current transition-all" style={{ width: `${avg}%` }} />
                    </div>
                    <p className="text-[10px] mt-1 font-bold">{avg}% Avg</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Papers & Recent Scores Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Study Papers</h2>
            <select 
              value={uploadSubject}
              onChange={e => setUploadSubject(e.target.value)}
              className="p-2 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-medium focus:outline-none"
            >
              {SUBJECTS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          
          <div 
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed border-black/10 dark:border-white/10 rounded-3xl p-12 text-center space-y-4 cursor-pointer transition-colors",
              isUploading ? "opacity-50 cursor-not-allowed" : "hover:border-black/30 dark:hover:border-white/30"
            )}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept=".pdf,.doc,.docx,.jpg,.png"
            />
            {isUploading ? (
              <Loader2 className="mx-auto animate-spin" size={48} />
            ) : (
              <Upload className="mx-auto opacity-30" size={48} />
            )}
            <div>
              <p className="font-bold">{isUploading ? "Uploading..." : "Upload Paper & Mark Scheme"}</p>
              <p className="text-sm opacity-50">Click to browse files</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {papers.map(paper => (
              <div key={paper.id} className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl">
                    <FileText size={20} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold truncate max-w-[200px]">{paper.fileName}</p>
                    <p className="text-xs opacity-50">{paper.subject} • {new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(paper.uploadedAt))}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a 
                    href={paper.paperUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <FileText size={18} />
                  </a>
                  <button 
                    onClick={() => deletePaper(paper)}
                    className="p-2 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Recent Scores</h2>
          <div className="space-y-4">
            {filteredScores.slice().reverse().map(score => (
              <div key={score.id} className="flex items-center justify-between p-6 bg-black/5 dark:bg-white/5 rounded-3xl">
                <div>
                  <p className="font-bold">{score.subject}</p>
                  <p className="text-sm opacity-50">{new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(score.date))}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-2xl font-bold">{score.percentage}%</p>
                  </div>
                  <button 
                    onClick={() => deleteScore(score.id)}
                    className="p-2 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Score Modal */}
      <AnimatePresence>
        {isAddingScore && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingScore(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-6">Add Test Result</h3>
              <form onSubmit={handleAddScore} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase opacity-50 mb-2 block">Subject</label>
                  <select 
                    value={newScore.subject}
                    onChange={e => setNewScore({...newScore, subject: e.target.value})}
                    className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none font-bold"
                  >
                    {SUBJECTS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase opacity-50 mb-2 block">Percentage (%)</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={newScore.percentage}
                    onChange={e => setNewScore({...newScore, percentage: e.target.value})}
                    className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none"
                    placeholder="e.g. 85"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase opacity-50 mb-2 block">Test Date</label>
                  <input 
                    type="date"
                    required
                    value={newScore.date}
                    onChange={e => setNewScore({...newScore, date: e.target.value})}
                    className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold mt-4"
                >
                  Save Result
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
