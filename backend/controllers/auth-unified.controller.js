const pool = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { ensurePermissionSchema } = require("../services/permission.service");
const { ensureEmployeeAccountSchema } = require("../services/employee-account.service");

const unifiedLogin = async (req, res) => {
  try {
    await ensurePermissionSchema();
    await ensureEmployeeAccountSchema(pool);

    const identifier = String(req.body.employee_number || req.body.email || "").trim();
    const password = req.body.password;

    if (!identifier || !password) {
      return res.status(400).json({ error: "رقم الموظف وكلمة المرور مطلوبان" });
    }

    const result = await pool.query(
      `SELECT * FROM users WHERE employee_number = $1 OR email = $1 LIMIT 1`,
      [identifier]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    }

    const user = result.rows[0];
    const accountStatus = user.account_status || (user.is_active ? "active" : "disabled");
    if (!user.is_active || accountStatus !== "active") {
      return res.status(403).json({ error: "تم تعطيل الدخول لهذا الحساب" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    }

    await pool.query(`UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`, [user.id]);

    const token = jwt.sign(
      {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        employee_number: user.employee_number,
        employee_id: user.employee_id,
        role: user.role,
        roles: user.roles,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "تم تسجيل الدخول بنجاح",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        employee_number: user.employee_number,
        employee_id: user.employee_id,
        role: user.role,
        roles: user.roles,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "حدث خطأ أثناء تسجيل الدخول" });
  }
};

module.exports = { unifiedLogin };
