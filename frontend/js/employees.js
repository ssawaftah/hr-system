const tableBody = document.getElementById("employeesTableBody");
const form = document.getElementById("employeeForm");
const formMessage = document.getElementById("formMessage");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const departmentSelect = document.getElementById("department_id");

let employees = [];
let departments = [];

const initEmployees = async () => {
  const user = await loadLoggedUser();

  if (!user || user.role === "employee") {
    window.location.href = "./dashboard.html";
    return;
  }

  await loadDepartments();
  await loadEmployees();
};

const loadDepartments = async () => {
  const response = await fetch(`${API_BASE_URL}/departments`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) return;

  departments = data.departments;
  departmentSelect.innerHTML = `<option value="">اختر القسم</option>`;

  departments.forEach((department) => {
    departmentSelect.innerHTML += `<option value="${department.id}">${department.name}</option>`;
  });
};

const loadEmployees = async () => {
  const response = await fetch(`${API_BASE_URL}/employees`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    tableBody.innerHTML = `<tr><td colspan="8">${data.error}</td></tr>`;
    return;
  }

  employees = data.employees;
  renderEmployees();
};

const renderEmployees = () => {
  tableBody.innerHTML = "";

  employees.forEach((employee) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${employee.id}</td>
      <td>${employee.full_name}</td>
      <td>${employee.phone || "-"}</td>
      <td>${employee.email || "-"}</td>
      <td>${employee.job_title || "-"}</td>
      <td>${employee.department_name || "-"}</td>
      <td>${employee.is_active ? "نشط" : "غير نشط"}</td>
      <td>
        <button class="secondary-btn" onclick="viewEmployee(${employee.id})">عرض</button>
        <button class="edit-btn" onclick="editEmployee(${employee.id})">تعديل</button>
        <button class="danger-btn" onclick="deleteEmployee(${employee.id})">حذف</button>
      </td>
    `;

    tableBody.appendChild(row);
  });
};

const viewEmployee = (id) => {
  window.location.href = `./employee-profile.html?id=${id}`;
};

const editEmployee = (id) => {
  const employee = employees.find((item) => item.id === id);
  if (!employee) return;

  document.getElementById("employeeId").value = employee.id;
  document.getElementById("full_name").value = employee.full_name;
  document.getElementById("national_id").value = employee.national_id || "";
  document.getElementById("phone").value = employee.phone || "";
  document.getElementById("email").value = employee.email || "";
  document.getElementById("address").value = employee.address || "";
  document.getElementById("job_title").value = employee.job_title || "";
  document.getElementById("department_id").value = employee.department_id || "";
  document.getElementById("hire_date").value = employee.hire_date
    ? employee.hire_date.split("T")[0]
    : "";
  document.getElementById("employment_type").value = employee.employment_type || "full_time";
  document.getElementById("is_active").value = String(employee.is_active);
  document.getElementById("employeeFormTitle").textContent = "تعديل موظف";
};

const resetForm = () => {
  form.reset();
  document.getElementById("employeeId").value = "";
  document.getElementById("employeeFormTitle").textContent = "إضافة موظف";
};

cancelEditBtn.addEventListener("click", resetForm);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("employeeId").value;

  const body = {
    full_name: document.getElementById("full_name").value.trim(),
    national_id: document.getElementById("national_id").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    email: document.getElementById("email").value.trim(),
    address: document.getElementById("address").value.trim(),
    job_title: document.getElementById("job_title").value.trim(),
    department_id: document.getElementById("department_id").value || null,
    hire_date: document.getElementById("hire_date").value || null,
    employment_type: document.getElementById("employment_type").value,
    is_active: document.getElementById("is_active").value === "true",
  };

  const url = id ? `${API_BASE_URL}/employees/${id}` : `${API_BASE_URL}/employees`;
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
  await loadEmployees();
});

const deleteEmployee = async (id) => {
  if (!confirm("هل أنت متأكد من حذف الموظف؟")) return;

  const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error);
    return;
  }

  await loadEmployees();
};

const exportEmployeesToCSV = () => {
  const rows = [
    ["id", "full_name", "phone", "email", "job_title", "department", "is_active"],
    ...employees.map((e) => [
      e.id,
      e.full_name,
      e.phone || "",
      e.email || "",
      e.job_title || "",
      e.department_name || "",
      e.is_active ? "active" : "inactive",
    ]),
  ];

  const csv = rows.map((row) => row.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "employees.csv";
  link.click();
};

document.getElementById("exportEmployeesBtn").addEventListener("click", exportEmployeesToCSV);

initEmployees();
