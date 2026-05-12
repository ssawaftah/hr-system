const normalizeRoles = (roles) => {
  if (!roles) return [];

  if (Array.isArray(roles)) {
    return roles.flatMap((role) => normalizeRoles(role));
  }

  return String(roles)
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
};

const roleMiddleware = (...allowedRoles) => {
  const normalizedAllowedRoles = normalizeRoles(allowedRoles);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const userRoles = normalizeRoles(req.user.roles || req.user.role);

    if (userRoles.length === 0) {
      return res.status(403).json({
        error: "Access denied. User role not found",
      });
    }

    if (userRoles.includes("admin")) {
      return next();
    }

    const hasPermission = userRoles.some((role) => normalizedAllowedRoles.includes(role));

    if (!hasPermission) {
      return res.status(403).json({
        error: "Access denied. You do not have permission",
      });
    }

    next();
  };
};

module.exports = roleMiddleware;
