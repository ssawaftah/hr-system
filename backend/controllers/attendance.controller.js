const pool = require("../db");

const DEFAULT_SHIFT_START = "07:00";
const ABSENCE_AFTER_HOURS = 3;

const ensureAttendanceSchema = async () => {
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS source VARCHAR(40) DEFAULT 'system'`);
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS leave_request_id INTEGER`);
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS absence_reason TEXT`);
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
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

const timeToMinutes = (time) => {
  const [hour, minute] = String(time || DEFAULT_SHIFT_START).split(":").map(Number);
  return hour * 60 + minute;
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
    `SELECT id, check_in, check_out, source FROM attendance_records WHERE employee_id = $1 AND attendance_date = $2 ORDER BY id DESC LIMIT 1`,
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
  const shiftStart = timeToMinutes(DEFAULT_SHIFT_START);
  if (minutes < shiftStart) return;

  const employees = await pool.query(`SELECT id FROM employees WHERE COALESCE(is_active, true) = true`);

  for (const employee of employees.rows) {
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

    const status = minutes >= shiftStart + ABSENCE_AFTER_HOURS * 60 ? "absent" : "late";
    await upsertAutoAttendance({
      employeeId: employee.id,
      date,
      status,
      source: "auto_monitor",
      notes: status === "late" ? `تأخر تلقائي: لم يتم تسجيل حضور بعد بداية الدوام ${DEFAULT_SHIFT_START}` : `غياب تلقائي: لم يتم تسجيل حضور بعد ${ABSENCE_AFTER_HOURS} ساعات من بداية الدوام`,
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
        sd.name AS sub_department_name
      FROM attendance_records a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN employee_departments epd ON epd.employee_id = e.id AND epd.is_primary = true
      LEFT JOIN departments pd ON pd.id = COALESCE(epd.department_id, e.department_id)
      LEFT JOIN employee_departments esd ON esd.employee_id = e.id AND esd.is_primary = false
      LEFT JOIN departments sd ON sd.id = esd.department_id
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

    if (!employee_id || !attendance_date) {
      return res.status(400).json({ error: "الموظف والتاريخ مطلوبان" });
    }

    const employee = await pool.query(`SELECT id FROM employees WHERE id = $1`, [employee_id]);
    if (employee.rows.length === 0) {
      return res.status(404).json({ error: "الموظف غير موجود" });
    }

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

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "السجل غير موجود" });
    }

    res.status(200).json({ message: "تم حذف سجل الحضور بنجاح" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getAttendance, createAttendance, deleteAttendance, upsertAutoAttendance, ensureAttendanceSchema };
