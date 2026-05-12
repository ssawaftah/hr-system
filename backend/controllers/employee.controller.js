const pool = require("../db");

const getEmployees = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.id,
        e.full_name,
        e.national_id,
        e.phone,
        e.email,
        e.address,
        e.job_title,
        e.department_id,
        d.name AS department_name,
        e.hire_date,
        e.employment_type,
        e.is_active,
        e.created_at
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      ORDER BY e.id ASC
    `);

    res.status(200).json({ employees: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    const employeeResult = await pool.query(
      `
      SELECT 
        e.id,
        e.full_name,
        e.national_id,
        e.phone,
        e.email,
        e.address,
        e.job_title,
        e.department_id,
        d.name AS department_name,
        e.hire_date,
        e.employment_type,
        e.is_active,
        e.created_at
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.id = $1
      `,
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "الموظف غير موجود" });
    }

    const attendanceResult = await pool.query(
      `
      SELECT *
      FROM attendance_records
      WHERE employee_id = $1
      ORDER BY attendance_date DESC, id DESC
      LIMIT 20
      `,
      [id]
    );

    const salariesResult = await pool.query(
      `
      SELECT *
      FROM salary_records
      WHERE employee_id = $1
      ORDER BY id DESC
      LIMIT 20
      `,
      [id]
    );

    const leavesResult = await pool.query(
      `
      SELECT *
      FROM leave_requests
      WHERE employee_id = $1
      ORDER BY id DESC
      LIMIT 20
      `,
      [id]
    );

    res.status(200).json({
      employee: employeeResult.rows[0],
      attendance: attendanceResult.rows,
      salaries: salariesResult.rows,
      leaves: leavesResult.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createEmployee = async (req, res) => {
  try {
    const {
      full_name,
      national_id,
      phone,
      email,
      address,
      job_title,
      department_id,
      hire_date,
      employment_type,
    } = req.body;

    if (!full_name) {
      return res.status(400).json({ error: "اسم الموظف مطلوب" });
    }

    const result = await pool.query(
      `
      INSERT INTO employees
      (
        full_name,
        national_id,
        phone,
        email,
        address,
        job_title,
        department_id,
        hire_date,
        employment_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        full_name,
        national_id || null,
        phone || null,
        email || null,
        address || null,
        job_title || null,
        department_id || null,
        hire_date || null,
        employment_type || "full_time",
      ]
    );

    res.status(201).json({
      message: "تم إنشاء الموظف بنجاح",
      employee: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      full_name,
      national_id,
      phone,
      email,
      address,
      job_title,
      department_id,
      hire_date,
      employment_type,
      is_active,
    } = req.body;

    if (!full_name) {
      return res.status(400).json({ error: "اسم الموظف مطلوب" });
    }

    const result = await pool.query(
      `
      UPDATE employees
      SET full_name = $1,
          national_id = $2,
          phone = $3,
          email = $4,
          address = $5,
          job_title = $6,
          department_id = $7,
          hire_date = $8,
          employment_type = $9,
          is_active = $10
      WHERE id = $11
      RETURNING *
      `,
      [
        full_name,
        national_id || null,
        phone || null,
        email || null,
        address || null,
        job_title || null,
        department_id || null,
        hire_date || null,
        employment_type || "full_time",
        is_active,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "الموظف غير موجود" });
    }

    res.status(200).json({
      message: "تم تعديل الموظف بنجاح",
      employee: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM employees WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "الموظف غير موجود" });
    }

    res.status(200).json({ message: "تم حذف الموظف بنجاح" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
