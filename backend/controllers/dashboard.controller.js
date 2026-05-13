const pool = require("../db");
const { getUserAccess, hasPermissionValue } = require("../services/permission.service");

const safeCount = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return Number(result.rows[0]?.count || 0);
  } catch (error) {
    return 0;
  }
};

const getStats = async (req, res) => {
  try {
    const access = await getUserAccess(req.user.id, req.user);
    const cards = [];
    const sections = [];

    if (hasPermissionValue(access, "users.view") || hasPermissionValue(access, "permissions.view")) {
      cards.push({ id: "users", title: "المستخدمون", value: await safeCount(`SELECT COUNT(*) FROM users`) });
    }
    if (hasPermissionValue(access, "departments.view")) {
      cards.push({ id: "departments", title: "الأقسام", value: await safeCount(`SELECT COUNT(*) FROM departments`) });
    }
    if (hasPermissionValue(access, "employees.view")) {
      cards.push({ id: "employees", title: "الموظفون", value: await safeCount(`SELECT COUNT(*) FROM employees`) });
    }
    if (hasPermissionValue(access, "attendance.view") || hasPermissionValue(access, "attendance.view.all")) {
      cards.push({ id: "attendance", title: "سجلات الحضور", value: await safeCount(`SELECT COUNT(*) FROM attendance_records`) });
      cards.push({ id: "late", title: "تأخير اليوم", value: await safeCount(`SELECT COUNT(*) FROM attendance_records WHERE attendance_date = CURRENT_DATE AND status = 'late'`) });
      cards.push({ id: "absent", title: "غياب اليوم", value: await safeCount(`SELECT COUNT(*) FROM attendance_records WHERE attendance_date = CURRENT_DATE AND status = 'absent'`) });
    }
    if (hasPermissionValue(access, "leaves.view") || hasPermissionValue(access, "requests.view.all")) {
      cards.push({ id: "leaves", title: "طلبات الإجازات", value: await safeCount(`SELECT COUNT(*) FROM leave_requests`) });
      sections.push({ title: "طلبات تحتاج مراجعة", value: await safeCount(`SELECT COUNT(*) FROM leave_requests WHERE status = 'pending'`) });
    }
    if (hasPermissionValue(access, "salaries.view") || hasPermissionValue(access, "finance.view")) {
      cards.push({ id: "salaries", title: "سجلات الرواتب", value: await safeCount(`SELECT COUNT(*) FROM salary_records`) });
      sections.push({ title: "رواتب قيد المراجعة", value: await safeCount(`SELECT COUNT(*) FROM salary_records WHERE status = 'review'`) });
    }

    if (!cards.length) {
      cards.push({ id: "personal", title: "حسابي", value: 1 });
      sections.push({ title: "المهام الشخصية", value: 0 });
    }

    res.status(200).json({
      stats: {
        users: cards.find((c) => c.id === "users")?.value || 0,
        departments: cards.find((c) => c.id === "departments")?.value || 0,
        employees: cards.find((c) => c.id === "employees")?.value || 0,
        attendance: cards.find((c) => c.id === "attendance")?.value || 0,
        salaries: cards.find((c) => c.id === "salaries")?.value || 0,
        leaves: cards.find((c) => c.id === "leaves")?.value || 0,
      },
      cards,
      sections,
      roles: access.roles,
      permissions: access.permissions,
    });
  } catch (error) {
    res.status(500).json({ error: "حدث خطأ أثناء تحميل لوحة التحكم" });
  }
};

module.exports = { getStats };
