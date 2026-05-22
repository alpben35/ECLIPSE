import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const buildDirname = typeof __dirname !== 'undefined' 
  ? __dirname 
  : path.dirname(fileURLToPath((import.meta as any)['url']));

// 1. dotenv loads .env correctly before any API code or SDK initialization runs
try {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(buildDirname, '.env') });
} catch (envErr: any) {
  console.warn(`[Dotenv] Error attempting to load .env manually: ${envErr.message}`);
}
dotenv.config(); // fallback standard load

// 2. GEMINI_API_KEY is validated at startup
const startupApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!startupApiKey) {
  console.error("❌ [Startup Validation Error] GEMINI_API_KEY is not defined in .env or system environment variables!");
} else if (startupApiKey.trim().length === 0) {
  console.error("❌ [Startup Validation Error] GEMINI_API_KEY is defined but empty!");
} else {
  console.log("🚀 [Startup Validation Success] GEMINI_API_KEY is successfully loaded and validated on startup.");
}

import express from 'express';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

if (process.cwd() !== buildDirname && fs.existsSync(buildDirname)) {
  try {
    process.chdir(buildDirname);
    console.log(`[CWD Fix] Changed working directory to: ${buildDirname}`);
  } catch (err: any) {
    console.error(`[CWD Fix] Failed to change working directory: ${err.message}`);
  }
}

// Support VitePWA reading parent package.json when running inside the sandbox container
try {
  const parentPkg = path.resolve(buildDirname, '../package.json');
  if (!fs.existsSync(parentPkg)) {
    const ourPkgPath = path.resolve(buildDirname, 'package.json');
    if (fs.existsSync(ourPkgPath)) {
      fs.copyFileSync(ourPkgPath, parentPkg);
      console.log(`[CWD Fix] Successfully resolved parent package.json at: ${parentPkg}`);
    } else {
      fs.writeFileSync(parentPkg, JSON.stringify({ version: "0.0.0" }));
      console.log(`[CWD Fix] Created dummy package.json at: ${parentPkg}`);
    }
  }
} catch (e: any) {
  console.log(`[CWD Fix] Parent package.json helper skipped: ${e.message}`);
}

let stripeClient: Stripe | null = null;
function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is missing. Please provide it in the Settings > Secrets panel.');
    }
    stripeClient = new Stripe(key, {
      apiVersion: '2025-01-27.acacia' as any
    });
  }
  return stripeClient;
}

let genAIClient: GoogleGenAI | null = null;

function hasGeminiKey(): boolean {
  let key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (key === 'undefined' || key === 'null' || !key || key.trim().length === 0) {
    key = undefined;
  }
  if (!key && firebaseConfig && firebaseConfig.apiKey) {
    const fallbackKey = firebaseConfig.apiKey;
    if (fallbackKey !== 'undefined' && fallbackKey !== 'null' && fallbackKey.trim().length > 0) {
      return true;
    }
  }
  return Boolean(key);
}

function getAI() {
  if (!genAIClient) {
    let key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (key === 'undefined' || key === 'null' || !key || key.trim().length === 0) {
      key = undefined;
    }
    
    // Robust fallback to project's API key from firebase-applet-config.json if environment variable is missing
    if (!key && firebaseConfig && firebaseConfig.apiKey) {
      const fallbackKey = firebaseConfig.apiKey;
      if (fallbackKey !== 'undefined' && fallbackKey !== 'null' && fallbackKey.trim().length > 0) {
        console.log("[Gemini Helper] Environment API key not found. Using API key from firebase-applet-config.json as fallback.");
        key = fallbackKey;
      }
    }

    if (!key) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    genAIClient = new GoogleGenAI({ 
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAIClient;
}

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
];

// Initialize Firebase Admin safely on startup (file load only)
let firebaseConfig: any = {};
try {
  // Look for config in multiple locations to support both dev and bundled production
  const possiblePaths = [
    path.join(buildDirname, 'firebase-applet-config.json'),
    path.join(buildDirname, '..', 'firebase-applet-config.json'),
    path.join(process.cwd(), 'firebase-applet-config.json')
  ];
  
  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      console.log(`[Firebase Admin] Loading config from: ${configPath}`);
      firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      break;
    }
  }
} catch (configErr: any) {
  console.warn(`[Firebase Admin] Handled config load failure: ${configErr.message}`);
}

let dbClient: admin.firestore.Firestore | null = null;

function getDb(): admin.firestore.Firestore {
  if (!dbClient) {
    try {
      if (!admin.apps.length) {
        const projectId = firebaseConfig.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
        console.log(`[Firebase Admin] Initializing with Project ID: ${projectId || 'Default'}...`);
        admin.initializeApp({
          projectId: projectId
        });
      }
      
      const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
      dbClient = getFirestore(admin.app(), databaseId);
      console.log(`[Firebase Admin] Initialized. Project: ${admin.app().options.projectId}, Database: ${databaseId}`);
    } catch (error: any) {
      console.error('[Firebase Admin] Initialization failed:', error.message);
      if (!admin.apps.length) {
        try {
          admin.initializeApp();
        } catch (e) {}
      }
      dbClient = getFirestore();
    }
  }
  return dbClient;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);

  // Request logging middleware for /api routes to track integration hits
  app.use('/api', (req, res, next) => {
    console.log(`[API Request] ${req.method} ${req.originalUrl || req.url}`);
    next();
  });

  // 3. GET /api/health returning JSON
  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
    });
  });

  // Stripe Webhook (Raw body required for signature verification)
  app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      if (endpointSecret && sig) {
        event = getStripe().webhooks.constructEvent(req.body, sig, endpointSecret);
      } else {
        // Fallback for local testing without signature verification if secret is missing
        event = JSON.parse(req.body.toString());
      }
    } catch (err: any) {
      console.error(`[Stripe Webhook Error] ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`[Stripe Webhook] Event Received: ${event.type}`);

    try {
      const dataObject = event.data.object as any;

      switch (event.type) {
        case 'checkout.session.completed': {
          const userId = dataObject.client_reference_id;
          const tierId = dataObject.metadata?.tierId || 'premium';
          
          if (userId) {
            await getDb().collection('users').doc(userId).update({
              stripeCustomerId: dataObject.customer,
              tier: tierId, 
              subscriptionStatus: 'active',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[Stripe Webhook] User ${userId} upgraded to ${tierId}`);
          }
          break;
        }
        case 'invoice.paid': {
          const customerId = dataObject.customer;
          if (customerId) {
            const users = await getDb().collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
            if (!users.empty) {
              await users.docs[0].ref.update({
                subscriptionStatus: 'active',
                lastPayment: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          }
          break;
        }
        case 'invoice.payment_failed': {
          const customerId = dataObject.customer;
          if (customerId) {
            const users = await getDb().collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
            if (!users.empty) {
              await users.docs[0].ref.update({ subscriptionStatus: 'past_due' });
            }
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const customerId = dataObject.customer;
          if (customerId) {
            const users = await getDb().collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
            if (!users.empty) {
              await users.docs[0].ref.update({
                tier: 'free',
                subscriptionStatus: 'canceled'
              });
            }
          }
          break;
        }
      }
      res.json({ received: true });
    } catch (error: any) {
      console.error('[Stripe Webhook] Processing Error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Stripe Checkout
  app.post('/api/create-checkout-session', async (req, res) => {
    try {
      let { priceId, userId, userEmail, tierId } = req.body;

      // Robust Price ID selection: backend mapping from tierId is safest
      console.log(`[Stripe Checkout] Request received for tier: ${tierId}, current priceId: ${priceId}`);
      
      if (!priceId || priceId === 'undefined') {
        console.log(`[Stripe Checkout] PriceId invalid/missing from client, attempting backend fallback for ${tierId}`);
        if (tierId === 'premium') priceId = process.env.STRIPE_PRICE_ID_PREMIUM;
        else if (tierId === 'serious') priceId = process.env.STRIPE_PRICE_ID_SERIOUS;
        else if (tierId === 'admin') priceId = process.env.STRIPE_PRICE_ID_ADMIN;
        console.log(`[Stripe Checkout] Backend fallback result: ${priceId}`);
      }

      if (!priceId || priceId === 'undefined') {
        console.error(`[Stripe Checkout] CRITICAL: No Price ID found for tier "${tierId}"`);
        return res.status(400).json({ 
          error: `Stripe Configuration Missing: No Price ID found for tier "${tierId}". Please set STRIPE_PRICE_ID_SERIOUS, STRIPE_PRICE_ID_PREMIUM, and STRIPE_PRICE_ID_ADMIN in the Secrets panel.` 
        });
      }

      console.log(`[Stripe Checkout] Creating session for User:${userId}, Tier:${tierId}, Price:${priceId}`);

      const session = await getStripe().checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId.trim(), quantity: 1 }],
        mode: 'subscription',
        success_url: `${req.headers.origin}/progress?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/subscription`,
        client_reference_id: userId,
        customer_email: userEmail,
        metadata: { userId, tierId: tierId || 'premium' },
        subscription_data: { metadata: { userId, tierId: tierId || 'premium' } }
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('[Stripe Checkout Error]', error);
      res.status(500).json({ 
        error: `Stripe error: ${error.message}. Make sure your STRIPE_SECRET_KEY is valid and the Price ID exists in your Stripe dashboard.` 
      });
    }
  });

  // Stripe Customer Portal
  app.post('/api/create-portal-session', async (req, res) => {
    try {
      const { customerId } = req.body;
      if (!customerId) return res.status(400).json({ error: 'Customer ID required' });

      const session = await getStripe().billingPortal.sessions.create({
        customer: customerId,
        return_url: `${req.headers.origin}/subscription`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('[Stripe Portal] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Helper with Robust Round-Based Fallbacks, Exponential Backoff, and Mid-Stream Safety
const TEXT_MODEL_FALLBACKS = [
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite'
];

async function callGemini(params: {
  contents: any[],
  systemInstruction?: string,
  model?: string,
  temperature?: number,
  isStream?: boolean,
  onChunk?: (text: string) => void,
  responseMimeType?: string
}) {
  const primaryModel = params.model || 'gemini-3.5-flash';
  
  // Set up sequential model fallback order starting from the requested model, falling back to alternatives
  let modelSequence = [...TEXT_MODEL_FALLBACKS];
  const reqIndex = modelSequence.indexOf(primaryModel);
  if (reqIndex !== -1) {
    modelSequence = modelSequence.slice(reqIndex);
  } else {
    modelSequence = [primaryModel, ...modelSequence];
  }

  let lastError: any = null;
  const maxRounds = 3; // Number of times to cycle through the entire sequence of engines
  
  for (let round = 0; round < maxRounds; round++) {
    for (let modelIdx = 0; modelIdx < modelSequence.length; modelIdx++) {
      const currentModelName = modelSequence[modelIdx];
      let yieldedAny = false;
      
      try {
        console.log(`[Gemini Helper] [Round ${round + 1}/${maxRounds}] Trying model: ${currentModelName}...`);
        
        const config: any = {
          systemInstruction: params.systemInstruction,
          temperature: params.temperature ?? 0.0,
          safetySettings
        };

        if (params.responseMimeType) {
          config.responseMimeType = params.responseMimeType;
        }

        if (params.isStream && params.onChunk) {
          const stream = await getAI().models.generateContentStream({
            model: currentModelName,
            contents: params.contents,
            config
          });
          
          for await (const chunk of stream) {
            if (chunk.text) {
              yieldedAny = true;
              params.onChunk(chunk.text);
            }
          }
          return;
        } else {
          const response = await getAI().models.generateContent({
            model: currentModelName,
            contents: params.contents,
            config
          });
          return response.text || "";
        }
      } catch (error: any) {
        lastError = error;
        
        // If we already successfully yielded text to the client mid-stream,
        // we MUST NOT retry with a new model or connection because doing so
        // would repeat early segments. Bubble the error up to let the stream close naturally.
        if (yieldedAny) {
          console.error(`[Gemini Helper] Stream disconnected mid-way after yielding content on ${currentModelName}. Bubbling error to prevent duplicate outputs.`);
          throw error;
        }

        const errMessage = error.message || "";
        const errStatus = error.status || error.code || error.error?.code || "";
        
        const isApiKeyBlocked = errMessage.includes('blocked') || 
                                errMessage.includes('API_KEY_SERVICE_BLOCKED') || 
                                errMessage.includes('restricted') || 
                                errStatus === 403 ||
                                errMessage.includes('PERMISSION_DENIED');
        
        if (isApiKeyBlocked) {
          console.error("[Gemini Helper] Blocked key detected. Please add a valid GEMINI_API_KEY environment variable.");
          throw new Error("Gemini API Authorization Failed. If you are running outside of AI Studio, please configure your GEMINI_API_KEY environment variable in your hosting platform (e.g., Firebase App Hosting, Cloud Run, or Render dashboard). Default Firebase Keys do not have Generative AI permissions.");
        }

        const is503 = errStatus === 503 || 
                      errMessage.includes('503') || 
                      errMessage.includes('UNAVAILABLE') || 
                      errMessage.includes('Overloaded') || 
                      errMessage.includes('Service Unavailable') ||
                      errMessage.includes('high demand') ||
                      errMessage.includes('temporary');
                      
        const is429 = errStatus === 429 || 
                      errMessage.includes('429') || 
                      errMessage.includes('RESOURCE_EXHAUSTED') || 
                      errMessage.includes('Rate limit') || 
                      errMessage.includes('Too Many Requests');
                      
        const is404 = errStatus === 404 || 
                      errMessage.includes('404') || 
                      errMessage.includes('NOT_FOUND');

        const isTemporaryError = is503 || is429 || is404;

        if (isTemporaryError) {
          // If there is another model available in this sequence, immediately try it without sleeping!
          if (modelIdx < modelSequence.length - 1) {
            const nextModelName = modelSequence[modelIdx + 1];
            console.warn(`[Gemini Helper] Model ${currentModelName} failed (${is503 ? '503 Overloaded' : is429 ? '429 Rate Limit' : '404 Not Found'}). Immediately pivoting to fallback ${nextModelName}...`);
            continue;
          }
          
          // If all models in the sequence failed, apply exponential backoff before the next round begins
          if (round < maxRounds - 1 && modelIdx === modelSequence.length - 1) {
            const delay = Math.pow(2, round) * 1500 + Math.random() * 1000;
            console.warn(`[Gemini Helper] Entire model sequence busy in Round ${round + 1}. Backing off for ${Math.round(delay)}ms before starting Round ${round + 2}...`);
            await new Promise(r => setTimeout(r, delay));
            break; // Breaks out of the model sequence loop to trigger the next backoff round
          }
        }

        // Fatal/Non-temporary error (e.g. invalid arguments or billing issues), throw instantly
        throw error;
      }
    }
  }

  // Raise standard user-friendly rate limit error or last fallback exception
  if (lastError?.message?.includes('RESOURCE_EXHAUSTED') || lastError?.message?.includes('429')) {
    throw new Error("The AI is currently receiving too many requests. Please wait a few seconds and try again.");
  }
  throw lastError;
}

// AI Proxy Routes
  app.post('/api/tutor/ask', async (req, res) => {
    try {
      if (!hasGeminiKey()) {
        return res.status(500).json({
          error: 'Missing GEMINI_API_KEY in environment variables and no fallback key is configured'
        });
      }

      const { prompt, mode, subject, history, imageData } = req.body;
      
      const contents = (history || []).map((m: any) => ({
        role: m.role === 'ai' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const userParts: any[] = [];
      if (imageData) {
        userParts.push({ 
          inlineData: {
            data: imageData.data,
            mimeType: imageData.mimeType
          }
        });
      }
      userParts.push({ text: prompt || "Please assist." });
      contents.push({ role: 'user', parts: userParts });

      const modelName = 'gemini-3.5-flash'; 
      
      const systemPrompt = `You are Eclipse AI, a world-class academic tutor. 
      Your primary goal is absolute mathematical and factual accuracy.
      
      TONE:
      - Academic, professional, encouraging, and highly educational.
      - Use standard formatting for clarity.
      
      PRECISION:
      - Double-check all calculations.
      - Read inputs with 100% precision.
      
      CRITICAL FORMATTING:
      - DO NOT use LaTeX delimiters like '$', '\\(', '\\)', '\\[', or '\\]'. 
      - DO NOT use structural symbols like backslashes, braces, or dollar signs for formula formatting.
      - Always write symbols and formulas in plain text (e.g. x^2, sqrt(x), H2O).
      - Use bolding for emphasis (**bold**).
      
      Current Mode: ${mode}
      Current Subject: ${subject}
 
      YOU MUST STRICTLY ADHERE TO THE ACTIVE MODE INSTRUCTIONS BELOW:

      1. MODE 'teach' (SOCRATIC TEACHING):
         - CRITICAL: Never provide the final answer or a fully worked final solution immediately!
         - Act as a Socratic tutor: break down the user's problem.
         - Explain the fundamental concept or formula involved first.
         - Ask a targeted, friendly question at the end to guide the student's next step (e.g., "What is the first step to isolate x?").
         - Let the user reply and build up to the solution.

      2. MODE 'solve' (DIRECT STEP-BY-STEP SOLUTION):
         - CRITICAL: Provide the complete, final answer and standard solution immediately!
         - Start the response with a bold final answer block (e.g., "**Final Answer:** [result]").
         - Provide a clear, step-by-step mathematical walkthrough.
         - Double-check the math for 100% reliability.

      3. MODE 'revise' (PRACTICE AND ASSESSMENT):
         - CRITICAL: Do NOT solve the user's question directly.
         - Outline 2-3 quick active-recall memory highlights about the concept.
         - Present 2-3 interactive practice/quiz questions (from easy to hard) challenging the user to solve them.
         - Prompt the user: "Give these custom practice questions a shot, reply with your answers, and I will grade them!";`;
 
      const text = await callGemini({
        contents,
        systemInstruction: systemPrompt,
        model: modelName
      });
 
      res.json({ text });
    } catch (error: any) {
      console.error("[AI Proxy Error]", error);
      res.status(500).json({ error: error.message });
    }
  });
 
  app.post('/api/tutor/ask-stream', async (req, res) => {
    try {
      if (!hasGeminiKey()) {
        return res.status(500).json({
          error: 'Missing GEMINI_API_KEY in environment variables and no fallback key is configured'
        });
      }

      const { prompt, mode, subject, history, imageData } = req.body;
 
      const contents = (history || []).map((m: any) => ({
        role: m.role === 'ai' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
 
      const userParts: any[] = [];
      if (imageData) {
        userParts.push({ 
          inlineData: {
            data: imageData.data,
            mimeType: imageData.mimeType
          }
        });
      }
      userParts.push({ text: prompt || "Please assist." });
      contents.push({ role: 'user', parts: userParts });
 
      const systemPrompt = `You are Eclipse AI, a world-class academic tutor. 
      Your primary goal is absolute mathematical and factual accuracy.
      
      TONE:
      - Academic, professional, encouraging, and highly educational.
      - Use standard formatting for clarity.
      
      PRECISION:
      - Double-check all calculations.
      - Read inputs with 100% precision.
      
      CRITICAL FORMATTING RULES FOR MATH AND SCIENCE:
      - DO NOT use LaTeX delimiters like '$', '\\(', '\\)', '\\[', or '\\]'.
      - DO NOT use structural symbols like backslashes, braces, or dollar signs for formatting formulas.
      - Always write symbols and formulas in plain text or simple markdown (e.g., x^2, sqrt(x), H2O).
      - For fractions, use 'x/y' or 'x divided by y'.
      - Use bolding for emphasis, but keep formulas clean and human-readable without any code-like markers.
      
      Current Mode: ${mode}
      Current Subject: ${subject}
 
      YOU MUST STRICTLY ADHERE TO THE ACTIVE MODE INSTRUCTIONS BELOW:

      1. MODE 'teach' (SOCRATIC TEACHING):
         - CRITICAL: Never provide the final answer or a fully worked final solution immediately!
         - Act as a Socratic tutor: break down the user's problem.
         - Explain the fundamental concept or formula involved first.
         - Ask a targeted, friendly question at the end to guide the student's next step (e.g., "What is the first step to isolate x?").
         - Let the user reply and build up to the solution.

      2. MODE 'solve' (DIRECT STEP-BY-STEP SOLUTION):
         - CRITICAL: Provide the complete, final answer and standard solution immediately!
         - Start the response with a bold final answer block (e.g., "**Final Answer:** [result]").
         - Provide a clear, step-by-step mathematical walkthrough.
         - Double-check the math for 100% reliability.

      3. MODE 'revise' (PRACTICE AND ASSESSMENT):
         - CRITICAL: Do NOT solve the user's question directly.
         - Outline 2-3 quick active-recall memory highlights about the concept.
         - Present 2-3 interactive practice/quiz questions (from easy to hard) challenging the user to solve them.
         - Prompt the user: "Give these custom practice questions a shot, reply with your answers, and I will grade them!";`;
 
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
 
      await callGemini({
        contents,
        systemInstruction: systemPrompt,
        model: 'gemini-3.5-flash',
        isStream: true,
        onChunk: (text) => {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      });
 
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error("[AI Stream Proxy Error]", error);
      res.status(500).write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  });
 
  app.post('/api/tutor/summarize', async (req, res) => {
    try {
      if (!hasGeminiKey()) {
        return res.status(500).json({
          error: 'Missing GEMINI_API_KEY in environment variables and no fallback key is configured'
        });
      }

      const { messages } = req.body;
      const contents = messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));
      
      const text = await callGemini({
        contents,
        systemInstruction: "You are a helpful academic assistant summarizing a learning session. Use clean markdown for summaries.",
        model: 'gemini-3.5-flash',
        temperature: 0.1
      });
  
      res.json({ text });
    } catch (error: any) {
      console.error("[AI Summarize Error]", error);
      res.status(500).json({ error: error.message });
    }
  });
 
  app.post('/api/tutor/analyze-paper', async (req, res) => {
    try {
      if (!hasGeminiKey()) {
        return res.status(500).json({
          error: 'Missing GEMINI_API_KEY in environment variables and no fallback key is configured'
        });
      }

      const { base64Data, mimeType, subject } = req.body;
      const text = await callGemini({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: base64Data, mimeType } },
              { text: `Analyze this ${subject} paper and return a diagnostic assessment in JSON format. Use fields: summary, strengths (array), weaknesses (array), improvementTips (array), overallGrade.` }
            ]
          }
        ],
        model: 'gemini-3.5-flash',
        temperature: 0.1,
        responseMimeType: 'application/json'
      });
 
      let cleanedText = (text || '{}').trim();
      if (cleanedText.includes('```')) {
        const jsonMatch = cleanedText.match(/```json\s*([\s\S]*?)\s*```/i) || cleanedText.match(/```\s*([\s\S]*?)\s*```/i);
        if (jsonMatch) {
          cleanedText = jsonMatch[1];
        } else {
          cleanedText = cleanedText.replace(/```[a-zA-Z]*|```/g, '');
        }
      }
      cleanedText = cleanedText.trim();

      try {
        const parsed = JSON.parse(cleanedText);
        res.json(parsed);
      } catch (parseError) {
        console.error("[AI Analyze Parser Error] Failed to parse text:", cleanedText, parseError);
        res.json({
          summary: cleanedText.substring(0, 1000),
          strengths: ["Analyzed paper successfully"],
          weaknesses: [],
          improvementTips: [],
          overallGrade: "N/A"
        });
      }
    } catch (error: any) {
      console.error("[AI Analyze Error]", error);
      res.status(500).json({ error: error.message });
    }
  });
 
  app.post('/api/gemini', async (req, res) => {
    try {
      if (!hasGeminiKey()) {
        return res.status(500).json({
          error: 'Missing GEMINI_API_KEY in environment variables and no fallback key is configured'
        });
      }

      const { contents, systemInstruction, model, prompt, mode, subject, history, imageData } = req.body;

      let finalContents = contents;
      let finalSystemInstruction = systemInstruction;

      // Translate legacy/tutor body format to contents if only prompt is present
      if (!finalContents && prompt) {
        finalContents = (history || []).map((m: any) => ({
          role: m.role === 'ai' || m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const userParts: any[] = [];
        if (imageData) {
          userParts.push({ 
            inlineData: {
              data: imageData.data,
              mimeType: imageData.mimeType
            }
          });
        }
        userParts.push({ text: prompt || "Please assist." });
        finalContents.push({ role: 'user', parts: userParts });

        finalSystemInstruction = `You are Eclipse AI, a world-class academic tutor. 
Your primary goal is absolute mathematical and factual accuracy.

TONE:
- Academic, professional, and encouraging.
- Use standard formatting for clarity.

PRECISION:
- Double-check all calculations.
- Read inputs with 100% precision.

CRITICAL FORMATTING:
- DO NOT use LaTeX delimiters like '$', '\\(', '\\)', '\\[', or '\\]'. 
- DO NOT use structural symbols like backslashes, braces, or dollar signs for formula formatting.
- Always write symbols and formulas in plain text (e.g. x^2, sqrt(x)).
- Use bolding for emphasis (**bold**).

Current Mode: ${mode || 'teach'}
Current Subject: ${subject || 'general'}

Instructions:
- 'teach': Guide step-by-step SOCRATICALLY. Do not give the answer immediately.
- 'solve': Provide complete, perfectly accurate solutions.
- 'revise': Create practice questions to verify understanding.`;
      }

      const text = await callGemini({
        contents: finalContents || [{ role: 'user', parts: [{ text: prompt || '' }] }],
        systemInstruction: finalSystemInstruction,
        model: model || 'gemini-3.5-flash',
        temperature: 0.1
      });

      res.json({ text });
    } catch (error: any) {
      console.error('Gemini API error:', error);
      res.status(500).json({
        error: 'Gemini API failed',
        details: error.message
      });
    }
  });

  // API Error Handler
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[API Route Error Handler]:', err);
    if (res.headersSent) {
      console.warn('[API Route Error Handler] Headers already sent. Ending response.');
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }
    res.status(err.status || 500).json({
      error: 'API Error',
      details: err.message || String(err) || 'An unexpected API error occurred.'
    });
  });

  // API 404 should return JSON
  app.use('/api', (req, res) => {
    res.status(404).json({
      error: 'API route not found'
    });
  });

  // Redirect favicon.ico to app-icon.svg to avoid returning HTML page for favicon requests
  app.get('/favicon.ico', (req, res) => {
    res.redirect('/app-icon.svg');
  });

  // Robustly determine if we are running in production mode (e.g. bundled server inside dist, or with NODE_ENV=production)
  const isProduction = process.env.NODE_ENV === 'production' || 
                       buildDirname.endsWith('dist') ||
                       (fs.existsSync(path.join(buildDirname, 'index.html')) && !fs.existsSync(path.join(buildDirname, 'server.ts')));

  // Vite middleware for development
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: buildDirname,
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Dynamically locate the static dist files whether we run relative to root or within dist
    let distPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      if (fs.existsSync(path.join(process.cwd(), 'index.html'))) {
        distPath = process.cwd();
      } else if (fs.existsSync(path.join(buildDirname, 'index.html'))) {
        distPath = buildDirname;
      }
    }
    console.log(`[Hosting] Serving static content from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const ext = path.extname(req.path).toLowerCase();
      const isStaticOrApi = req.path === '/api' || 
                            req.path.startsWith('/api/') || 
                            ['.ico', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.css', '.js', '.json', '.map'].includes(ext);
                            
      if (isStaticOrApi) {
        if (req.path.startsWith('/api/') || req.path === '/api') {
          return res.status(404).json({ error: `Not Found: GET ${req.path}` });
        }
        return res.status(404).send('Not Found');
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global safety/fallback error handler to catch ALL unhandled errors cleanly
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Global Catch-All Error Handler]:', err);
    if (res.headersSent) {
      return next(err);
    }
    if (req.path.startsWith('/api/') || req.path === '/api') {
      return res.status(err.status || 500).json({
        error: 'Server Error',
        details: err.message || String(err) || 'An unexpected server error occurred.'
      });
    }
    res.status(err.status || 500).send(`
      <!DOCTYPE html>
      <html>
        <head><title>System Error</title></head>
        <body style="font-family:sans-serif;padding:3rem;background:#030712;color:#f3f4f6;text-align:center;">
          <h2 style="color:#ef4444;">Application Error</h2>
          <p style="margin:1rem 0;color:#9ca3af;">${err.message || 'An unexpected error occurred.'}</p>
          <a href="/" style="display:inline-block;padding:0.5rem 1rem;background:#3b82f6;color:white;border-radius:0.375rem;text-decoration:none;">Go back home</a>
        </body>
      </html>
    `);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Server Startup Error]', err);
  process.exit(1);
});
