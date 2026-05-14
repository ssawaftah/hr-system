const express = require("express");
const router = express.Router();

const {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require("../controllers/department.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const permissionMiddleware = require("../middlewares/permission.middleware");

router.get("/", authMiddleware, permissionMiddleware("departments.view"), getDepartments);
router.get("/:id", authMiddleware, permissionMiddleware("departments.view"), getDepartmentById);
router.post("/", authMiddleware, permissionMiddleware("departments.manage"), createDepartment);
router.put("/:id", authMiddleware, permissionMiddleware("departments.manage"), updateDepartment);
router.delete("/:id", authMiddleware, permissionMiddleware("departments.manage"), deleteDepartment);

module.exports = router;
