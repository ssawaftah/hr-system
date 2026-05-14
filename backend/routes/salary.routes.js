const express = require("express");
const router = express.Router();

const {
  getFinanceOverview,
  getFinanceSettings,
  saveFinanceSetting,
  getSalaries,
  getSalaryById,
  getSalaryPreview,
  generateSalary,
  createSalary,
  addSalaryItem,
  updateSalaryItem,
  deleteSalaryItem,
  updateSalaryStatus,
  deleteSalary,
  createAdvance,
  getAdvances,
  getLeaveBalance,
  saveLeaveBalance,
} = require("../controllers/finance.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const permissionMiddleware = require("../middlewares/permission.middleware");

router.get("/finance", authMiddleware, permissionMiddleware("salaries.view"), getFinanceOverview);
router.get("/settings", authMiddleware, permissionMiddleware("salaries.view"), getFinanceSettings);
router.post("/settings", authMiddleware, permissionMiddleware("salaries.create"), saveFinanceSetting);
router.put("/settings", authMiddleware, permissionMiddleware("salaries.create"), saveFinanceSetting);

router.get("/leave-balances/:employeeId", authMiddleware, permissionMiddleware("salaries.view"), getLeaveBalance);
router.post("/leave-balances", authMiddleware, permissionMiddleware("salaries.create"), saveLeaveBalance);
router.put("/leave-balances", authMiddleware, permissionMiddleware("salaries.create"), saveLeaveBalance);

router.get("/advances", authMiddleware, permissionMiddleware("salaries.view"), getAdvances);
router.post("/advances", authMiddleware, permissionMiddleware("salaries.create"), createAdvance);

router.get("/", authMiddleware, permissionMiddleware("salaries.view"), getSalaries);
router.get("/preview", authMiddleware, permissionMiddleware("salaries.view"), getSalaryPreview);
router.post("/generate", authMiddleware, permissionMiddleware("salaries.create"), generateSalary);
router.post("/", authMiddleware, permissionMiddleware("salaries.create"), createSalary);
router.get("/:id", authMiddleware, permissionMiddleware("salaries.view"), getSalaryById);
router.post("/:id/items", authMiddleware, permissionMiddleware("salaries.create"), addSalaryItem);
router.put("/:id/items/:itemId", authMiddleware, permissionMiddleware("salaries.create"), updateSalaryItem);
router.delete("/:id/items/:itemId", authMiddleware, permissionMiddleware("salaries.create"), deleteSalaryItem);
router.patch("/:id/status", authMiddleware, permissionMiddleware("salaries.review", "salaries.approve", "salaries.publish"), updateSalaryStatus);
router.put("/:id/status", authMiddleware, permissionMiddleware("salaries.review", "salaries.approve", "salaries.publish"), updateSalaryStatus);
router.delete("/:id", authMiddleware, permissionMiddleware("salaries.delete"), deleteSalary);

module.exports = router;
