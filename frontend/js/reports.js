const attendanceSummaryBody = document.getElementById("attendanceSummaryBody");
const salarySummaryBody = document.getElementById("salarySummaryBody");

let attendanceSummary = [];
let salarySummary = [];

const initReports = async () => {
  const user = await loadLoggedUser();

  if (!user || user.role === "employee") {
    window.location.href = "./dashboard.html";
    return;
  }

  await loadAttendanceSummary();
  await loadSalarySummary();
};

const loadAttendanceSummary = async () => {
  const response = await fetch(`${API_BASE_URL}/reports/attendance-summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) return;

  attendanceSummary = data.summary;
  attendanceSummaryBody.innerHTML = "";

  attendanceSummary.forEach((row) => {
    attendanceSummaryBody.innerHTML += `
      <tr>
        <td>${row.status}</td>
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

  if (!response.ok) return;

  salarySummary = data.summary;
  salarySummaryBody.innerHTML = "";

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

const exportCSV = (filename, rows) => {
  const csv = rows.map((row) => row.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
};

document.getElementById("exportAttendanceSummary").addEventListener("click", () => {
  exportCSV("attendance-summary.csv", [
    ["status", "count"],
    ...attendanceSummary.map((row) => [row.status, row.count]),
  ]);
});

document.getElementById("exportSalarySummary").addEventListener("click", () => {
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
