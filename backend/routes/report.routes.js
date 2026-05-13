const express = require("express");
const router = express.Router();

const {
  getAttendanceSummary,
  getAttendanceDetailedReport,
  getSalarySummary,
} = require("../controllers/report.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

router.get("/attendance-summary", authMiddleware, roleMiddleware("admin", "hr"), getAttendanceSummary);
router.get("/attendance-detailed", authMiddleware, roleMiddleware("admin", "hr"), getAttendanceDetailedReport);

// Salary reports include financial data, so they are restricted to admin only.
router.get("/salary-summary", authMiddleware, roleMiddleware("admin"), getSalarySummary);

module.exports = router;
