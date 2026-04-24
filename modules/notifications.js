import { db } from "../firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { showToast } from "../ui/toast.js";

/* =========================
   Notifications Module
   - User alerts system
   - Requests / payroll / attendance alerts
========================= */

const NOTIF_COL = "notifications";

/* =========================
   Create Notification
========================= */
export async function notify(userId, message, type = "info") {

  try {

    await addDoc(collection(db, NOTIF_COL), {
      userId,
      message,
      type, // info | success | warning | error
      read: false,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Notification Error:", err);
  }
}

/* =========================
   Get User Notifications
========================= */
export async function getNotifications(userId) {

  const q = query(
    collection(db, NOTIF_COL),
    where("userId", "==", userId),
    orderBy("timestamp", "desc")
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* =========================
   Mark as Read
========================= */
export async function markAsRead(notificationId) {

  try {

    await updateDoc(doc(db, NOTIF_COL, notificationId), {
      read: true
    });

  } catch (err) {
    console.error(err);
  }
}

/* =========================
   Render Notifications UI
========================= */
export async function renderNotifications(containerId, userId) {

  const data = await getNotifications(userId);

  const html = data.map(n => `
    <div class="card" style="opacity:${n.read ? 0.6 : 1}">
      <p>${n.message}</p>
      <small>${new Date(n.timestamp).toLocaleString()}</small>
      ${!n.read ? `<button onclick="readNotif('${n.id}')">تم القراءة</button>` : ""}
    </div>
  `).join("");

  document.getElementById(containerId).innerHTML = html;
}

/* =========================
   Global Helpers
========================= */

window.readNotif = async function(id){
  await markAsRead(id);
  showToast("تم تحديد الإشعار كمقروء", "success");
  location.reload();
};

/* =========================
   Smart Notification Triggers
========================= */

// إشعار طلب جديد
export function notifyNewRequest(userId){
  notify(userId, "تم إنشاء طلبك بنجاح", "success");
}

// إشعار قبول
export function notifyApproved(userId){
  notify(userId, "تم قبول طلبك ✅", "success");
}

// إشعار رفض
export function notifyRejected(userId){
  notify(userId, "تم رفض طلبك ❌", "error");
}

// إشعار راتب
export function notifyPayroll(userId){
  notify(userId, "تم تحديث كشف الراتب 💰", "info");
}

// إشعار حضور
export function notifyAttendance(userId){
  notify(userId, "تم تسجيل حضورك ⏱️", "info");
}
