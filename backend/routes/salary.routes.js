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
  deleteSalary,
  createAdvance,
  getAdvances,
  getLeaveBalance,
  saveLeaveBalance,
} = require("../controllers/finance.controller");

const { updateSalaryStatusSafe } = require("../controllers/salary-status.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const permissionMiddleware = require("../middlewares/permission.middleware");

const viewFinance = permissionMiddleware("finance.view", "finance.dashboard.view", "finance.payroll_slips.view_all", "finance.settings.view", "finance.advances.view", "finance.reports.view", "salaries.view");
const manageSettings = permissionMiddleware("finance.settings.manage", "salaries.create");
const createPayroll = permissionMiddleware("finance.payroll_slips.create", "finance.payroll_slips.recalculate", "salaries.create");
const editPayroll = permissionMiddleware("finance.payroll_slips.edit", "salaries.create");
const reviewPayroll = permissionMiddleware("finance.payroll_slips.review", "finance.payroll_slips.approve", "finance.payroll_slips.mark_paid", "finance.payroll_slips.publish", "salaries.review", "salaries.approve", "salaries.publish");
const manageAdvances = permissionMiddleware("finance.advances.create", "finance.advances.manage", "salaries.create");

router.get("/finance", authMiddleware, viewFinance, getFinanceOverview);
router.get("/settings", authMiddleware, permissionMiddleware("finance.settings.view", "finance.settings.manage", "salaries.view"), getFinanceSettings);
router.post("/settings", authMiddleware, manageSettings, saveFinanceSetting);
router.put("/settings", authMiddleware, manageSettings, saveFinanceSetting);

router.get("/leave-balances/:employeeId", authMiddleware, permissionMiddleware("finance.settings.view", "finance.settings.manage", "salaries.view"), getLeaveBalance);
router.post("/leave-balances", authMiddleware, manageSettings, saveLeaveBalance);
router.put("/leave-balances", authMiddleware, manageSettings, saveLeaveBalance);

router.get("/advances", authMiddleware, permissionMiddleware("finance.advances.view", "finance.advances.manage", "salaries.view"), getAdvances);
router.post("/advances", authMiddleware, manageAdvances, createAdvance);

router.get("/", authMiddleware, permissionMiddleware("finance.payroll_slips.view_all", "finance.payroll_slips.view", "salaries.view"), getSalaries);
router.get("/preview", authMiddleware, permissionMiddleware("finance.payroll_slips.view_all", "finance.payroll_slips.create", "finance.payroll_slips.recalculate", "salaries.view"), getSalaryPreview);
router.post("/generate", authMiddleware, createPayroll, generateSalary);
router.post("/", authMiddleware, createPayroll, createSalary);
router.get("/:id", authMiddleware, permissionMiddleware("finance.payroll_slips.view_all", "finance.payroll_slips.view", "salaries.view"), getSalaryById);
router.post("/:id/items", authMiddleware, editPayroll, addSalaryItem);
router.put("/:id/items/:itemId", authMiddleware, editPayroll, updateSalaryItem);
router.delete("/:id/items/:itemId", authMiddleware, editPayroll, deleteSalaryItem);
router.patch("/:id/status", authMiddleware, reviewPayroll, updateSalaryStatusSafe);
router.put("/:id/status", authMiddleware, reviewPayroll, updateSalaryStatusSafe);
router.delete("/:id", authMiddleware, permissionMiddleware("finance.payroll_slips.edit", "salaries.delete"), deleteSalary);

module.exports = router;
