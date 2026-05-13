const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const departmentRoutes = require("./routes/department.routes");
const employeeRoutes = require("./routes/employee.routes");
const attendanceRoutes = require("./routes/attendance.routes");
const salaryRoutes = require("./routes/salary.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const leaveRoutes = require("./routes/leave.routes");
const reportRoutes = require("./routes/report.routes");
const shiftRoutes = require("./routes/shift.routes");
const permissionRoutes = require("./routes/job-title.routes");

const app = express();

app.use(cors());
app.use(express.json());

const ensureStartupSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_titles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(160) NOT NULL UNIQUE,
      code VARCHAR(80),
      description TEXT,
      default_permissions TEXT[] DEFAULT ARRAY[]::text[],
      status VARCHAR(30) DEFAULT 'active',
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title_id INTEGER`);
  await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title_name VARCHAR(160)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS direct_denied_permissions TEXT[] DEFAULT ARRAY[]::text[]`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS permission_audit_logs (
      id SERIAL PRIMARY KEY,
      actor_user_id INTEGER,
      target_user_id INTEGER,
      actor_employee_id INTEGER,
      actor_name VARCHAR(160),
      target_type VARCHAR(80),
      target_id INTEGER,
      change_type VARCHAR(120) NOT NULL,
      old_value JSONB,
      new_value JSONB,
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`INSERT INTO job_titles (name, code, description, default_permissions, status) VALUES ('عامل','worker','صلاحيات موظف أساسية',ARRAY['dashboard.view','employees.view.self','requests.view.self','requests.create.self','attendance.view.self','attendance.check.self'],'active') ON CONFLICT (name) DO NOTHING`);
  await pool.query(`INSERT INTO job_titles (name, code, description, default_permissions, status) VALUES ('مدير إنتاج','production_manager','صلاحيات مدير إنتاج افتراضية',ARRAY['dashboard.view','employees.view','requests.view.department','requests.approve.department','attendance.view.department','reports.view.department'],'active') ON CONFLICT (name) DO NOTHING`);
  await pool.query(`INSERT INTO job_titles (name, code, description, default_permissions, status) VALUES ('موظف مالية','finance','صلاحيات مالية ورواتب',ARRAY['dashboard.view','finance.view','salaries.view','finance.payroll_slips.view','finance.payroll_slips.create'],'active') ON CONFLICT (name) DO NOTHING`);
  await pool.query(`INSERT INTO job_titles (name, code, description, default_permissions, status) VALUES ('مدير النظام','admin','صلاحيات كاملة',ARRAY['system.admin'],'active') ON CONFLICT (name) DO NOTHING`);
};

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/salaries", salaryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/permissions", permissionRoutes);

app.get("/", async (req, res) => {
  try {
    await ensureStartupSchema();
    const result = await pool.query("SELECT NOW()");
    res.json({ message: "HR System V2 API is running", database_time: result.rows[0] });
  } catch (error) {
    console.error("DB ERROR:", error.message);
    res.status(500).json({ error: "Database connection failed", details: error.message });
  }
});

const PORT = process.env.PORT || 5000;

ensureStartupSchema()
  .catch((error) => console.error("STARTUP SCHEMA ERROR:", error.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
