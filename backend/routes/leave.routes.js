const express = require("express");
const router = express.Router();

const {
  getLeaves,
  createLeave,
  updateLeave,
  updateLeaveStatus,
  deleteLeave,
} = require("../controllers/leave.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const permissionMiddleware = require("../middlewares/permission.middleware");

router.get("/", authMiddleware, permissionMiddleware("leaves.view"), getLeaves);
router.post("/", authMiddleware, permissionMiddleware("leaves.create"), createLeave);
router.put("/:id", authMiddleware, permissionMiddleware("leaves.update"), updateLeave);
router.patch("/:id", authMiddleware, permissionMiddleware("leaves.approve"), updateLeaveStatus);
router.put("/:id/status", authMiddleware, permissionMiddleware("leaves.approve"), updateLeaveStatus);
router.delete("/:id", authMiddleware, permissionMiddleware("leaves.delete"), deleteLeave);

module.exports = router;
