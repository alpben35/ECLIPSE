import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticatedTutorFetch, readTutorStream } from './tutorTransport';

test('sends the signed-in token and refreshes once after a 401', async () => {
  const refresh: boolean[] = [];
  const headers: string[] = [];
  const response = await authenticatedTutorFetch('/api/tutor/ask', { method:'POST', body:'{}' }, async force => {
    refresh.push(!!force); return force ? 'fresh' : 'expired';
  }, async (_url, init) => {
    headers.push(new Headers(init?.headers).get('Authorization')!);
    return new Response('{}', { status: headers.length === 1 ? 401 : 200 });
  });
  assert.equal(response.status, 200);
  assert.deepEqual(refresh, [false, true]);
  assert.deepEqual(headers, ['Bearer expired', 'Bearer fresh']);
});

test('does not replay quota errors or send tokens to other hosts', async () => {
  let calls = 0;
  const request = async () => { calls++; return new Response('{}', {status:429}); };
  assert.equal((await authenticatedTutorFetch('/api/tutor/ask', {}, async ()=>'token', request)).status,429);
  assert.equal(calls,1);
  await assert.rejects(authenticatedTutorFetch('https://example.com/api/tutor/ask', {},async ()=>'token',request), /Invalid tutor endpoint/);
  assert.equal(calls,1);
});

test('surfaces SSE server errors instead of silently succeeding', async () => {
  await assert.rejects(readTutorStream(new Response('data: {"error":"Authentication required."}\n\n'),()=>{}),/Authentication required/);
});

test('joins split network chunks and accepts a complete response', async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({start(controller) {
    for (const part of ['data: {"te','xt":"Four"}\r\n\r\n','data: [DONE]\n\n']) controller.enqueue(encoder.encode(part));
    controller.close();
  }});
  let text = '';
  await readTutorStream(new Response(stream), chunk => {text += chunk;});
  assert.equal(text,'Four');
});

test('rejects truncated streams and empty completions', async () => {
  await assert.rejects(readTutorStream(new Response('data: {"text":"Partial"}\n\n'),()=>{}),/interrupted/);
  await assert.rejects(readTutorStream(new Response('data: [DONE]\n\n'),()=>{}),/empty response/);
});
