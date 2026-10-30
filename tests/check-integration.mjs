import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Check publication contracts that could silently break the shared agent service.
const config=JSON.parse(readFileSync('firebase.json','utf8'));
assert.equal(config.firestore.database,'ai-studio-2a66ed90-2fcf-4fc3-abef-a32720185065');
assert.equal(config.hosting.rewrites[0].source,'/api/admin/agents');
assert.equal(config.hosting.rewrites[0].function,'projectAgents');
assert.ok(readFileSync('backend/functions/index.js','utf8').includes("require('./project-agents.cjs')"));
assert.ok(readFileSync('index.html','utf8').includes('rel="canonical"'));
assert.ok(readFileSync('public/sitemap.xml','utf8').includes('/about-eclipse.html'));
console.log('PASS: deployment routing, named database and search metadata integration.');
