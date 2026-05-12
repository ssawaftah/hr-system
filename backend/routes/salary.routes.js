const express = require("express");
const router = express.Router();

const {
  getSalaries,
  createSalary,
  deleteSalary,
} = require("../controllers/salary.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

// Salaries are sensitive financial records.
// Until a dedicated finance role is added, only admin can access them.
router.get("/", authMiddleware, roleMiddleware("admin"), getSalaries);
router.post("/", authMiddleware, roleMiddleware("admin"), createSalary);
router.delete("/:id", authMiddleware, roleMiddleware("admin"), deleteSalary);

module.exports = router;
