const { onRequest } = require("firebase-functions/v2/https");

// Lazy-load and initialize backend server-side bundle to avoid cold-start environment initialization crashes
let appInstance = null;

async function getApp() {
  if (!appInstance) {
    console.log("[Functions] Initializing Express app bundle...");
    const serverBundle = require("./server.cjs");
    
    // Safety check for startPromise to make sure Express routing is fully set up
    if (serverBundle.startPromise) {
      await serverBundle.startPromise;
    }
    
    appInstance = serverBundle.appInstance;
    if (!appInstance) {
      throw new Error("Express appInstance is not available after server compilation loaded.");
    }
  }
  return appInstance;
}

// Deploy the Express App under the "api" cloud function matching firebase.json routes
exports.api = onRequest({
  cors: true,
  maxInstances: 10,
  timeoutSeconds: 300,
  memory: "512MiB"
}, async (req, res) => {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error("[Functions Handler Error]:", err);
    res.status(500).json({
      error: "Cloud Functions Wrapper Failure",
      details: err.message
    });
  }
});
