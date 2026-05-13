const pool = require("../db");

const ensureSalarySchema = async () => {
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS bonuses NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS advances NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS manual_adjustments NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS gross_salary NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS total_deductions NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS notes TEXT`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS published_at TIMESTAMP`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS approved_by INTEGER`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS salary_records_employee_month_unique_idx ON salary_records(employee_id, salary_month)`);
};

const toNumber = (value) => Number(value || 0);

const normalizeStatus = (status) => {
  const allowed = ["draft", "review", "approved", "published"];
  return allowed.includes(status) ? status : "draft";
};

const calculateSalary = (body) => {
  const basic = toNumber(body.basic_salary);
  const allowances = toNumber(body.allowances);
  const bonuses = toNumber(body.bonuses);
  const deductions = toNumber(body.deductions);
  const advances = toNumber(body.advances);
  const manualAdjustments = toNumber(body.manual_adjustments);
  const gross = basic + allowances + bonuses + manualAdjustments;
  const totalDeductions = deductions + advances;
  const net = gross - totalDeductions;
  return { basic, allowances, bonuses, deductions, advances, manualAdjustments, gross, totalDeductions, net };
};

const getAttendanceStats = async (employeeId, salaryMonth) => {
  const result = await pool.query(
    `
    SELECT
      COUNT(*)::int AS total_records,
      COUNT(*) FILTER (WHERE status = 'present')::int AS present_days,
      COUNT(*) FILTER (WHERE status = 'late')::int AS late_days,
      COUNT(*) FILTER (WHERE status = 'early_leave')::int AS early_leave_days,
      COUNT(*) FILTER (WHERE status = 'absent')::int AS absent_days,
      COUNT(*) FILTER (WHERE status = 'absent' AND absence_reason = 'excused_leave')::int AS excused_absent_days,
      COUNT(*) FILTER (WHERE status = 'absent' AND COALESCE(absence_reason, '') <> 'excused_leave')::int AS unexcused_absent_days
    FROM attendance_records
    WHERE employee_id = $1
      AND attendance_date::text LIKE $2
    `,
    [employeeId, `${salaryMonth}-%`]
  );
  return result.rows[0] || {};
};

const getSalaries = async (req, res) => {
  try {
    await ensureSalarySchema();
    const result = await pool.query(`
      SELECT
        s.id,
        s.employee_id,
        e.full_name AS employee_name,
        e.employee_number,
        s.salary_month,
        s.basic_salary,
        s.allowances,
        s.bonuses,
        s.deductions,
        s.advances,
        s.manual_adjustments,
        s.gross_salary,
        s.total_deductions,
        s.net_salary,
        s.status,
        s.notes,
        s.approved_at,
        s.published_at,
        s.created_at,
        s.updated_at,
        pd.name AS primary_department_name,
        sd.name AS sub_department_name
      FROM salary_records s
      JOIN employees e ON s.employee_id = e.id
      LEFT JOIN employee_departments epd ON epd.employee_id = e.id AND epd.is_primary = true
      LEFT JOIN departments pd ON pd.id = COALESCE(epd.department_id, e.department_id)
      LEFT JOIN employee_departments esd ON esd.employee_id = e.id AND esd.is_primary = false
      LEFT JOIN departments sd ON sd.id = esd.department_id
      ORDER BY s.id DESC
    `);

    res.status(200).json({ salaries: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSalaryPreview = async (req, res) => {
  try {
    await ensureSalarySchema();
    const { employee_id, salary_month } = req.query;
    if (!employee_id || !salary_month) return res.status(400).json({ error: "الموظف والشهر مطلوبان" });

    const employeeResult = await pool.query(
      `SELECT id, full_name, employee_number, basic_salary, social_security_enabled, social_security_rate FROM employees WHERE id = $1`,
      [employee_id]
    );
    if (!employeeResult.rows.length) return res.status(404).json({ error: "الموظف غير موجود" });

    const employee = employeeResult.rows[0];
    const attendance = await getAttendanceStats(employee_id, salary_month);

    res.status(200).json({
      employee,
      attendance,
      note: "هذه بيانات مساعدة فقط. لا يتم خصم الحضور تلقائيًا من الراتب إلا إذا أدخلت الخصم يدويًا.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createSalary = async (req, res) => {
  try {
    await ensureSalarySchema();
    const { employee_id, salary_month, notes } = req.body;
    if (!employee_id || !salary_month) return res.status(400).json({ error: "الموظف والشهر مطلوبان" });

    const employee = await pool.query(`SELECT id, basic_salary FROM employees WHERE id = $1`, [employee_id]);
    if (!employee.rows.length) return res.status(404).json({ error: "الموظف غير موجود" });

    const body = { ...req.body, basic_salary: req.body.basic_salary ?? employee.rows[0].basic_salary ?? 0 };
    const calc = calculateSalary(body);
    const status = normalizeStatus(req.body.status);

    const result = await pool.query(
      `
      INSERT INTO salary_records
      (employee_id, salary_month, basic_salary, allowances, bonuses, deductions, advances, manual_adjustments, gross_salary, total_deductions, net_salary, status, notes, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CURRENT_TIMESTAMP)
      ON CONFLICT (employee_id, salary_month)
      DO UPDATE SET
        basic_salary = EXCLUDED.basic_salary,
        allowances = EXCLUDED.allowances,
        bonuses = EXCLUDED.bonuses,
        deductions = EXCLUDED.deductions,
        advances = EXCLUDED.advances,
        manual_adjustments = EXCLUDED.manual_adjustments,
        gross_salary = EXCLUDED.gross_salary,
        total_deductions = EXCLUDED.total_deductions,
        net_salary = EXCLUDED.net_salary,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [employee_id, salary_month, calc.basic, calc.allowances, calc.bonuses, calc.deductions, calc.advances, calc.manualAdjustments, calc.gross, calc.totalDeductions, calc.net, status, notes || null]
    );

    res.status(201).json({ message: "تم حفظ مسودة الراتب بنجاح", salary: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateSalaryStatus = async (req, res) => {
  try {
    await ensureSalarySchema();
    const { id } = req.params;
    const status = normalizeStatus(req.body.status);

    const existing = await pool.query(`SELECT * FROM salary_records WHERE id = $1`, [id]);
    if (!existing.rows.length) return res.status(404).json({ error: "سجل الراتب غير موجود" });

    const oldStatus = existing.rows[0].status;
    const allowedFlow = {
      draft: ["review", "approved", "published", "draft"],
      review: ["draft", "approved", "published", "review"],
      approved: ["review", "published", "approved"],
      published: ["published"],
    };

    if (!allowedFlow[oldStatus || "draft"].includes(status)) {
      return res.status(400).json({ error: "لا يمكن تنفيذ هذا الانتقال في حالة الراتب الحالية" });
    }

    const result = await pool.query(
      `
      UPDATE salary_records
      SET status = $1,
          approved_at = CASE WHEN $1 IN ('approved','published') AND approved_at IS NULL THEN CURRENT_TIMESTAMP ELSE approved_at END,
          approved_by = CASE WHEN $1 IN ('approved','published') AND approved_by IS NULL THEN $2 ELSE approved_by END,
          published_at = CASE WHEN $1 = 'published' AND published_at IS NULL THEN CURRENT_TIMESTAMP ELSE published_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
      `,
      [status, req.user?.id || null, id]
    );

    res.status(200).json({ message: "تم تحديث حالة الراتب بنجاح", salary: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteSalary = async (req, res) => {
  try {
    await ensureSalarySchema();
    const { id } = req.params;
    const existing = await pool.query(`SELECT status FROM salary_records WHERE id = $1`, [id]);
    if (!existing.rows.length) return res.status(404).json({ error: "سجل الراتب غير موجود" });
    if (existing.rows[0].status === "published") return res.status(400).json({ error: "لا يمكن حذف راتب منشور" });

    await pool.query(`DELETE FROM salary_records WHERE id = $1`, [id]);
    res.status(200).json({ message: "تم حذف سجل الراتب بنجاح" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getSalaries, getSalaryPreview, createSalary, updateSalaryStatus, deleteSalary };
