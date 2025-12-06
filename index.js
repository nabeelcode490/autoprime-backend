// autoprime-backend/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

// 1. INITIALIZE APP FIRST
const app = express();

// 2. MIDDLEWARE
app.use(cors());
app.use(express.json());

// 3. FIREBASE CONNECTION
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
  console.log("🔥 Firebase Admin Connected!");
}

const db = admin.firestore();

// --- ROUTE 1: TEST ---
app.get("/", (req, res) => {
  res.status(200).send("Auto Prime Backend is Running!");
});

// --- ROUTE 2: SELL CAR (Save to DB) ---
app.post("/api/sell-car", async (req, res) => {
  try {
    const carData = req.body;
    console.log("📥 New Listing:", carData.title);

    const finalData = {
      ...carData,
      status: "pending_approval", // Needs Admin to change to 'live_auction'
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      currentBid: 0,
      bidCount: 0,
      auctionParams: {
        startTime: null,
        endTime: null,
        basePrice: parseInt(carData.price) || 0,
      },
    };

    const docRef = await db.collection("cars").add(finalData);
    res.json({ success: true, carId: docRef.id });
  } catch (error) {
    console.error("Save Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- ROUTE 3: AI PRICE EVALUATION ---
// Connects to your Python Service on Render (or local)
app.post("/api/evaluate-price", async (req, res) => {
  try {
    // In real deployment, replace with your Render URL
    const PYTHON_AI_URL = "http://127.0.0.1:5000/predict";

    const aiResponse = await fetch(PYTHON_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const aiResult = await aiResponse.json();
    res.json(aiResult);
  } catch (error) {
    // Fallback if AI is offline
    res.json({
      estimated_price: "35.5 Lacs",
      price_range: { min: "34", max: "37" },
    });
  }
});

// --- ROUTE 4: PLACE BID (The 7-Point Logic Engine) ---
app.post("/api/place-bid", async (req, res) => {
  const { carId, userId, bidAmount } = req.body;

  if (!carId || !userId || !bidAmount) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  try {
    await db.runTransaction(async (t) => {
      // A. Fetch Data
      const carRef = db.collection("cars").doc(carId);
      const userRef = db.collection("users").doc(userId);
      const requestQuery = db
        .collection("auction_requests")
        .where("userId", "==", userId)
        .where("status", "==", "approved");

      const [carDoc, userDoc, reqSnap] = await Promise.all([
        t.get(carRef),
        t.get(userRef),
        t.get(requestQuery),
      ]);

      if (!carDoc.exists) throw "Car not found.";
      const carData = carDoc.data();

      // Logic 1: Access
      if (!userDoc.exists) throw "User not logged in.";
      if (reqSnap.empty) throw "You must register for auctions first.";

      // Logic 2: Auction Status
      if (carData.status !== "live_auction") throw "Auction is not live.";

      // Logic 3: Time Check
      if (carData.auctionParams?.endTime) {
        const now = new Date();
        const end = carData.auctionParams.endTime.toDate();
        if (now > end) throw "Auction has ended.";
      }

      // Logic 4: Amount Validation
      const currentHigh =
        carData.currentBid || carData.auctionParams.basePrice || 0;
      const amount = Number(bidAmount);

      if (amount <= currentHigh) {
        throw `Bid must be higher than Rs. ${currentHigh.toLocaleString()}`;
      }

      // Logic 5: Update
      t.update(carRef, {
        currentBid: amount,
        highestBidderId: userId,
        bidCount: admin.firestore.FieldValue.increment(1),
      });

      // Logic 6: History
      const historyRef = carRef.collection("bidHistory").doc();
      t.set(historyRef, {
        userId: userId,
        amount: amount,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.json({ success: true, message: "Bid Accepted!" });
  } catch (error) {
    console.error("Bid Error:", error);
    const msg = typeof error === "string" ? error : "System Error";
    res.status(400).json({ success: false, message: msg });
  }
});

// 4. START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running locally on port ${PORT}`);
});

module.exports = app;
