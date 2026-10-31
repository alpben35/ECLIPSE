const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const {FirestoreSessionMemory}=require('../backend/functions/session-memory.cjs');
const core=require('../backend/functions/eclipse-agent-core.cjs');
function harness(){
 const rows=new Map([['eclipse_agent_memory/alice',{revision:1,history:[{role:'user',text:'Alice only'}],items:[]}],['eclipse_agent_memory/bob',{revision:1,history:[{role:'user',text:'Bob only'}],items:[]}]]);
 const snap=p=>({data:()=>rows.get(p)});const db={doc:path=>({path,get:async()=>snap(path)}),runTransaction:async fn=>fn({get:async ref=>snap(ref.path),set:(ref,data)=>rows.set(ref.path,data)})};
 const exports={};
 const deps={'firebase-functions/v2/https':{onRequest:(_,fn)=>fn},'firebase-admin':{apps:[{}],app:()=>({}),auth:()=>({verifyIdToken:async token=>{if(token!=='alice')throw Error();return {uid:'alice'};}})},'firebase-admin/firestore':{getFirestore:()=>db},'@google/genai':{GoogleGenAI:class{constructor(){throw Error('Must not generate')}}},stripe:class{constructor(){throw Error('Must not bill')}},'node:crypto':require('node:crypto'),'./session-memory.cjs':{FirestoreSessionMemory},'./eclipse-agent-core.cjs':core};
 vm.runInNewContext(fs.readFileSync(require.resolve('../backend/functions/eclipse-agent.cjs'),'utf8'),{require:name=>deps[name],exports,process:{env:{}}});
 return {rows,call:async(method,body,query={},token='alice')=>{const res={statusCode:200,set(){},status(c){this.statusCode=c;return this;},json(data){this.body=data;return this;}};await exports.eclipseAgent({method,body,query,get:()=>token?'Bearer '+token:''},res);return res;}};
}
test('unauthenticated callers cannot retrieve or forget memory',async()=>{const h=harness();assert.equal((await h.call('GET',null,{memory:'1'},'')).statusCode,401);assert.equal((await h.call('POST',{action:'forget'},{},'invalid')).statusCode,401);assert.equal(h.rows.get('eclipse_agent_memory/alice').history.length,1);});
test('memory retrieval uses verified identity and ignores supplied user IDs',async()=>{const h=harness();const r=await h.call('GET',{uid:'bob'},{memory:'1',uid:'bob'});assert.equal(r.body.history[0].text,'Alice only');});
test('forget works while generation disabled and touches only own data',async()=>{const h=harness();const r=await h.call('POST',{action:'forget',uid:'bob'});assert.equal(r.body.forgotten,true);assert.equal(h.rows.get('eclipse_agent_memory/alice').history.length,0);assert.equal(h.rows.get('eclipse_agent_memory/bob').history.length,1);});
test('disabled model generation remains blocked',async()=>{const h=harness();assert.equal((await h.call('POST',{mode:'explain',prompt:'maths',remember:true})).statusCode,503);assert.equal((await h.call('GET',null)).body.enabled,false);});
