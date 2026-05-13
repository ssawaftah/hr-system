const pool = require("../db");

const ensureAttendanceSchema = async () => {
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS source VARCHAR(40) DEFAULT 'system'`);
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
};

const getAttendance = async (req, res) => {
  try {
    await ensureAttendanceSchema();
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
    const { employee_id, attendance_date, check_in, check_out, status, notes, source } = req.body;

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
      (employee_id, attendance_date, check_in, check_out, status, notes, source, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      RETURNING *
      `,
      [employee_id, attendance_date, check_in || null, check_out || null, status || "present", notes || null, source || "system"]
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

module.exports = { getAttendance, createAttendance, deleteAttendance };
