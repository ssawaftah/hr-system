const params = new URLSearchParams(window.location.search);
const employeeId = params.get("id");

const employeeName = document.getElementById("employeeName");
const employeeDetails = document.getElementById("employeeDetails");
const attendanceBody = document.getElementById("attendanceBody");
const salariesBody = document.getElementById("salariesBody");
const leavesBody = document.getElementById("leavesBody");

const initEmployeeProfile = async () => {
  const user = await loadLoggedUser();

  if (!user || user.role === "employee") {
    window.location.href = "./dashboard.html";
    return;
  }

  if (!employeeId) {
    employeeName.textContent = "لم يتم تحديد موظف";
    return;
  }

  await loadEmployee();
};

const formatDate = (date) => {
  return date ? date.split("T")[0] : "-";
};

const loadEmployee = async () => {
  const response = await fetch(`${API_BASE_URL}/employees/${employeeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    employeeName.textContent = data.error;
    return;
  }

  const employee = data.employee;

  employeeName.textContent = employee.full_name;

  employeeDetails.innerHTML = `
    <div><strong>الرقم:</strong> ${employee.id}</div>
    <div><strong>الهوية:</strong> ${employee.national_id || "-"}</div>
    <div><strong>الهاتف:</strong> ${employee.phone || "-"}</div>
    <div><strong>البريد:</strong> ${employee.email || "-"}</div>
    <div><strong>العنوان:</strong> ${employee.address || "-"}</div>
    <div><strong>المسمى:</strong> ${employee.job_title || "-"}</div>
    <div><strong>القسم:</strong> ${employee.department_name || "-"}</div>
    <div><strong>تاريخ التعيين:</strong> ${formatDate(employee.hire_date)}</div>
    <div><strong>نوع التوظيف:</strong> ${employee.employment_type || "-"}</div>
    <div><strong>الحالة:</strong> ${employee.is_active ? "نشط" : "غير نشط"}</div>
  `;

  attendanceBody.innerHTML = "";
  data.attendance.forEach((row) => {
    attendanceBody.innerHTML += `
      <tr>
        <td>${formatDate(row.attendance_date)}</td>
        <td>${row.check_in || "-"}</td>
        <td>${row.check_out || "-"}</td>
        <td>${row.status}</td>
      </tr>
    `;
  });

  salariesBody.innerHTML = "";
  data.salaries.forEach((row) => {
    salariesBody.innerHTML += `
      <tr>
        <td>${row.salary_month}</td>
        <td>${row.net_salary}</td>
        <td>${row.status}</td>
      </tr>
    `;
  });

  leavesBody.innerHTML = "";
  data.leaves.forEach((row) => {
    leavesBody.innerHTML += `
      <tr>
        <td>${row.leave_type}</td>
        <td>${formatDate(row.start_date)}</td>
        <td>${formatDate(row.end_date)}</td>
        <td>${row.status}</td>
      </tr>
    `;
  });
};

initEmployeeProfile();
