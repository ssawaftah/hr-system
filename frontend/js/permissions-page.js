(() => {
  const state = {
    employees: [],
    jobTitles: [],
    permissions: [],
    groups: {},
    selectedEmployeeId: null,
    selectedJobTitleId: null,
  };

  const fallbackPermissions = [
    { key: "dashboard.view", label: "عرض الرئيسية", module: "الرئيسية" },
    { key: "system.admin", label: "إدارة النظام بالكامل", module: "النظام" },
    { key: "permissions.view", label: "عرض الصلاحيات", module: "الصلاحيات" },
    { key: "permissions.manage", label: "إدارة الصلاحيات", module: "الصلاحيات" },
    { key: "job_titles.view", label: "عرض المسميات الوظيفية", module: "المسميات الوظيفية" },
    { key: "job_titles.create", label: "إنشاء مسمى وظيفي", module: "المسميات الوظيفية" },
    { key: "job_titles.update", label: "تعديل مسمى وظيفي", module: "المسميات الوظيفية" },
    { key: "job_titles.disable", label: "تعطيل مسمى وظيفي", module: "المسميات الوظيفية" },
    { key: "job_titles.delete", label: "حذف مسمى وظيفي", module: "المسميات الوظيفية" },
    { key: "job_titles.manage_permissions", label: "تحديد صلاحيات المسمى الوظيفي", module: "المسميات الوظيفية" },
    { key: "employee_permissions.view", label: "عرض صلاحيات الموظفين", module: "صلاحيات الموظفين" },
    { key: "employee_permissions.manage", label: "إدارة صلاحيات الموظفين", module: "صلاحيات الموظفين" },
    { key: "employees.view", label: "عرض الموظفين", module: "الموظفون" },
    { key: "employees.create", label: "إنشاء موظف", module: "الموظفون" },
    { key: "employees.update", label: "تعديل موظف", module: "الموظفون" },
    { key: "departments.view", label: "عرض الأقسام", module: "الأقسام" },
    { key: "requests.view.self", label: "عرض طلباتي", module: "الطلبات" },
    { key: "requests.view.department", label: "عرض طلبات القسم", module: "الطلبات" },
    { key: "requests.view.all", label: "عرض كل الطلبات", module: "الطلبات" },
    { key: "requests.create.self", label: "إنشاء طلب شخصي", module: "الطلبات" },
    { key: "requests.approve.department", label: "اعتماد طلبات القسم", module: "الطلبات" },
    { key: "requests.approve.all", label: "اعتماد كل الطلبات", module: "الطلبات" },
    { key: "attendance.view.self", label: "عرض حضوري", module: "الحضور والانصراف" },
    { key: "attendance.view.department", label: "عرض حضور القسم", module: "الحضور والانصراف" },
    { key: "attendance.view.all", label: "عرض حضور الجميع", module: "الحضور والانصراف" },
    { key: "finance.view", label: "عرض المالية", module: "المالية" },
    { key: "salaries.view", label: "عرض الرواتب", module: "الرواتب" },
    { key: "reports.view.all", label: "عرض كل التقارير", module: "التقارير" },
  ];

  const roleLabels = { admin: "مدير النظام", hr: "الموارد البشرية", employee: "موظف", manager: "مدير قسم", finance: "المالية" };
  const $ = (id) => document.getElementById(id);
  const list = (value) => Array.isArray(value) ? value : (value ? String(value).split(",").map((x) => x.trim()).filter(Boolean) : []);
  const unique = (items) => Array.from(new Set((items || []).flatMap(list)));
  const labelFor = (key) => state.permissions.find((p) => p.key === key)?.label || key;
  const groupByModule = (items) => items.reduce((acc, p) => { const m = p.module || "أخرى"; (acc[m] ||= []).push(p); return acc; }, {});

  function showMessage(el, text, isError = false) {
    if (!el) return;
    el.textContent = text || "";
    el.className = `inline-message ${isError ? "error-message" : "success-message"}`;
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "فشل تنفيذ العملية");
    return data;
  }

  function bindTabs() {
    document.querySelectorAll(".permissions-tab").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".permissions-tab").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".permissions-panel").forEach((p) => p.classList.remove("active"));
        button.classList.add("active");
        $(button.dataset.tab)?.classList.add("active");
      });
    });
  }

  async function loadPermissions() {
    try {
      const data = await request("/permissions/permissions");
      state.permissions = data.permissions?.length ? data.permissions : fallbackPermissions;
      state.groups = data.groups || groupByModule(state.permissions);
    } catch (error) {
      state.permissions = fallbackPermissions;
      state.groups = groupByModule(state.permissions);
    }
  }

  async function loadEmployees() {
    const box = $("employeesPermissionList");
    box.innerHTML = '<div class="empty-soft">جاري تحميل الموظفين...</div>';
    try {
      const data = await request("/employees");
      state.employees = data.employees || [];
      renderEmployees();
    } catch (error) {
      box.innerHTML = `<div class="empty-soft">${error.message}</div>`;
    }
  }

  async function loadJobTitles() {
    const box = $("jobTitlesList");
    box.innerHTML = '<div class="empty-soft">جاري تحميل المسميات...</div>';
    try {
      const data = await request("/permissions/job-titles");
      state.jobTitles = data.job_titles || [];
      if (data.permissions?.length) {
        state.permissions = data.permissions;
        state.groups = data.groups || groupByModule(state.permissions);
      }
      renderJobTitles();
      renderJobTitlePermissionGroups();
      fillPermissionSelects();
    } catch (error) {
      box.innerHTML = `<div class="empty-soft">${error.message}</div>`;
      renderJobTitlePermissionGroups();
      fillPermissionSelects();
    }
  }

  async function loadLogs() {
    const box = $("permissionLogsList");
    try {
      const data = await request("/permissions/logs");
      const logs = data.logs || [];
      box.innerHTML = logs.length ? logs.map((log) => `<article class="permission-log-item"><strong>${log.change_type || "تعديل صلاحيات"}</strong><small>${log.actor_name || "-"} · ${String(log.created_at || "").replace("T", " ").slice(0, 16)}</small></article>`).join("") : '<div class="empty-soft">لا توجد تعديلات مسجلة</div>';
    } catch (error) {
      box.innerHTML = `<div class="empty-soft">${error.message}</div>`;
    }
  }

  function renderEmployees() {
    const box = $("employeesPermissionList");
    const search = ($("employeeSearch")?.value || "").trim().toLowerCase();
    const employees = state.employees.filter((e) => [e.full_name, e.employee_number, e.job_title, e.department_name].filter(Boolean).join(" ").toLowerCase().includes(search));
    box.innerHTML = employees.length ? employees.map((employee) => `<button type="button" class="side-list-item ${String(employee.id) === String(state.selectedEmployeeId) ? "active" : ""}" data-id="${employee.id}"><strong>${employee.full_name || "موظف"}</strong><small>${employee.employee_number || "-"} · ${employee.job_title || "بدون مسمى"}</small></button>`).join("") : '<div class="empty-soft">لا يوجد موظفون مطابقون</div>';
  }

  function renderJobTitles() {
    const box = $("jobTitlesList");
    box.innerHTML = state.jobTitles.length ? state.jobTitles.map((job) => `<button type="button" class="side-list-item ${String(job.id) === String(state.selectedJobTitleId) ? "active" : ""}" data-id="${job.id}"><strong>${job.name}</strong><small>${job.status === "active" ? "نشط" : job.status === "inactive" ? "غير نشط" : "مؤرشف"} · ${job.employees_count || 0} موظف</small></button>`).join("") : '<div class="empty-soft">لا توجد مسميات وظيفية</div>';
  }

  function renderJobTitlePermissionGroups(selected = []) {
    const selectedSet = new Set(list(selected));
    const box = $("jobTitlePermissionsBox");
    if (!box) return;
    box.innerHTML = Object.entries(state.groups).map(([module, permissions]) => `<section class="permission-group"><h4>${module}</h4><div class="permission-checks">${permissions.map((permission) => `<label class="permission-check"><input type="checkbox" name="jobTitlePermission" value="${permission.key}" ${selectedSet.has(permission.key) ? "checked" : ""}><span>${permission.label}<small>${permission.key}</small></span></label>`).join("")}</div></section>`).join("");
  }

  function fillPermissionSelects() {
    const options = state.permissions.map((p) => `<option value="${p.key}">${p.label}</option>`).join("");
    const roles = Object.entries(roleLabels).map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
    if ($("employeeRolesSelect")) $("employeeRolesSelect").innerHTML = roles;
    if ($("employeeDirectPermissionsSelect")) $("employeeDirectPermissionsSelect").innerHTML = options;
    if ($("employeeDeniedPermissionsSelect")) $("employeeDeniedPermissionsSelect").innerHTML = options;
  }

  function setSelectedOptions(id, values) {
    const selected = new Set(list(values));
    document.querySelectorAll(`#${id} option`).forEach((option) => { option.selected = selected.has(option.value); });
  }

  function permissionChips(title, permissions, cls) {
    const items = unique(permissions);
    return `<section class="permission-source-card"><h3>${title}</h3><div class="permission-chip-list">${items.length ? items.map((p) => `<span class="permission-chip ${cls}" title="${p}">${labelFor(p)}</span>`).join("") : '<span class="permission-chip">لا توجد</span>'}</div></section>`;
  }

  async function selectEmployee(id) {
    state.selectedEmployeeId = id;
    renderEmployees();
    $("selectedEmployeeTitle").textContent = "جاري تحميل الصلاحيات...";
    $("employeePermissionSummary").innerHTML = '<div class="empty-soft">جاري تحميل الصلاحيات...</div>';
    $("employeePermissionForm").style.display = "none";
    try {
      const data = await request(`/permissions/employees/${id}`);
      const s = data.summary;
      const employee = state.employees.find((e) => String(e.id) === String(id));
      $("selectedEmployeeTitle").textContent = employee ? `${employee.full_name} - ${employee.employee_number || ""}` : "صلاحيات الموظف";
      $("selectedEmployeeHelp").textContent = `المسمى الوظيفي الحالي: ${s.job_title?.name || employee?.job_title || "غير محدد"}`;
      $("employeePermissionSummary").innerHTML = permissionChips("صلاحيات المسمى الوظيفي", s.job_title_permissions, "inherited") + permissionChips("صلاحيات الأدوار", s.role_permissions, "inherited") + permissionChips("صلاحيات إضافية", s.direct_permissions, "extra") + permissionChips("صلاحيات مستثناة", s.denied_permissions, "denied") + permissionChips("الصلاحيات الفعلية", s.effective_permissions, "effective");
      $("employeePermissionForm").style.display = "grid";
      setSelectedOptions("employeeRolesSelect", s.roles);
      setSelectedOptions("employeeDirectPermissionsSelect", s.direct_permissions);
      setSelectedOptions("employeeDeniedPermissionsSelect", s.denied_permissions);
    } catch (error) {
      $("employeePermissionSummary").innerHTML = `<div class="empty-soft">${error.message}</div>`;
    }
  }

  function selectJobTitle(id) {
    const job = state.jobTitles.find((j) => String(j.id) === String(id));
    if (!job) return;
    state.selectedJobTitleId = job.id;
    renderJobTitles();
    $("jobTitleFormTitle").textContent = "تعديل مسمى وظيفي";
    $("jobTitleId").value = job.id;
    $("jobTitleName").value = job.name || "";
    $("jobTitleCode").value = job.code || "";
    $("jobTitleStatus").value = job.status || "active";
    $("jobTitleDescription").value = job.description || "";
    renderJobTitlePermissionGroups(job.default_permissions || []);
  }

  function resetJobTitleForm() {
    state.selectedJobTitleId = null;
    $("jobTitleFormTitle").textContent = "إنشاء مسمى وظيفي";
    $("jobTitleForm").reset();
    $("jobTitleId").value = "";
    $("jobTitleStatus").value = "active";
    renderJobTitlePermissionGroups([]);
    renderJobTitles();
  }

  function valuesOfSelect(id) {
    return Array.from($(id).selectedOptions).map((option) => option.value);
  }

  function bindActions() {
    $("employeesPermissionList")?.addEventListener("click", (event) => {
      const button = event.target.closest(".side-list-item");
      if (button) selectEmployee(button.dataset.id);
    });
    $("jobTitlesList")?.addEventListener("click", (event) => {
      const button = event.target.closest(".side-list-item");
      if (button) selectJobTitle(button.dataset.id);
    });
    $("employeeSearch")?.addEventListener("input", renderEmployees);
    $("newJobTitleBtn")?.addEventListener("click", resetJobTitleForm);
    $("resetJobTitleBtn")?.addEventListener("click", resetJobTitleForm);
    $("refreshLogsBtn")?.addEventListener("click", loadLogs);
    $("clearEmployeeSelectionBtn")?.addEventListener("click", () => {
      state.selectedEmployeeId = null;
      $("employeePermissionForm").style.display = "none";
      $("selectedEmployeeTitle").textContent = "اختر موظفًا";
      $("employeePermissionSummary").innerHTML = "";
      renderEmployees();
    });

    $("employeePermissionForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!state.selectedEmployeeId) return showMessage($("employeePermissionMessage"), "اختر موظفًا أولاً", true);
      try {
        const body = { roles: valuesOfSelect("employeeRolesSelect"), direct_permissions: valuesOfSelect("employeeDirectPermissionsSelect"), denied_permissions: valuesOfSelect("employeeDeniedPermissionsSelect") };
        const data = await request(`/permissions/employees/${state.selectedEmployeeId}`, { method: "PUT", body: JSON.stringify(body) });
        showMessage($("employeePermissionMessage"), data.message || "تم حفظ صلاحيات الموظف");
        await selectEmployee(state.selectedEmployeeId);
        await loadLogs();
      } catch (error) {
        showMessage($("employeePermissionMessage"), error.message, true);
      }
    });

    $("jobTitleForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const id = $("jobTitleId").value;
        const body = { name: $("jobTitleName").value.trim(), code: $("jobTitleCode").value.trim(), status: $("jobTitleStatus").value, description: $("jobTitleDescription").value.trim(), default_permissions: Array.from(document.querySelectorAll('[name="jobTitlePermission"]:checked')).map((c) => c.value) };
        const data = await request(id ? `/permissions/job-titles/${id}` : "/permissions/job-titles", { method: id ? "PUT" : "POST", body: JSON.stringify(body) });
        showMessage($("jobTitleMessage"), data.message || "تم حفظ المسمى الوظيفي");
        await loadJobTitles();
        if (data.job_title?.id) selectJobTitle(data.job_title.id);
        await loadLogs();
      } catch (error) {
        showMessage($("jobTitleMessage"), error.message, true);
      }
    });

    $("disableJobTitleBtn")?.addEventListener("click", async () => {
      const id = $("jobTitleId").value;
      if (!id) return showMessage($("jobTitleMessage"), "اختر مسمى وظيفيًا أولاً", true);
      if (!confirm("هل تريد تعطيل هذا المسمى الوظيفي؟")) return;
      try {
        const data = await request(`/permissions/job-titles/${id}/disable`, { method: "PATCH" });
        showMessage($("jobTitleMessage"), data.message || "تم تعطيل المسمى");
        await loadJobTitles();
        await loadLogs();
      } catch (error) {
        showMessage($("jobTitleMessage"), error.message, true);
      }
    });

    $("deleteJobTitleBtn")?.addEventListener("click", async () => {
      const id = $("jobTitleId").value;
      if (!id) return showMessage($("jobTitleMessage"), "اختر مسمى وظيفيًا أولاً", true);
      if (!confirm("هل تريد حذف أو أرشفة هذا المسمى؟")) return;
      try {
        const data = await request(`/permissions/job-titles/${id}`, { method: "DELETE" });
        showMessage($("jobTitleMessage"), data.message || "تم التنفيذ");
        resetJobTitleForm();
        await loadJobTitles();
        await loadLogs();
      } catch (error) {
        showMessage($("jobTitleMessage"), error.message, true);
      }
    });
  }

  async function init() {
    bindTabs();
    bindActions();
    const user = await loadLoggedUser();
    if (!user) return;
    await loadPermissions();
    fillPermissionSelects();
    renderJobTitlePermissionGroups();
    await Promise.allSettled([loadEmployees(), loadJobTitles(), loadLogs()]);
  }

  init().catch((error) => {
    console.error(error);
    const box = $("employeesPermissionList");
    if (box) box.innerHTML = `<div class="empty-soft">${error.message || "حدث خطأ أثناء تحميل الصفحة"}</div>`;
  });
})();
