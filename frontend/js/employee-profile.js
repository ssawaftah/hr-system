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

const formatDate = (date) => date ? date.split("T")[0] : "-";
const employmentTypeLabel = (value) => ({ full_time: "دوام كامل", part_time: "دوام جزئي", contract: "عقد" }[value] || value || "-");
const statusLabel = (employee) => ({ active: "نشط", inactive: "غير نشط", suspended: "موقوف", resigned: "مستقيل", archived: "مؤرشف" }[employee.status] || (employee.is_active ? "نشط" : "غير نشط"));
const leaveLabel = (value) => ({ annual: "سنوية", sick: "مرضية", unpaid: "بدون راتب", other: "أخرى" }[value] || value || "-");
const requestStatusLabel = (value) => ({ pending: "قيد الانتظار", approved: "مقبولة", rejected: "مرفوضة", draft: "مسودة", cancelled: "ملغاة" }[value] || value || "-");

const loadEmployee = async () => {
  const response = await fetch(`${API_BASE_URL}/employees/${employeeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    employeeName.textContent = data.error || "تعذر تحميل بيانات الموظف";
    return;
  }

  const employee = data.employee;
  const primaryDepartment = employee.primary_department?.department_name || employee.department_name || "-";
  const allDepartments = (employee.departments || []).map((item) => item.department_name + (item.is_primary ? " - القسم الأساسي" : "")).join("، ") || primaryDepartment;

  employeeName.textContent = employee.full_name;
  employeeDetails.innerHTML = `
    <div><strong>رقم الموظف:</strong> ${employee.employee_number || employee.national_id || employee.id}</div>
    <div><strong>الاسم الكامل:</strong> ${employee.full_name}</div>
    <div><strong>الهاتف:</strong> ${employee.phone || "-"}</div>
    <div><strong>البريد الإلكتروني:</strong> ${employee.email || "-"}</div>
    <div><strong>العنوان:</strong> ${employee.address || "-"}</div>
    <div><strong>المسمى الوظيفي:</strong> ${employee.job_title || "-"}</div>
    <div><strong>القسم الأساسي:</strong> ${primaryDepartment}</div>
    <div><strong>الأقسام:</strong> ${allDepartments}</div>
    <div><strong>تاريخ التعيين:</strong> ${formatDate(employee.hire_date)}</div>
    <div><strong>نوع التوظيف:</strong> ${employmentTypeLabel(employee.employment_type)}</div>
    <div><strong>الحالة:</strong> ${statusLabel(employee)}</div>
    <div><strong>الراتب الأساسي:</strong> ${employee.basic_salary || 0}</div>
    <div><strong>خصم الضمان:</strong> ${employee.social_security_enabled ? "مفعل" : "غير مفعل"}</div>
    <div><strong>نسبة الضمان:</strong> ${employee.social_security_rate || 0}%</div>
    <div><strong>تاريخ الإنشاء:</strong> ${formatDate(employee.created_at)}</div>
    <div><strong>آخر تعديل:</strong> ${formatDate(employee.updated_at)}</div>
  `;

  attendanceBody.innerHTML = "";
  (data.attendance || []).forEach((row) => {
    attendanceBody.innerHTML += `<tr><td>${formatDate(row.attendance_date)}</td><td>${row.check_in || "-"}</td><td>${row.check_out || "-"}</td><td>${requestStatusLabel(row.status)}</td></tr>`;
  });

  salariesBody.innerHTML = "";
  (data.salaries || []).forEach((row) => {
    salariesBody.innerHTML += `<tr><td>${row.salary_month}</td><td>${row.net_salary}</td><td>${requestStatusLabel(row.status)}</td></tr>`;
  });

  leavesBody.innerHTML = "";
  (data.leaves || []).forEach((row) => {
    leavesBody.innerHTML += `<tr><td>${leaveLabel(row.leave_type)}</td><td>${formatDate(row.start_date)}</td><td>${formatDate(row.end_date)}</td><td>${requestStatusLabel(row.status)}</td></tr>`;
  });
};

initEmployeeProfile();
