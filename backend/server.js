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

const app = express();

app.use(cors());
app.use(express.json());

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

app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      message: "HR System V2 API is running",
      database_time: result.rows[0],
    });
  } catch (error) {
    console.error("DB ERROR:", error.message);
    res.status(500).json({
  error: "Database connection failed",
  details: error.message,
});
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
