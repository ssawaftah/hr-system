const pool = require("../db");
const { syncEmployeeAccount, validateEmployeeAccountPayload } = require("../services/employee-account.service");
const { ensurePermissionSchema, getEmployeePermissionSummary } = require("../services/permission.service");

const normalizeBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return Boolean(value);
};

const getActorId = (req) => req.user?.id || null;

const ensureEmployeeSchema = async (client = pool) => {
  await ensurePermissionSchema();
  await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_number VARCHAR(50)`);
  await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS direct_manager_id INTEGER`);
  await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title_id INTEGER`);
  await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title_name VARCHAR(160)`);
  await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(12,2) DEFAULT 0`);
  await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS social_security_enabled BOOLEAN DEFAULT true`);
  await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS social_security_rate NUMERIC(5,2) DEFAULT 7.5`);
  await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active'`);
  await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
  await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

  await client.query(`UPDATE employees SET employee_number = COALESCE(employee_number, NULLIF(national_id, ''), id::text) WHERE employee_number IS NULL OR employee_number = ''`);
  await client.query(`UPDATE employees SET job_title_name = COALESCE(job_title_name, job_title) WHERE job_title_name IS NULL AND job_title IS NOT NULL`);
  await client.query(`UPDATE employees e SET job_title_id = jt.id, job_title_name = jt.name FROM job_titles jt WHERE e.job_title_id IS NULL AND TRIM(COALESCE(e.job_title,'')) = jt.name`);

  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_number_unique_idx ON employees(employee_number) WHERE employee_number IS NOT NULL`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS employee_departments (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
      is_primary BOOLEAN DEFAULT false,
      role_in_department VARCHAR(100),
      start_date DATE,
      end_date DATE,
      status VARCHAR(30) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, department_id)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      actor_user_id INTEGER,
      target_type VARCHAR(80),
      target_id INTEGER,
      action VARCHAR(120) NOT NULL,
      old_value JSONB,
      new_value JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const writeAuditLog = async (client, req, action, targetId, oldValue = null, newValue = null) => {
  await client.query(`INSERT INTO audit_logs (actor_user_id, target_type, target_id, action, old_value, new_value) VALUES ($1, 'employee', $2, $3, $4, $5)`, [getActorId(req), targetId, action, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null]);
};

const validateEmail = (email) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const normalizeDepartments = (body) => {
  const departments = Array.isArray(body.departments) ? body.departments : [];
  const cleaned = departments.map((item) => ({ department_id: Number(item.department_id), is_primary: normalizeBoolean(item.is_primary), role_in_department: item.role_in_department || null, start_date: item.start_date || null, end_date: item.end_date || null, status: item.status || "active" })).filter((item) => Number.isInteger(item.department_id) && item.department_id > 0);
  if (cleaned.length === 0 && body.department_id) cleaned.push({ department_id: Number(body.department_id), is_primary: true, role_in_department: null, start_date: null, end_date: null, status: "active" });
  return cleaned;
};

const getJobTitleSnapshot = async (client, jobTitleId, fallbackName = null) => {
  if (!jobTitleId) return { id: null, name: fallbackName || null };
  const result = await client.query(`SELECT id, name, status FROM job_titles WHERE id=$1`, [Number(jobTitleId)]);
  if (!result.rows.length) throw new Error("المسمى الوظيفي غير موجود");
  if (result.rows[0].status !== "active") throw new Error("لا يمكن اختيار مسمى وظيفي غير نشط");
  return { id: result.rows[0].id, name: result.rows[0].name };
};

const validateEmployeePayload = async (client, body, currentId = null) => {
  const fullName = (body.full_name || "").trim();
  const employeeNumber = (body.employee_number || body.national_id || "").trim();
  const email = (body.email || "").trim();
  const basicSalary = Number(body.basic_salary || 0);
  const socialSecurityRate = Number(body.social_security_rate ?? 7.5);
  const departments = normalizeDepartments(body);
  if (!fullName) return "اسم الموظف مطلوب";
  if (!employeeNumber) return "رقم الموظف مطلوب";
  if (!validateEmail(email)) return "صيغة البريد الإلكتروني غير صحيحة";
  if (Number.isNaN(basicSalary) || basicSalary < 0) return "الراتب الأساسي لا يمكن أن يكون سالباً";
  if (Number.isNaN(socialSecurityRate) || socialSecurityRate < 0) return "نسبة الضمان لا يمكن أن تكون سالبة";
  const duplicate = await client.query(`SELECT id FROM employees WHERE employee_number = $1 AND ($2::INTEGER IS NULL OR id <> $2::INTEGER) LIMIT 1`, [employeeNumber, currentId]);
  if (duplicate.rows.length > 0) return "رقم الموظف مستخدم لموظف آخر";
  const departmentIds = departments.map((item) => item.department_id);
  if (new Set(departmentIds).size !== departmentIds.length) return "لا يمكن تكرار نفس القسم للموظف";
  if (departments.length > 0 && departments.filter((item) => item.is_primary).length !== 1) return "يجب تحديد قسم أساسي واحد فقط";
  if (departments.length > 0) {
    const activeDepartments = await client.query(`SELECT id FROM departments WHERE id = ANY($1::int[]) AND COALESCE(is_active, true) = true`, [departmentIds]);
    if (activeDepartments.rows.length !== departmentIds.length) return "يوجد قسم غير نشط أو غير موجود";
  }
  return null;
};

const applyDepartmentMemberships = async (client, employeeId, departments, req) => {
  const oldResult = await client.query(`SELECT department_id, is_primary, role_in_department, status FROM employee_departments WHERE employee_id = $1 ORDER BY id ASC`, [employeeId]);
  await client.query(`DELETE FROM employee_departments WHERE employee_id = $1`, [employeeId]);
  for (const item of departments) {
    await client.query(`INSERT INTO employee_departments (employee_id, department_id, is_primary, role_in_department, start_date, end_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [employeeId, item.department_id, item.is_primary, item.role_in_department, item.start_date, item.end_date, item.status]);
  }
  const primary = departments.find((item) => item.is_primary);
  await client.query(`UPDATE employees SET department_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [primary?.department_id || null, employeeId]);
  await writeAuditLog(client, req, "تم تعديل أقسام الموظف", employeeId, oldResult.rows, departments);
};

const enrichEmployees = async (rows) => {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const departmentResult = await pool.query(`SELECT ed.employee_id, ed.department_id, ed.is_primary, ed.role_in_department, ed.status, d.name AS department_name FROM employee_departments ed JOIN departments d ON d.id = ed.department_id WHERE ed.employee_id = ANY($1::int[]) ORDER BY ed.is_primary DESC, d.name ASC`, [ids]);
  const accountResult = await pool.query(`SELECT id AS account_id, employee_id, roles, permissions, direct_denied_permissions, is_active AS login_active, account_status, last_login_at FROM users WHERE employee_id = ANY($1::int[])`, [ids]);
  const grouped = departmentResult.rows.reduce((map, item) => { if (!map[item.employee_id]) map[item.employee_id] = []; map[item.employee_id].push(item); return map; }, {});
  const accounts = accountResult.rows.reduce((map, item) => { map[item.employee_id] = item; return map; }, {});
  return rows.map((row) => {
    const memberships = grouped[row.id] || [];
    const primary = memberships.find((item) => item.is_primary);
    return { ...row, account: accounts[row.id] || null, is_login_enabled: accounts[row.id]?.login_active ?? false, account_status: accounts[row.id]?.account_status || null, roles: accounts[row.id]?.roles || [], permissions: accounts[row.id]?.permissions || [], denied_permissions: accounts[row.id]?.direct_denied_permissions || [], job_title: row.job_title_name || row.managed_job_title_name || row.job_title, departments: memberships, primary_department: primary || null, department_name: primary?.department_name || row.department_name || null, additional_departments: memberships.filter((item) => !item.is_primary) };
  });
};

const employeeSelectSql = `
  SELECT e.id, e.employee_number, e.full_name, e.national_id, e.phone, e.email, e.address, e.job_title, e.job_title_id, e.job_title_name,
         jt.name AS managed_job_title_name, e.direct_manager_id, e.department_id, d.name AS department_name, e.hire_date, e.employment_type,
         e.basic_salary, e.social_security_enabled, e.social_security_rate, e.status, e.archived_at, e.is_active, e.created_at, e.updated_at
  FROM employees e
  LEFT JOIN departments d ON e.department_id = d.id
  LEFT JOIN job_titles jt ON jt.id = e.job_title_id
`;

const getEmployees = async (req, res) => {
  try {
    await ensureEmployeeSchema();
    const result = await pool.query(`${employeeSelectSql} ORDER BY e.id ASC`);
    res.status(200).json({ employees: await enrichEmployees(result.rows) });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getEmployeeById = async (req, res) => {
  try {
    await ensureEmployeeSchema();
    const { id } = req.params;
    const employeeResult = await pool.query(`${employeeSelectSql} WHERE e.id = $1`, [id]);
    if (employeeResult.rows.length === 0) return res.status(404).json({ error: "الموظف غير موجود" });
    const [employee] = await enrichEmployees(employeeResult.rows);
    const attendanceResult = await pool.query(`SELECT * FROM attendance_records WHERE employee_id = $1 ORDER BY attendance_date DESC, id DESC LIMIT 20`, [id]);
    const salariesResult = await pool.query(`SELECT * FROM salary_records WHERE employee_id = $1 ORDER BY id DESC LIMIT 20`, [id]);
    const leavesResult = await pool.query(`SELECT * FROM leave_requests WHERE employee_id = $1 ORDER BY id DESC LIMIT 20`, [id]);
    const auditResult = await pool.query(`SELECT * FROM audit_logs WHERE target_type = 'employee' AND target_id = $1 ORDER BY id DESC LIMIT 30`, [id]);
    const permissionSummary = await getEmployeePermissionSummary(Number(id));
    res.status(200).json({ employee, attendance: attendanceResult.rows, salaries: salariesResult.rows, leaves: leavesResult.rows, audit_logs: auditResult.rows, permission_summary: permissionSummary });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const createEmployee = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureEmployeeSchema(client);
    const validationError = await validateEmployeePayload(client, req.body);
    if (validationError) { await client.query("ROLLBACK"); return res.status(400).json({ error: validationError }); }
    const accountValidationError = validateEmployeeAccountPayload(req.body, true);
    if (accountValidationError) { await client.query("ROLLBACK"); return res.status(400).json({ error: accountValidationError }); }
    const { full_name, national_id, phone, email, address, direct_manager_id, hire_date, employment_type } = req.body;
    const jobTitle = await getJobTitleSnapshot(client, req.body.job_title_id, req.body.job_title || null);
    const employeeNumber = (req.body.employee_number || req.body.national_id || "").trim();
    const basicSalary = Number(req.body.basic_salary || 0);
    const socialSecurityRate = Number(req.body.social_security_rate ?? 7.5);
    const socialSecurityEnabled = req.body.social_security_enabled === undefined ? true : normalizeBoolean(req.body.social_security_enabled);
    const status = req.body.status || (req.body.is_active === false ? "inactive" : "active");
    const departments = normalizeDepartments(req.body);
    const result = await client.query(
      `INSERT INTO employees (employee_number, full_name, national_id, phone, email, address, job_title, job_title_id, job_title_name, direct_manager_id, department_id, hire_date, employment_type, basic_salary, social_security_enabled, social_security_rate, status, is_active, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,$11,$12,$13,$14,$15,$16,$17,CURRENT_TIMESTAMP) RETURNING *`,
      [employeeNumber, full_name.trim(), national_id || employeeNumber, phone || null, email || null, address || null, jobTitle.name, jobTitle.id, jobTitle.name, direct_manager_id || null, hire_date || null, employment_type || "full_time", basicSalary, socialSecurityEnabled, socialSecurityRate, status, status === "active"]
    );
    const employee = result.rows[0];
    await applyDepartmentMemberships(client, employee.id, departments, req);
    const account = await syncEmployeeAccount(client, employee, req.body);
    await writeAuditLog(client, req, "تم إنشاء الموظف", employee.id, null, { employee, account });
    await client.query("COMMIT");
    res.status(201).json({ message: "تم إنشاء الموظف وحساب الدخول بنجاح", employee, account });
  } catch (error) { await client.query("ROLLBACK"); res.status(500).json({ error: error.message }); } finally { client.release(); }
};

const updateEmployee = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureEmployeeSchema(client);
    const { id } = req.params;
    const existing = await client.query(`SELECT * FROM employees WHERE id = $1`, [id]);
    if (existing.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "الموظف غير موجود" }); }
    const validationError = await validateEmployeePayload(client, req.body, Number(id));
    if (validationError) { await client.query("ROLLBACK"); return res.status(400).json({ error: validationError }); }
    const accountValidationError = validateEmployeeAccountPayload(req.body, false);
    if (accountValidationError) { await client.query("ROLLBACK"); return res.status(400).json({ error: accountValidationError }); }
    const jobTitle = await getJobTitleSnapshot(client, req.body.job_title_id, req.body.job_title || existing.rows[0].job_title || null);
    const employeeNumber = (req.body.employee_number || req.body.national_id || "").trim();
    const status = req.body.status || (normalizeBoolean(req.body.is_active) ? "active" : "inactive");
    const basicSalary = Number(req.body.basic_salary || 0);
    const socialSecurityRate = Number(req.body.social_security_rate ?? 7.5);
    const socialSecurityEnabled = req.body.social_security_enabled === undefined ? true : normalizeBoolean(req.body.social_security_enabled);
    const departments = normalizeDepartments(req.body);
    const result = await client.query(
      `UPDATE employees SET employee_number=$1, full_name=$2, national_id=$3, phone=$4, email=$5, address=$6, job_title=$7, job_title_id=$8, job_title_name=$9, direct_manager_id=$10, hire_date=$11, employment_type=$12, basic_salary=$13, social_security_enabled=$14, social_security_rate=$15, status=$16, is_active=$17, updated_at=CURRENT_TIMESTAMP WHERE id=$18 RETURNING *`,
      [employeeNumber, req.body.full_name.trim(), req.body.national_id || employeeNumber, req.body.phone || null, req.body.email || null, req.body.address || null, jobTitle.name, jobTitle.id, jobTitle.name, req.body.direct_manager_id || null, req.body.hire_date || null, req.body.employment_type || "full_time", basicSalary, socialSecurityEnabled, socialSecurityRate, status, status === "active", id]
    );
    await applyDepartmentMemberships(client, id, departments, req);
    const account = await syncEmployeeAccount(client, result.rows[0], req.body);
    await writeAuditLog(client, req, "تم تعديل بيانات الموظف", Number(id), existing.rows[0], { employee: result.rows[0], account });
    await client.query("COMMIT");
    res.status(200).json({ message: "تم تعديل الموظف وحساب الدخول بنجاح", employee: result.rows[0], account });
  } catch (error) { await client.query("ROLLBACK"); res.status(500).json({ error: error.message }); } finally { client.release(); }
};

const countLinkedRecords = async (client, id) => {
  const attendance = await client.query(`SELECT COUNT(*)::int AS count FROM attendance_records WHERE employee_id = $1`, [id]);
  const salaries = await client.query(`SELECT COUNT(*)::int AS count FROM salary_records WHERE employee_id = $1`, [id]);
  const leaves = await client.query(`SELECT COUNT(*)::int AS count FROM leave_requests WHERE employee_id = $1`, [id]);
  return attendance.rows[0].count + salaries.rows[0].count + leaves.rows[0].count;
};

const deleteEmployee = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN"); await ensureEmployeeSchema(client); const { id } = req.params; const existing = await client.query(`SELECT * FROM employees WHERE id = $1`, [id]);
    if (existing.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "الموظف غير موجود" }); }
    const linkedCount = await countLinkedRecords(client, id);
    if (linkedCount > 0) { await client.query("ROLLBACK"); return res.status(409).json({ error: "لا يمكن حذف هذا الموظف نهائياً لأنه مرتبط ببيانات أخرى. يمكنك تعطيله أو أرشفته بدلاً من الحذف.", code: "EMPLOYEE_HAS_LINKED_RECORDS", can_disable: true, can_archive: true }); }
    await client.query(`DELETE FROM users WHERE employee_id = $1`, [id]); await client.query(`DELETE FROM employees WHERE id = $1`, [id]); await writeAuditLog(client, req, "تم حذف الموظف", Number(id), existing.rows[0], null); await client.query("COMMIT"); res.status(200).json({ message: "تم حذف الموظف وحساب الدخول المرتبط به بنجاح" });
  } catch (error) { await client.query("ROLLBACK"); res.status(500).json({ error: error.message }); } finally { client.release(); }
};

const disableEmployee = async (req, res) => {
  const client = await pool.connect();
  try { await client.query("BEGIN"); await ensureEmployeeSchema(client); const { id } = req.params; const existing = await client.query(`SELECT * FROM employees WHERE id = $1`, [id]); if (existing.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "الموظف غير موجود" }); } const result = await client.query(`UPDATE employees SET is_active = false, status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [id]); await client.query(`UPDATE users SET is_active = false, account_status = 'disabled', updated_at = CURRENT_TIMESTAMP WHERE employee_id = $1`, [id]); await writeAuditLog(client, req, "تم تعطيل الموظف", Number(id), existing.rows[0], result.rows[0]); await client.query("COMMIT"); res.status(200).json({ message: "تم تعطيل الموظف وحساب الدخول بنجاح", employee: result.rows[0] }); } catch (error) { await client.query("ROLLBACK"); res.status(500).json({ error: error.message }); } finally { client.release(); }
};

const archiveEmployee = async (req, res) => {
  const client = await pool.connect();
  try { await client.query("BEGIN"); await ensureEmployeeSchema(client); const { id } = req.params; const existing = await client.query(`SELECT * FROM employees WHERE id = $1`, [id]); if (existing.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "الموظف غير موجود" }); } const result = await client.query(`UPDATE employees SET is_active = false, status = 'archived', archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [id]); await client.query(`UPDATE users SET is_active = false, account_status = 'disabled', updated_at = CURRENT_TIMESTAMP WHERE employee_id = $1`, [id]); await writeAuditLog(client, req, "تم أرشفة الموظف", Number(id), existing.rows[0], result.rows[0]); await client.query("COMMIT"); res.status(200).json({ message: "تم أرشفة الموظف وتعطيل الدخول بنجاح", employee: result.rows[0] }); } catch (error) { await client.query("ROLLBACK"); res.status(500).json({ error: error.message }); } finally { client.release(); }
};

module.exports = { getEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee, disableEmployee, archiveEmployee };
