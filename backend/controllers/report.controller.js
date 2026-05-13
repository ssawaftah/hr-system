const pool = require("../db");

const getAttendanceSummary = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT status, COUNT(*) AS count
      FROM attendance_records
      GROUP BY status
      ORDER BY status ASC
    `);
    res.status(200).json({ summary: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAttendanceDetailedReport = async (req, res) => {
  try {
    const { employee_id, department_id, sub_department_id, month, status, absence_reason } = req.query;
    const values = [];
    const conditions = [];

    if (employee_id) {
      values.push(employee_id);
      conditions.push(`a.employee_id = $${values.length}`);
    }
    if (department_id) {
      values.push(department_id);
      conditions.push(`pd.id = $${values.length}`);
    }
    if (sub_department_id) {
      values.push(sub_department_id);
      conditions.push(`sd.id = $${values.length}`);
    }
    if (month) {
      values.push(`${month}-%`);
      conditions.push(`a.attendance_date::text LIKE $${values.length}`);
    }
    if (status) {
      values.push(status);
      conditions.push(`a.status = $${values.length}`);
    }
    if (absence_reason === "excused") {
      conditions.push(`a.status = 'absent' AND approved_leave.id IS NOT NULL`);
    }
    if (absence_reason === "unexcused") {
      conditions.push(`a.status = 'absent' AND approved_leave.id IS NULL`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const baseFrom = `
      FROM attendance_records a
      JOIN employees e ON e.id = a.employee_id
      LEFT JOIN employee_departments epd ON epd.employee_id = e.id AND epd.is_primary = true
      LEFT JOIN departments pd ON pd.id = COALESCE(epd.department_id, e.department_id)
      LEFT JOIN employee_departments esd ON esd.employee_id = e.id AND esd.is_primary = false
      LEFT JOIN departments sd ON sd.id = esd.department_id
      LEFT JOIN LATERAL (
        SELECT l.id, l.leave_type, l.reason, l.start_date, l.end_date
        FROM leave_requests l
        WHERE l.employee_id = a.employee_id
          AND l.status = 'approved'
          AND a.attendance_date BETWEEN l.start_date AND l.end_date
        ORDER BY l.id DESC
        LIMIT 1
      ) approved_leave ON true
    `;

    const recordsResult = await pool.query(
      `
      SELECT
        a.id,
        a.employee_id,
        e.full_name AS employee_name,
        e.employee_number,
        a.attendance_date,
        a.check_in,
        a.check_out,
        a.status,
        CASE
          WHEN a.status = 'absent' AND approved_leave.id IS NOT NULL THEN 'excused_absence'
          WHEN a.status = 'absent' AND approved_leave.id IS NULL THEN 'unexcused_absence'
          ELSE a.status
        END AS effective_status,
        a.notes,
        COALESCE(a.source, 'system') AS source,
        pd.id AS primary_department_id,
        pd.name AS primary_department_name,
        sd.id AS sub_department_id,
        sd.name AS sub_department_name,
        approved_leave.id AS approved_leave_id,
        approved_leave.leave_type AS approved_leave_type,
        approved_leave.reason AS approved_leave_reason
      ${baseFrom}
      ${whereClause}
      ORDER BY a.attendance_date DESC, e.full_name ASC, a.id DESC
      `,
      values
    );

    const monthlyResult = await pool.query(
      `
      SELECT
        a.employee_id,
        e.full_name AS employee_name,
        pd.name AS primary_department_name,
        sd.name AS sub_department_name,
        COUNT(*)::int AS total_records,
        COUNT(*) FILTER (WHERE a.status = 'present')::int AS present_days,
        COUNT(*) FILTER (WHERE a.status = 'absent')::int AS absent_days,
        COUNT(*) FILTER (WHERE a.status = 'absent' AND approved_leave.id IS NOT NULL)::int AS excused_absent_days,
        COUNT(*) FILTER (WHERE a.status = 'absent' AND approved_leave.id IS NULL)::int AS unexcused_absent_days,
        COUNT(*) FILTER (WHERE a.status = 'late')::int AS late_days,
        COUNT(*) FILTER (WHERE a.status = 'early_leave')::int AS early_leave_days,
        COUNT(*) FILTER (WHERE a.status = 'leave')::int AS leave_days
      ${baseFrom}
      ${whereClause}
      GROUP BY a.employee_id, e.full_name, pd.name, sd.name
      ORDER BY e.full_name ASC
      `,
      values
    );

    const statusResult = await pool.query(
      `
      SELECT
        CASE
          WHEN a.status = 'absent' AND approved_leave.id IS NOT NULL THEN 'excused_absence'
          WHEN a.status = 'absent' AND approved_leave.id IS NULL THEN 'unexcused_absence'
          ELSE a.status
        END AS status,
        COUNT(*)::int AS count
      ${baseFrom}
      ${whereClause}
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      values
    );

    const records = recordsResult.rows;
    const totals = {
      total_records: records.length,
      present: records.filter((row) => row.status === "present").length,
      absent: records.filter((row) => row.status === "absent").length,
      excused_absent: records.filter((row) => row.effective_status === "excused_absence").length,
      unexcused_absent: records.filter((row) => row.effective_status === "unexcused_absence").length,
      late: records.filter((row) => row.status === "late").length,
      early_leave: records.filter((row) => row.status === "early_leave").length,
      leave: records.filter((row) => row.status === "leave").length,
    };

    res.status(200).json({
      totals,
      status_summary: statusResult.rows,
      monthly_by_employee: monthlyResult.rows,
      records,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSalarySummary = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT salary_month, COUNT(*) AS records_count, SUM(net_salary) AS total_net_salary
      FROM salary_records
      GROUP BY salary_month
      ORDER BY salary_month DESC
    `);
    res.status(200).json({ summary: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAttendanceSummary,
  getAttendanceDetailedReport,
  getSalarySummary,
};
