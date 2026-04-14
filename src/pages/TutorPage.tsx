import React, { useState, useRef, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Mic, Sparkles, Brain, ChevronDown, Share2, Copy, Check, MessageSquare, BookOpen, ListRestart, X, Download, Calculator as CalculatorIcon, Trash2 } from 'lucide-react';
import { askTutor, summarizeChat } from '../lib/gemini';
import { SUBJECTS } from '../lib/constants';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, query, onSnapshot, orderBy, limit, deleteDoc, doc, writeBatch, getDocs } from 'firebase/firestore';
import { AuthContext } from '../App';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function Calculator() {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');

  const handleNumber = (num: string) => {
    setDisplay(prev => prev === '0' ? num : prev + num);
  };

  const handleOperator = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const calculate = () => {
    try {
      const fullEquation = equation + display;
      // Simple eval for basic calculator
      const result = eval(fullEquation.replace('×', '*').replace('÷', '/'));
      setDisplay(String(result));
      setEquation('');
    } catch (e) {
      setDisplay('Error');
    }
  };

  const clear = () => {
    setDisplay('0');
    setEquation('');
  };

  return (
    <div className="bg-black/5 dark:bg-white/5 p-6 rounded-3xl border border-black/10 dark:border-white/10 max-w-xs mx-auto">
      <div className="mb-4 text-right">
        <div className="text-[10px] opacity-40 h-4 font-mono">{equation}</div>
        <div className="text-3xl font-bold font-mono truncate">{display}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button onClick={clear} className="p-3 bg-red-500/10 text-red-500 rounded-xl font-bold hover:bg-red-500/20 transition-colors">C</button>
        <button onClick={() => handleOperator('÷')} className="p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors">÷</button>
        <button onClick={() => handleOperator('×')} className="p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors">×</button>
        <button onClick={() => handleOperator('-')} className="p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors">-</button>
        
        {[7, 8, 9].map(n => (
          <button key={n} onClick={() => handleNumber(String(n))} className="p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors">{n}</button>
        ))}
        <button onClick={() => handleOperator('+')} className="p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors">+</button>
        
        {[4, 5, 6].map(n => (
          <button key={n} onClick={() => handleNumber(String(n))} className="p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors">{n}</button>
        ))}
        <button onClick={calculate} className="row-span-3 p-3 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold hover:scale-105 transition-all">=</button>
        
        {[1, 2, 3].map(n => (
          <button key={n} onClick={() => handleNumber(String(n))} className="p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors">{n}</button>
        ))}
        
        <button onClick={() => handleNumber('0')} className="col-span-2 p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors">0</button>
        <button onClick={() => handleNumber('.')} className="p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors">.</button>
      </div>
    </div>
  );
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  id: string;
}

export default function TutorPage() {
  const { user, profile, addXp } = useContext(AuthContext);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'teach' | 'solve' | 'revise'>('teach');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showSubjectMenu, setShowSubjectMenu] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dailyGoal = 5;
  const questionsToday = messages.filter(m => m.role === 'user').length;
  const goalProgress = Math.min((questionsToday / dailyGoal) * 100, 100);

  useEffect(() => {
    if (!user || !profile) return;

    const q = query(
      collection(db, 'users', user.uid, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Message[];
      setMessages(loadedMessages);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}/messages`));

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping || !user) return;

    const userMsg = { 
      role: 'user' as const, 
      content: input, 
      timestamp: new Date().toISOString() 
    };
    
    setInput('');
    setIsTyping(true);

    try {
      // Save user message to Firestore
      await addDoc(collection(db, 'users', user.uid, 'messages'), userMsg);
      
      // Add XP for engagement
      addXp(15);

      const response = await askTutor(input, mode, subject.name);
      
      // Save AI response to Firestore
      await addDoc(collection(db, 'users', user.uid, 'messages'), {
        role: 'ai' as const,
        content: response,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/messages`);
    } finally {
      setIsTyping(false);
    }
  };

  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window)) {
      const errorMsg: Message = { 
        role: 'ai', 
        content: "Voice recognition is not supported in this browser. Please try using Google Chrome for the best experience.", 
        id: Date.now().toString() 
      };
      setMessages(prev => [...prev, errorMsg]);
      return;
    }
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.start();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const shareOnSocial = (text: string) => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text.substring(0, 200) + '...')}`;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error("Failed to open share window:", e);
    }
  };

  const handleSummarize = async () => {
    if (messages.length === 0 || isSummarizing) return;
    setIsSummarizing(true);
    try {
      const result = await summarizeChat(messages);
      setSummary(result);
    } catch (error) {
      console.error("Failed to summarize chat:", error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleExport = () => {
    if (messages.length === 0) return;
    
    const header = `Eclipse AI Tutor Session\nSubject: ${subject.name}\nDate: ${new Date().toLocaleString()}\n\n==========================================\n\n`;
    const chatText = messages.map(m => {
      const role = m.role === 'user' ? 'STUDENT' : 'ECLIPSE AI';
      return `${role}:\n${m.content}\n`;
    }).join('\n------------------------------------------\n\n');
    
    const fullText = header + chatText;
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eclipse-chat-${subject.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'messages', messageId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/messages/${messageId}`);
    }
  };

  const handleClearChat = async () => {
    if (!user || messages.length === 0) return;
    if (!confirm("Are you sure you want to clear the entire chat history? This cannot be undone.")) return;

    try {
      const batch = writeBatch(db);
      const q = query(collection(db, 'users', user.uid, 'messages'));
      const snapshot = await getDocs(q);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/messages`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-6rem)]">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl">
            <button 
              onClick={() => setMode('teach')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                mode === 'teach' 
                  ? "bg-white dark:bg-black shadow-md ring-1 ring-black/5 dark:ring-white/10 text-black dark:text-white" 
                  : "opacity-50 hover:opacity-80"
              )}
            >
              <Brain size={16} />
              Teach
            </button>
            <button 
              onClick={() => setMode('solve')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                mode === 'solve' 
                  ? "bg-white dark:bg-black shadow-md ring-1 ring-black/5 dark:ring-white/10 text-black dark:text-white" 
                  : "opacity-50 hover:opacity-80"
              )}
            >
              <Sparkles size={16} />
              Solve
            </button>
            <button 
              onClick={() => setMode('revise')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                mode === 'revise' 
                  ? "bg-white dark:bg-black shadow-md ring-1 ring-black/5 dark:ring-white/10 text-black dark:text-white" 
                  : "opacity-50 hover:opacity-80"
              )}
            >
              <BookOpen size={16} />
              Revise
            </button>
          </div>

          {messages.length > 0 && (
            <button
              onClick={handleSummarize}
              disabled={isSummarizing}
              className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              {isSummarizing ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <ListRestart size={16} />
                </motion.div>
              ) : (
                <ListRestart size={16} />
              )}
              Summarize
            </button>
          )}

          {messages.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl text-sm font-semibold transition-all"
            >
              <Download size={16} />
              Export
            </button>
          )}

          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-sm font-semibold transition-all"
            >
              <Trash2 size={16} />
              Clear
            </button>
          )}

          <button
            onClick={() => setShowCalculator(!showCalculator)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
              showCalculator ? "bg-black text-white dark:bg-white dark:text-black" : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
            )}
          >
            <CalculatorIcon size={16} />
            Calculator
          </button>
        </div>

        <div className="relative">
          <button 
            onClick={() => setShowSubjectMenu(!showSubjectMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl text-sm font-medium"
          >
            {subject.name}
            <ChevronDown size={16} className={cn("transition-transform", showSubjectMenu && "rotate-180")} />
          </button>
          
          <AnimatePresence>
            {showSubjectMenu && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full right-0 mt-2 w-64 max-h-80 overflow-y-auto bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-xl shadow-2xl z-50 p-2"
              >
                {SUBJECTS.map(s => (
                  <button 
                    key={s.id}
                    onClick={() => { setSubject(s); setShowSubjectMenu(false); }}
                    className={cn(
                      "w-full text-left px-4 py-2 rounded-lg text-sm transition-colors",
                      subject.id === s.id ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-black/5 dark:hover:bg-white/5"
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-10 mb-6 pr-2 scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-8 py-12">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-20 h-20 rounded-full border-2 border-black/10 dark:border-white/10 flex items-center justify-center"
            >
              <Sparkles size={40} className="opacity-20" />
            </motion.div>
            
            <div className="space-y-2">
              <p className="text-2xl font-bold tracking-tight">How can I help you with {subject.name}?</p>
              <p className="text-sm opacity-50 max-w-md mx-auto">
                I can explain complex concepts, solve specific problems, or even help with your Sparx homework.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <motion.div 
            key={msg.id}
            initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "flex flex-col max-w-[85%] group relative",
              msg.role === 'user' ? "ml-auto items-end" : "items-start"
            )}
          >
            <div className={cn(
              "px-6 py-4 rounded-3xl text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none",
              msg.role === 'user' 
                ? "bg-black text-white dark:bg-white dark:text-black rounded-tr-none" 
                : "bg-black/5 dark:bg-white/5 rounded-tl-none"
            )}>
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                    code: ({ children }) => <code className="bg-black/10 dark:bg-white/10 px-1 rounded font-mono text-xs">{children}</code>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-black/20 dark:border-white/20 pl-4 italic my-2">{children}</blockquote>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
            
            <div className={cn(
              "flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity",
              msg.role === 'user' ? "mr-2" : "ml-2"
            )}>
              {msg.role === 'ai' && (
                <>
                  <button 
                    onClick={() => copyToClipboard(msg.content, msg.id)}
                    className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                  >
                    {copiedId === msg.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                  <button 
                    onClick={() => shareOnSocial(msg.content)}
                    className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <Share2 size={14} />
                  </button>
                </>
              )}
              <button 
                onClick={() => handleDeleteMessage(msg.id)}
                className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
                title="Delete message"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 px-6 py-4 bg-black/5 dark:bg-white/5 rounded-3xl rounded-tl-none w-20">
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-current" />
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-current" />
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-current" />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="relative mb-4">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <button 
            onClick={startVoice}
            className={cn(
              "p-2 rounded-full transition-colors",
              isListening ? "bg-red-500 text-white animate-pulse" : "hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            <Mic size={20} />
          </button>
        </div>
        
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={isListening ? "Listening..." : `Ask a question about ${subject.name}...`}
          className="w-full pl-14 pr-14 py-5 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all text-base placeholder:opacity-40"
        />

        <button 
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black text-white dark:bg-white dark:text-black rounded-xl disabled:opacity-30 transition-all hover:scale-105 active:scale-95"
        >
          <Send size={20} />
        </button>
      </div>

      {/* Calculator Area */}
      <AnimatePresence>
        {showCalculator && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <Calculator />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Modal */}
      <AnimatePresence>
        {summary && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-black/5 dark:bg-white/5 rounded-xl">
                    <ListRestart size={20} />
                  </div>
                  <h2 className="text-2xl font-bold">Chat Summary</h2>
                </div>
                <button 
                  onClick={() => setSummary(null)}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none max-h-[60vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {summary}
                </ReactMarkdown>
              </div>

              <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5 flex justify-end">
                <button 
                  onClick={() => setSummary(null)}
                  className="px-6 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold text-sm"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
