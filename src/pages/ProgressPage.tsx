import React, { useState, useEffect, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  Plus, Upload, FileText, Trash2, TrendingUp, Award, 
  Clock, Loader2, Folder, Shield, Lock, Eye, EyeOff, BrainCircuit, X, CheckCircle2, AlertTriangle, Sparkles
} from 'lucide-react';
import { db, auth, storage, handleFirestoreError, OperationType, encryptData, decryptData } from '../lib/firebase';
import { collection, addDoc, query, onSnapshot, orderBy, deleteDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { SUBJECTS, PROMPT_LIMITS } from '../lib/constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { AuthContext } from '../lib/contexts';
import confetti from 'canvas-confetti';
import { analyzeStudyPaper, PaperDiagnostic } from '../lib/gemini';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { useLocation, useNavigate } from 'react-router-dom';

export default function ProgressPage() {
  const { user, profile, addXp } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);
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
  const [selectedSubjectFolder, setSelectedSubjectFolder] = useState<string | null>(null);
  
  // AI Diagnostics State
  const [analyzingPaperId, setAnalyzingPaperId] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<PaperDiagnostic | null>(null);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  
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
      setScores(snap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          percentage: Number(decryptData(data.percentage)),
          id: doc.id
        };
      }));
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}/scores`));

    const unsubPapers = onSnapshot(papersQuery, (snap) => {
      setPapers(snap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          fileName: decryptData(data.fileName),
          id: doc.id
        };
      }));
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}/papers`));

    return () => {
      unsubScores();
      unsubPapers();
    };
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('session_id')) {
      setShowSuccess(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#000000', '#ffffff', '#ffa500']
      });
      // Clean up URL
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  const handleAddScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      const scorePercentage = Number(newScore.percentage);
      const testDate = new Date(newScore.date).toISOString();

      await addDoc(collection(db, 'users', user.uid, 'scores'), {
        uid: user.uid,
        subject: newScore.subject,
        percentage: encryptData(String(scorePercentage)),
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
        fileName: encryptData(file.name),
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

  const handleAnalyzePaper = async (paper: any) => {
    if (!user) return;
    setAnalyzingPaperId(paper.id);
    setDiagnosticError(null);
    setDiagnostic(null);

    try {
      // 1. Check prompt limit
      const userTier = (profile?.tier || 'free') as keyof typeof PROMPT_LIMITS;
      const maxPrompts = PROMPT_LIMITS[userTier] || 20;

      if (!profile?.isAdmin && profile?.promptsToday >= maxPrompts) {
        window.dispatchEvent(new CustomEvent('prompt-limit-reached', { 
          detail: { limit: maxPrompts, tier: userTier } 
        }));
        setAnalyzingPaperId(null);
        return;
      }

      // 2. Perform Analysis
      const result = await analyzeStudyPaper(paper.paperUrl, paper.subject);
      
      // 3. Save Diagnostic to Firestore & Increment limit
      await updateDoc(doc(db, 'users', user.uid, 'papers', paper.id), {
        diagnostic: result
      });
      await updateDoc(doc(db, 'users', user.uid), {
        promptsToday: increment(1)
      });

      setDiagnostic(result);
      setIsDiagnosticModalOpen(true);
    } catch (error: any) {
      console.error("AI Diagnostic Error:", error);
      setDiagnosticError(error.message || 'An error occurred during analysis.');
      setIsDiagnosticModalOpen(true);
    } finally {
      setAnalyzingPaperId(null);
    }
  };

  const openDiagnostic = (paper: any) => {
    setDiagnostic(paper.diagnostic);
    setIsDiagnosticModalOpen(true);
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

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordError('');
    setPasswordSuccess(false);

    try {
      await updatePassword(user, password);
      setPasswordSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        setPasswordError('Please sign out and sign back in to change your password for security.');
      } else {
        setPasswordError(error.message);
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-6 bg-green-500 text-white rounded-3xl flex items-center justify-between shadow-xl mb-8"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg">Payment Successful!</h3>
                <p className="text-sm opacity-90">Your account has been upgraded. Welcome to the elite.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowSuccess(false)}
              className="p-2 hover:bg-white/10 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
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
          <p className="text-sm opacity-50">Latest Score</p>
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
                  <stop offset="5%" stopColor="currentColor" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="currentColor" stopOpacity={0}/>
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
                cursor={{ stroke: 'currentColor', strokeWidth: 1, strokeDasharray: '4 4' }}
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
                stroke="currentColor" 
                fillOpacity={1} 
                fill="url(#colorPct)" 
                strokeWidth={3}
                activeDot={{ r: 6, strokeWidth: 0, fill: 'currentColor' }}
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
            return (filterSubject === 'All' || s.name === filterSubject);
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
                onClick={() => setSelectedSubjectFolder(s.name)}
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
                  {paper.diagnostic ? (
                    <button 
                      onClick={() => openDiagnostic(paper)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-500 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-green-500/20 transition-all border border-green-500/20"
                    >
                      <Sparkles size={12} />
                      View AI Result
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleAnalyzePaper(paper)}
                      disabled={analyzingPaperId === paper.id}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border",
                        analyzingPaperId === paper.id 
                          ? "bg-black/5 dark:bg-white/5 opacity-50 border-black/10 dark:border-white/10" 
                          : "bg-black text-white dark:bg-white dark:text-black hover:scale-105 border-transparent shadow-sm"
                      )}
                    >
                      {analyzingPaperId === paper.id ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Analyzing
                        </>
                      ) : (
                        <>
                          <BrainCircuit size={12} />
                          AI Diagnostic
                        </>
                      )}
                    </button>
                  )}
                  <a 
                    href={paper.paperUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <Eye size={18} />
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

      {/* AI Diagnostic Modal */}
      <AnimatePresence>
        {isDiagnosticModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDiagnosticModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[3rem] p-8 md:p-12 shadow-2xl overflow-hidden"
            >
              {/* Decorative Noir blobs */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-black/5 dark:bg-white/5 blur-[80px] -mr-32 -mt-32" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/5 dark:bg-white/5 blur-[80px] -ml-32 -mb-32" />

              <div className="relative">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-black dark:bg-white rounded-3xl shadow-xl">
                      <BrainCircuit className="text-white dark:text-black" size={32} />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black italic tracking-tighter uppercase leading-none">AI Diagnostic</h3>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mt-1">Eclipse Cognitive Engine v3.0</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsDiagnosticModalOpen(false)}
                    className="p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>

                {diagnosticError ? (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
                      <AlertTriangle size={40} />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xl font-bold">Analysis Failed</h4>
                      <p className="opacity-60 max-w-sm mx-auto">{diagnosticError}</p>
                    </div>
                    <button 
                      onClick={() => setIsDiagnosticModalOpen(false)}
                      className="px-8 py-3 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold"
                    >
                      Understood
                    </button>
                  </div>
                ) : diagnostic ? (
                  <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                    {/* Overall Summary Card */}
                    <div className="p-6 bg-black/5 dark:bg-white/5 rounded-[2rem] border border-black/5 dark:border-white/5">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40">Overall Assessment</h4>
                        <div className="px-3 py-1 bg-black dark:bg-white text-white dark:text-black rounded-full text-[10px] font-black">
                          {diagnostic.overallGrade || 'COMPLETED'}
                        </div>
                      </div>
                      <p className="text-sm font-medium leading-relaxed opacity-80">{diagnostic.summary}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Strengths */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="text-green-500" size={18} />
                          <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40">Core Strengths</h4>
                        </div>
                        <div className="space-y-2">
                          {diagnostic.strengths.map((s, i) => (
                            <div key={i} className="flex gap-2 p-3 bg-green-500/5 dark:bg-green-500/10 rounded-xl border border-green-500/10">
                              <span className="text-xs font-medium leading-normal">{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Weaknesses */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="text-amber-500" size={18} />
                          <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40">Areas for Growth</h4>
                        </div>
                        <div className="space-y-2">
                          {diagnostic.weaknesses.map((w, i) => (
                            <div key={i} className="flex gap-2 p-3 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl border border-amber-500/10">
                              <span className="text-xs font-medium leading-normal text-amber-700 dark:text-amber-400">{w}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Improvement Tips */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="text-black dark:text-white" size={18} />
                        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40">Strategic Action Plan</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {diagnostic.improvementTips.map((tip, i) => (
                          <div key={i} className="flex items-center gap-4 p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 group hover:border-black/20 dark:hover:border-white/20 transition-all">
                            <div className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-black text-xs shrink-0">
                              {i + 1}
                            </div>
                            <span className="text-sm font-medium">{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-8 border-t border-black/5 dark:border-white/5 text-center">
                      <p className="text-[10px] opacity-40 font-medium">Diagnostic generated using AI. Always consult your teacher for formal grading.</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="animate-spin opacity-20" size={48} />
                    <p className="font-bold opacity-40">Loading assessment...</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Score Modal */}
      <AnimatePresence>
        {selectedSubjectFolder && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSubjectFolder(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-[3rem] p-8 md:p-12 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-black dark:bg-white rounded-2xl">
                    <Folder className="text-white dark:text-black" size={24} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold">{selectedSubjectFolder} Details</h2>
                    <p className="text-xs opacity-50 uppercase font-black tracking-widest">Subject Academic Archive</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      openAddScore(selectedSubjectFolder);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl text-xs font-bold"
                  >
                    <Plus size={16} /> Add Score
                  </button>
                  <button 
                    onClick={() => setSelectedSubjectFolder(null)}
                    className="p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Subject Chart */}
              <div className="mb-12 p-8 bg-black/5 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5">
                <h3 className="text-sm font-bold opacity-50 mb-6 uppercase tracking-widest">Performance Curve</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={scores.filter(s => s.subject === selectedSubjectFolder).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(s => ({
                      date: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(s.date)),
                      percentage: s.percentage
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888888" opacity={0.1} />
                      <XAxis dataKey="date" hide />
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="percentage" 
                        stroke="currentColor" 
                        fill="currentColor" 
                        fillOpacity={0.1} 
                        strokeWidth={4} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Subject History */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold opacity-50 mb-4 uppercase tracking-widest">Historical Entries</h3>
                <div className="grid gap-3">
                  {scores
                    .filter(s => s.subject === selectedSubjectFolder)
                    .slice().reverse()
                    .map(score => (
                      <div key={score.id} className="flex items-center justify-between p-5 bg-black/5 dark:bg-white/5 rounded-2xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                        <div>
                          <p className="font-bold">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(score.date))}</p>
                          <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest mt-0.5">Verified Entry</p>
                        </div>
                        <div className="flex items-center gap-6">
                           <span className="text-xl font-black">{score.percentage}%</span>
                           <button 
                            onClick={() => deleteScore(score.id)}
                            className="p-2 text-red-500/50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  {scores.filter(s => s.subject === selectedSubjectFolder).length === 0 && (
                    <div className="py-12 text-center opacity-30 italic">No historical data for this subject yet.</div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
