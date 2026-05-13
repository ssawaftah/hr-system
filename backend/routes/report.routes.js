const express = require("express");
const router = express.Router();

const {
  getAttendanceSummary,
  getAttendanceDetailedReport,
  getSalarySummary,
} = require("../controllers/report.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const permissionMiddleware = require("../middlewares/permission.middleware");

router.get("/attendance-summary", authMiddleware, permissionMiddleware("reports.view"), getAttendanceSummary);
router.get("/attendance-detailed", authMiddleware, permissionMiddleware("reports.view"), getAttendanceDetailedReport);
router.get("/salary-summary", authMiddleware, permissionMiddleware("reports.salary"), getSalarySummary);

module.exports = router;
