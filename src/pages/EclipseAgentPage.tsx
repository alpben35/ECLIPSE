import React, {useContext, useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {Bot, ArrowUp, LoaderCircle} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {AuthContext} from '../lib/contexts';
import './eclipse-agent.css';

type Message = {role:'user'|'model';text:string};
const choices = [
  {id:'explain', label:'Make it click', hint:'Explain a tricky concept', prompt:'Help me understand this concept: '},
  {id:'practice', label:'Let me try', hint:'Practise with feedback', prompt:'Give me a practice question about '},
  {id:'plan', label:'Find my focus', hint:'Build a realistic study plan', prompt:'Help me make a revision plan. My subjects and deadlines are: '},
  {id:'draft', label:'Shape an idea', hint:'Turn notes into a first draft', prompt:'Help me organise these notes into a draft: '},
];
export default function EclipseAgentPage() {
  const {user} = useContext(AuthContext);
  const [status,setStatus] = useState<{enabled:boolean;remaining?:number;limit?:number}|null>(null);
  const [error,setError] = useState('');
  const [mode,setMode] = useState('explain');
  const [prompt,setPrompt] = useState('');
  const [messages,setMessages] = useState<Message[]>([]);
  const [busy,setBusy] = useState(false);
  const [remember,setRemember] = useState(false);
  const [memoryNotice,setMemoryNotice] = useState('');
  const pending = useRef(false);
  const epoch = useRef(0);
  const composer = useRef<HTMLTextAreaElement>(null);
  async function request(body?:unknown, memoryRead=false) {
    const token = await user?.getIdToken();
    if (!token) throw Error('Please sign in again.');
    const res = await fetch('/api/eclipse-agent'+(memoryRead?'?memory=1':''),{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(65000)});
    if (!res.headers.get('content-type')?.includes('application/json')) throw Error('Eclipse Agent is awaiting deployment.');
    const data = await res.json();
    if (!res.ok) throw Error(data.error || 'The agent is unavailable.');
    return data;
  }
  useEffect(()=>{
    let active=true;
    epoch.current++;
    setMessages([]); setPrompt(''); setStatus(null); setError(''); setRemember(false);setMemoryNotice('');
    request().then(data=>{if(active){setStatus(data);if(!data.enabled)setError(data.error);}}).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;epoch.current++;};
  },[user?.uid]);
  async function send(e:React.FormEvent) {
    e.preventDefault();
    if(pending.current || !status?.enabled || !prompt.trim()) return;
    pending.current=true;setBusy(true);setError('');
    const text=prompt.trim();
    const started=epoch.current;
    try {
      const reply=await request({mode,prompt:text,history:messages.slice(-8),remember});
      if(started!==epoch.current) return;
      setMessages(old=>[...old,{role:'user',text},{role:'model',text:reply.text}]);
      if(remember)setMemoryNotice(reply.memorySaved?'Saved to your private agent memory.':'Answer received, but memory was not saved. It may have been cleared elsewhere.');
      setPrompt('');setStatus(old=>({...old!,remaining:reply.remaining}));
    } catch(e:any) {if(started===epoch.current)setError(e.name==='TimeoutError'?'The request timed out. Please wait before trying again.':e.message);}
    finally {pending.current=false;setBusy(false);}
  }
  async function loadMemory() {
    if(pending.current) return;
    const started=epoch.current;
    pending.current=true;setBusy(true);setError('');
    try {
      const saved=await request(undefined,true);
      if(started!==epoch.current)return;
      setMessages(saved.history);setRemember(true);
      setMemoryNotice(saved.history.length?'Your saved conversation is restored.':'Memory is on. Future questions and answers will be saved.');
    } catch(e:any){if(started===epoch.current)setError(e.message);}
    finally{pending.current=false;setBusy(false);}
  }
  async function forgetMemory() {
    if(pending.current) return;
    const started=epoch.current;
    pending.current=true;setBusy(true);setError('');
    try {
      await request({action:'forget'});
      if(started!==epoch.current)return;
      setMessages([]);setRemember(false);setPrompt('');
      setMemoryNotice('Saved conversation and remembered answers deleted. Memory is off.');
    } catch(e:any){if(started===epoch.current)setError(e.message);}
    finally{pending.current=false;setBusy(false);}
  }
  return <main className="eclipse-agent">
    <header className="ea-heading"><div className="ea-mascot" aria-hidden="true"><Bot size={38}/></div><p className="ea-eyebrow">YOUR NEXT STEP, TOGETHER</p><h1>Eclipse Agent</h1><p>A little clarity. A plan you can use. A calmer way to learn.</p><span className="ea-badge">{status?.enabled ? `${status.remaining} of ${status.limit} requests left today` : 'Paid-plan preview · awaiting activation'}</span></header>
    <div className="ea-choices">{choices.map(c=><button key={c.id} aria-pressed={mode===c.id} disabled={busy} onClick={()=>{setMode(c.id);setPrompt(c.prompt);composer.current?.focus();}}><strong>{c.label}</strong><span>{c.hint}</span></button>)}</div>
    <aside className="ea-memory" aria-label="Conversation memory">
      <div><strong>{remember?'Memory is on':'Memory is off'}</strong><p>When enabled, Eclipse saves your recent conversation and up to 20 answers to your account until you forget them. The last four exchanges provide context for your next task.</p></div>
      <div className="ea-memory-actions">{remember?<button disabled={busy} onClick={()=>{setRemember(false);setMessages([]);setMemoryNotice('Memory paused. Saved answers remain until you choose Forget.');}}>Pause memory</button>:<button disabled={busy} onClick={loadMemory}>Enable / restore memory</button>}<button disabled={busy} onClick={forgetMemory}>Forget this conversation</button></div>
      {memoryNotice&&<p role="status">{memoryNotice}</p>}
    </aside>
    <section className="ea-chat" aria-label="Agent conversation"><div role="log" aria-live="polite" aria-relevant="additions">{messages.length===0?<div className="ea-welcome"><h2>What are we working on?</h2><p>Paste a question, describe a goal, or start with one of the ideas above.</p></div>:messages.map((m,i)=><article key={i} className={`ea-message ea-${m.role}`}><strong>{m.role==='user'?'You':'Eclipse'}</strong><ReactMarkdown>{m.text}</ReactMarkdown></article>)}</div>
      {busy&&<p role="status" className="ea-working"><span className="ea-thinking-dots" aria-hidden="true"><i/><i/><i/></span> Processing your request…</p>}
      {error&&<p className="ea-error" role="alert">{error} <Link to="/subscription">View plans</Link></p>}
      <form onSubmit={send}><label htmlFor="agent-task">Your task</label><textarea id="agent-task" ref={composer} maxLength={4000} rows={3} value={prompt} disabled={busy} onChange={e=>setPrompt(e.target.value)} placeholder="For example: explain simultaneous equations, then let me try one."/><div className="ea-compose-footer"><span>{prompt.length}/4,000</span><button type="submit" disabled={busy||!status?.enabled||!prompt.trim()||status.remaining===0}>{busy?'Thinking…':'Ask Eclipse'}<ArrowUp size={16}/></button></div></form>
    </section>
    <footer className="ea-notes"><p>Study help and drafts only. Check important answers. This agent cannot access Sparx, submit homework, spend money or run tasks in the background. Do not share passwords or personal information.</p><p>With memory off, new messages are not saved by the agent. With memory on, use Enable / restore memory to resume later. Recent context is sent to the AI provider when you ask a question. Forget removes Eclipse’s saved copy; provider retention is separate. <Link to="/privacy">Privacy</Link></p></footer>
  </main>;
}
