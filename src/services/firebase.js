import { getApp, getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCvxwg_ILKr76CXNf7HUH8pApnBtBUtmkg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "moodtracker-5af95.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "moodtracker-5af95",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "moodtracker-5af95.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "563692983468",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:563692983468:web:8810a4f68a58be7fa07b09",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-PYGBNGEPS7",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
const db = getFirestore(app);

export { app, auth, db };
