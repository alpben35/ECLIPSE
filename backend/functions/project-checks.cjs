const PROJECTS = Object.freeze({
  eclipse: {name:'Eclipse',url:'https://eclipseapp.co.uk'},
  dionysus: {name:'Dionysus',url:'https://dionysus-kitchens.musicplays.chatgpt.site'},
});
const AGENTS = ['qa','security','seo','ui'];
async function runChecks(projectId, agent, request = fetch) {
  const project = PROJECTS[projectId];
  if (!project || !AGENTS.includes(agent)) throw new Error('Unknown project or agent.');
  const page=await request(project.url+'/',{signal:AbortSignal.timeout(15000),redirect:'follow'});
  const html=(await page.text()).slice(0,300000);
  const gated=/Log in to access|Sign in required/.test(html);
  const findings=[];
  const check=(title,passed,detail)=>findings.push({title,status:passed?'pass':'attention',detail});
  check('Public page responds',page.ok,'HTTP '+page.status);
  check('Public access',!gated,gated?'Owner-private preview. Sign in to inspect the application.':'Public page is accessible.');
  if(gated) return {projectId,agent,findings,summary:'This project is private. Application-level checks need an authenticated test session.',limitations:['No sign-in was bypassed.','No private user data accessed.']};
  if(agent==='security') {
    check('HTTPS',page.url.startsWith('https:'),'Encrypted connection required.');
    check('Content-type protection',page.headers.get('x-content-type-options')==='nosniff','Expected X-Content-Type-Options: nosniff.');
    check('Clickjacking protection',!!page.headers.get('x-frame-options')||/frame-ancestors/.test(page.headers.get('content-security-policy')||''),'Page should restrict unwanted embedding.');
    check('Referrer protection',!!page.headers.get('referrer-policy'),'Limit information sent to external sites.');
  } else if(agent==='seo') {
    const robots=await request(project.url+'/robots.txt',{signal:AbortSignal.timeout(15000)});
    const sitemap=await request(project.url+'/sitemap.xml',{signal:AbortSignal.timeout(15000)});
    check('Page title',/<title>[^<]+<\/title>/i.test(html),'A descriptive title helps identify the project.');
    check('Canonical URL',/<link[^>]+rel=["']canonical["']/i.test(html),'Declare the preferred public URL.');
    check('Structured metadata',html.includes('application/ld+json'),'Use truthful structured metadata.');
    check('Robots file',robots.ok && /Sitemap:/i.test(await robots.text()),'Robots should reference the sitemap.');
    check('Sitemap',sitemap.ok && /<urlset/.test(await sitemap.text()),'A valid public sitemap helps discovery.');
  } else if(agent==='qa') {
    if(projectId==='eclipse') {
      const health=await request(project.url+'/api/health',{signal:AbortSignal.timeout(15000)});
      check('API health',health.ok && (await health.json()).ok===true,'Read-only server health check.');
    }
    check('Application entry',/id=["']root["']|<main/i.test(html),'Document includes an application or content entry.');
    check('Mobile viewport',/name=["']viewport["']/i.test(html),'Document should declare a responsive viewport.');
  } else {
    check('Document language',/<html[^>]+lang=/i.test(html),'A declared language helps assistive technology.');
    check('Readable page description',/name=["']description["']/i.test(html),'Explain the product in plain language.');
    check('Semantic first heading',/<h1[\s>]/i.test(html),'The initial HTML should contain a meaningful heading.');
  }
  return {projectId,agent,findings,summary:`${findings.filter(f=>f.status==='attention').length} items need review.`,limitations:['Public endpoint audit only, not a full penetration test.','No code or deployment was changed.','Search position is not measured or guaranteed.']};
}
module.exports={PROJECTS,AGENTS,runChecks};
