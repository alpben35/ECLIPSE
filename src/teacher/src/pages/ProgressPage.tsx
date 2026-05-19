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
import { SUBJECTS, OWNER_EMAIL } from '@/lib/constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { AuthContext, ThemeContext } from '@/lib/contexts';
import confetti from 'canvas-confetti';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function ProgressPage() {
  const { user, profile, addXp } = useContext(AuthContext);
  const { isDark } = useContext(ThemeContext);
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

    const rank = profile?.rank || 'Welcome';
    const canUpload = ['Intermediate', 'Champion', 'Master', 'Admin', 'Temporary Owner', 'Owner'].includes(rank) || 
                      user.email === OWNER_EMAIL;

    if (!canUpload) {
      alert("Basic accounts cannot upload files. Upgrade to Champion or higher to unlock this feature.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

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
          <h1 className={cn("text-4xl font-bold tracking-tight", isDark ? "text-gold" : "text-royal-red")}>
            {!filterSubject ? 'Class Progress' : `${filterSubject} Progress`}
          </h1>
          <p className={cn("opacity-50 mt-2", isDark ? "text-gold" : "text-royal-red/80")}>
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
              className={cn(
                "px-4 py-2 border rounded-xl text-sm font-bold transition-all",
                isDark ? "bg-gold/10 hover:bg-gold/20 border-gold/20 text-gold" : "bg-white border-royal-red/10 text-royal-red hover:bg-royal-red/5"
              )}
            >
              Back to Folders
            </button>
          )}
          <select 
            value={filterSubject || ''}
            onChange={(e) => setFilterSubject(e.target.value || null)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-semibold focus:outline-none border transition-all",
              isDark 
                ? "bg-gold/5 border-transparent hover:border-gold/10 text-gold" 
                : "bg-white border-royal-red/10 text-royal-red"
            )}
          >
            <option value="" className={isDark ? "bg-royal-red" : "bg-white"}>Select Folder...</option>
            <option value="Overall" className={isDark ? "bg-royal-red" : "bg-white"}>Overall Progress</option>
            {SUBJECTS.map(s => (
              <option key={s.id} value={s.name} className={isDark ? "bg-royal-red" : "bg-white"}>{s.name}</option>
            ))}
          </select>
          <button 
            onClick={() => openAddScore()}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold shadow-lg hover:scale-105 transition-all",
              isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white shadow-royal-red/20"
            )}
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
            <div className={cn("p-8 border rounded-3xl", isDark ? "bg-gold/10 border-gold/20" : "bg-white border-royal-red/10 shadow-sm")}>
              <TrendingUp className={cn("mb-4 opacity-50", isDark ? "text-gold" : "text-royal-red")} />
              <h3 className={cn("text-3xl font-bold", isDark ? "text-gold" : "text-royal-red")}>{filteredScores.length}</h3>
              <p className={cn("text-sm opacity-50", isDark ? "text-gold" : "text-royal-red")}>Assessments Recorded</p>
            </div>
            
            <div className={cn("p-8 border rounded-3xl", isDark ? "bg-gold/10 border-gold/20" : "bg-white border-royal-red/10 shadow-sm")}>
              <Award className={cn("mb-4 opacity-50", isDark ? "text-gold" : "text-royal-red")} />
              <h3 className={cn("text-3xl font-bold", isDark ? "text-gold" : "text-royal-red")}>
                {displayScore}%
              </h3>
              <p className={cn("text-sm opacity-50", isDark ? "text-gold" : "text-royal-red")}>Latest Average</p>
            </div>

            <div className={cn("p-8 border rounded-3xl", isDark ? "bg-gold/10 border-gold/20" : "bg-white border-royal-red/10 shadow-sm")}>
              <Clock className={cn("mb-4 opacity-50", isDark ? "text-gold" : "text-royal-red")} />
              <h3 className={cn("text-3xl font-bold", isDark ? "text-gold" : "text-royal-red")}>
                {filteredScores.length > 0 ? new Date(filteredScores[filteredScores.length - 1].date).toLocaleDateString() : 'N/A'}
              </h3>
              <p className={cn("text-sm opacity-50", isDark ? "text-gold" : "text-royal-red")}>Last Assessment</p>
            </div>
          </div>

          <div className={cn("p-8 border rounded-3xl", isDark ? "bg-gold/10 border-gold/20" : "bg-white border-royal-red/10 shadow-sm")}>
            <div className="flex items-center justify-between mb-8">
              <h2 className={cn("text-2xl font-bold", isDark ? "text-gold" : "text-royal-red")}>{filterSubject} Growth</h2>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPct" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isDark ? "#FFD700" : "#7B0000"} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={isDark ? "#FFD700" : "#7B0000"} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#FFD700" : "#7B0000"} opacity={0.1} />
                  <XAxis 
                    dataKey="index" 
                    tickFormatter={(idx) => chartData[idx]?.date}
                    stroke={isDark ? "#FFD700" : "#7B0000"} 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis stroke={isDark ? "#FFD700" : "#7B0000"} fontSize={12} unit="%" tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip 
                    shared={true}
                    cursor={{ stroke: isDark ? '#FFD700' : '#7B0000', strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={{ 
                      backgroundColor: isDark ? '#7B0000' : '#FFFFFF', 
                      borderColor: isDark ? 'rgba(255,215,0,0.2)' : 'rgba(123,0,0,0.1)',
                      borderRadius: '12px',
                      color: isDark ? '#FFD700' : '#7B0000',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                    labelFormatter={(idx) => chartData[idx]?.date}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="percentage" 
                    stroke={isDark ? "#FFD700" : "#7B0000"} 
                    fillOpacity={1} 
                    fill="url(#colorPct)" 
                    strokeWidth={3}
                    activeDot={{ r: 6, strokeWidth: 0, fill: isDark ? '#FFD700' : '#7B0000' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}

      <div className="space-y-6 text-left">
        <div className="flex items-center justify-between">
          <h2 className={cn("text-2xl font-bold", isDark ? "text-gold" : "text-royal-red")}>Subject Folders</h2>
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
                    ? (isDark ? "bg-gold border-gold text-royal-red shadow-gold/20" : "bg-royal-red border-royal-red text-white shadow-royal-red/20")
                    : (isDark ? "bg-gold/10 border-gold/20 text-gold" : "bg-white border-royal-red/10 text-royal-red")
                )}
              >
                <div className="flex flex-col gap-4">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-sm group-hover:rotate-6 group-hover:shadow-lg",
                    filterSubject === s.name 
                      ? (isDark ? "bg-royal-red text-gold" : "bg-white text-royal-red")
                      : (isDark ? "bg-gold/10 text-gold group-hover:bg-gold group-hover:text-royal-red" : "bg-royal-red/5 text-royal-red group-hover:bg-royal-red group-hover:text-white")
                  )}>
                    <Folder size={28} />
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-lg truncate">{s.name}</h4>
                    <p className={cn(
                      "text-xs uppercase font-bold tracking-widest",
                      filterSubject === s.name ? "opacity-60" : "opacity-50"
                    )}>
                      {subjectScores.length} Records
                    </p>
                  </div>
                </div>
                {avg !== null && (
                  <div className="mt-4">
                    <div className={cn(
                      "h-1.5 w-full rounded-full overflow-hidden",
                      filterSubject === s.name 
                        ? (isDark ? "bg-royal-red/20" : "bg-white/20") 
                        : (isDark ? "bg-gold/10" : "bg-royal-red/10")
                    )}>
                      <div className={cn(
                        "h-full transition-all",
                        filterSubject === s.name 
                          ? (isDark ? "bg-royal-red" : "bg-white") 
                          : (isDark ? "bg-gold" : "bg-royal-red")
                      )} style={{ width: `${avg}%` }} />
                    </div>
                    <p className={cn(
                      "text-[10px] mt-1 font-bold text-left",
                      filterSubject === s.name ? "" : ""
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
          <div className="space-y-6 text-left">
            <div className="flex items-center justify-between">
              <h2 className={cn("text-2xl font-bold", isDark ? "text-gold" : "text-royal-red")}>Teaching Resources</h2>
            </div>
            
            <div 
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-3xl p-12 text-center space-y-4 cursor-pointer transition-all",
                isUploading ? "opacity-50 cursor-not-allowed" : "hover:border-opacity-60 hover:bg-black/5",
                isDark ? "border-gold/20" : "border-royal-red/20"
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
                <Loader2 className={cn("mx-auto animate-spin", isDark ? "text-gold" : "text-royal-red")} size={48} />
              ) : (
                <Upload className={cn("mx-auto opacity-30", isDark ? "text-gold" : "text-royal-red")} size={48} />
              )}
              <div>
                <p className={cn("font-bold", isDark ? "text-gold" : "text-royal-red")}>{isUploading ? "Uploading..." : "Upload Lesson Plan / Worksheet"}</p>
                <p className={cn("text-sm opacity-50", isDark ? "text-gold" : "text-royal-red/60")}>Click to browse files</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {papers.filter(p => p.subject === filterSubject).map(paper => (
                <div key={paper.id} className={cn(
                  "flex items-center justify-between p-4 border rounded-2xl transition-colors",
                  isDark ? "bg-gold/10 border-gold/20" : "bg-white border-royal-red/10 shadow-sm"
                )}>
                  <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-xl", isDark ? "bg-gold/10" : "bg-royal-red/5")}>
                      <FileText size={20} className={isDark ? "text-gold" : "text-royal-red"} />
                    </div>
                    <div className="overflow-hidden">
                      <p className={cn("font-bold truncate max-w-[200px]", isDark ? "text-gold" : "text-royal-red")}>{paper.fileName}</p>
                      <p className={cn("text-xs opacity-50", isDark ? "text-gold" : "text-royal-red")}>{paper.subject} • {new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(paper.uploadedAt))}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a 
                      href={paper.paperUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={cn("p-2 rounded-lg transition-colors", isDark ? "hover:bg-gold/10 text-gold" : "hover:bg-royal-red/5 text-royal-red")}
                    >
                      <FileText size={18} />
                    </a>
                    <button 
                      onClick={() => deletePaper(paper)}
                      className={cn("p-2 hover:text-red-500 transition-colors", isDark ? "text-gold" : "text-royal-red")}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6 text-left">
            <h2 className={cn("text-2xl font-bold", isDark ? "text-gold" : "text-royal-red")}>Recent Assessments</h2>
            <div className="space-y-4">
              {filteredScores.slice().reverse().map(score => (
                <div key={score.id} className={cn(
                  "flex items-center justify-between p-6 border rounded-3xl transition-colors",
                  isDark ? "bg-gold/10 border-gold/20" : "bg-white border-royal-red/10 shadow-sm"
                )}>
                  <div>
                    <p className={cn("font-bold", isDark ? "text-gold" : "text-royal-red")}>{score.subject}</p>
                    <p className={cn("text-sm opacity-50", isDark ? "text-gold" : "text-royal-red")}>{new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(score.date))}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className={cn("text-2xl font-bold", isDark ? "text-gold" : "text-royal-red")}>{score.percentage}%</p>
                    </div>
                    <button 
                      onClick={() => deleteScore(score.id)}
                      className={cn("p-2 hover:text-red-500 transition-colors", isDark ? "text-gold" : "text-royal-red")}
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
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "relative w-full max-w-md rounded-3xl p-8 shadow-2xl border transition-colors",
                isDark ? "bg-royal-red border-gold/20" : "bg-white border-royal-red/10"
              )}
            >
              <h3 className={cn("text-2xl font-bold mb-6", isDark ? "text-gold" : "text-royal-red")}>Add Assessment Record</h3>
              <form onSubmit={handleAddScore} className="space-y-4">
                <div>
                  <label className={cn("text-xs font-bold uppercase opacity-50 mb-2 block", isDark ? "text-gold" : "text-royal-red")}>Subject</label>
                  <select 
                    value={newScore.subject}
                    onChange={e => setNewScore({...newScore, subject: e.target.value})}
                    className={cn(
                      "w-full p-4 rounded-2xl focus:outline-none font-bold transition-colors",
                      isDark ? "bg-gold/5 text-gold" : "bg-royal-red/5 text-royal-red"
                    )}
                  >
                    {SUBJECTS.map(s => <option key={s.id} value={s.name} className={isDark ? "bg-royal-red" : "bg-white"}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={cn("text-xs font-bold uppercase opacity-50 mb-2 block", isDark ? "text-gold" : "text-royal-red")}>Class Average (%)</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={newScore.percentage}
                    onChange={e => setNewScore({...newScore, percentage: e.target.value})}
                    className={cn(
                      "w-full p-4 rounded-2xl focus:outline-none transition-colors",
                      isDark ? "bg-gold/5 text-gold" : "bg-royal-red/5 text-royal-red"
                    )}
                    placeholder="e.g. 85"
                  />
                </div>
                <div>
                  <label className={cn("text-xs font-bold uppercase opacity-50 mb-2 block", isDark ? "text-gold" : "text-royal-red")}>Date</label>
                  <input 
                    type="date"
                    required
                    value={newScore.date}
                    onChange={e => setNewScore({...newScore, date: e.target.value})}
                    className={cn(
                      "w-full p-4 rounded-2xl focus:outline-none transition-colors",
                      isDark ? "bg-gold/5 text-gold" : "bg-royal-red/5 text-royal-red"
                    )}
                  />
                </div>
                <button 
                  type="submit"
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold mt-4 shadow-lg transition-all",
                    isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white shadow-royal-red/20"
                  )}
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
