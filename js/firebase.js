import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDZ1qt1QZs5kGmoGgrar_WH330OxRWery4",
  authDomain: "boss-tracker-5488e.firebaseapp.com",
  databaseURL: "https://boss-tracker-5488e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "boss-tracker-5488e",
  storageBucket: "boss-tracker-5488e.firebasestorage.app",
  messagingSenderId: "285894450263",
  appId: "1:285894450263:web:444e346cd7d50d8a181712",
  measurementId: "G-LB9Z0Y1CL3"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
