const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const permissionMiddleware = require("../middlewares/permission.middleware");
const {
  getVisibleAnnouncements,
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  archiveAnnouncement,
} = require("../controllers/announcement.controller");

router.get("/visible", authMiddleware, getVisibleAnnouncements);
router.get("/", authMiddleware, permissionMiddleware("announcements.view.self", "announcements.view.department", "announcements.view.all", "announcements.manage", "system.admin"), getAnnouncements);
router.post("/", authMiddleware, permissionMiddleware("announcements.create.general.company", "announcements.create.general.department", "announcements.create.private.department", "announcements.create.private.employee", "announcements.create.private.all_departments", "announcements.manage", "system.admin"), createAnnouncement);
router.put("/:id", authMiddleware, permissionMiddleware("announcements.update.own", "announcements.update.all", "announcements.manage", "system.admin"), updateAnnouncement);
router.delete("/:id", authMiddleware, permissionMiddleware("announcements.delete.own", "announcements.delete.all", "announcements.archive", "announcements.manage", "system.admin"), archiveAnnouncement);
router.patch("/:id/archive", authMiddleware, permissionMiddleware("announcements.delete.own", "announcements.delete.all", "announcements.archive", "announcements.manage", "system.admin"), archiveAnnouncement);

module.exports = router;
