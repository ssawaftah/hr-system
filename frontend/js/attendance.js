const tableBody = document.getElementById("attendanceTableBody");
const form = document.getElementById("attendanceForm");
const formMessage = document.getElementById("formMessage");
const employeeSelect = document.getElementById("employee_id");
const attendanceSearchInput = document.getElementById("attendanceSearchInput");
const attendanceEmployeeFilter = document.getElementById("attendanceEmployeeFilter");
const attendanceStatusFilter = document.getElementById("attendanceStatusFilter");
const attendanceFromDate = document.getElementById("attendanceFromDate");
const attendanceToDate = document.getElementById("attendanceToDate");
const refreshAttendanceBtn = document.getElementById("refreshAttendanceBtn");
const exportAttendanceBtn = document.getElementById("exportAttendanceBtn");
const attendanceCountText = document.getElementById("attendanceCountText");

let attendanceRecords = [];
let employees = [];

const statusLabels = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  leave: "إجازة",
};

const statusClasses = {
  present: "active-badge",
  absent: "inactive-badge",
  late: "warning-badge",
  leave: "info-badge",
};

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

  employees = data.employees;
  employeeSelect.innerHTML = `<option value="">اختر الموظف</option>`;
  attendanceEmployeeFilter.innerHTML = `<option value="">كل الموظفين</option>`;

  employees.forEach((employee) => {
    employeeSelect.innerHTML += `<option value="${employee.id}">${employee.full_name}</option>`;
    attendanceEmployeeFilter.innerHTML += `<option value="${employee.id}">${employee.full_name}</option>`;
  });
};

const loadAttendance = async () => {
  attendanceCountText.textContent = "جاري تحميل البيانات...";

  const response = await fetch(`${API_BASE_URL}/attendance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    tableBody.innerHTML = `<tr><td colspan="8">${data.error}</td></tr>`;
    attendanceCountText.textContent = "تعذر تحميل البيانات";
    return;
  }

  attendanceRecords = data.attendance;
  renderAttendance();
};

const formatDate = (date) => {
  return date ? date.split("T")[0] : "-";
};

const getFilteredAttendance = () => {
  const searchValue = attendanceSearchInput.value.trim().toLowerCase();
  const selectedEmployee = attendanceEmployeeFilter.value;
  const selectedStatus = attendanceStatusFilter.value;
  const fromDate = attendanceFromDate.value;
  const toDate = attendanceToDate.value;

  return attendanceRecords.filter((record) => {
    const recordDate = formatDate(record.attendance_date);
    const searchableText = [record.employee_name, record.notes, record.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = !searchValue || searchableText.includes(searchValue);
    const matchesEmployee = !selectedEmployee || String(record.employee_id) === selectedEmployee;
    const matchesStatus = !selectedStatus || record.status === selectedStatus;
    const matchesFromDate = !fromDate || recordDate >= fromDate;
    const matchesToDate = !toDate || recordDate <= toDate;

    return matchesSearch && matchesEmployee && matchesStatus && matchesFromDate && matchesToDate;
  });
};

const renderAttendance = () => {
  tableBody.innerHTML = "";

  const filteredRecords = getFilteredAttendance();
  attendanceCountText.textContent = `عرض ${filteredRecords.length} من أصل ${attendanceRecords.length} سجل`;

  if (filteredRecords.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8">لا توجد سجلات مطابقة للبحث أو الفلاتر الحالية</td>
      </tr>
    `;
    return;
  }

  filteredRecords.forEach((record) => {
    const row = document.createElement("tr");
    const statusLabel = statusLabels[record.status] || record.status;
    const statusClass = statusClasses[record.status] || "info-badge";

    row.innerHTML = `
      <td>${record.id}</td>
      <td>${record.employee_name}</td>
      <td>${formatDate(record.attendance_date)}</td>
      <td>${record.check_in || "-"}</td>
      <td>${record.check_out || "-"}</td>
      <td>
        <span class="status-badge ${statusClass}">${statusLabel}</span>
      </td>
      <td>${record.notes || "-"}</td>
      <td>
        <div class="row-actions">
          <button class="danger-btn small-btn" onclick="deleteAttendance(${record.id})">حذف</button>
        </div>
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
    showMessage(data.error || "تعذر حفظ سجل الحضور", "error");
    return;
  }

  showMessage(data.message || "تم حفظ سجل الحضور بنجاح", "success");
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
    showMessage(data.error || "تعذر حذف سجل الحضور", "error");
    return;
  }

  showMessage(data.message || "تم حذف سجل الحضور بنجاح", "success");
  await loadAttendance();
};

const escapeCsvValue = (value) => {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
};

const exportAttendanceToCSV = () => {
  const filteredRecords = getFilteredAttendance();

  const rows = [
    ["id", "employee", "date", "check_in", "check_out", "status", "notes"],
    ...filteredRecords.map((record) => [
      record.id,
      record.employee_name,
      formatDate(record.attendance_date),
      record.check_in || "",
      record.check_out || "",
      statusLabels[record.status] || record.status,
      record.notes || "",
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "attendance.csv";
  link.click();
  URL.revokeObjectURL(url);
};

attendanceSearchInput.addEventListener("input", renderAttendance);
attendanceEmployeeFilter.addEventListener("change", renderAttendance);
attendanceStatusFilter.addEventListener("change", renderAttendance);
attendanceFromDate.addEventListener("change", renderAttendance);
attendanceToDate.addEventListener("change", renderAttendance);
refreshAttendanceBtn.addEventListener("click", loadAttendance);
exportAttendanceBtn.addEventListener("click", exportAttendanceToCSV);

initAttendance();
