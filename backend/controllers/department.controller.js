const pool = require("../db");

const ensureDepartmentSchema = async () => {
  await pool.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS parent_id INTEGER`);
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

const getDepartments = async (req, res) => {
  try {
    await ensureDepartmentSchema();
    const result = await pool.query(`
      SELECT d.id, d.name, d.description, d.parent_id, p.name AS parent_name, d.is_active, d.created_at, d.updated_at
      FROM departments d
      LEFT JOIN departments p ON p.id = d.parent_id
      ORDER BY COALESCE(d.parent_id, d.id), d.parent_id NULLS FIRST, d.id ASC
    `);
    res.status(200).json({ departments: result.rows, tree: makeTree(result.rows) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createDepartment = async (req, res) => {
  try {
    await ensureDepartmentSchema();
    const { name, description, parent_id } = req.body;
    if (!name) return res.status(400).json({ error: "اسم القسم مطلوب" });
    if (parent_id) {
      const parent = await pool.query(`SELECT id FROM departments WHERE id = $1`, [parent_id]);
      if (!parent.rows.length) return res.status(400).json({ error: "القسم الأب غير موجود" });
    }
    const result = await pool.query(
      `INSERT INTO departments (name, description, parent_id) VALUES ($1,$2,$3) RETURNING id, name, description, parent_id, is_active, created_at, updated_at`,
      [name.trim(), description || null, parent_id || null]
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
    const { name, description, is_active, parent_id } = req.body;
    if (!name) return res.status(400).json({ error: "اسم القسم مطلوب" });
    if (parent_id && String(parent_id) === String(id)) return res.status(400).json({ error: "لا يمكن أن يكون القسم أبًا لنفسه" });
    if (parent_id) {
      const parent = await pool.query(`SELECT id, parent_id FROM departments WHERE id = $1`, [parent_id]);
      if (!parent.rows.length) return res.status(400).json({ error: "القسم الأب غير موجود" });
      if (String(parent.rows[0].parent_id) === String(id)) return res.status(400).json({ error: "لا يمكن إنشاء علاقة دائرية بين الأقسام" });
    }
    const result = await pool.query(
      `UPDATE departments SET name=$1, description=$2, parent_id=$3, is_active=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$5 RETURNING id, name, description, parent_id, is_active, created_at, updated_at`,
      [name.trim(), description || null, parent_id || null, is_active, id]
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
    const result = await pool.query(`DELETE FROM departments WHERE id=$1 RETURNING id`, [id]);
    if (!result.rows.length) return res.status(404).json({ error: "القسم غير موجود" });
    res.status(200).json({ message: "تم حذف القسم بنجاح" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getDepartments, createDepartment, updateDepartment, deleteDepartment };
