import { db } from "../firebase-config.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { logAction } from "../modules/audit.js";
import { notify } from "../modules/notifications.js";

/* =========================
   HR SaaS API Layer
   - Unified backend interface
   - Used by all modules
========================= */

const API = {};

/* =========================
   CREATE
========================= */
API.create = async (col, data, user = null) => {
  const ref = await addDoc(collection(db, col), data);

  if (user) {
    logAction(user, `CREATE_${col.toUpperCase()}`);
    notify(user.employeeId, `تم إنشاء عنصر في ${col}`, "success");
  }

  return ref.id;
};

/* =========================
   READ ALL
========================= */
API.getAll = async (col) => {
  const snap = await getDocs(collection(db, col));

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
};

/* =========================
   READ ONE
========================= */
API.getOne = async (col, id) => {
  const snap = await getDoc(doc(db, col, id));

  if (!snap.exists()) return null;

  return { id: snap.id, ...snap.data() };
};

/* =========================
   UPDATE
========================= */
API.update = async (col, id, data, user = null) => {

  await updateDoc(doc(db, col, id), data);

  if (user) {
    logAction(user, `UPDATE_${col.toUpperCase()}`);
    notify(user.employeeId, `تم تحديث بيانات في ${col}`, "info");
  }
};

/* =========================
   DELETE
========================= */
API.remove = async (col, id, user = null) => {

  await deleteDoc(doc(db, col, id));

  if (user) {
    logAction(user, `DELETE_${col.toUpperCase()}`);
    notify(user.employeeId, `تم حذف عنصر من ${col}`, "warning");
  }
};

/* =========================
   QUERY HELPERS
========================= */
API.queryByField = async (col, field, value) => {

  const snap = await getDocs(collection(db, col));

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(item => item[field] === value);
};

/* =========================
   BULK OPS (Enterprise Feature)
========================= */
API.bulkCreate = async (col, items, user = null) => {

  const results = [];

  for (const item of items) {
    const id = await API.create(col, item, user);
    results.push(id);
  }

  return results;
};

/* =========================
   SYSTEM ACTION WRAPPER
========================= */
API.action = async (type, col, payload, user = null) => {

  switch (type) {

    case "create":
      return await API.create(col, payload, user);

    case "update":
      return await API.update(col, payload.id, payload.data, user);

    case "delete":
      return await API.remove(col, payload.id, user);

    default:
      console.warn("Unknown action:", type);
  }

};

export default API;
