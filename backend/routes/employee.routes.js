const express = require("express");
const router = express.Router();

const {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  disableEmployee,
  archiveEmployee,
} = require("../controllers/employee.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

router.get("/", authMiddleware, roleMiddleware("admin", "hr"), getEmployees);
router.get("/:id", authMiddleware, roleMiddleware("admin", "hr"), getEmployeeById);
router.post("/", authMiddleware, roleMiddleware("admin", "hr"), createEmployee);
router.put("/:id", authMiddleware, roleMiddleware("admin", "hr"), updateEmployee);
router.patch("/:id/disable", authMiddleware, roleMiddleware("admin"), disableEmployee);
router.patch("/:id/archive", authMiddleware, roleMiddleware("admin"), archiveEmployee);
router.delete("/:id", authMiddleware, roleMiddleware("admin"), deleteEmployee);

module.exports = router;
