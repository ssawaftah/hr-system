const pool = require("../db");
const bcrypt = require("bcrypt");
const { PERMISSIONS, ensurePermissionSchema, normalizeArray, getUserAccess } = require("../services/permission.service");

const getUsers = async (req, res) => {
  try {
    await ensurePermissionSchema();
    const result = await pool.query(`
      SELECT id, full_name, email, role, roles, permissions, is_active, created_at
      FROM users
      ORDER BY id ASC
    `);
    res.status(200).json({ users: result.rows, available_permissions: PERMISSIONS });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    await ensurePermissionSchema();
    const { full_name, email, password, role } = req.body;
    const roles = normalizeArray(req.body.roles || role);
    const permissions = normalizeArray(req.body.permissions);

    if (!full_name || !email || !password || !roles.length) return res.status(400).json({ error: "جميع الحقول مطلوبة" });

    const allowedRoles = ["admin", "hr", "employee"];
    if (roles.some((item) => !allowedRoles.includes(item))) return res.status(400).json({ error: "يوجد دور غير صحيح" });
    if (permissions.some((item) => !PERMISSIONS.includes(item))) return res.status(400).json({ error: "يوجد صلاحية غير صحيحة" });

    const existingUser = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existingUser.rows.length > 0) return res.status(400).json({ error: "البريد الإلكتروني مستخدم مسبقًا" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const primaryRole = roles[0];
    const result = await pool.query(
      `
      INSERT INTO users (full_name, email, password_hash, role, roles, permissions)
      VALUES ($1, $2, $3, $4, $5::text[], $6::text[])
      RETURNING id, full_name, email, role, roles, permissions, is_active, created_at
      `,
      [full_name, email, hashedPassword, primaryRole, roles, permissions]
    );

    res.status(201).json({ message: "تم إنشاء المستخدم بنجاح", user: result.rows[0] });
  } catch (error) {
    console.error(error.message);
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

    const allowedRoles = ["admin", "hr", "employee"];
    if (!roles.length) return res.status(400).json({ error: "يجب اختيار دور واحد على الأقل" });
    if (roles.some((item) => !allowedRoles.includes(item))) return res.status(400).json({ error: "يوجد دور غير صحيح" });
    if (permissions.some((item) => !PERMISSIONS.includes(item))) return res.status(400).json({ error: "يوجد صلاحية غير صحيحة" });

    const result = await pool.query(
      `
      UPDATE users
      SET role = $1,
          roles = $2::text[],
          permissions = $3::text[],
          is_active = COALESCE($4, is_active)
      WHERE id = $5
      RETURNING id, full_name, email, role, roles, permissions, is_active, created_at
      `,
      [roles[0], roles, permissions, typeof isActive === "boolean" ? isActive : null, id]
    );

    if (!result.rows.length) return res.status(404).json({ error: "المستخدم غير موجود" });
    res.status(200).json({ message: "تم تحديث صلاحيات المستخدم بنجاح", user: result.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
};

const getMyAccess = async (req, res) => {
  try {
    const access = await getUserAccess(req.user.id, req.user);
    res.status(200).json({ roles: access.roles, permissions: access.permissions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getUsers, createUser, updateUserAccess, getMyAccess };
