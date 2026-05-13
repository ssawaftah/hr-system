const pool = require("../db");
const { getUserAccess, hasPermissionValue } = require("../services/permission.service");

let schemaReady = false;
let schemaPromise = null;

const ensureAnnouncementSchema = async () => {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(220) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(30) NOT NULL DEFAULT 'general',
        target_type VARCHAR(30) NOT NULL DEFAULT 'all',
        target_department_id INTEGER,
        target_department_name VARCHAR(160),
        target_employee_id INTEGER,
        target_employee_name VARCHAR(160),
        publisher_employee_id INTEGER,
        publisher_name VARCHAR(160),
        publisher_job_title VARCHAR(160),
        status VARCHAR(30) DEFAULT 'published',
        start_date DATE NOT NULL DEFAULT CURRENT_DATE,
        end_date DATE,
        is_active BOOLEAN DEFAULT true,
        created_by_user_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP,
        deleted_at TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS announcements_visibility_idx ON announcements(status, is_active, start_date, end_date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS announcements_department_idx ON announcements(target_department_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS announcements_employee_idx ON announcements(target_employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS announcements_publisher_idx ON announcements(publisher_employee_id)`);
    schemaReady = true;
  })().catch((error) => { schemaReady = false; throw error; }).finally(() => { schemaPromise = null; });
  return schemaPromise;
};

const normalizeDate = (value) => value ? String(value).slice(0, 10) : null;
const isAdmin = (access) => access.roles?.includes("admin") || hasPermissionValue(access, "system.admin");
const can = (access, permission) => isAdmin(access) || hasPermissionValue(access, permission) || hasPermissionValue(access, "announcements.manage");

const getCurrentEmployee = async (req) => {
  const result = await pool.query(
    `SELECT u.id AS user_id, u.full_name AS user_name, u.employee_id, e.full_name, e.job_title, e.job_title_name, e.department_id
     FROM users u
     LEFT JOIN employees e ON e.id = u.employee_id
     WHERE u.id = $1 LIMIT 1`,
    [req.user.id]
  );
  const row = result.rows[0] || {};
  return {
    userId: row.user_id || req.user.id,
    employeeId: row.employee_id || null,
    name: row.full_name || row.user_name || req.user.full_name || "مدير النظام",
    jobTitle: row.job_title_name || row.job_title || (req.user.role === "admin" ? "مدير النظام" : "موظف"),
    departmentId: row.department_id || null,
  };
};

const getEmployeeDepartmentIds = async (employeeId, fallbackDepartmentId = null) => {
  const ids = new Set();
  if (fallbackDepartmentId) ids.add(Number(fallbackDepartmentId));
  if (!employeeId) return Array.from(ids);
  try {
    const result = await pool.query(`SELECT department_id FROM employee_departments WHERE employee_id=$1 AND COALESCE(status,'active')='active'`, [employeeId]);
    result.rows.forEach((row) => row.department_id && ids.add(Number(row.department_id)));
  } catch (_) {}
  return Array.from(ids);
};

const loadTargetSnapshot = async ({ targetType, departmentId, employeeId }) => {
  let targetDepartmentName = null;
  let targetEmployeeName = null;
  if (departmentId) {
    const d = await pool.query(`SELECT name FROM departments WHERE id=$1 LIMIT 1`, [departmentId]);
    if (!d.rows.length) throw new Error("القسم غير موجود");
    targetDepartmentName = d.rows[0].name;
  }
  if (targetType === "employee") {
    const e = await pool.query(`SELECT id, full_name, department_id FROM employees WHERE id=$1 LIMIT 1`, [employeeId]);
    if (!e.rows.length) throw new Error("الموظف غير موجود");
    targetEmployeeName = e.rows[0].full_name;
    if (!departmentId && e.rows[0].department_id) targetDepartmentName = (await pool.query(`SELECT name FROM departments WHERE id=$1 LIMIT 1`, [e.rows[0].department_id])).rows[0]?.name || null;
  }
  return { targetDepartmentName, targetEmployeeName };
};

const validateAnnouncementPayload = (body) => {
  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  const type = body.type || "general";
  const targetType = body.target_type || body.targetType || (type === "general" ? "all" : "department");
  const startDate = normalizeDate(body.start_date || body.startDate) || new Date().toISOString().slice(0, 10);
  const endDate = normalizeDate(body.end_date || body.endDate);
  if (!title) return "عنوان الإعلان مطلوب";
  if (!content) return "نص الإعلان مطلوب";
  if (!['general', 'private'].includes(type)) return "يرجى اختيار نوع الإعلان";
  if (!['all', 'department', 'employee'].includes(targetType)) return "يرجى اختيار الجمهور المستهدف";
  if (type === "general" && targetType !== "all" && targetType !== "department") return "نوع الاستهداف غير صحيح للإعلان العام";
  if (type === "private" && targetType === "all") return "الإعلان الخاص يجب أن يستهدف قسمًا أو موظفًا";
  if (targetType === "department" && !body.target_department_id && !body.targetDepartmentId) return "يرجى اختيار القسم";
  if (targetType === "employee" && (!body.target_department_id && !body.targetDepartmentId || !body.target_employee_id && !body.targetEmployeeId)) return "يرجى اختيار القسم والموظف";
  if (endDate && endDate < startDate) return "تاريخ النهاية لا يمكن أن يكون قبل تاريخ البداية";
  return null;
};

const canCreateForTarget = async ({ access, actor, type, targetType, departmentId }) => {
  if (isAdmin(access) || hasPermissionValue(access, "announcements.manage")) return true;
  if (type === "general" && targetType === "all") return hasPermissionValue(access, "announcements.create.general.company") || hasPermissionValue(access, "announcements.publish");
  if (type === "general" && targetType === "department") return hasPermissionValue(access, "announcements.create.general.department");
  if (type === "private" && targetType === "department") {
    if (hasPermissionValue(access, "announcements.create.private.all_departments")) return true;
    if (!hasPermissionValue(access, "announcements.create.private.department")) return false;
  }
  if (type === "private" && targetType === "employee") {
    if (hasPermissionValue(access, "announcements.create.private.all_departments")) return true;
    if (!hasPermissionValue(access, "announcements.create.private.employee")) return false;
  }
  const actorDepartments = await getEmployeeDepartmentIds(actor.employeeId, actor.departmentId);
  return departmentId ? actorDepartments.includes(Number(departmentId)) : false;
};

const mapAnnouncement = (row) => ({
  id: row.id,
  title: row.title,
  content: row.content,
  type: row.type,
  announcement_type_label: row.type === "general" ? "إعلان عام" : "إعلان خاص",
  target_type: row.target_type,
  target_department_id: row.target_department_id,
  target_department_name: row.target_department_name,
  target_employee_id: row.target_employee_id,
  target_employee_name: row.target_employee_name,
  publisher_employee_id: row.publisher_employee_id,
  publisher_name: row.publisher_name,
  publisher_job_title: row.publisher_job_title,
  status: row.status,
  start_date: row.start_date,
  end_date: row.end_date,
  is_active: row.is_active,
  created_at: row.created_at,
  updated_at: row.updated_at,
  published_at: row.published_at,
});

const getVisibleAnnouncements = async (req, res) => {
  try {
    await ensureAnnouncementSchema();
    const access = await getUserAccess(req.user.id, req.user);
    const actor = await getCurrentEmployee(req);
    const departmentIds = await getEmployeeDepartmentIds(actor.employeeId, actor.departmentId);
    const params = [actor.employeeId || 0, departmentIds];
    const includeAll = can(access, "announcements.view.all");
    const whereVisibility = includeAll
      ? "TRUE"
      : `(a.target_type='all' OR (a.target_type='employee' AND a.target_employee_id=$1) OR (a.target_type='department' AND a.target_department_id = ANY($2::int[])))`;
    const result = await pool.query(
      `SELECT a.* FROM announcements a
       WHERE a.is_active=true AND a.status='published' AND a.deleted_at IS NULL
         AND a.start_date <= CURRENT_DATE AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
         AND ${whereVisibility}
       ORDER BY COALESCE(a.published_at, a.created_at) DESC
       LIMIT 20`,
      params
    );
    res.status(200).json({ announcements: result.rows.map(mapAnnouncement) });
  } catch (error) {
    res.status(500).json({ error: error.message || "حدث خطأ أثناء تحميل الإعلانات" });
  }
};

const getAnnouncements = async (req, res) => {
  try {
    await ensureAnnouncementSchema();
    const access = await getUserAccess(req.user.id, req.user);
    const actor = await getCurrentEmployee(req);
    const departmentIds = await getEmployeeDepartmentIds(actor.employeeId, actor.departmentId);
    const params = [];
    const filters = [`a.deleted_at IS NULL`];
    if (req.query.type) { params.push(req.query.type); filters.push(`a.type=$${params.length}`); }
    if (req.query.status) { params.push(req.query.status); filters.push(`a.status=$${params.length}`); }
    if (!can(access, "announcements.view.all")) {
      params.push(actor.employeeId || 0, departmentIds, actor.userId);
      filters.push(`(a.created_by_user_id=$${params.length} OR a.target_type='all' OR (a.target_type='employee' AND a.target_employee_id=$${params.length - 2}) OR (a.target_type='department' AND a.target_department_id = ANY($${params.length - 1}::int[])))`);
    }
    const result = await pool.query(`SELECT a.* FROM announcements a WHERE ${filters.join(" AND ")} ORDER BY a.created_at DESC LIMIT 100`, params);
    res.status(200).json({ announcements: result.rows.map(mapAnnouncement) });
  } catch (error) {
    res.status(500).json({ error: error.message || "حدث خطأ أثناء تحميل الإعلانات" });
  }
};

const createAnnouncement = async (req, res) => {
  try {
    await ensureAnnouncementSchema();
    const access = await getUserAccess(req.user.id, req.user, { force: true });
    const actor = await getCurrentEmployee(req);
    const validation = validateAnnouncementPayload(req.body);
    if (validation) return res.status(400).json({ error: validation });
    const title = String(req.body.title).trim();
    const content = String(req.body.content).trim();
    const type = req.body.type || "general";
    const targetType = req.body.target_type || req.body.targetType || (type === "general" ? "all" : "department");
    const departmentId = req.body.target_department_id || req.body.targetDepartmentId || null;
    const employeeId = req.body.target_employee_id || req.body.targetEmployeeId || null;
    const startDate = normalizeDate(req.body.start_date || req.body.startDate) || new Date().toISOString().slice(0, 10);
    const endDate = normalizeDate(req.body.end_date || req.body.endDate);
    const allowed = await canCreateForTarget({ access, actor, type, targetType, departmentId });
    if (!allowed) return res.status(403).json({ error: "لا تملك صلاحية تنفيذ هذا الإجراء" });
    const target = await loadTargetSnapshot({ targetType, departmentId, employeeId });
    const status = req.body.status === "draft" ? "draft" : "published";
    const result = await pool.query(
      `INSERT INTO announcements
       (title, content, type, target_type, target_department_id, target_department_name, target_employee_id, target_employee_name,
        publisher_employee_id, publisher_name, publisher_job_title, status, start_date, end_date, is_active, created_by_user_id, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,$15,$16)
       RETURNING *`,
      [title, content, type, targetType, departmentId || null, target.targetDepartmentName, employeeId || null, target.targetEmployeeName, actor.employeeId, actor.name, actor.jobTitle, status, startDate, endDate, req.user.id, status === "published" ? new Date() : null]
    );
    res.status(201).json({ message: status === "draft" ? "تم حفظ الإعلان كمسودة" : "تم نشر الإعلان بنجاح", announcement: mapAnnouncement(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message || "حدث خطأ أثناء حفظ الإعلان" });
  }
};

const updateAnnouncement = async (req, res) => {
  try {
    await ensureAnnouncementSchema();
    const access = await getUserAccess(req.user.id, req.user, { force: true });
    const oldResult = await pool.query(`SELECT * FROM announcements WHERE id=$1 AND deleted_at IS NULL`, [req.params.id]);
    if (!oldResult.rows.length) return res.status(404).json({ error: "الإعلان غير موجود" });
    const old = oldResult.rows[0];
    const canUpdate = isAdmin(access) || hasPermissionValue(access, "announcements.manage") || hasPermissionValue(access, "announcements.update.all") || (old.created_by_user_id === req.user.id && hasPermissionValue(access, "announcements.update.own"));
    if (!canUpdate) return res.status(403).json({ error: "لا تملك صلاحية تنفيذ هذا الإجراء" });
    const merged = { ...old, ...req.body };
    const validation = validateAnnouncementPayload(merged);
    if (validation) return res.status(400).json({ error: validation });
    const type = req.body.type || old.type;
    const targetType = req.body.target_type || old.target_type;
    const departmentId = req.body.target_department_id ?? old.target_department_id;
    const employeeId = req.body.target_employee_id ?? old.target_employee_id;
    const target = await loadTargetSnapshot({ targetType, departmentId, employeeId });
    const status = req.body.status || old.status;
    const result = await pool.query(
      `UPDATE announcements SET title=$1, content=$2, type=$3, target_type=$4, target_department_id=$5, target_department_name=$6,
       target_employee_id=$7, target_employee_name=$8, status=$9, start_date=$10, end_date=$11, is_active=$12, updated_at=CURRENT_TIMESTAMP,
       published_at=CASE WHEN $9='published' AND published_at IS NULL THEN CURRENT_TIMESTAMP ELSE published_at END
       WHERE id=$13 RETURNING *`,
      [req.body.title || old.title, req.body.content || old.content, type, targetType, departmentId || null, target.targetDepartmentName || old.target_department_name, employeeId || null, target.targetEmployeeName || old.target_employee_name, status, normalizeDate(req.body.start_date || old.start_date), normalizeDate(req.body.end_date || old.end_date), req.body.is_active === undefined ? old.is_active : req.body.is_active, req.params.id]
    );
    res.status(200).json({ message: "تم تعديل الإعلان بنجاح", announcement: mapAnnouncement(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message || "حدث خطأ أثناء تعديل الإعلان" });
  }
};

const archiveAnnouncement = async (req, res) => {
  try {
    await ensureAnnouncementSchema();
    const access = await getUserAccess(req.user.id, req.user, { force: true });
    const oldResult = await pool.query(`SELECT * FROM announcements WHERE id=$1 AND deleted_at IS NULL`, [req.params.id]);
    if (!oldResult.rows.length) return res.status(404).json({ error: "الإعلان غير موجود" });
    const old = oldResult.rows[0];
    const canDelete = isAdmin(access) || hasPermissionValue(access, "announcements.manage") || hasPermissionValue(access, "announcements.delete.all") || (old.created_by_user_id === req.user.id && hasPermissionValue(access, "announcements.delete.own"));
    if (!canDelete) return res.status(403).json({ error: "لا تملك صلاحية تنفيذ هذا الإجراء" });
    const result = await pool.query(`UPDATE announcements SET status='archived', is_active=false, deleted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [req.params.id]);
    res.status(200).json({ message: "تم أرشفة الإعلان بنجاح", announcement: mapAnnouncement(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message || "حدث خطأ أثناء أرشفة الإعلان" });
  }
};

module.exports = { ensureAnnouncementSchema, getVisibleAnnouncements, getAnnouncements, createAnnouncement, updateAnnouncement, archiveAnnouncement };
