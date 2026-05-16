const pool = require('../db');

const todayJordanSql = `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman')::date`;
const nowJordanSql = `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman')::time`;
const nowMinutesSql = `((EXTRACT(HOUR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman')::time)::int * 60) + EXTRACT(MINUTE FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman')::time)::int)`;

const timeToMinutes = (time, fallback = '00:00') => {
  const [h, m] = String(time || fallback).slice(0,5).split(':').map(Number);
  return (Number(h) || 0) * 60 + (Number(m) || 0);
};

const getCurrentEmployeeId = async (req) => {
  if (req.user?.employee_id) return Number(req.user.employee_id);
  const user = await pool.query('SELECT employee_id, employee_number, email FROM users WHERE id=$1 LIMIT 1', [req.user.id]);
  if (user.rows[0]?.employee_id) return Number(user.rows[0].employee_id);
  if (user.rows[0]?.employee_number) {
    const employee = await pool.query('SELECT id FROM employees WHERE employee_number=$1 LIMIT 1', [String(user.rows[0].employee_number)]);
    if (employee.rows[0]?.id) return Number(employee.rows[0].id);
  }
  if (user.rows[0]?.email) {
    const employee = await pool.query('SELECT id FROM employees WHERE LOWER(email)=LOWER($1) LIMIT 1', [user.rows[0].email]);
    if (employee.rows[0]?.id) return Number(employee.rows[0].id);
  }
  return null;
};

const requireEmployee = async (req, res) => {
  const employeeId = await getCurrentEmployeeId(req);
  if (!employeeId) {
    res.status(403).json({ error: 'هذا الحساب غير مرتبط بموظف. اربط المستخدم بملف موظف من الإدارة.' });
    return null;
  }
  return employeeId;
};

const ensureAttendanceUniqueIndex = async () => {
  await pool.query(`CREATE INDEX IF NOT EXISTS attendance_employee_date_idx ON attendance_records(employee_id, attendance_date DESC)`);
  await pool.query(`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY employee_id, attendance_date
               ORDER BY
                 CASE WHEN check_in IS NOT NULL OR check_out IS NOT NULL THEN 0 ELSE 1 END,
                 updated_at DESC NULLS LAST,
                 id DESC
             ) AS rn
      FROM attendance_records
      WHERE employee_id IS NOT NULL AND attendance_date IS NOT NULL
    )
    DELETE FROM attendance_records a
    USING ranked r
    WHERE a.id = r.id AND r.rn > 1
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_employee_date_unique_idx ON attendance_records(employee_id, attendance_date)`);
};

const ensurePortalSchema = async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS work_shifts (id SERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, start_time TIME NOT NULL DEFAULT '07:00', end_time TIME NOT NULL DEFAULT '15:00', late_grace_minutes INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`ALTER TABLE work_shifts ADD COLUMN IF NOT EXISTS shift_type VARCHAR(30) DEFAULT 'custom'`);
  await pool.query(`ALTER TABLE work_shifts ADD COLUMN IF NOT EXISTS work_days JSONB DEFAULT '["saturday","sunday","monday","tuesday","wednesday","thursday"]'::jsonb`);
  await pool.query(`ALTER TABLE work_shifts ADD COLUMN IF NOT EXISTS official_work_hours NUMERIC(5,2) DEFAULT 8`);
  await pool.query(`ALTER TABLE work_shifts ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false`);
  await pool.query(`CREATE TABLE IF NOT EXISTS employee_shift_assignments (id SERIAL PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE, shift_id INTEGER NOT NULL REFERENCES work_shifts(id) ON DELETE RESTRICT, effective_from DATE DEFAULT CURRENT_DATE, effective_to DATE, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS source VARCHAR(40) DEFAULT 'system'`);
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS overtime_type VARCHAR(40)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_employee_settings (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
      basic_salary NUMERIC(12,2) DEFAULT 0,
      social_security_rate NUMERIC(6,3) DEFAULT 7.5,
      overtime_multiplier NUMERIC(5,2) DEFAULT 1.25,
      holiday_overtime_multiplier NUMERIC(5,2) DEFAULT 1.5,
      late_deduction_method VARCHAR(50) DEFAULT 'minutes_multiplier',
      absence_deduction_method VARCHAR(50) DEFAULT 'leave_balance_then_salary',
      salary_cycle_start_day INTEGER DEFAULT 1,
      salary_cycle_end_day INTEGER DEFAULT 31,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE finance_employee_settings ADD COLUMN IF NOT EXISTS late_minute_multiplier NUMERIC(6,2) DEFAULT 2`);
  await pool.query(`ALTER TABLE finance_employee_settings ADD COLUMN IF NOT EXISTS late_round_minutes INTEGER DEFAULT 30`);
  await pool.query(`ALTER TABLE finance_employee_settings ADD COLUMN IF NOT EXISTS late_round_to_hours BOOLEAN DEFAULT true`);
  await pool.query(`ALTER TABLE finance_employee_settings ADD COLUMN IF NOT EXISTS unexcused_absence_multiplier NUMERIC(6,2) DEFAULT 2`);
  await pool.query(`ALTER TABLE finance_employee_settings ADD COLUMN IF NOT EXISTS personal_exit_hours_per_leave_day NUMERIC(6,2) DEFAULT 8`);
  await ensureAttendanceUniqueIndex();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_requests (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      department_id INTEGER,
      request_type VARCHAR(50) NOT NULL,
      request_title VARCHAR(180) NOT NULL,
      request_data JSONB DEFAULT '{}'::jsonb,
      status VARCHAR(40) DEFAULT 'pending',
      priority VARCHAR(40),
      current_reviewer_id INTEGER,
      created_by INTEGER,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      cancelled_at TIMESTAMP,
      final_decision_by INTEGER,
      final_decision_reason TEXT,
      final_decision_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_leave_balances (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
      current_balance NUMERIC(8,2) DEFAULT 14,
      consumed_days NUMERIC(8,2) DEFAULT 0,
      remaining_days NUMERIC(8,2) DEFAULT 14,
      updated_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const getCurrentShift = async (employeeId) => {
  try {
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
    if (result.rows[0]) return result.rows[0];
  } catch (_) {}
  return { id: null, name: 'الدوام الافتراضي', shift_type: 'default', start_time: '07:00:00', end_time: '15:00:00', work_days: ['saturday','sunday','monday','tuesday','wednesday','thursday'], late_grace_minutes: 0, official_work_hours: 8 };
};

const getSelfProfile = async (req, res) => {
  try {
    await ensurePortalSchema();
    const employeeId = await requireEmployee(req, res);
    if (!employeeId) return;
    await pool.query(`INSERT INTO employee_leave_balances (employee_id, current_balance, consumed_days, remaining_days) VALUES ($1,14,0,14) ON CONFLICT (employee_id) DO NOTHING`, [employeeId]);
    const profile = await pool.query(
      `SELECT e.*, COALESCE(fes.basic_salary, e.basic_salary, 0) AS basic_salary,
              COALESCE(fes.social_security_rate, e.social_security_rate, 7.5) AS social_security_rate,
              d.name AS department_name, jt.name AS job_title_label,
              lb.current_balance AS leave_balance_current,
              lb.consumed_days AS leave_days_consumed,
              lb.remaining_days AS leave_balance_remaining
       FROM employees e
       LEFT JOIN departments d ON d.id=e.department_id
       LEFT JOIN job_titles jt ON jt.id=e.job_title_id
       LEFT JOIN finance_employee_settings fes ON fes.employee_id=e.id
       LEFT JOIN employee_leave_balances lb ON lb.employee_id=e.id
       WHERE e.id=$1`,
      [employeeId]
    );
    const subDepartments = await pool.query(`SELECT d.id, d.name FROM employee_departments ed JOIN departments d ON d.id=ed.department_id WHERE ed.employee_id=$1 AND COALESCE(ed.is_primary,false)=false`, [employeeId]).catch(() => ({ rows: [] }));
    const shift = await getCurrentShift(employeeId);
    const lastMovement = await pool.query(`SELECT * FROM attendance_records WHERE employee_id=$1 ORDER BY attendance_date DESC, id DESC LIMIT 1`, [employeeId]);
    res.json({ profile: profile.rows[0] || null, sub_departments: subDepartments.rows, current_shift: shift, last_movement: lastMovement.rows[0] || null });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getToday = async (req, res) => {
  try {
    await ensurePortalSchema();
    const employeeId = await requireEmployee(req, res);
    if (!employeeId) return;
    const shift = await getCurrentShift(employeeId);
    const attendance = await pool.query(`SELECT * FROM attendance_records WHERE employee_id=$1 AND attendance_date=${todayJordanSql} ORDER BY id DESC LIMIT 1`, [employeeId]);
    res.json({ date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Amman' }), current_shift: shift, today_attendance: attendance.rows[0] || null });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const checkInOut = async (req, res) => {
  try {
    await ensurePortalSchema();
    const employeeId = await requireEmployee(req, res);
    if (!employeeId) return;
    const action = req.body.action === 'checkout' ? 'checkout' : 'checkin';
    const shift = await getCurrentShift(employeeId);
    const shiftStart = timeToMinutes(shift.start_time, '07:00');
    const shiftEnd = timeToMinutes(shift.end_time, '15:00');
    const grace = Number(shift.late_grace_minutes || 0);
    const nowMinResult = await pool.query(`SELECT ${nowMinutesSql} AS minutes`);
    const nowMinutes = Number(nowMinResult.rows[0].minutes || 0);
    const existing = await pool.query(`SELECT * FROM attendance_records WHERE employee_id=$1 AND attendance_date=${todayJordanSql} ORDER BY id DESC LIMIT 1`, [employeeId]);

    if (action === 'checkin') {
      if (existing.rows[0]?.check_in) return res.status(409).json({ error: 'تم تسجيل الحضور مسبقًا لهذا اليوم' });
      const lateMinutes = Math.max(0, nowMinutes - shiftStart - grace);
      const status = lateMinutes > 0 ? 'late' : 'present';
      const notes = lateMinutes > 0 ? `تسجيل حضور من بوابة الموظف - متأخر ${lateMinutes} دقيقة عن شفت ${shift.name}` : `تسجيل حضور من بوابة الموظف - ضمن وقت شفت ${shift.name}`;
      const result = existing.rows.length
        ? await pool.query(`UPDATE attendance_records SET check_in=${nowJordanSql}, status=$2, source='self_service', notes=$3, late_minutes=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [existing.rows[0].id, status, notes, lateMinutes])
        : await pool.query(`INSERT INTO attendance_records (employee_id, attendance_date, check_in, status, source, notes, late_minutes, updated_at) VALUES ($1, ${todayJordanSql}, ${nowJordanSql}, $2, 'self_service', $3, $4, CURRENT_TIMESTAMP) RETURNING *`, [employeeId, status, notes, lateMinutes]);
      return res.json({ message: lateMinutes > 0 ? `تم تسجيل الحضور مع تأخير ${lateMinutes} دقيقة` : 'تم تسجيل الحضور بنجاح', attendance: result.rows[0] });
    }

    if (!existing.rows.length || !existing.rows[0].check_in) return res.status(400).json({ error: 'لا يمكن تسجيل الانصراف قبل تسجيل الحضور' });
    if (existing.rows[0].check_out) return res.status(409).json({ error: 'تم تسجيل الانصراف مسبقًا لهذا اليوم' });
    const overtimeMinutes = Math.max(0, nowMinutes - shiftEnd);
    const isFridayResult = await pool.query(`SELECT EXTRACT(DOW FROM ${todayJordanSql})::int AS dow`);
    const isFriday = Number(isFridayResult.rows[0].dow) === 5;
    const overtimeType = overtimeMinutes > 0 ? (isFriday ? 'friday' : 'normal') : null;
    const extraNote = overtimeMinutes > 0 ? ` - إضافي ${overtimeMinutes} دقيقة (${isFriday ? 'جمعة/عطلة' : 'عادي'})` : '';
    const baseNotes = existing.rows[0].notes || 'تسجيل من بوابة الموظف';
    const result = await pool.query(`UPDATE attendance_records SET check_out=${nowJordanSql}, overtime_minutes=$2, overtime_type=$3, notes=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [existing.rows[0].id, overtimeMinutes, overtimeType, `${baseNotes}${extraNote}`]);
    res.json({ message: overtimeMinutes > 0 ? `تم تسجيل الانصراف مع احتساب ${overtimeMinutes} دقيقة إضافي` : 'تم تسجيل الانصراف بنجاح', attendance: result.rows[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getSelfAttendance = async (req, res) => {
  try {
    await ensurePortalSchema();
    const employeeId = await requireEmployee(req, res);
    if (!employeeId) return;
    const month = String(req.query.month || new Date().toISOString().slice(0,7));
    const result = await pool.query(
      `SELECT
         a.attendance_date,
         a.check_in,
         a.check_out,
         a.status,
         a.notes,
         a.source,
         a.absence_reason,
         a.leave_request_id,
         COALESCE(ws.id, default_ws.id) AS shift_id,
         COALESCE(ws.name, default_ws.name, 'الدوام الافتراضي') AS shift_name,
         COALESCE(ws.start_time, default_ws.start_time, TIME '07:00') AS shift_start_time,
         COALESCE(ws.end_time, default_ws.end_time, TIME '15:00') AS shift_end_time,
         COALESCE(ws.late_grace_minutes, default_ws.late_grace_minutes, 0) AS shift_late_grace_minutes,
         COALESCE(ws.official_work_hours, default_ws.official_work_hours, 8) AS official_work_hours,
         COALESCE(fes.basic_salary, e.basic_salary, 0) AS basic_salary,
         COALESCE(fes.late_minute_multiplier, 2) AS late_minute_multiplier,
         COALESCE(fes.late_round_minutes, 30) AS late_round_minutes,
         COALESCE(fes.late_round_to_hours, true) AS late_round_to_hours,
         GREATEST(
           0,
           COALESCE(a.late_minutes, 0),
           CASE WHEN a.check_in IS NULL THEN 0 ELSE
             ((EXTRACT(HOUR FROM a.check_in)::int * 60) + EXTRACT(MINUTE FROM a.check_in)::int)
             - ((EXTRACT(HOUR FROM COALESCE(ws.start_time, default_ws.start_time, TIME '07:00'))::int * 60) + EXTRACT(MINUTE FROM COALESCE(ws.start_time, default_ws.start_time, TIME '07:00'))::int)
             - COALESCE(ws.late_grace_minutes, default_ws.late_grace_minutes, 0)
           END
         )::int AS late_minutes,
         GREATEST(
           0,
           COALESCE(a.overtime_minutes, 0),
           CASE WHEN a.check_out IS NULL THEN 0 ELSE
             ((EXTRACT(HOUR FROM a.check_out)::int * 60) + EXTRACT(MINUTE FROM a.check_out)::int)
             - ((EXTRACT(HOUR FROM COALESCE(ws.end_time, default_ws.end_time, TIME '15:00'))::int * 60) + EXTRACT(MINUTE FROM COALESCE(ws.end_time, default_ws.end_time, TIME '15:00'))::int)
           END
         )::int AS overtime_minutes,
         COALESCE(a.overtime_type, CASE WHEN EXTRACT(DOW FROM a.attendance_date)::int = 5 THEN 'friday' ELSE 'normal' END) AS overtime_type
       FROM attendance_records a
       JOIN employees e ON e.id=a.employee_id
       LEFT JOIN employee_shift_assignments esa ON esa.employee_id=a.employee_id
        AND esa.is_active=true
        AND esa.effective_from <= a.attendance_date
        AND (esa.effective_to IS NULL OR esa.effective_to >= a.attendance_date)
       LEFT JOIN work_shifts ws ON ws.id=esa.shift_id AND COALESCE(ws.is_active,true)=true
       LEFT JOIN work_shifts default_ws ON default_ws.is_default=true AND COALESCE(default_ws.is_active,true)=true
       LEFT JOIN finance_employee_settings fes ON fes.employee_id=a.employee_id
       WHERE a.employee_id=$1 AND a.attendance_date >= ($2 || '-01')::date AND a.attendance_date < (($2 || '-01')::date + INTERVAL '1 month')
       ORDER BY a.attendance_date ASC, esa.effective_from DESC NULLS LAST, esa.id DESC NULLS LAST`,
      [employeeId, month]
    );
    res.json({ attendance: result.rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getSelfFinanceSettings = async (req, res) => {
  try {
    await ensurePortalSchema();
    const employeeId = await requireEmployee(req, res);
    if (!employeeId) return;
    const settings = await pool.query(
      `SELECT COALESCE(fes.basic_salary, e.basic_salary, 0) AS basic_salary,
              COALESCE(fes.overtime_multiplier, 1.25) AS overtime_multiplier,
              COALESCE(fes.holiday_overtime_multiplier, 1.5) AS holiday_overtime_multiplier,
              late_deduction_method, late_minute_multiplier, late_round_minutes,
              late_round_to_hours, personal_exit_hours_per_leave_day
       FROM employees e
       LEFT JOIN finance_employee_settings fes ON fes.employee_id=e.id
       WHERE e.id=$1
       LIMIT 1`,
      [employeeId]
    );
    res.json({ settings: settings.rows[0] || null, currency: 'JOD' });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getSelfRequests = async (req, res) => {
  try {
    await ensurePortalSchema();
    const employeeId = await requireEmployee(req, res);
    if (!employeeId) return;
    const result = await pool.query(
      `SELECT *
       FROM employee_requests
       WHERE employee_id=$1 OR created_by=$2
       ORDER BY COALESCE(updated_at, created_at, submitted_at) DESC, id DESC`,
      [employeeId, req.user.id]
    );
    res.json({ requests: result.rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getSelfSalarySlip = async (req, res) => {
  try {
    await ensurePortalSchema();
    const employeeId = await requireEmployee(req, res);
    if (!employeeId) return;
    const month = String(req.query.month || '');
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'الشهر مطلوب بصيغة YYYY-MM' });
    const salary = await pool.query(`SELECT * FROM salary_records WHERE employee_id=$1 AND salary_month=$2 AND status IN ('paid','closed') ORDER BY id DESC LIMIT 1`, [employeeId, month]);
    if (!salary.rows.length) {
      const anySalary = await pool.query(`SELECT status FROM salary_records WHERE employee_id=$1 AND salary_month=$2 ORDER BY id DESC LIMIT 1`, [employeeId, month]);
      const status = anySalary.rows[0]?.status;
      return res.status(404).json({ error: status ? `قسيمة الراتب موجودة لكنها غير منشورة للموظف بعد. الحالة الحالية: ${status}` : 'لا توجد قسيمة راتب لهذا الشهر' });
    }
    const items = await pool.query(`SELECT * FROM salary_record_items WHERE salary_record_id=$1 AND COALESCE(amount,0) <> 0 ORDER BY item_type DESC, id ASC`, [salary.rows[0].id]);
    res.json({ salary: salary.rows[0], items: items.rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

module.exports = { getSelfProfile, getToday, checkInOut, getSelfAttendance, getSelfRequests, getSelfSalarySlip, getSelfFinanceSettings };
