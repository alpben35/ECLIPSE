import React, { useState, useEffect, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { Plus, Upload, FileText, Trash2, TrendingUp, Award, Clock, Loader2, Folder } from 'lucide-react';
import { db, auth, storage, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, addDoc, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { SUBJECTS } from '@/lib/constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { AuthContext } from '@/lib/contexts';
import confetti from 'canvas-confetti';

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
  const [filterSubject, setFilterSubject] = useState<string | null>(() => {
    return localStorage.getItem('teacher_selected_subject') || null;
  });

  useEffect(() => {
    if (filterSubject) {
      localStorage.setItem('teacher_selected_subject', filterSubject);
    }
  }, [filterSubject]);
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

      addXp(50);
      setLastSubject(newScore.subject);

      if (scorePercentage === 100) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#7B0000', '#FFD700']
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

  const getOverallData = () => {
    // Group all scores by date
    const dateGroups: Record<string, number[]> = {};
    scores.forEach(s => {
      const d = new Date(s.date).toDateString();
      if (!dateGroups[d]) dateGroups[d] = [];
      dateGroups[d].push(Number(s.percentage));
    });

    return Object.entries(dateGroups)
      .map(([date, vals]) => ({
        date: new Date(date),
        percentage: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((d, index) => ({
        index,
        date: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(d.date),
        percentage: d.percentage,
        subject: 'Overall'
      }));
  };

  const chartData = filterSubject === 'Overall' 
    ? getOverallData()
    : [...(filterSubject === 'All' ? latestScoresPerSubject : scores.filter(s => s.subject === filterSubject))]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((s, index) => ({
          index,
          date: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(s.date)),
          percentage: Number(s.percentage) || 0,
          subject: s.subject
        }));

  const filteredScores = !filterSubject || filterSubject === 'Overall' ? scores : scores.filter(s => s.subject === filterSubject);
  
  const absoluteLatestScore = scores.length > 0 
    ? [...scores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    : null;

  const displayScore = !filterSubject || filterSubject === 'Overall'
    ? (scores.length > 0 ? Math.round(scores.reduce((a, b) => a + (Number(b.percentage) || 0), 0) / scores.length) : 0)
    : (filteredScores.length > 0 
        ? Number(filteredScores[filteredScores.length - 1].percentage) 
        : 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12 text-center">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 text-left">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gold">
            {!filterSubject ? 'Class Progress' : `${filterSubject} Progress`}
          </h1>
          <p className="opacity-50 mt-2 text-gold">
            {!filterSubject 
              ? 'Select a subject folder below to view detailed progress records.' 
              : `Viewing performance metrics and growth for ${filterSubject}.`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {filterSubject && (
            <button 
              onClick={() => {
                setFilterSubject(null);
                localStorage.removeItem('teacher_selected_subject');
              }}
              className="px-4 py-2 bg-gold/10 hover:bg-gold/20 border border-gold/20 rounded-xl text-sm font-bold text-gold transition-all"
            >
              Back to Folders
            </button>
          )}
          <select 
            value={filterSubject || ''}
            onChange={(e) => setFilterSubject(e.target.value || null)}
            className="px-4 py-2 bg-gold/5 rounded-xl text-sm font-semibold focus:outline-none border border-transparent hover:border-gold/10 transition-all text-gold"
          >
            <option value="" className="bg-royal-red">Select Folder...</option>
            <option value="Overall" className="bg-royal-red">Overall Progress</option>
            {SUBJECTS.map(s => (
              <option key={s.id} value={s.name} className="bg-royal-red">{s.name}</option>
            ))}
          </select>
          <button 
            onClick={() => openAddScore()}
            className="flex items-center gap-2 px-6 py-2 bg-gold text-royal-red rounded-xl text-sm font-bold shadow-lg hover:scale-105 transition-all"
          >
            <Plus size={16} />
            Add Record
          </button>
        </div>
      </div>

      {filterSubject && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-12"
        >
          <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
            <div className="p-8 bg-gold/10 border border-gold/20 rounded-3xl">
              <TrendingUp className="mb-4 opacity-50 text-gold" />
              <h3 className="text-3xl font-bold text-gold">{filteredScores.length}</h3>
              <p className="text-sm opacity-50 text-gold">Assessments Recorded</p>
            </div>
            
            <div className="p-8 bg-gold/10 border border-gold/20 rounded-3xl">
              <Award className="mb-4 opacity-50 text-gold" />
              <h3 className="text-3xl font-bold text-gold">
                {displayScore}%
              </h3>
              <p className="text-sm opacity-50 text-gold">Latest Average</p>
            </div>

            <div className="p-8 bg-gold/10 border border-gold/20 rounded-3xl">
              <Clock className="mb-4 opacity-50 text-gold" />
              <h3 className="text-3xl font-bold text-gold">
                {filteredScores.length > 0 ? new Date(filteredScores[filteredScores.length - 1].date).toLocaleDateString() : 'N/A'}
              </h3>
              <p className="text-sm opacity-50 text-gold">Last Assessment</p>
            </div>
          </div>

          <div className="p-8 bg-gold/10 border border-gold/20 rounded-3xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gold">{filterSubject} Growth</h2>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPct" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#FFD700" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#FFD700" opacity={0.1} />
                  <XAxis 
                    dataKey="index" 
                    tickFormatter={(idx) => chartData[idx]?.date}
                    stroke="#FFD700" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis stroke="#FFD700" fontSize={12} unit="%" tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip 
                    shared={true}
                    cursor={{ stroke: '#FFD700', strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={{ 
                      backgroundColor: '#7B0000', 
                      borderColor: 'rgba(255,215,0,0.2)',
                      borderRadius: '12px',
                      color: '#FFD700',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                    labelFormatter={(idx) => chartData[idx]?.date}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="percentage" 
                    stroke="#FFD700" 
                    fillOpacity={1} 
                    fill="url(#colorPct)" 
                    strokeWidth={3}
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#FFD700' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gold">Subject Folders</h2>
        </div>
        
        <div className={cn(
          "grid gap-6",
          viewMode === 'grid' ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-6" : "grid-cols-1"
        )}>
          {SUBJECTS.filter(s => {
            const hasData = scores.some(score => score.subject === s.name) || papers.some(paper => paper.subject === s.name);
            return (!filterSubject || s.name === filterSubject) && hasData;
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
                onClick={() => setFilterSubject(s.name)}
                className={cn(
                  "group relative border rounded-3xl p-8 transition-all cursor-pointer shadow-sm hover:shadow-xl",
                  filterSubject === s.name 
                    ? "bg-gold border-gold text-royal-red shadow-gold/20" 
                    : "bg-gold/10 border-gold/20 text-gold"
                )}
              >
                <div className="flex flex-col gap-4">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-sm group-hover:rotate-6 group-hover:shadow-lg",
                    filterSubject === s.name 
                      ? "bg-royal-red text-gold" 
                      : "bg-gold/10 text-gold group-hover:bg-gold group-hover:text-royal-red"
                  )}>
                    <Folder size={28} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg truncate">{s.name}</h4>
                    <p className={cn(
                      "text-xs uppercase font-bold tracking-widest",
                      filterSubject === s.name ? "text-royal-red/60" : "opacity-50"
                    )}>
                      {subjectScores.length} Records
                    </p>
                  </div>
                </div>
                {avg !== null && (
                  <div className="mt-4">
                    <div className={cn(
                      "h-1 w-full rounded-full overflow-hidden",
                      filterSubject === s.name ? "bg-royal-red/20" : "bg-gold/10"
                    )}>
                      <div className={cn(
                        "h-full transition-all",
                        filterSubject === s.name ? "bg-royal-red" : "bg-gold"
                      )} style={{ width: `${avg}%` }} />
                    </div>
                    <p className={cn(
                      "text-[10px] mt-1 font-bold",
                      filterSubject === s.name ? "text-royal-red" : "text-gold"
                    )}>{avg}% Class Avg</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {filterSubject !== 'All' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gold">Teaching Resources</h2>
            </div>
            
            <div 
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed border-gold/20 rounded-3xl p-12 text-center space-y-4 cursor-pointer transition-colors",
                isUploading ? "opacity-50 cursor-not-allowed" : "hover:border-gold/40"
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
                <Loader2 className="mx-auto animate-spin text-gold" size={48} />
              ) : (
                <Upload className="mx-auto opacity-30 text-gold" size={48} />
              )}
              <div>
                <p className="font-bold text-gold">{isUploading ? "Uploading..." : "Upload Lesson Plan / Worksheet"}</p>
                <p className="text-sm opacity-50 text-gold">Click to browse files</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {papers.filter(p => p.subject === filterSubject).map(paper => (
                <div key={paper.id} className="flex items-center justify-between p-4 bg-gold/10 border border-gold/20 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gold/10 rounded-xl">
                      <FileText size={20} className="text-gold" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-bold truncate max-w-[200px] text-gold">{paper.fileName}</p>
                      <p className="text-xs opacity-50 text-gold">{paper.subject} • {new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(paper.uploadedAt))}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a 
                      href={paper.paperUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gold/10 rounded-lg transition-colors text-gold"
                    >
                      <FileText size={18} />
                    </a>
                    <button 
                      onClick={() => deletePaper(paper)}
                      className="p-2 hover:text-red-500 transition-colors text-gold"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gold">Recent Assessments</h2>
            <div className="space-y-4">
              {filteredScores.slice().reverse().map(score => (
                <div key={score.id} className="flex items-center justify-between p-6 bg-gold/10 border border-gold/20 rounded-3xl">
                  <div>
                    <p className="font-bold text-gold">{score.subject}</p>
                    <p className="text-sm opacity-50 text-gold">{new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(score.date))}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gold">{score.percentage}%</p>
                    </div>
                    <button 
                      onClick={() => deleteScore(score.id)}
                      className="p-2 hover:text-red-500 transition-colors text-gold"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {isAddingScore && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingScore(false)}
              className="absolute inset-0 bg-royal-red/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-royal-red rounded-3xl p-8 shadow-2xl border border-gold/20"
            >
              <h3 className="text-2xl font-bold mb-6 text-gold">Add Assessment Record</h3>
              <form onSubmit={handleAddScore} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase opacity-50 mb-2 block text-gold">Subject</label>
                  <select 
                    value={newScore.subject}
                    onChange={e => setNewScore({...newScore, subject: e.target.value})}
                    className="w-full p-4 bg-gold/5 rounded-2xl focus:outline-none font-bold text-gold"
                  >
                    {SUBJECTS.map(s => <option key={s.id} value={s.name} className="bg-royal-red">{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase opacity-50 mb-2 block text-gold">Class Average (%)</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={newScore.percentage}
                    onChange={e => setNewScore({...newScore, percentage: e.target.value})}
                    className="w-full p-4 bg-gold/5 rounded-2xl focus:outline-none text-gold"
                    placeholder="e.g. 85"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase opacity-50 mb-2 block text-gold">Date</label>
                  <input 
                    type="date"
                    required
                    value={newScore.date}
                    onChange={e => setNewScore({...newScore, date: e.target.value})}
                    className="w-full p-4 bg-gold/5 rounded-2xl focus:outline-none text-gold"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-gold text-royal-red rounded-2xl font-bold mt-4"
                >
                  Save Record
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
