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
const permissionMiddleware = require("../middlewares/permission.middleware");

router.get("/", authMiddleware, permissionMiddleware("employees.view"), getEmployees);
router.get("/:id", authMiddleware, permissionMiddleware("employees.view"), getEmployeeById);
router.post("/", authMiddleware, permissionMiddleware("employees.create"), createEmployee);
router.put("/:id", authMiddleware, permissionMiddleware("employees.update"), updateEmployee);
router.patch("/:id/disable", authMiddleware, permissionMiddleware("employees.delete"), disableEmployee);
router.patch("/:id/archive", authMiddleware, permissionMiddleware("employees.delete"), archiveEmployee);
router.delete("/:id", authMiddleware, permissionMiddleware("employees.delete"), deleteEmployee);

module.exports = router;
