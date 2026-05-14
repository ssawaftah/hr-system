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

router.get("/", authMiddleware, permissionMiddleware("shifts.view"), getShifts);
router.get("/:id", authMiddleware, permissionMiddleware("shifts.view"), getShiftById);
router.post("/", authMiddleware, permissionMiddleware("shifts.manage"), createShift);
router.put("/:id", authMiddleware, permissionMiddleware("shifts.manage"), updateShift);
router.patch("/:id/archive", authMiddleware, permissionMiddleware("shifts.manage"), archiveShift);
router.delete("/:id", authMiddleware, permissionMiddleware("shifts.manage"), deleteShift);
router.post("/assign", authMiddleware, permissionMiddleware("shifts.manage"), assignShift);
router.patch("/assignments/:id/remove", authMiddleware, permissionMiddleware("shifts.manage"), removeAssignment);
router.patch("/assignments/:id/move", authMiddleware, permissionMiddleware("shifts.manage"), moveAssignment);

module.exports = router;
