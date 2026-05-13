const API_BASE_URL = "https://hr-system-backend-dxj2.onrender.com/api";

const token = localStorage.getItem("token");
if (!token) window.location.href = "./login.html";

let loggedUser = null;
let loggedAccess = { roles: [], permissions: [] };

const pagePermissions = {
  "dashboard.html": ["dashboard.view"],
  "users.html": ["users.view"],
  "departments.html": ["departments.view"],
  "employees.html": ["employees.view"],
  "employee-profile.html": ["employees.view"],
  "attendance.html": ["attendance.view"],
  "shifts.html": ["shifts.view"],
  "leaves.html": ["leaves.view"],
  "salaries.html": ["salaries.view"],
  "reports.html": ["reports.view"],
};

const linkPermissions = {
  dashboard: ["dashboard.view"],
  users: ["users.view"],
  departments: ["departments.view"],
  employees: ["employees.view"],
  attendance: ["attendance.view"],
  shifts: ["shifts.view"],
  leaves: ["leaves.view"],
  salaries: ["salaries.view"],
  reports: ["reports.view"],
};

const normalizeList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeList);
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
};

const hasPermission = (permission) => loggedAccess.roles.includes("admin") || loggedAccess.permissions.includes(permission);
const hasAnyPermission = (permissions = []) => loggedAccess.roles.includes("admin") || permissions.some((permission) => loggedAccess.permissions.includes(permission));

const getCurrentPageName = () => window.location.pathname.split("/").pop() || "dashboard.html";

const applyNavigationPermissions = () => {
  document.querySelectorAll("[data-role-link]").forEach((link) => {
    const key = link.dataset.roleLink;
    const required = linkPermissions[key] || [];
    if (required.length && !hasAnyPermission(required)) link.style.display = "none";
  });
};

const enforcePagePermission = () => {
  const currentPage = getCurrentPageName();
  const required = pagePermissions[currentPage];
  if (!required || hasAnyPermission(required)) return true;
  alert("ليس لديك صلاحية للوصول إلى هذه الصفحة");
  window.location.href = "./dashboard.html";
  return false;
};

const applyActionPermissions = () => {
  document.querySelectorAll("[data-permission]").forEach((el) => {
    const permissions = normalizeList(el.dataset.permission);
    if (permissions.length && !hasAnyPermission(permissions)) el.style.display = "none";
  });
};

const logoutButton = document.getElementById("logoutBtn");
if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "./login.html";
  });
}

const loadLoggedUser = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) {
      localStorage.clear();
      window.location.href = "./login.html";
      return null;
    }

    loggedUser = data.user;
    let access = { roles: normalizeList(loggedUser.roles || loggedUser.role), permissions: [] };
    try {
      const accessResponse = await fetch(`${API_BASE_URL}/users/me/access`, { headers: { Authorization: `Bearer ${token}` } });
      const accessData = await accessResponse.json();
      if (accessResponse.ok) access = { roles: normalizeList(accessData.roles), permissions: normalizeList(accessData.permissions) };
    } catch (error) {
      console.log(error);
    }

    loggedAccess = access;
    localStorage.setItem("user", JSON.stringify({ ...loggedUser, roles: access.roles, permissions: access.permissions }));
    applyNavigationPermissions();
    applyActionPermissions();
    if (!enforcePagePermission()) return null;
    return { ...loggedUser, roles: access.roles, permissions: access.permissions };
  } catch (error) {
    console.log(error);
    localStorage.clear();
    window.location.href = "./login.html";
    return null;
  }
};
