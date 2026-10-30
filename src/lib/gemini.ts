import { auth } from './firebase';
import { authenticatedTutorFetch, readTutorStream } from './tutorTransport';

async function tutorFetch(url: string, init: RequestInit) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in again to use the tutor.');
  return authenticatedTutorFetch(url, init, forceRefresh => user.getIdToken(forceRefresh));
}

export async function askTutor(
  prompt: string, 
  mode: 'teach' | 'solve' | 'revise' | 'question' | 'test' | 'assignment', 
  subject: string, 
  history: { role: 'user' | 'ai', content: string }[] = [], 
  imageData?: { data: string, mimeType: string }
) {
  try {
    const sanitizedHistory = (history || []).map(h => ({
      role: h.role,
      content: String(h.content || "")
    }));
    const sanitizedImageData = imageData ? {
      data: String(imageData.data || ""),
      mimeType: String(imageData.mimeType || "")
    } : undefined;

    const response = await tutorFetch('/api/tutor/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: String(prompt || ""), 
        mode, 
        subject: String(subject || ""), 
        history: sanitizedHistory, 
        imageData: sanitizedImageData 
      })
    });

    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('text/html')) {
      throw new Error("Tutor service is preparing. Please try again in external environment.");
    }

    if (!response.ok) {
      const text = await response.text();
      let message = text || 'Tutor error';
      try { message = JSON.parse(text).error || message; } catch { /* Non-JSON response. */ }
      throw new Error(message);
    }

    const data = await response.json();
    const text = data.text || "";
    const cleanedText = text
      .trim();

    return { text: cleanedText, images: data.images };
  } catch (error: any) {
    console.error("Gemini Tutor Error:", error);
    throw new Error(error.message || "Tutor is currently offline.");
  }
}

export async function askTutorStream(
  prompt: string, 
  mode: 'teach' | 'solve' | 'revise' | 'question' | 'test' | 'assignment', 
  subject: string, 
  onChunk: (text: string) => void,
  history: { role: 'user' | 'ai', content: string }[] = [], 
  imageData?: { data: string, mimeType: string }
) {
  try {
    const sanitizedHistory = (history || []).map(h => ({
      role: h.role,
      content: String(h.content || "")
    }));
    const sanitizedImageData = imageData ? {
      data: String(imageData.data || ""),
      mimeType: String(imageData.mimeType || "")
    } : undefined;

    const response = await tutorFetch('/api/tutor/ask-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: String(prompt || ""), 
        mode, 
        subject: String(subject || ""), 
        history: sanitizedHistory, 
        imageData: sanitizedImageData,
        isStream: true
      })
    });

    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('text/html')) {
      throw new Error("Tutor service streaming is preparing. Please try again in external environment.");
    }

    if (!response.ok) {
      const text = await response.text();
      let errorMessage = text;
      try {
        // Try to parse the entire response as JSON (normal error response)
        const err = JSON.parse(text);
        errorMessage = err.error || text;
      } catch (e) {
        // If it's an SSE error formatted as data: { "error": "..." }
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const dataStr = trimmed.replace('data: ', '').trim();
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                errorMessage = parsed.error;
                break;
              }
            } catch (e2) {
              // Ignore partial or malformed lines
            }
          }
        }
      }
      throw new Error(errorMessage || "SSE error");
    }

    await readTutorStream(response, onChunk);

  } catch (error: any) {
    console.error("Streaming error:", error);
    throw error;
  }
}

export async function summarizeChat(messages: { role: string, content: string }[]) {
  try {
    const sanitizedMessages = (messages || []).map(m => ({
      role: m.role,
      content: String(m.content || "")
    }));
    const response = await tutorFetch('/api/tutor/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: sanitizedMessages })
    });

    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('text/html')) {
      throw new Error("Tutor service summarize is preparing. Please try again.");
    }

    if (!response.ok) throw new Error("Summary failed");
    const data = await response.json();
    return (data.text || "").trim();
  } catch (error: any) {
    console.error("Gemini Summary Error:", error);
    throw new Error("Unable to summarize chat.");
  }
}

export interface PaperDiagnostic {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  improvementTips: string[];
  overallGrade?: string;
}

export const analyzeStudyPaper = async (imageUrl: string, subject: string): Promise<PaperDiagnostic> => {
  try {
    const imgResponse = await fetch(imageUrl);
    const blob = await imgResponse.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const response = await tutorFetch('/api/tutor/analyze-paper', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Data, mimeType: blob.type, subject })
          });
          
          if (!response.ok) throw new Error("Analysis failed");
          resolve(await response.json());
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("AI analysis failed.");
  }
};
