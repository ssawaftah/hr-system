import { getRole } from "./permissions.js";

/* =========================
   Global State Manager
   - Holds current user session
   - Shared across system
========================= */

export const state = {
  user: null
};

/* =========================
   Set User Session
========================= */
export function setUser(user) {

  state.user = user;

  sessionStorage.setItem("user", JSON.stringify(user));
}

/* =========================
   Load User Session
========================= */
export function loadUser() {

  const stored = sessionStorage.getItem("user");

  if (stored) {
    state.user = JSON.parse(stored);
  }

  return state.user;
}

/* =========================
   Logout
========================= */
export function logout() {

  state.user = null;

  sessionStorage.removeItem("user");

  location.href = "index.html";
}

/* =========================
   Get Current User Role
========================= */
export function getCurrentRole() {
  return state.user?.role || "employee";
}

/* =========================
   Check Auth
========================= */
export function isAuthenticated() {
  return !!state.user;
}
