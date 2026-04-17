import { GoogleGenAI, Type } from "@google/genai";

const getApiKey = () => {
  try {
    // Standard AI Studio production/dev access
    if (typeof process !== 'undefined' && process && process.env && process.env.GEMINI_API_KEY) {
      return process.env.GEMINI_API_KEY;
    }
  } catch (e) {
    console.warn("Process env access failed, falling back.");
  }
  
  // Fallbacks for browser environments
  const metaEnv = (import.meta as any).env;
  return metaEnv?.VITE_GEMINI_API_KEY || (window as any).GEMINI_API_KEY || "";
};

const ai = new GoogleGenAI({ 
  apiKey: getApiKey()
});

export async function askTutor(prompt: string, mode: 'teach' | 'solve' | 'revise' | 'question' | 'test' | 'assignment', subject: string, history: { role: 'user' | 'ai', content: string }[] = []) {
  try {
    const systemPrompt = `You are Eclipse AI, a world-class academic tutor. You are currently teaching ${subject}.
    Your mode is: ${mode}.
    - "teach": Explain concepts clearly and simply. Use analogies.
    - "solve": Help solve a specific problem step-by-step. Don't just give the answer, guide the student.
    - "revise": Help the student review key points.
    - "question": Ask the student deep questions to test their understanding.
    - "test": Provide a practice question and grade their response.
    - "assignment": Help structure or brainstorm for an assignment.
    
    IMPORTANT RULES:
    1. Do NOT include any "scaffolding symbols" or internal step labels like "Step 1:", "Reasoning:", "Step Id:", or technical artifacts in your response.
    2. Do NOT use dollar signs ($) or LaTeX delimiters for mathematical formulas or symbols UNLESS the user explicitly asks for LaTeX format. Always use plain text, words (e.g., "squared", "divided by"), or standard keyboard characters (e.g., ^ for power, * for multiply) when describing math.
    3. Provide clean, conversational, and direct tutor feedback.
    
    Keep responses academic, encouraging, and clear. Use Markdown for formatting.`;

    const chatContents = history.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        ...chatContents,
        { role: 'user', parts: [{ text: prompt }] }
      ]
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Tutor Error:", error);
    throw new Error("Tutor is currently offline. Please try again later.");
  }
}

export async function summarizeChat(messages: { role: string, content: string }[]) {
  try {
    const chatText = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const prompt = `Please provide a concise summary of the following educational chat session. Highlight the key concepts discussed and the student's progress.\n\n${chatText}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Summary Error:", error);
    throw new Error("Unable to summarize chat at this time.");
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
    // We need to fetch the image and convert to base64 for Gemini
    const imgResponse = await fetch(imageUrl);
    const blob = await imgResponse.blob();
    const reader = new FileReader();
    
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
    });
    
    reader.readAsDataURL(blob);
    const base64Data = await base64Promise;

    const geResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: blob.type || "image/jpeg",
              data: base64Data
            }
          },
          {
            text: `Analyze this study paper/worksheet related to the subject: ${subject}. 
            Provide a diagnostic assessment including a summary of the work, specific strengths, areas for improvement, and actionable tips for the student.
            Return the response in JSON format.
            
            IMPORTANT: Do NOT use dollar signs ($) or LaTeX delimiters in the text responses. Use plain text or standard academic terminology instead.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "A brief overview of the student's work or the homework solution." },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific things the student did well." },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific mistakes or concepts they struggled with." },
            improvementTips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Actionable advice for next time." },
            overallGrade: { type: Type.STRING, description: "An estimated grade or performance level (e.g., A, Satisfactory, Needs Work)." }
          },
          required: ["summary", "strengths", "weaknesses", "improvementTips"]
        }
      }
    });

    const diagnostic = JSON.parse(geResponse.text || '{}');
    return diagnostic;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("AI was unable to analyze the paper at this time. Please ensure the image is clear.");
  }
};
