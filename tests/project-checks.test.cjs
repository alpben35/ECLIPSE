const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runChecks}=require('../backend/functions/project-checks.cjs');
test('rejects arbitrary hosts and unknown agents before any request',async()=>{
 let calls=0;const req=async()=>{calls++;return new Response('');};
 await assert.rejects(runChecks('https://evil.test','qa',req),/Unknown/);
 await assert.rejects(runChecks('eclipse','deploy',req),/Unknown/);
 assert.equal(calls,0);
});
test('records a private project without bypassing its gate',async()=>{
 let calls=0;const result=await runChecks('dionysus','seo',async()=>{calls++;return new Response('<title>Sign in required</title>');});
 assert.equal(calls,1);assert.match(result.summary,/private/);assert.equal(result.findings[1].status,'attention');
});
test('SEO audit reports actual missing metadata',async()=>{
 const result=await runChecks('eclipse','seo',async(url)=>new Response(url.endsWith('robots.txt')?'Sitemap: https://eclipseapp.co.uk/sitemap.xml':url.endsWith('sitemap.xml')?'<urlset></urlset>':'<title>Eclipse</title>'));
 assert.equal(result.findings.find(f=>f.title==='Canonical URL').status,'attention');
 assert.equal(result.findings.find(f=>f.title==='Sitemap').status,'pass');
});

const {BOTS,proposalStatus,mayApproveFinancial}=require('../backend/functions/bot-team.cjs');
test('all twelve roles are distinct and financial approval is owner-only',()=>{
 assert.equal(BOTS.length,12);assert.equal(new Set(BOTS.map(b=>b.id)).size,12);
 assert.equal(proposalStatus('finance'),'awaiting_owner_approval');
 assert.equal(mayApproveFinancial({admin:true,email:'other@example.test',email_verified:true}),false);
 assert.equal(mayApproveFinancial({email:'alp.ben@gmail.com',email_verified:false}),false);
 assert.equal(mayApproveFinancial({email:'alp.ben@gmail.com',email_verified:true}),true);
});
