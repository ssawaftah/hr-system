const pool = require('../db');

const asInt = (value) => (value === undefined || value === null || value === '' ? null : Number(value));

const getCurrentEmployeeId = async (req) => {
  if (req.user?.employee_id) return Number(req.user.employee_id);
  const user = await pool.query(
    'SELECT employee_id, employee_number, email FROM users WHERE id=$1 LIMIT 1',
    [asInt(req.user?.id) || 0]
  );
  if (user.rows[0]?.employee_id) return Number(user.rows[0].employee_id);
  if (user.rows[0]?.employee_number) {
    const employee = await pool.query('SELECT id FROM employees WHERE employee_number=$1 LIMIT 1', [String(user.rows[0].employee_number)]);
    if (employee.rows[0]?.id) return Number(employee.rows[0].id);
  }
  if (user.rows[0]?.email) {
    const employee = await pool.query('SELECT id FROM employees WHERE LOWER(email)=LOWER($1) LIMIT 1', [user.rows[0].email]);
    if (employee.rows[0]?.id) return Number(employee.rows[0].id);
  }
  return null;
};

const deleteSelfPendingRequest = async (req, res) => {
  try {
    const requestId = asInt(req.params.id);
    const userId = asInt(req.user?.id) || 0;
    const employeeId = await getCurrentEmployeeId(req);

    if (!requestId) return res.status(400).json({ error: 'معرف الطلب غير صحيح' });
    if (!employeeId) return res.status(400).json({ error: 'لا يوجد موظف مرتبط بحسابك' });

    const existing = await pool.query(
      `SELECT id, employee_id, created_by, status
       FROM employee_requests
       WHERE id=$1
       LIMIT 1`,
      [requestId]
    );

    if (!existing.rows.length) return res.status(404).json({ error: 'الطلب غير موجود' });

    const request = existing.rows[0];
    const isOwner = Number(request.employee_id) === Number(employeeId) || Number(request.created_by) === Number(userId);
    if (!isOwner) return res.status(403).json({ error: 'لا يمكنك إلغاء طلب لا يخصك' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'يمكن إلغاء الطلب فقط عندما تكون حالته قيد الانتظار' });

    await pool.query('DELETE FROM employee_requests WHERE id=$1', [requestId]);
    res.status(200).json({ message: 'تم إلغاء الطلب وحذفه بنجاح', deleted_id: requestId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { deleteSelfPendingRequest };
