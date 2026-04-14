import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Please check your environment variables.");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export const tutorModel = "gemini-3-flash-preview";

export async function askTutor(prompt: string, mode: 'teach' | 'solve' | 'revise' | 'question' | 'test' | 'assignment', subject: string) {
  const systemInstruction = `
    You are "Eclipse", a friendly AI tutor.
    Subject: ${subject}
    Mode: ${mode}
    
    Guidelines:
    - Be concise and direct.
    - If "teach", guide the student step-by-step.
    - If "solve", give the answer immediately.
    - If "revise", provide a quick summary or synonyms.
    - If "question", create a challenging question for the student.
    - If "test", create a short test (3-5 questions).
    - If "assignment", create a homework assignment.
    - IMPORTANT: Remove all structural symbols like "#", "*", "-", "1.", "2.", and "$" from your answers. Use plain text and spacing for structure.
    - DO NOT use LaTeX delimiters like "$" or "$$". Use plain text for mathematical expressions.
    - Avoid complex LaTeX unless needed.
    - Keep responses brief to ensure speed.
  `;

  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: tutorModel,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction
      }
    });

    const text = response.text || "";
    return text.replace(/\$/g, '');
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

export async function summarizeChat(messages: { role: string, content: string }[]) {
  const history = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const prompt = `
    Please provide a concise summary of the following chat history between a student and an AI tutor.
    Highlight the key concepts discussed and any specific problems solved.
    
    Chat History:
    ${history}
  `;

  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: tutorModel,
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful assistant that summarizes educational chat sessions. Keep it structured and brief."
      }
    });

    const text = response.text || "";
    return text.replace(/\$/g, '');
  } catch (error) {
    console.error("Gemini Summarization Error:", error);
    throw error;
  }
}
