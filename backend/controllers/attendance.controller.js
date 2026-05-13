const pool = require("../db");

const DEFAULT_SHIFT_START = "07:00";
const DEFAULT_ABSENT_AFTER_MINUTES = 180;

const ensureAttendanceSchema = async () => {
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS source VARCHAR(40) DEFAULT 'system'`);
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS leave_request_id INTEGER`);
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS absence_reason TEXT`);
};

const ensureShiftSchema = async () => {
  await pool.query(`
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
  await pool.query(`
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
};

const ammanNowParts = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
};

const timeToMinutes = (time) => {
  const [hour, minute] = String(time || DEFAULT_SHIFT_START).slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
};

const getEmployeeShiftForDate = async (employeeId, date) => {
  await ensureShiftSchema();
  const result = await pool.query(
    `
    SELECT ws.id, ws.name, ws.start_time, ws.end_time, ws.late_grace_minutes, ws.absent_after_minutes
    FROM employee_shift_assignments esa
    JOIN work_shifts ws ON ws.id = esa.shift_id
    WHERE esa.employee_id = $1
      AND esa.is_active = true
      AND ws.is_active = true
      AND esa.effective_from <= $2::date
      AND (esa.effective_to IS NULL OR esa.effective_to >= $2::date)
    ORDER BY esa.effective_from DESC, esa.id DESC
    LIMIT 1
    `,
    [employeeId, date]
  );
  return result.rows[0] || {
    id: null,
    name: "الدوام الافتراضي",
    start_time: DEFAULT_SHIFT_START,
    end_time: "15:00",
    late_grace_minutes: 0,
    absent_after_minutes: DEFAULT_ABSENT_AFTER_MINUTES,
  };
};

const findApprovedLeaveForDate = async (employeeId, date) => {
  const result = await pool.query(
    `
    SELECT id, leave_type, reason
    FROM leave_requests
    WHERE employee_id = $1
      AND status = 'approved'
      AND $2::date BETWEEN start_date AND end_date
    ORDER BY id DESC
    LIMIT 1
    `,
    [employeeId, date]
  );
  return result.rows[0] || null;
};

const upsertAutoAttendance = async ({ employeeId, date, status, source, notes, leaveRequestId = null, absenceReason = null }) => {
  const existing = await pool.query(
    `SELECT id, check_in, check_out FROM attendance_records WHERE employee_id = $1 AND attendance_date = $2 ORDER BY id DESC LIMIT 1`,
    [employeeId, date]
  );

  if (existing.rows.length === 0) {
    await pool.query(
      `
      INSERT INTO attendance_records
      (employee_id, attendance_date, check_in, check_out, status, notes, source, leave_request_id, absence_reason, updated_at)
      VALUES ($1, $2, NULL, NULL, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `,
      [employeeId, date, status, notes, source, leaveRequestId, absenceReason]
    );
    return;
  }

  const row = existing.rows[0];
  if (row.check_in || row.check_out) return;

  await pool.query(
    `
    UPDATE attendance_records
    SET status = $1,
        notes = $2,
        source = $3,
        leave_request_id = $4,
        absence_reason = $5,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    `,
    [status, notes, source, leaveRequestId, absenceReason, row.id]
  );
};

const materializeTodayAttendance = async () => {
  const { date, minutes } = ammanNowParts();
  const employees = await pool.query(`SELECT id FROM employees WHERE COALESCE(is_active, true) = true`);

  for (const employee of employees.rows) {
    const shift = await getEmployeeShiftForDate(employee.id, date);
    const shiftStart = timeToMinutes(shift.start_time);
    const absentAfter = Number(shift.absent_after_minutes || DEFAULT_ABSENT_AFTER_MINUTES);
    const grace = Number(shift.late_grace_minutes || 0);
    if (minutes < shiftStart + grace) continue;

    const approvedLeave = await findApprovedLeaveForDate(employee.id, date);
    if (approvedLeave) {
      await upsertAutoAttendance({
        employeeId: employee.id,
        date,
        status: "absent",
        source: "approved_leave",
        notes: `غياب بعذر - إجازة معتمدة (${approvedLeave.leave_type})${approvedLeave.reason ? ` - ${approvedLeave.reason}` : ""}`,
        leaveRequestId: approvedLeave.id,
        absenceReason: "excused_leave",
      });
      continue;
    }

    const status = minutes >= shiftStart + absentAfter ? "absent" : "late";
    await upsertAutoAttendance({
      employeeId: employee.id,
      date,
      status,
      source: "auto_monitor",
      notes: status === "late"
        ? `تأخر تلقائي: لم يتم تسجيل حضور بعد بداية شفت ${shift.name} (${String(shift.start_time).slice(0, 5)})`
        : `غياب تلقائي: لم يتم تسجيل حضور بعد ${absentAfter} دقيقة من بداية شفت ${shift.name}`,
      absenceReason: status === "absent" ? "unexcused_no_check_in" : "late_no_check_in",
    });
  }
};

const getAttendance = async (req, res) => {
  try {
    await ensureAttendanceSchema();
    if (req.query.auto !== "0") await materializeTodayAttendance();
    const result = await pool.query(`
      SELECT
        a.id,
        a.employee_id,
        e.full_name AS employee_name,
        e.employee_number,
        a.attendance_date,
        a.check_in,
        a.check_out,
        a.status,
        a.notes,
        COALESCE(a.source, 'system') AS source,
        a.leave_request_id,
        a.absence_reason,
        a.created_at,
        a.updated_at,
        pd.id AS primary_department_id,
        pd.name AS primary_department_name,
        sd.id AS sub_department_id,
        sd.name AS sub_department_name,
        ws.id AS shift_id,
        ws.name AS shift_name,
        ws.start_time AS shift_start_time,
        ws.end_time AS shift_end_time
      FROM attendance_records a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN employee_departments epd ON epd.employee_id = e.id AND epd.is_primary = true
      LEFT JOIN departments pd ON pd.id = COALESCE(epd.department_id, e.department_id)
      LEFT JOIN employee_departments esd ON esd.employee_id = e.id AND esd.is_primary = false
      LEFT JOIN departments sd ON sd.id = esd.department_id
      LEFT JOIN employee_shift_assignments esa ON esa.employee_id = e.id AND esa.is_active = true AND esa.effective_from <= a.attendance_date AND (esa.effective_to IS NULL OR esa.effective_to >= a.attendance_date)
      LEFT JOIN work_shifts ws ON ws.id = esa.shift_id
      ORDER BY a.attendance_date DESC, a.id DESC
    `);

    res.status(200).json({ attendance: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createAttendance = async (req, res) => {
  try {
    await ensureAttendanceSchema();
    const { employee_id, attendance_date, check_in, check_out, status, notes, source, absence_reason } = req.body;
    if (!employee_id || !attendance_date) return res.status(400).json({ error: "الموظف والتاريخ مطلوبان" });

    const employee = await pool.query(`SELECT id FROM employees WHERE id = $1`, [employee_id]);
    if (employee.rows.length === 0) return res.status(404).json({ error: "الموظف غير موجود" });

    const result = await pool.query(
      `
      INSERT INTO attendance_records
      (employee_id, attendance_date, check_in, check_out, status, notes, source, absence_reason, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *
      `,
      [employee_id, attendance_date, check_in || null, check_out || null, status || "present", notes || null, source || "system", absence_reason || null]
    );

    res.status(201).json({ message: "تم تسجيل الحضور بنجاح", record: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM attendance_records WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "السجل غير موجود" });
    res.status(200).json({ message: "تم حذف سجل الحضور بنجاح" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getAttendance, createAttendance, deleteAttendance, upsertAutoAttendance, ensureAttendanceSchema };
