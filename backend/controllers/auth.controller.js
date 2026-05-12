const pool = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const setupDatabase = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'employee',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(100)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'employee'`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS name VARCHAR(100)`);
    await client.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS description TEXT`);
    await client.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
    await client.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        national_id VARCHAR(50),
        phone VARCHAR(50),
        email VARCHAR(100),
        address TEXT,
        job_title VARCHAR(100),
        department_id INTEGER,
        hire_date DATE,
        employment_type VARCHAR(50) DEFAULT 'full_time',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS full_name VARCHAR(100)`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS national_id VARCHAR(50)`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS email VARCHAR(100)`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title VARCHAR(100)`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id INTEGER`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date DATE`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50) DEFAULT 'full_time'`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER,
        attendance_date DATE NOT NULL,
        check_in TIME,
        check_out TIME,
        status VARCHAR(50) DEFAULT 'present',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS employee_id INTEGER`);
    await client.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS attendance_date DATE`);
    await client.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS check_in TIME`);
    await client.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS check_out TIME`);
    await client.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'present'`);
    await client.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS notes TEXT`);
    await client.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS salary_records (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER,
        salary_month VARCHAR(20) NOT NULL,
        basic_salary NUMERIC(12,2) DEFAULT 0,
        allowances NUMERIC(12,2) DEFAULT 0,
        deductions NUMERIC(12,2) DEFAULT 0,
        net_salary NUMERIC(12,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS employee_id INTEGER`);
    await client.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS salary_month VARCHAR(20)`);
    await client.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(12,2) DEFAULT 0`);
    await client.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS allowances NUMERIC(12,2) DEFAULT 0`);
    await client.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS deductions NUMERIC(12,2) DEFAULT 0`);
    await client.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS net_salary NUMERIC(12,2) DEFAULT 0`);
    await client.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft'`);
    await client.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS notes TEXT`);
    await client.query(`ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER,
        leave_type VARCHAR(50) DEFAULT 'annual',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS employee_id INTEGER`);
    await client.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_type VARCHAR(50) DEFAULT 'annual'`);
    await client.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS start_date DATE`);
    await client.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS end_date DATE`);
    await client.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS reason TEXT`);
    await client.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'`);
    await client.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS admin_notes TEXT`);
    await client.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_department_id_fkey') THEN
          ALTER TABLE employees
          ADD CONSTRAINT employees_department_id_fkey
          FOREIGN KEY (department_id)
          REFERENCES departments(id)
          ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_employee_id_fkey') THEN
          ALTER TABLE attendance_records
          ADD CONSTRAINT attendance_records_employee_id_fkey
          FOREIGN KEY (employee_id)
          REFERENCES employees(id)
          ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'salary_records_employee_id_fkey') THEN
          ALTER TABLE salary_records
          ADD CONSTRAINT salary_records_employee_id_fkey
          FOREIGN KEY (employee_id)
          REFERENCES employees(id)
          ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_employee_id_fkey') THEN
          ALTER TABLE leave_requests
          ADD CONSTRAINT leave_requests_employee_id_fkey
          FOREIGN KEY (employee_id)
          REFERENCES employees(id)
          ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(email)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS departments_name_unique_idx ON departments(name)`);

    await client.query(`
      INSERT INTO departments (name, description)
      VALUES
        ('الإدارة', 'قسم الإدارة العامة'),
        ('الموارد البشرية', 'قسم الموارد البشرية'),
        ('المحاسبة', 'قسم المحاسبة'),
        ('التشغيل', 'قسم التشغيل')
      ON CONFLICT (name) DO NOTHING
    `);

    await client.query("COMMIT");

    res.status(200).json({
      message: "HR System V2 database setup and migrations completed successfully",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

const createAdminUser = async (req, res) => {
  try {
    const full_name = "Admin";
    const email = "admin@test.com";
    const password = "123456";
    const role = "admin";

    const existingUser = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);

    if (existingUser.rows.length > 0) {
      await pool.query(
        `UPDATE users SET role = 'admin', is_active = true WHERE email = $1`,
        [email]
      );

      return res.status(200).json({
        message: "Admin user already exists and was updated",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users 
      (full_name, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING id, full_name, email, role, is_active, created_at
      `,
      [full_name, email, hashedPassword, role]
    );

    res.status(201).json({
      message: "Admin user created",
      user: result.rows[0],
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: "User account is disabled" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
};

const getMe = async (req, res) => {
  res.status(200).json({
    message: "Protected route working",
    user: req.user,
  });
};

module.exports = {
  setupDatabase,
  createAdminUser,
  login,
  getMe,
};
