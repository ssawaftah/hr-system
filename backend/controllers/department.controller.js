const pool = require("../db");

const getDepartments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, description, is_active, created_at
      FROM departments
      ORDER BY id ASC
    `);

    res.status(200).json({ departments: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: "اسم القسم مطلوب" });
    }

    const result = await pool.query(
      `
      INSERT INTO departments (name, description)
      VALUES ($1, $2)
      RETURNING id, name, description, is_active, created_at
      `,
      [name, description || null]
    );

    res.status(201).json({
      message: "تم إنشاء القسم بنجاح",
      department: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({ error: "اسم القسم موجود مسبقًا" });
    }

    res.status(500).json({ error: error.message });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;

    const result = await pool.query(
      `
      UPDATE departments
      SET name = $1,
          description = $2,
          is_active = $3
      WHERE id = $4
      RETURNING id, name, description, is_active, created_at
      `,
      [name, description || null, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "القسم غير موجود" });
    }

    res.status(200).json({
      message: "تم تعديل القسم بنجاح",
      department: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM departments WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "القسم غير موجود" });
    }

    res.status(200).json({ message: "تم حذف القسم بنجاح" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
