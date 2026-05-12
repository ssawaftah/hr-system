const express = require("express");
const router = express.Router();

const {
  getLeaves,
  createLeave,
  updateLeaveStatus,
  deleteLeave,
} = require("../controllers/leave.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

router.get("/", authMiddleware, roleMiddleware("admin", "hr"), getLeaves);
router.post("/", authMiddleware, roleMiddleware("admin", "hr"), createLeave);
router.put("/:id/status", authMiddleware, roleMiddleware("admin", "hr"), updateLeaveStatus);
router.delete("/:id", authMiddleware, roleMiddleware("admin", "hr"), deleteLeave);

module.exports = router;
