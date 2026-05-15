const express = require("express");
const router = express.Router();

const {
  getShifts,
  getShiftById,
  createShift,
  updateShift,
  archiveShift,
  deleteShift,
  assignShift,
  removeAssignment,
  moveAssignment,
} = require("../controllers/shift.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const permissionMiddleware = require("../middlewares/permission.middleware");

router.get("/", authMiddleware, permissionMiddleware("shifts.view", "shifts.manage"), getShifts);
router.get("/:id", authMiddleware, permissionMiddleware("shifts.view", "shifts.manage"), getShiftById);
router.post("/", authMiddleware, permissionMiddleware("shifts.create", "shifts.manage"), createShift);
router.put("/:id", authMiddleware, permissionMiddleware("shifts.update", "shifts.manage"), updateShift);
router.patch("/:id/archive", authMiddleware, permissionMiddleware("shifts.archive", "shifts.manage"), archiveShift);
router.delete("/:id", authMiddleware, permissionMiddleware("shifts.delete", "shifts.manage"), deleteShift);
router.post("/assign", authMiddleware, permissionMiddleware("shifts.assign", "shifts.manage"), assignShift);
router.patch("/assignments/:id/remove", authMiddleware, permissionMiddleware("shifts.remove_employee", "shifts.manage"), removeAssignment);
router.patch("/assignments/:id/move", authMiddleware, permissionMiddleware("shifts.move_employee", "shifts.manage"), moveAssignment);

module.exports = router;
