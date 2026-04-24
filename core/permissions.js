import { loadUser } from "./state.js";

/* =========================
   ROLE DEFINITIONS
========================= */

const ROLES = {
  admin: "admin",
  manager: "manager",
  employee: "employee"
};

/* =========================
   PERMISSION MATRIX
========================= */

const permissions = {

  admin: [
    "employees.create",
    "employees.read",
    "employees.update",
    "employees.delete",

    "requests.read",
    "requests.approve",
    "requests.reject",

    "payroll.read",
    "payroll.write",

    "announcements.create",
    "announcements.read",

    "attendance.read",
    "attendance.write",

    "audit.read",

    "settings.manage"
  ],

  manager: [
    "employees.read",
    "employees.update",

    "requests.read",
    "requests.approve",
    "requests.reject",

    "announcements.create",
    "announcements.read",

    "attendance.read",
    "attendance.write",

    "payroll.read"
  ],

  employee: [
    "requests.create",
    "requests.read",

    "announcements.read",

    "attendance.read"
  ]
};

/* =========================
   CHECK PERMISSION
========================= */

export function can(permission) {

  const user = loadUser();

  if (!user) return false;

  const rolePermissions = permissions[user.role] || [];

  return rolePermissions.includes(permission);
}

/* =========================
   GUARDS (REAL USAGE)
========================= */

export function requirePermission(permission) {

  const allowed = can(permission);

  if (!allowed) {
    console.warn("Access denied:", permission);
  }

  return allowed;
}

/* =========================
   ROLE HELPERS
========================= */

export function isAdmin() {
  return loadUser()?.role === ROLES.admin;
}

export function isManager() {
  return loadUser()?.role === ROLES.manager;
}

export function isEmployee() {
  return loadUser()?.role === ROLES.employee;
}

/* =========================
   DASHBOARD FILTER
========================= */

export function filterMenu(menuItems) {

  const user = loadUser();

  if (!user) return [];

  return menuItems.filter(item => {
    return !item.permission || can(item.permission);
  });
}
