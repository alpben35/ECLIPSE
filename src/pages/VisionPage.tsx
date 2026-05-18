import React, { useState, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Download, Share2, Trash2, Loader2, 
  ChevronRight, Layout, Image as ImageIcon, Wand2,
  RefreshCw, Info, AlertCircle, Save
} from 'lucide-react';
import { AuthContext, ThemeContext } from '../lib/contexts';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  createdAt: string;
}

import { generateImage } from '../lib/gemini';

export default function VisionPage() {
  const { user, profile, addXp } = useContext(AuthContext);
  const { isDark } = useContext(ThemeContext);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3'>('1:1');
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating || !user || !profile) return;

    // Check limits for non-admins
    if (!profile.isAdmin) {
      // Image limit (5 per day for free users)
      if (profile.tier === 'free' && (profile.imagesToday || 0) >= 5) {
        setError("You've reached your daily limit of 5 visual manifests. Visionaries need rest.");
        window.dispatchEvent(new CustomEvent('prompt-limit-reached', { 
          detail: { limit: 5, tier: 'free', message: 'Daily Image Limit Reached' } 
        }));
        return;
      }

      // Prompt cost (4 prompts per image)
      const PROMPT_LIMITS = { free: 20, premium: 100, admin: Infinity };
      const maxPrompts = PROMPT_LIMITS[profile.tier as keyof typeof PROMPT_LIMITS] || 20;
      if ((profile.promptsToday || 0) + 4 > maxPrompts) {
        setError("Your cognitive buffers are full. Upgrade for deeper creation.");
        window.dispatchEvent(new CustomEvent('prompt-limit-reached', { 
          detail: { limit: maxPrompts, tier: profile.tier } 
        }));
        return;
      }
    }

    setIsGenerating(true);
    setError(null);

    try {
      const imageData = await generateImage(prompt, aspectRatio);
      const imageUrl = `data:${imageData.mimeType};base64,${imageData.data}`;
      
      const newImg: GeneratedImage = {
        id: Math.random().toString(36).substring(7),
        url: imageUrl,
        prompt: prompt,
        createdAt: new Date().toISOString()
      };

      // Update counters in Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        promptsToday: increment(4),
        imagesToday: increment(1)
      });

      setGeneratedImages(prev => [newImg, ...prev]);
      setCurrentImage(newImg);
      setPrompt('');
      addXp(50); // High XP for creation

      // Save to cloud
      await addDoc(collection(db, 'users', user.uid, 'creations'), {
        type: 'image',
        url: imageUrl,
        prompt: prompt,
        aspectRatio,
        timestamp: serverTimestamp()
      });

    } catch (err: any) {
      console.error("Image Gen Error:", err);
      setError(err.message || "Failed to manifest your vision.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = (img: GeneratedImage) => {
    const link = document.createElement('a');
    link.href = img.url;
    link.download = `eclipse-dt-${img.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      <div className="flex flex-col items-center text-center space-y-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-16 h-16 rounded-[2rem] bg-black/5 dark:bg-white/5 flex items-center justify-center border border-black/10 dark:border-white/10"
        >
          <Wand2 className="text-black dark:text-white" size={32} />
        </motion.div>
        <h1 className="text-6xl font-black tracking-tighter italic uppercase">
          ECLIPSE <span className="opacity-40">VISION</span>
        </h1>
        <p className="opacity-70 max-w-xl mx-auto text-lg leading-relaxed font-medium text-zinc-600 dark:text-zinc-300">
          The Creative Generation Engine. Manifest visual concepts from pure thought using high-frequency diffusion.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 items-start">
        {/* Creation Forge */}
        <div className="space-y-8">
          <div className="bg-black/5 dark:bg-white/5 p-8 rounded-[3rem] border border-black/5 dark:border-white/5 space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60 dark:text-white/40 ml-4">
                Vision Prompt
              </label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A futuristic library floating in a nebula, cinematic lighting, 8k resolution, minimalist architectural style..."
                rows={4}
                className="w-full px-8 py-6 bg-white dark:bg-black text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 rounded-[2rem] focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 resize-none transition-all text-lg font-medium shadow-inner"
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60 dark:text-white/40 ml-4">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-4 gap-3">
                {(['1:1', '16:9', '9:16', '4:3'] as const).map((ratio) => (
                  <button 
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={cn(
                      "py-3 rounded-2xl text-xs font-bold transition-all border",
                      aspectRatio === ratio
                        ? "bg-black text-white dark:bg-white dark:text-black border-transparent shadow-lg"
                        : "bg-white dark:bg-black/20 border-black/10 dark:border-white/10 opacity-50 hover:opacity-100"
                    )}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500"
              >
                <AlertCircle size={20} />
                <p className="text-sm font-bold uppercase tracking-widest">{error}</p>
              </motion.div>
            )}

            <button 
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-6 bg-black text-white dark:bg-white dark:text-black rounded-[2rem] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-black/20 dark:shadow-white/10 disabled:opacity-30 group"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  Manifesting...
                </>
              ) : (
                <>
                  <Sparkles size={24} className="group-hover:animate-pulse" />
                  Initiate Forge
                  <ChevronRight size={24} />
                </>
              )}
            </button>
          </div>

          <div className="px-8 flex items-center gap-4 opacity-60 text-zinc-600 dark:text-zinc-400">
            <Info size={16} />
            <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
              Eclipse Vision uses Gemini 2.5 Flash Image. Generations consume 4 Sparks. 
              Free users limited to 5 manifests per day.
            </p>
          </div>
        </div>

        {/* Output Viewport */}
        <div className="space-y-8">
          <AnimatePresence mode="wait">
            {currentImage ? (
              <motion.div 
                key={currentImage.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative group rounded-[3rem] overflow-hidden border-4 border-black/10 dark:border-white/10 bg-black/5 aspect-square flex items-center justify-center"
                style={{ aspectRatio: aspectRatio.replace(':', '/') }}
              >
                <img 
                  src={currentImage.url} 
                  alt={currentImage.prompt} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-8 space-y-4">
                  <p className="text-white text-sm font-medium line-clamp-3 leading-relaxed">
                    {currentImage.prompt}
                  </p>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => downloadImage(currentImage)}
                      className="p-4 bg-white text-black rounded-2xl hover:scale-110 transition-transform shadow-xl"
                      title="Download"
                    >
                      <Download size={20} />
                    </button>
                    <button 
                      className="p-4 bg-white text-black rounded-2xl hover:scale-110 transition-transform shadow-xl"
                      title="Share"
                    >
                      <Share2 size={20} />
                    </button>
                    <button 
                      onClick={() => {
                        setGeneratedImages(prev => prev.filter(img => img.id !== currentImage.id));
                        setCurrentImage(null);
                      }}
                      className="p-4 bg-red-500 text-white rounded-2xl hover:scale-110 transition-transform shadow-xl ml-auto"
                      title="Delete"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="aspect-square rounded-[3rem] border-2 border-dashed border-black/10 dark:border-white/10 flex flex-col items-center justify-center text-center p-12 gap-6 opacity-40">
                <div className="w-20 h-20 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center">
                  <ImageIcon size={40} />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-bold italic uppercase tracking-tighter">Viewport Idle</p>
                  <p className="text-xs font-medium max-w-[200px]">Enter a prompt to manifest your first visual creation.</p>
                </div>
              </div>
            )}
          </AnimatePresence>

          {generatedImages.length > 1 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-40 ml-4">
                Manifested Gallery
              </h3>
              <div className="grid grid-cols-4 gap-4">
                {generatedImages.map((img) => (
                  <button 
                    key={img.id}
                    onClick={() => setCurrentImage(img)}
                    className={cn(
                      "aspect-square rounded-2xl overflow-hidden border-2 transition-all hover:scale-105",
                      currentImage?.id === img.id 
                        ? "border-black dark:border-white scale-105 shadow-xl" 
                        : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
