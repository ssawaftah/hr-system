const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const permissionMiddleware = require("../middlewares/permission.middleware");
const {
  getPermissionDefinitions,
  getJobTitles,
  createJobTitle,
  updateJobTitle,
  disableJobTitle,
  deleteJobTitle,
  getEmployeePermissions,
  updateEmployeePermissions,
  getPermissionLogs,
} = require("../controllers/job-title.controller");

router.get("/permissions", authMiddleware, permissionMiddleware("permissions.view", "permissions.manage", "system.admin"), getPermissionDefinitions);

router.get("/job-titles", authMiddleware, permissionMiddleware("job_titles.view", "permissions.view", "permissions.manage", "system.admin"), getJobTitles);
router.post("/job-titles", authMiddleware, permissionMiddleware("job_titles.create", "job_titles.manage_permissions", "permissions.manage", "system.admin"), createJobTitle);
router.put("/job-titles/:id", authMiddleware, permissionMiddleware("job_titles.update", "job_titles.manage_permissions", "permissions.manage", "system.admin"), updateJobTitle);
router.patch("/job-titles/:id/disable", authMiddleware, permissionMiddleware("job_titles.disable", "permissions.manage", "system.admin"), disableJobTitle);
router.delete("/job-titles/:id", authMiddleware, permissionMiddleware("job_titles.delete", "permissions.manage", "system.admin"), deleteJobTitle);

router.get("/employees/:employeeId", authMiddleware, permissionMiddleware("employee_permissions.view", "permissions.view", "permissions.manage", "system.admin"), getEmployeePermissions);
router.put("/employees/:employeeId", authMiddleware, permissionMiddleware("employee_permissions.manage", "permissions.manage", "system.admin"), updateEmployeePermissions);

router.get("/logs", authMiddleware, permissionMiddleware("permissions.view_logs", "permissions.manage", "system.admin"), getPermissionLogs);

module.exports = router;
