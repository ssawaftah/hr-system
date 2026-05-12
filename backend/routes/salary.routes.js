const express = require("express");
const router = express.Router();

const {
  getSalaries,
  createSalary,
  deleteSalary,
} = require("../controllers/salary.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

router.get("/", authMiddleware, roleMiddleware("admin", "hr"), getSalaries);
router.post("/", authMiddleware, roleMiddleware("admin", "hr"), createSalary);
router.delete("/:id", authMiddleware, roleMiddleware("admin"), deleteSalary);

module.exports = router;
