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
const roleMiddleware = require("../middlewares/role.middleware");

router.get("/", authMiddleware, roleMiddleware("admin", "hr"), getShifts);
router.post("/", authMiddleware, roleMiddleware("admin", "hr"), createShift);
router.put("/:id", authMiddleware, roleMiddleware("admin", "hr"), updateShift);
router.delete("/:id", authMiddleware, roleMiddleware("admin", "hr"), deleteShift);
router.post("/assign", authMiddleware, roleMiddleware("admin", "hr"), assignShift);

module.exports = router;
