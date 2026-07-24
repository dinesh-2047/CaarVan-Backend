const admin = require("firebase-admin");

let firebaseApp = null;

try {
  const serviceAccount = require("../../firebase-service-key.json");
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  // console.log("Firebase Admin initialized successfully");
} catch (error) {
  console.warn(
    "Firebase Admin not initialized - push notifications will be skipped",
    error.message,
  );
}

module.exports = admin;
