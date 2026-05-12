const tableBody = document.getElementById("salariesTableBody");
const form = document.getElementById("salaryForm");
const formMessage = document.getElementById("formMessage");
const employeeSelect = document.getElementById("employee_id");

const initSalaries = async () => {
  const user = await loadLoggedUser();

  if (!user || user.role === "employee") {
    window.location.href = "./dashboard.html";
    return;
  }

  await loadEmployees();
  await loadSalaries();
};

const loadEmployees = async () => {
  const response = await fetch(`${API_BASE_URL}/employees`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) return;

  employeeSelect.innerHTML = `<option value="">اختر الموظف</option>`;

  data.employees.forEach((employee) => {
    employeeSelect.innerHTML += `
      <option value="${employee.id}">${employee.full_name}</option>
    `;
  });
};

const loadSalaries = async () => {
  const response = await fetch(`${API_BASE_URL}/salaries`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    tableBody.innerHTML = `<tr><td colspan="9">${data.error}</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";

  data.salaries.forEach((salary) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${salary.id}</td>
      <td>${salary.employee_name}</td>
      <td>${salary.salary_month}</td>
      <td>${salary.basic_salary}</td>
      <td>${salary.allowances}</td>
      <td>${salary.deductions}</td>
      <td>${salary.net_salary}</td>
      <td>${salary.status}</td>
      <td>
        <button class="danger-btn" onclick="deleteSalary(${salary.id})">حذف</button>
      </td>
    `;

    tableBody.appendChild(row);
  });
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    employee_id: document.getElementById("employee_id").value,
    salary_month: document.getElementById("salary_month").value,
    basic_salary: document.getElementById("basic_salary").value || 0,
    allowances: document.getElementById("allowances").value || 0,
    deductions: document.getElementById("deductions").value || 0,
    status: document.getElementById("status").value,
  };

  const response = await fetch(`${API_BASE_URL}/salaries`, {
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
  form.reset();
  await loadSalaries();
});

const deleteSalary = async (id) => {
  if (!confirm("هل أنت متأكد من حذف سجل الراتب؟")) return;

  const response = await fetch(`${API_BASE_URL}/salaries/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error);
    return;
  }

  await loadSalaries();
};

initSalaries();
