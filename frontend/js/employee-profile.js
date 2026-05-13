const params = new URLSearchParams(window.location.search);
const employeeId = params.get("id");

const employeeName = document.getElementById("employeeName");
const employeeMeta = document.getElementById("employeeMeta");
const employeeDetails = document.getElementById("employeeDetails");
const attendanceBody = document.getElementById("attendanceBody");
const salariesBody = document.getElementById("salariesBody");
const leavesBody = document.getElementById("leavesBody");
const auditBody = document.getElementById("auditBody");
const editEmployeeBtn = document.getElementById("editEmployeeBtn");
const summaryStatus = document.getElementById("summaryStatus");
const summaryMainDepartment = document.getElementById("summaryMainDepartment");
const summarySubDepartment = document.getElementById("summarySubDepartment");
const summarySalary = document.getElementById("summarySalary");

let loadedEmployee = null;

const initEmployeeProfile = async () => {
  const user = await loadLoggedUser();
  if (!user || user.role === "employee") {
    window.location.href = "./dashboard.html";
    return;
  }
  if (!employeeId) {
    employeeName.textContent = "لم يتم تحديد موظف";
    employeeMeta.textContent = "ارجع إلى قائمة الموظفين واختر موظفًا من زر عرض";
    return;
  }
  await loadEmployee();
};

const formatDate = (date) => date ? String(date).split("T")[0] : "-";
const formatMoney = (value) => Number(value || 0).toLocaleString("ar-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const employmentTypeLabel = (value) => ({ full_time: "دوام كامل", part_time: "دوام جزئي", contract: "عقد" }[value] || value || "-");
const statusText = (value, isActive) => ({ active: "نشط", inactive: "غير نشط", suspended: "موقوف", resigned: "مستقيل", archived: "مؤرشف" }[value] || (isActive ? "نشط" : "غير نشط"));
const leaveLabel = (value) => ({ annual: "سنوية", sick: "مرضية", unpaid: "بدون راتب", other: "أخرى" }[value] || value || "-");
const requestStatusLabel = (value) => ({ pending: "قيد الانتظار", approved: "مقبولة", rejected: "مرفوضة", draft: "مسودة", cancelled: "ملغاة", active: "نشط", absent: "غائب", late: "متأخر", present: "حاضر", paid: "مدفوع", unpaid: "غير مدفوع" }[value] || value || "-");

const calculateDays = (startDate, endDate) => {
  if (!startDate || !endDate) return "-";
  const start = new Date(formatDate(startDate));
  const end = new Date(formatDate(endDate));
  const days = Math.round((end - start) / 86400000) + 1;
  return days > 0 ? days : "-";
};

const getMainAndSubDepartments = (employee) => {
  const memberships = employee.departments || [];
  const primary = employee.primary_department || memberships.find((item) => item.is_primary);
  const secondary = memberships.find((item) => !item.is_primary);
  return {
    main: primary?.department_name || employee.department_name || "-",
    sub: secondary?.department_name || "-",
    all: memberships.length ? memberships.map((item) => `${item.department_name}${item.is_primary ? " - رئيسي" : " - فرعي"}`).join("، ") : (primary?.department_name || employee.department_name || "-"),
  };
};

const fillEmpty = (tbody, colspan, text) => {
  tbody.innerHTML = `<tr><td colspan="${colspan}">${text}</td></tr>`;
};

const loadEmployee = async () => {
  employeeName.textContent = "جاري التحميل...";
  const response = await fetch(`${API_BASE_URL}/employees/${employeeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    employeeName.textContent = data.error || "تعذر تحميل بيانات الموظف";
    employeeMeta.textContent = "تأكد من وجود الموظف ومن صلاحيتك للوصول";
    return;
  }

  loadedEmployee = data.employee;
  const employee = loadedEmployee;
  const departmentInfo = getMainAndSubDepartments(employee);
  const status = statusText(employee.status, employee.is_active);

  employeeName.textContent = employee.full_name;
  employeeMeta.textContent = `${employee.job_title || "بدون مسمى"} • ${departmentInfo.main}${departmentInfo.sub !== "-" ? " / " + departmentInfo.sub : ""}`;
  summaryStatus.textContent = status;
  summaryMainDepartment.textContent = departmentInfo.main;
  summarySubDepartment.textContent = departmentInfo.sub;
  summarySalary.textContent = `${formatMoney(employee.basic_salary)} د.أ`;

  employeeDetails.innerHTML = `
    <div><strong>رقم الموظف:</strong> ${employee.employee_number || employee.national_id || employee.id}</div>
    <div><strong>الاسم الكامل:</strong> ${employee.full_name}</div>
    <div><strong>الهاتف:</strong> ${employee.phone || "-"}</div>
    <div><strong>البريد الإلكتروني:</strong> ${employee.email || "-"}</div>
    <div><strong>العنوان:</strong> ${employee.address || "-"}</div>
    <div><strong>المسمى الوظيفي:</strong> ${employee.job_title || "-"}</div>
    <div><strong>القسم الرئيسي:</strong> ${departmentInfo.main}</div>
    <div><strong>القسم الفرعي:</strong> ${departmentInfo.sub}</div>
    <div><strong>كل الأقسام:</strong> ${departmentInfo.all}</div>
    <div><strong>تاريخ التعيين:</strong> ${formatDate(employee.hire_date)}</div>
    <div><strong>نوع التوظيف:</strong> ${employmentTypeLabel(employee.employment_type)}</div>
    <div><strong>الحالة:</strong> ${status}</div>
    <div><strong>الراتب الأساسي:</strong> ${formatMoney(employee.basic_salary)} د.أ</div>
    <div><strong>خصم الضمان:</strong> ${employee.social_security_enabled ? "مفعل" : "غير مفعل"}</div>
    <div><strong>نسبة الضمان:</strong> ${employee.social_security_rate || 0}%</div>
    <div><strong>تاريخ الإنشاء:</strong> ${formatDate(employee.created_at)}</div>
    <div><strong>آخر تعديل:</strong> ${formatDate(employee.updated_at)}</div>
  `;

  renderAttendance(data.attendance || []);
  renderLeaves(data.leaves || []);
  renderSalaries(data.salaries || []);
  renderAudit(data.audit_logs || []);
};

const renderAttendance = (rows) => {
  attendanceBody.innerHTML = "";
  if (!rows.length) return fillEmpty(attendanceBody, 5, "لا توجد سجلات حضور لهذا الموظف");
  rows.forEach((row) => {
    attendanceBody.innerHTML += `<tr><td>${formatDate(row.attendance_date || row.date)}</td><td>${row.check_in || "-"}</td><td>${row.check_out || "-"}</td><td>${requestStatusLabel(row.status)}</td><td>${row.source || row.record_source || "النظام"}</td></tr>`;
  });
};

const renderLeaves = (rows) => {
  leavesBody.innerHTML = "";
  if (!rows.length) return fillEmpty(leavesBody, 5, "لا توجد طلبات إجازة لهذا الموظف");
  rows.forEach((row) => {
    leavesBody.innerHTML += `<tr><td>${leaveLabel(row.leave_type)}</td><td>${formatDate(row.start_date)}</td><td>${formatDate(row.end_date)}</td><td>${calculateDays(row.start_date, row.end_date)}</td><td>${requestStatusLabel(row.status)}</td></tr>`;
  });
};

const renderSalaries = (rows) => {
  salariesBody.innerHTML = "";
  if (!rows.length) return fillEmpty(salariesBody, 5, "لا توجد سجلات رواتب لهذا الموظف");
  rows.forEach((row) => {
    salariesBody.innerHTML += `<tr><td>${row.salary_month || row.month || "-"}</td><td>${formatMoney(row.gross_salary || row.total_salary || 0)}</td><td>${formatMoney(row.total_deductions || row.deductions || 0)}</td><td>${formatMoney(row.net_salary || 0)}</td><td>${requestStatusLabel(row.status)}</td></tr>`;
  });
};

const renderAudit = (rows) => {
  auditBody.innerHTML = "";
  if (!rows.length) return fillEmpty(auditBody, 3, "لا توجد تعديلات مسجلة على هذا الموظف");
  rows.forEach((row) => {
    auditBody.innerHTML += `<tr><td>${row.action || "-"}</td><td>${formatDate(row.created_at)}</td><td>${row.actor_user_id || "النظام"}</td></tr>`;
  });
};

editEmployeeBtn.addEventListener("click", () => {
  if (!loadedEmployee) return;
  window.location.href = `./employees.html?edit=${employeeId}`;
});

initEmployeeProfile();
