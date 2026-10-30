import React, { useState } from 'react';
import { ArrowUpRight, ArrowRight, BookOpen, Brain, Check, Sparkles, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import './landing.css';

const features = [
  { icon: Brain, label: '01 / UNDERSTAND', title: 'Make the idea click.', text: 'Break a topic into smaller steps. Explore an explanation, then ask the follow-up question that helps it make sense.' },
  { icon: BookOpen, label: '02 / PRACTISE', title: 'Work through it.', text: 'Bring a tricky question to Solve mode, or practise what you have learned during revision.' },
  { icon: TrendingUp, label: '03 / REFLECT', title: 'See your progress.', text: 'Review subject progress and test score history to keep your next study session in focus.' },
];

const previews = [
  { subject: 'Maths', question: 'Why does ½ + ¼ equal ¾?', answer: 'Imagine a whole split into four equal pieces. One half takes up two of those pieces. Add one more quarter and you have three.', takeaway: '2 quarters + 1 quarter = 3 quarters', note: 'Same-sized pieces make fractions easier to add.' },
  { subject: 'Science', question: 'How do plants turn sunlight into food?', answer: 'Leaves capture light energy. The plant uses this energy to turn water and carbon dioxide into glucose, releasing oxygen.', takeaway: 'Light energy → stored chemical energy', note: 'This process is called photosynthesis.' },
  { subject: 'English', question: 'What makes a metaphor different from a simile?', answer: 'Both compare things. A simile makes the comparison explicit, often using “like” or “as”. A metaphor describes one thing as another.', takeaway: '“Her voice was music” is a metaphor.', note: '“Her voice was like music” is a simile.' },
];

const plans = [
  { name: 'Free', kicker: 'GET TO KNOW ECLIPSE', description: 'For a little help, every day.', price: '0', features: ['15 AI prompts each day', 'Access to all subjects', 'Basic progress tracking'], action: 'Start learning free', href: '/auth', featured: false },
  { name: 'Serious', kicker: 'MORE ROOM TO EXPLORE', description: 'For questions that lead to more questions.', price: '15', features: ['40 AI prompts each day', 'Access to all subjects', 'Basic progress tracking'], action: 'Explore Serious', href: '/subscription', featured: false },
  { name: 'Premium', kicker: 'GO DEEPER', description: 'For longer, more focused study sessions.', price: '40', features: ['500 AI prompts each day', 'Advanced analytics & diagnostics', 'Priority support'], action: 'Explore Premium', href: '/subscription', featured: true },
];

export default function LandingPage() {
  const [previewIndex, setPreviewIndex] = useState(0);
  const preview = previews[previewIndex];

  return (
    <div className="eclipse-marketing">
      <nav aria-label="Eclipse resources" style={{display:'flex',justifyContent:'flex-end',gap:20,fontSize:12,paddingBottom:16}}><a href="/about-eclipse.html">About Eclipse</a><a href="/homework-help.html">Homework help guide</a></nav>
      <section className="eclipse-hero" aria-labelledby="eclipse-hero-title">
        <div className="eclipse-hero-copy">
          <p className="eclipse-eyebrow"><span aria-hidden="true" /> ECLIPSE · YOUR AI STUDY COMPANION</p>
          <h1 id="eclipse-hero-title">Homework help.<br /><span>That makes sense.</span></h1>
          <p className="eclipse-hero-intro">A tricky question doesn’t have to end your study session. Explore clear explanations, work through problems and practise with Eclipse.</p>
          <div className="eclipse-hero-actions">
            <Link to="/auth" className="eclipse-primary-action">Start learning free <ArrowUpRight size={19} aria-hidden="true" /></Link>
            <a href="#eclipse-example" className="eclipse-secondary-action">See an example <ArrowRight size={17} aria-hidden="true" /></a>
          </div>
          <p className="eclipse-hero-note"><Check size={15} aria-hidden="true" /> 15 free AI prompts every day. Upgrade when you’re ready.</p>
        </div>
        <div id="eclipse-example" className="eclipse-demo">
          <div className="eclipse-demo-heading"><span>ONE QUESTION. A CLEARER START.</span><Sparkles size={17} aria-hidden="true" /></div>
          <div role="group" aria-label="Choose a sample subject" className="eclipse-preview-tabs">
            {previews.map((sample, index) => <button key={sample.subject} type="button" aria-pressed={previewIndex === index} onClick={() => setPreviewIndex(index)}>{sample.subject}</button>)}
          </div>
          <div className="eclipse-preview-card">
            <div className="eclipse-preview-header"><span>Eclipse <span>/ {preview.subject}</span></span><span className="eclipse-preview-mode">Example</span></div>
            <div className="eclipse-preview-body" aria-live="polite" aria-atomic="true">
              <p className="eclipse-preview-question">{preview.question}</p>
              <div className="eclipse-preview-answer">
                <p className="eclipse-preview-label"><Sparkles size={14} aria-hidden="true" /> LET’S MAKE IT SIMPLE</p>
                <p>{preview.answer}</p>
                {previewIndex === 0 && <div className="eclipse-fraction" role="img" aria-label="Three of four equal parts shaded">{[0, 1, 2, 3].map(i => <span key={i} className={i < 2 ? 'is-half' : i === 2 ? 'is-quarter' : ''} />)}</div>}
                <p className="eclipse-preview-takeaway">{preview.takeaway}</p>
                <p className="eclipse-preview-note">{preview.note}</p>
              </div>
            </div>
            <p className="eclipse-preview-disclosure">Illustrative example, not a live AI response. <Link to="/auth">Ask your own question ↗</Link></p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="eclipse-benefits" aria-labelledby="eclipse-benefits-title">
        <div className="eclipse-section-heading"><div><p className="eclipse-eyebrow">A LITTLE CLARITY GOES A LONG WAY</p><h2 id="eclipse-benefits-title">A better place to start.</h2></div><p>From the first question to your next practice session.</p></div>
        <div className="eclipse-feature-grid">{features.map(({ icon: Icon, label, title, text }) => <article key={label}><Icon size={25} strokeWidth={1.5} aria-hidden="true" /><p className="eclipse-feature-label">{label}</p><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section id="plans" className="eclipse-pricing" aria-labelledby="eclipse-plans-title">
        <p className="eclipse-eyebrow">CHOOSE YOUR DAILY ALLOWANCE</p><h2 id="eclipse-plans-title">Start free.<br /><span>Make room for more.</span></h2>
        <p className="eclipse-pricing-intro">Try Eclipse at your pace. Choose a paid plan when you need more room for questions and follow-ups.</p>
        <div className="eclipse-price-grid">{plans.map(plan => <article key={plan.name} className={`eclipse-price-card${plan.featured ? ' eclipse-price-featured' : ''}`}>
          <div className="eclipse-plan-top"><span className="eclipse-plan-kicker">{plan.kicker}</span>{plan.featured && <span className="eclipse-plan-badge">For deeper study</span>}</div>
          <h3>{plan.name}</h3><p className="eclipse-plan-description">{plan.description}</p><p className="eclipse-price">£{plan.price}<span> / month</span></p>
          <ul>{plan.features.map(feature => <li key={feature}><Check size={17} aria-hidden="true" />{feature}</li>)}</ul>
          <Link to={plan.href} className="eclipse-plan-link">{plan.action}<ArrowUpRight size={18} aria-hidden="true" /></Link>
        </article>)}</div>
        <p className="eclipse-price-note">Paid plans are monthly subscriptions. Review full plan details and payment terms before subscribing. <Link to="/subscription">Compare all plans ↗</Link></p>
      </section>

      <section className="eclipse-guide" aria-labelledby="eclipse-guide-title"><div><p className="eclipse-eyebrow">A SMALL FIRST STEP</p><h2 id="eclipse-guide-title">Try a worked example.</h2><p>Maths, science and English. Free to read, with no account needed.</p></div><a href="/homework-help.html">Open the free guide <ArrowUpRight size={19} aria-hidden="true" /></a></section>

      <section className="eclipse-faq" aria-labelledby="eclipse-faq-title"><div><p className="eclipse-eyebrow">GOOD QUESTIONS</p><h2 id="eclipse-faq-title">Before you begin.</h2></div><div>
        <details><summary>Can I try Eclipse before paying?</summary><p>Yes. Create an account to use the free plan, which includes 15 AI prompts per day and access to all subjects. Paid plans are optional.</p></details>
        <details><summary>Which paid plan should I choose?</summary><p>Serious offers 40 prompts per day for £15 per month. Premium offers 500 prompts per day for £40 per month, with advanced analytics and priority support. Choose the daily allowance that fits how you study.</p></details>
        <details><summary>Does Eclipse replace my teacher?</summary><p>Eclipse is a study companion. Use it to explore explanations and practise alongside your lessons. AI can make mistakes, so check important answers with your course materials or teacher.</p></details>
      </div></section>
    </div>
  );
}
