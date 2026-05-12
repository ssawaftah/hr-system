const pool = require("../db");

const getLeaves = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        l.id,
        l.employee_id,
        e.full_name AS employee_name,
        l.leave_type,
        l.start_date,
        l.end_date,
        l.reason,
        l.status,
        l.admin_notes,
        l.created_at
      FROM leave_requests l
      JOIN employees e ON l.employee_id = e.id
      ORDER BY l.id DESC
    `);

    res.status(200).json({ leaves: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createLeave = async (req, res) => {
  try {
    const { employee_id, leave_type, start_date, end_date, reason } = req.body;

    if (!employee_id || !start_date || !end_date) {
      return res.status(400).json({ error: "الموظف وتاريخ البداية والنهاية مطلوبة" });
    }

    const result = await pool.query(
      `
      INSERT INTO leave_requests
      (employee_id, leave_type, start_date, end_date, reason)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        employee_id,
        leave_type || "annual",
        start_date,
        end_date,
        reason || null,
      ]
    );

    res.status(201).json({
      message: "تم إنشاء طلب الإجازة بنجاح",
      leave: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const allowedStatuses = ["pending", "approved", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "حالة الطلب غير صحيحة" });
    }

    const result = await pool.query(
      `
      UPDATE leave_requests
      SET status = $1,
          admin_notes = $2
      WHERE id = $3
      RETURNING *
      `,
      [status, admin_notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "طلب الإجازة غير موجود" });
    }

    res.status(200).json({
      message: "تم تحديث حالة الإجازة بنجاح",
      leave: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteLeave = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM leave_requests WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "طلب الإجازة غير موجود" });
    }

    res.status(200).json({ message: "تم حذف طلب الإجازة بنجاح" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getLeaves,
  createLeave,
  updateLeaveStatus,
  deleteLeave,
};
