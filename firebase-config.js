
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";


export const firebaseConfig = {
  apiKey: "AIzaSyD9Dfpg__lO79RDsNNYAnZDgNx12nzCVKk",
  authDomain: "ngork-student-app.firebaseapp.com",
  projectId: "ngork-student-app",
  storageBucket: "ngork-student-app.firebasestorage.app",
  messagingSenderId: "699943271431",
  appId: "1:699943271431:web:8e7730b388c11d6fcdbea2",
  measurementId: "G-2GHJK2738Q"
};

export const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
