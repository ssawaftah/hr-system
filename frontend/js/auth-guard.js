const API_BASE_URL = "https://hr-system-backend-dxj2.onrender.com/api";

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "./login.html";
}

let loggedUser = null;

const pagePermissions = {
  "dashboard.html": ["admin", "hr", "employee"],
  "users.html": ["admin"],
  "departments.html": ["admin", "hr"],
  "employees.html": ["admin", "hr"],
  "employee-profile.html": ["admin", "hr"],
  "attendance.html": ["admin", "hr"],
  "leaves.html": ["admin", "hr"],
  "salaries.html": ["admin", "hr"],
  "reports.html": ["admin", "hr"],
};

const linkPermissions = {
  dashboard: ["admin", "hr", "employee"],
  users: ["admin"],
  departments: ["admin", "hr"],
  employees: ["admin", "hr"],
  attendance: ["admin", "hr"],
  leaves: ["admin", "hr"],
  salaries: ["admin", "hr"],
  reports: ["admin", "hr"],
};

const getUserRoles = (user) => {
  if (!user) return [];

  if (Array.isArray(user.roles)) {
    return user.roles;
  }

  if (typeof user.roles === "string") {
    return user.roles
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);
  }

  if (user.role) {
    return [user.role];
  }

  return [];
};

const hasAnyRole = (userRoles, allowedRoles) => {
  if (userRoles.includes("admin")) return true;
  return allowedRoles.some((role) => userRoles.includes(role));
};

const getCurrentPageName = () => {
  const page = window.location.pathname.split("/").pop();
  return page || "dashboard.html";
};

const applyNavigationPermissions = (userRoles) => {
  document.querySelectorAll("[data-role-link]").forEach((link) => {
    const key = link.dataset.roleLink;
    const allowedRoles = linkPermissions[key] || [];

    if (!hasAnyRole(userRoles, allowedRoles)) {
      link.style.display = "none";
    }
  });
};

const enforcePagePermission = (userRoles) => {
  const currentPage = getCurrentPageName();
  const allowedRoles = pagePermissions[currentPage];

  if (!allowedRoles) return true;

  if (!hasAnyRole(userRoles, allowedRoles)) {
    alert("ليس لديك صلاحية للوصول إلى هذه الصفحة");
    window.location.href = "./dashboard.html";
    return false;
  }

  return true;
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
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();

    if (!response.ok) {
      localStorage.clear();
      window.location.href = "./login.html";
      return null;
    }

    loggedUser = data.user;
    const userRoles = getUserRoles(loggedUser);

    localStorage.setItem("user", JSON.stringify({
      ...loggedUser,
      roles: userRoles,
    }));

    applyNavigationPermissions(userRoles);

    const allowed = enforcePagePermission(userRoles);

    if (!allowed) return null;

    return {
      ...loggedUser,
      roles: userRoles,
    };
  } catch (error) {
    console.log(error);
    localStorage.clear();
    window.location.href = "./login.html";
    return null;
  }
};
