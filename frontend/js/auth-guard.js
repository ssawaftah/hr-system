const API_BASE_URL = "http://localhost:5000/api";

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "./login.html";
}

let loggedUser = null;

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
    localStorage.setItem("user", JSON.stringify(loggedUser));

    if (loggedUser.role === "employee") {
      document.querySelectorAll("[data-role-link]").forEach((link) => {
        if (link.dataset.roleLink !== "dashboard") {
          link.style.display = "none";
        }
      });
    }

    return loggedUser;
  } catch (error) {
    console.log(error);
    localStorage.clear();
    window.location.href = "./login.html";
    return null;
  }
};
