const pool = require("../db");

const getSalaries = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.id,
        s.employee_id,
        e.full_name AS employee_name,
        s.salary_month,
        s.basic_salary,
        s.allowances,
        s.deductions,
        s.net_salary,
        s.status,
        s.created_at
      FROM salary_records s
      JOIN employees e ON s.employee_id = e.id
      ORDER BY s.id DESC
    `);

    res.status(200).json({ salaries: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createSalary = async (req, res) => {
  try {
    const {
      employee_id,
      salary_month,
      basic_salary,
      allowances,
      deductions,
      status,
    } = req.body;

    if (!employee_id || !salary_month) {
      return res.status(400).json({
        error: "الموظف والشهر مطلوبان",
      });
    }

    const basic = Number(basic_salary || 0);
    const adds = Number(allowances || 0);
    const cuts = Number(deductions || 0);
    const net = basic + adds - cuts;

    const result = await pool.query(
      `
      INSERT INTO salary_records
      (employee_id, salary_month, basic_salary, allowances, deductions, net_salary, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        employee_id,
        salary_month,
        basic,
        adds,
        cuts,
        net,
        status || "draft",
      ]
    );

    res.status(201).json({
      message: "تم إنشاء سجل الراتب بنجاح",
      salary: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteSalary = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM salary_records WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "سجل الراتب غير موجود" });
    }

    res.status(200).json({ message: "تم حذف سجل الراتب بنجاح" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getSalaries,
  createSalary,
  deleteSalary,
};
