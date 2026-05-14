const pool = require('../db');

const actor = (req) => req.user?.id || null;
const normalizeStatus = (status) => {
  if (status === 'review') return 'pending_approval';
  if (status === 'published') return 'paid';
  return ['draft', 'pending_approval', 'approved', 'paid', 'closed'].includes(status) ? status : 'draft';
};

const updateSalaryStatusSafe = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = normalizeStatus(req.body.status);
    if (!id) return res.status(400).json({ error: 'معرف كشف الراتب غير صحيح' });

    const existing = await pool.query('SELECT * FROM salary_records WHERE id=$1::int', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'كشف الراتب غير موجود' });

    const result = await pool.query(
      `UPDATE salary_records
       SET status=$1::text,
           approved_at=CASE WHEN $1::text='approved' AND approved_at IS NULL THEN CURRENT_TIMESTAMP ELSE approved_at END,
           approved_by=CASE WHEN $1::text='approved' AND approved_by IS NULL THEN $2::int ELSE approved_by END,
           paid_at=CASE WHEN $1::text='paid' AND paid_at IS NULL THEN CURRENT_TIMESTAMP ELSE paid_at END,
           paid_by=CASE WHEN $1::text='paid' AND paid_by IS NULL THEN $2::int ELSE paid_by END,
           closed_at=CASE WHEN $1::text='closed' AND closed_at IS NULL THEN CURRENT_TIMESTAMP ELSE closed_at END,
           updated_at=CURRENT_TIMESTAMP
       WHERE id=$3::int
       RETURNING *`,
      [status, actor(req), id]
    );

    await pool.query(
      `INSERT INTO salary_audit_logs (salary_record_id, actor_user_id, action, old_value, new_value)
       VALUES ($1::int,$2::int,$3::text,$4::jsonb,$5::jsonb)`,
      [id, actor(req), `تغيير حالة الكشف إلى ${status}`, JSON.stringify(existing.rows[0]), JSON.stringify(result.rows[0])]
    ).catch(() => null);

    res.status(200).json({ message: 'تم تحديث حالة كشف الراتب', salary: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { updateSalaryStatusSafe };
