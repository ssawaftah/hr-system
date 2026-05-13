const pool = require("../db");
const bcrypt = require("bcrypt");
const {
  PERMISSIONS,
  PERMISSION_DEFINITIONS,
  ROLE_LABELS,
  ensurePermissionSchema,
  normalizeArray,
  getUserAccess,
} = require("../services/permission.service");

const allowedRoles = Object.keys(ROLE_LABELS);

const writePermissionLog = async (actorId, targetId, changeType, oldValue, newValue) => {
  await pool.query(
    `INSERT INTO permission_audit_logs (actor_user_id, target_user_id, change_type, old_value, new_value)
     VALUES ($1,$2,$3,$4,$5)`,
    [actorId || null, targetId || null, changeType, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null]
  );
};

const getUsers = async (req, res) => {
  try {
    await ensurePermissionSchema();
    const result = await pool.query(`
      SELECT u.id, u.full_name, u.email, u.employee_number, u.employee_id, u.role, u.roles, u.permissions, u.is_active, u.created_at,
             e.full_name AS employee_name
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      ORDER BY u.id ASC
    `);
    const logs = await pool.query(`
      SELECT l.id, l.change_type, l.old_value, l.new_value, l.created_at,
             actor.full_name AS actor_name,
             target.full_name AS target_name
      FROM permission_audit_logs l
      LEFT JOIN users actor ON actor.id = l.actor_user_id
      LEFT JOIN users target ON target.id = l.target_user_id
      ORDER BY l.id DESC
      LIMIT 50
    `);
    res.status(200).json({
      users: result.rows,
      available_permissions: PERMISSIONS,
      permission_definitions: PERMISSION_DEFINITIONS,
      role_labels: ROLE_LABELS,
      permission_logs: logs.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    await ensurePermissionSchema();
    const { full_name, email, password, role, employee_number, employee_id } = req.body;
    const roles = normalizeArray(req.body.roles || role);
    const permissions = normalizeArray(req.body.permissions);

    if (!full_name || !password || !roles.length) return res.status(400).json({ error: "جميع الحقول مطلوبة" });
    if (roles.some((item) => !allowedRoles.includes(item))) return res.status(400).json({ error: "يوجد دور غير صحيح" });
    if (permissions.some((item) => !PERMISSIONS.includes(item))) return res.status(400).json({ error: "يوجد صلاحية غير صحيحة" });

    if (email) {
      const existingEmail = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
      if (existingEmail.rows.length > 0) return res.status(400).json({ error: "البريد الإلكتروني مستخدم مسبقًا" });
    }
    if (employee_number) {
      const existingNumber = await pool.query(`SELECT id FROM users WHERE employee_number = $1`, [employee_number]);
      if (existingNumber.rows.length > 0) return res.status(400).json({ error: "رقم الموظف مستخدم مسبقًا" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const primaryRole = roles[0];
    const safeEmail = email || `${employee_number || Date.now()}@internal.local`;
    const result = await pool.query(
      `
      INSERT INTO users (full_name, email, employee_number, employee_id, password_hash, role, roles, permissions)
      VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8::text[])
      RETURNING id, full_name, email, employee_number, employee_id, role, roles, permissions, is_active, created_at
      `,
      [full_name, safeEmail, employee_number || null, employee_id || null, hashedPassword, primaryRole, roles, permissions]
    );

    await writePermissionLog(req.user?.id, result.rows[0].id, "تم إنشاء مستخدم", null, result.rows[0]);
    res.status(201).json({ message: "تم إنشاء المستخدم بنجاح", user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateUserAccess = async (req, res) => {
  try {
    await ensurePermissionSchema();
    const { id } = req.params;
    const roles = normalizeArray(req.body.roles);
    const permissions = normalizeArray(req.body.permissions);
    const isActive = req.body.is_active;

    if (!roles.length) return res.status(400).json({ error: "يجب اختيار دور واحد على الأقل" });
    if (roles.some((item) => !allowedRoles.includes(item))) return res.status(400).json({ error: "يوجد دور غير صحيح" });
    if (permissions.some((item) => !PERMISSIONS.includes(item))) return res.status(400).json({ error: "يوجد صلاحية غير صحيحة" });

    const oldResult = await pool.query(`SELECT id, roles, permissions, is_active FROM users WHERE id = $1`, [id]);
    if (!oldResult.rows.length) return res.status(404).json({ error: "المستخدم غير موجود" });
    const oldValue = oldResult.rows[0];

    if (Number(id) === Number(req.user?.id) && !roles.includes("admin") && !permissions.includes("permissions.manage") && !permissions.includes("users.manage_permissions")) {
      return res.status(400).json({ error: "لا يمكنك إزالة صلاحياتك الحرجة من حسابك الحالي" });
    }

    if (oldValue.roles?.includes("admin") && !roles.includes("admin")) {
      const adminCount = await pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE roles @> ARRAY['admin']::text[] AND id <> $1 AND COALESCE(is_active,true)=true`, [id]);
      if (adminCount.rows[0].count < 1) return res.status(400).json({ error: "لا يمكن إزالة آخر مدير للنظام" });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET role = $1,
          roles = $2::text[],
          permissions = $3::text[],
          is_active = COALESCE($4, is_active)
      WHERE id = $5
      RETURNING id, full_name, email, employee_number, employee_id, role, roles, permissions, is_active, created_at
      `,
      [roles[0], roles, permissions, typeof isActive === "boolean" ? isActive : null, id]
    );

    await writePermissionLog(req.user?.id, id, "تم تعديل الصلاحيات", oldValue, result.rows[0]);
    res.status(200).json({ message: "تم تحديث صلاحيات المستخدم بنجاح", user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMyAccess = async (req, res) => {
  try {
    const access = await getUserAccess(req.user.id, req.user);
    res.status(200).json({ roles: access.roles, permissions: access.permissions, employee_id: access.employee_id, employee_number: access.employee_number });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getUsers, createUser, updateUserAccess, getMyAccess };
