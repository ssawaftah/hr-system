const express = require("express");
const router = express.Router();

const {
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  assignShift,
} = require("../controllers/shift.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const permissionMiddleware = require("../middlewares/permission.middleware");

router.get("/", authMiddleware, permissionMiddleware("shifts.view"), getShifts);
router.post("/", authMiddleware, permissionMiddleware("shifts.manage"), createShift);
router.put("/:id", authMiddleware, permissionMiddleware("shifts.manage"), updateShift);
router.delete("/:id", authMiddleware, permissionMiddleware("shifts.manage"), deleteShift);
router.post("/assign", authMiddleware, permissionMiddleware("shifts.manage"), assignShift);

module.exports = router;
