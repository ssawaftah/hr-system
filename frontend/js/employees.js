const tableBody = document.getElementById("employeesTableBody");
const form = document.getElementById("employeeForm");
const formMessage = document.getElementById("formMessage");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const departmentSelect = document.getElementById("department_id");
const employeeSearchInput = document.getElementById("employeeSearchInput");
const departmentFilter = document.getElementById("departmentFilter");
const statusFilter = document.getElementById("statusFilter");
const refreshEmployeesBtn = document.getElementById("refreshEmployeesBtn");
const employeesCountText = document.getElementById("employeesCountText");

let employees = [];
let departments = [];

const showMessage = (message, type = "success") => {
  formMessage.textContent = message;
  formMessage.className = `inline-message ${type === "success" ? "success-message" : "error-message"}`;

  if (message) {
    setTimeout(() => {
      formMessage.textContent = "";
      formMessage.className = "inline-message";
    }, 4000);
  }
};

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
  departmentFilter.innerHTML = `<option value="">كل الأقسام</option>`;

  departments.forEach((department) => {
    departmentSelect.innerHTML += `<option value="${department.id}">${department.name}</option>`;
    departmentFilter.innerHTML += `<option value="${department.id}">${department.name}</option>`;
  });
};

const loadEmployees = async () => {
  employeesCountText.textContent = "جاري تحميل البيانات...";

  const response = await fetch(`${API_BASE_URL}/employees`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    tableBody.innerHTML = `<tr><td colspan="8">${data.error}</td></tr>`;
    employeesCountText.textContent = "تعذر تحميل البيانات";
    return;
  }

  employees = data.employees;
  renderEmployees();
};

const getFilteredEmployees = () => {
  const searchValue = employeeSearchInput.value.trim().toLowerCase();
  const selectedDepartment = departmentFilter.value;
  const selectedStatus = statusFilter.value;

  return employees.filter((employee) => {
    const searchableText = [
      employee.full_name,
      employee.phone,
      employee.email,
      employee.job_title,
      employee.department_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = !searchValue || searchableText.includes(searchValue);
    const matchesDepartment = !selectedDepartment || String(employee.department_id) === selectedDepartment;
    const matchesStatus =
      !selectedStatus ||
      (selectedStatus === "active" && employee.is_active) ||
      (selectedStatus === "inactive" && !employee.is_active);

    return matchesSearch && matchesDepartment && matchesStatus;
  });
};

const renderEmployees = () => {
  tableBody.innerHTML = "";

  const filteredEmployees = getFilteredEmployees();

  employeesCountText.textContent = `عرض ${filteredEmployees.length} من أصل ${employees.length} موظف`;

  if (filteredEmployees.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8">لا توجد نتائج مطابقة للبحث أو الفلاتر الحالية</td>
      </tr>
    `;
    return;
  }

  filteredEmployees.forEach((employee) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${employee.id}</td>
      <td>${employee.full_name}</td>
      <td>${employee.phone || "-"}</td>
      <td>${employee.email || "-"}</td>
      <td>${employee.job_title || "-"}</td>
      <td>${employee.department_name || "-"}</td>
      <td>
        <span class="status-badge ${employee.is_active ? "active-badge" : "inactive-badge"}">
          ${employee.is_active ? "نشط" : "غير نشط"}
        </span>
      </td>
      <td>
        <div class="row-actions">
          <button class="secondary-btn small-btn" onclick="viewEmployee(${employee.id})">عرض</button>
          <button class="edit-btn small-btn" onclick="editEmployee(${employee.id})">تعديل</button>
          <button class="danger-btn small-btn" onclick="deleteEmployee(${employee.id})">حذف</button>
        </div>
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
  document.getElementById("hire_date").value = employee.hire_date ? employee.hire_date.split("T")[0] : "";
  document.getElementById("employment_type").value = employee.employment_type || "full_time";
  document.getElementById("is_active").value = String(employee.is_active);
  document.getElementById("employeeFormTitle").textContent = "تعديل موظف";
  window.scrollTo({ top: 0, behavior: "smooth" });
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
    showMessage(data.error || "تعذر حفظ الموظف", "error");
    return;
  }

  showMessage(data.message || "تم حفظ الموظف بنجاح", "success");
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
    showMessage(data.error || "تعذر حذف الموظف", "error");
    return;
  }

  showMessage(data.message || "تم حذف الموظف بنجاح", "success");
  await loadEmployees();
};

const escapeCsvValue = (value) => {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
};

const exportEmployeesToCSV = () => {
  const filteredEmployees = getFilteredEmployees();

  const rows = [
    ["id", "full_name", "phone", "email", "job_title", "department", "is_active"],
    ...filteredEmployees.map((e) => [
      e.id,
      e.full_name,
      e.phone || "",
      e.email || "",
      e.job_title || "",
      e.department_name || "",
      e.is_active ? "active" : "inactive",
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "employees.csv";
  link.click();
  URL.revokeObjectURL(url);
};

employeeSearchInput.addEventListener("input", renderEmployees);
departmentFilter.addEventListener("change", renderEmployees);
statusFilter.addEventListener("change", renderEmployees);
refreshEmployeesBtn.addEventListener("click", loadEmployees);
document.getElementById("exportEmployeesBtn").addEventListener("click", exportEmployeesToCSV);

initEmployees();
