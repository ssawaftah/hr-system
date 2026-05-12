const express = require("express");
const router = express.Router();

const {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} = require("../controllers/employee.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

router.get("/", authMiddleware, roleMiddleware("admin", "hr"), getEmployees);
router.get("/:id", authMiddleware, roleMiddleware("admin", "hr"), getEmployeeById);
router.post("/", authMiddleware, roleMiddleware("admin", "hr"), createEmployee);
router.put("/:id", authMiddleware, roleMiddleware("admin", "hr"), updateEmployee);
router.delete("/:id", authMiddleware, roleMiddleware("admin"), deleteEmployee);

module.exports = router;
