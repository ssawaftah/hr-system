const express = require("express");
const router = express.Router();

const {
  setupDatabase,
  createAdminUser,
  getMe,
} = require("../controllers/auth.controller");
const { unifiedLogin } = require("../controllers/auth-unified.controller");

const authMiddleware = require("../middlewares/auth.middleware");

router.get("/setup", setupDatabase);
router.get("/create-admin", createAdminUser);
router.post("/login", unifiedLogin);
router.get("/me", authMiddleware, getMe);

module.exports = router;
