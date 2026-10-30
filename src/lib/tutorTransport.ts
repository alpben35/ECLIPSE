type TokenProvider = (forceRefresh?: boolean) => Promise<string>;

// Keep the Firebase token in memory and send it only to this site's tutor API.
export async function authenticatedTutorFetch(
  url: string,
  init: RequestInit,
  getToken: TokenProvider,
  request: typeof fetch = fetch,
): Promise<Response> {
  if (!url.startsWith('/api/tutor/')) throw new Error('Invalid tutor endpoint.');
  const send = async (forceRefresh: boolean) => {
    const token = await getToken(forceRefresh);
    if (!token) throw new Error('Please sign in again to use the tutor.');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return request(url, { ...init, headers });
  };
  const response = await send(false);
  if (response.status !== 401) return response;
  // A rejected expired token can be refreshed once; never retry a successful request.
  await response.body?.cancel();
  return send(true);
}

export async function readTutorStream(response: Response, onChunk: (text: string) => void) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Stream not supported');
  const decoder = new TextDecoder();
  let pending = '';
  let receivedText = false;
  const handleLine = (line: string) => {
    if (!line.startsWith('data:')) return false;
    const data = line.slice(5).trim();
    if (data === '[DONE]') return true;
    if (!data) return false;
    let parsed: { text?: string; error?: string };
    try { parsed = JSON.parse(data); }
    catch { throw new Error('The tutor response was interrupted. Please try again.'); }
    // Do not catch server errors in a JSON parsing catch block.
    if (parsed.error) throw new Error(parsed.error);
    if (typeof parsed.text === 'string' && parsed.text) {
      receivedText = true;
      onChunk(parsed.text);
    }
    return false;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() || '';
      for (const line of lines) {
        if (handleLine(line.trim())) {
          if (!receivedText) throw new Error('The tutor returned an empty response. Please try again.');
          await reader.cancel();
          return;
        }
      }
      if (done) {
        if (pending.trim() && handleLine(pending.trim()) && receivedText) return;
        throw new Error('The tutor response was interrupted. Please try again.');
      }
    }
  } finally { reader.releaseLock(); }
}
