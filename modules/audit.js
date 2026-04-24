import { db } from "../firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { showToast } from "../ui/toast.js";

/* =========================
   Audit Log Module
   - Track all system actions
   - Security + transparency layer
========================= */

const AUDIT_COL = "audit";

/* =========================
   Log Action
========================= */
export async function logAction(user, action, meta = {}) {

  try {

    await addDoc(collection(db, AUDIT_COL), {
      user: user?.name || "unknown",
      employeeId: user?.employeeId || null,
      role: user?.role || null,

      action,
      meta,

      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Audit Error:", err);
  }
}

/* =========================
   Get Logs
========================= */
export async function getAuditLogs(max = 50) {

  const q = query(
    collection(db, AUDIT_COL),
    orderBy("timestamp", "desc"),
    limit(max)
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => d.data());
}

/* =========================
   Render Audit UI
========================= */
export async function renderAudit(containerId) {

  const logs = await getAuditLogs();

  const html = logs.map(l => `
    <div class="card">
      <p><b>المستخدم:</b> ${l.user}</p>
      <p><b>الدور:</b> ${l.role}</p>
      <p><b>العملية:</b> ${l.action}</p>
      <p><b>الوقت:</b> ${new Date(l.timestamp).toLocaleString()}</p>
    </div>
  `).join("");

  document.getElementById(containerId).innerHTML = html;
}

/* =========================
   Quick Helpers
========================= */

export function logCreate(entity, user) {
  logAction(user, `CREATE_${entity}`);
}

export function logUpdate(entity, user) {
  logAction(user, `UPDATE_${entity}`);
}

export function logDelete(entity, user) {
  logAction(user, `DELETE_${entity}`);
}
