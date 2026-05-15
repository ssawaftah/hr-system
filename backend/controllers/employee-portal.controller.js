const pool = require('../db');

const todayJordanSql = `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman')::date`;
const nowJordanSql = `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman')::time`;

const getCurrentEmployeeId = async (req) => {
  if (req.user?.employee_id) return req.user.employee_id;
  const result = await pool.query('SELECT employee_id FROM users WHERE id=$1 LIMIT 1', [req.user.id]);
  return result.rows[0]?.employee_id || null;
};

const requireEmployee = async (req, res) => {
  const employeeId = await getCurrentEmployeeId(req);
  if (!employeeId) {
    res.status(403).json({ error: 'هذا الحساب غير مرتبط بموظف' });
    return null;
  }
  return employeeId;
};

const ensurePortalSchema = async () => {
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS source VARCHAR(40) DEFAULT 'system'`);
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await pool.query(`ALTER TABLE finance_employee_settings ADD COLUMN IF NOT EXISTS leave_balance_current NUMERIC(8,2) DEFAULT 14`);
  await pool.query(`ALTER TABLE finance_employee_settings ADD COLUMN IF NOT EXISTS leave_days_consumed NUMERIC(8,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE finance_employee_settings ADD COLUMN IF NOT EXISTS exit_hours_per_leave_day NUMERIC(8,2) DEFAULT 8`);
};

const getCurrentShift = async (employeeId) => {
  const result = await pool.query(
    `SELECT ws.id, ws.name, ws.shift_type, ws.start_time, ws.end_time, ws.work_days, ws.late_grace_minutes, ws.official_work_hours
     FROM employee_shift_assignments esa
     JOIN work_shifts ws ON ws.id=esa.shift_id
     WHERE esa.employee_id=$1
       AND esa.is_active=true
       AND COALESCE(ws.is_active,true)=true
       AND esa.effective_from <= ${todayJordanSql}
       AND (esa.effective_to IS NULL OR esa.effective_to >= ${todayJordanSql})
     ORDER BY esa.effective_from DESC, esa.id DESC
     LIMIT 1`,
    [employeeId]
  );
  return result.rows[0] || {
    id: null,
    name: 'الدوام الافتراضي',
    shift_type: 'default',
    start_time: '07:00:00',
    end_time: '15:00:00',
    work_days: ['sat','sun','mon','tue','wed','thu'],
    late_grace_minutes: 0,
    official_work_hours: 8,
  };
};

const getSelfProfile = async (req, res) => {
  try {
    await ensurePortalSchema();
    const employeeId = await requireEmployee(req, res);
    if (!employeeId) return;
    const profile = await pool.query(
      `SELECT e.*, d.name AS department_name, jt.name AS job_title_label,
              fs.leave_balance_current, fs.leave_days_consumed,
              COALESCE(fs.leave_balance_current,14) - COALESCE(fs.leave_days_consumed,0) AS leave_balance_remaining
       FROM employees e
       LEFT JOIN departments d ON d.id=e.department_id
       LEFT JOIN job_titles jt ON jt.id=e.job_title_id
       LEFT JOIN finance_employee_settings fs ON fs.employee_id=e.id
       WHERE e.id=$1`,
      [employeeId]
    );
    const subDepartments = await pool.query(
      `SELECT d.id, d.name FROM employee_departments ed JOIN departments d ON d.id=ed.department_id WHERE ed.employee_id=$1 AND COALESCE(ed.is_primary,false)=false`,
      [employeeId]
    ).catch(() => ({ rows: [] }));
    const shift = await getCurrentShift(employeeId);
    const lastMovement = await pool.query(
      `SELECT * FROM attendance_records WHERE employee_id=$1 ORDER BY attendance_date DESC, id DESC LIMIT 1`,
      [employeeId]
    );
    res.json({ profile: profile.rows[0] || null, sub_departments: subDepartments.rows, current_shift: shift, last_movement: lastMovement.rows[0] || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getToday = async (req, res) => {
  try {
    await ensurePortalSchema();
    const employeeId = await requireEmployee(req, res);
    if (!employeeId) return;
    const shift = await getCurrentShift(employeeId);
    const attendance = await pool.query(`SELECT * FROM attendance_records WHERE employee_id=$1 AND attendance_date=${todayJordanSql} ORDER BY id DESC LIMIT 1`, [employeeId]);
    res.json({ date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Amman' }), current_shift: shift, today_attendance: attendance.rows[0] || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const checkInOut = async (req, res) => {
  try {
    await ensurePortalSchema();
    const employeeId = await requireEmployee(req, res);
    if (!employeeId) return;
    const action = req.body.action === 'checkout' ? 'checkout' : 'checkin';
    const existing = await pool.query(`SELECT * FROM attendance_records WHERE employee_id=$1 AND attendance_date=${todayJordanSql} ORDER BY id DESC LIMIT 1`, [employeeId]);
    if (action === 'checkin') {
      if (existing.rows[0]?.check_in) return res.status(409).json({ error: 'تم تسجيل الحضور مسبقًا لهذا اليوم' });
      const result = existing.rows.length
        ? await pool.query(`UPDATE attendance_records SET check_in=${nowJordanSql}, status='present', source='self_service', updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [existing.rows[0].id])
        : await pool.query(`INSERT INTO attendance_records (employee_id, attendance_date, check_in, status, source, notes, updated_at) VALUES ($1, ${todayJordanSql}, ${nowJordanSql}, 'present', 'self_service', 'تسجيل حضور من بوابة الموظف', CURRENT_TIMESTAMP) RETURNING *`, [employeeId]);
      return res.json({ message: 'تم تسجيل الحضور بنجاح', attendance: result.rows[0] });
    }
    if (!existing.rows.length || !existing.rows[0].check_in) return res.status(400).json({ error: 'لا يمكن تسجيل الانصراف قبل تسجيل الحضور' });
    if (existing.rows[0].check_out) return res.status(409).json({ error: 'تم تسجيل الانصراف مسبقًا لهذا اليوم' });
    const result = await pool.query(`UPDATE attendance_records SET check_out=${nowJordanSql}, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [existing.rows[0].id]);
    res.json({ message: 'تم تسجيل الانصراف بنجاح', attendance: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSelfAttendance = async (req, res) => {
  try {
    const employeeId = await requireEmployee(req, res);
    if (!employeeId) return;
    const month = String(req.query.month || new Date().toISOString().slice(0,7));
    const result = await pool.query(
      `SELECT attendance_date, check_in, check_out, status, notes, source, absence_reason
       FROM attendance_records
       WHERE employee_id=$1 AND attendance_date >= ($2 || '-01')::date AND attendance_date < (($2 || '-01')::date + INTERVAL '1 month')
       ORDER BY attendance_date ASC`,
      [employeeId, month]
    );
    res.json({ attendance: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSelfRequests = async (req, res) => {
  try {
    const employeeId = await requireEmployee(req, res);
    if (!employeeId) return;
    const result = await pool.query(
      `SELECT * FROM employee_requests WHERE employee_id=$1 ORDER BY updated_at DESC, id DESC`,
      [employeeId]
    );
    res.json({ requests: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSelfSalarySlip = async (req, res) => {
  try {
    const employeeId = await requireEmployee(req, res);
    if (!employeeId) return;
    const month = String(req.query.month || '');
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'الشهر مطلوب بصيغة YYYY-MM' });
    const salary = await pool.query(
      `SELECT * FROM salary_records WHERE employee_id=$1 AND salary_month=$2 AND status IN ('paid','published','closed') ORDER BY id DESC LIMIT 1`,
      [employeeId, month]
    );
    if (!salary.rows.length) return res.status(404).json({ error: 'قسيمة الراتب غير منشورة لهذا الشهر' });
    const items = await pool.query(`SELECT * FROM salary_record_items WHERE salary_record_id=$1 ORDER BY item_type DESC, id ASC`, [salary.rows[0].id]);
    res.json({ salary: salary.rows[0], items: items.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getSelfProfile, getToday, checkInOut, getSelfAttendance, getSelfRequests, getSelfSalarySlip };
