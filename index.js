// index.js (Updated for Day 3)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();

app.use(cors());
app.use(express.json());

// --- FIREBASE CONNECTION ---
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
  console.log("🔥 Firebase Admin Connected Successfully!");
}

const db = admin.firestore();

// --- ROUTE 1: TEST ---
app.get("/", (req, res) => {
  res.status(200).send("Auto Prime Auction Backend is Running!");
});

// --- ROUTE 2: SELL CAR (SAVE TO DB) ---
app.post("/api/sell-car", async (req, res) => {
  try {
    const carData = req.body;

    console.log("📥 Received Car Data:", carData.title);

    // 1. Add server-side timestamps and default status
    const finalData = {
      ...carData,
      status: "pending_evaluation", // Waiting for AI
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      highestBid: 0,
      bidCount: 0,
    };

    // 2. Save to Firestore "cars" collection
    const docRef = await db.collection("cars").add(finalData);

    console.log("✅ Car Saved with ID:", docRef.id);

    // 3. Return success to the App
    res.status(200).json({
      success: true,
      message: "Car saved successfully",
      carId: docRef.id,
    });
  } catch (error) {
    console.error("❌ Error saving car:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// ... existing code ...

// --- ROUTE 3: AI PRICE EVALUATION ---
// The App calls this -> This calls Python -> Python returns result -> This returns to App
app.post("/api/evaluate-price", async (req, res) => {
  try {
    const carData = req.body;
    console.log("🧠 Asking AI Service for:", carData.title);

    // 1. Send data to Python Service (running locally on port 5000)
    // We use the builtin 'fetch' (available in Node v18+)
    const aiResponse = await fetch("http://127.0.0.1:5000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(carData),
    });

    const aiResult = await aiResponse.json();
    console.log("🤖 AI Answer:", aiResult);

    // 2. Return AI result to Frontend
    res.json(aiResult);
  } catch (error) {
    console.error("❌ AI Service Error:", error);
    res.status(500).json({ success: false, error: "AI Service Unavailable" });
  }
});

// ... app.listen is here ...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running locally on port ${PORT}`);
});

module.exports = app;
