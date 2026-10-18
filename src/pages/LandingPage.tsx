import React from 'react';
import { ArrowUpRight, ArrowRight, BookOpen, Brain, Check, Sparkles, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  { icon: Brain, label: '01 / UNDERSTAND', title: 'Make it click.', text: 'Explore a topic in Teach mode. Break down the ideas, ask follow-up questions, and build your understanding.' },
  { icon: BookOpen, label: '02 / WORK THROUGH IT', title: 'Find your way forward.', text: 'Bring a question to Solve mode when you need help working through a problem.' },
  { icon: TrendingUp, label: '03 / KEEP GROWING', title: 'See how far you’ve come.', text: 'Keep your learning in view with subject-specific progress graphs and test score history.' },
];

export default function LandingPage() {
  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 pb-16">
      <section className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center py-16 sm:py-24">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase mb-7"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Illuminating education</p>
          <h1 className="text-5xl sm:text-7xl xl:text-8xl font-semibold tracking-[-0.065em] leading-[1.04]">Less stuck.<br />More <span className="text-emerald-700 dark:text-emerald-400">lightbulb</span><br />moments.</h1>
          <p className="text-lg sm:text-xl leading-relaxed text-neutral-600 dark:text-neutral-300 mt-7 max-w-lg">Meet Eclipse, your personal AI tutor. Work through tricky questions, understand the ideas behind them, and keep your learning moving.</p>
          <div className="flex flex-wrap gap-3 mt-9">
            <Link to="/auth" className="inline-flex items-center gap-5 rounded-full bg-black text-white dark:bg-white dark:text-black px-7 py-4 font-semibold hover:opacity-80 transition-opacity">Start learning <ArrowUpRight size={19} /></Link>
            <a href="#how-it-works" className="inline-flex items-center gap-3 rounded-full border border-black/15 dark:border-white/20 px-6 py-4 font-medium hover:bg-black/5 dark:hover:bg-white/5">Explore Eclipse <ArrowRight size={17} /></a>
          </div>
          <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">From Year 1 to university. At your pace.</p>
        </div>
        <div className="relative rounded-[2rem] bg-[#edf2ee] dark:bg-[#17231e] p-5 sm:p-9 lg:rotate-2">
          <div className="flex justify-between items-center mb-6 text-xs tracking-[0.16em] uppercase text-emerald-900 dark:text-emerald-200"><span>A little clarity goes a long way</span><Sparkles size={18} /></div>
          <div className="rounded-2xl bg-white dark:bg-neutral-950 shadow-xl shadow-black/5 overflow-hidden lg:-rotate-2 border border-black/5 dark:border-white/10">
            <div className="flex justify-between items-center border-b border-black/5 dark:border-white/10 p-5"><span className="font-semibold tracking-tight">Eclipse <span className="text-neutral-500 font-normal">/ Maths</span></span><span className="text-xs bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 px-3 py-1.5 rounded-full">Teach mode</span></div>
            <div className="p-5 sm:p-7 space-y-6">
              <div className="rounded-2xl rounded-tr-sm bg-neutral-100 dark:bg-neutral-900 p-4 ml-8 text-sm leading-relaxed">Why does ½ + ¼ equal ¾?</div>
              <div><p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2"><Sparkles size={14} /> LET’S MAKE IT SIMPLE</p><p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">Imagine a whole split into four equal pieces. One half takes up two of those pieces.</p>
              <div className="flex gap-2 my-5" aria-label="Three of four equal parts shaded">{[0, 1, 2, 3].map(i => <div key={i} className={`h-14 flex-1 rounded-lg ${i < 2 ? 'bg-emerald-700' : i === 2 ? 'bg-emerald-400' : 'bg-neutral-100 dark:bg-neutral-800'}`} />)}</div>
              <p className="font-medium text-lg tracking-tight">2 quarters + 1 quarter = 3 quarters</p><p className="text-sm mt-3 text-neutral-500 dark:text-neutral-400">Same-sized pieces make fractions easier to add.</p></div>
            </div>
            <div className="px-5 py-4 border-t border-black/5 dark:border-white/10 text-xs text-neutral-500">Illustrative example of learning with Eclipse</div>
          </div>
          <div className="flex items-center gap-2 mt-6 text-sm text-emerald-900 dark:text-emerald-200"><Check size={17} /> Understanding starts with a good question.</div>
        </div>
      </section>
      <section id="how-it-works" className="scroll-mt-24 border-t border-black/10 dark:border-white/10 py-16 sm:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-10"><h2 className="text-3xl sm:text-5xl font-semibold tracking-[-0.05em] max-w-lg">Your next breakthrough<br />starts here.</h2><p className="text-neutral-500 dark:text-neutral-400 max-w-xs leading-relaxed">A clearer path from “I don’t get it” to “I’ve got this.”</p></div>
        <div className="grid md:grid-cols-3 gap-4">{features.map(({icon: Icon, label, title, text}) => <article key={label} className="rounded-3xl border border-black/10 dark:border-white/10 p-7 sm:p-8"><Icon size={27} strokeWidth={1.5} className="mb-10 text-emerald-700 dark:text-emerald-400" /><p className="text-[10px] font-semibold tracking-[0.16em] text-neutral-500 dark:text-neutral-400 mb-3">{label}</p><h3 className="text-2xl font-semibold tracking-tight mb-3">{title}</h3><p className="text-sm leading-7 text-neutral-600 dark:text-neutral-300">{text}</p></article>)}</div>
      </section>
      <section className="rounded-3xl bg-[#edf2ee] dark:bg-[#17231e] p-7 sm:p-12 flex flex-col md:flex-row justify-between md:items-center gap-7 mb-16"><div><p className="text-xs font-semibold tracking-[0.16em] uppercase text-emerald-700 dark:text-emerald-400 mb-3">For educators</p><h2 className="text-3xl font-semibold tracking-tight mb-3">Support the way they learn.</h2><p className="text-neutral-600 dark:text-neutral-300 max-w-lg leading-relaxed">Discover the dedicated teacher portal and explore Eclipse for your classroom.</p></div><a href="/teacher" className="inline-flex items-center gap-4 font-semibold rounded-full bg-white text-black px-6 py-4 self-start md:self-auto whitespace-nowrap">Explore teacher portal <ArrowUpRight size={18} /></a></section>
      <section className="text-center rounded-[2rem] bg-neutral-950 text-white px-6 py-16 sm:py-20"><Sparkles className="mx-auto mb-6 text-emerald-300" size={28} /><h2 className="text-4xl sm:text-6xl font-semibold tracking-[-0.05em]">Bring your curiosity.<br />Find your clarity.</h2><p className="text-neutral-400 mt-5 mb-8">One question can be the start of something good.</p><Link to="/auth" className="inline-flex items-center gap-5 rounded-full bg-white text-black px-7 py-4 font-semibold hover:bg-emerald-100 transition-colors">Get started with Eclipse <ArrowUpRight size={18} /></Link></section>
    </div>
  );
}
