import { useState } from 'react';
import './study-companion.css';

type Props = { variant?: 'eclipse' | 'dionysus' };
export default function StudyCompanion({ variant = 'eclipse' }: Props) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(0);
  const [paused, setPaused] = useState(false);
  const food = variant === 'dionysus';
  const tutor = typeof window !== 'undefined' && window.location.pathname.includes('/tutor');
  const tips = food ? [
    'Looking for a dish? Search the sample menu, then narrow it down by category.',
    'Your bag keeps your choices together. You can change quantities before trying a demo order.',
    'This is a prototype. Menus and ratings are samples, and no payment or delivery takes place.',
  ] : [
    'Stuck on a question? In Teach mode, ask for a hint and work through one step at a time.',
    'Keep your full name, school, address and contact details out of questions and uploads.',
    'AI can make mistakes. Check important answers with your teacher or a trusted source.',
    'Try explaining the idea in your own words, then ask Eclipse for a practice question.',
  ];
  const label = food ? 'Kitchen tips' : 'Study tips';
  return <aside className={`study-companion ${food ? 'companion-food' : ''} ${paused ? 'companion-paused' : ''} ${tutor ? 'companion-tutor' : ''}`} aria-label={label}>
    {open && <section id={`companion-${variant}-tips`} className="companion-bubble" aria-label={label}>
      <header><strong>{label}</strong><button type="button" onClick={() => setOpen(false)} aria-label="Close tips">×</button></header>
      <p>{tips[tip]}</p>
      <footer><span>Interface guidance</span><button type="button" onClick={() => setTip((tip + 1) % tips.length)}>Next tip →</button></footer>
      <button className="companion-motion" type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? 'Enable animation' : 'Pause animation'}</button>
    </section>}
    <button type="button" className="companion-toggle" aria-label={open ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-expanded={open} aria-controls={`companion-${variant}-tips`} onClick={() => setOpen(!open)}>
      <span className="companion-robot" aria-hidden="true"><span className="companion-aerial"/><span className="companion-ear left"/><span className="companion-head"><span className="companion-face"><i/><i/></span></span><span className="companion-ear right"/><span className="companion-body"/><span className="companion-hand"/></span>
    </button>
  </aside>;
}
