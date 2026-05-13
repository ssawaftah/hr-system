const pool = require("../db");

const PERMISSIONS = [
  "users.view", "users.create", "users.manage_permissions",
  "employees.view", "employees.create", "employees.update", "employees.delete",
  "departments.view", "departments.manage",
  "attendance.view", "attendance.create", "attendance.delete",
  "leaves.view", "leaves.create", "leaves.update", "leaves.approve", "leaves.delete",
  "shifts.view", "shifts.manage",
  "salaries.view", "salaries.create", "salaries.review", "salaries.approve", "salaries.publish", "salaries.delete",
  "reports.view", "reports.salary",
  "dashboard.view"
];

const ROLE_PERMISSIONS = {
  admin: PERMISSIONS,
  hr: [
    "employees.view", "employees.create", "employees.update",
    "departments.view", "departments.manage",
    "attendance.view", "attendance.create", "attendance.delete",
    "leaves.view", "leaves.create", "leaves.update", "leaves.approve", "leaves.delete",
    "shifts.view", "shifts.manage",
    "reports.view", "dashboard.view"
  ],
  employee: ["dashboard.view"]
};

const ensurePermissionSchema = async () => {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[]`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[]`);

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

  for (const role of ["admin", "hr", "employee"]) {
    await pool.query(
      `INSERT INTO roles (role_key, name, description, is_system) VALUES ($1,$2,$3,true) ON CONFLICT (role_key) DO NOTHING`,
      [role, role === "admin" ? "مدير النظام" : role === "hr" ? "الموارد البشرية" : "موظف", `دور ${role}`]
    );
  }

  for (const permission of PERMISSIONS) {
    const module = permission.split(".")[0];
    await pool.query(
      `INSERT INTO permissions (permission_key, name, module) VALUES ($1,$2,$3) ON CONFLICT (permission_key) DO NOTHING`,
      [permission, permission, module]
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
};

const normalizeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeArray);
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
};

const getUserAccess = async (userId, tokenUser = null) => {
  await ensurePermissionSchema();
  const result = await pool.query(`SELECT id, role, roles, permissions FROM users WHERE id = $1`, [userId]);
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
  return { roles, permissions };
};

module.exports = { PERMISSIONS, ROLE_PERMISSIONS, ensurePermissionSchema, getUserAccess, normalizeArray };
