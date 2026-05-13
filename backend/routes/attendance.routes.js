const express = require("express");
const router = express.Router();

const {
  getAttendance,
  createAttendance,
  deleteAttendance,
} = require("../controllers/attendance.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const permissionMiddleware = require("../middlewares/permission.middleware");

router.get("/", authMiddleware, permissionMiddleware("attendance.view"), getAttendance);
router.post("/", authMiddleware, permissionMiddleware("attendance.create"), createAttendance);
router.delete("/:id", authMiddleware, permissionMiddleware("attendance.delete"), deleteAttendance);

module.exports = router;
