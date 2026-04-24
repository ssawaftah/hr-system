import { db } from "../firebase-config.js";
import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   Realtime Engine
   - Live updates without refresh
   - Core for SaaS UX feel
========================= */

/* =========================
   Listen to any collection
========================= */
export function listenCollection(colName, callback) {

  return onSnapshot(collection(db, colName), (snapshot) => {

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    callback(data);

  }, (error) => {
    console.error("Realtime Error:", error);
  });

}

/* =========================
   Listen to specific user data
========================= */
export function listenUserCollection(colName, field, value, callback) {

  return onSnapshot(collection(db, colName), (snapshot) => {

    const data = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(item => item[field] === value);

    callback(data);

  });

}

/* =========================
   Smart Realtime Dashboard Hook
========================= */
export function bindRealtimeDashboard(config) {

  /*
    config = {
      employees: (data) => {},
      requests: (data) => {},
      announcements: (data) => {}
    }
  */

  if (config.employees) {
    listenCollection("users", config.employees);
  }

  if (config.requests) {
    listenCollection("requests", config.requests);
  }

  if (config.announcements) {
    listenCollection("announcements", config.announcements);
  }

}

/* =========================
   Live Stats Helper
========================= */
export function calculateLiveStats(data) {

  return {
    total: data.length,
    active: data.filter(i => i.status === "active").length,
    pending: data.filter(i => i.status === "pending").length,
    approved: data.filter(i => i.status === "approved").length
  };

}
