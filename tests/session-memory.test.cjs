const {test}=require('node:test');
const assert=require('node:assert/strict');
const {FirestoreSessionMemory}=require('../backend/functions/session-memory.cjs');
function database(){
  const rows=new Map();
  const snap=path=>({data:()=>structuredClone(rows.get(path))});
  return {doc:path=>({path,get:async()=>snap(path)}),runTransaction:async fn=>fn({get:async ref=>snap(ref.path),set:(ref,data)=>rows.set(ref.path,structuredClone(data))})};
}
test('same account restores context through independent memory instances',async()=>{
 const db=database(),a=new FirestoreSessionMemory(db,'alice');
 assert.equal(await a.retrieveContext('q1'),null);
 assert.equal(await a.storeContext('q1','4','Solve x+2=6',0),true);
 const restored=new FirestoreSessionMemory(db,'alice');
 assert.equal(await restored.retrieveContext('q1'),'4');
 assert.deepEqual((await restored.read()).history,[{role:'user',text:'Solve x+2=6'},{role:'model',text:'4'}]);
 assert.equal(await restored.storeContext('q1','5','Correction',1),true);
 assert.equal(await restored.retrieveContext('q1'),'5');
 assert.equal((await restored.read()).items.length,1);
});
test('different verified user identities cannot share saved answers',async()=>{
 const db=database(),a=new FirestoreSessionMemory(db,'alice'),b=new FirestoreSessionMemory(db,'bob');
 await a.storeContext('q','private','prompt',0);
 assert.equal(await b.retrieveContext('q'),null);
 await b.clear();assert.equal(await a.retrieveContext('q'),'private');
 assert.throws(()=>new FirestoreSessionMemory(db,'alice/other'),/MEMORY_IDENTITY/);
});
test('forget clears content and prevents an in-flight save resurrecting it',async()=>{
 const a=new FirestoreSessionMemory(database(),'alice');
 await a.storeContext('q','old','prompt',0);
 const inFlight=await a.read();await a.clear();
 assert.equal(await a.storeContext('late','answer','old prompt',inFlight.revision),false);
 assert.deepEqual((await a.read()).history,[]);
 assert.equal(await a.retrieveContext('q'),null);
 const fresh=await a.read();assert.equal(await a.storeContext('new','new answer','new prompt',fresh.revision),true);
});
test('bounded memory retains twenty answers and four recent exchanges',async()=>{
 const a=new FirestoreSessionMemory(database(),'alice');
 for(let i=0;i<25;i++)await a.storeContext('q'+i,'a'+i,'p'+i,i);
 const data=await a.read();assert.equal(data.items.length,20);assert.equal(data.history.length,8);
 assert.equal(await a.retrieveContext('q0'),null);assert.equal(await a.retrieveContext('q24'),'a24');
 await assert.rejects(()=>a.storeContext('q','x'.repeat(12001),'p',25),/MEMORY_INPUT/);
});
test('storage failures propagate so callers cannot claim a successful save',async()=>{
 const a=new FirestoreSessionMemory({doc:()=>({get:async()=>{throw Error('offline')}}),runTransaction:async()=>{throw Error('offline')}},'alice');
 await assert.rejects(()=>a.read(),/offline/);await assert.rejects(()=>a.clear(),/offline/);
});
