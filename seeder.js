// autoprime-backend/seeder.js
require("dotenv").config();
const admin = require("firebase-admin");

// 1. CONNECT TO FIREBASE
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
}

const db = admin.firestore();

// 2. CREATE THE DATA
async function seed() {
  try {
    console.log("🌱 Attempting to seed database...");

    const now = new Date();
    const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

    const carData = {
      title: "Toyota Supra (Full Inspection)",
      brand: "Toyota",
      model: "Supra MK4",
      year: "2021",
      price: "6700000",
      status: "live_auction", // Allows bidding
      location: "Lahore",

      // Car Images (Top Carousel)
      images: [
        "https://images.unsplash.com/photo-1605515298946-d0bfdfdbdd6d?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1532974297617-c0f05fe48bff?auto=format&fit=crop&w=800&q=80",
      ],

      // ✅ CRITICAL: Inspection Sheet Image (Center Zoomable Image)
      inspectionSheetImage:
        "https://i.pinimg.com/736x/27/93/29/279329707255fb33679d63493df40620.jpg",

      // Inspection PDF (Link at bottom) - Using a dummy PDF link
      inspectionSheetPdf:
        "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",

      auctionParams: {
        basePrice: 6700000,
        currentBid: 6700000,
        startTime: now,
        endTime: endTime,
        highestBidderId: null,
        bidCount: 0,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 3. WRITE TO DATABASE
    const docRef = await db.collection("cars").add(carData);

    console.log("------------------------------------------------");
    console.log("✅ SUCCESS! Car created in Firestore.");
    console.log("🚗 Car Title:", carData.title);
    console.log("🆔 COPY THIS ID:", docRef.id); // <--- COPY THIS
    console.log("------------------------------------------------");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

seed();
