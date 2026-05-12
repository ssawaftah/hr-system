const pool = require("../db");

const getAttendanceSummary = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        status,
        COUNT(*) AS count
      FROM attendance_records
      GROUP BY status
      ORDER BY status ASC
    `);

    res.status(200).json({ summary: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSalarySummary = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        salary_month,
        COUNT(*) AS records_count,
        SUM(net_salary) AS total_net_salary
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
  getSalarySummary,
};
