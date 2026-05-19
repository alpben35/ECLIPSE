import React, { useState, useRef, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Mic, Sparkles, Brain, ChevronDown, Share2, Copy, Check, MessageSquare, BookOpen, ListRestart, X, Download, Calculator as CalculatorIcon, Upload, Trash2, Shield, AlertCircle } from 'lucide-react';
import { askTutor, summarizeChat } from '@/lib/gemini';
import { SUBJECTS } from '@/lib/constants';
import { db, handleFirestoreError, OperationType, encryptData, decryptData } from '@/lib/firebase';
import { collection, addDoc, query, onSnapshot, orderBy, limit, deleteDoc, doc, getDocs, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore';
import { AuthContext, ThemeContext } from '@/lib/contexts';
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
      // Safer alternative to eval for basic arithmetic
      const tokens = fullEquation.replace(/×/g, '*').replace(/÷/g, '/').split(/([+\-*/])/).map(t => t.trim()).filter(t => t);
      let result = parseFloat(tokens[0]);
      for (let i = 1; i < tokens.length; i += 2) {
        const op = tokens[i];
        const val = parseFloat(tokens[i + 1]);
        if (op === '+') result += val;
        if (op === '-') result -= val;
        if (op === '*') result *= val;
        if (op === '/') result /= val;
      }
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
    <div className="bg-gold/5 p-6 rounded-3xl border border-gold/10 max-w-xs mx-auto">
      <div className="mb-4 text-right">
        <div className="text-[10px] opacity-40 h-4 font-mono">{equation}</div>
        <div className="text-3xl font-bold font-mono truncate">{display}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button onClick={clear} className="p-3 bg-red-500/10 text-red-500 rounded-xl font-bold hover:bg-red-500/20 transition-colors">C</button>
        <button onClick={() => handleOperator('÷')} className="p-3 bg-gold/5 rounded-xl font-bold hover:bg-gold/10 transition-colors">÷</button>
        <button onClick={() => handleOperator('×')} className="p-3 bg-gold/5 rounded-xl font-bold hover:bg-gold/10 transition-colors">×</button>
        <button onClick={() => handleOperator('-')} className="p-3 bg-gold/5 rounded-xl font-bold hover:bg-gold/10 transition-colors">-</button>
        
        {[7, 8, 9].map(n => (
          <button key={n} onClick={() => handleNumber(String(n))} className="p-3 bg-gold/5 rounded-xl font-bold hover:bg-gold/10 transition-colors">{n}</button>
        ))}
        <button onClick={() => handleOperator('+')} className="p-3 bg-gold/5 rounded-xl font-bold hover:bg-gold/10 transition-colors">+</button>
        
        {[4, 5, 6].map(n => (
          <button key={n} onClick={() => handleNumber(String(n))} className="p-3 bg-gold/5 rounded-xl font-bold hover:bg-gold/10 transition-colors">{n}</button>
        ))}
        <button onClick={calculate} className="row-span-3 p-3 bg-gold text-royal-red rounded-xl font-bold hover:scale-105 transition-all">=</button>
        
        {[1, 2, 3].map(n => (
          <button key={n} onClick={() => handleNumber(String(n))} className="p-3 bg-gold/5 rounded-xl font-bold hover:bg-gold/10 transition-colors">{n}</button>
        ))}
        
        <button onClick={() => handleNumber('0')} className="col-span-2 p-3 bg-gold/5 rounded-xl font-bold hover:bg-gold/10 transition-colors">0</button>
        <button onClick={() => handleNumber('.')} className="p-3 bg-gold/5 rounded-xl font-bold hover:bg-gold/10 transition-colors">.</button>
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
  const { isDark } = useContext(ThemeContext);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'question' | 'test' | 'assignment'>('question');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showSubjectMenu, setShowSubjectMenu] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [useHandwriting, setUseHandwriting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !profile) return;

    const q = query(
      collection(db, 'users', user.uid, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setErrorMessage(null);
      const loadedMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        let timestamp = data.timestamp;
        
        // Handle Firestore Timestamp or ISO string
        if (timestamp && typeof timestamp.toDate === 'function') {
          timestamp = timestamp.toDate().toISOString();
        } else if (!timestamp) {
          timestamp = new Date().toISOString();
        }

        return {
          id: doc.id,
          role: data.role,
          content: decryptData(data.content),
          timestamp
        } as Message;
      }) as Message[];
      // Reverse to show in chronological order
      setMessages(loadedMessages.reverse());
    }, (err) => {
      setErrorMessage("Failed to load chat history. Please check your connection.");
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}/messages`);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    const messageText = input.trim();
    if (!messageText || isTyping || !user) return;

    if (messageText.toLowerCase() === 'hello world') {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          unlockedGlobe: true
        });
        alert("✨ SECRET UNLOCKED: You've unlocked the Globe profile icon! Check your Profile Settings.");
      } catch (err) {
        console.error("Failed to unlock globe:", err);
      }
    }

    setInput('');
    setIsTyping(true);

    try {
      // Save user message to Firestore
      await addDoc(collection(db, 'users', user.uid, 'messages'), {
        role: 'user',
        content: encryptData(messageText),
        timestamp: serverTimestamp()
      });
      
      if (addXp) await addXp(15);

      let responseText = '';
      try {
        const result = await askTutor(messageText, mode, subject.name);
        responseText = result.text;
      } catch (geminiError: any) {
        console.error("Gemini Error:", geminiError);
        responseText = `⚠️ AI Error: ${geminiError.message || "Failed to get a response from the AI. Please check your API key and connection."}`;
      }
      
      // Save AI response to Firestore
      await addDoc(collection(db, 'users', user.uid, 'messages'), {
        role: 'ai',
        content: encryptData(responseText),
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Firestore Error in handleSend:", error);
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/messages`);
    } finally {
      setIsTyping(false);
    }
  };

  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window)) {
      const errorMsg: Message = { 
        role: 'ai', 
        content: "Voice recognition is not supported in this browser.", 
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
    
    const header = `Eclipse Teacher Assistant Session\nSubject: ${subject.name}\nDate: ${new Date().toLocaleString()}\n\n==========================================\n\n`;
    const chatText = messages.map(m => {
      const role = m.role === 'user' ? 'TEACHER' : 'ECLIPSE AI';
      return `${role}:\n${m.content}\n`;
    }).join('\n------------------------------------------\n\n');
    
    const fullText = header + chatText;
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eclipse-teacher-session-${subject.name.toLowerCase().replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const deleteMessage = async (messageId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'messages', messageId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/messages/${messageId}`);
    }
  };

  const clearChat = async () => {
    if (!user || messages.length === 0) return;
    if (!window.confirm("Are you sure you want to clear the entire chat history?")) return;

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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className={cn("flex p-1 rounded-xl border transition-colors", isDark ? "bg-gold/10 border-gold/20" : "bg-royal-red/10 border-royal-red/20")}>
            <button 
              onClick={() => setMode('question')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                mode === 'question' 
                  ? (isDark ? "bg-gold text-royal-red shadow-md" : "bg-royal-red text-white shadow-md") 
                  : (isDark ? "text-gold opacity-50 hover:opacity-80" : "text-royal-red opacity-50 hover:opacity-80")
              )}
            >
              <Brain size={16} />
              Create Question
            </button>
            <button 
              onClick={() => setMode('test')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                mode === 'test' 
                  ? (isDark ? "bg-gold text-royal-red shadow-md" : "bg-royal-red text-white shadow-md") 
                  : (isDark ? "text-gold opacity-50 hover:opacity-80" : "text-royal-red opacity-50 hover:opacity-80")
              )}
            >
              <Sparkles size={16} />
              Create Test
            </button>
            <button 
              onClick={() => setMode('assignment')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                mode === 'assignment' 
                  ? (isDark ? "bg-gold text-royal-red shadow-md" : "bg-royal-red text-white shadow-md") 
                  : (isDark ? "text-gold opacity-50 hover:opacity-80" : "text-royal-red opacity-50 hover:opacity-80")
              )}
            >
              <BookOpen size={16} />
              Create Assignment
            </button>
          </div>

          <button
            onClick={handleSummarize}
            disabled={isSummarizing}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all disabled:opacity-50",
              isDark ? "bg-gold/10 hover:bg-gold/20 border-gold/20 text-gold" : "bg-royal-red/5 hover:bg-royal-red/10 border-royal-red/10 text-royal-red"
            )}
          >
            <ListRestart size={16} />
            Summarize
          </button>

          <button
            onClick={handleExport}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all",
              isDark ? "bg-gold/10 hover:bg-gold/20 border-gold/20 text-gold" : "bg-royal-red/5 hover:bg-royal-red/10 border-royal-red/10 text-royal-red"
            )}
          >
            <Download size={16} />
            Export
          </button>

          <button
            onClick={clearChat}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all",
              isDark ? "bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-500" : "bg-red-50 hover:bg-red-100 border-red-200 text-red-600"
            )}
          >
            <Trash2 size={16} />
            Clear
          </button>

          <button
            onClick={() => setShowCalculator(!showCalculator)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all",
              showCalculator 
                ? (isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white") 
                : (isDark ? "bg-gold/10 text-gold hover:bg-gold/20 border-gold/20" : "bg-white text-royal-red border-royal-red/20 hover:bg-royal-red/5")
            )}
          >
            <CalculatorIcon size={16} />
            Calc
          </button>

          <button
            onClick={() => setUseHandwriting(!useHandwriting)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all",
              useHandwriting 
                ? (isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white") 
                : (isDark ? "bg-gold/10 text-gold hover:bg-gold/20 border-gold/20" : "bg-white text-royal-red border-royal-red/20 hover:bg-royal-red/5")
            )}
            title="Toggle Handwriting Font"
          >
            <Sparkles size={16} />
            Font
          </button>
        </div>

        <div className="relative">
          <button 
            onClick={() => setShowSubjectMenu(!showSubjectMenu)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium transition-colors",
              isDark ? "bg-gold/10 border-gold/20 text-gold" : "bg-white border-royal-red/20 text-royal-red"
            )}
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
                className={cn(
                  "absolute top-full right-0 mt-2 w-64 max-h-80 overflow-y-auto border rounded-xl shadow-2xl z-50 p-2",
                  isDark ? "bg-royal-red border-gold/10" : "bg-white border-royal-red/10"
                )}
              >
                {SUBJECTS.map(s => (
                  <button 
                    key={s.id}
                    onClick={() => { setSubject(s); setShowSubjectMenu(false); }}
                    className={cn(
                      "w-full text-left px-4 py-2 rounded-lg text-sm transition-colors",
                      subject.id === s.id 
                        ? (isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white") 
                        : (isDark ? "text-gold hover:bg-gold/5" : "text-royal-red hover:bg-royal-red/5")
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

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-10 mb-6 pr-2 scrollbar-thin scrollbar-thumb-gold scrollbar-track-gold/5"
      >
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky top-0 z-10 bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center justify-between gap-4 mb-4"
          >
            <div className="flex items-center gap-3 text-red-500">
              <Shield size={20} />
              <p className="text-sm font-medium">{errorMessage}</p>
            </div>
            <button 
              onClick={() => setErrorMessage(null)}
              className="p-1 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}

        {showCalculator && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-8"
          >
            <Calculator />
          </motion.div>
        )}

        {messages.length === 0 && !showCalculator && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-8 py-12">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-20 h-20 rounded-full border-2 border-gold/10 flex items-center justify-center"
            >
              <Sparkles size={40} className="opacity-20" />
            </motion.div>
            
            <div className="space-y-2">
              <p className="text-2xl font-bold tracking-tight">How can I assist your teaching in {subject.name}?</p>
              <p className="text-sm opacity-50 max-w-md mx-auto">
                I can help generate lesson plans, create assessment rubrics, or explain complex topics for your students.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <React.Fragment key={msg.id}>
            {idx > 0 && (
              <div className="w-full border-t border-gold/10 my-2" />
            )}
            <motion.div 
              initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "flex flex-col max-w-[85%] group",
              msg.role === 'user' ? "ml-auto items-end" : "items-start"
            )}
          >
            <div className={cn(
              "relative px-6 py-4 rounded-3xl text-sm leading-relaxed max-w-none",
              msg.role === 'user' 
                ? "bg-gold text-royal-red rounded-tr-none font-bold" 
                : cn("bg-gold/10 border border-gold/20 rounded-tl-none text-lg", useHandwriting && "handwriting")
            )}>
              <button 
                onClick={() => deleteMessage(msg.id)}
                className={cn(
                  "absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-black/10",
                  msg.role === 'user' ? "right-full mr-2 text-gold" : "left-full ml-2 text-gold/40"
                )}
              >
                <Trash2 size={14} />
              </button>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="space-y-2 mb-4">{children}</ul>,
                  ol: ({ children }) => <ol className="space-y-2 mb-4">{children}</ol>,
                  li: ({ children }) => <li className="flex gap-2"><span>•</span>{children}</li>,
                  h1: ({ children }) => <h1 className="text-2xl font-black mb-4 text-gold">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xl font-bold mb-3 text-gold">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-bold mb-2 text-gold">{children}</h3>,
                  code: ({ children }) => <code className="bg-gold/20 px-1.5 py-0.5 rounded font-mono text-sm text-gold">{children}</code>,
                  pre: ({ children }) => <pre className="bg-gold/5 p-4 rounded-2xl border border-gold/10 overflow-x-auto mb-4 font-mono text-sm">{children}</pre>,
                  blockquote: ({ children }) => <blockquote className="border-l-4 border-gold/30 pl-4 italic opacity-80 mb-4">{children}</blockquote>,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </motion.div>
          </React.Fragment>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 px-6 py-4 bg-gold/5 rounded-3xl rounded-tl-none w-20">
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-current" />
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-current" />
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-current" />
          </div>
        )}
      </div>

      <div className="relative mb-4">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 md:gap-2">
          <button 
            id="mic-button"
            onClick={startVoice}
            title="Voice Typing"
            className={cn(
              "p-2 md:p-2.5 rounded-xl transition-all",
              isListening 
                ? "bg-gold text-royal-red shadow-lg shadow-gold/40 animate-pulse scale-110" 
                : "bg-gold/10 hover:bg-gold/20 text-gold"
            )}
          >
            <Mic size={20} className="md:w-[22px] md:h-[22px]" />
          </button>
          <button 
            title="Upload Content"
            className="p-2 md:p-2.5 rounded-xl bg-gold/10 hover:bg-gold/20 text-gold transition-colors"
          >
            <Upload size={20} className="md:w-[22px] md:h-[22px]" />
          </button>
        </div>
        
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={isListening ? "Listening..." : `Create content for ${subject.name}...`}
          className={cn(
            "w-full pl-24 md:pl-28 pr-14 md:pr-16 py-4 md:py-5 border rounded-2xl focus:outline-none focus:ring-2 transition-all text-sm md:text-base",
            isDark 
              ? "bg-gold/10 border-gold/20 focus:ring-gold/20 placeholder:text-gold/40 text-gold" 
              : "bg-white border-royal-red/20 focus:ring-royal-red/10 placeholder:text-royal-red/30 text-royal-red shadow-sm"
          )}
        />

        <button 
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl disabled:opacity-30 transition-all hover:scale-105 active:scale-95",
            isDark ? "bg-gold text-royal-red" : "bg-royal-red text-white"
          )}
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
