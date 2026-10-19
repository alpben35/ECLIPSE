import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ArrowRight, Sparkles, X } from 'lucide-react';
import { completedSteps, freshMomentum, recordLearning, reflectOnLearning, restoreMomentum, type LearningMode, type Momentum } from '../lib/learningMomentum';

export function useLearningMomentum(userId?: string) {
  const key = userId ? `eclipse:learning-goal:v1:${userId}` : null;
  const current = useRef<{ key: string | null; value: Momentum }>({ key: null, value: freshMomentum() });
  const [state, setState] = useState<Momentum>(freshMomentum());
  const [hidden, setHidden] = useState(false);
  const read = useCallback(() => {
    const fallback = current.current.key === key ? current.current.value : freshMomentum();
    try {
      const raw = key ? localStorage.getItem(key) : null;
      return restoreMomentum(raw ? JSON.parse(raw) : fallback);
    } catch { return restoreMomentum(fallback); }
  }, [key]);
  const refresh = useCallback(() => {
    const value = read();
    current.current = { key, value };
    setState(value);
  }, [key, read]);
  useEffect(() => {
    refresh();
    try { setHidden(!!key && localStorage.getItem(`${key}:hidden`) === 'true'); } catch { setHidden(false); }
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh); };
  }, [key, refresh]);
  const save = useCallback((value: Momentum) => {
    current.current = { key, value };
    setState(value);
    try { if (key) localStorage.setItem(key, JSON.stringify(value)); } catch { /* Session progress still works if storage is unavailable. */ }
  }, [key]);
  const recordSuccess = useCallback((mode: LearningMode, response: string, attemptedPractice: boolean) => {
    if (key) save(recordLearning(read(), mode, response, attemptedPractice));
  }, [key, read, save]);
  const reflect = (text: string) => save(reflectOnLearning(read(), text));
  const toggleHidden = () => {
    const value = !hidden;
    setHidden(value);
    try { if (key) localStorage.setItem(`${key}:hidden`, String(value)); } catch { /* Optional preference. */ }
  };
  return { scope: key, state: current.current.key === key ? restoreMomentum(state) : freshMomentum(), hidden, toggleHidden, recordSuccess, reflect };
}

type Props = { momentum: ReturnType<typeof useLearningMomentum>; busy: boolean; subject: string; onStart: (mode: LearningMode, prompt: string) => void };
export default function LearningMomentum({ momentum, busy, subject, onStart }: Props) {
  const { state, hidden, toggleHidden, reflect } = momentum;
  const [reflection, setReflection] = useState('');
  useEffect(() => setReflection(''), [state.day, momentum.scope]);
  const count = completedSteps(state);
  const done = count === 3;
  if (hidden) return <button onClick={toggleHidden} className="self-start mb-3 text-xs underline underline-offset-4 opacity-70">Show optional daily goal</button>;
  return <section aria-label="Optional daily learning goal" className="shrink-0 mb-5 rounded-2xl border border-black/10 dark:border-white/15 bg-black/[0.025] dark:bg-white/[0.04] p-4 sm:p-5">
    <div className="flex items-start justify-between gap-4">
      <div><div className="flex items-center gap-2"><Sparkles size={16} /><span className="font-semibold text-sm">{done ? 'A little progress. A real achievement.' : 'One idea. Three small steps.'}</span></div><p className="text-xs opacity-70 mt-1">{done ? 'Today’s goal is complete. Take a break or continue at your own pace.' : 'An optional learning goal. Explore, try your own answer in Revise, then reflect.'}</p></div>
      <button onClick={toggleHidden} aria-label="Hide daily learning goal" className="p-1 opacity-60 hover:opacity-100"><X size={15} /></button>
    </div>
    <div role="progressbar" aria-label="Daily learning steps" aria-valuemin={0} aria-valuemax={3} aria-valuenow={count} aria-valuetext={`${count} of 3 steps complete`} className="flex gap-1.5 my-3">{[1,2,3].map(step => <span key={step} className={`h-1.5 flex-1 rounded-full transition-colors ${count >= step ? 'bg-black dark:bg-white' : 'bg-black/10 dark:bg-white/10'}`} />)}</div>
    <ol className="flex flex-wrap gap-x-5 gap-y-2 text-xs mb-3">{[['Explore', state.explored], ['Practise', state.practised], ['Reflect', state.reflected]].map(([label, complete]) => <li key={String(label)} className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full border border-current inline-flex justify-center items-center">{complete ? <Check size={11} /> : <span className="w-1 h-1 rounded-full bg-current opacity-30" />}</span>{String(label)}{complete && <span className="sr-only"> complete</span>}</li>)}</ol>
    {!done && !state.practised && <button disabled={busy} onClick={() => onStart(state.explored ? 'revise' : 'teach', state.explored ? `Give me one practice question about ${subject}. Let me try before showing the answer.` : `Help me understand one key idea in ${subject}. Explain it, then ask me a question to check my understanding.`)} className="flex items-center gap-2 text-xs font-semibold underline underline-offset-4 disabled:opacity-40">{state.explored ? 'Try a practice question' : 'Explore an idea'}<ArrowRight size={13} /></button>}
    {!done && state.practised && <div><label htmlFor="daily-reflection" className="block mb-2 text-xs">In your own words, what did you learn? (Self-check, not graded.)</label><textarea id="daily-reflection" rows={2} maxLength={500} value={reflection} onChange={event => setReflection(event.target.value)} placeholder="One thing I understand better is…" className="w-full p-3 text-sm bg-white dark:bg-black border border-black/15 dark:border-white/20 rounded-xl" /><div className="flex flex-wrap items-center justify-between gap-2 mt-2"><span className="text-xs opacity-60">At least 20 characters. Your reflection is not saved or sent.</span><button disabled={reflection.trim().length < 20} onClick={() => { reflect(reflection); setReflection(''); }} className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black text-xs disabled:opacity-35">Complete today’s goal</button></div></div>}
    <p role="status" aria-live="polite" className="text-xs mt-2 opacity-70">{done ? '✓ 3 of 3 steps complete. Well done for showing up.' : `${count} of 3 steps complete. Progress is saved on this browser.`}</p>
  </section>;
}
