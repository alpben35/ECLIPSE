import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import Stripe from 'stripe';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let db: admin.firestore.Firestore;
let firebaseConfig: any = {};

try {
  const configPath = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  // To prevent the "aud" mismatch, we must use the projectId from config for Auth.
  if (!admin.apps.length) {
    console.log(`[Firebase Admin] Initializing with Project ID: ${firebaseConfig.projectId || 'Default'}...`);
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
  
  // Try to initialize the database from config first
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
  const PORT = 3000;

  console.log(`[Server] Initialized with Project: ${firebaseConfig.projectId}, Database: ${firebaseConfig.firestoreDatabaseId}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[Server] WARNING: GEMINI_API_KEY is not set!');
  } else {
    console.log('[Server] GEMINI_API_KEY is present (length: ' + process.env.GEMINI_API_KEY.length + ')');
  }

  app.use(express.json());

  // Rate limiter for Gemini API
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Increased for tiered users
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
  });

  // Increment Prompt Count (Check Limit)
  app.post('/api/increment-prompts', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      console.log(`[Server] Verifying token for UID check (length: ${idToken?.length})`);
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log(`[Server] Token verified for UID: ${decodedToken.uid}`);
      } catch (error: any) {
        console.error('[Server] Token verification failed:', error.message);
        return res.status(401).json({ 
          error: 'Unauthorized: Invalid token',
          details: error.message
        });
      }

      const uid = decodedToken.uid;
      let userData: any = {};

      // NEW: Use User-Delegated REST API to bypass Service Account permission issues
      try {
        const projectId = firebaseConfig.projectId;
        const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/users/${uid}`;
        
        console.log(`[Server] Accessing Firestore via REST API for UID: ${uid}...`);
        
        const fsResponse = await fetch(firestoreUrl, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (fsResponse.ok) {
          const docData: any = await fsResponse.json();
          // Extract fields from Firestore REST format
          const fields = docData.fields || {};
          const extractValue = (val: any) => {
            if (val.stringValue !== undefined) return val.stringValue;
            if (val.integerValue !== undefined) return parseInt(val.integerValue);
            if (val.booleanValue !== undefined) return val.booleanValue;
            if (val.timestampValue !== undefined) return val.timestampValue;
            return null;
          };

          Object.keys(fields).forEach(key => {
            userData[key] = extractValue(fields[key]);
          });
          console.log(`[Server] User profile retrieved via REST API.`);
        } else {
          const errorText = await fsResponse.text();
          console.error(`[Server] REST API Error (${fsResponse.status}):`, errorText);
          
          if (fsResponse.status === 404) {
            return res.status(404).json({ error: 'User profile not found' });
          }
          
          throw new Error(`Cloud Firestore REST API failed: ${fsResponse.status}`);
        }
      } catch (restError: any) {
        console.error('[Server] REST Implementation failed:', restError.message);
        return res.status(500).json({ 
          error: 'Database access failed', 
          details: 'The server could not verify your usage limits. Please ensure your internet connection is stable.' 
        });
      }

      const tier = userData.tier || 'free';
      const promptsToday = userData.promptsToday || 0;
      const lastPromptDate = userData.lastPromptDate || '';
      const today = new Date().toISOString().split('T')[0];

      let limit = 40;
      if (tier === 'champion') limit = 120;
      if (tier === 'master') limit = 500;
      if (tier === 'admin' || tier === 'infinite') limit = 999999;

      // Check if it's a new day
      let currentPrompts = promptsToday;
      if (lastPromptDate !== today) {
        currentPrompts = 0;
      }

      if (currentPrompts >= limit) {
        return res.status(403).json({ 
          error: 'Limit reached', 
          limit, 
          tier,
          message: `You have reached your daily limit of ${limit} prompts. Upgrade for more!` 
        });
      }

      // Increment prompt count via REST API
      try {
        const projectId = firebaseConfig.projectId;
        const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/users/${uid}?updateMask.fieldPaths=promptsToday&updateMask.fieldPaths=lastPromptDate`;

        const updateBody = {
          fields: {
            promptsToday: { integerValue: (currentPrompts + 1).toString() },
            lastPromptDate: { stringValue: today }
          }
        };

        const updateResponse = await fetch(firestoreUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateBody)
        });

        if (!updateResponse.ok) {
          const updateError = await updateResponse.text();
          console.error('[Server] REST Update Error:', updateError);
        } else {
          console.log('[Server] Prompt count incremented via REST API.');
        }
      } catch (patchError) {
        console.error('[Server] PATCH failed:', patchError);
      }

      res.json({ success: true, currentPrompts: currentPrompts + 1, limit });
    } catch (error: any) {
      console.error('Increment Prompts Error:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });
  
  // Stripe Checkout
  app.post('/api/create-checkout-session', async (req, res) => {
    try {
      const { tierId } = req.body;
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const sk = process.env.STRIPE_SECRET_KEY;
      if (!sk || sk.length < 5 || sk === 'DZ') {
        console.error(`[Server] Invalid STRIPE_SECRET_KEY detected: ${sk ? sk.substring(0, 2) + '...' : 'MISSING'}. Please check your environment variables.`);
        return res.status(500).json({ error: 'Stripe Secret Key is missing or invalid. Please set a valid sk_test_... or sk_live_... key in the project settings.' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const userEmail = decodedToken.email;

      const prices: Record<string, number> = {
        'champion': 2500, // $25.00
        'master': 15000, // $150.00
        'admin': 50000,  // $500.00
      };

      const price = prices[tierId];
      if (!price) return res.status(400).json({ error: 'Invalid tier' });

      // Fetch system settings for bank account via REST API to avoid permission issues
      let bankAccount = null;
      try {
        const firestoreBase = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId || '(default)'}/documents`;
        const settingsUrl = `${firestoreBase}/system/settings`;
        
        console.log('[Server] Fetching settings via REST:', settingsUrl);
        const settingsRes = await fetch(settingsUrl, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });

        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          // REST API returns data in fields: { name: { stringValue: '...' } }
          bankAccount = settingsData.fields?.bankAccount?.stringValue || null;
          console.log('[Server] Settings fetched via REST. Bank Account present:', !!bankAccount);
        } else {
          const errorResponse = await settingsRes.text();
          console.error('[Server] REST Settings Error:', errorResponse);
          // If we can't fetch settings, we still proceed with card-only session
        }
      } catch (settingsError) {
        console.error('[Server] Failed to fetch settings via REST:', settingsError);
      }

      const sessionOptions: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card', 'us_bank_account'],
        customer_email: userEmail,
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Eclipse ${tierId.charAt(0).toUpperCase() + tierId.slice(1)} Plan`,
            },
            unit_amount: price,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${req.headers.origin}/subscription?success=true`,
        cancel_url: `${req.headers.origin}/subscription?canceled=true`,
        metadata: {
          uid,
          tierId
        }
      };

      // If bank account is set, use destination charges (Stripe Connect)
      if (bankAccount && bankAccount.startsWith('acct_')) {
        sessionOptions.payment_intent_data = {
          transfer_data: {
            destination: bankAccount,
          },
        };
      }

      console.log(`[Stripe] Creating session for user: ${uid}, tier: ${tierId}, price: ${price}`);
      const session = await stripe.checkout.sessions.create(sessionOptions);
      console.log(`[Stripe] Session created: ${session.id}`);

      res.json({ id: session.id });
    } catch (error: any) {
      console.error('Stripe Session Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create Stripe Customer Portal Session
  app.post('/api/create-portal-session', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // Get user data for customer ID
      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.data();
      
      let customerId = userData?.stripeCustomerId;

      // If no customer ID, try to find by email
      if (!customerId && decodedToken.email) {
        const customers = await stripe.customers.list({
          email: decodedToken.email,
          limit: 1
        });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          // Sync it back to Firestore
          await db.collection('users').doc(uid).update({ stripeCustomerId: customerId });
        }
      }

      if (!customerId) {
        return res.status(404).json({ error: 'No active subscription or customer record found.' });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${req.headers.origin}/subscription`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Portal Session Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe Webhook
  app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET || '');
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { uid, tierId } = session.metadata || {};
      const customerId = session.customer as string;

      if (uid && tierId) {
        await db.collection('users').doc(uid).update({
          tier: tierId,
          stripeCustomerId: customerId,
          upgradedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    res.json({ received: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

startServer();
