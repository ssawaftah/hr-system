const pool = require("../db");

const MODULES = {
  dashboard: "الرئيسية",
  system: "النظام",
  users: "النظام",
  permissions: "الصلاحيات",
  job_titles: "المسميات الوظيفية",
  employee_permissions: "صلاحيات الموظفين",
  employees: "الموظفون",
  departments: "الأقسام",
  attendance: "الحضور والانصراف",
  requests: "الطلبات",
  shifts: "الشفتات",
  finance: "المالية",
  salaries: "الرواتب",
  reports: "التقارير",
  notifications: "الإشعارات",
  announcements: "الإعلانات",
  settings: "الإعدادات",
};

const permissionKeys = [
  "dashboard.view", "system.admin", "system.health.view",
  "users.view", "users.create", "users.manage_permissions",
  "permissions.view", "permissions.manage", "permissions.assign_roles", "permissions.remove_roles", "permissions.assign_permissions", "permissions.remove_permissions", "permissions.view_logs",
  "job_titles.view", "job_titles.create", "job_titles.update", "job_titles.delete", "job_titles.disable", "job_titles.manage_permissions",
  "employee_permissions.view", "employee_permissions.manage", "employee_permissions.add_direct", "employee_permissions.deny", "employee_permissions.remove_direct", "employee_permissions.remove_denied",
  "employees.view", "employees.view.self", "employees.view.department", "employees.view.all", "employees.create", "employees.update", "employees.delete", "employees.disable", "employees.assign_departments", "employees.manage_login", "employees.reset_password", "employees.manage_roles", "employees.manage_permissions", "employees.view_financial_basic",
  "departments.view", "departments.manage", "departments.create", "departments.update", "departments.delete", "departments.disable",
  "attendance.view", "attendance.view.self", "attendance.view.department", "attendance.view.all", "attendance.create", "attendance.check.self", "attendance.manual_add", "attendance.manual_edit", "attendance.delete", "attendance.export", "attendance.manage",
  "requests.view.self", "requests.view.department", "requests.view.all", "requests.create.self", "requests.update.self_draft", "requests.cancel.self_pending", "requests.approve.department", "requests.approve.all", "requests.reject.department", "requests.reject.all", "requests.cancel.department", "requests.cancel.all", "requests.request_info", "requests.comment", "requests.view_logs", "requests.export", "requests.manage",
  "shifts.view", "shifts.create", "shifts.update", "shifts.archive", "shifts.delete", "shifts.assign", "shifts.assign_employees", "shifts.remove_employee", "shifts.move_employee", "shifts.view_week_distribution", "shifts.export", "shifts.manage",
  "finance.view", "finance.dashboard.view", "finance.settings.view", "finance.settings.manage", "finance.payroll_slips.view", "finance.payroll_slips.view_all", "finance.payroll_slips.create", "finance.payroll_slips.edit", "finance.payroll_slips.recalculate", "finance.payroll_slips.review", "finance.payroll_slips.approve", "finance.payroll_slips.mark_paid", "finance.payroll_slips.publish", "finance.advances.view", "finance.advances.create", "finance.advances.manage", "finance.payments.view", "finance.reports.view", "finance.export",
  "salaries.view", "salaries.create", "salaries.review", "salaries.approve", "salaries.publish", "salaries.delete",
  "reports.view", "reports.view.self", "reports.view.department", "reports.view.all", "reports.salary", "reports.attendance", "reports.export",
  "notifications.view.self", "notifications.manage",
  "announcements.view.self", "announcements.view.department", "announcements.view.all", "announcements.create", "announcements.create.general.company", "announcements.create.general.department", "announcements.create.private.department", "announcements.create.private.employee", "announcements.create.private.all_departments", "announcements.publish", "announcements.update.own", "announcements.update.all", "announcements.archive", "announcements.delete.own", "announcements.delete.all", "announcements.manage",
  "settings.view", "settings.manage",
];

const labelFromKey = (key) => {
  const map = {
    view: "عرض", create: "إنشاء", update: "تعديل", delete: "حذف", manage: "إدارة", all: "الكل", self: "ذاتي", department: "القسم", archive: "أرشفة", assign: "ربط", remove: "إزالة", move: "نقل", approve: "اعتماد", reject: "رفض", cancel: "إلغاء", export: "تصدير", publish: "نشر", edit: "تعديل", recalculate: "إعادة حساب", review: "مراجعة",
  };
  return key.split(".").map((part) => map[part] || part.replace(/_/g, " ")).join(" - ");
};

const moduleFromKey = (key) => MODULES[key.split(".")[0]] || "النظام";
const PERMISSION_DEFINITIONS = permissionKeys.map((key) => ({ key, label: labelFromKey(key), module: moduleFromKey(key) }));
const PERMISSIONS = PERMISSION_DEFINITIONS.map((permission) => permission.key);

const ROLE_PERMISSIONS = {
  admin: PERMISSIONS,
  employee: ["dashboard.view", "employees.view.self", "requests.view.self", "requests.create.self", "requests.cancel.self_pending", "attendance.view.self", "attendance.check.self", "notifications.view.self", "announcements.view.self", "reports.view.self", "finance.payroll_slips.view"],
  manager: ["dashboard.view", "employees.view.self", "employees.view.department", "employees.view", "requests.view.self", "requests.create.self", "requests.view.department", "requests.approve.department", "requests.reject.department", "requests.cancel.department", "requests.request_info", "requests.comment", "attendance.view.self", "attendance.view.department", "notifications.view.self", "announcements.view.self", "announcements.view.department", "announcements.create.general.department", "announcements.create.private.employee", "reports.view.department"],
  hr: ["dashboard.view", "employees.view", "employees.view.all", "employees.create", "employees.update", "employees.assign_departments", "employees.manage_login", "employees.manage_roles", "employees.manage_permissions", "departments.view", "departments.manage", "departments.create", "departments.update", "departments.disable", "attendance.view", "attendance.view.all", "attendance.create", "attendance.manual_add", "attendance.manual_edit", "attendance.delete", "requests.view.all", "requests.approve.all", "requests.reject.all", "requests.cancel.all", "requests.request_info", "requests.comment", "requests.manage", "shifts.view", "shifts.create", "shifts.update", "shifts.archive", "shifts.assign", "shifts.remove_employee", "shifts.move_employee", "shifts.view_week_distribution", "shifts.manage", "reports.view", "reports.view.all", "reports.attendance", "notifications.view.self", "announcements.view.self", "announcements.view.all", "announcements.create.general.company", "announcements.create.general.department", "announcements.create.private.department", "announcements.create.private.employee", "announcements.update.own", "announcements.archive", "job_titles.view"],
  finance: ["dashboard.view", "finance.view", "finance.dashboard.view", "finance.settings.view", "finance.settings.manage", "finance.payroll_slips.view", "finance.payroll_slips.view_all", "finance.payroll_slips.create", "finance.payroll_slips.edit", "finance.payroll_slips.recalculate", "finance.payroll_slips.review", "finance.advances.view", "finance.advances.create", "finance.advances.manage", "finance.payments.view", "finance.reports.view", "salaries.view", "salaries.create", "salaries.review", "employees.view_financial_basic", "reports.view", "reports.salary", "notifications.view.self", "announcements.view.self"],
};

const ROLE_LABELS = { admin: "مدير النظام", employee: "موظف", manager: "مدير قسم", hr: "الموارد البشرية", finance: "المالية" };
const DEFAULT_JOB_TITLES = [
  { name: "عامل", code: "worker", description: "صلاحيات موظف أساسية", default_permissions: ROLE_PERMISSIONS.employee },
  { name: "مشغل", code: "operator", description: "صلاحيات موظف أساسية", default_permissions: ROLE_PERMISSIONS.employee },
  { name: "مدير قسم", code: "department_manager", description: "إدارة طلبات وحضور وإعلانات القسم", default_permissions: ROLE_PERMISSIONS.manager },
  { name: "مدير إنتاج", code: "production_manager", description: "صلاحيات مدير إنتاج افتراضية", default_permissions: ROLE_PERMISSIONS.manager },
  { name: "موارد بشرية", code: "hr", description: "إدارة الموظفين والطلبات والحضور", default_permissions: ROLE_PERMISSIONS.hr },
  { name: "موظف مالية", code: "finance", description: "صلاحيات مالية ورواتب", default_permissions: ROLE_PERMISSIONS.finance },
  { name: "مشرف", code: "supervisor", description: "متابعة القسم والطلبات", default_permissions: ROLE_PERMISSIONS.manager },
  { name: "مدير النظام", code: "admin", description: "صلاحيات كاملة", default_permissions: PERMISSIONS },
];

const normalizeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeArray);
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
};
const unique = (items) => Array.from(new Set(normalizeArray(items)));

let schemaReady = false;
let schemaPromise = null;
const rolePermissionsCache = new Map();
const accessCache = new Map();
const ACCESS_CACHE_MS = 60 * 1000;
const invalidatePermissionCache = () => { rolePermissionsCache.clear(); accessCache.clear(); };

const ensurePermissionSchema = async () => {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[]`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[]`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS direct_denied_permissions TEXT[] DEFAULT ARRAY[]::text[]`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_number VARCHAR(50)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id INTEGER`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title_id INTEGER`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title_name VARCHAR(160)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS roles (id SERIAL PRIMARY KEY, role_key VARCHAR(80) UNIQUE NOT NULL, name VARCHAR(120) NOT NULL, description TEXT, is_system BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS permissions (id SERIAL PRIMARY KEY, permission_key VARCHAR(120) UNIQUE NOT NULL, name VARCHAR(160) NOT NULL, module VARCHAR(80) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS role_permissions (role_key VARCHAR(80) NOT NULL, permission_key VARCHAR(120) NOT NULL, PRIMARY KEY (role_key, permission_key))`);
    await pool.query(`CREATE TABLE IF NOT EXISTS job_titles (id SERIAL PRIMARY KEY, name VARCHAR(160) NOT NULL UNIQUE, code VARCHAR(80), description TEXT, default_permissions TEXT[] DEFAULT ARRAY[]::text[], status VARCHAR(30) DEFAULT 'active', created_by INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS permission_audit_logs (id SERIAL PRIMARY KEY, actor_user_id INTEGER, target_user_id INTEGER, actor_employee_id INTEGER, actor_name VARCHAR(160), target_type VARCHAR(80), target_id INTEGER, change_type VARCHAR(120) NOT NULL, old_value JSONB, new_value JSONB, reason TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS users_employee_id_idx ON users(employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS users_employee_number_idx ON users(employee_number)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS job_titles_status_idx ON job_titles(status)`);
    for (const [role, label] of Object.entries(ROLE_LABELS)) await pool.query(`INSERT INTO roles (role_key, name, description, is_system) VALUES ($1,$2,$3,true) ON CONFLICT (role_key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`, [role, label, `دور ${label}`]);
    for (const permission of PERMISSION_DEFINITIONS) await pool.query(`INSERT INTO permissions (permission_key, name, module) VALUES ($1,$2,$3) ON CONFLICT (permission_key) DO UPDATE SET name = EXCLUDED.name, module = EXCLUDED.module`, [permission.key, permission.label, permission.module]);
    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) for (const permission of permissions) await pool.query(`INSERT INTO role_permissions (role_key, permission_key) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [role, permission]);
    for (const jobTitle of DEFAULT_JOB_TITLES) await pool.query(`INSERT INTO job_titles (name, code, description, default_permissions, status) VALUES ($1,$2,$3,$4::text[],'active') ON CONFLICT (name) DO NOTHING`, [jobTitle.name, jobTitle.code, jobTitle.description, unique(jobTitle.default_permissions)]);
    await pool.query(`UPDATE users SET roles = ARRAY[role] WHERE roles IS NULL AND role IS NOT NULL`);
    await pool.query(`UPDATE users SET roles = ARRAY['admin'], permissions = ARRAY[]::text[], direct_denied_permissions = ARRAY[]::text[] WHERE employee_number = '1000' OR role = 'admin' OR email='admin@test.com'`);
    await pool.query(`UPDATE employees e SET job_title_name = COALESCE(e.job_title_name, e.job_title) WHERE e.job_title_name IS NULL AND e.job_title IS NOT NULL`);
    await pool.query(`UPDATE employees e SET job_title_id = jt.id, job_title_name = jt.name FROM job_titles jt WHERE e.job_title_id IS NULL AND TRIM(COALESCE(e.job_title,'')) = jt.name`);
    schemaReady = true;
  })().catch((error) => { schemaReady = false; throw error; }).finally(() => { schemaPromise = null; });
  return schemaPromise;
};

const getRolePermissions = async (roles) => {
  const cleanRoles = unique(roles).sort();
  if (!cleanRoles.length) return [];
  const cacheKey = cleanRoles.join("|");
  if (rolePermissionsCache.has(cacheKey)) return rolePermissionsCache.get(cacheKey);
  await ensurePermissionSchema();
  const result = await pool.query(`SELECT permission_key FROM role_permissions WHERE role_key = ANY($1::text[])`, [cleanRoles]);
  const permissions = unique([...cleanRoles.flatMap((role) => ROLE_PERMISSIONS[role] || []), ...result.rows.map((row) => row.permission_key)]);
  rolePermissionsCache.set(cacheKey, permissions);
  return permissions;
};

const getJobTitleAccess = async (employeeId) => {
  if (!employeeId) return { job_title: null, permissions: [] };
  await ensurePermissionSchema();
  const result = await pool.query(`
    SELECT jt.id, jt.name, jt.code, jt.default_permissions
    FROM employees e
    LEFT JOIN job_titles jt ON jt.id = e.job_title_id
    WHERE e.id = $1
    LIMIT 1
  `, [employeeId]);
  const jobTitle = result.rows[0] || null;
  return { job_title: jobTitle, permissions: unique(jobTitle?.default_permissions || []) };
};

const getUserAccess = async (userId, fallbackUser = null, options = {}) => {
  const cacheKey = String(userId || fallbackUser?.id || "");
  if (!options.force && accessCache.has(cacheKey)) {
    const cached = accessCache.get(cacheKey);
    if (Date.now() - cached.time < ACCESS_CACHE_MS) return cached.access;
  }
  await ensurePermissionSchema();
  const result = await pool.query(`SELECT id, role, roles, permissions, direct_denied_permissions, employee_id, employee_number, is_active FROM users WHERE id=$1 LIMIT 1`, [userId || fallbackUser?.id]);
  const user = result.rows[0] || fallbackUser || {};
  const roles = unique(user.roles || user.role || []);
  const direct = unique(user.permissions || []);
  const denied = unique(user.direct_denied_permissions || []);
  const rolePermissions = await getRolePermissions(roles);
  const job = await getJobTitleAccess(user.employee_id);
  let permissions = roles.includes("admin") ? [...PERMISSIONS] : unique([...rolePermissions, ...job.permissions, ...direct]);
  if (!roles.includes("admin")) permissions = permissions.filter((permission) => !denied.includes(permission));
  const access = {
    user_id: user.id || userId,
    roles,
    permissions,
    direct_permissions: direct,
    direct_denied_permissions: denied,
    role_permissions: rolePermissions,
    job_title: job.job_title,
    job_title_permissions: job.permissions,
    employee_id: user.employee_id || null,
    employee_number: user.employee_number || null,
    is_active: user.is_active !== false,
  };
  accessCache.set(cacheKey, { time: Date.now(), access });
  return access;
};

const hasPermissionValue = (accessOrPermissions, permission) => {
  if (!permission) return true;
  const permissions = Array.isArray(accessOrPermissions) ? accessOrPermissions : (accessOrPermissions?.permissions || []);
  const roles = Array.isArray(accessOrPermissions) ? [] : (accessOrPermissions?.roles || []);
  return roles.includes("admin") || permissions.includes("system.admin") || permissions.includes(permission);
};

module.exports = {
  PERMISSIONS,
  PERMISSION_DEFINITIONS,
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  ensurePermissionSchema,
  normalizeArray,
  unique,
  getRolePermissions,
  getUserAccess,
  hasPermissionValue,
  invalidatePermissionCache,
};
