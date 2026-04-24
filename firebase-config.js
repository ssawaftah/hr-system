import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCfC1rS6ONG0F0NyNxsPHIbgmQK3cbcmHc",
  authDomain: "hr-steel-factory.firebaseapp.com",
  projectId: "hr-steel-factory",
  storageBucket: "hr-steel-factory.firebasestorage.app",
  messagingSenderId: "268695668396",
  appId: "1:268695668396:web:39c73c8bd8e19ce591c109"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
