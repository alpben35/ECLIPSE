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

    const response = await fetch('/api/gemini', {
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
      throw new Error("Tutor service is preparing. Please try again in a moment.");
    }

    if (!response.ok) {
      const text = await response.text();
      try {
        const err = JSON.parse(text);
        throw new Error(err.error || "Tutor error");
      } catch (e) {
        throw new Error(text || "Tutor error");
      }
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

    const response = await fetch('/api/gemini?stream=true', {
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
      throw new Error("Tutor service is preparing. Please try again in a moment.");
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

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Stream not supported");

    const decoder = new TextDecoder();
    let partialLine = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = (partialLine + chunk).split("\n");
      partialLine = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const dataStr = trimmed.replace("data: ", "").trim();
          if (dataStr === "[DONE]") return;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.text) {
              onChunk(parsed.text);
            }
            if (parsed.error) throw new Error(parsed.error);
          } catch (e) {
            // Partial JSON segment - should not happen with full lines but safety first
          }
        }
      }
    }
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
    const response = await fetch('/api/tutor/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: sanitizedMessages })
    });

    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('text/html')) {
      throw new Error("Tutor service is preparing. Please try again in a moment.");
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
          const response = await fetch('/api/tutor/analyze-paper', {
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
