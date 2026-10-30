import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import './admin-agents.css';
const projects={eclipse:{name:'Eclipse',url:'https://eclipseapp.co.uk'},dionysus:{name:'Dionysus',url:'https://dionysus-kitchens.musicplays.chatgpt.site'}};
const agents=[
 {id:'orion',name:'Orion',role:'Team leader',symbol:'✦',description:'Organises ideas and coordinates the project queue.',audit:true},
 {id:'atlas',name:'Atlas',role:'Code & websites',symbol:'▦',description:'Owns development proposals. Can review HTML foundations now.',audit:true},
 {id:'patch',name:'Patch',role:'Bug discovery',symbol:'✚',description:'Finds endpoint issues and hands reports to Atlas.',audit:true},
 {id:'cipher',name:'Cipher',role:'Security',symbol:'◇',description:'Reviews public protections and creates security tasks.',audit:true},
 {id:'sentinel',name:'Sentinel',role:'Testing',symbol:'◎',description:'Tests public endpoints and records failures.',audit:true},
 {id:'scribe',name:'Scribe',role:'Messages & email',symbol:'≋',description:'Organises support and email once a mailbox is connected.',audit:false},
 {id:'vault',name:'Vault',role:'Finances',symbol:'◈',description:'Prepares financial proposals. Your approval is always required.',audit:false},
 {id:'pixel',name:'Pixel',role:'Creative content',symbol:'▧',description:'Collects creative briefs, ads and content proposals.',audit:false},
 {id:'social',name:'Social',role:'Social channels',symbol:'◌',description:'Plans publishing and engagement. Channels are not connected.',audit:false},
 {id:'script',name:'Script',role:'Campaigns',symbol:'⌁',description:'Collects campaign ideas and routes them for review.',audit:false},
 {id:'pulse',name:'Pulse',role:'Customer insights',symbol:'⌁',description:'Plans satisfaction insights. Anonymised feedback is not connected.',audit:false},
 {id:'nova',name:'Nova',role:'Integrations & innovation',symbol:'✧',description:'Plans new websites and checks the project connection.',audit:true},
];
type Result={projectId:string;agent:string;summary:string;findings:{title:string;status:string;detail:string}[];limitations:string[]};
type Run={id:string;projectId:string;agent:string;status:string;createdAt:number;result?:Result};
type Message={id:string;projectId:string;speaker:string;body:string;source:string;createdAt:number};
type Task={id:string;projectId:string;assignedTo:string;kind:string;title:string;detail:string;status:string};
async function agentRequest(method:'GET'|'POST',body?:object){
 await auth.authStateReady();
 if(!auth.currentUser)throw new Error('Please sign in to your administrator account.');
 const token=await auth.currentUser.getIdToken();
 const response=await fetch('/api/admin/agents',{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},...(body?{body:JSON.stringify(body)}:{})});
 if(!(response.headers.get('Content-Type')||'').includes('application/json'))throw new Error('The workshop service is not available yet. Please reload after deployment.');
 const data=await response.json();if(!response.ok)throw new Error(data.error||'The request could not be completed.');return data;
}
export default function AdminAgentHub(){
 const [project,setProject]=useState<keyof typeof projects>('eclipse');
 const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [runs,setRuns]=useState<Run[]>([]),[messages,setMessages]=useState<Message[]>([]),[tasks,setTasks]=useState<Task[]>([]);
 const [owner,setOwner]=useState(false),[result,setResult]=useState<Result|null>(null);
 const [draft,setDraft]=useState(''),[assignee,setAssignee]=useState('orion');
 const load=async()=>{const data=await agentRequest('GET');setRuns(data.runs||[]);setMessages(data.messages||[]);setTasks(data.tasks||[]);setOwner(!!data.ownerCanApprove);};
 useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
 const action=async(label:string,body:object)=>{
  setBusy(label);setError('');setNotice('');
  try{const data=await agentRequest('POST',{projectId:project,...body});if(data.findings)setResult(data);else setNotice(data.status==='approved_waiting_executor'?'Proposal approved. It still needs a connected executor. No payment or commitment was made.':'Saved to the shared project queue.');await load();return true;}
  catch(e){setError(e instanceof Error?e.message:'The workshop request failed.');return false;}
  finally{setBusy(null);}
 };
 const filteredTasks=tasks.filter(t=>t.projectId===project);
 return <section className="admin-agent-hub" aria-labelledby="agent-hub-title">
  <header className="agent-hub-heading"><div><p className="agent-hub-kicker">ECLIPSE PROJECT WORKSHOP</p><h2 id="agent-hub-title">Meet your little big team.</h2><p>Twelve teammates. Two connected projects. One place for ideas, checks and handoffs.</p></div><span className="agent-access-label">Admin only · Owner approvals</span></header>
  <div className="agent-projects" role="group" aria-label="Choose project">{Object.entries(projects).map(([id,p])=><button key={id} type="button" aria-pressed={project===id} disabled={!!busy} onClick={()=>{setProject(id as keyof typeof projects);setResult(null);}}>{p.name}<span>{id==='eclipse'?'Learning platform':'Food marketplace preview'}</span></button>)}<a href={projects[project].url} target="_blank" rel="noopener noreferrer">Open {projects[project].name} ↗</a></div>
  <p className="agent-boundary">Audits and task routing are live capabilities. These are workflow bots, not independent AI developers. Source editing, email, social publishing, creative generation, financial feeds and continuous monitoring need their service connections. Nothing is purchased or published from this workshop.</p>
  <div className="agent-crew">{agents.map(bot=><article key={bot.id} data-bot={bot.id} className={busy===bot.id?'agent-working':''}><div className="agent-mini-bot" aria-hidden="true"><em/><span><i/>{bot.id!=='sentinel'&&<i/>}</span><b>{bot.symbol}</b><small/></div><p className="agent-hub-kicker">{bot.role}</p><h3>{bot.name}</h3><p>{bot.description}</p><span className="agent-capability">{bot.audit?'Public audit available':'Proposal queue available'}</span><button type="button" disabled={!!busy} onClick={()=>{if(bot.audit){setResult(null);void action(bot.id,{action:'audit',agent:bot.id});}else{setAssignee(bot.id);document.getElementById('agent-idea')?.focus();}}}>{busy===bot.id?'Checking…':bot.audit?'Run check →':'Prepare proposal →'}</button></article>)}</div>
  {busy&&<p role="status">Working on the requested action. Results and handoffs will appear below.</p>}{error&&<p role="alert" className="agent-error">{error}</p>}{notice&&<p role="status" className="agent-notice">{notice}</p>}
  {result&&<section className="agent-results" aria-label="Audit result"><h3>{result.projectId==='eclipse'?'Eclipse':'Dionysus'} audit</h3><p>{result.summary}</p><ul>{result.findings.map(f=><li key={f.title}><span className={f.status==='pass'?'agent-pass':'agent-attention'}>{f.status==='pass'?'Pass':'Review'}</span><div><strong>{f.title}</strong><p>{f.detail}</p></div></li>)}</ul><p className="agent-boundary">{result.limitations.join(' ')}</p></section>}
  <div className="agent-workspace"><section className="agent-discussion" aria-labelledby="team-room-title"><h3 id="team-room-title">The team room</h3><p className="agent-boundary">Private project discussion. Bot replies are labelled workflow notes or audit findings, never simulated thinking.</p><div className="agent-message-list">{messages.filter(m=>m.projectId===project).length?messages.filter(m=>m.projectId===project).map(m=><article key={m.id}><header><strong>{m.speaker==='you'?'You':agents.find(a=>a.id===m.speaker)?.name||m.speaker}</strong><span>{m.source==='audit'?'Audit finding':m.source==='owner'?'Admin message':'Workflow note'}</span></header><p>{m.body}</p></article>):<p>No messages yet. Share an idea or run a check to start the discussion.</p>}</div><form onSubmit={async e=>{e.preventDefault();const okay=await action('message',{action:assignee==='orion'?'message':'proposal',agent:assignee,text:draft,kind:assignee==='vault'?'finance':'idea'});if(okay)setDraft('');}}><label htmlFor="agent-idea">Share an idea or propose a task</label><textarea id="agent-idea" required maxLength={3000} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="What should the team look at? Keep student information out of this room."/><div><label htmlFor="agent-assignee">Send to</label><select id="agent-assignee" value={assignee} onChange={e=>setAssignee(e.target.value)}>{agents.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select><button type="submit" disabled={!!busy||!draft.trim()}>Add to workshop →</button></div></form></section>
  <section className="agent-task-list" aria-labelledby="agent-tasks-title"><h3 id="agent-tasks-title">Handoffs & approvals</h3><p className="agent-boundary">Vault proposals always require your approval. Approval records intent only; it does not authorise an unspecified future payment.</p>{filteredTasks.length?filteredTasks.map(task=><article key={task.id}><span className="agent-hub-kicker">{agents.find(a=>a.id===task.assignedTo)?.name||task.assignedTo} · {task.kind}</span><h4>{task.title}</h4><p>{task.detail}</p><span className="agent-task-state">{task.status.replaceAll('_',' ')}</span>{owner&&['proposed','awaiting_owner_approval'].includes(task.status)&&<div className="agent-approval-buttons"><button disabled={!!busy} type="button" onClick={()=>void action('approval',{action:'approval',taskId:task.id,decision:'approve'})}>Approve proposal</button><button disabled={!!busy} type="button" onClick={()=>void action('approval',{action:'approval',taskId:task.id,decision:'reject'})}>Reject</button></div>}</article>):<p>No tasks recorded for this project.</p>}</section></div>
  <details className="agent-history"><summary>Recent checks ({runs.filter(r=>r.projectId===project).length})</summary>{runs.filter(r=>r.projectId===project).map(run=><button type="button" key={run.id} disabled={!run.result} onClick={()=>run.result&&setResult(run.result)}><span>{agents.find(a=>a.id===run.agent)?.name||run.agent}</span><span>{run.status} · {new Date(run.createdAt).toLocaleString()}</span></button>)}</details>
 </section>;
}
