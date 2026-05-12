const pool = require("../db");

const getStats = async (req, res) => {
  try {
    const users = await pool.query(`SELECT COUNT(*) FROM users`);
    const departments = await pool.query(`SELECT COUNT(*) FROM departments`);
    const employees = await pool.query(`SELECT COUNT(*) FROM employees`);
    const attendance = await pool.query(`SELECT COUNT(*) FROM attendance_records`);
    const salaries = await pool.query(`SELECT COUNT(*) FROM salary_records`);
    const leaves = await pool.query(`SELECT COUNT(*) FROM leave_requests`);

    res.status(200).json({
      stats: {
        users: Number(users.rows[0].count),
        departments: Number(departments.rows[0].count),
        employees: Number(employees.rows[0].count),
        attendance: Number(attendance.rows[0].count),
        salaries: Number(salaries.rows[0].count),
        leaves: Number(leaves.rows[0].count),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getStats };
