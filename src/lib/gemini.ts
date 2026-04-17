import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

export async function askTutor(prompt: string, mode: 'teach' | 'solve' | 'revise' | 'question' | 'test' | 'assignment', subject: string) {
  try {
    const systemPrompt = `You are Eclipse AI, a world-class academic tutor. You are currently teaching ${subject}.
    Your mode is: ${mode}.
    - "teach": Explain concepts clearly and simply. Use analogies.
    - "solve": Help solve a specific problem step-by-step. Don't just give the answer, guide the student.
    - "revise": Help the student review key points.
    - "question": Ask the student deep questions to test their understanding.
    - "test": Provide a practice question and grade their response.
    - "assignment": Help structure or brainstorm for an assignment.
    
    Keep responses academic, encouraging, and clear. Use Markdown for formatting.`;

    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [systemPrompt, prompt]
    });
    return result.text;
  } catch (error) {
    console.error("Gemini Tutor Error:", error);
    throw new Error("Tutor is currently offline. Please try again later.");
  }
}

export async function summarizeChat(messages: { role: string, content: string }[]) {
  try {
    const chatText = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const prompt = `Please provide a concise summary of the following educational chat session. Highlight the key concepts discussed and the student's progress.\n\n${chatText}`;
    
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });
    return result.text;
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
    const response = await fetch(imageUrl);
    const blob = await response.blob();
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

    const result = await ai.models.generateContent({
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
            Return the response in JSON format.`
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

    const diagnostic = JSON.parse(result.text || '{}');
    return diagnostic;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("AI was unable to analyze the paper at this time. Please ensure the image is clear.");
  }
};
