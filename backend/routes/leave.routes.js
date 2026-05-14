const express = require("express");
const router = express.Router();

const {
  getRequests,
  getRequestById,
  createRequest,
  actOnRequest,
  deleteRequest,
} = require("../controllers/request.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const permissionMiddleware = require("../middlewares/permission.middleware");
const { normalizeRequestPayload } = require("../middlewares/request-normalizer.middleware");
const { normalizeStoredRequestPayload } = require("../middlewares/stored-request-normalizer.middleware");

router.get("/", authMiddleware, permissionMiddleware("requests.view.self", "requests.view.department", "requests.view.all", "requests.manage"), getRequests);
router.get("/:id", authMiddleware, normalizeStoredRequestPayload, permissionMiddleware("requests.view.self", "requests.view.department", "requests.view.all", "requests.manage"), getRequestById);
router.post("/", authMiddleware, normalizeRequestPayload, permissionMiddleware("requests.create.self", "requests.manage"), createRequest);
router.patch("/:id/action", authMiddleware, normalizeRequestPayload, normalizeStoredRequestPayload, permissionMiddleware("requests.cancel.self_pending", "requests.approve.department", "requests.approve.all", "requests.reject.department", "requests.reject.all", "requests.cancel.department", "requests.cancel.all", "requests.request_info", "requests.comment", "requests.manage"), actOnRequest);
router.put("/:id/action", authMiddleware, normalizeRequestPayload, normalizeStoredRequestPayload, permissionMiddleware("requests.cancel.self_pending", "requests.approve.department", "requests.approve.all", "requests.reject.department", "requests.reject.all", "requests.cancel.department", "requests.cancel.all", "requests.request_info", "requests.comment", "requests.manage"), actOnRequest);
router.delete("/:id", authMiddleware, permissionMiddleware("requests.manage"), deleteRequest);

module.exports = router;
