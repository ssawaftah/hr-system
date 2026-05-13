const { getUserAccess, normalizeArray } = require("../services/permission.service");

const roleMiddleware = (...allowedRoles) => {
  const normalizedAllowedRoles = normalizeArray(allowedRoles);
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Authentication required" });
      const access = await getUserAccess(req.user.id, req.user);
      req.user.roles = access.roles;
      req.user.permissions = access.permissions;
      if (access.roles.includes("admin")) return next();
      const hasRole = access.roles.some((role) => normalizedAllowedRoles.includes(role));
      if (!hasRole) return res.status(403).json({ error: "Permission required" });
      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};

module.exports = roleMiddleware;
