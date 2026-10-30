const {onRequest}=require('firebase-functions/v2/https');
const admin=require('firebase-admin');
const {getFirestore}=require('firebase-admin/firestore');
const {runChecks,PROJECTS}=require('./project-checks.cjs');
const {BOTS,botById,proposalStatus,mayApproveFinancial}=require('./bot-team.cjs');
exports.projectAgents=onRequest({region:'us-central1',memory:'256MiB',timeoutSeconds:90,maxInstances:2,concurrency:4,cors:['https://eclipseapp.co.uk','https://www.eclipseapp.co.uk']},async(req,res)=>{
 res.set('Cache-Control','no-store');
 try{
  if(!admin.apps.length)admin.initializeApp();
  const bearer=req.get('Authorization')||'';
  if(!bearer.startsWith('Bearer '))return res.status(401).json({error:'Sign in required.'});
  let user;try{user=await admin.auth().verifyIdToken(bearer.slice(7),true);}catch{return res.status(401).json({error:'Please sign in again.'});}
  const db=getFirestore(admin.app(),'ai-studio-2a66ed90-2fcf-4fc3-abef-a32720185065');
  const owner=mayApproveFinancial(user);
  const adminAccess=owner||user.admin===true||(await db.doc('admins/'+user.uid).get()).exists;
  if(!adminAccess)return res.status(403).json({error:'Administrator access required.'});
  if(req.method==='GET'){
   const collections=['agent_runs','agent_messages','agent_tasks'];
   const data=await Promise.all(collections.map(name=>db.collection(name).orderBy('createdAt','desc').limit(name==='agent_messages'?30:16).get()));
   return res.json({projects:PROJECTS,bots:BOTS,ownerCanApprove:owner,runs:data[0].docs.map(d=>({id:d.id,...d.data()})),messages:data[1].docs.map(d=>({id:d.id,...d.data()})).reverse(),tasks:data[2].docs.map(d=>({id:d.id,...d.data()}))});
  }
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
  const {projectId,agent,action='audit',text,kind,taskId,decision}=req.body||{};
  if(!Object.hasOwn(PROJECTS,projectId))return res.status(400).json({error:'Choose a listed project.'});
  const now=Date.now();
  const quota=db.doc('agent_limits/'+user.uid);
  await db.runTransaction(async tx=>{const snap=await tx.get(quota);const d=snap.data()||{};const same=d.windowStart>now-3600000;if(same&&d.count>=30)throw new Error('AGENT_LIMIT');tx.set(quota,{windowStart:same?d.windowStart:now,count:same?(d.count||0)+1:1});});
  const message=(speaker,body,source='workflow')=>db.collection('agent_messages').add({projectId,speaker,body,source,createdAt:Date.now()});
  if(action==='message'||action==='proposal'){
   if(typeof text!=='string'||!text.trim()||text.length>3000)return res.status(400).json({error:'Write a message of 1–3,000 characters.'});
   if(action==='message'){
    await message('you',text.trim(),'owner');
    const task=await db.collection('agent_tasks').add({projectId,assignedTo:'orion',kind:'idea',title:text.trim().slice(0,160),detail:text.trim(),status:'proposed',createdAt:now,requestedBy:user.uid});
    await message('orion','Idea recorded for review. I have added it to the project queue. Select a teammate to prepare a specific proposal. No code, publication or financial action has been executed.');
    return res.json({id:task.id,status:'proposed'});
   }
   const bot=botById(agent);if(!bot)return res.status(400).json({error:'Choose a listed teammate.'});
   const category=agent==='vault'?'finance':(['finance','code','bug','security','content','campaign','support','integration','insight'].includes(kind)?kind:'idea');
   const task=await db.collection('agent_tasks').add({projectId,assignedTo:agent,kind:category,title:text.trim().slice(0,160),detail:text.trim(),status:proposalStatus(category),createdAt:now,requestedBy:user.uid});
   await message(agent,`Proposal recorded: ${text.trim().slice(0,300)}. ${category==='finance'?'Owner approval is mandatory. Nothing has been spent or committed.':'This is a queued proposal, not completed work.'}`);
   return res.json({id:task.id,status:proposalStatus(category)});
  }
  if(action==='approval'){
   if(!owner)return res.status(403).json({error:'Only the verified site owner can approve proposals.'});
   if(typeof taskId!=='string'||!/^[-_A-Za-z0-9]{1,128}$/.test(taskId)||!['approve','reject'].includes(decision))return res.status(400).json({error:'Invalid approval request.'});
   const task=db.doc('agent_tasks/'+taskId);const snap=await task.get();if(!snap.exists||snap.data().projectId!==projectId)return res.status(404).json({error:'Proposal not found.'});
   if(!['proposed','awaiting_owner_approval'].includes(snap.data().status))return res.status(409).json({error:'This proposal has already been reviewed.'});
   await task.update({status:decision==='approve'?'approved_waiting_executor':'rejected',reviewedBy:user.uid,reviewedAt:now});
   await message('orion',decision==='approve'?'The owner approved a proposal. Execution remains pending a connected worker. This approval does not create a payment or recurring commitment.':'The owner rejected a proposal. No action will be taken.');
   return res.json({status:decision==='approve'?'approved_waiting_executor':'rejected'});
  }
  const bot=botById(agent);if(action!=='audit'||!bot?.audit)return res.status(400).json({error:'This teammate needs its service connection. You can prepare a proposal instead.'});
  const job=db.collection('agent_runs').doc();await job.set({projectId,agent,status:'running',createdAt:now,requestedBy:user.uid});
  try{
   const result=await runChecks(projectId,bot.audit);
   await job.update({status:'completed',result,completedAt:Date.now()});
   const issues=result.findings.filter(f=>f.status==='attention');
   for(const issue of issues.slice(0,8))await db.collection('agent_tasks').add({projectId,assignedTo:agent==='patch'?'atlas':agent,kind:agent==='cipher'?'security':'bug',title:issue.title,detail:issue.detail,status:'proposed',createdAt:Date.now(),sourceRun:job.id});
   await message(agent,`${result.summary} ${issues.length?'Findings have been added to the queue'+(agent==='patch'?' and handed to Atlas':'')+'.':'The listed public checks passed.'} This was a deterministic endpoint audit, not an autonomous code change.`,'audit');
   return res.json({id:job.id,status:'completed',...result});
  }catch{await job.update({status:'failed',error:'The public endpoint could not be checked.',completedAt:Date.now()});return res.status(502).json({error:'The public endpoint could not be checked. No code was changed.'});}
 }catch(error){if(error.message==='AGENT_LIMIT')return res.status(429).json({error:'Thirty workshop actions per administrator per hour are available. Try again later.'});console.error('[Project agents]',error.code||error.name);return res.status(500).json({error:'Agent service unavailable. Please try again later.'});}
});
