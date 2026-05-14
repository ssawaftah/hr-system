const pool = require("../db");

const ensureDepartmentSchema = async () => {
  await pool.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS parent_id INTEGER`);
  await pool.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS manager_id INTEGER`);
  await pool.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS color VARCHAR(40)`);
  await pool.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
};

const makeTree = (rows) => {
  const byId = {};
  rows.forEach((d) => { byId[d.id] = { ...d, children: [] }; });
  const roots = [];
  rows.forEach((d) => {
    if (d.parent_id && byId[d.parent_id]) byId[d.parent_id].children.push(byId[d.id]);
    else roots.push(byId[d.id]);
  });
  return roots;
};

const getDepartmentStats = (departments) => ({
  total: departments.length,
  active: departments.filter((item) => item.is_active).length,
  inactive: departments.filter((item) => !item.is_active).length,
  main: departments.filter((item) => !item.parent_id).length,
  sub: departments.filter((item) => item.parent_id).length,
  total_employees: departments.reduce((sum, item) => sum + Number(item.employee_count || 0), 0),
});

const departmentSelectSql = `
  SELECT
    d.id,
    d.name,
    d.description,
    d.parent_id,
    p.name AS parent_name,
    d.manager_id,
    m.full_name AS manager_name,
    m.employee_number AS manager_employee_number,
    COALESCE(m.job_title_name, m.job_title) AS manager_job_title,
    d.color,
    d.is_active,
    d.created_at,
    d.updated_at,
    COALESCE(employee_counts.employee_count, 0)::int AS employee_count,
    COALESCE(employee_counts.active_employee_count, 0)::int AS active_employee_count,
    COALESCE(children_counts.children_count, 0)::int AS children_count,
    COALESCE(shifts_counts.shift_count, 0)::int AS shift_count
  FROM departments d
  LEFT JOIN departments p ON p.id = d.parent_id
  LEFT JOIN employees m ON m.id = d.manager_id
  LEFT JOIN (
    SELECT department_id,
      COUNT(*) AS employee_count,
      COUNT(*) FILTER (WHERE COALESCE(is_active, true) = true) AS active_employee_count
    FROM employees
    GROUP BY department_id
  ) employee_counts ON employee_counts.department_id = d.id
  LEFT JOIN (
    SELECT parent_id, COUNT(*) AS children_count
    FROM departments
    WHERE parent_id IS NOT NULL
    GROUP BY parent_id
  ) children_counts ON children_counts.parent_id = d.id
  LEFT JOIN (
    SELECT e.department_id, COUNT(DISTINCT esa.shift_id) AS shift_count
    FROM employees e
    JOIN employee_shift_assignments esa ON esa.employee_id = e.id AND esa.is_active = true
    GROUP BY e.department_id
  ) shifts_counts ON shifts_counts.department_id = d.id
`;

const getDepartments = async (req, res) => {
  try {
    await ensureDepartmentSchema();
    const result = await pool.query(`
      ${departmentSelectSql}
      ORDER BY COALESCE(d.parent_id, d.id), d.parent_id NULLS FIRST, d.id ASC
    `);
    res.status(200).json({ departments: result.rows, tree: makeTree(result.rows), stats: getDepartmentStats(result.rows) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getDepartmentById = async (req, res) => {
  try {
    await ensureDepartmentSchema();
    const { id } = req.params;
    const departmentResult = await pool.query(`${departmentSelectSql} WHERE d.id=$1`, [id]);
    if (!departmentResult.rows.length) return res.status(404).json({ error: "القسم غير موجود" });
    const employees = await pool.query(`
      SELECT e.id, e.full_name, e.employee_number, COALESCE(e.job_title_name, e.job_title) AS job_title, e.phone, e.email, e.is_active,
        ws.name AS shift_name, ws.shift_type
      FROM employees e
      LEFT JOIN employee_shift_assignments esa ON esa.employee_id = e.id AND esa.is_active = true AND COALESCE(esa.effective_to, DATE '9999-12-31') >= CURRENT_DATE
      LEFT JOIN work_shifts ws ON ws.id = esa.shift_id
      WHERE e.department_id=$1
      ORDER BY COALESCE(e.is_active,true) DESC, e.full_name ASC
    `, [id]);
    const children = await pool.query(`SELECT id, name, description, is_active FROM departments WHERE parent_id=$1 ORDER BY name ASC`, [id]);
    res.status(200).json({ department: departmentResult.rows[0], employees: employees.rows, children: children.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createDepartment = async (req, res) => {
  try {
    await ensureDepartmentSchema();
    const { name, description, parent_id, manager_id, color, is_active } = req.body;
    if (!name) return res.status(400).json({ error: "اسم القسم مطلوب" });
    if (parent_id) {
      const parent = await pool.query(`SELECT id FROM departments WHERE id = $1`, [parent_id]);
      if (!parent.rows.length) return res.status(400).json({ error: "القسم الأب غير موجود" });
    }
    if (manager_id) {
      const manager = await pool.query(`SELECT id FROM employees WHERE id = $1`, [manager_id]);
      if (!manager.rows.length) return res.status(400).json({ error: "مدير القسم غير موجود ضمن الموظفين" });
    }
    const result = await pool.query(
      `INSERT INTO departments (name, description, parent_id, manager_id, color, is_active, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)
       RETURNING id, name, description, parent_id, manager_id, color, is_active, created_at, updated_at`,
      [name.trim(), description || null, parent_id || null, manager_id || null, color || null, is_active !== false]
    );
    res.status(201).json({ message: "تم إنشاء القسم بنجاح", department: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(400).json({ error: "اسم القسم موجود مسبقًا" });
    res.status(500).json({ error: error.message });
  }
};

const updateDepartment = async (req, res) => {
  try {
    await ensureDepartmentSchema();
    const { id } = req.params;
    const { name, description, is_active, parent_id, manager_id, color } = req.body;
    if (!name) return res.status(400).json({ error: "اسم القسم مطلوب" });
    if (parent_id && String(parent_id) === String(id)) return res.status(400).json({ error: "لا يمكن أن يكون القسم أبًا لنفسه" });
    if (parent_id) {
      const parent = await pool.query(`SELECT id, parent_id FROM departments WHERE id = $1`, [parent_id]);
      if (!parent.rows.length) return res.status(400).json({ error: "القسم الأب غير موجود" });
      if (String(parent.rows[0].parent_id) === String(id)) return res.status(400).json({ error: "لا يمكن إنشاء علاقة دائرية بين الأقسام" });
    }
    if (manager_id) {
      const manager = await pool.query(`SELECT id FROM employees WHERE id = $1`, [manager_id]);
      if (!manager.rows.length) return res.status(400).json({ error: "مدير القسم غير موجود ضمن الموظفين" });
    }
    const result = await pool.query(
      `UPDATE departments SET name=$1, description=$2, parent_id=$3, is_active=$4, manager_id=$5, color=$6, updated_at=CURRENT_TIMESTAMP
       WHERE id=$7 RETURNING id, name, description, parent_id, manager_id, color, is_active, created_at, updated_at`,
      [name.trim(), description || null, parent_id || null, is_active !== false, manager_id || null, color || null, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "القسم غير موجود" });
    res.status(200).json({ message: "تم تعديل القسم بنجاح", department: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    await ensureDepartmentSchema();
    const { id } = req.params;
    const children = await pool.query(`SELECT COUNT(*)::int AS count FROM departments WHERE parent_id=$1`, [id]);
    if (children.rows[0].count) return res.status(409).json({ error: "لا يمكن حذف قسم يحتوي على أقسام فرعية" });
    const employees = await pool.query(`SELECT COUNT(*)::int AS count FROM employees WHERE department_id=$1`, [id]);
    if (employees.rows[0].count) return res.status(409).json({ error: "لا يمكن حذف قسم يحتوي على موظفين. انقل الموظفين أولًا أو عطّل القسم بدل الحذف." });
    const result = await pool.query(`DELETE FROM departments WHERE id=$1 RETURNING id`, [id]);
    if (!result.rows.length) return res.status(404).json({ error: "القسم غير موجود" });
    res.status(200).json({ message: "تم حذف القسم بنجاح" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getDepartments, getDepartmentById, createDepartment, updateDepartment, deleteDepartment };
