const pool = require("../db");

const todayIso = () => new Date().toISOString().split("T")[0];
const getActorId = (req) => req.user?.id || null;
const dayKeys = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"];

const normalizeBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return Boolean(value);
};

const normalizeDays = (value) => {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  const days = source.map((item) => String(item).trim()).filter((item) => dayKeys.includes(item));
  return [...new Set(days.length ? days : ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday"])];
};

const normalizeEmployeeIds = (body) => {
  const raw = Array.isArray(body.employee_ids) ? body.employee_ids : body.employee_id ? [body.employee_id] : [];
  return [...new Set(raw.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
};

const getShiftPayload = (body) => {
  const shiftType = body.shift_type || "custom";
  const isDefault = normalizeBoolean(body.is_default, shiftType === "default");
  return {
    name: (body.name || "").trim(),
    shift_type: isDefault ? "default" : shiftType,
    start_time: body.start_time || null,
    end_time: body.end_time || null,
    work_days: normalizeDays(body.work_days),
    effective_from: body.effective_from || todayIso(),
    effective_to: body.effective_to || null,
    repeats_weekly: normalizeBoolean(body.repeats_weekly, true),
    late_grace_minutes: Number(body.late_grace_minutes || 0),
    absent_after_minutes: Number(body.absent_after_minutes || 180),
    official_work_hours: Number(body.official_work_hours || 8),
    notes: body.notes || null,
    is_active: normalizeBoolean(body.is_active, true),
    is_default: isDefault,
  };
};

const ensureDefaultShift = async (client = pool) => {
  const existing = await client.query(`SELECT * FROM work_shifts WHERE is_default = true AND is_active = true ORDER BY id ASC LIMIT 1`);
  if (existing.rows.length) return existing.rows[0];
  const created = await client.query(
    `INSERT INTO work_shifts (name, shift_type, start_time, end_time, work_days, effective_from, repeats_weekly, late_grace_minutes, absent_after_minutes, official_work_hours, notes, is_active, is_default, updated_at)
     VALUES ('الدوام الافتراضي', 'default', '07:00', '15:00', '["saturday","sunday","monday","tuesday","wednesday","thursday"]'::jsonb, CURRENT_DATE, true, 0, 180, 8, 'يطبق تلقائيًا على الموظفين غير المرتبطين بشفت مخصص', true, true, CURRENT_TIMESTAMP)
     RETURNING *`
  );
  return created.rows[0];
};

const ensureShiftSchema = async (client = pool) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS work_shifts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      start_time TIME NOT NULL DEFAULT '07:00',
      end_time TIME NOT NULL DEFAULT '15:00',
      late_grace_minutes INTEGER DEFAULT 0,
      absent_after_minutes INTEGER DEFAULT 180,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`ALTER TABLE work_shifts ADD COLUMN IF NOT EXISTS shift_type VARCHAR(30) DEFAULT 'custom'`);
  await client.query(`ALTER TABLE work_shifts ADD COLUMN IF NOT EXISTS work_days JSONB DEFAULT '["saturday","sunday","monday","tuesday","wednesday","thursday"]'::jsonb`);
  await client.query(`ALTER TABLE work_shifts ADD COLUMN IF NOT EXISTS effective_from DATE DEFAULT CURRENT_DATE`);
  await client.query(`ALTER TABLE work_shifts ADD COLUMN IF NOT EXISTS effective_to DATE`);
  await client.query(`ALTER TABLE work_shifts ADD COLUMN IF NOT EXISTS repeats_weekly BOOLEAN DEFAULT true`);
  await client.query(`ALTER TABLE work_shifts ADD COLUMN IF NOT EXISTS official_work_hours NUMERIC(5,2) DEFAULT 8`);
  await client.query(`ALTER TABLE work_shifts ADD COLUMN IF NOT EXISTS notes TEXT`);
  await client.query(`ALTER TABLE work_shifts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
  await client.query(`ALTER TABLE work_shifts ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS employee_shift_assignments (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      shift_id INTEGER NOT NULL REFERENCES work_shifts(id) ON DELETE RESTRICT,
      effective_from DATE DEFAULT CURRENT_DATE,
      effective_to DATE,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`ALTER TABLE employee_shift_assignments ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP`);
  await client.query(`ALTER TABLE employee_shift_assignments ADD COLUMN IF NOT EXISTS removal_reason TEXT`);

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

  await client.query(`CREATE INDEX IF NOT EXISTS employee_shift_assignments_employee_idx ON employee_shift_assignments(employee_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS employee_shift_assignments_shift_idx ON employee_shift_assignments(shift_id)`);
  await client.query(`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY updated_at DESC NULLS LAST, id DESC) AS rn
      FROM employee_shift_assignments
      WHERE is_active = true AND effective_to IS NULL
    )
    UPDATE employee_shift_assignments esa
    SET is_active=false,
        effective_to=CURRENT_DATE,
        removed_at=CURRENT_TIMESTAMP,
        removal_reason='تنظيف تلقائي لتكرار ارتباط مفتوح',
        updated_at=CURRENT_TIMESTAMP
    FROM ranked r
    WHERE esa.id=r.id AND r.rn > 1
  `);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS employee_shift_one_open_assignment_idx ON employee_shift_assignments(employee_id) WHERE is_active = true AND effective_to IS NULL`);
  await client.query(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY id ASC) AS rn FROM work_shifts WHERE is_default = true AND is_active = true
    )
    UPDATE work_shifts SET is_default = false WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
  `);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS work_shifts_one_active_default_idx ON work_shifts(is_default) WHERE is_default = true AND is_active = true`);
  await ensureDefaultShift(client);
};

const writeAuditLog = async (client, req, action, targetId, oldValue = null, newValue = null) => {
  await client.query(
    `INSERT INTO audit_logs (actor_user_id, target_type, target_id, action, old_value, new_value) VALUES ($1,'shift',$2,$3,$4,$5)`,
    [getActorId(req), targetId, action, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null]
  );
};

const shiftSelectSql = `
  SELECT ws.*,
    COALESCE(active_counts.employee_count, 0)::int AS employee_count,
    COALESCE(active_counts.department_names, '') AS department_names
  FROM work_shifts ws
  LEFT JOIN (
    SELECT esa.shift_id,
      COUNT(DISTINCT esa.employee_id) AS employee_count,
      STRING_AGG(DISTINCT COALESCE(d.name, 'بدون قسم'), '، ') AS department_names
    FROM employee_shift_assignments esa
    JOIN employees e ON e.id = esa.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE esa.is_active = true
    GROUP BY esa.shift_id
  ) active_counts ON active_counts.shift_id = ws.id
`;

const getAssignments = async (client, shiftId = null) => {
  const params = [];
  let where = "";
  if (shiftId) { params.push(shiftId); where = "WHERE esa.shift_id=$1"; }
  const result = await client.query(`
    SELECT esa.id, esa.employee_id, e.full_name AS employee_name, e.employee_number,
      COALESCE(e.job_title_name, e.job_title) AS job_title, e.department_id, d.name AS department_name,
      esa.shift_id, ws.name AS shift_name, ws.shift_type, ws.start_time, ws.end_time, ws.work_days,
      esa.effective_from, esa.effective_to, esa.is_active
    FROM employee_shift_assignments esa
    JOIN employees e ON e.id = esa.employee_id
    JOIN work_shifts ws ON ws.id = esa.shift_id
    LEFT JOIN departments d ON d.id = e.department_id
    ${where}
    ORDER BY esa.is_active DESC, esa.id DESC
  `, params);
  return result.rows;
};

const getEmployeesWithoutActiveShift = async (client) => {
  const result = await client.query(`
    SELECT e.id, e.full_name, e.employee_number, COALESCE(e.job_title_name, e.job_title) AS job_title, e.department_id, d.name AS department_name
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE COALESCE(e.is_active, true) = true
      AND NOT EXISTS (
        SELECT 1 FROM employee_shift_assignments esa
        WHERE esa.employee_id = e.id AND esa.is_active = true AND COALESCE(esa.effective_to, DATE '9999-12-31') >= CURRENT_DATE
      )
    ORDER BY d.name NULLS LAST, e.full_name ASC
  `);
  return result.rows;
};

const getFridayEmployees = async (client) => {
  const result = await client.query(`
    SELECT DISTINCT e.id, e.full_name, e.employee_number, COALESCE(e.job_title_name, e.job_title) AS job_title, d.name AS department_name,
      ws.id AS shift_id, ws.name AS shift_name, esa.effective_from, esa.effective_to
    FROM employee_shift_assignments esa
    JOIN work_shifts ws ON ws.id = esa.shift_id
    JOIN employees e ON e.id = esa.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE esa.is_active = true AND (ws.shift_type = 'friday' OR ws.work_days ? 'friday')
    ORDER BY d.name NULLS LAST, e.full_name ASC
  `);
  return result.rows;
};

const getWeekDistribution = async (client, defaultShift) => {
  const result = await client.query(`
    SELECT e.id AS employee_id, e.full_name, e.employee_number, d.name AS department_name,
      ws.id AS shift_id, ws.name AS shift_name, ws.shift_type, ws.work_days
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN employee_shift_assignments esa ON esa.employee_id = e.id AND esa.is_active = true AND COALESCE(esa.effective_to, DATE '9999-12-31') >= CURRENT_DATE
    LEFT JOIN work_shifts ws ON ws.id = esa.shift_id AND ws.is_active = true
    WHERE COALESCE(e.is_active, true) = true
    ORDER BY d.name NULLS LAST, e.full_name ASC
  `);
  return result.rows.map((row) => {
    const effectiveShift = row.shift_id ? row : defaultShift;
    const workDays = Array.isArray(effectiveShift?.work_days) ? effectiveShift.work_days : [];
    const schedule = dayKeys.reduce((map, day) => ({ ...map, [day]: effectiveShift?.id && workDays.includes(day) ? effectiveShift.name || effectiveShift.shift_name : "-" }), {});
    return { ...row, effective_shift_name: effectiveShift?.name || row.shift_name || "-", is_default_shift_applied: !row.shift_id, schedule };
  });
};

const findConflicts = async (client, employeeIds, shiftId, effectiveFrom, effectiveTo, excludeAssignmentId = null) => {
  if (!employeeIds.length) return [];
  const result = await client.query(
    `SELECT esa.id, esa.employee_id, e.full_name AS employee_name, e.employee_number, ws.name AS shift_name, esa.effective_from, esa.effective_to,
            ws.work_days AS existing_work_days, target.work_days AS target_work_days
     FROM employee_shift_assignments esa
     JOIN employees e ON e.id = esa.employee_id
     JOIN work_shifts ws ON ws.id = esa.shift_id
     JOIN work_shifts target ON target.id = $2::int
     WHERE esa.is_active = true
       AND esa.employee_id = ANY($1::int[])
       AND ($2::int IS NULL OR esa.shift_id <> $2)
       AND ($5::int IS NULL OR esa.id <> $5)
       AND NOT (COALESCE(esa.effective_to, DATE '9999-12-31') < $3::date OR COALESCE($4::date, DATE '9999-12-31') < esa.effective_from)
       AND EXISTS (
         SELECT 1
         FROM jsonb_array_elements_text(ws.work_days) existing_day(day)
         JOIN jsonb_array_elements_text(target.work_days) target_day(day) ON target_day.day = existing_day.day
       )
     ORDER BY e.full_name ASC`,
    [employeeIds, shiftId || null, effectiveFrom || todayIso(), effectiveTo || null, excludeAssignmentId || null]
  );
  return result.rows;
};

const getShifts = async (req, res) => {
  try {
    await ensureShiftSchema();
    const defaultShift = await ensureDefaultShift(pool);
    const shifts = await pool.query(`${shiftSelectSql} ORDER BY ws.is_default DESC, ws.is_active DESC, ws.id ASC`);
    const assignments = await getAssignments(pool);
    const without_shift = await getEmployeesWithoutActiveShift(pool);
    const friday_employees = await getFridayEmployees(pool);
    const week_distribution = await getWeekDistribution(pool, defaultShift);
    res.status(200).json({ shifts: shifts.rows, default_shift: defaultShift, assignments, without_shift, friday_employees, week_distribution });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getShiftById = async (req, res) => {
  try {
    await ensureShiftSchema();
    const { id } = req.params;
    const shift = await pool.query(`${shiftSelectSql} WHERE ws.id=$1`, [id]);
    if (!shift.rows.length) return res.status(404).json({ error: "الشفت غير موجود" });
    const assignments = await getAssignments(pool, id);
    const audit = await pool.query(`SELECT * FROM audit_logs WHERE target_type='shift' AND target_id=$1 ORDER BY id DESC LIMIT 40`, [id]);
    res.status(200).json({ shift: shift.rows[0], assignments, audit_logs: audit.rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const createShift = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureShiftSchema(client);
    const data = getShiftPayload(req.body);
    if (!data.name || !data.start_time || !data.end_time) { await client.query("ROLLBACK"); return res.status(400).json({ error: "اسم الشفت ووقت البداية والنهاية مطلوبة" }); }
    if (data.is_default && data.is_active) await client.query(`UPDATE work_shifts SET is_default=false WHERE is_default=true`);
    const result = await client.query(
      `INSERT INTO work_shifts (name, shift_type, start_time, end_time, work_days, effective_from, effective_to, repeats_weekly, late_grace_minutes, absent_after_minutes, official_work_hours, notes, is_active, is_default, updated_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,CURRENT_TIMESTAMP) RETURNING *`,
      [data.name, data.shift_type, data.start_time, data.end_time, JSON.stringify(data.work_days), data.effective_from, data.effective_to, data.repeats_weekly, data.late_grace_minutes, data.absent_after_minutes, data.official_work_hours, data.notes, data.is_active, data.is_default]
    );
    await writeAuditLog(client, req, data.is_default ? "تم إنشاء الشفت الافتراضي" : "تم إنشاء الشفت", result.rows[0].id, null, result.rows[0]);
    await client.query("COMMIT");
    res.status(201).json({ message: "تم إنشاء الشفت بنجاح", shift: result.rows[0] });
  } catch (error) { await client.query("ROLLBACK"); res.status(500).json({ error: error.message }); } finally { client.release(); }
};

const updateShift = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureShiftSchema(client);
    const { id } = req.params;
    const data = getShiftPayload(req.body);
    if (!data.name || !data.start_time || !data.end_time) { await client.query("ROLLBACK"); return res.status(400).json({ error: "اسم الشفت ووقت البداية والنهاية مطلوبة" }); }
    const oldResult = await client.query(`SELECT * FROM work_shifts WHERE id=$1`, [id]);
    if (!oldResult.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "الشفت غير موجود" }); }
    if (data.is_default && data.is_active) await client.query(`UPDATE work_shifts SET is_default=false WHERE id <> $1`, [id]);
    const result = await client.query(
      `UPDATE work_shifts SET name=$1, shift_type=$2, start_time=$3, end_time=$4, work_days=$5::jsonb, effective_from=$6, effective_to=$7, repeats_weekly=$8, late_grace_minutes=$9, absent_after_minutes=$10, official_work_hours=$11, notes=$12, is_active=$13, is_default=$14, updated_at=CURRENT_TIMESTAMP WHERE id=$15 RETURNING *`,
      [data.name, data.shift_type, data.start_time, data.end_time, JSON.stringify(data.work_days), data.effective_from, data.effective_to, data.repeats_weekly, data.late_grace_minutes, data.absent_after_minutes, data.official_work_hours, data.notes, data.is_active, data.is_default, id]
    );
    await writeAuditLog(client, req, "تم تعديل الشفت - قد يؤثر على الحضور والرواتب", Number(id), oldResult.rows[0], result.rows[0]);
    await client.query("COMMIT");
    res.status(200).json({ message: "تم تعديل الشفت بنجاح. انتبه: تعديل وقت الشفت قد يؤثر على احتساب التأخير والإضافي والرواتب.", shift: result.rows[0] });
  } catch (error) { await client.query("ROLLBACK"); res.status(500).json({ error: error.message }); } finally { client.release(); }
};

const archiveShift = async (req, res) => {
  try {
    await ensureShiftSchema();
    const { id } = req.params;
    const oldResult = await pool.query(`SELECT * FROM work_shifts WHERE id=$1`, [id]);
    if (!oldResult.rows.length) return res.status(404).json({ error: "الشفت غير موجود" });
    if (oldResult.rows[0].is_default) return res.status(409).json({ error: "لا يمكن أرشفة الشفت الافتراضي قبل تعيين شفت افتراضي آخر" });
    const result = await pool.query(`UPDATE work_shifts SET is_active=false, archived_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [id]);
    await writeAuditLog(pool, req, "تم أرشفة الشفت", Number(id), oldResult.rows[0], result.rows[0]);
    res.status(200).json({ message: "تم أرشفة الشفت بنجاح", shift: result.rows[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const deleteShift = async (req, res) => {
  try {
    await ensureShiftSchema();
    const { id } = req.params;
    const oldResult = await pool.query(`SELECT * FROM work_shifts WHERE id=$1`, [id]);
    if (!oldResult.rows.length) return res.status(404).json({ error: "الشفت غير موجود" });
    if (oldResult.rows[0].is_default) return res.status(409).json({ error: "لا يمكن حذف الشفت الافتراضي" });
    const linked = await pool.query(`SELECT COUNT(*)::int AS count FROM employee_shift_assignments WHERE shift_id=$1 AND is_active=true`, [id]);
    if (linked.rows[0].count > 0) return res.status(409).json({ error: "لا يمكن حذف شفت مرتبط بموظفين. أزل الموظفين أو أرشف الشفت بدل الحذف.", code: "SHIFT_HAS_EMPLOYEES" });
    const result = await pool.query(`DELETE FROM work_shifts WHERE id=$1 RETURNING id`, [id]);
    await writeAuditLog(pool, req, "تم حذف الشفت", Number(id), oldResult.rows[0], null);
    res.status(200).json({ message: "تم حذف الشفت بنجاح" });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const assignShift = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureShiftSchema(client);
    const employeeIds = normalizeEmployeeIds(req.body);
    const { shift_id, effective_from, effective_to } = req.body;
    const transferExisting = normalizeBoolean(req.body.transfer_existing, false);
    if (!employeeIds.length || !shift_id) { await client.query("ROLLBACK"); return res.status(400).json({ error: "يجب اختيار موظف واحد على الأقل والشفت" }); }
    const shift = await client.query(`SELECT * FROM work_shifts WHERE id=$1 AND is_active=true`, [shift_id]);
    if (!shift.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "الشفت غير موجود أو مؤرشف" }); }
    const conflicts = await findConflicts(client, employeeIds, Number(shift_id), effective_from || todayIso(), effective_to || null);
    if (conflicts.length && !transferExisting) { await client.query("ROLLBACK"); return res.status(409).json({ error: "يوجد موظفون مرتبطون بشفت آخر في نفس الفترة وبأيام عمل متداخلة", code: "SHIFT_ASSIGNMENT_CONFLICT", conflicts }); }
    if (conflicts.length && transferExisting) {
      await client.query(`UPDATE employee_shift_assignments SET is_active=false, effective_to=COALESCE($2::date - INTERVAL '1 day', CURRENT_DATE), updated_at=CURRENT_TIMESTAMP WHERE employee_id = ANY($1::int[]) AND is_active=true`, [employeeIds, effective_from || todayIso()]);
    }
    const created = [];
    for (const employeeId of employeeIds) {
      const result = await client.query(
        `INSERT INTO employee_shift_assignments (employee_id, shift_id, effective_from, effective_to, is_active, updated_at)
         VALUES ($1,$2,$3,$4,true,CURRENT_TIMESTAMP) RETURNING *`,
        [employeeId, shift_id, effective_from || todayIso(), effective_to || null]
      );
      created.push(result.rows[0]);
    }
    await writeAuditLog(client, req, "تم ربط موظفين بالشفت", Number(shift_id), null, { employee_ids: employeeIds });
    await client.query("COMMIT");
    res.status(201).json({ message: "تم ربط الموظفين بالشفت بنجاح", assignments: created });
  } catch (error) { await client.query("ROLLBACK"); res.status(500).json({ error: error.message }); } finally { client.release(); }
};

const removeAssignment = async (req, res) => {
  try {
    await ensureShiftSchema();
    const { id } = req.params;
    const oldResult = await pool.query(`SELECT * FROM employee_shift_assignments WHERE id=$1`, [id]);
    if (!oldResult.rows.length) return res.status(404).json({ error: "ارتباط الشفت غير موجود" });
    const result = await pool.query(`UPDATE employee_shift_assignments SET is_active=false, effective_to=COALESCE(effective_to, CURRENT_DATE), removed_at=CURRENT_TIMESTAMP, removal_reason=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [id, req.body?.reason || "إزالة من الشفت"]);
    await writeAuditLog(pool, req, "تمت إزالة موظف من الشفت", result.rows[0].shift_id, oldResult.rows[0], result.rows[0]);
    res.status(200).json({ message: "تمت إزالة الموظف من الشفت", assignment: result.rows[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const moveAssignment = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureShiftSchema(client);
    const { id } = req.params;
    const { new_shift_id, effective_from, effective_to } = req.body;
    const old = await client.query(`SELECT * FROM employee_shift_assignments WHERE id=$1 AND is_active=true`, [id]);
    if (!old.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "ارتباط الشفت غير موجود أو غير نشط" }); }
    if (!new_shift_id) { await client.query("ROLLBACK"); return res.status(400).json({ error: "الشفت الجديد مطلوب" }); }
    const conflicts = await findConflicts(client, [old.rows[0].employee_id], Number(new_shift_id), effective_from || todayIso(), effective_to || null, Number(id));
    if (conflicts.length) { await client.query("ROLLBACK"); return res.status(409).json({ error: "الموظف مرتبط بشفت آخر في نفس الفترة وبأيام عمل متداخلة", code: "SHIFT_ASSIGNMENT_CONFLICT", conflicts }); }
    await client.query(`UPDATE employee_shift_assignments SET is_active=false, effective_to=COALESCE($2::date - INTERVAL '1 day', CURRENT_DATE), updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [id, effective_from || todayIso()]);
    const created = await client.query(`INSERT INTO employee_shift_assignments (employee_id, shift_id, effective_from, effective_to, is_active, updated_at) VALUES ($1,$2,$3,$4,true,CURRENT_TIMESTAMP) RETURNING *`, [old.rows[0].employee_id, new_shift_id, effective_from || todayIso(), effective_to || null]);
    await writeAuditLog(client, req, "تم نقل موظف إلى شفت آخر", Number(new_shift_id), old.rows[0], created.rows[0]);
    await client.query("COMMIT");
    res.status(200).json({ message: "تم نقل الموظف إلى الشفت الجديد", assignment: created.rows[0] });
  } catch (error) { await client.query("ROLLBACK"); res.status(500).json({ error: error.message }); } finally { client.release(); }
};

module.exports = { ensureShiftSchema, getShifts, getShiftById, createShift, updateShift, archiveShift, deleteShift, assignShift, removeAssignment, moveAssignment };
