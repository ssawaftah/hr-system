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

const navMeta = {
  dashboard: { label: "الرئيسية", icon: "⌂" },
  users: { label: "الصلاحيات", icon: "◌" },
  departments: { label: "الأقسام", icon: "▦" },
  employees: { label: "الموظفون", icon: "☷" },
  attendance: { label: "الحضور", icon: "◷" },
  shifts: { label: "الشفتات", icon: "⇄" },
  leaves: { label: "الإجازات", icon: "◫" },
  salaries: { label: "الرواتب", icon: "◈" },
  reports: { label: "التقارير", icon: "▣" },
};

const roleLabels = { admin: "مدير النظام", hr: "الموارد البشرية", employee: "موظف" };

const normalizeList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeList);
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
};

const hasPermission = (permission) => loggedAccess.roles.includes("admin") || loggedAccess.permissions.includes(permission);
const hasAnyPermission = (permissions = []) => loggedAccess.roles.includes("admin") || permissions.some((permission) => loggedAccess.permissions.includes(permission));
const getCurrentPageName = () => window.location.pathname.split("/").pop() || "dashboard.html";

const enhanceNavigationLabels = () => {
  document.querySelectorAll("[data-role-link]").forEach((link) => {
    const meta = navMeta[link.dataset.roleLink];
    if (!meta) return;
    link.innerHTML = `<span class="nav-icon">${meta.icon}</span><span>${meta.label}</span>`;
  });
};

const applyNavigationPermissions = () => {
  document.querySelectorAll("[data-role-link]").forEach((link) => {
    const key = link.dataset.roleLink;
    const required = linkPermissions[key] || [];
    if (required.length && !hasAnyPermission(required)) link.style.display = "none";
    else link.style.display = "";
  });
};

const enforcePagePermission = () => {
  const currentPage = getCurrentPageName();
  const required = pagePermissions[currentPage];
  if (!required || hasAnyPermission(required)) return true;
  alert("لا تملك صلاحية الوصول إلى هذه الصفحة");
  window.location.href = "./dashboard.html";
  return false;
};

const applyActionPermissions = () => {
  document.querySelectorAll("[data-permission]").forEach((el) => {
    const permissions = normalizeList(el.dataset.permission);
    if (permissions.length && !hasAnyPermission(permissions)) el.style.display = "none";
  });
};

const setupResponsiveShell = () => {
  const sidebar = document.querySelector(".sidebar");
  const topbar = document.querySelector(".topbar");
  const appLayout = document.querySelector(".app-layout");
  if (!sidebar || !topbar || !appLayout) return;

  sidebar.setAttribute("aria-label", "القائمة الجانبية");
  if (!document.querySelector(".sidebar-backdrop")) {
    const backdrop = document.createElement("div");
    backdrop.className = "sidebar-backdrop";
    backdrop.addEventListener("click", () => appLayout.classList.remove("sidebar-open"));
    document.body.appendChild(backdrop);
  }

  if (!topbar.querySelector(".mobile-menu-btn")) {
    const menuButton = document.createElement("button");
    menuButton.className = "secondary-btn mobile-menu-btn";
    menuButton.type = "button";
    menuButton.textContent = "القائمة";
    menuButton.addEventListener("click", () => appLayout.classList.toggle("sidebar-open"));
    topbar.prepend(menuButton);
  }

  if (!topbar.querySelector(".topbar-tools")) {
    const oldLogout = document.getElementById("logoutBtn");
    const tools = document.createElement("div");
    tools.className = "topbar-tools";
    tools.innerHTML = `
      <button type="button" class="notification-btn" aria-label="الإشعارات">الإشعارات</button>
      <div class="user-chip">
        <span class="user-avatar">${(loggedUser?.full_name || "م").slice(0, 1)}</span>
        <div>
          <strong>${loggedUser?.full_name || "مستخدم"}</strong>
          <small>${normalizeList(loggedAccess.roles).map((r) => roleLabels[r] || r).join("، ") || "مستخدم"}</small>
        </div>
      </div>
    `;
    if (oldLogout) tools.appendChild(oldLogout);
    topbar.appendChild(tools);
  }
};

const setupBottomShortcuts = () => {
  if (document.querySelector(".bottom-shortcuts")) return;
  const items = [
    { key: "dashboard", href: "./dashboard.html", label: "الرئيسية" },
    { key: "attendance", href: "./attendance.html", label: "الحضور" },
    { key: "leaves", href: "./leaves.html", label: "الإجازات" },
    { key: "salaries", href: "./salaries.html", label: "راتبي" },
    { key: "reports", href: "./reports.html", label: "التقارير" },
  ].filter((item) => hasAnyPermission(linkPermissions[item.key] || []));

  const nav = document.createElement("nav");
  nav.className = "bottom-shortcuts";
  nav.setAttribute("aria-label", "قائمة الاختصارات");
  nav.innerHTML = items.slice(0, 5).map((item) => `<a href="${item.href}" data-role-link="${item.key}">${item.label}</a>`).join("");
  document.body.appendChild(nav);
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
    enhanceNavigationLabels();
    applyNavigationPermissions();
    setupResponsiveShell();
    setupBottomShortcuts();
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
