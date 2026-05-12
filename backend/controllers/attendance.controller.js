const pool = require("../db");

const getAttendance = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.id,
        a.employee_id,
        e.full_name AS employee_name,
        a.attendance_date,
        a.check_in,
        a.check_out,
        a.status,
        a.notes,
        a.created_at
      FROM attendance_records a
      JOIN employees e ON a.employee_id = e.id
      ORDER BY a.attendance_date DESC, a.id DESC
    `);

    res.status(200).json({ attendance: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createAttendance = async (req, res) => {
  try {
    const {
      employee_id,
      attendance_date,
      check_in,
      check_out,
      status,
      notes,
    } = req.body;

    if (!employee_id || !attendance_date) {
      return res.status(400).json({
        error: "الموظف والتاريخ مطلوبان",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO attendance_records
      (employee_id, attendance_date, check_in, check_out, status, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        employee_id,
        attendance_date,
        check_in || null,
        check_out || null,
        status || "present",
        notes || null,
      ]
    );

    res.status(201).json({
      message: "تم تسجيل الحضور بنجاح",
      record: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM attendance_records WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "السجل غير موجود" });
    }

    res.status(200).json({ message: "تم حذف سجل الحضور بنجاح" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAttendance,
  createAttendance,
  deleteAttendance,
};
