const pool = require("../db");
const bcrypt = require("bcrypt");

const getUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, full_name, email, role, is_active, created_at
      FROM users
      ORDER BY id ASC
    `);

    res.status(200).json({ users: result.rows });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ error: "جميع الحقول مطلوبة" });
    }

    const allowedRoles = ["admin", "hr", "employee"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "الدور غير صحيح" });
    }

    const existingUser = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "البريد الإلكتروني مستخدم مسبقًا" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, full_name, email, role, is_active, created_at
      `,
      [full_name, email, hashedPassword, role]
    );

    res.status(201).json({
      message: "تم إنشاء المستخدم بنجاح",
      user: result.rows[0],
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getUsers, createUser };
