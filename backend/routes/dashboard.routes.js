const express = require("express");
const router = express.Router();

const { getStats } = require("../controllers/dashboard.controller");

const authMiddleware = require("../middlewares/auth.middleware");

router.get("/stats", authMiddleware, getStats);

module.exports = router;
