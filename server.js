const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({ origin: '*' })); // CORS সমস্যা সমাধানের জন্য
app.use(express.json());

// Firebase Admin SDK Initialization
// Firebase Console > Project Settings > Service accounts থেকে JSON key ডাউনলোড করুন
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (Object.keys(serviceAccount).length > 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  console.warn("⚠️ Firebase Service Account Key পাওয়া যায়নি! `.env` ফাইল চেক করুন।");
}

const db = admin.firestore();

// Root Health Check Route
app.get('/', (req, res) => {
  res.json({ status: "success", message: "Dsr WiFi API Server is Running!" });
});

// ==========================================
// 1. LOGIN API (CUSTOMER LOGIN)
// ==========================================
app.post('/api/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: "মোবাইল নম্বর ও পাসওয়ার্ড প্রদান করুন।" });
    }

    // Firestore-এর 'customers' কালেকশন থেকে ফোন নম্বর দিয়ে ডকুমেন্ট খোঁজা
    const customerDoc = await db.collection('customers').doc(phone.trim()).get();

    if (!customerDoc.exists) {
      return res.status(404).json({ success: false, message: "এই নম্বরে কোনো অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।" });
    }

    const customerData = customerDoc.data();

    // পাসওয়ার্ড ভেরিফিকেশন
    if (customerData.password !== password) {
      return res.status(401).json({ success: false, message: "ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।" });
    }

    // সফল লগইন
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
    res.status(500).json({ success: false, message: "সার্ভারে সংযোগ করা যাচ্ছে না! আবার চেষ্টা করুন।" });
  }
});

// ==========================================
// 2. SUBMIT PAYMENT API (TRANSACTION ID)
// ==========================================
app.post('/api/payment', async (req, res) => {
  try {
    const { phone, month, trxId } = req.body;

    if (!phone || !month || !trxId) {
      return res.status(400).json({ success: false, message: "সকল প্রয়োজনীয় তথ্য প্রদান করুন।" });
    }

    // 'payments' কালেকশনে পেমেন্ট রিকোয়েস্ট সেভ করা
    await db.collection('payments').add({
      phone: phone,
      month: month,
      trxId: trxId,
      status: "Pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ success: true, message: "পেমেন্ট তথ্য জমা হয়েছে! অনুগ্রহ করে পেমেন্ট যাচাই পর্যন্ত অপেক্ষা করুন।" });

  } catch (error) {
    console.error("Payment Error:", error);
    res.status(500).json({ success: false, message: "পেমেন্ট প্রসেস করতে ব্যর্থ হয়েছে।" });
  }
});

// Server Listening
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Dsr WiFi Server running on port ${PORT}`);
});
