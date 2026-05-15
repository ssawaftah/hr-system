const express = require("express");
const router = express.Router();

const {
  getAttendance,
  createAttendance,
  deleteAttendance,
} = require("../controllers/attendance.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const permissionMiddleware = require("../middlewares/permission.middleware");

router.get("/", authMiddleware, permissionMiddleware("attendance.view", "attendance.view.self", "attendance.view.department", "attendance.view.all", "attendance.manage"), getAttendance);
router.post("/", authMiddleware, permissionMiddleware("attendance.create", "attendance.manual_add", "attendance.manage"), createAttendance);
router.delete("/:id", authMiddleware, permissionMiddleware("attendance.delete", "attendance.manage"), deleteAttendance);

module.exports = router;
