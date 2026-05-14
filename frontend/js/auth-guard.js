const API_BASE_URL = "https://hr-system-backend-dxj2.onrender.com/api";
const token = localStorage.getItem("token");
if (!token) window.location.href = "./login.html";

let loggedUser = null;
let loggedAccess = { roles: [], permissions: [] };
let lastNavKey = "";

const fallbackNavigationConfig = [
  { id: "dashboard", label: "الرئيسية", path: "./dashboard.html", icon: "⌂", group: "الرئيسية", requiredPermissions: ["dashboard.view"], showInSidebar: true, order: 1 },
  { id: "attendance", label: "الحضور والانصراف", path: "./attendance.html", icon: "◷", group: "التشغيل اليومي", requiredPermissions: ["attendance.view", "attendance.view.self", "attendance.view.department", "attendance.view.all"], showInSidebar: true, order: 10 },
  { id: "leaves", label: "الطلبات", path: "./leaves.html", icon: "◫", group: "التشغيل اليومي", requiredPermissions: ["leaves.view", "requests.view.self", "requests.view.department", "requests.view.all"], showInSidebar: true, order: 11 },
  { id: "shifts", label: "الشفتات", path: "./shifts.html", icon: "⇄", group: "التشغيل اليومي", requiredPermissions: ["shifts.view"], showInSidebar: true, order: 12 },
  { id: "employees", label: "الموظفون", path: "./employees.html", icon: "☷", group: "الموارد البشرية", requiredPermissions: ["employees.view", "employees.view.self"], showInSidebar: true, order: 20 },
  { id: "departments", label: "الأقسام", path: "./departments.html", icon: "▦", group: "الموارد البشرية", requiredPermissions: ["departments.view"], showInSidebar: true, order: 21 },
  { id: "salaries", label: "الرواتب", path: "./salaries.html", icon: "◈", group: "المالية", requiredPermissions: ["salaries.view", "finance.payroll_slips.view"], showInSidebar: true, order: 30 },
  { id: "reports", label: "التقارير", path: "./reports.html", icon: "▣", group: "التقارير", requiredPermissions: ["reports.view", "reports.view.self", "reports.view.department", "reports.view.all"], showInSidebar: true, order: 40 },
  { id: "announcements", label: "الإعلانات", path: "./announcements.html", icon: "✦", group: "النظام", requiredPermissions: ["announcements.view.self", "announcements.view.department", "announcements.view.all", "announcements.manage"], showInSidebar: true, order: 45 },
  { id: "users", label: "الصلاحيات", path: "./users.html", icon: "◌", group: "النظام", requiredPermissions: ["users.view", "permissions.view"], showInSidebar: true, order: 50 },
];

const getNavigationConfig = () => Array.isArray(window.navigationConfig) ? window.navigationConfig : fallbackNavigationConfig;
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

const ensureUxFixes = () => {
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

const getAllowedNavigation = () => getNavigationConfig().filter((item) => item.showInSidebar).filter((item) => hasAnyPermission(item.requiredPermissions || [])).sort((a, b) => (a.order || 0) - (b.order || 0));

const rebuildSidebar = () => {
  const menu = document.querySelector(".sidebar-menu");
  if (!menu) return;
  const current = getCurrentPageName();
  const navKey = `${current}|${loggedAccess.roles.join(",")}|${loggedAccess.permissions.join(",")}`;
  if (lastNavKey === navKey && menu.dataset.ready === "true") return;
  lastNavKey = navKey;
  const groups = getAllowedNavigation().reduce((map, item) => {
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

const menuIcon = `<svg class="app-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;

const setupResponsiveShell = () => {
  const sidebar = document.querySelector(".sidebar");
  const topbar = document.querySelector(".topbar");
  const appLayout = document.querySelector(".app-layout");
  if (!sidebar || !topbar || !appLayout) return;

  sidebar.setAttribute("aria-label", "القائمة الجانبية");

  if (!sidebar.querySelector(".sidebar-close-btn")) {
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "sidebar-close-btn secondary-btn";
    closeButton.setAttribute("aria-label", "إغلاق القائمة");
    closeButton.textContent = "إغلاق";
    closeButton.addEventListener("click", closeSidebar);
    sidebar.prepend(closeButton);
  }

  if (!document.querySelector(".sidebar-backdrop")) {
    const backdrop = document.createElement("div");
    backdrop.className = "sidebar-backdrop";
    backdrop.addEventListener("click", closeSidebar);
    document.body.appendChild(backdrop);
  }

  if (!topbar.querySelector(".header-menu-btn")) {
    const menuButton = document.createElement("button");
    menuButton.className = "header-icon-btn header-menu-btn";
    menuButton.type = "button";
    menuButton.setAttribute("aria-label", "القائمة");
    menuButton.innerHTML = `${menuIcon}<span>القائمة</span>`;
    menuButton.addEventListener("click", toggleSidebar);
    topbar.prepend(menuButton);
  }

  window.addEventListener("resize", () => { if (window.innerWidth > 1000) closeSidebar(); });
  window.addEventListener("keydown", (event) => { if (event.key === "Escape") closeSidebar(); });
};

const logoutButton = document.getElementById("logoutBtn");
if (logoutButton) logoutButton.addEventListener("click", () => { localStorage.clear(); sessionStorage.clear(); window.location.href = "./login.html"; });

const applyLoadedUser = (user, access) => {
  loggedUser = user;
  loggedAccess = { roles: normalizeList(access.roles), permissions: normalizeList(access.permissions), employee_id: access.employee_id, employee_number: access.employee_number };
  localStorage.setItem("user", JSON.stringify({ ...loggedUser, roles: loggedAccess.roles, permissions: loggedAccess.permissions, employee_id: loggedAccess.employee_id, employee_number: loggedAccess.employee_number }));
  setupResponsiveShell();
  rebuildSidebar();
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
