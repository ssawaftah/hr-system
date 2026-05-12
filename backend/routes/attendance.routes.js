const express = require("express");
const router = express.Router();

const {
  getAttendance,
  createAttendance,
  deleteAttendance,
} = require("../controllers/attendance.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

router.get("/", authMiddleware, roleMiddleware("admin", "hr"), getAttendance);
router.post("/", authMiddleware, roleMiddleware("admin", "hr"), createAttendance);
router.delete("/:id", authMiddleware, roleMiddleware("admin", "hr"), deleteAttendance);

module.exports = router;
