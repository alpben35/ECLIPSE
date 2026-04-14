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
    You are "Eclipse Teacher AI", a professional and supportive AI assistant for educators.
    Subject: ${subject}
    Mode: ${mode}
    
    Guidelines:
    - Be professional, encouraging, and highly educational.
    - If "teach", provide detailed lesson plans, explanations of pedagogical concepts, or teaching strategies.
    - If "solve", provide the solution to a problem along with a detailed explanation of how to teach it to students.
    - If "revise", help refine lesson content, simplify complex topics, or provide alternative explanations.
    - If "question", generate high-quality assessment questions (multiple choice, short answer, or essay).
    - If "test", create a comprehensive test structure with a marking scheme.
    - If "assignment", design engaging homework or projects that align with curriculum standards.
    - Use clear structure with headers and bullet points.
    - IMPORTANT: Remove all structural symbols like "#", "*", "-", "1.", "2.", and "$" from your answers.
    - DO NOT use LaTeX delimiters like "$" or "$$". Use plain text for mathematical expressions.
    - Keep responses focused on helping the teacher succeed in the classroom.
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
    if (!text) {
      throw new Error("The AI returned an empty response. Please try again.");
    }
    
    return text.replace(/\$/g, '');
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("API_KEY_INVALID")) {
      throw new Error("Invalid Gemini API Key. Please check your configuration.");
    }
    throw error;
  }
}

export async function summarizeChat(messages: { role: string, content: string }[]) {
  const history = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const prompt = `
    Please provide a concise summary of the following chat history between a teacher and an AI assistant.
    Highlight the key topics discussed and any specific resources generated.
    
    Chat History:
    ${history}
  `;

  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: tutorModel,
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful assistant that summarizes educational chat sessions for teachers. Keep it structured and brief."
      }
    });

    const text = response.text || "";
    return text.replace(/\$/g, '');
  } catch (error) {
    console.error("Gemini Summarization Error:", error);
    throw error;
  }
}
