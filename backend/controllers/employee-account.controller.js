const pool = require("../db");
const { syncEmployeeAccount, validateEmployeeAccountPayload } = require("../services/employee-account.service");

const getLinkedAccount = async (employeeId) => {
  const result = await pool.query(
    `SELECT id, full_name, email, employee_number, employee_id, role, roles, permissions, is_active, account_status, last_login_at
     FROM users
     WHERE employee_id = $1
     LIMIT 1`,
    [employeeId]
  );
  return result.rows[0] || null;
};

const syncAccountForEmployee = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;

    const employeeResult = await client.query(`SELECT * FROM employees WHERE id = $1`, [id]);
    if (!employeeResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "الموظف غير موجود" });
    }

    const isCreate = !(await getLinkedAccount(id));
    const validationError = validateEmployeeAccountPayload(
      { ...employeeResult.rows[0], ...req.body },
      isCreate && (req.body.is_login_enabled !== false && req.body.login_enabled !== false)
    );
    if (validationError) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: validationError });
    }

    const account = await syncEmployeeAccount(client, employeeResult.rows[0], req.body);

    await client.query(
      `INSERT INTO audit_logs (actor_user_id, target_type, target_id, action, new_value)
       VALUES ($1, 'employee', $2, $3, $4)`,
      [req.user?.id || null, id, "تم تحديث بيانات دخول الموظف", JSON.stringify(account)]
    );

    await client.query("COMMIT");
    res.status(200).json({ message: "تم تحديث بيانات الدخول والصلاحيات بنجاح", account });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: error.message || "حدث خطأ أثناء تحديث بيانات الدخول" });
  } finally {
    client.release();
  }
};

const getEmployeeAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const account = await getLinkedAccount(id);
    res.status(200).json({ account });
  } catch (error) {
    res.status(500).json({ error: "حدث خطأ أثناء جلب بيانات الدخول" });
  }
};

module.exports = { syncAccountForEmployee, getEmployeeAccount };
