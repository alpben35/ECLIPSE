import LearningMomentum, { useLearningMomentum } from '../components/LearningMomentum';
import React, { useState, useRef, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, Mic, Sparkles, Brain, ChevronDown, Share2, Copy, 
  Check, MessageSquare, BookOpen, ListRestart, X, AlertCircle, 
  Download, Calculator as CalculatorIcon, Trash2, Lock, 
  Image as ImageIcon, Paperclip, Wand2 
} from 'lucide-react';
import { askTutor, askTutorStream, summarizeChat } from '../lib/gemini';
import { SUBJECTS, PROMPT_LIMITS } from '../lib/constants';
import { db, handleFirestoreError, OperationType, encryptData, decryptData } from '../lib/firebase';
import { collection, addDoc, query, onSnapshot, orderBy, limit, deleteDoc, doc, writeBatch, getDocs, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { AuthContext } from '../lib/contexts';
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
    <div className="bg-black/5 dark:bg-white/5 p-4 md:p-6 rounded-3xl border border-black/10 dark:border-white/10 w-full max-w-[320px] mx-auto">
      <div className="mb-4 text-right">
        <div className="text-[10px] opacity-40 h-4 font-mono overflow-hidden">{equation}</div>
        <div className="text-2xl md:text-3xl font-bold font-mono truncate">{display}</div>
      </div>
      <div className="grid grid-cols-4 gap-1.5 md:gap-2">
        <button onClick={clear} className="p-2 md:p-3 bg-red-500/10 text-red-500 rounded-xl font-bold hover:bg-red-500/20 transition-colors text-sm md:text-base">C</button>
        <button onClick={() => handleOperator('÷')} className="p-2 md:p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm md:text-base">÷</button>
        <button onClick={() => handleOperator('×')} className="p-2 md:p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm md:text-base">×</button>
        <button onClick={() => handleOperator('-')} className="p-2 md:p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm md:text-base">-</button>
        
        {[7, 8, 9].map(n => (
          <button key={n} onClick={() => handleNumber(String(n))} className="p-2 md:p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm md:text-base">{n}</button>
        ))}
        <button onClick={() => handleOperator('+')} className="p-2 md:p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm md:text-base">+</button>
        
        {[4, 5, 6].map(n => (
          <button key={n} onClick={() => handleNumber(String(n))} className="p-2 md:p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm md:text-base">{n}</button>
        ))}
        <button onClick={calculate} className="row-span-3 p-2 md:p-3 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold hover:scale-105 transition-all text-sm md:text-base">=</button>
        
        {[1, 2, 3].map(n => (
          <button key={n} onClick={() => handleNumber(String(n))} className="p-2 md:p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm md:text-base">{n}</button>
        ))}
        
        <button onClick={() => handleNumber('0')} className="col-span-2 p-2 md:p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm md:text-base">0</button>
        <button onClick={() => handleNumber('.')} className="p-2 md:p-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm md:text-base">.</button>
      </div>
    </div>
  );
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  id: string;
  images?: { data: string, mimeType: string }[];
}

export default function TutorPage() {
  const { user, profile, addXp } = useContext(AuthContext);
  const momentum = useLearningMomentum(user?.uid);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'teach' | 'solve' | 'revise'>('teach');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showLearningGoal, setShowLearningGoal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ file: File, preview: string } | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !profile) return;

    const q = query(
      collection(db, 'users', user.uid, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setErrorMessage(null); // Clear any previous transient errors
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
          images: data.images,
          timestamp
        } as Message;
      }) as Message[];

      const reversed = loadedMessages.reverse();
      
      setMessages(prev => {
        // Keep active optimistic messages whose content is not yet visible in loaded Firestore messages
        const optimistic = prev.filter(m => m.id.startsWith('opt-') && !reversed.some(r => r.content === m.content));
        return [...reversed, ...optimistic];
      });
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
    if (messageText.toLowerCase() === 'hello world') {
      window.dispatchEvent(new CustomEvent('easter-egg-sparkle', { 
        detail: { message: 'Hello World! 🌍', color: '#00BFFF' } 
      }));
      // Unlock globe for user
      try {
        await updateDoc(doc(db, 'users', user?.uid), {
          unlockedGlobe: true
        });
      } catch (err) {
        console.error("Failed to unlock globe icon:", err);
      }
    }
    if ((!messageText && !selectedImage) || isTyping || !user) return;

    setErrorMessage(null);
    setInput('');
    const currentMode = mode;
    const currentSubject = subject.name;
    const currentImage = selectedImage;
    setSelectedImage(null);
    setIsTyping(true);

    const currentHistory = [...messages];
    const userRankTier = (profile?.rank || 'Basic').toLowerCase().replace(' ', '_') as keyof typeof PROMPT_LIMITS;
    const userTier = (profile?.tier || userRankTier || 'free') as keyof typeof PROMPT_LIMITS;
    const maxPrompts = PROMPT_LIMITS[userTier] || PROMPT_LIMITS['free'] || 40;
    const promptCost = 1;

    // Check limits for non-admins
    if (!profile?.isAdmin) {
      // Prompt limit
      if ((profile?.promptsToday || 0) + promptCost > maxPrompts) {
        window.dispatchEvent(new CustomEvent('prompt-limit-reached', { 
          detail: { limit: maxPrompts, tier: userTier } 
        }));
        setIsTyping(false);
        return;
      }
    }

    try {
      let imageData: { data: string, mimeType: string } | undefined;
      
      if (currentImage) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(currentImage.file);
        const base64Data = await base64Promise;
        imageData = { data: base64Data, mimeType: currentImage.file.type };
      }

      // 1. Instantly append user's optimistic message to student UI chat list
      const userMessageContent = currentImage ? `[Image Attached] ${messageText}` : messageText;
      const optimisticUserId = 'opt-user-' + Date.now();
      const optimisticUserMsg: Message = {
        id: optimisticUserId,
        role: 'user',
        content: userMessageContent
      };
      setMessages(prev => [...prev, optimisticUserMsg]);

      // 2. Schedule Firestore save of user message in the background without blocking
      addDoc(collection(db, 'users', user.uid, 'messages'), {
        role: 'user',
        content: encryptData(userMessageContent),
        timestamp: serverTimestamp()
      }).catch(err => {
        console.error("Optimistic user message Firestore write failed in background:", err);
      });
      


      // Pass the last 10 messages for context (from captured history)
      const chatHistory = currentHistory.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));

      // Streaming for modes
      let fullText = "";
      setStreamingMessage("");
      
      try {
        await askTutorStream(
          messageText || "Please assist.", 
          currentMode, 
          currentSubject, 
          (chunk) => {
            fullText += chunk;
            setStreamingMessage(fullText);
          },
          chatHistory, 
          imageData
        );
      } catch (streamErr) {
        console.warn("Streaming failed, trying non-streaming fallback...", streamErr);
        try {
          const res = await askTutor(
            messageText || "Please assist.", 
            currentMode, 
            currentSubject, 
            chatHistory, 
            imageData
          );
          fullText = res.text;
          setStreamingMessage(fullText);
        } catch (fallbackErr: any) {
          console.error("Both stream and non-stream tutor calls failed:", fallbackErr);
          throw fallbackErr;
        }
      }
      
      if (!fullText.trim()) throw new Error('The tutor returned an empty response. Please try again.');
      momentum.recordSuccess(currentMode, fullText, messageText.trim().length > 0 && !messageText.startsWith('Give me one practice question about '));
      // Reward completed exchanges rather than sends or failed requests.
      void addXp(15).catch(err => console.error('Could not save learning XP:', err));

      // 3. Append optimistic AI message to localized state prior to clearing stream state (prevents visual flicker or empty states)
      const optimisticAiId = 'opt-ai-' + Date.now();
      const optimisticAiMsg: Message = {
        id: optimisticAiId,
        role: 'ai',
        content: fullText,
        images: imageData ? [{ data: imageData.data, mimeType: imageData.mimeType }] : undefined
      };
      setMessages(prev => [...prev, optimisticAiMsg]);
      setStreamingMessage(null);

      // 4. Save AI response to Firestore in background & increment prompt uses asynchronously
      addDoc(collection(db, 'users', user.uid, 'messages'), {
        role: 'ai',
        content: encryptData(fullText),
        timestamp: serverTimestamp()
      }).then(() => {
        const updates: any = {
          promptsToday: increment(promptCost)
        };
        updateDoc(doc(db, 'users', user.uid), updates).catch(err => {
          console.error("Asynchronous update of prompt usage failed:", err);
        });
      }).catch(err => {
        console.error("Asynchronous AI Firestore write failed in background:", err);
      });

    } catch (error: any) {
      if (error.message?.includes('Limit reached')) {
        // Limit modal will be shown by StudentApp listener
        return;
      }
      setErrorMessage(error.message || "Failed to get AI response.");
      console.error("Chat Error:", error);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage("File too large. Max 5MB.");
        return;
      }
      if (!file.type.startsWith('image/')) {
        setErrorMessage("Only images are supported.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage({ file, preview: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 shrink-0">
        <div className="flex rounded-xl bg-black/5 dark:bg-white/5 p-1" role="group" aria-label="Learning mode">
          {([{ id: 'teach', label: 'Explain' }, { id: 'solve', label: 'Solve' }, { id: 'revise', label: 'Practise' }] as const).map(item => <button key={item.id} aria-pressed={mode === item.id} onClick={() => setMode(item.id)} className={cn('px-3 sm:px-4 py-2 text-sm rounded-lg', mode === item.id ? 'bg-white dark:bg-black shadow-sm font-semibold' : 'opacity-60 hover:opacity-100')}>{item.label}</button>)}
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Subject" value={subject.id} onChange={event => { const selected = SUBJECTS.find(item => item.id === event.target.value); if (selected) setSubject(selected); }} className="max-w-[150px] bg-black/5 dark:bg-white/5 text-current py-2 px-3 border border-black/10 dark:border-white/10 rounded-xl text-sm">{SUBJECTS.map(item => <option className="bg-white text-black dark:bg-neutral-900 dark:text-white" key={item.id} value={item.id}>{item.name}</option>)}</select>
          <details className="relative">
            <summary className="cursor-pointer list-none px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 text-sm">Tools <span aria-hidden="true">⌄</span></summary>
            <div className="absolute right-0 top-full mt-2 min-w-[190px] rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 p-2 shadow-xl z-40 flex flex-col items-stretch text-sm">
              <button className="text-left px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" onClick={event => { setShowCalculator(value => !value); event.currentTarget.closest('details')?.removeAttribute('open'); }}>{showCalculator ? 'Hide calculator' : 'Calculator'}</button>
              <button className="text-left px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" onClick={event => { setShowLearningGoal(value => !value); event.currentTarget.closest('details')?.removeAttribute('open'); }}>{showLearningGoal ? 'Hide daily goal' : 'Daily learning goal'}</button>
              {messages.length > 0 && <><button disabled={isSummarizing} className="text-left px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40" onClick={event => { void handleSummarize(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>{isSummarizing ? 'Summarising…' : 'Summarise chat'}</button><button className="text-left px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" onClick={event => { handleExport(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>Export chat</button><button className="text-left px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" onClick={event => { void handleClearChat(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>Clear chat…</button></>}
            </div>
          </details>
        </div>
      </div>
      {showLearningGoal && <LearningMomentum momentum={momentum} busy={isTyping} subject={subject.name} onStart={(nextMode, prompt) => { setMode(nextMode); setInput(prompt); requestAnimationFrame(() => composerRef.current?.focus()); }} />}

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-10 mb-6 pr-2 scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10"
      >
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky top-0 z-10 bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center justify-between gap-4 mb-4"
          >
            <div className="flex items-center gap-3 text-red-500">
              <AlertCircle size={20} />
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

        {messages.length === 0 && !errorMessage && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-5 py-6">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-12 h-12 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center"
            >
              <Sparkles size={24} className="opacity-30" />
            </motion.div>
            
            <div className="space-y-2">
              <p className="text-2xl font-bold tracking-tight">What are you working on?</p>
              <p className="text-sm opacity-50 max-w-md mx-auto">
                Choose a starting point, then make the question your own.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 w-full max-w-2xl">
              {([
                { label: 'Make it click', description: 'Understand an idea', mode: 'teach', prompt: `Explain a key idea in ${subject.name} with a simple example. Then check my understanding.` },
                { label: 'Let me try', description: 'Practise one question', mode: 'revise', prompt: `Give me one practice question about ${subject.name}. Let me try before showing the answer.` },
                { label: 'Find the next step', description: 'Work through a problem', mode: 'solve', prompt: `Help me work through this ${subject.name} problem step by step: ` },
              ] as const).map(starter => <button key={starter.label} disabled={isTyping} onClick={() => { setMode(starter.mode); setInput(starter.prompt); requestAnimationFrame(() => composerRef.current?.focus()); }} className="text-left p-4 rounded-2xl border border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-40"><span className="block font-semibold text-sm">{starter.label} →</span><span className="block text-xs opacity-60 mt-1">{starter.description}</span></button>)}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <React.Fragment key={msg.id}>
            {idx > 0 && (
              <div className="w-full border-t border-black/5 dark:border-white/5 my-2" />
            )}
            <motion.div 
              initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "flex flex-col max-w-[85%] group relative",
              msg.role === 'user' ? "ml-auto items-end" : "items-start"
            )}
          >
            <div className={cn(
              "px-6 py-4 rounded-3xl text-sm leading-relaxed prose prose-sm max-w-none",
              msg.role === 'user' 
                ? "bg-black text-white prose-invert dark:bg-white dark:text-black dark:prose-slate rounded-tr-none" 
                : "bg-black/5 dark:bg-white/5 dark:prose-invert rounded-tl-none"
            )}>
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <>
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
                  {msg.images?.map((img: any, idx: number) => (
                    <div key={idx} className="mt-4 rounded-xl overflow-hidden border border-black/10 dark:border-white/10">
                      <img 
                         src={`data:${img.mimeType};base64,${img.data}`} 
                        alt="AI Manifestation" 
                        className="w-full object-cover aspect-square" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="p-2 bg-black/5 dark:bg-white/5 flex justify-end">
                        <button 
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = `data:${img.mimeType};base64,${img.data}`;
                            link.download = `eclipse-dt-${msg.id}-${idx}.png`;
                            link.click();
                          }}
                          className="p-1 px-3 bg-black text-white dark:bg-white dark:text-black rounded-lg text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform"
                        >
                          Download 1024x1024
                        </button>
                      </div>
                    </div>
                  ))}
                </>
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
          </React.Fragment>
        ))}

        {streamingMessage !== null && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col max-w-[85%] items-start"
          >
            <div className="px-6 py-4 rounded-3xl text-sm leading-relaxed bg-black/5 dark:bg-white/5 dark:prose-invert rounded-tl-none prose prose-sm max-w-none">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                }}
              >
                {streamingMessage || "..."}
              </ReactMarkdown>
            </div>
          </motion.div>
        )}

        {isTyping && streamingMessage === null && (
          <div className="flex items-center gap-2 px-6 py-4 bg-black/5 dark:bg-white/5 rounded-3xl rounded-tl-none w-20">
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-current" />
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-current" />
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-current" />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="relative mb-4">
        <AnimatePresence>
          {selectedImage && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-0 mb-4 p-2 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-black/10 dark:border-white/10 flex items-center gap-3 z-20"
            >
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-black/5">
                <img src={selectedImage.preview} alt="Upload preview" className="w-full h-full object-cover" />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="pr-4">
                <p className="text-xs font-bold truncate max-w-[120px]">{selectedImage.file.name}</p>
                <p className="text-[10px] opacity-50">{(selectedImage.file.size / 1024).toFixed(0)} KB</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <button 
            id="mic-button"
            onClick={startVoice}
            title="Voice Typing"
            className={cn(
              "p-2 md:p-2.5 rounded-xl transition-all border shadow-sm",
              isListening 
                ? "bg-red-500 text-white border-red-600 shadow-lg shadow-red-500/40 animate-pulse scale-110" 
                : "bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-neutral-500/20 dark:text-neutral-400 dark:border-neutral-500/30 hover:bg-neutral-100 dark:hover:bg-neutral-500/30"
            )}
          >
            <Mic size={20} className="md:w-[22px] md:h-[22px]" />
          </button>
        </div>
        
        <input
          ref={composerRef}
          aria-label="Your question for the tutor"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
          placeholder={isListening ? "Listening..." : `Ask a question...`}
          className="w-full pl-14 md:pl-16 pr-28 md:pr-36 py-4 md:py-5 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all text-sm md:text-base placeholder:opacity-40"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 md:gap-2">
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 md:p-2.5 bg-neutral-50 text-neutral-600 border border-neutral-200 dark:bg-neutral-500/20 dark:text-neutral-400 dark:border-neutral-500/30 hover:bg-neutral-100 dark:hover:bg-neutral-500/30 rounded-xl transition-all shadow-sm"
            title="Upload image"
          >
            <ImageIcon size={18} className="md:w-[20px] md:h-[20px]" />
          </button>
          
          <button 
            onClick={handleSend}
            aria-label="Send question"
            disabled={(!input.trim() && !selectedImage) || isTyping}
            className="p-2 md:p-2.5 bg-black text-white dark:bg-white dark:text-black rounded-xl disabled:opacity-30 transition-all hover:scale-105 active:scale-95 shadow-md"
          >
            <Send size={18} className="md:w-[20px] md:h-[20px]" />
          </button>
        </div>
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
                  className="px-6 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold text-sm hover:scale-105 transition-all"
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
