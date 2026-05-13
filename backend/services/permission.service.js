const pool = require("../db");

const PERMISSION_DEFINITIONS = [
  { key: "dashboard.view", label: "عرض الرئيسية", module: "الرئيسية" },
  { key: "system.admin", label: "إدارة النظام بالكامل", module: "النظام" },
  { key: "system.health.view", label: "عرض حالة النظام", module: "النظام" },

  { key: "users.view", label: "عرض المستخدمين", module: "النظام" },
  { key: "users.create", label: "إنشاء مستخدم", module: "النظام" },
  { key: "users.manage_permissions", label: "إدارة صلاحيات المستخدمين", module: "النظام" },

  { key: "permissions.view", label: "عرض الصلاحيات", module: "الصلاحيات" },
  { key: "permissions.manage", label: "إدارة الصلاحيات", module: "الصلاحيات" },
  { key: "permissions.assign_roles", label: "إسناد الأدوار", module: "الصلاحيات" },
  { key: "permissions.remove_roles", label: "إزالة الأدوار", module: "الصلاحيات" },
  { key: "permissions.assign_permissions", label: "إسناد صلاحيات مباشرة", module: "الصلاحيات" },
  { key: "permissions.remove_permissions", label: "إزالة صلاحيات مباشرة", module: "الصلاحيات" },
  { key: "permissions.view_logs", label: "عرض سجل الصلاحيات", module: "الصلاحيات" },

  { key: "employees.view", label: "عرض الموظفين", module: "الموظفون" },
  { key: "employees.view.self", label: "عرض بياناتي الوظيفية", module: "الموظفون" },
  { key: "employees.create", label: "إنشاء موظف", module: "الموظفون" },
  { key: "employees.update", label: "تعديل موظف", module: "الموظفون" },
  { key: "employees.delete", label: "حذف موظف", module: "الموظفون" },
  { key: "employees.disable", label: "تعطيل موظف", module: "الموظفون" },
  { key: "employees.assign_departments", label: "ربط الموظف بالأقسام", module: "الموظفون" },

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

  { key: "leaves.view", label: "عرض الإجازات", module: "الطلبات" },
  { key: "leaves.create", label: "إنشاء إجازة", module: "الطلبات" },
  { key: "leaves.update", label: "تعديل إجازة", module: "الطلبات" },
  { key: "leaves.approve", label: "اعتماد أو رفض إجازة", module: "الطلبات" },
  { key: "leaves.delete", label: "حذف إجازة", module: "الطلبات" },

  { key: "requests.view.self", label: "عرض طلباتي", module: "الطلبات" },
  { key: "requests.view.department", label: "عرض طلبات القسم", module: "الطلبات" },
  { key: "requests.view.all", label: "عرض كل الطلبات", module: "الطلبات" },
  { key: "requests.create.self", label: "إنشاء طلب شخصي", module: "الطلبات" },
  { key: "requests.approve.department", label: "اعتماد طلبات القسم", module: "الطلبات" },
  { key: "requests.approve.all", label: "اعتماد كل الطلبات", module: "الطلبات" },
  { key: "requests.reject.department", label: "رفض طلبات القسم", module: "الطلبات" },
  { key: "requests.reject.all", label: "رفض كل الطلبات", module: "الطلبات" },
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
  employee: [
    "dashboard.view", "employees.view.self", "requests.view.self", "requests.create.self",
    "attendance.view.self", "attendance.check.self", "notifications.view.self",
    "announcements.view.self", "reports.view.self", "finance.payroll_slips.view"
  ],
  manager: [
    "dashboard.view", "employees.view.self", "employees.view", "requests.view.self", "requests.create.self",
    "requests.view.department", "requests.approve.department", "requests.reject.department",
    "attendance.view.self", "attendance.view.department", "notifications.view.self",
    "announcements.view.self", "reports.view.department"
  ],
  hr: [
    "dashboard.view", "employees.view", "employees.create", "employees.update", "employees.assign_departments",
    "departments.view", "departments.manage", "departments.create", "departments.update", "departments.disable",
    "attendance.view", "attendance.view.all", "attendance.create", "attendance.manual_add", "attendance.manual_edit", "attendance.delete",
    "leaves.view", "leaves.create", "leaves.update", "leaves.approve", "leaves.delete",
    "requests.view.all", "requests.approve.all", "requests.reject.all", "requests.manage",
    "shifts.view", "shifts.manage", "reports.view", "reports.view.all",
    "notifications.view.self", "announcements.view.self"
  ],
  finance: [
    "dashboard.view", "finance.view", "salaries.view", "salaries.create", "salaries.review",
    "finance.payroll_slips.view", "finance.payroll_slips.create", "finance.payroll_slips.review", "finance.payroll_slips.view_all",
    "reports.view", "reports.salary", "notifications.view.self", "announcements.view.self"
  ]
};

const ROLE_LABELS = {
  admin: "مدير النظام",
  employee: "موظف",
  manager: "مدير قسم",
  hr: "الموارد البشرية",
  finance: "المالية"
};

const ensurePermissionSchema = async () => {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[]`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[]`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_number VARCHAR(50)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id INTEGER`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      role_key VARCHAR(80) UNIQUE NOT NULL,
      name VARCHAR(120) NOT NULL,
      description TEXT,
      is_system BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY,
      permission_key VARCHAR(120) UNIQUE NOT NULL,
      name VARCHAR(160) NOT NULL,
      module VARCHAR(80) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_key VARCHAR(80) NOT NULL,
      permission_key VARCHAR(120) NOT NULL,
      PRIMARY KEY (role_key, permission_key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS permission_audit_logs (
      id SERIAL PRIMARY KEY,
      actor_user_id INTEGER,
      target_user_id INTEGER,
      change_type VARCHAR(120) NOT NULL,
      old_value JSONB,
      new_value JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const [role, label] of Object.entries(ROLE_LABELS)) {
    await pool.query(
      `INSERT INTO roles (role_key, name, description, is_system) VALUES ($1,$2,$3,true)
       ON CONFLICT (role_key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
      [role, label, `دور ${label}`]
    );
  }

  for (const permission of PERMISSION_DEFINITIONS) {
    await pool.query(
      `INSERT INTO permissions (permission_key, name, module) VALUES ($1,$2,$3)
       ON CONFLICT (permission_key) DO UPDATE SET name = EXCLUDED.name, module = EXCLUDED.module`,
      [permission.key, permission.label, permission.module]
    );
  }

  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permission of permissions) {
      await pool.query(
        `INSERT INTO role_permissions (role_key, permission_key) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [role, permission]
      );
    }
  }

  await pool.query(`UPDATE users SET roles = ARRAY[role] WHERE roles IS NULL AND role IS NOT NULL`);
  await pool.query(`UPDATE users SET roles = ARRAY['admin'], permissions = ARRAY[]::text[] WHERE employee_number = '1000' OR role = 'admin'`);
};

const normalizeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeArray);
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
};

const getUserAccess = async (userId, tokenUser = null) => {
  await ensurePermissionSchema();
  const result = await pool.query(`SELECT id, role, roles, permissions, employee_id, employee_number FROM users WHERE id = $1`, [userId]);
  const dbUser = result.rows[0] || {};
  const roles = Array.from(new Set([
    ...normalizeArray(tokenUser?.roles),
    ...normalizeArray(tokenUser?.role),
    ...normalizeArray(dbUser.roles),
    ...normalizeArray(dbUser.role),
  ])).filter(Boolean);

  const directPermissions = normalizeArray(dbUser.permissions);
  let rolePermissions = [];
  if (roles.length) {
    const rp = await pool.query(
      `SELECT DISTINCT permission_key FROM role_permissions WHERE role_key = ANY($1::text[])`,
      [roles]
    );
    rolePermissions = rp.rows.map((row) => row.permission_key);
  }

  const permissions = Array.from(new Set([...directPermissions, ...rolePermissions]));
  return { roles, permissions, employee_id: dbUser.employee_id, employee_number: dbUser.employee_number };
};

const hasPermissionValue = (access, permission) => {
  const roles = normalizeArray(access?.roles);
  const permissions = normalizeArray(access?.permissions);
  return roles.includes("admin") || permissions.includes(permission) || permissions.includes("system.admin");
};

const hasAnyPermissionValue = (access, permissions = []) => permissions.some((permission) => hasPermissionValue(access, permission));

module.exports = {
  PERMISSIONS,
  PERMISSION_DEFINITIONS,
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  ensurePermissionSchema,
  getUserAccess,
  normalizeArray,
  hasPermissionValue,
  hasAnyPermissionValue,
};
