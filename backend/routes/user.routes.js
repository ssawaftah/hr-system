const express = require("express");
const router = express.Router();

const {
  getUsers,
  createUser,
} = require("../controllers/user.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

router.get("/", authMiddleware, roleMiddleware("admin"), getUsers);
router.post("/", authMiddleware, roleMiddleware("admin"), createUser);

module.exports = router;
