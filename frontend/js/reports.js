const attendanceSummaryBody = document.getElementById("attendanceSummaryBody");
const salarySummaryBody = document.getElementById("salarySummaryBody");
const salaryReportSection = document.getElementById("salaryReportSection");
const exportAttendanceSummaryBtn = document.getElementById("exportAttendanceSummary");
const exportSalarySummaryBtn = document.getElementById("exportSalarySummary");

let attendanceSummary = [];
let salarySummary = [];
let currentUserRoles = [];

const hasRole = (role) => currentUserRoles.includes(role);

const initReports = async () => {
  const user = await loadLoggedUser();

  if (!user || user.role === "employee") {
    window.location.href = "./dashboard.html";
    return;
  }

  currentUserRoles = Array.isArray(user.roles) ? user.roles : [user.role];

  await loadAttendanceSummary();

  if (hasRole("admin")) {
    await loadSalarySummary();
  } else if (salaryReportSection) {
    salaryReportSection.style.display = "none";
  }
};

const statusLabels = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  leave: "إجازة",
};

const loadAttendanceSummary = async () => {
  const response = await fetch(`${API_BASE_URL}/reports/attendance-summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    attendanceSummaryBody.innerHTML = `<tr><td colspan="2">تعذر تحميل تقرير الحضور</td></tr>`;
    return;
  }

  attendanceSummary = data.summary || [];
  attendanceSummaryBody.innerHTML = "";

  if (attendanceSummary.length === 0) {
    attendanceSummaryBody.innerHTML = `<tr><td colspan="2">لا توجد بيانات حضور</td></tr>`;
    return;
  }

  attendanceSummary.forEach((row) => {
    attendanceSummaryBody.innerHTML += `
      <tr>
        <td>${statusLabels[row.status] || row.status}</td>
        <td>${row.count}</td>
      </tr>
    `;
  });
};

const loadSalarySummary = async () => {
  const response = await fetch(`${API_BASE_URL}/reports/salary-summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    if (salaryReportSection) {
      salaryReportSection.style.display = "none";
    }
    return;
  }

  salarySummary = data.summary || [];
  salarySummaryBody.innerHTML = "";

  if (salarySummary.length === 0) {
    salarySummaryBody.innerHTML = `<tr><td colspan="3">لا توجد بيانات رواتب</td></tr>`;
    return;
  }

  salarySummary.forEach((row) => {
    salarySummaryBody.innerHTML += `
      <tr>
        <td>${row.salary_month}</td>
        <td>${row.records_count}</td>
        <td>${row.total_net_salary || 0}</td>
      </tr>
    `;
  });
};

const escapeCsvValue = (value) => {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
};

const exportCSV = (filename, rows) => {
  const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

exportAttendanceSummaryBtn?.addEventListener("click", () => {
  exportCSV("attendance-summary.csv", [
    ["status", "count"],
    ...attendanceSummary.map((row) => [statusLabels[row.status] || row.status, row.count]),
  ]);
});

exportSalarySummaryBtn?.addEventListener("click", () => {
  if (!hasRole("admin")) return;

  exportCSV("salary-summary.csv", [
    ["salary_month", "records_count", "total_net_salary"],
    ...salarySummary.map((row) => [
      row.salary_month,
      row.records_count,
      row.total_net_salary || 0,
    ]),
  ]);
});

initReports();
