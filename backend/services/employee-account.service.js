const bcrypt = require("bcrypt");

const normalizeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeArray);
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
};

const normalizeBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return Boolean(value);
};

const internalEmailForEmployee = (employeeNumber) => `${employeeNumber}@internal.local`;

const ensureEmployeeAccountSchema = async (client) => {
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_number VARCHAR(50)`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id INTEGER`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[]`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[]`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(30) DEFAULT 'active'`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_employee_number_unique_idx ON users(employee_number) WHERE employee_number IS NOT NULL`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_employee_id_unique_idx ON users(employee_id) WHERE employee_id IS NOT NULL`);
};

const validateEmployeeAccountPayload = (body, isCreate = false) => {
  const employeeNumber = String(body.employee_number || body.national_id || "").trim();
  const loginEnabled = normalizeBoolean(body.is_login_enabled ?? body.login_enabled, true);
  const password = String(body.password || body.new_password || "");

  if (!employeeNumber) return "رقم الموظف مطلوب لإنشاء بيانات الدخول";
  if (isCreate && loginEnabled && !password) return "كلمة المرور مطلوبة عند تفعيل الدخول للنظام";
  return null;
};

const syncEmployeeAccount = async (client, employee, body = {}, options = {}) => {
  await ensureEmployeeAccountSchema(client);

  const employeeNumber = String(employee.employee_number || body.employee_number || body.national_id || "").trim();
  const fullName = String(employee.full_name || body.full_name || "").trim();
  const email = String(employee.email || body.email || "").trim() || internalEmailForEmployee(employeeNumber);
  const loginEnabled = normalizeBoolean(body.is_login_enabled ?? body.login_enabled, employee.is_active !== false);
  const accountStatus = body.account_status || (loginEnabled ? "active" : "disabled");
  const isActive = loginEnabled && accountStatus === "active" && employee.is_active !== false;
  const roles = normalizeArray(body.roles).length ? normalizeArray(body.roles) : ["employee"];
  const permissions = normalizeArray(body.permissions);
  const password = String(body.password || body.new_password || "");

  const existing = await client.query(
    `SELECT * FROM users WHERE employee_id = $1 OR employee_number = $2 ORDER BY employee_id NULLS LAST LIMIT 1`,
    [employee.id, employeeNumber]
  );

  if (!existing.rows.length && loginEnabled && !password) {
    throw new Error("كلمة المرور مطلوبة عند تفعيل الدخول للنظام");
  }

  let passwordHash = existing.rows[0]?.password_hash;
  if (password) passwordHash = await bcrypt.hash(password, 10);
  if (!passwordHash) passwordHash = await bcrypt.hash(`${employeeNumber}-${Date.now()}`, 10);

  if (existing.rows.length) {
    const result = await client.query(
      `
      UPDATE users
      SET full_name = $1,
          email = $2,
          employee_number = $3,
          employee_id = $4,
          password_hash = $5,
          role = $6,
          roles = $7::text[],
          permissions = $8::text[],
          is_active = $9,
          account_status = $10,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING id, full_name, email, employee_number, employee_id, role, roles, permissions, is_active, account_status
      `,
      [fullName, email, employeeNumber, employee.id, passwordHash, roles[0], roles, permissions, isActive, accountStatus, existing.rows[0].id]
    );
    return result.rows[0];
  }

  const result = await client.query(
    `
    INSERT INTO users
    (full_name, email, employee_number, employee_id, password_hash, role, roles, permissions, is_active, account_status, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7::text[],$8::text[],$9,$10,CURRENT_TIMESTAMP)
    RETURNING id, full_name, email, employee_number, employee_id, role, roles, permissions, is_active, account_status
    `,
    [fullName, email, employeeNumber, employee.id, passwordHash, roles[0], roles, permissions, isActive, accountStatus]
  );
  return result.rows[0];
};

module.exports = {
  ensureEmployeeAccountSchema,
  syncEmployeeAccount,
  validateEmployeeAccountPayload,
  normalizeArray,
  normalizeBoolean,
};
