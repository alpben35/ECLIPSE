import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import Stripe from 'stripe';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

dotenv.config();

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
function getAI() {
  if (!genAIClient) {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not set in environment. Please visit the Settings > Secrets panel in AI Studio to provide your API key.');
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

const buildDirname = typeof __dirname !== 'undefined' 
  ? __dirname 
  : path.dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin
let db: admin.firestore.Firestore;
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

  if (!admin.apps.length) {
    const projectId = firebaseConfig.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
    console.log(`[Firebase Admin] Initializing with Project ID: ${projectId || 'Default'}...`);
    admin.initializeApp({
      projectId: projectId
    });
  }
  
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  db = getFirestore(admin.app(), databaseId);
  
  console.log(`[Firebase Admin] Initialized. Project: ${admin.app().options.projectId}, Database: ${databaseId}`);
} catch (error: any) {
  console.error('[Firebase Admin] Initialization failed:', error.message);
  if (!admin.apps.length) admin.initializeApp();
  db = getFirestore();
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);

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
            await db.collection('users').doc(userId).update({
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
            const users = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
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
            const users = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
            if (!users.empty) {
              await users.docs[0].ref.update({ subscriptionStatus: 'past_due' });
            }
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const customerId = dataObject.customer;
          if (customerId) {
            const users = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
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
        else if (tierId === 'admin') priceId = process.env.STRIPE_PRICE_ID_ADMIN;
        console.log(`[Stripe Checkout] Backend fallback result: ${priceId}`);
      }

      if (!priceId || priceId === 'undefined') {
        console.error(`[Stripe Checkout] CRITICAL: No Price ID found for tier "${tierId}"`);
        return res.status(400).json({ 
          error: `Stripe Configuration Missing: No Price ID found for tier "${tierId}". Please set STRIPE_PRICE_ID_PREMIUM and STRIPE_PRICE_ID_ADMIN in the Secrets panel.` 
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

  // AI Proxy Routes
  app.post('/api/tutor/ask', async (req, res) => {
    try {
      const { prompt, mode, subject, history, imageData } = req.body;
      const isImageGen = mode === 'design';
      
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

      const modelName = isImageGen ? 'gemini-2.5-flash-image' : 'gemini-3-flash-preview'; 
      
      const systemPrompt = isImageGen 
        ? "You are Eclipse Vision, an expert AI designer. Manifest high-quality visual concepts from user descriptions. ALWAYS generate an image when asked. Be concise in text response."
        : `You are Eclipse AI, a world-class academic tutor. 
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
      
      Current Mode: ${mode}
      Current Subject: ${subject}

      Instructions:
      - 'teach': Guide step-by-step SOCRATICALLY. Do not give the answer immediately.
      - 'solve': Provide complete, perfectly accurate solutions.
      - 'revise': Create practice questions to verify understanding.`;

      const response = await getAI().models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: isImageGen ? 0.7 : 0.0,
          imageConfig: isImageGen ? { aspectRatio: '1:1' } : undefined,
          safetySettings
        }
      });

      const text = response.text || "";
      const images = response.candidates?.[0]?.content?.parts
        ?.filter((part: any) => part.inlineData)
        .map((part: any) => ({
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType
        }));

      res.json({ text, images: images && images.length > 0 ? images : undefined });
    } catch (error: any) {
      console.error("[AI Proxy Error]", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tutor/ask-stream', async (req, res) => {
    try {
      const { prompt, mode, subject, history, imageData } = req.body;
      const isImageGen = mode === 'design';

      if (isImageGen) {
        return res.status(400).json({ error: "Streaming not supported for image generation." });
      }

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
      - Academic, professional, and encouraging.
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

      Instructions:
      - Respond professionally. If in 'teach' mode, be Socratic and guide the student.`;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const stream = await getAI().models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.0,
          safetySettings
        }
      });

      for await (const chunk of stream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
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
      const { messages } = req.body;
      const contents = messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));
      
      const response = await getAI().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config: {
          systemInstruction: "You are a helpful academic assistant summarizing a learning session. Use clean markdown for summaries.",
          temperature: 0.1,
          safetySettings
        }
      });

      res.json({ text: response.text || "" });
    } catch (error: any) {
      console.error("[AI Summarize Error]", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tutor/analyze-paper', async (req, res) => {
    try {
      const { base64Data, mimeType, subject } = req.body;
      const response = await getAI().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: base64Data, mimeType } },
              { text: `Analyze this ${subject} paper and return a diagnostic assessment in JSON format. Use fields: summary, strengths (array), weaknesses (array), improvementTips (array), overallGrade.` }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          safetySettings
        }
      });

      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error("[AI Analyze Error]", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/gemini', async (req, res) => {
    try {
      const { contents, systemInstruction, model } = req.body;
      const response = await getAI().models.generateContent({
        model: model || 'gemini-3-flash-preview',
        contents,
        config: {
          systemInstruction,
          temperature: 0.1,
          safetySettings
        }
      });
      res.json({ text: response.text || "" });
    } catch (error: any) {
      console.error("[Gemini Proxy Error]", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Server Startup Error]', err);
  process.exit(1);
});
