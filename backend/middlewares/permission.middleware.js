const { getUserAccess } = require("../services/permission.service");

const permissionMiddleware = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Authentication required" });

      const access = await getUserAccess(req.user.id, req.user);
      req.user.roles = access.roles;
      req.user.permissions = access.permissions;

      if (access.roles.includes("admin")) return next();

      const allowed = requiredPermissions.some((permission) => access.permissions.includes(permission));
      if (!allowed) {
        return res.status(403).json({ error: "Access denied. Missing permission", required_permissions: requiredPermissions });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};

module.exports = permissionMiddleware;
