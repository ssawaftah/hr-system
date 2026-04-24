import { state } from "./state.js";

/* =========================
   Role-Based Access Control (RBAC)
   - Core security layer
========================= */

export const roles = {
  admin: "admin",
  manager: "manager",
  employee: "employee"
};

/* =========================
   Permissions Map
========================= */
const permissions = {

  admin: [
    "employees.create",
    "employees.read",
    "employees.update",
    "employees.delete",

    "requests.approve",
    "requests.reject",
    "requests.read",

    "announcements.create",
    "announcements.read",

    "payroll.generate",
    "payroll.read",

    "attendance.read",

    "audit.read"
  ],

  manager: [
    "employees.read",
    "employees.update",

    "requests.approve",
    "requests.reject",
    "requests.read",

    "announcements.create",
    "announcements.read",

    "attendance.read",

    "payroll.read"
  ],

  employee: [
    "requests.create",
    "requests.read",

    "announcements.read",

    "attendance.read",
    "payroll.read_own"
  ]
};

/* =========================
   Check Permission
========================= */
export function can(action) {

  const user = state.user;

  if (!user) return false;

  const role = user.role;

  const rolePermissions = permissions[role] || [];

  return rolePermissions.includes(action);
}

/* =========================
   Guard Function (UI Protection)
========================= */
export function guard(action, callback) {

  if (can(action)) {
    callback();
  } else {
    console.warn("Access Denied:", action);
    alert("🚫 لا تملك صلاحية لهذه العملية");
  }

}

/* =========================
   Get user role
========================= */
export function getRole() {
  return state.user?.role || "employee";
}
