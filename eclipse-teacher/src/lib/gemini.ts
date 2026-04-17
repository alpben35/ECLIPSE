export const tutorModel = "gemini-2.0-flash";

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
    if (!navigator.onLine) {
      throw new Error("You are offline. Please connect to the internet to use the AI teacher assistant.");
    }

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction,
        model: tutorModel
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch from Gemini API');
    }

    const data = await response.json();
    const text = data.text || "";
    if (!text) {
      throw new Error("The AI returned an empty response. Please try again.");
    }
    
    return text.replace(/\$/g, '');
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

export async function summarizeChat(messages: { role: string, content: string }[]) {
  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  try {
    if (!navigator.onLine) {
      throw new Error("You are offline. Please connect to the internet to summarize.");
    }

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: "You are a helpful assistant that summarizes educational chat sessions for teachers. Keep it structured and brief.",
        model: tutorModel
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch from Gemini API');
    }

    const data = await response.json();
    const text = data.text || "";
    return text.replace(/\$/g, '');
  } catch (error) {
    console.error("Gemini Summarization Error:", error);
    throw error;
  }
}
