const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Firebase Config without JSON.parse issues
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
};

if (serviceAccount.projectId && serviceAccount.privateKey) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("✅ Firebase initialized successfully!");
} else {
  console.log("⚠️ Firebase credentials missing in Environment Variables");
}

const db = admin.firestore();

app.get('/', (req, res) => {
  res.json({ status: "success", message: "Dsr WiFi API Running!" });
});

app.post('/api/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: "মোবাইল নম্বর ও পাসওয়ার্ড দিন।" });
    }

    const customerDoc = await db.collection('customers').doc(phone.trim()).get();

    if (!customerDoc.exists) {
      return res.status(404).json({ success: false, message: "অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।" });
    }

    const customerData = customerDoc.data();

    if (customerData.password !== password) {
      return res.status(401).json({ success: false, message: "ভুল পাসওয়ার্ড!" });
    }

    res.status(200).json({
      success: true,
      message: "লগইন সফল হয়েছে!",
      user: {
        phone: customerDoc.id,
        name: customerData.name || "গ্রাহক",
        ispUsername: customerData.ispUsername || "-",
        ispPassword: customerData.ispPassword || "-",
        package: customerData.package || "৫০-এমবিপিএস (৫০০৳/মাস)",
        status: customerData.status || "Active"
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: "সার্ভারে সংযোগ করা যাচ্ছে না!" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
