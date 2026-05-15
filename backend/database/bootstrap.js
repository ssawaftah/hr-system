const pool = require('../db');
const { ensurePermissionSchema } = require('../services/permission.service');
const { ensureShiftSchema } = require('../controllers/shift.controller');
const { ensureSalarySchema } = require('../controllers/finance.controller');
const { ensureRequestSchema } = require('../controllers/request.controller');
const { ensureAttendanceSchema } = require('../controllers/attendance.controller');

let ready = false;
let promise = null;

const runSql = (sql, params = []) => pool.query(sql, params);

const ensureCoreSchema = async () => {
  await runSql(`
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
  await runSql(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title_id INTEGER`);
  await runSql(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title_name VARCHAR(160)`);
  await runSql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS direct_denied_permissions TEXT[] DEFAULT ARRAY[]::text[]`);
  await runSql(`
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
  await runSql(`
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
  await runSql(`
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
};

const seedCoreLookups = async () => {
  await runSql(`INSERT INTO job_titles (name, code, description, default_permissions, status) VALUES ('عامل','worker','صلاحيات موظف أساسية',ARRAY['dashboard.view','employees.view.self','requests.view.self','requests.create.self','attendance.view.self','attendance.check.self'],'active') ON CONFLICT (name) DO NOTHING`);
  await runSql(`INSERT INTO job_titles (name, code, description, default_permissions, status) VALUES ('مدير إنتاج','production_manager','صلاحيات مدير إنتاج افتراضية',ARRAY['dashboard.view','employees.view','requests.view.department','requests.approve.department','attendance.view.department','reports.view.department'],'active') ON CONFLICT (name) DO NOTHING`);
  await runSql(`INSERT INTO job_titles (name, code, description, default_permissions, status) VALUES ('موظف مالية','finance','صلاحيات مالية ورواتب',ARRAY['dashboard.view','finance.view','salaries.view','finance.payroll_slips.view','finance.payroll_slips.create'],'active') ON CONFLICT (name) DO NOTHING`);
  await runSql(`INSERT INTO job_titles (name, code, description, default_permissions, status) VALUES ('مدير النظام','admin','صلاحيات كاملة',ARRAY['system.admin'],'active') ON CONFLICT (name) DO NOTHING`);
};

const ensureIndexes = async () => {
  await runSql(`CREATE INDEX IF NOT EXISTS employees_department_idx ON employees(department_id)`);
  await runSql(`CREATE INDEX IF NOT EXISTS employees_status_idx ON employees(is_active, status)`);
  await runSql(`CREATE INDEX IF NOT EXISTS employees_job_title_idx ON employees(job_title_id)`);
  await runSql(`CREATE INDEX IF NOT EXISTS employee_departments_employee_idx ON employee_departments(employee_id)`);
  await runSql(`CREATE INDEX IF NOT EXISTS employee_departments_department_idx ON employee_departments(department_id, is_primary)`);
  await runSql(`CREATE INDEX IF NOT EXISTS users_employee_id_idx ON users(employee_id)`);
  await runSql(`CREATE INDEX IF NOT EXISTS users_employee_number_idx ON users(employee_number)`);
  await runSql(`CREATE INDEX IF NOT EXISTS attendance_employee_date_idx ON attendance_records(employee_id, attendance_date DESC)`);
  await runSql(`CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance_records(attendance_date DESC)`);
  await runSql(`CREATE INDEX IF NOT EXISTS salary_employee_idx ON salary_records(employee_id)`);
  await runSql(`CREATE INDEX IF NOT EXISTS salary_status_idx ON salary_records(status)`);
  await runSql(`CREATE INDEX IF NOT EXISTS leave_employee_idx ON leave_requests(employee_id)`);
  await runSql(`CREATE INDEX IF NOT EXISTS employee_requests_employee_idx ON employee_requests(employee_id)`);
  await runSql(`CREATE INDEX IF NOT EXISTS employee_requests_department_idx ON employee_requests(department_id)`);
  await runSql(`CREATE INDEX IF NOT EXISTS employee_requests_status_updated_idx ON employee_requests(status, updated_at DESC)`);
  await runSql(`CREATE INDEX IF NOT EXISTS employee_request_logs_request_idx ON employee_request_action_logs(request_id, id)`);
  await runSql(`CREATE INDEX IF NOT EXISTS announcements_visibility_idx ON announcements(status, is_active, start_date, end_date)`);
  await runSql(`CREATE INDEX IF NOT EXISTS announcements_department_idx ON announcements(target_department_id)`);
  await runSql(`CREATE INDEX IF NOT EXISTS announcements_employee_idx ON announcements(target_employee_id)`);
  await runSql(`CREATE INDEX IF NOT EXISTS announcements_publisher_idx ON announcements(publisher_employee_id)`);
  await runSql(`CREATE INDEX IF NOT EXISTS announcement_recipients_employee_idx ON announcement_recipients(employee_id)`);
  await runSql(`CREATE INDEX IF NOT EXISTS announcement_recipients_department_idx ON announcement_recipients(department_id)`);
};

const bootstrapDatabase = async () => {
  if (ready) return;
  if (promise) return promise;
  promise = (async () => {
    await ensureCoreSchema();
    await ensurePermissionSchema();
    await ensureShiftSchema();
    await ensureSalarySchema();
    await ensureRequestSchema();
    await ensureAttendanceSchema();
    await seedCoreLookups();
    await ensureIndexes();
    ready = true;
  })().catch((error) => {
    ready = false;
    throw error;
  }).finally(() => {
    promise = null;
  });
  return promise;
};

module.exports = { bootstrapDatabase };
