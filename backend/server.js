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
const announcementRoutes = require("./routes/announcement.routes");
const employeePortalRoutes = require("./routes/employee-portal.routes");

const app = express();
let startupReady = false;
let startupPromise = null;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const ensureStartupSchema = async () => {
  if (startupReady) return;
  if (startupPromise) return startupPromise;
  startupPromise = (async () => {
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(220) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(30) NOT NULL DEFAULT 'general',
        target_type VARCHAR(30) NOT NULL DEFAULT 'all',
        target_department_id INTEGER,
        target_department_name VARCHAR(160),
        target_employee_id INTEGER,
        target_employee_name VARCHAR(160),
        publisher_employee_id INTEGER,
        publisher_name VARCHAR(160),
        publisher_job_title VARCHAR(160),
        status VARCHAR(30) DEFAULT 'published',
        start_date DATE NOT NULL DEFAULT CURRENT_DATE,
        end_date DATE,
        is_active BOOLEAN DEFAULT true,
        created_by_user_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP,
        deleted_at TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcement_recipients (
        id SERIAL PRIMARY KEY,
        announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
        recipient_type VARCHAR(30) NOT NULL DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(announcement_id, employee_id, department_id, recipient_type)
      )
    `);
    await pool.query(`INSERT INTO job_titles (name, code, description, default_permissions, status) VALUES ('عامل','worker','صلاحيات موظف أساسية',ARRAY['dashboard.view','employees.view.self','requests.view.self','requests.create.self','attendance.view.self','attendance.check.self'],'active') ON CONFLICT (name) DO NOTHING`);
    await pool.query(`INSERT INTO job_titles (name, code, description, default_permissions, status) VALUES ('مدير إنتاج','production_manager','صلاحيات مدير إنتاج افتراضية',ARRAY['dashboard.view','employees.view','requests.view.department','requests.approve.department','attendance.view.department','reports.view.department'],'active') ON CONFLICT (name) DO NOTHING`);
    await pool.query(`INSERT INTO job_titles (name, code, description, default_permissions, status) VALUES ('موظف مالية','finance','صلاحيات مالية ورواتب',ARRAY['dashboard.view','finance.view','salaries.view','finance.payroll_slips.view','finance.payroll_slips.create'],'active') ON CONFLICT (name) DO NOTHING`);
    await pool.query(`INSERT INTO job_titles (name, code, description, default_permissions, status) VALUES ('مدير النظام','admin','صلاحيات كاملة',ARRAY['system.admin'],'active') ON CONFLICT (name) DO NOTHING`);

    await pool.query(`CREATE INDEX IF NOT EXISTS employees_department_idx ON employees(department_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS employees_status_idx ON employees(is_active, status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS employees_job_title_idx ON employees(job_title_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS employee_departments_employee_idx ON employee_departments(employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS employee_departments_department_idx ON employee_departments(department_id, is_primary)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS users_employee_id_idx ON users(employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS users_employee_number_idx ON users(employee_number)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS attendance_employee_date_idx ON attendance_records(employee_id, attendance_date DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance_records(attendance_date DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS salary_employee_idx ON salary_records(employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS salary_status_idx ON salary_records(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS leave_employee_idx ON leave_requests(employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS employee_requests_employee_idx ON employee_requests(employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS employee_requests_department_idx ON employee_requests(department_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS employee_requests_status_updated_idx ON employee_requests(status, updated_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS employee_request_logs_request_idx ON employee_request_action_logs(request_id, id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS announcements_visibility_idx ON announcements(status, is_active, start_date, end_date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS announcements_department_idx ON announcements(target_department_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS announcements_employee_idx ON announcements(target_employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS announcements_publisher_idx ON announcements(publisher_employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS announcement_recipients_employee_idx ON announcement_recipients(employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS announcement_recipients_department_idx ON announcement_recipients(department_id)`);
    startupReady = true;
  })().catch((error) => {
    startupReady = false;
    throw error;
  }).finally(() => {
    startupPromise = null;
  });
  return startupPromise;
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
app.use("/api/announcements", announcementRoutes);
app.use("/api/employee-portal", employeePortalRoutes);

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
