const tableBody = document.getElementById("attendanceTableBody");
const form = document.getElementById("attendanceForm");
const formMessage = document.getElementById("formMessage");
const employeeSelect = document.getElementById("employee_id");

const initAttendance = async () => {
  const user = await loadLoggedUser();

  if (!user || user.role === "employee") {
    window.location.href = "./dashboard.html";
    return;
  }

  await loadEmployees();
  await loadAttendance();
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

const loadAttendance = async () => {
  const response = await fetch(`${API_BASE_URL}/attendance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    tableBody.innerHTML = `<tr><td colspan="8">${data.error}</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";

  data.attendance.forEach((record) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${record.id}</td>
      <td>${record.employee_name}</td>
      <td>${record.attendance_date ? record.attendance_date.split("T")[0] : "-"}</td>
      <td>${record.check_in || "-"}</td>
      <td>${record.check_out || "-"}</td>
      <td>${record.status}</td>
      <td>${record.notes || "-"}</td>
      <td>
        <button class="danger-btn" onclick="deleteAttendance(${record.id})">حذف</button>
      </td>
    `;

    tableBody.appendChild(row);
  });
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    employee_id: document.getElementById("employee_id").value,
    attendance_date: document.getElementById("attendance_date").value,
    check_in: document.getElementById("check_in").value || null,
    check_out: document.getElementById("check_out").value || null,
    status: document.getElementById("status").value,
    notes: document.getElementById("notes").value.trim(),
  };

  const response = await fetch(`${API_BASE_URL}/attendance`, {
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
  await loadAttendance();
});

const deleteAttendance = async (id) => {
  if (!confirm("هل أنت متأكد من حذف سجل الحضور؟")) return;

  const response = await fetch(`${API_BASE_URL}/attendance/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error);
    return;
  }

  await loadAttendance();
};

initAttendance();
