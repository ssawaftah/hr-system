import { db } from "../firebase-config.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { setUser, loadUser } from "./state.js";
import { showToast } from "../ui/toast.js";
import { logAction } from "../modules/audit.js";

/* =========================
   Internal Auth System
   - No Firebase Auth
   - Uses users collection
========================= */

const USERS_COL = "users";

/* =========================
   Login
========================= */
export async function login(employeeId, password) {

  try {

    const snap = await getDocs(collection(db, USERS_COL));

    const users = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    const user = users.find(u =>
      u.employeeId === employeeId &&
      u.password === password
    );

    if (!user) {
      showToast("بيانات الدخول غير صحيحة ❌", "error");
      return null;
    }

    setUser(user);

    logAction(user, "LOGIN");

    showToast(`أهلاً ${user.name} 👋`, "success");

    return user;

  } catch (err) {
    console.error(err);
    showToast("خطأ في تسجيل الدخول", "error");
  }
}

/* =========================
   Auto Login (session restore)
========================= */
export function autoLogin() {

  const user = loadUser();

  if (user) {
    showToast(`مرحباً بعودتك ${user.name}`, "info");
    return user;
  }

  return null;
}

/* =========================
   Logout
========================= */
export function logout() {

  const user = loadUser();

  if (user) {
    logAction(user, "LOGOUT");
  }

  setUser(null);

  showToast("تم تسجيل الخروج", "warning");

  setTimeout(() => {
    location.href = "index.html";
  }, 500);
}

/* =========================
   Check Auth Guard
========================= */
export function requireAuth() {

  const user = loadUser();

  if (!user) {
    location.href = "index.html";
    return null;
  }

  return user;
}

/* =========================
   Role Helpers
========================= */
export function isAdmin() {
  const user = loadUser();
  return user?.role === "admin";
}

export function isManager() {
  const user = loadUser();
  return user?.role === "manager";
}

export function isEmployee() {
  const user = loadUser();
  return user?.role === "employee";
}
