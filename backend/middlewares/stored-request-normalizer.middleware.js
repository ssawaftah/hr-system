const pool = require('../db');
const {
  normalizeRequestType,
  normalizeLeaveType,
  normalizeExitType,
  normalizeDeductionMethod,
} = require('./request-normalizer.middleware');

const normalizeStoredRequestPayload = async (req, _res, next) => {
  try {
    const requestId = Number(req.params.id);
    if (!requestId) return next();

    const result = await pool.query(
      'SELECT id, request_type, request_data FROM employee_requests WHERE id=$1::int',
      [requestId]
    );

    if (!result.rows.length) return next();

    const row = result.rows[0];
    const data = row.request_data || {};
    const normalizedType = normalizeRequestType(row.request_type);
    const normalizedData = { ...data };

    if (normalizedData.leave_type !== undefined) {
      normalizedData.leave_type = normalizeLeaveType(normalizedData.leave_type);
    }

    if (normalizedData.exit_type !== undefined) {
      normalizedData.exit_type = normalizeExitType(normalizedData.exit_type);
    }

    if (normalizedData.deduction_method !== undefined) {
      normalizedData.deduction_method = normalizeDeductionMethod(normalizedData.deduction_method);
    }

    const changed = normalizedType !== row.request_type || JSON.stringify(normalizedData) !== JSON.stringify(data);
    if (changed) {
      await pool.query(
        `UPDATE employee_requests
         SET request_type=$1::text, request_data=$2::jsonb, updated_at=CURRENT_TIMESTAMP
         WHERE id=$3::int`,
        [normalizedType, JSON.stringify(normalizedData), requestId]
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { normalizeStoredRequestPayload };
