const API_BASE_URL = "https://hr-system-backend-dxj2.onrender.com/api";
const token = localStorage.getItem("token");
if (!token) window.location.href = "./login.html";

let loggedUser = null;
let loggedAccess = { roles: [], permissions: [] };
let shellReady = false;
let lastNavKey = "";

const fallbackNavigationConfig = [
  { id: "dashboard", label: "الرئيسية", path: "./dashboard.html", icon: "⌂", group: "الرئيسية", requiredPermissions: ["dashboard.view"], showInSidebar: true, showInShortcutMenu: true, order: 1 },
  { id: "attendance", label: "الحضور والانصراف", path: "./attendance.html", icon: "◷", group: "التشغيل اليومي", requiredPermissions: ["attendance.view", "attendance.view.self", "attendance.view.department", "attendance.view.all"], showInSidebar: true, showInShortcutMenu: true, order: 10 },
  { id: "leaves", label: "الطلبات", path: "./leaves.html", icon: "◫", group: "التشغيل اليومي", requiredPermissions: ["leaves.view", "requests.view.self", "requests.view.department", "requests.view.all"], showInSidebar: true, showInShortcutMenu: true, order: 11 },
  { id: "shifts", label: "الشفتات", path: "./shifts.html", icon: "⇄", group: "التشغيل اليومي", requiredPermissions: ["shifts.view"], showInSidebar: true, showInShortcutMenu: false, order: 12 },
  { id: "employees", label: "الموظفون", path: "./employees.html", icon: "☷", group: "الموارد البشرية", requiredPermissions: ["employees.view", "employees.view.self"], showInSidebar: true, showInShortcutMenu: false, order: 20 },
  { id: "departments", label: "الأقسام", path: "./departments.html", icon: "▦", group: "الموارد البشرية", requiredPermissions: ["departments.view"], showInSidebar: true, showInShortcutMenu: false, order: 21 },
  { id: "salaries", label: "الرواتب", path: "./salaries.html", icon: "◈", group: "المالية", requiredPermissions: ["salaries.view", "finance.payroll_slips.view"], showInSidebar: true, showInShortcutMenu: true, order: 30 },
  { id: "reports", label: "التقارير", path: "./reports.html", icon: "▣", group: "التقارير", requiredPermissions: ["reports.view", "reports.view.self", "reports.view.department", "reports.view.all"], showInSidebar: true, showInShortcutMenu: false, order: 40 },
  { id: "announcements", label: "الإعلانات", path: "./announcements.html", icon: "✦", group: "النظام", requiredPermissions: ["announcements.view.self", "announcements.view.department", "announcements.view.all", "announcements.manage"], showInSidebar: true, showInShortcutMenu: true, order: 45 },
  { id: "users", label: "الصلاحيات", path: "./users.html", icon: "◌", group: "النظام", requiredPermissions: ["users.view", "permissions.view"], showInSidebar: true, showInShortcutMenu: false, order: 50 },
];
const getNavigationConfig = () => Array.isArray(window.navigationConfig) ? window.navigationConfig : fallbackNavigationConfig;
const shellRoleLabels = { admin: "مدير النظام", hr: "الموارد البشرية", employee: "موظف", manager: "مدير قسم", finance: "المالية" };
const normalizeList = (value) => !value ? [] : Array.isArray(value) ? value.flatMap(normalizeList) : String(value).split(",").map((item) => item.trim()).filter(Boolean);
const hasPermission = (permission) => loggedAccess.roles.includes("admin") || loggedAccess.permissions.includes(permission) || loggedAccess.permissions.includes("system.admin");
const hasAnyPermission = (permissions = []) => loggedAccess.roles.includes("admin") || permissions.length === 0 || permissions.some((permission) => hasPermission(permission));
const getCurrentPageName = () => window.location.pathname.split("/").pop() || "dashboard.html";
const canAccessPath = (path) => {
  const page = path.replace("./", "");
  const item = getNavigationConfig().find((nav) => nav.path.replace("./", "") === page);
  return !item || hasAnyPermission(item.requiredPermissions || []);
};
const readAccessCache = () => {
  try {
    const raw = sessionStorage.getItem("hr_access_cache_v2");
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (cache.token !== token || Date.now() - cache.time > 5 * 60 * 1000) return null;
    return cache;
  } catch (_) { return null; }
};
const writeAccessCache = (user, access) => {
  try { sessionStorage.setItem("hr_access_cache_v2", JSON.stringify({ token, user, access, time: Date.now() })); } catch (_) {}
};
const injectStylesheet = (href) => {
  if (document.querySelector(`link[href*="${href.split('?')[0]}"]`)) return;
  const el = document.createElement("link");
  el.rel = "stylesheet";
  el.href = href;
  document.head.appendChild(el);
};
const ensureUxFixes = () => {
  injectStylesheet("./css/app.css?v=clean-apple-2");
  injectStylesheet("./css/icons.css?v=svg-icons-1");
  document.documentElement.lang = "ar";
  document.documentElement.dir = "rtl";
  document.body.dir = "rtl";
  document.body.classList.add("apple-system-ui");
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
const getAllowedNavigation = (shortcutOnly = false) => getNavigationConfig().filter((item) => shortcutOnly ? item.showInShortcutMenu : item.showInSidebar).filter((item) => hasAnyPermission(item.requiredPermissions || [])).sort((a, b) => (a.order || 0) - (b.order || 0));
const rebuildSidebar = () => {
  const menu = document.querySelector(".sidebar-menu");
  if (!menu) return;
  const current = getCurrentPageName();
  const navKey = `${current}|${loggedAccess.roles.join(",")}|${loggedAccess.permissions.join(",")}`;
  if (lastNavKey === navKey && menu.dataset.ready === "true") return;
  lastNavKey = navKey;
  const groups = getAllowedNavigation(false).reduce((map, item) => {
    const group = item.group || "النظام";
    if (!map[group]) map[group] = [];
    map[group].push(item);
    return map;
  }, {});
  menu.innerHTML = Object.entries(groups).map(([group, groupItems]) => `<div class="nav-group-title">${group}</div>${groupItems.map((item) => `<a href="${item.path}" class="${item.path.replace("./", "") === current ? "active" : ""}" data-nav-id="${item.id}"><span class="nav-icon">${item.icon || "•"}</span><span>${item.label}</span></a>`).join("")}`).join("");
  menu.dataset.ready = "true";
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
const enhanceTables = () => {
  document.querySelectorAll("table").forEach((table) => {
    const headers = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent.trim());
    table.querySelectorAll("tbody tr").forEach((tr) => Array.from(tr.children).forEach((td, index) => td.setAttribute("data-label", headers[index] || "")));
    if (table.parentElement?.classList.contains("table-scroll")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "table-scroll";
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
};
const enhancePageStructure = () => {
  document.querySelectorAll(".content-card, .table-container").forEach((card) => card.classList.add("ui-card"));
  document.querySelectorAll("form").forEach((form) => form.classList.add("ui-form"));
  enhanceTables();
};
const setupResponsiveShell = () => {
  const sidebar = document.querySelector(".sidebar");
  const topbar = document.querySelector(".topbar");
  const appLayout = document.querySelector(".app-layout");
  if (!sidebar || !topbar || !appLayout) return;
  document.querySelectorAll(".sidebar-logo").forEach((logo) => { logo.innerHTML = `<span class="brand-mark">HR</span><span>نظام الموارد البشرية</span>`; });
  sidebar.setAttribute("aria-label", "القائمة الجانبية");
  if (!document.querySelector(".sidebar-backdrop")) {
    const backdrop = document.createElement("div");
    backdrop.className = "sidebar-backdrop";
    backdrop.addEventListener("click", closeSidebar);
    document.body.appendChild(backdrop);
  }
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
  if (!shellReady) {
    window.addEventListener("resize", () => { if (window.innerWidth > 1000) closeSidebar(); });
    shellReady = true;
  }
};
const setupBottomShortcuts = () => {
  document.querySelector(".bottom-shortcuts")?.remove();
  const preferred = ["dashboard", "attendance", "leaves", "announcements", "salaries"];
  const allowed = getAllowedNavigation(true);
  const items = [...allowed.filter((item) => preferred.includes(item.id)), ...allowed.filter((item) => !preferred.includes(item.id))].slice(0, 5);
  if (!items.length) return;
  const nav = document.createElement("nav");
  nav.className = "bottom-shortcuts";
  nav.setAttribute("aria-label", "قائمة الاختصارات");
  nav.innerHTML = items.map((item) => `<a href="${item.path}"><span>${item.icon || "•"}</span><strong>${item.label.replace(" والانصراف", "")}</strong></a>`).join("");
  document.body.appendChild(nav);
};
const logoutButton = document.getElementById("logoutBtn");
if (logoutButton) logoutButton.addEventListener("click", () => { localStorage.clear(); sessionStorage.clear(); window.location.href = "./login.html"; });
const applyLoadedUser = (user, access) => {
  loggedUser = user;
  loggedAccess = { roles: normalizeList(access.roles), permissions: normalizeList(access.permissions), employee_id: access.employee_id, employee_number: access.employee_number };
  localStorage.setItem("user", JSON.stringify({ ...loggedUser, roles: loggedAccess.roles, permissions: loggedAccess.permissions, employee_id: loggedAccess.employee_id, employee_number: loggedAccess.employee_number }));
  setupResponsiveShell();
  rebuildSidebar();
  setupBottomShortcuts();
  applyActionPermissions();
  enhancePageStructure();
  if (!enforcePagePermission()) return null;
  setTimeout(enhanceTables, 250);
  setTimeout(enhanceTables, 1200);
  return { ...loggedUser, roles: loggedAccess.roles, permissions: loggedAccess.permissions, employee_id: loggedAccess.employee_id, employee_number: loggedAccess.employee_number };
};
const loadLoggedUser = async () => {
  try {
    ensureUxFixes();
    const cached = readAccessCache();
    if (cached?.user && cached?.access) return applyLoadedUser(cached.user, cached.access);
    const [meResponse, accessResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_BASE_URL}/users/me/access`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
    ]);
    const data = await meResponse.json();
    if (!meResponse.ok) { localStorage.clear(); sessionStorage.clear(); window.location.href = "./login.html"; return null; }
    let access = { roles: normalizeList(data.user.roles || data.user.role), permissions: [] };
    if (accessResponse?.ok) {
      const accessData = await accessResponse.json();
      access = { roles: normalizeList(accessData.roles), permissions: normalizeList(accessData.permissions), employee_id: accessData.employee_id, employee_number: accessData.employee_number };
    }
    writeAccessCache(data.user, access);
    return applyLoadedUser(data.user, access);
  } catch (error) {
    console.log(error);
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "./login.html";
    return null;
  }
};
