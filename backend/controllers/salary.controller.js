const pool = require("../db");

const money = (value) => Number(value || 0);
const getActorId = (req) => req.user?.id || null;
const monthStart = (salaryMonth) => `${salaryMonth}-01`;
const nextMonthStart = (salaryMonth) => {
  const [year, month] = String(salaryMonth).split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return date.toISOString().slice(0, 10);
};

const normalizeStatus = (status) => {
  const allowed = ["draft", "pending_approval", "approved", "paid", "closed", "review", "published"];
  if (status === "review") return "pending_approval";
  if (status === "published") return "paid";
  return allowed.includes(status) ? status : "draft";
};

const ensureSalarySchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS salary_records (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      salary_month VARCHAR(7) NOT NULL,
      basic_salary NUMERIC(12,2) DEFAULT 0,
      allowances NUMERIC(12,2) DEFAULT 0,
      deductions NUMERIC(12,2) DEFAULT 0,
      net_salary NUMERIC(12,2) DEFAULT 0,
      status VARCHAR(40) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS salary_year INTEGER`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS salary_month_number INTEGER`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS bonuses NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS advances NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS manual_adjustments NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS gross_salary NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS total_income NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS total_deductions NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS social_security_amount NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS overtime_amount NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS friday_overtime_amount NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS late_deduction_amount NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS absence_deduction_amount NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS notes TEXT`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS calculation_details JSONB DEFAULT '{}'::jsonb`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS snapshot JSONB DEFAULT '{}'::jsonb`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS approved_by INTEGER`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS paid_by INTEGER`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP`);
  await pool.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS salary_records_employee_month_unique_idx ON salary_records(employee_id, salary_month)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_employee_settings (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
      basic_salary NUMERIC(12,2) DEFAULT 0,
      social_security_rate NUMERIC(6,3) DEFAULT 7.5,
      overtime_multiplier NUMERIC(5,2) DEFAULT 1.25,
      holiday_overtime_multiplier NUMERIC(5,2) DEFAULT 1.5,
      late_deduction_method VARCHAR(50) DEFAULT 'hourly',
      absence_deduction_method VARCHAR(50) DEFAULT 'daily',
      salary_cycle_start_day INTEGER DEFAULT 1,
      salary_cycle_end_day INTEGER DEFAULT 31,
      notes TEXT,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS salary_record_items (
      id SERIAL PRIMARY KEY,
      salary_record_id INTEGER NOT NULL REFERENCES salary_records(id) ON DELETE CASCADE,
      item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('income','deduction')),
      source VARCHAR(40) DEFAULT 'manual',
      name VARCHAR(160) NOT NULL,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      reason TEXT,
      notes TEXT,
      is_manual BOOLEAN DEFAULT true,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_advances (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      request_id INTEGER,
      amount NUMERIC(12,2) NOT NULL,
      paid_at DATE,
      deduction_method VARCHAR(30) DEFAULT 'installments',
      installments_count INTEGER DEFAULT 1,
      monthly_installment_amount NUMERIC(12,2) DEFAULT 0,
      deduction_start_month VARCHAR(7),
      status VARCHAR(30) DEFAULT 'active',
      reason TEXT,
      notes TEXT,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS advance_installments (
      id SERIAL PRIMARY KEY,
      advance_id INTEGER NOT NULL REFERENCES employee_advances(id) ON DELETE CASCADE,
      salary_month VARCHAR(7) NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      status VARCHAR(30) DEFAULT 'due',
      salary_record_id INTEGER REFERENCES salary_records(id) ON DELETE SET NULL,
      deferred_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS salary_audit_logs (
      id SERIAL PRIMARY KEY,
      salary_record_id INTEGER REFERENCES salary_records(id) ON DELETE CASCADE,
      actor_user_id INTEGER,
      action VARCHAR(120) NOT NULL,
      old_value JSONB,
      new_value JSONB,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS salary_payment_records (
      id SERIAL PRIMARY KEY,
      salary_record_id INTEGER NOT NULL REFERENCES salary_records(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      amount NUMERIC(12,2) NOT NULL,
      paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      payment_method VARCHAR(60),
      reference_number VARCHAR(120),
      notes TEXT,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const writeSalaryAudit = async (salaryRecordId, req, action, oldValue = null, newValue = null, note = null) => {
  await pool.query(
    `INSERT INTO salary_audit_logs (salary_record_id, actor_user_id, action, old_value, new_value, note) VALUES ($1,$2,$3,$4,$5,$6)`,
    [salaryRecordId, getActorId(req), action, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, note]
  );
};

const ensureFinanceSettingsForEmployee = async (employeeId, req = null) => {
  const existing = await pool.query(`SELECT * FROM finance_employee_settings WHERE employee_id=$1`, [employeeId]);
  if (existing.rows.length) return existing.rows[0];

  const employee = await pool.query(`SELECT id, basic_salary, social_security_rate FROM employees WHERE id=$1`, [employeeId]);
  if (!employee.rows.length) return null;

  const result = await pool.query(
    `INSERT INTO finance_employee_settings (employee_id, basic_salary, social_security_rate, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$4)
     ON CONFLICT (employee_id) DO UPDATE SET employee_id=EXCLUDED.employee_id
     RETURNING *`,
    [employeeId, money(employee.rows[0].basic_salary), money(employee.rows[0].social_security_rate || 7.5), req ? getActorId(req) : null]
  );
  return result.rows[0];
};

const getAttendanceStats = async (employeeId, salaryMonth) => {
  const result = await pool.query(
    `SELECT
      COUNT(*)::int AS total_records,
      COUNT(*) FILTER (WHERE status = 'present')::int AS present_days,
      COUNT(*) FILTER (WHERE status = 'late')::int AS late_days,
      COUNT(*) FILTER (WHERE status = 'early_leave')::int AS early_leave_days,
      COUNT(*) FILTER (WHERE status = 'absent')::int AS absent_days,
      COUNT(*) FILTER (WHERE status = 'absent' AND absence_reason = 'excused_leave')::int AS excused_absent_days,
      COUNT(*) FILTER (WHERE status = 'absent' AND COALESCE(absence_reason, '') <> 'excused_leave')::int AS unexcused_absent_days,
      0::numeric AS normal_overtime_hours,
      0::numeric AS friday_overtime_hours,
      COUNT(*) FILTER (WHERE status = 'late')::numeric AS late_hours
     FROM attendance_records
     WHERE employee_id=$1 AND attendance_date >= $2::date AND attendance_date < $3::date`,
    [employeeId, monthStart(salaryMonth), nextMonthStart(salaryMonth)]
  );
  return result.rows[0] || {};
};

const getApprovedAdvanceInstallments = async (employeeId, salaryMonth) => {
  const result = await pool.query(
    `SELECT ai.*, ea.amount AS advance_total, ea.reason
     FROM advance_installments ai
     JOIN employee_advances ea ON ea.id = ai.advance_id
     WHERE ea.employee_id=$1 AND ai.salary_month=$2 AND ai.status='due' AND ea.status IN ('active','deferred')
     ORDER BY ai.id ASC`,
    [employeeId, salaryMonth]
  );
  return result.rows;
};

const buildSalaryDraft = async (employeeId, salaryMonth, req = null) => {
  const employeeResult = await pool.query(
    `SELECT e.id, e.full_name, e.employee_number, e.department_id, d.name AS department_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.id=$1`,
    [employeeId]
  );
  if (!employeeResult.rows.length) throw new Error("الموظف غير موجود");

  const employee = employeeResult.rows[0];
  const settings = await ensureFinanceSettingsForEmployee(employeeId, req);
  const attendance = await getAttendanceStats(employeeId, salaryMonth);
  const installments = await getApprovedAdvanceInstallments(employeeId, salaryMonth);

  const baseSalary = money(settings.basic_salary);
  const hourlyRate = baseSalary / 30 / 8;
  const dailyRate = baseSalary / 30;
  const normalOvertimeHours = money(attendance.normal_overtime_hours);
  const fridayOvertimeHours = money(attendance.friday_overtime_hours);
  const lateHours = money(attendance.late_hours);
  const unexcusedAbsentDays = money(attendance.unexcused_absent_days);

  const normalOvertimeAmount = normalOvertimeHours * hourlyRate * money(settings.overtime_multiplier || 1.25);
  const fridayOvertimeAmount = fridayOvertimeHours * hourlyRate * money(settings.holiday_overtime_multiplier || 1.5);
  const socialSecurityAmount = baseSalary * (money(settings.social_security_rate) / 100);
  const advanceAmount = installments.reduce((sum, item) => sum + money(item.amount), 0);
  const lateDeductionAmount = lateHours * hourlyRate;
  const absenceDeductionAmount = unexcusedAbsentDays * dailyRate;

  const autoItems = [
    { item_type: "income", source: "auto", name: "الراتب الأساسي", amount: baseSalary, reason: "من إعدادات المالية للموظف", is_manual: false },
    { item_type: "income", source: "auto", name: "بدل ساعات الإضافي العادي", amount: normalOvertimeAmount, reason: `${normalOvertimeHours} ساعة × معامل ${settings.overtime_multiplier}`, is_manual: false },
    { item_type: "income", source: "auto", name: "بدل إضافي الجمعة/العطلة", amount: fridayOvertimeAmount, reason: `${fridayOvertimeHours} ساعة × معامل ${settings.holiday_overtime_multiplier}`, is_manual: false },
    { item_type: "deduction", source: "auto", name: "الضمان الاجتماعي", amount: socialSecurityAmount, reason: `${settings.social_security_rate}% من الراتب الأساسي`, is_manual: false },
    { item_type: "deduction", source: "auto", name: "السلف المستحقة لهذا الشهر", amount: advanceAmount, reason: `${installments.length} قسط مستحق`, is_manual: false },
    { item_type: "deduction", source: "auto", name: "خصم التأخير", amount: lateDeductionAmount, reason: `${lateHours} ساعة تأخير`, is_manual: false },
    { item_type: "deduction", source: "auto", name: "خصم الغياب بدون عذر", amount: absenceDeductionAmount, reason: `${unexcusedAbsentDays} يوم`, is_manual: false },
  ];

  const totalIncome = autoItems.filter((i) => i.item_type === "income").reduce((sum, i) => sum + money(i.amount), 0);
  const totalDeductions = autoItems.filter((i) => i.item_type === "deduction").reduce((sum, i) => sum + money(i.amount), 0);

  return {
    employee,
    settings,
    attendance,
    advance_installments: installments,
    items: autoItems,
    totals: {
      total_income: totalIncome,
      total_deductions: totalDeductions,
      net_salary: totalIncome - totalDeductions,
      social_security_amount: socialSecurityAmount,
      overtime_amount: normalOvertimeAmount,
      friday_overtime_amount: fridayOvertimeAmount,
      late_deduction_amount: lateDeductionAmount,
      absence_deduction_amount: absenceDeductionAmount,
      advances_amount: advanceAmount,
    },
    snapshot: {
      employee,
      settings,
      attendance,
      advance_installments: installments,
      generated_at: new Date().toISOString(),
    },
    calculation_details: {
      hourly_rate: hourlyRate,
      daily_rate: dailyRate,
      formulas: {
        social_security: `${baseSalary} × ${settings.social_security_rate}%`,
        normal_overtime: `${normalOvertimeHours} × ${hourlyRate} × ${settings.overtime_multiplier}`,
        friday_overtime: `${fridayOvertimeHours} × ${hourlyRate} × ${settings.holiday_overtime_multiplier}`,
        late_deduction: `${lateHours} × ${hourlyRate}`,
        absence_deduction: `${unexcusedAbsentDays} × ${dailyRate}`,
      },
    },
  };
};

const getFinanceOverview = async (req, res) => {
  try {
    await ensureSalarySchema();
    const salaries = await pool.query(`SELECT status, COUNT(*)::int AS count, COALESCE(SUM(net_salary),0)::numeric AS total FROM salary_records GROUP BY status`);
    const advances = await pool.query(`SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount),0)::numeric AS total FROM employee_advances GROUP BY status`);
    const settings = await pool.query(`SELECT COUNT(*)::int AS configured_employees FROM finance_employee_settings`);
    res.status(200).json({ overview: { salaries: salaries.rows, advances: advances.rows, settings: settings.rows[0] } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getFinanceSettings = async (req, res) => {
  try {
    await ensureSalarySchema();
    const result = await pool.query(`
      SELECT fs.*, e.full_name AS employee_name, e.employee_number, d.name AS department_name
      FROM finance_employee_settings fs
      JOIN employees e ON e.id = fs.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      ORDER BY e.full_name ASC
    `);
    res.status(200).json({ settings: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const saveFinanceSetting = async (req, res) => {
  try {
    await ensureSalarySchema();
    const { employee_id, basic_salary, social_security_rate, overtime_multiplier, holiday_overtime_multiplier, late_deduction_method, absence_deduction_method, salary_cycle_start_day, salary_cycle_end_day, notes } = req.body;
    if (!employee_id) return res.status(400).json({ error: "الموظف مطلوب" });
    const employee = await pool.query(`SELECT id FROM employees WHERE id=$1`, [employee_id]);
    if (!employee.rows.length) return res.status(404).json({ error: "الموظف غير موجود" });

    const result = await pool.query(
      `INSERT INTO finance_employee_settings
       (employee_id, basic_salary, social_security_rate, overtime_multiplier, holiday_overtime_multiplier, late_deduction_method, absence_deduction_method, salary_cycle_start_day, salary_cycle_end_day, notes, created_by, updated_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,CURRENT_TIMESTAMP)
       ON CONFLICT (employee_id) DO UPDATE SET
         basic_salary=EXCLUDED.basic_salary,
         social_security_rate=EXCLUDED.social_security_rate,
         overtime_multiplier=EXCLUDED.overtime_multiplier,
         holiday_overtime_multiplier=EXCLUDED.holiday_overtime_multiplier,
         late_deduction_method=EXCLUDED.late_deduction_method,
         absence_deduction_method=EXCLUDED.absence_deduction_method,
         salary_cycle_start_day=EXCLUDED.salary_cycle_start_day,
         salary_cycle_end_day=EXCLUDED.salary_cycle_end_day,
         notes=EXCLUDED.notes,
         updated_by=EXCLUDED.updated_by,
         updated_at=CURRENT_TIMESTAMP
       RETURNING *`,
      [employee_id, money(basic_salary), money(social_security_rate || 7.5), money(overtime_multiplier || 1.25), money(holiday_overtime_multiplier || 1.5), late_deduction_method || "hourly", absence_deduction_method || "daily", Number(salary_cycle_start_day || 1), Number(salary_cycle_end_day || 31), notes || null, getActorId(req)]
    );

    res.status(200).json({ message: "تم حفظ إعدادات راتب الموظف من قسم المالية", setting: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const generateSalary = async (req, res) => {
  try {
    await ensureSalarySchema();
    const { employee_id, salary_month, status = "draft" } = req.body;
    if (!employee_id || !salary_month) return res.status(400).json({ error: "الموظف والشهر مطلوبان" });

    const existing = await pool.query(`SELECT * FROM salary_records WHERE employee_id=$1 AND salary_month=$2`, [employee_id, salary_month]);
    if (existing.rows.length && ["approved", "paid", "closed"].includes(existing.rows[0].status)) {
      return res.status(409).json({ error: "لا يمكن إعادة توليد كشف معتمد أو مدفوع أو مغلق إلا بصلاحية خاصة" });
    }

    const draft = await buildSalaryDraft(employee_id, salary_month, req);
    const [year, monthNumber] = salary_month.split("-").map(Number);

    const result = await pool.query(
      `INSERT INTO salary_records
       (employee_id, salary_month, salary_year, salary_month_number, basic_salary, allowances, bonuses, deductions, advances, manual_adjustments, gross_salary, total_income, total_deductions, net_salary, social_security_amount, overtime_amount, friday_overtime_amount, late_deduction_amount, absence_deduction_amount, status, snapshot, calculation_details, updated_at)
       VALUES ($1,$2,$3,$4,$5,0,0,$6,$7,0,$8,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,CURRENT_TIMESTAMP)
       ON CONFLICT (employee_id, salary_month) DO UPDATE SET
         salary_year=EXCLUDED.salary_year,
         salary_month_number=EXCLUDED.salary_month_number,
         basic_salary=EXCLUDED.basic_salary,
         deductions=EXCLUDED.deductions,
         advances=EXCLUDED.advances,
         gross_salary=EXCLUDED.gross_salary,
         total_income=EXCLUDED.total_income,
         total_deductions=EXCLUDED.total_deductions,
         net_salary=EXCLUDED.net_salary,
         social_security_amount=EXCLUDED.social_security_amount,
         overtime_amount=EXCLUDED.overtime_amount,
         friday_overtime_amount=EXCLUDED.friday_overtime_amount,
         late_deduction_amount=EXCLUDED.late_deduction_amount,
         absence_deduction_amount=EXCLUDED.absence_deduction_amount,
         status=EXCLUDED.status,
         snapshot=EXCLUDED.snapshot,
         calculation_details=EXCLUDED.calculation_details,
         updated_at=CURRENT_TIMESTAMP
       RETURNING *`,
      [employee_id, salary_month, year, monthNumber, draft.settings.basic_salary, draft.totals.social_security_amount + draft.totals.late_deduction_amount + draft.totals.absence_deduction_amount, draft.totals.advances_amount, draft.totals.total_income, draft.totals.total_deductions, draft.totals.net_salary, draft.totals.social_security_amount, draft.totals.overtime_amount, draft.totals.friday_overtime_amount, draft.totals.late_deduction_amount, draft.totals.absence_deduction_amount, normalizeStatus(status), JSON.stringify(draft.snapshot), JSON.stringify(draft.calculation_details)]
    );

    const salaryRecord = result.rows[0];
    await pool.query(`DELETE FROM salary_record_items WHERE salary_record_id=$1 AND is_manual=false`, [salaryRecord.id]);
    for (const item of draft.items) {
      await pool.query(
        `INSERT INTO salary_record_items (salary_record_id, item_type, source, name, amount, reason, is_manual, created_by) VALUES ($1,$2,$3,$4,$5,$6,false,$7)`,
        [salaryRecord.id, item.item_type, item.source, item.name, item.amount, item.reason, getActorId(req)]
      );
    }
    await pool.query(`UPDATE advance_installments SET salary_record_id=$1 WHERE salary_month=$2 AND advance_id IN (SELECT id FROM employee_advances WHERE employee_id=$3)`, [salaryRecord.id, salary_month, employee_id]);
    await writeSalaryAudit(salaryRecord.id, req, existing.rows.length ? "إعادة حساب كشف الراتب" : "توليد كشف راتب", existing.rows[0] || null, salaryRecord);

    res.status(201).json({ message: "تم توليد كشف الراتب وحفظ Snapshot", salary: salaryRecord, draft });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const addSalaryItem = async (req, res) => {
  try {
    await ensureSalarySchema();
    const { id } = req.params;
    const { item_type, name, amount, reason, notes } = req.body;
    if (!['income','deduction'].includes(item_type)) return res.status(400).json({ error: "نوع الحقل يجب أن يكون دخل أو اقتطاع" });
    if (!name || money(amount) <= 0) return res.status(400).json({ error: "اسم الحقل والمبلغ مطلوبان" });

    const salary = await pool.query(`SELECT * FROM salary_records WHERE id=$1`, [id]);
    if (!salary.rows.length) return res.status(404).json({ error: "كشف الراتب غير موجود" });
    if (["approved", "paid", "closed"].includes(salary.rows[0].status)) return res.status(409).json({ error: "لا يمكن تعديل كشف معتمد أو مدفوع إلا بصلاحية خاصة" });

    const item = await pool.query(
      `INSERT INTO salary_record_items (salary_record_id, item_type, source, name, amount, reason, notes, is_manual, created_by) VALUES ($1,$2,'manual',$3,$4,$5,$6,true,$7) RETURNING *`,
      [id, item_type, name, money(amount), reason || null, notes || null, getActorId(req)]
    );
    await recalculateSalaryTotals(id);
    await writeSalaryAudit(id, req, "إضافة حقل يدوي لكشف الراتب", null, item.rows[0]);
    res.status(201).json({ message: "تمت إضافة الحقل اليدوي", item: item.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const recalculateSalaryTotals = async (salaryRecordId) => {
  const totals = await pool.query(
    `SELECT
      COALESCE(SUM(amount) FILTER (WHERE item_type='income'),0)::numeric AS total_income,
      COALESCE(SUM(amount) FILTER (WHERE item_type='deduction'),0)::numeric AS total_deductions
     FROM salary_record_items WHERE salary_record_id=$1`,
    [salaryRecordId]
  );
  const totalIncome = money(totals.rows[0].total_income);
  const totalDeductions = money(totals.rows[0].total_deductions);
  await pool.query(
    `UPDATE salary_records SET total_income=$1, gross_salary=$1, total_deductions=$2, net_salary=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$4`,
    [totalIncome, totalDeductions, totalIncome - totalDeductions, salaryRecordId]
  );
};

const getSalaryById = async (req, res) => {
  try {
    await ensureSalarySchema();
    const { id } = req.params;
    const salary = await pool.query(`SELECT s.*, e.full_name AS employee_name, e.employee_number FROM salary_records s JOIN employees e ON e.id=s.employee_id WHERE s.id=$1`, [id]);
    if (!salary.rows.length) return res.status(404).json({ error: "كشف الراتب غير موجود" });
    const items = await pool.query(`SELECT * FROM salary_record_items WHERE salary_record_id=$1 ORDER BY item_type DESC, id ASC`, [id]);
    const audit = await pool.query(`SELECT * FROM salary_audit_logs WHERE salary_record_id=$1 ORDER BY id DESC`, [id]);
    res.status(200).json({ salary: salary.rows[0], items: items.rows, audit_logs: audit.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSalaries = async (req, res) => {
  try {
    await ensureSalarySchema();
    const result = await pool.query(`
      SELECT s.*, e.full_name AS employee_name, e.employee_number, d.name AS primary_department_name
      FROM salary_records s
      JOIN employees e ON s.employee_id = e.id
      LEFT JOIN departments d ON d.id = e.department_id
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
    const draft = await buildSalaryDraft(employee_id, salary_month, req);
    res.status(200).json({ ...draft, note: "هذه معاينة حسابية قبل حفظ Snapshot. عند التوليد يتم حفظ نسخة ثابتة من البيانات." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createSalary = async (req, res) => {
  return generateSalary(req, res);
};

const updateSalaryStatus = async (req, res) => {
  try {
    await ensureSalarySchema();
    const { id } = req.params;
    const status = normalizeStatus(req.body.status);
    const existing = await pool.query(`SELECT * FROM salary_records WHERE id=$1`, [id]);
    if (!existing.rows.length) return res.status(404).json({ error: "كشف الراتب غير موجود" });

    const oldStatus = existing.rows[0].status;
    const allowedFlow = {
      draft: ["pending_approval", "draft"],
      pending_approval: ["draft", "approved", "pending_approval"],
      approved: ["paid", "approved"],
      paid: ["closed", "paid"],
      closed: ["closed"],
    };
    if (!allowedFlow[oldStatus || "draft"]?.includes(status)) return res.status(400).json({ error: "لا يمكن تنفيذ هذا الانتقال في حالة الكشف الحالية" });

    const result = await pool.query(
      `UPDATE salary_records SET status=$1,
        approved_at=CASE WHEN $1='approved' AND approved_at IS NULL THEN CURRENT_TIMESTAMP ELSE approved_at END,
        approved_by=CASE WHEN $1='approved' AND approved_by IS NULL THEN $2 ELSE approved_by END,
        paid_at=CASE WHEN $1='paid' AND paid_at IS NULL THEN CURRENT_TIMESTAMP ELSE paid_at END,
        paid_by=CASE WHEN $1='paid' AND paid_by IS NULL THEN $2 ELSE paid_by END,
        closed_at=CASE WHEN $1='closed' AND closed_at IS NULL THEN CURRENT_TIMESTAMP ELSE closed_at END,
        updated_at=CURRENT_TIMESTAMP
       WHERE id=$3 RETURNING *`,
      [status, getActorId(req), id]
    );
    await writeSalaryAudit(id, req, `تغيير حالة الكشف من ${oldStatus} إلى ${status}`, existing.rows[0], result.rows[0]);
    res.status(200).json({ message: "تم تحديث حالة كشف الراتب", salary: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteSalary = async (req, res) => {
  try {
    await ensureSalarySchema();
    const { id } = req.params;
    const existing = await pool.query(`SELECT status FROM salary_records WHERE id=$1`, [id]);
    if (!existing.rows.length) return res.status(404).json({ error: "كشف الراتب غير موجود" });
    if (["approved", "paid", "closed"].includes(existing.rows[0].status)) return res.status(409).json({ error: "لا يمكن حذف كشف راتب معتمد أو مدفوع أو مغلق" });
    await pool.query(`DELETE FROM salary_records WHERE id=$1`, [id]);
    res.status(200).json({ message: "تم حذف كشف الراتب" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createAdvance = async (req, res) => {
  try {
    await ensureSalarySchema();
    const { employee_id, amount, paid_at, deduction_method = "installments", installments_count = 1, monthly_installment_amount, deduction_start_month, reason, notes, request_id } = req.body;
    if (!employee_id || money(amount) <= 0) return res.status(400).json({ error: "الموظف ومبلغ السلفة مطلوبان" });
    const count = deduction_method === "one_time" ? 1 : Number(installments_count || 1);
    const monthly = money(monthly_installment_amount || (money(amount) / count));
    const startMonth = deduction_start_month;
    if (!startMonth) return res.status(400).json({ error: "شهر بداية الخصم مطلوب" });

    const advance = await pool.query(
      `INSERT INTO employee_advances (employee_id, request_id, amount, paid_at, deduction_method, installments_count, monthly_installment_amount, deduction_start_month, status, reason, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10,$11) RETURNING *`,
      [employee_id, request_id || null, money(amount), paid_at || null, deduction_method, count, monthly, startMonth, reason || null, notes || null, getActorId(req)]
    );

    const [startYear, startMonthNum] = startMonth.split("-").map(Number);
    for (let i = 0; i < count; i += 1) {
      const date = new Date(Date.UTC(startYear, startMonthNum - 1 + i, 1));
      const m = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      await pool.query(`INSERT INTO advance_installments (advance_id, salary_month, amount, status) VALUES ($1,$2,$3,'due')`, [advance.rows[0].id, m, monthly]);
    }

    res.status(201).json({ message: "تم إنشاء السلفة وجدولة أقساطها", advance: advance.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAdvances = async (req, res) => {
  try {
    await ensureSalarySchema();
    const result = await pool.query(`
      SELECT ea.*, e.full_name AS employee_name, e.employee_number
      FROM employee_advances ea
      JOIN employees e ON e.id=ea.employee_id
      ORDER BY ea.id DESC
    `);
    res.status(200).json({ advances: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  ensureSalarySchema,
  getFinanceOverview,
  getFinanceSettings,
  saveFinanceSetting,
  getSalaries,
  getSalaryById,
  getSalaryPreview,
  generateSalary,
  createSalary,
  addSalaryItem,
  updateSalaryStatus,
  deleteSalary,
  createAdvance,
  getAdvances,
};
