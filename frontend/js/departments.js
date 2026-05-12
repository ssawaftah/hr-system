const tableBody = document.getElementById("departmentsTableBody");
const form = document.getElementById("departmentForm");
const formMessage = document.getElementById("formMessage");
const cancelEditBtn = document.getElementById("cancelEditBtn");

let departments = [];

const initDepartments = async () => {
  const user = await loadLoggedUser();
  if (!user || user.role === "employee") {
    window.location.href = "./dashboard.html";
    return;
  }

  await loadDepartments();
};

const loadDepartments = async () => {
  const response = await fetch(`${API_BASE_URL}/departments`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    tableBody.innerHTML = `<tr><td colspan="5">${data.error}</td></tr>`;
    return;
  }

  departments = data.departments;
  renderDepartments();
};

const renderDepartments = () => {
  tableBody.innerHTML = "";

  departments.forEach((department) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${department.id}</td>
      <td>${department.name}</td>
      <td>${department.description || "-"}</td>
      <td>${department.is_active ? "نشط" : "معطل"}</td>
      <td>
        <button class="edit-btn" onclick="editDepartment(${department.id})">تعديل</button>
        <button class="danger-btn" onclick="deleteDepartment(${department.id})">حذف</button>
      </td>
    `;

    tableBody.appendChild(row);
  });
};

const editDepartment = (id) => {
  const department = departments.find((item) => item.id === id);
  if (!department) return;

  document.getElementById("departmentId").value = department.id;
  document.getElementById("departmentName").value = department.name;
  document.getElementById("departmentDescription").value = department.description || "";
  document.getElementById("departmentActive").value = String(department.is_active);
  document.getElementById("departmentFormTitle").textContent = "تعديل قسم";
};

const resetForm = () => {
  form.reset();
  document.getElementById("departmentId").value = "";
  document.getElementById("departmentFormTitle").textContent = "إضافة قسم";
};

cancelEditBtn.addEventListener("click", resetForm);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("departmentId").value;

  const body = {
    name: document.getElementById("departmentName").value.trim(),
    description: document.getElementById("departmentDescription").value.trim(),
    is_active: document.getElementById("departmentActive").value === "true",
  };

  const url = id
    ? `${API_BASE_URL}/departments/${id}`
    : `${API_BASE_URL}/departments`;

  const method = id ? "PUT" : "POST";

  const response = await fetch(url, {
    method,
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
  resetForm();
  await loadDepartments();
});

const deleteDepartment = async (id) => {
  if (!confirm("هل أنت متأكد من حذف القسم؟")) return;

  const response = await fetch(`${API_BASE_URL}/departments/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error);
    return;
  }

  await loadDepartments();
};

initDepartments();
