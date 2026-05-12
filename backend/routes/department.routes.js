const express = require("express");
const router = express.Router();

const {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require("../controllers/department.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

router.get("/", authMiddleware, roleMiddleware("admin", "hr"), getDepartments);
router.post("/", authMiddleware, roleMiddleware("admin", "hr"), createDepartment);
router.put("/:id", authMiddleware, roleMiddleware("admin", "hr"), updateDepartment);
router.delete("/:id", authMiddleware, roleMiddleware("admin"), deleteDepartment);

module.exports = router;
