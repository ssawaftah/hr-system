const usersTableBody = document.getElementById("usersTableBody");
const formMessage = document.getElementById("formMessage");
const createUserForm = document.getElementById("createUserForm");
const createUserSection = document.getElementById("createUserSection");

const initUsers = async () => {
  const user = await loadLoggedUser();

  if (!user) return;

  if (user.role === "employee") {
    window.location.href = "./dashboard.html";
    return;
  }

  if (user.role !== "admin") {
    createUserSection.style.display = "none";
  }

  await loadUsers();
};

const loadUsers = async () => {
  const response = await fetch(`${API_BASE_URL}/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    usersTableBody.innerHTML = `<tr><td colspan="5">${data.error}</td></tr>`;
    return;
  }

  usersTableBody.innerHTML = "";

  data.users.forEach((user) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${user.id}</td>
      <td>${user.full_name}</td>
      <td>${user.email}</td>
      <td>${user.role}</td>
      <td>${user.is_active ? "نشط" : "معطل"}</td>
    `;

    usersTableBody.appendChild(row);
  });
};

createUserForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    full_name: document.getElementById("full_name").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
    role: document.getElementById("role").value,
  };

  const response = await fetch(`${API_BASE_URL}/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    formMessage.style.color = "red";
    formMessage.textContent = data.error;
    return;
  }

  formMessage.style.color = "green";
  formMessage.textContent = data.message;
  createUserForm.reset();
  await loadUsers();
});

initUsers();
