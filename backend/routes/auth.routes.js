const express = require("express");
const router = express.Router();

const {
  setupDatabase,
  createAdminUser,
  login,
  getMe,
} = require("../controllers/auth.controller");

const authMiddleware = require("../middlewares/auth.middleware");

router.get("/setup", setupDatabase);
router.get("/create-admin", createAdminUser);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);

module.exports = router;
