const pool = require("../db");

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

  await pool.query(`CREATE INDEX IF NOT EXISTS employee_shift_assignments_employee_idx ON employee_shift_assignments(employee_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS employee_shift_assignments_shift_idx ON employee_shift_assignments(shift_id)`);
};

const getShifts = async (req, res) => {
  try {
    await ensureShiftSchema();
    const shifts = await pool.query(`SELECT * FROM work_shifts ORDER BY id ASC`);
    const assignments = await pool.query(`
      SELECT
        esa.id,
        esa.employee_id,
        e.full_name AS employee_name,
        esa.shift_id,
        ws.name AS shift_name,
        esa.effective_from,
        esa.effective_to,
        esa.is_active
      FROM employee_shift_assignments esa
      JOIN employees e ON e.id = esa.employee_id
      JOIN work_shifts ws ON ws.id = esa.shift_id
      ORDER BY esa.id DESC
    `);
    res.status(200).json({ shifts: shifts.rows, assignments: assignments.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createShift = async (req, res) => {
  try {
    await ensureShiftSchema();
    const { name, start_time, end_time, late_grace_minutes, absent_after_minutes, is_active } = req.body;
    if (!name || !start_time || !end_time) return res.status(400).json({ error: "اسم الشفت ووقت البداية والنهاية مطلوبة" });
    const result = await pool.query(
      `INSERT INTO work_shifts (name, start_time, end_time, late_grace_minutes, absent_after_minutes, is_active, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP) RETURNING *`,
      [name.trim(), start_time, end_time, Number(late_grace_minutes || 0), Number(absent_after_minutes || 180), is_active !== false]
    );
    res.status(201).json({ message: "تم إنشاء الشفت بنجاح", shift: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateShift = async (req, res) => {
  try {
    await ensureShiftSchema();
    const { id } = req.params;
    const { name, start_time, end_time, late_grace_minutes, absent_after_minutes, is_active } = req.body;
    if (!name || !start_time || !end_time) return res.status(400).json({ error: "اسم الشفت ووقت البداية والنهاية مطلوبة" });
    const result = await pool.query(
      `UPDATE work_shifts
       SET name=$1, start_time=$2, end_time=$3, late_grace_minutes=$4, absent_after_minutes=$5, is_active=$6, updated_at=CURRENT_TIMESTAMP
       WHERE id=$7 RETURNING *`,
      [name.trim(), start_time, end_time, Number(late_grace_minutes || 0), Number(absent_after_minutes || 180), is_active !== false, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "الشفت غير موجود" });
    res.status(200).json({ message: "تم تعديل الشفت بنجاح", shift: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteShift = async (req, res) => {
  try {
    await ensureShiftSchema();
    const { id } = req.params;
    const linked = await pool.query(`SELECT COUNT(*)::int AS count FROM employee_shift_assignments WHERE shift_id=$1 AND is_active=true`, [id]);
    if (linked.rows[0].count > 0) return res.status(409).json({ error: "لا يمكن حذف شفت مرتبط بموظفين. عطّله بدل الحذف." });
    const result = await pool.query(`DELETE FROM work_shifts WHERE id=$1 RETURNING id`, [id]);
    if (!result.rows.length) return res.status(404).json({ error: "الشفت غير موجود" });
    res.status(200).json({ message: "تم حذف الشفت بنجاح" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const assignShift = async (req, res) => {
  try {
    await ensureShiftSchema();
    const { employee_id, shift_id, effective_from, effective_to } = req.body;
    if (!employee_id || !shift_id) return res.status(400).json({ error: "الموظف والشفت مطلوبان" });

    const employee = await pool.query(`SELECT id FROM employees WHERE id=$1`, [employee_id]);
    if (!employee.rows.length) return res.status(404).json({ error: "الموظف غير موجود" });
    const shift = await pool.query(`SELECT id FROM work_shifts WHERE id=$1 AND is_active=true`, [shift_id]);
    if (!shift.rows.length) return res.status(404).json({ error: "الشفت غير موجود أو غير نشط" });

    await pool.query(
      `UPDATE employee_shift_assignments SET is_active=false, effective_to=COALESCE(effective_to, CURRENT_DATE), updated_at=CURRENT_TIMESTAMP WHERE employee_id=$1 AND is_active=true`,
      [employee_id]
    );

    const result = await pool.query(
      `INSERT INTO employee_shift_assignments (employee_id, shift_id, effective_from, effective_to, is_active, updated_at)
       VALUES ($1,$2,$3,$4,true,CURRENT_TIMESTAMP) RETURNING *`,
      [employee_id, shift_id, effective_from || new Date().toISOString().split("T")[0], effective_to || null]
    );
    res.status(201).json({ message: "تم ربط الموظف بالشفت بنجاح", assignment: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { ensureShiftSchema, getShifts, createShift, updateShift, deleteShift, assignShift };
