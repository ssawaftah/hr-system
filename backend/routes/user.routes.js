const express = require("express");
const router = express.Router();

const { getUsers, createUser, updateUserAccess, getMyAccess } = require("../controllers/user.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

router.get("/me/access", authMiddleware, getMyAccess);
router.get("/", authMiddleware, roleMiddleware("admin"), getUsers);
router.post("/", authMiddleware, roleMiddleware("admin"), createUser);
router.put("/:id/access", authMiddleware, roleMiddleware("admin"), updateUserAccess);
router.patch("/:id/access", authMiddleware, roleMiddleware("admin"), updateUserAccess);

module.exports = router;
