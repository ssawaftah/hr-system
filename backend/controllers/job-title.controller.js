const pool = require("../db");
const {
  PERMISSION_DEFINITIONS,
  ensurePermissionSchema,
  getEmployeePermissionSummary,
  normalizeArray,
  hasPermissionValue,
} = require("../services/permission.service");

const unique = (items) => Array.from(new Set(normalizeArray(items)));

const getAccess = async (req) => {
  const { getUserAccess } = require("../services/permission.service");
  return getUserAccess(req.user.id, req.user);
};

const requirePermission = async (req, res, permission) => {
  const access = await getAccess(req);
  if (!hasPermissionValue(access, permission)) {
    res.status(403).json({ error: "لا تملك صلاحية تنفيذ هذا الإجراء" });
    return null;
  }
  return access;
};

const logPermissionChange = async ({ req, targetType, targetId, changeType, oldValue = null, newValue = null, reason = null }) => {
  await pool.query(
    `INSERT INTO permission_audit_logs
     (actor_user_id, actor_employee_id, actor_name, target_type, target_id, change_type, old_value, new_value, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)`,
    [
      req.user?.id || null,
      req.user?.employee_id || null,
      req.user?.full_name || null,
      targetType,
      targetId || null,
      changeType,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      reason,
    ]
  );
};

const groupPermissionDefinitions = () => {
  return PERMISSION_DEFINITIONS.reduce((groups, permission) => {
    if (!groups[permission.module]) groups[permission.module] = [];
    groups[permission.module].push(permission);
    return groups;
  }, {});
};

const getPermissionDefinitions = async (req, res) => {
  try {
    await ensurePermissionSchema();
    const access = await requirePermission(req, res, "permissions.view");
    if (!access) return;
    res.status(200).json({ permissions: PERMISSION_DEFINITIONS, groups: groupPermissionDefinitions() });
  } catch (error) {
    res.status(500).json({ error: "حدث خطأ أثناء جلب الصلاحيات" });
  }
};

const getJobTitles = async (req, res) => {
  try {
    await ensurePermissionSchema();
    const access = await requirePermission(req, res, "job_titles.view");
    if (!access) return;
    const result = await pool.query(
      `SELECT jt.*, COUNT(e.id)::int AS employees_count
       FROM job_titles jt
       LEFT JOIN employees e ON e.job_title_id = jt.id
       GROUP BY jt.id
       ORDER BY CASE WHEN jt.status='active' THEN 0 ELSE 1 END, jt.name ASC`
    );
    res.status(200).json({ job_titles: result.rows, permissions: PERMISSION_DEFINITIONS, groups: groupPermissionDefinitions() });
  } catch (error) {
    res.status(500).json({ error: error.message || "حدث خطأ أثناء جلب المسميات الوظيفية" });
  }
};

const createJobTitle = async (req, res) => {
  try {
    await ensurePermissionSchema();
    const access = await requirePermission(req, res, "job_titles.create");
    if (!access) return;
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "اسم المسمى الوظيفي مطلوب" });
    const permissions = unique(req.body.default_permissions || req.body.permissions || []);
    const duplicate = await pool.query(`SELECT id FROM job_titles WHERE LOWER(name)=LOWER($1) AND status <> 'archived' LIMIT 1`, [name]);
    if (duplicate.rows.length) return res.status(400).json({ error: "يوجد مسمى وظيفي بنفس الاسم" });
    const result = await pool.query(
      `INSERT INTO job_titles (name, code, description, default_permissions, status, created_by, updated_at)
       VALUES ($1,$2,$3,$4::text[],$5,$6,CURRENT_TIMESTAMP) RETURNING *`,
      [name, req.body.code || null, req.body.description || null, permissions, req.body.status || "active", req.user?.id || null]
    );
    await logPermissionChange({ req, targetType: "job_title", targetId: result.rows[0].id, changeType: "تم إنشاء مسمى وظيفي", newValue: result.rows[0] });
    res.status(201).json({ message: "تم إنشاء المسمى الوظيفي بنجاح", job_title: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message || "حدث خطأ أثناء إنشاء المسمى الوظيفي" });
  }
};

const updateJobTitle = async (req, res) => {
  try {
    await ensurePermissionSchema();
    const access = await requirePermission(req, res, "job_titles.update");
    if (!access) return;
    const id = Number(req.params.id);
    const old = await pool.query(`SELECT * FROM job_titles WHERE id=$1`, [id]);
    if (!old.rows.length) return res.status(404).json({ error: "المسمى الوظيفي غير موجود" });
    const name = String(req.body.name || old.rows[0].name || "").trim();
    if (!name) return res.status(400).json({ error: "اسم المسمى الوظيفي مطلوب" });
    const permissions = Object.prototype.hasOwnProperty.call(req.body, "default_permissions") || Object.prototype.hasOwnProperty.call(req.body, "permissions")
      ? unique(req.body.default_permissions || req.body.permissions || [])
      : unique(old.rows[0].default_permissions);
    const duplicate = await pool.query(`SELECT id FROM job_titles WHERE LOWER(name)=LOWER($1) AND id <> $2 AND status <> 'archived' LIMIT 1`, [name, id]);
    if (duplicate.rows.length) return res.status(400).json({ error: "يوجد مسمى وظيفي بنفس الاسم" });
    const result = await pool.query(
      `UPDATE job_titles
       SET name=$1, code=$2, description=$3, default_permissions=$4::text[], status=$5, updated_at=CURRENT_TIMESTAMP
       WHERE id=$6 RETURNING *`,
      [name, req.body.code || old.rows[0].code || null, req.body.description ?? old.rows[0].description, permissions, req.body.status || old.rows[0].status || "active", id]
    );
    await pool.query(`UPDATE employees SET job_title_name=$1 WHERE job_title_id=$2`, [result.rows[0].name, id]);
    await logPermissionChange({ req, targetType: "job_title", targetId: id, changeType: "تم تعديل صلاحيات المسمى", oldValue: old.rows[0], newValue: result.rows[0] });
    res.status(200).json({ message: "تم تعديل المسمى الوظيفي بنجاح", job_title: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message || "حدث خطأ أثناء تعديل المسمى الوظيفي" });
  }
};

const disableJobTitle = async (req, res) => {
  try {
    await ensurePermissionSchema();
    const access = await requirePermission(req, res, "job_titles.disable");
    if (!access) return;
    const id = Number(req.params.id);
    const old = await pool.query(`SELECT * FROM job_titles WHERE id=$1`, [id]);
    if (!old.rows.length) return res.status(404).json({ error: "المسمى الوظيفي غير موجود" });
    if (normalizeArray(old.rows[0].default_permissions).includes("system.admin")) {
      const admins = await pool.query(`SELECT COUNT(*)::int AS count FROM job_titles WHERE id <> $1 AND status='active' AND 'system.admin' = ANY(default_permissions)`, [id]);
      if (admins.rows[0].count <= 0) return res.status(400).json({ error: "لا يمكن تنفيذ هذا الإجراء لأنه قد يؤدي إلى فقدان صلاحيات الإدارة الأساسية." });
    }
    const result = await pool.query(`UPDATE job_titles SET status='inactive', updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [id]);
    await logPermissionChange({ req, targetType: "job_title", targetId: id, changeType: "تم تعطيل مسمى وظيفي", oldValue: old.rows[0], newValue: result.rows[0] });
    res.status(200).json({ message: "تم تعطيل المسمى الوظيفي بنجاح", job_title: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message || "حدث خطأ أثناء تعطيل المسمى الوظيفي" });
  }
};

const deleteJobTitle = async (req, res) => {
  try {
    await ensurePermissionSchema();
    const access = await requirePermission(req, res, "job_titles.delete");
    if (!access) return;
    const id = Number(req.params.id);
    const old = await pool.query(`SELECT * FROM job_titles WHERE id=$1`, [id]);
    if (!old.rows.length) return res.status(404).json({ error: "المسمى الوظيفي غير موجود" });
    const used = await pool.query(`SELECT COUNT(*)::int AS count FROM employees WHERE job_title_id=$1`, [id]);
    if (used.rows[0].count > 0) {
      const result = await pool.query(`UPDATE job_titles SET status='archived', updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [id]);
      await logPermissionChange({ req, targetType: "job_title", targetId: id, changeType: "تم أرشفة مسمى وظيفي", oldValue: old.rows[0], newValue: result.rows[0] });
      return res.status(200).json({ message: "المسمى مرتبط بموظفين، لذلك تم أرشفته بدلاً من حذفه", job_title: result.rows[0] });
    }
    await pool.query(`DELETE FROM job_titles WHERE id=$1`, [id]);
    await logPermissionChange({ req, targetType: "job_title", targetId: id, changeType: "تم حذف مسمى وظيفي", oldValue: old.rows[0] });
    res.status(200).json({ message: "تم حذف المسمى الوظيفي بنجاح" });
  } catch (error) {
    res.status(500).json({ error: error.message || "حدث خطأ أثناء حذف المسمى الوظيفي" });
  }
};

const getEmployeePermissions = async (req, res) => {
  try {
    await ensurePermissionSchema();
    const access = await requirePermission(req, res, "employee_permissions.view");
    if (!access) return;
    const summary = await getEmployeePermissionSummary(Number(req.params.employeeId));
    if (!summary) return res.status(404).json({ error: "لا يوجد حساب دخول مرتبط بهذا الموظف" });
    res.status(200).json({ summary, permissions: PERMISSION_DEFINITIONS, groups: groupPermissionDefinitions() });
  } catch (error) {
    res.status(500).json({ error: error.message || "حدث خطأ أثناء جلب صلاحيات الموظف" });
  }
};

const updateEmployeePermissions = async (req, res) => {
  try {
    await ensurePermissionSchema();
    const access = await requirePermission(req, res, "employee_permissions.manage");
    if (!access) return;
    const employeeId = Number(req.params.employeeId);
    const oldSummary = await getEmployeePermissionSummary(employeeId);
    if (!oldSummary) return res.status(404).json({ error: "لا يوجد حساب دخول مرتبط بهذا الموظف" });
    const directPermissions = Object.prototype.hasOwnProperty.call(req.body, "direct_permissions") ? unique(req.body.direct_permissions) : oldSummary.direct_permissions;
    const deniedPermissions = Object.prototype.hasOwnProperty.call(req.body, "denied_permissions") ? unique(req.body.denied_permissions) : oldSummary.denied_permissions;
    const roles = Object.prototype.hasOwnProperty.call(req.body, "roles") ? unique(req.body.roles) : oldSummary.roles;

    if (oldSummary.roles.includes("admin") && deniedPermissions.some((p) => ["system.admin", "permissions.manage", "employee_permissions.manage"].includes(p))) {
      const admins = await pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE id <> $1 AND ('admin' = ANY(COALESCE(roles, ARRAY[]::text[])) OR role='admin')`, [oldSummary.user_id]);
      if (admins.rows[0].count <= 0) return res.status(400).json({ error: "لا يمكن تنفيذ هذا الإجراء لأنه قد يؤدي إلى فقدان صلاحيات الإدارة الأساسية." });
    }

    const result = await pool.query(
      `UPDATE users SET roles=$1::text[], role=$2, permissions=$3::text[], direct_denied_permissions=$4::text[] WHERE id=$5 RETURNING id`,
      [roles, roles[0] || "employee", directPermissions, deniedPermissions, oldSummary.user_id]
    );
    const newSummary = await getEmployeePermissionSummary(employeeId);
    await logPermissionChange({ req, targetType: "employee", targetId: employeeId, changeType: "تم تعديل صلاحيات الموظف", oldValue: oldSummary, newValue: newSummary });
    res.status(200).json({ message: "تم تحديث صلاحيات الموظف بنجاح", summary: newSummary });
  } catch (error) {
    res.status(500).json({ error: error.message || "حدث خطأ أثناء تحديث صلاحيات الموظف" });
  }
};

const getPermissionLogs = async (req, res) => {
  try {
    await ensurePermissionSchema();
    const access = await requirePermission(req, res, "permissions.view_logs");
    if (!access) return;
    const result = await pool.query(`SELECT * FROM permission_audit_logs ORDER BY id DESC LIMIT 100`);
    res.status(200).json({ logs: result.rows });
  } catch (error) {
    res.status(500).json({ error: "حدث خطأ أثناء جلب سجل الصلاحيات" });
  }
};

module.exports = { getPermissionDefinitions, getJobTitles, createJobTitle, updateJobTitle, disableJobTitle, deleteJobTitle, getEmployeePermissions, updateEmployeePermissions, getPermissionLogs };
