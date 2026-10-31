const {onRequest} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const {getFirestore} = require('firebase-admin/firestore');
const {GoogleGenAI} = require('@google/genai');
const Stripe = require('stripe');
const {randomUUID} = require('node:crypto');
const {FirestoreSessionMemory} = require('./session-memory.cjs');
const {LIMITS,input,paidTier,reserve,SYSTEM} = require('./eclipse-agent-core.cjs');
// Closed by default. Enabling requires an owner-approved usage budget and server configuration.
exports.eclipseAgent = onRequest({region:'us-central1',memory:'256MiB',timeoutSeconds:60,maxInstances:2,concurrency:4,cors:['https://eclipseapp.co.uk','https://www.eclipseapp.co.uk']}, async(req,res) => {
  res.set('Cache-Control','no-store');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Method not allowed.'});
  if (!admin.apps.length) admin.initializeApp();
  let user;
  try { const token = req.get('Authorization') || ''; if(!token.startsWith('Bearer ')) throw Error(); user = await admin.auth().verifyIdToken(token.slice(7),true); }
  catch { return res.status(401).json({error:'Please sign in again.'}); }
  const db = getFirestore(admin.app(),'ai-studio-2a66ed90-2fcf-4fc3-abef-a32720185065');
  const memory = new FirestoreSessionMemory(db,user.uid);
  // Users retain access to their own memory and deletion even after cancellation
  // or when AI generation has been disabled. Neither action calls a model.
  try {
    if (req.method === 'GET' && req.query.memory === '1') {
      const saved = await memory.read();
      return res.json({history:saved.history});
    }
    if (req.method === 'POST' && req.body?.action === 'forget') {
      await memory.clear();
      return res.json({forgotten:true});
    }
  } catch { return res.status(503).json({error:'Memory is temporarily unavailable. No deletion has been confirmed.'}); }
  const globalLimit = Number(process.env.ECLIPSE_AGENT_DAILY_CAP || 0);
  const ready = process.env.ECLIPSE_AGENT_ENABLED === 'true' && Number.isInteger(globalLimit) && globalLimit > 0 && globalLimit <= 1000 && !!process.env.GEMINI_API_KEY && !!process.env.STRIPE_SECRET_KEY;
  if (!ready) return res.status(req.method === 'GET' ? 200 : 503).json({enabled:false,error:'Eclipse Agent is awaiting activation. No agent requests are being charged.'});
  let usageRef, reserved = false;
  try {
    const data = req.method === 'POST' ? input(req.body) : null;
    const profile = (await db.doc('users/'+user.uid).get()).data();
    const customerId = profile?.stripeCustomerId;
    if (typeof customerId !== 'string' || !/^cus_[A-Za-z0-9]+$/.test(customerId)) return res.status(403).json({error:'An active paid subscription is required.'});
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY,{maxNetworkRetries:0,timeout:10000});
    const customer = await stripe.customers.retrieve(customerId);
    const subs = await stripe.subscriptions.list({customer:customerId,status:'active',limit:100});
    const tier = paidTier(user,customer,subs.data,{serious:process.env.STRIPE_PRICE_ID_SERIOUS,premium:process.env.STRIPE_PRICE_ID_PREMIUM,admin:process.env.STRIPE_PRICE_ID_ADMIN});
    if (!tier) return res.status(403).json({error:'Verify your email and use the account associated with an active paid subscription.'});
    usageRef = db.doc('eclipse_agent_usage/'+user.uid);
    if (req.method === 'GET') {
      const usage = (await usageRef.get()).data();
      const used = usage?.day === new Date().toISOString().slice(0,10) ? usage.count : 0;
      return res.json({enabled:true,tier,limit:LIMITS[tier],remaining:Math.max(0,LIMITS[tier]-used)});
    }
    const globalRef = db.doc('eclipse_agent_usage/_global');
    const remaining = await db.runTransaction(async tx => {
      const [u,g] = await Promise.all([tx.get(usageRef),tx.get(globalRef)]);
      const next = reserve(u.data(),Date.now(),LIMITS[tier],g.data(),globalLimit);
      tx.set(usageRef,next.user); tx.set(globalRef,next.global); return next.remaining;
    });
    reserved = true;
    const remembered = req.body.remember === true ? await memory.read() : null;
    const history = remembered ? remembered.history : data.history;
    const ai = new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY,httpOptions:{timeout:45000}});
    const response = await ai.models.generateContent({model:'gemini-3.5-flash',contents:[...history.map(m=>({role:m.role,parts:[{text:m.text}]})),{role:'user',parts:[{text:`Task: ${data.mode}\n${data.prompt}`}]}],config:{systemInstruction:SYSTEM,maxOutputTokens:1024}});
    if (!response.text?.trim()) throw Error('EMPTY');
    const text = response.text.slice(0,12000);
    let memorySaved = false;
    if (remembered) {
      try { memorySaved = await memory.storeContext(randomUUID(),text,data.prompt,remembered.revision); }
      catch { /* Return the answer honestly even when storage fails. */ }
    }
    return res.json({text,remaining,limit:LIMITS[tier],model:'Gemini',externalActions:false,memorySaved});
  } catch(error) {
    const messages = {INPUT:[400,'Enter a task of up to 4,000 characters and choose a supported mode.'],BUSY:[409,'A request is already running. Wait for it to finish.'],LIMIT:[429,'Your daily agent allowance has been reached. It resets at midnight UTC.'],CAPACITY:[429,'The agent has reached its daily service capacity. Try again tomorrow.']};
    const [status,message] = messages[error.message] || [503,'The agent could not finish this request. Please try again later.'];
    return res.status(status).json({error:message});
  } finally {
    if(reserved) await usageRef.update({busyUntil:0}).catch(()=>{});
  }
});
