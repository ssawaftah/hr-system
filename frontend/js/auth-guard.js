const API_BASE_URL = "https://hr-system-backend-dxj2.onrender.com/api";

const token = localStorage.getItem("token");
if (!token) window.location.href = "./login.html";

let loggedUser = null;
let loggedAccess = { roles: [], permissions: [] };

const fallbackNavigationConfig = [
  { id: "dashboard", label: "الرئيسية", path: "./dashboard.html", icon: "⌂", group: "الرئيسية", requiredPermissions: ["dashboard.view"], showInSidebar: true, showInShortcutMenu: true, order: 1 },
  { id: "attendance", label: "الحضور والانصراف", path: "./attendance.html", icon: "◷", group: "التشغيل اليومي", requiredPermissions: ["attendance.view", "attendance.view.self", "attendance.view.department", "attendance.view.all"], showInSidebar: true, showInShortcutMenu: true, order: 10 },
  { id: "leaves", label: "الطلبات", path: "./leaves.html", icon: "◫", group: "التشغيل اليومي", requiredPermissions: ["leaves.view", "requests.view.self", "requests.view.department", "requests.view.all"], showInSidebar: true, showInShortcutMenu: true, order: 11 },
  { id: "shifts", label: "الشفتات", path: "./shifts.html", icon: "⇄", group: "التشغيل اليومي", requiredPermissions: ["shifts.view"], showInSidebar: true, showInShortcutMenu: false, order: 12 },
  { id: "employees", label: "الموظفون", path: "./employees.html", icon: "☷", group: "الموارد البشرية", requiredPermissions: ["employees.view", "employees.view.self"], showInSidebar: true, showInShortcutMenu: false, order: 20 },
  { id: "departments", label: "الأقسام", path: "./departments.html", icon: "▦", group: "الموارد البشرية", requiredPermissions: ["departments.view"], showInSidebar: true, showInShortcutMenu: false, order: 21 },
  { id: "salaries", label: "الرواتب", path: "./salaries.html", icon: "◈", group: "المالية", requiredPermissions: ["salaries.view", "finance.payroll_slips.view"], showInSidebar: true, showInShortcutMenu: true, order: 30 },
  { id: "reports", label: "التقارير", path: "./reports.html", icon: "▣", group: "التقارير", requiredPermissions: ["reports.view", "reports.view.self", "reports.view.department", "reports.view.all"], showInSidebar: true, showInShortcutMenu: true, order: 40 },
  { id: "users", label: "الصلاحيات", path: "./users.html", icon: "◌", group: "النظام", requiredPermissions: ["users.view", "permissions.view"], showInSidebar: true, showInShortcutMenu: false, order: 50 },
];

const getNavigationConfig = () => Array.isArray(window.navigationConfig) ? window.navigationConfig : fallbackNavigationConfig;

const shellRoleLabels = { admin: "مدير النظام", hr: "الموارد البشرية", employee: "موظف", manager: "مدير قسم", finance: "المالية" };

const normalizeList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeList);
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
};

const hasPermission = (permission) => loggedAccess.roles.includes("admin") || loggedAccess.permissions.includes(permission) || loggedAccess.permissions.includes("system.admin");
const hasAnyPermission = (permissions = []) => loggedAccess.roles.includes("admin") || permissions.length === 0 || permissions.some((permission) => hasPermission(permission));
const getCurrentPageName = () => window.location.pathname.split("/").pop() || "dashboard.html";

const canAccessPath = (path) => {
  const page = path.replace("./", "");
  const item = getNavigationConfig().find((nav) => nav.path.replace("./", "") === page);
  if (!item) return true;
  return hasAnyPermission(item.requiredPermissions || []);
};

const ensureUxFixes = () => {
  if (!document.querySelector('link[href*="ux-fixes.css"]')) {
    const ux = document.createElement("link");
    ux.rel = "stylesheet";
    ux.href = "./css/ux-fixes.css?v=3";
    document.head.appendChild(ux);
  }
  if (!document.querySelector('script[src*="navigation-config.js"]')) {
    const script = document.createElement("script");
    script.src = "./js/navigation-config.js?v=1";
    document.head.appendChild(script);
  }
};

const closeSidebar = () => {
  document.querySelector(".app-layout")?.classList.remove("sidebar-open");
  document.querySelector(".sidebar-backdrop")?.classList.remove("is-visible");
  document.body.classList.remove("no-scroll");
};

const toggleSidebar = () => {
  const appLayout = document.querySelector(".app-layout");
  const backdrop = document.querySelector(".sidebar-backdrop");
  const willOpen = !appLayout?.classList.contains("sidebar-open");
  appLayout?.classList.toggle("sidebar-open", willOpen);
  backdrop?.classList.toggle("is-visible", willOpen);
  document.body.classList.toggle("no-scroll", willOpen);
};

const getAllowedNavigation = (shortcutOnly = false) => getNavigationConfig()
  .filter((item) => shortcutOnly ? item.showInShortcutMenu : item.showInSidebar)
  .filter((item) => hasAnyPermission(item.requiredPermissions || []))
  .sort((a, b) => (a.order || 0) - (b.order || 0));

const rebuildSidebar = () => {
  const menu = document.querySelector(".sidebar-menu");
  if (!menu) return;
  const current = getCurrentPageName();
  const items = getAllowedNavigation(false);
  const groups = items.reduce((map, item) => {
    const group = item.group || "النظام";
    if (!map[group]) map[group] = [];
    map[group].push(item);
    return map;
  }, {});
  menu.innerHTML = Object.entries(groups).map(([group, groupItems]) => `
    <div class="nav-group-title">${group}</div>
    ${groupItems.map((item) => `<a href="${item.path}" class="${item.path.replace("./", "") === current ? "active" : ""}" data-nav-id="${item.id}"><span class="nav-icon">${item.icon || "•"}</span><span>${item.label}</span></a>`).join("")}
  `).join("");
  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeSidebar));
};

const enforcePagePermission = () => {
  if (canAccessPath(`./${getCurrentPageName()}`)) return true;
  window.location.href = "./access-denied.html";
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

  document.querySelectorAll(".sidebar-logo").forEach((logo) => { logo.textContent = "نظام الموارد البشرية"; });
  sidebar.setAttribute("aria-label", "القائمة الجانبية");

  if (!document.querySelector(".sidebar-backdrop")) {
    const backdrop = document.createElement("div");
    backdrop.className = "sidebar-backdrop";
    backdrop.addEventListener("click", closeSidebar);
    document.body.appendChild(backdrop);
  }

  const titleBlock = Array.from(topbar.children).find((child) => child.tagName === "DIV" && !child.classList.contains("topbar-tools"));
  titleBlock?.classList.add("topbar-title");

  if (!topbar.querySelector(".mobile-menu-btn")) {
    const menuButton = document.createElement("button");
    menuButton.className = "secondary-btn mobile-menu-btn";
    menuButton.type = "button";
    menuButton.textContent = "القائمة";
    menuButton.addEventListener("click", toggleSidebar);
    topbar.prepend(menuButton);
  }

  if (!topbar.querySelector(".topbar-tools")) {
    const oldLogout = document.getElementById("logoutBtn");
    const tools = document.createElement("div");
    tools.className = "topbar-tools";
    tools.innerHTML = `<button type="button" class="notification-btn" aria-label="الإشعارات">الإشعارات</button><div class="user-chip"><span class="user-avatar">${(loggedUser?.full_name || "م").slice(0, 1)}</span><div><strong>${loggedUser?.full_name || "مستخدم"}</strong><small>${normalizeList(loggedAccess.roles).map((r) => shellRoleLabels[r] || r).join("، ") || "مستخدم"}</small></div></div>`;
    if (oldLogout) tools.appendChild(oldLogout);
    topbar.appendChild(tools);
  }
};

const setupBottomShortcuts = () => {
  document.querySelector(".bottom-shortcuts")?.remove();
  const items = getAllowedNavigation(true).slice(0, 5);
  if (!items.length) return;
  const nav = document.createElement("nav");
  nav.className = "bottom-shortcuts";
  nav.setAttribute("aria-label", "قائمة الاختصارات");
  nav.innerHTML = items.map((item) => `<a href="${item.path}">${item.label.replace(" والانصراف", "")}</a>`).join("");
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
    ensureUxFixes();
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
      if (accessResponse.ok) access = { roles: normalizeList(accessData.roles), permissions: normalizeList(accessData.permissions), employee_id: accessData.employee_id, employee_number: accessData.employee_number };
    } catch (error) { console.log(error); }
    loggedAccess = access;
    localStorage.setItem("user", JSON.stringify({ ...loggedUser, roles: access.roles, permissions: access.permissions, employee_id: access.employee_id, employee_number: access.employee_number }));
    setupResponsiveShell();
    rebuildSidebar();
    setupBottomShortcuts();
    applyActionPermissions();
    if (!enforcePagePermission()) return null;
    return { ...loggedUser, roles: access.roles, permissions: access.permissions, employee_id: access.employee_id, employee_number: access.employee_number };
  } catch (error) {
    console.log(error);
    localStorage.clear();
    window.location.href = "./login.html";
    return null;
  }
};
