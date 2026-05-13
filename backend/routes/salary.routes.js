const express = require("express");
const router = express.Router();

const {
  getSalaries,
  getSalaryPreview,
  createSalary,
  updateSalaryStatus,
  deleteSalary,
} = require("../controllers/salary.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const permissionMiddleware = require("../middlewares/permission.middleware");

router.get("/", authMiddleware, permissionMiddleware("salaries.view"), getSalaries);
router.get("/preview", authMiddleware, permissionMiddleware("salaries.view"), getSalaryPreview);
router.post("/", authMiddleware, permissionMiddleware("salaries.create"), createSalary);
router.patch("/:id/status", authMiddleware, permissionMiddleware("salaries.review", "salaries.approve", "salaries.publish"), updateSalaryStatus);
router.put("/:id/status", authMiddleware, permissionMiddleware("salaries.review", "salaries.approve", "salaries.publish"), updateSalaryStatus);
router.delete("/:id", authMiddleware, permissionMiddleware("salaries.delete"), deleteSalary);

module.exports = router;
