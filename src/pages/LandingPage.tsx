import React, { useState } from 'react';
import './landing.css';
import { ArrowUpRight, ArrowRight, BookOpen, Brain, Check, Sparkles, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  { icon: Brain, label: '01 / UNDERSTAND', title: 'Make it click.', text: 'Explore a topic in Teach mode. Break down the ideas, ask follow-up questions, and build your understanding.' },
  { icon: BookOpen, label: '02 / WORK THROUGH IT', title: 'Find your way forward.', text: 'Bring a question to Solve mode when you need help working through a problem.' },
  { icon: TrendingUp, label: '03 / KEEP GROWING', title: 'See how far you’ve come.', text: 'Keep your learning in view with subject-specific progress graphs and test score history.' },
];

const previews = [
  { subject: 'Maths', question: 'Why does ½ + ¼ equal ¾?', answer: 'Imagine a whole split into four equal pieces. One half takes up two of those pieces.', takeaway: '2 quarters + 1 quarter = 3 quarters', note: 'Same-sized pieces make fractions easier to add.' },
  { subject: 'Science', question: 'How do plants turn sunlight into food?', answer: 'Leaves capture light energy. The plant uses this energy to turn water and carbon dioxide into glucose, releasing oxygen.', takeaway: 'Light energy → stored chemical energy', note: 'This process is called photosynthesis.' },
  { subject: 'English', question: 'What makes a metaphor different from a simile?', answer: 'Both compare things. A simile uses “like” or “as”. A metaphor describes one thing as another to create an image.', takeaway: '“Her voice was music” is a metaphor.', note: '“Her voice was like music” is a simile.' },
];
export default function LandingPage() {
  const [previewIndex, setPreviewIndex] = useState(0);
  const preview = previews[previewIndex];
  return (
    <div className="eclipse-marketing">
      <section className="eclipse-hero">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase mb-7"><span className="w-2 h-2 rounded-full bg-neutral-500" /> Your next chapter starts here</p>
          <h1 className="text-5xl sm:text-7xl xl:text-8xl font-semibold tracking-[-0.065em] leading-[1.04]">Big questions.<br /><span className="eclipse-gradient-text">Brighter minds.</span></h1>
          <p className="text-lg sm:text-xl leading-relaxed text-neutral-600 dark:text-neutral-300 mt-7 max-w-lg">Turn “I’m stuck” into “I understand.” Your AI study companion for homework, revision, and the questions you haven’t asked yet.</p>
          <div className="flex flex-wrap gap-3 mt-9">
            <Link to="/auth" className="inline-flex items-center gap-5 rounded-full bg-neutral-600 text-white px-7 py-4 font-semibold hover:opacity-80 transition-opacity">Start learning free <ArrowUpRight size={19} /></Link>
            <a href="#plans" className="inline-flex items-center gap-3 rounded-full border border-black/15 dark:border-white/20 px-6 py-4 font-medium hover:bg-black/5 dark:hover:bg-white/5">Find your plan <ArrowRight size={17} /></a>
          </div>
          <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">15 free AI prompts every day. Upgrade when you’re ready.</p>
        </div>
        <div className="eclipse-demo">
          <div className="flex justify-between items-center mb-6 text-xs tracking-[0.16em] uppercase text-neutral-900 dark:text-neutral-200"><span>THE LIGHTBULB MOMENT</span><Sparkles size={18} /></div>
          <div role="group" aria-label="Choose a sample subject" className="eclipse-preview-tabs">{previews.map((sample, index) => <button key={sample.subject} aria-pressed={previewIndex === index} onClick={() => setPreviewIndex(index)}>{sample.subject}</button>)}</div>
          <div className="eclipse-preview-card rounded-2xl bg-white dark:bg-neutral-950 shadow-xl shadow-black/5 overflow-hidden lg:-rotate-2 border border-black/5 dark:border-white/10">
            <div className="flex justify-between items-center border-b border-black/5 dark:border-white/10 p-5"><span className="font-semibold tracking-tight">Eclipse <span className="text-neutral-500 font-normal">/ {preview.subject}</span></span><span className="text-xs bg-neutral-50 text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 px-3 py-1.5 rounded-full">Teach mode</span></div>
            <div aria-live="polite" className="p-5 sm:p-7 space-y-6">
              <div className="rounded-2xl rounded-tr-sm bg-neutral-100 dark:bg-neutral-900 p-4 ml-8 text-sm leading-relaxed">{preview.question}</div>
              <div><p className="text-xs font-semibold text-neutral-700 dark:text-neutral-400 mb-3 flex items-center gap-2"><Sparkles size={14} /> LET’S MAKE IT SIMPLE</p><p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{preview.answer}</p>
              {previewIndex === 0 && <div className="flex gap-2 my-5" aria-label="Three of four equal parts shaded">{[0, 1, 2, 3].map(i => <div key={i} className={`h-14 flex-1 rounded-lg ${i < 2 ? 'bg-neutral-700' : i === 2 ? 'bg-neutral-400' : 'bg-neutral-100 dark:bg-neutral-800'}`} />)}</div>}
              <p className="font-medium text-lg tracking-tight">{preview.takeaway}</p><p className="text-sm mt-3 text-neutral-500 dark:text-neutral-400">{preview.note}</p></div>
            </div>
            <div className="px-5 py-4 border-t border-black/5 dark:border-white/10 text-xs text-neutral-500">Illustrative examples, not a live AI conversation. <Link to="/auth" className="underline underline-offset-4">Try your own question →</Link></div>
          </div>
          <div className="flex items-center gap-2 mt-6 text-sm text-neutral-900 dark:text-neutral-200"><Check size={17} /> Understanding starts with a good question.</div>
        </div>
      </section>
      <section id="how-it-works" className="scroll-mt-24 border-t border-black/10 dark:border-white/10 py-16 sm:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-10"><h2 className="text-3xl sm:text-5xl font-semibold tracking-[-0.05em] max-w-lg">Your next breakthrough<br />starts here.</h2><p className="text-neutral-500 dark:text-neutral-400 max-w-xs leading-relaxed">A clearer path from “I don’t get it” to “I’ve got this.”</p></div>
        <div className="grid md:grid-cols-3 gap-4">{features.map(({icon: Icon, label, title, text}) => <article key={label} className="rounded-3xl border border-black/10 dark:border-white/10 p-7 sm:p-8"><Icon size={27} strokeWidth={1.5} className="mb-10 text-neutral-700 dark:text-neutral-400" /><p className="text-[10px] font-semibold tracking-[0.16em] text-neutral-500 dark:text-neutral-400 mb-3">{label}</p><h3 className="text-2xl font-semibold tracking-tight mb-3">{title}</h3><p className="text-sm leading-7 text-neutral-600 dark:text-neutral-300">{text}</p></article>)}</div>
      </section>
      <section id="plans" className="eclipse-pricing">
        <div className="eclipse-section-label">A PLAN FOR YOUR AMBITION</div>
        <h2>Start curious.<br /><span>Go further.</span></h2>
        <p className="eclipse-pricing-intro">Try Eclipse free. Choose more daily prompts when your study sessions need room to grow.</p>
        <div className="eclipse-price-grid">
          <article className="eclipse-price-card"><span className="eclipse-plan-kicker">EXPLORE AT YOUR PACE</span><h3>Free</h3><p>A little help, every day.</p><div className="eclipse-price">£0<span> / month</span></div><ul><li><Check size={17} />15 AI prompts each day</li><li><Check size={17} />Access to all subjects</li><li><Check size={17} />Basic progress tracking</li></ul><Link to="/auth" className="eclipse-plan-link">Start free <ArrowUpRight size={18} /></Link></article>
          <article className="eclipse-price-card"><span className="eclipse-plan-kicker">BUILD A STUDY HABIT</span><h3>Serious</h3><p>More room for follow-up questions.</p><div className="eclipse-price">£15<span> / month</span></div><ul><li><Check size={17} />40 AI prompts each day</li><li><Check size={17} />Access to all subjects</li><li><Check size={17} />Basic progress tracking</li></ul><Link to="/subscription" className="eclipse-plan-link">Explore Serious <ArrowUpRight size={18} /></Link></article>
          <article className="eclipse-price-card eclipse-price-featured"><div className="eclipse-recommended">FOR DEEPER STUDY SESSIONS</div><span className="eclipse-plan-kicker">MAKE SPACE FOR MORE</span><h3>Premium</h3><p>Keep asking. Keep connecting the dots.</p><div className="eclipse-price">£40<span> / month</span></div><ul><li><Check size={17} />500 AI prompts each day</li><li><Check size={17} />Advanced analytics & diagnostics</li><li><Check size={17} />Priority support</li></ul><Link to="/subscription" className="eclipse-plan-link">Explore Premium <ArrowUpRight size={18} /></Link></article>
        </div>
        <p className="eclipse-price-note">Monthly subscription prices. Review the full plan details and payment terms before subscribing. <Link to="/subscription">Compare all plans →</Link></p>
      </section>
      <p className="py-6 text-sm text-neutral-600 dark:text-neutral-300">Want to see a worked example first? <a className="underline underline-offset-4" href="/homework-help.html">Read our free maths, science and English guide →</a></p>
      <section className="eclipse-faq"><div><div className="eclipse-section-label">GOOD QUESTIONS</div><h2>A little clarity<br />before you start.</h2></div><div>
        <details><summary>Can I try Eclipse before paying?</summary><p>Yes. The free plan includes 15 AI prompts per day and access to all subjects. Create an account to start exploring.</p></details>
        <details><summary>Which paid plan should I choose?</summary><p>Serious offers 40 prompts per day for £15 per month. Premium offers 500 prompts per day for £40 per month, with advanced analytics and priority support. Choose the daily allowance that fits how you study.</p></details>
        <details><summary>Does Eclipse replace my teacher?</summary><p>Eclipse is a study companion. Use it to explore explanations and practise alongside your lessons. AI can make mistakes, so check important answers with your course materials or teacher.</p></details>
      </div></section>
    </div>
  );
}
