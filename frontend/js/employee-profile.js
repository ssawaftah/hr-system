const params = new URLSearchParams(window.location.search);
const employeeId = params.get("id");

const employeeName = document.getElementById("employeeName");
const employeeMeta = document.getElementById("employeeMeta");
const employeeAvatar = document.getElementById("employeeAvatar");
const employeeStatusBadge = document.getElementById("employeeStatusBadge");
const personalDetails = document.getElementById("personalDetails");
const loginDetails = document.getElementById("loginDetails");
const jobDetails = document.getElementById("jobDetails");
const financialDetails = document.getElementById("financialDetails");
const leaveBalanceDetails = document.getElementById("leaveBalanceDetails");
const permissionsDetails = document.getElementById("permissionsDetails");
const attendanceBody = document.getElementById("attendanceBody");
const salariesBody = document.getElementById("salariesBody");
const leavesBody = document.getElementById("leavesBody");
const auditBody = document.getElementById("auditBody");
const editEmployeeBtn = document.getElementById("editEmployeeBtn");
const managePermissionsBtn = document.getElementById("managePermissionsBtn");
const summaryStatus = document.getElementById("summaryStatus");
const summaryMainDepartment = document.getElementById("summaryMainDepartment");
const summaryLeaveRemaining = document.getElementById("summaryLeaveRemaining");
const summarySalary = document.getElementById("summarySalary");

let loadedEmployee = null;
let currentUser = null;
let loadedLeaveBalance = null;

const roleLabels = { employee: "موظف", manager: "مدير قسم", hr: "الموارد البشرية", finance: "المالية", admin: "مدير النظام" };
const accountStatusLabels = { active: "نشط", disabled: "معطل", locked: "مقفل" };

const initEmployeeProfile = async () => {
  currentUser = await loadLoggedUser();
  if (!currentUser || (!hasAnyPermission(["employees.view"]) && !hasAnyPermission(["employees.view.self"]))) {
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
const formatDays = (value) => Number(value || 0).toLocaleString("ar-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const employmentTypeLabel = (value) => ({ full_time: "دوام كامل", part_time: "دوام جزئي", contract: "عقد" }[value] || value || "-");
const statusText = (value, isActive) => ({ active: "نشط", inactive: "غير نشط", suspended: "موقوف", resigned: "مستقيل", terminated: "منتهي", archived: "مؤرشف" }[value] || (isActive ? "نشط" : "غير نشط"));
const leaveLabel = (value) => ({ annual: "سنوية", sick: "مرضية", unpaid: "بدون راتب", emergency: "طارئة", other: "أخرى" }[value] || value || "-");
const requestStatusLabel = (value) => ({ pending: "قيد الانتظار", approved: "مقبولة", rejected: "مرفوضة", draft: "مسودة", cancelled: "ملغاة", needs_info: "يحتاج معلومات", active: "نشط", absent: "غائب", late: "متأخر", present: "حاضر", paid: "مدفوع", unpaid: "غير مدفوع", published: "منشور" }[value] || value || "-");
const initials = (name = "") => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("") || "م";
const badge = (text, tone = "") => `<span class="mini-badge ${tone}">${text}</span>`;

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
    all: memberships.length ? memberships.map((item) => `${item.department_name}${item.is_primary ? " - رئيسي" : " - إضافي"}`).join("، ") : (primary?.department_name || employee.department_name || "-"),
  };
};

const detailItem = (label, value) => `
  <div class="detail-item">
    <span class="detail-label">${label}</span>
    <span class="detail-value">${value || "-"}</span>
  </div>
`;
const fillEmpty = (tbody, colspan, text) => { tbody.innerHTML = `<tr><td colspan="${colspan}">${text}</td></tr>`; };

const fetchJson = async (url) => {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "تعذر تحميل البيانات");
  return data;
};

const loadLeaveBalance = async () => {
  try {
    const data = await fetchJson(`${API_BASE_URL}/salaries/leave-balances/${employeeId}`);
    loadedLeaveBalance = data.balance;
  } catch (error) {
    loadedLeaveBalance = null;
  }
};

const renderLeaveBalance = () => {
  if (!leaveBalanceDetails) return;
  if (!loadedLeaveBalance) {
    leaveBalanceDetails.innerHTML = [
      detailItem("الرصيد الحالي", "غير محدد"),
      detailItem("الأيام المستهلكة", "غير محدد"),
      detailItem("المتبقي", "غير محدد"),
      detailItem("ملاحظة", "يتم ضبط الرصيد من قسم المالية"),
    ].join("");
    if (summaryLeaveRemaining) summaryLeaveRemaining.textContent = "-";
    return;
  }
  const remaining = Number(loadedLeaveBalance.remaining_days || 0);
  if (summaryLeaveRemaining) summaryLeaveRemaining.textContent = `${formatDays(remaining)} يوم`;
  leaveBalanceDetails.innerHTML = [
    detailItem("رصيد الإجازات الحالي", `${formatDays(loadedLeaveBalance.current_balance)} يوم`),
    detailItem("الأيام المستهلكة", `${formatDays(loadedLeaveBalance.consumed_days)} يوم`),
    detailItem("المتبقي", `${formatDays(remaining)} يوم`),
    detailItem("آخر تحديث", formatDate(loadedLeaveBalance.updated_at)),
  ].join("");
};

const loadEmployee = async () => {
  employeeName.textContent = "جاري التحميل...";
  const response = await fetch(`${API_BASE_URL}/employees/${employeeId}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) {
    employeeName.textContent = data.error || "تعذر تحميل بيانات الموظف";
    employeeMeta.textContent = "تأكد من وجود الموظف ومن صلاحيتك للوصول";
    return;
  }

  await loadLeaveBalance();

  loadedEmployee = data.employee;
  const employee = loadedEmployee;
  const departmentInfo = getMainAndSubDepartments(employee);
  const status = statusText(employee.status, employee.is_active);
  const loginEnabled = employee.is_login_enabled !== false && employee.account_status !== "disabled" && employee.account_status !== "locked";
  const roles = employee.roles || employee.account?.roles || ["employee"];
  const permissions = employee.permissions || employee.account?.permissions || [];

  employeeAvatar.textContent = initials(employee.full_name);
  employeeName.textContent = employee.full_name || "موظف بدون اسم";
  employeeMeta.textContent = `${employee.job_title || employee.job_title_name || "بدون مسمى"} • ${departmentInfo.main}${departmentInfo.sub !== "-" ? " / " + departmentInfo.sub : ""}`;
  employeeStatusBadge.outerHTML = badge(status, employee.is_active ? "status-active" : "status-inactive");
  summaryStatus.textContent = status;
  summaryMainDepartment.textContent = departmentInfo.main;
  summarySalary.textContent = `${formatMoney(employee.basic_salary)} د.أ`;

  renderLeaveBalance();

  if (managePermissionsBtn && !hasAnyPermission(["employees.manage_permissions", "permissions.view", "permissions.manage"])) managePermissionsBtn.style.display = "none";
  if (editEmployeeBtn && !hasAnyPermission(["employees.update"])) editEmployeeBtn.style.display = "none";

  personalDetails.innerHTML = [
    detailItem("الاسم الكامل", employee.full_name),
    detailItem("رقم الموظف", employee.employee_number || employee.national_id || employee.id),
    detailItem("الرقم الوطني", employee.national_id),
    detailItem("الهاتف", employee.phone),
    detailItem("البريد الإلكتروني", employee.email),
    detailItem("العنوان", employee.address),
    detailItem("تاريخ الميلاد", formatDate(employee.date_of_birth)),
    detailItem("تاريخ الإنشاء", formatDate(employee.created_at)),
  ].join("");

  loginDetails.innerHTML = [
    detailItem("حالة الدخول", loginEnabled ? badge("الدخول مفعّل", "status-active") : badge("الدخول معطّل", "status-inactive")),
    detailItem("حالة الحساب", accountStatusLabels[employee.account_status] || employee.account_status || "نشط"),
    detailItem("آخر تسجيل دخول", formatDate(employee.last_login_at)),
    detailItem("آخر تعديل", formatDate(employee.updated_at)),
  ].join("");

  jobDetails.innerHTML = [
    detailItem("المسمى الوظيفي", employee.job_title || employee.job_title_name),
    detailItem("القسم الأساسي", departmentInfo.main),
    detailItem("القسم الإضافي", departmentInfo.sub),
    detailItem("كل الأقسام", departmentInfo.all),
    detailItem("تاريخ التعيين", formatDate(employee.hire_date)),
    detailItem("نوع التوظيف", employmentTypeLabel(employee.employment_type)),
    detailItem("الحالة الوظيفية", status),
    detailItem("المدير المباشر", employee.direct_manager_name || "-"),
  ].join("");

  financialDetails.innerHTML = [
    detailItem("الراتب الأساسي", `${formatMoney(employee.basic_salary)} د.أ`),
    detailItem("خصم الضمان", employee.social_security_enabled ? "مفعل" : "غير مفعل"),
    detailItem("نسبة الضمان", `${employee.social_security_rate || 0}%`),
    detailItem("ملاحظة", "يتم تعديل الراتب والضمان من قسم المالية فقط"),
  ].join("");

  permissionsDetails.innerHTML = `
    <div class="role-pills">${roles.map((role) => badge(roleLabels[role] || role)).join("") || badge("لا توجد أدوار")}</div>
    <div style="height:10px"></div>
    <div class="department-pills">${permissions.length ? permissions.slice(0, 12).map((permission) => badge(permission)).join("") : badge("لا توجد صلاحيات مباشرة")}${permissions.length > 12 ? badge(`+${permissions.length - 12}`) : ""}</div>
  `;

  renderAttendance(data.attendance || []);
  renderLeaves(data.leaves || []);
  renderSalaries(data.salaries || []);
  renderAudit(data.audit_logs || []);
};

const renderAttendance = (rows) => {
  attendanceBody.innerHTML = "";
  if (!rows.length) return fillEmpty(attendanceBody, 5, "لا توجد سجلات حضور لهذا الموظف");
  rows.slice(0, 8).forEach((row) => {
    attendanceBody.innerHTML += `<tr><td>${formatDate(row.attendance_date || row.date)}</td><td>${row.check_in || "-"}</td><td>${row.check_out || "-"}</td><td>${requestStatusLabel(row.status)}</td><td>${row.source || row.record_source || "النظام"}</td></tr>`;
  });
};

const renderLeaves = (rows) => {
  leavesBody.innerHTML = "";
  if (!rows.length) return fillEmpty(leavesBody, 5, "لا توجد طلبات لهذا الموظف");
  rows.slice(0, 8).forEach((row) => {
    leavesBody.innerHTML += `<tr><td>${leaveLabel(row.leave_type || row.request_type)}</td><td>${formatDate(row.start_date)}</td><td>${formatDate(row.end_date)}</td><td>${calculateDays(row.start_date, row.end_date)}</td><td>${requestStatusLabel(row.status)}</td></tr>`;
  });
};

const renderSalaries = (rows) => {
  salariesBody.innerHTML = "";
  if (!rows.length) return fillEmpty(salariesBody, 5, "لا توجد سجلات رواتب لهذا الموظف");
  rows.slice(0, 8).forEach((row) => {
    salariesBody.innerHTML += `<tr><td>${row.salary_month || row.month || "-"}</td><td>${formatMoney(row.gross_salary || row.total_salary || 0)}</td><td>${formatMoney(row.total_deductions || row.deductions || 0)}</td><td>${formatMoney(row.net_salary || 0)}</td><td>${requestStatusLabel(row.status)}</td></tr>`;
  });
};

const renderAudit = (rows) => {
  auditBody.innerHTML = "";
  if (!rows.length) return fillEmpty(auditBody, 3, "لا توجد تعديلات مسجلة على هذا الموظف");
  rows.slice(0, 8).forEach((row) => {
    auditBody.innerHTML += `<tr><td>${row.action || row.change_type || "-"}</td><td>${formatDate(row.created_at)}</td><td>${row.actor_name || row.actor_user_id || "النظام"}</td></tr>`;
  });
};

editEmployeeBtn.addEventListener("click", () => {
  if (!loadedEmployee) return;
  window.location.href = `./employees.html?edit=${employeeId}`;
});

initEmployeeProfile();
