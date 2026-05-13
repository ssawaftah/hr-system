const pool = require("../db");

const PERMISSION_DEFINITIONS = [
  { key: "dashboard.view", label: "عرض الرئيسية", module: "الرئيسية" },
  { key: "system.admin", label: "إدارة النظام بالكامل", module: "النظام" },
  { key: "system.health.view", label: "عرض حالة النظام", module: "النظام" },
  { key: "users.view", label: "عرض الحسابات الداخلية", module: "النظام" },
  { key: "users.create", label: "إنشاء حساب داخلي", module: "النظام" },
  { key: "users.manage_permissions", label: "إدارة صلاحيات الحسابات", module: "النظام" },
  { key: "permissions.view", label: "عرض الصلاحيات", module: "الصلاحيات" },
  { key: "permissions.manage", label: "إدارة الصلاحيات", module: "الصلاحيات" },
  { key: "permissions.assign_roles", label: "إسناد الأدوار", module: "الصلاحيات" },
  { key: "permissions.remove_roles", label: "إزالة الأدوار", module: "الصلاحيات" },
  { key: "permissions.assign_permissions", label: "إسناد صلاحيات مباشرة", module: "الصلاحيات" },
  { key: "permissions.remove_permissions", label: "إزالة صلاحيات مباشرة", module: "الصلاحيات" },
  { key: "permissions.view_logs", label: "عرض سجل الصلاحيات", module: "الصلاحيات" },
  { key: "job_titles.view", label: "عرض المسميات الوظيفية", module: "المسميات الوظيفية" },
  { key: "job_titles.create", label: "إنشاء مسمى وظيفي", module: "المسميات الوظيفية" },
  { key: "job_titles.update", label: "تعديل مسمى وظيفي", module: "المسميات الوظيفية" },
  { key: "job_titles.delete", label: "حذف مسمى وظيفي", module: "المسميات الوظيفية" },
  { key: "job_titles.disable", label: "تعطيل مسمى وظيفي", module: "المسميات الوظيفية" },
  { key: "job_titles.manage_permissions", label: "تحديد صلاحيات المسمى الوظيفي", module: "المسميات الوظيفية" },
  { key: "employee_permissions.view", label: "عرض صلاحيات الموظفين", module: "صلاحيات الموظفين" },
  { key: "employee_permissions.manage", label: "إدارة صلاحيات الموظفين", module: "صلاحيات الموظفين" },
  { key: "employee_permissions.add_direct", label: "إضافة صلاحية مباشرة لموظف", module: "صلاحيات الموظفين" },
  { key: "employee_permissions.deny", label: "استثناء صلاحية من موظف", module: "صلاحيات الموظفين" },
  { key: "employee_permissions.remove_direct", label: "إزالة صلاحية مباشرة", module: "صلاحيات الموظفين" },
  { key: "employee_permissions.remove_denied", label: "إزالة استثناء صلاحية", module: "صلاحيات الموظفين" },
  { key: "employees.view", label: "عرض الموظفين", module: "الموظفون" },
  { key: "employees.view.self", label: "عرض بياناتي الوظيفية", module: "الموظفون" },
  { key: "employees.create", label: "إنشاء موظف", module: "الموظفون" },
  { key: "employees.update", label: "تعديل موظف", module: "الموظفون" },
  { key: "employees.delete", label: "حذف موظف", module: "الموظفون" },
  { key: "employees.disable", label: "تعطيل موظف", module: "الموظفون" },
  { key: "employees.assign_departments", label: "ربط الموظف بالأقسام", module: "الموظفون" },
  { key: "employees.manage_login", label: "إدارة دخول الموظف", module: "الموظفون" },
  { key: "employees.reset_password", label: "إعادة تعيين كلمة مرور موظف", module: "الموظفون" },
  { key: "employees.manage_roles", label: "إدارة أدوار الموظف", module: "الموظفون" },
  { key: "employees.manage_permissions", label: "إدارة صلاحيات الموظف", module: "الموظفون" },
  { key: "employees.view_financial_basic", label: "عرض البيانات المالية الأساسية", module: "الموظفون" },
  { key: "employees.update_financial_basic", label: "تعديل البيانات المالية الأساسية", module: "الموظفون" },
  { key: "departments.view", label: "عرض الأقسام", module: "الأقسام" },
  { key: "departments.manage", label: "إدارة الأقسام", module: "الأقسام" },
  { key: "departments.create", label: "إنشاء قسم", module: "الأقسام" },
  { key: "departments.update", label: "تعديل قسم", module: "الأقسام" },
  { key: "departments.delete", label: "حذف قسم", module: "الأقسام" },
  { key: "departments.disable", label: "تعطيل قسم", module: "الأقسام" },
  { key: "attendance.view", label: "عرض الحضور", module: "الحضور والانصراف" },
  { key: "attendance.view.self", label: "عرض حضوري", module: "الحضور والانصراف" },
  { key: "attendance.view.department", label: "عرض حضور القسم", module: "الحضور والانصراف" },
  { key: "attendance.view.all", label: "عرض حضور الجميع", module: "الحضور والانصراف" },
  { key: "attendance.create", label: "إضافة سجل حضور", module: "الحضور والانصراف" },
  { key: "attendance.check.self", label: "تسجيل حضوري", module: "الحضور والانصراف" },
  { key: "attendance.manual_add", label: "إضافة حضور يدوي", module: "الحضور والانصراف" },
  { key: "attendance.manual_edit", label: "تعديل حضور يدوي", module: "الحضور والانصراف" },
  { key: "attendance.delete", label: "حذف سجل حضور", module: "الحضور والانصراف" },
  { key: "attendance.manage", label: "إدارة الحضور", module: "الحضور والانصراف" },
  { key: "leaves.view", label: "عرض الإجازات القديمة", module: "الطلبات" },
  { key: "leaves.create", label: "إنشاء إجازة قديمة", module: "الطلبات" },
  { key: "leaves.update", label: "تعديل إجازة قديمة", module: "الطلبات" },
  { key: "leaves.approve", label: "اعتماد أو رفض إجازة قديمة", module: "الطلبات" },
  { key: "leaves.delete", label: "حذف إجازة قديمة", module: "الطلبات" },
  { key: "requests.view.self", label: "عرض طلباتي", module: "الطلبات" },
  { key: "requests.view.department", label: "عرض طلبات القسم", module: "الطلبات" },
  { key: "requests.view.all", label: "عرض كل الطلبات", module: "الطلبات" },
  { key: "requests.create.self", label: "إنشاء طلب شخصي", module: "الطلبات" },
  { key: "requests.update.self_draft", label: "تعديل مسودة طلب شخصي", module: "الطلبات" },
  { key: "requests.cancel.self_pending", label: "إلغاء طلبي قيد الانتظار", module: "الطلبات" },
  { key: "requests.approve.department", label: "اعتماد طلبات القسم", module: "الطلبات" },
  { key: "requests.approve.all", label: "اعتماد كل الطلبات", module: "الطلبات" },
  { key: "requests.reject.department", label: "رفض طلبات القسم", module: "الطلبات" },
  { key: "requests.reject.all", label: "رفض كل الطلبات", module: "الطلبات" },
  { key: "requests.cancel.department", label: "إلغاء طلبات القسم", module: "الطلبات" },
  { key: "requests.cancel.all", label: "إلغاء كل الطلبات", module: "الطلبات" },
  { key: "requests.request_info", label: "طلب معلومات إضافية للطلب", module: "الطلبات" },
  { key: "requests.comment", label: "إضافة تعليق على الطلب", module: "الطلبات" },
  { key: "requests.view_logs", label: "عرض سجل إجراءات الطلب", module: "الطلبات" },
  { key: "requests.manage", label: "إدارة الطلبات", module: "الطلبات" },
  { key: "shifts.view", label: "عرض الشفتات", module: "الشفتات" },
  { key: "shifts.manage", label: "إدارة الشفتات", module: "الشفتات" },
  { key: "finance.view", label: "عرض المالية", module: "المالية" },
  { key: "salaries.view", label: "عرض الرواتب", module: "الرواتب" },
  { key: "salaries.create", label: "إنشاء راتب", module: "الرواتب" },
  { key: "salaries.review", label: "مراجعة راتب", module: "الرواتب" },
  { key: "salaries.approve", label: "اعتماد راتب", module: "الرواتب" },
  { key: "salaries.publish", label: "نشر راتب", module: "الرواتب" },
  { key: "salaries.delete", label: "حذف راتب", module: "الرواتب" },
  { key: "finance.payroll_slips.view", label: "عرض كشوف الرواتب", module: "المالية" },
  { key: "finance.payroll_slips.create", label: "إنشاء كشف راتب", module: "المالية" },
  { key: "finance.payroll_slips.review", label: "مراجعة كشف راتب", module: "المالية" },
  { key: "finance.payroll_slips.approve", label: "اعتماد كشف راتب", module: "المالية" },
  { key: "finance.payroll_slips.publish", label: "نشر كشف راتب", module: "المالية" },
  { key: "finance.payroll_slips.view_all", label: "عرض كل كشوف الرواتب", module: "المالية" },
  { key: "reports.view", label: "عرض التقارير", module: "التقارير" },
  { key: "reports.salary", label: "عرض تقارير الرواتب", module: "التقارير" },
  { key: "reports.view.self", label: "عرض تقاريري", module: "التقارير" },
  { key: "reports.view.department", label: "عرض تقارير القسم", module: "التقارير" },
  { key: "reports.view.all", label: "عرض كل التقارير", module: "التقارير" },
  { key: "notifications.view.self", label: "عرض إشعاراتي", module: "الإشعارات" },
  { key: "notifications.manage", label: "إدارة الإشعارات", module: "الإشعارات" },
  { key: "announcements.view.self", label: "عرض الإعلانات", module: "الإعلانات" },
  { key: "announcements.create", label: "إنشاء إعلان", module: "الإعلانات" },
  { key: "announcements.publish", label: "نشر إعلان", module: "الإعلانات" },
  { key: "announcements.manage", label: "إدارة الإعلانات", module: "الإعلانات" },
  { key: "settings.view", label: "عرض الإعدادات", module: "الإعدادات" },
  { key: "settings.manage", label: "إدارة الإعدادات", module: "الإعدادات" },
];

const PERMISSIONS = PERMISSION_DEFINITIONS.map((permission) => permission.key);
const ROLE_PERMISSIONS = {
  admin: PERMISSIONS,
  employee: ["dashboard.view", "employees.view.self", "requests.view.self", "requests.create.self", "requests.cancel.self_pending", "attendance.view.self", "attendance.check.self", "notifications.view.self", "announcements.view.self", "reports.view.self", "finance.payroll_slips.view"],
  manager: ["dashboard.view", "employees.view.self", "employees.view", "requests.view.self", "requests.create.self", "requests.view.department", "requests.approve.department", "requests.reject.department", "requests.cancel.department", "requests.request_info", "requests.comment", "attendance.view.self", "attendance.view.department", "notifications.view.self", "announcements.view.self", "reports.view.department"],
  hr: ["dashboard.view", "employees.view", "employees.create", "employees.update", "employees.assign_departments", "employees.manage_login", "employees.manage_roles", "employees.manage_permissions", "departments.view", "departments.manage", "departments.create", "departments.update", "departments.disable", "attendance.view", "attendance.view.all", "attendance.create", "attendance.manual_add", "attendance.manual_edit", "attendance.delete", "leaves.view", "leaves.create", "leaves.update", "leaves.approve", "leaves.delete", "requests.view.all", "requests.approve.all", "requests.reject.all", "requests.cancel.all", "requests.request_info", "requests.comment", "requests.manage", "shifts.view", "shifts.manage", "reports.view", "reports.view.all", "notifications.view.self", "announcements.view.self", "job_titles.view"],
  finance: ["dashboard.view", "finance.view", "salaries.view", "salaries.create", "salaries.review", "finance.payroll_slips.view", "finance.payroll_slips.create", "finance.payroll_slips.review", "finance.payroll_slips.view_all", "employees.view_financial_basic", "reports.view", "reports.salary", "notifications.view.self", "announcements.view.self"],
};
const ROLE_LABELS = { admin: "مدير النظام", employee: "موظف", manager: "مدير قسم", hr: "الموارد البشرية", finance: "المالية" };
const DEFAULT_JOB_TITLES = [
  { name: "عامل", code: "worker", description: "صلاحيات موظف أساسية", default_permissions: ROLE_PERMISSIONS.employee },
  { name: "مشغل", code: "operator", description: "صلاحيات موظف أساسية", default_permissions: ROLE_PERMISSIONS.employee },
  { name: "مدير قسم", code: "department_manager", description: "إدارة طلبات وحضور القسم", default_permissions: ROLE_PERMISSIONS.manager },
  { name: "مدير إنتاج", code: "production_manager", description: "صلاحيات مدير إنتاج افتراضية", default_permissions: ROLE_PERMISSIONS.manager },
  { name: "موارد بشرية", code: "hr", description: "إدارة الموظفين والطلبات", default_permissions: ROLE_PERMISSIONS.hr },
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
  const key = cleanRoles.join("|");
  if (rolePermissionsCache.has(key)) return rolePermissionsCache.get(key);
  const result = await pool.query(`SELECT DISTINCT permission_key FROM role_permissions WHERE role_key = ANY($1::text[])`, [cleanRoles]);
  const permissions = result.rows.map((row) => row.permission_key);
  rolePermissionsCache.set(key, permissions);
  return permissions;
};

const getEmployeeJobTitlePermissions = async (employeeId) => {
  if (!employeeId) return { job_title: null, permissions: [] };
  const result = await pool.query(`SELECT jt.id, jt.name, jt.default_permissions, jt.status FROM employees e LEFT JOIN job_titles jt ON jt.id=e.job_title_id WHERE e.id=$1 LIMIT 1`, [employeeId]);
  const jobTitle = result.rows[0]?.id ? result.rows[0] : null;
  return { job_title: jobTitle, permissions: jobTitle && jobTitle.status === "active" ? unique(jobTitle.default_permissions) : [] };
};

const calculateEffectivePermissions = ({ jobTitlePermissions = [], rolePermissions = [], directPermissions = [], deniedPermissions = [], roles = [] }) => {
  if (unique(roles).includes("admin")) return PERMISSIONS;
  const allowed = unique([...jobTitlePermissions, ...rolePermissions, ...directPermissions]);
  const denied = unique(deniedPermissions);
  return allowed.filter((permission) => !denied.includes(permission));
};

const getUserAccess = async (userId, tokenUser = null, options = {}) => {
  await ensurePermissionSchema();
  const cached = accessCache.get(userId);
  if (cached && !options.force && Date.now() - cached.time < ACCESS_CACHE_MS) return cached.value;
  const result = await pool.query(`SELECT id, role, roles, permissions, direct_denied_permissions, employee_id, employee_number FROM users WHERE id = $1`, [userId]);
  const dbUser = result.rows[0] || {};
  const roles = unique([tokenUser?.roles, tokenUser?.role, dbUser.roles, dbUser.role]).filter(Boolean);
  const directPermissions = unique(dbUser.permissions);
  const deniedPermissions = unique(dbUser.direct_denied_permissions);
  const [rolePermissions, job] = await Promise.all([getRolePermissions(roles), getEmployeeJobTitlePermissions(dbUser.employee_id)]);
  const permissions = calculateEffectivePermissions({ jobTitlePermissions: job.permissions, rolePermissions, directPermissions, deniedPermissions, roles });
  const value = { roles, permissions, direct_permissions: directPermissions, direct_denied_permissions: deniedPermissions, role_permissions: rolePermissions, job_title: job.job_title, job_title_permissions: job.permissions, employee_id: dbUser.employee_id, employee_number: dbUser.employee_number };
  accessCache.set(userId, { time: Date.now(), value });
  return value;
};

const getEmployeePermissionSummary = async (employeeId) => {
  await ensurePermissionSchema();
  const user = await pool.query(`SELECT id, role, roles, permissions, direct_denied_permissions, employee_id, employee_number FROM users WHERE employee_id=$1 LIMIT 1`, [employeeId]);
  if (!user.rows.length) return null;
  const dbUser = user.rows[0];
  const roles = unique([dbUser.roles, dbUser.role]).filter(Boolean);
  const directPermissions = unique(dbUser.permissions);
  const deniedPermissions = unique(dbUser.direct_denied_permissions);
  const [rolePermissions, job] = await Promise.all([getRolePermissions(roles), getEmployeeJobTitlePermissions(dbUser.employee_id)]);
  const effectivePermissions = calculateEffectivePermissions({ jobTitlePermissions: job.permissions, rolePermissions, directPermissions, deniedPermissions, roles });
  return { user_id: dbUser.id, employee_id: dbUser.employee_id, roles, job_title: job.job_title, job_title_permissions: job.permissions, role_permissions: rolePermissions, direct_permissions: directPermissions, denied_permissions: deniedPermissions, effective_permissions: effectivePermissions };
};

const hasPermissionValue = (access, permission) => {
  const roles = normalizeArray(access?.roles);
  const permissions = normalizeArray(access?.permissions);
  return roles.includes("admin") || permissions.includes(permission) || permissions.includes("system.admin");
};
const hasAnyPermissionValue = (access, permissions = []) => permissions.some((permission) => hasPermissionValue(access, permission));

module.exports = { PERMISSIONS, PERMISSION_DEFINITIONS, ROLE_PERMISSIONS, ROLE_LABELS, ensurePermissionSchema, getUserAccess, getEmployeePermissionSummary, calculateEffectivePermissions, normalizeArray, hasPermissionValue, hasAnyPermissionValue, invalidatePermissionCache };
