const pool = require("../db");

const ensureLeaveSchema = async () => {
  await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS admin_notes TEXT`);
  await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS decision_reason TEXT`);
  await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS decided_by INTEGER`);
  await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP`);
  await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
};

const calculateDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.round((end - start) / 86400000) + 1;
  return days > 0 ? days : 0;
};

const getLeaves = async (req, res) => {
  try {
    await ensureLeaveSchema();
    const result = await pool.query(`
      SELECT
        l.id,
        l.employee_id,
        e.full_name AS employee_name,
        e.employee_number,
        l.leave_type,
        l.start_date,
        l.end_date,
        (l.end_date - l.start_date + 1)::int AS days_count,
        l.reason,
        l.status,
        l.admin_notes,
        l.decision_reason,
        l.decided_by,
        l.decided_at,
        l.created_at,
        l.updated_at,
        pd.id AS primary_department_id,
        pd.name AS primary_department_name,
        sd.id AS sub_department_id,
        sd.name AS sub_department_name
      FROM leave_requests l
      JOIN employees e ON l.employee_id = e.id
      LEFT JOIN employee_departments epd ON epd.employee_id = e.id AND epd.is_primary = true
      LEFT JOIN departments pd ON pd.id = COALESCE(epd.department_id, e.department_id)
      LEFT JOIN employee_departments esd ON esd.employee_id = e.id AND esd.is_primary = false
      LEFT JOIN departments sd ON sd.id = esd.department_id
      ORDER BY l.id DESC
    `);

    res.status(200).json({ leaves: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createLeave = async (req, res) => {
  try {
    await ensureLeaveSchema();
    const { employee_id, leave_type, start_date, end_date, reason, admin_notes } = req.body;

    if (!employee_id || !start_date || !end_date) {
      return res.status(400).json({ error: "الموظف وتاريخ البداية والنهاية مطلوبة" });
    }

    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ error: "تاريخ نهاية الإجازة يجب أن يكون بعد تاريخ البداية" });
    }

    const employee = await pool.query(`SELECT id FROM employees WHERE id = $1`, [employee_id]);
    if (employee.rows.length === 0) {
      return res.status(404).json({ error: "الموظف غير موجود" });
    }

    const result = await pool.query(
      `
      INSERT INTO leave_requests
      (employee_id, leave_type, start_date, end_date, reason, admin_notes, status, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', CURRENT_TIMESTAMP)
      RETURNING *, (end_date - start_date + 1)::int AS days_count
      `,
      [employee_id, leave_type || "annual", start_date, end_date, reason || null, admin_notes || null]
    );

    res.status(201).json({ message: "تم إنشاء طلب الإجازة بنجاح", leave: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateLeaveStatus = async (req, res) => {
  try {
    await ensureLeaveSchema();
    const { id } = req.params;
    const { status, admin_notes, decision_reason } = req.body;
    const allowedStatuses = ["pending", "approved", "rejected", "cancelled"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "حالة الطلب غير صحيحة" });
    }

    if ((status === "rejected" || status === "cancelled") && !decision_reason && !admin_notes) {
      return res.status(400).json({ error: "يرجى كتابة سبب الرفض أو الإلغاء" });
    }

    const result = await pool.query(
      `
      UPDATE leave_requests
      SET status = $1,
          admin_notes = $2,
          decision_reason = $3,
          decided_by = $4,
          decided_at = CASE WHEN $1 = 'pending' THEN NULL ELSE CURRENT_TIMESTAMP END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *, (end_date - start_date + 1)::int AS days_count
      `,
      [status, admin_notes || null, decision_reason || null, req.user?.id || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "طلب الإجازة غير موجود" });
    }

    res.status(200).json({ message: "تم تحديث حالة الإجازة بنجاح", leave: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateLeave = async (req, res) => {
  try {
    await ensureLeaveSchema();
    const { id } = req.params;
    const { employee_id, leave_type, start_date, end_date, reason, admin_notes } = req.body;

    if (!employee_id || !start_date || !end_date) {
      return res.status(400).json({ error: "الموظف وتاريخ البداية والنهاية مطلوبة" });
    }
    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ error: "تاريخ نهاية الإجازة يجب أن يكون بعد تاريخ البداية" });
    }

    const result = await pool.query(
      `
      UPDATE leave_requests
      SET employee_id = $1,
          leave_type = $2,
          start_date = $3,
          end_date = $4,
          reason = $5,
          admin_notes = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *, (end_date - start_date + 1)::int AS days_count
      `,
      [employee_id, leave_type || "annual", start_date, end_date, reason || null, admin_notes || null, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "طلب الإجازة غير موجود" });
    res.status(200).json({ message: "تم تعديل طلب الإجازة بنجاح", leave: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM leave_requests WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "طلب الإجازة غير موجود" });
    res.status(200).json({ message: "تم حذف طلب الإجازة بنجاح" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getLeaves, createLeave, updateLeave, updateLeaveStatus, deleteLeave };
