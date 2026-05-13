const pool = require("../db");
const { getUserAccess, hasPermissionValue } = require("../services/permission.service");

const safeCount = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return Number(result.rows[0]?.count || 0);
  } catch (_) {
    return 0;
  }
};

let dashboardCache = null;
const CACHE_MS = 15000;

const loadGlobalCounts = async () => {
  if (dashboardCache && Date.now() - dashboardCache.time < CACHE_MS) return dashboardCache.data;
  const [users, departments, employees, attendance, lateToday, absentToday, leaveRequests, pendingLeaves, employeeRequestsPending, salaries, salariesReview] = await Promise.all([
    safeCount(`SELECT COUNT(*) FROM users`),
    safeCount(`SELECT COUNT(*) FROM departments`),
    safeCount(`SELECT COUNT(*) FROM employees`),
    safeCount(`SELECT COUNT(*) FROM attendance_records`),
    safeCount(`SELECT COUNT(*) FROM attendance_records WHERE attendance_date = CURRENT_DATE AND status = 'late'`),
    safeCount(`SELECT COUNT(*) FROM attendance_records WHERE attendance_date = CURRENT_DATE AND status = 'absent'`),
    safeCount(`SELECT COUNT(*) FROM leave_requests`),
    safeCount(`SELECT COUNT(*) FROM leave_requests WHERE status = 'pending'`),
    safeCount(`SELECT COUNT(*) FROM employee_requests WHERE status IN ('pending','needs_info')`),
    safeCount(`SELECT COUNT(*) FROM salary_records`),
    safeCount(`SELECT COUNT(*) FROM salary_records WHERE status IN ('review','pending_review','draft')`),
  ]);
  const data = { users, departments, employees, attendance, lateToday, absentToday, leaveRequests, pendingLeaves, employeeRequestsPending, salaries, salariesReview };
  dashboardCache = { time: Date.now(), data };
  return data;
};

const getStats = async (req, res) => {
  try {
    const [access, counts] = await Promise.all([getUserAccess(req.user.id, req.user), loadGlobalCounts()]);
    const cards = [];
    const sections = [];

    if (hasPermissionValue(access, "users.view") || hasPermissionValue(access, "permissions.view")) {
      cards.push({ id: "users", title: "المستخدمون", value: counts.users });
    }
    if (hasPermissionValue(access, "departments.view")) {
      cards.push({ id: "departments", title: "الأقسام", value: counts.departments });
    }
    if (hasPermissionValue(access, "employees.view")) {
      cards.push({ id: "employees", title: "الموظفون", value: counts.employees });
    }
    if (hasPermissionValue(access, "attendance.view") || hasPermissionValue(access, "attendance.view.all")) {
      cards.push({ id: "attendance", title: "سجلات الحضور", value: counts.attendance });
      cards.push({ id: "late", title: "تأخير اليوم", value: counts.lateToday });
      cards.push({ id: "absent", title: "غياب اليوم", value: counts.absentToday });
    }
    if (hasPermissionValue(access, "leaves.view") || hasPermissionValue(access, "requests.view.all") || hasPermissionValue(access, "requests.manage")) {
      cards.push({ id: "leaves", title: "الطلبات", value: counts.leaveRequests + counts.employeeRequestsPending });
      sections.push({ title: "طلبات تحتاج مراجعة", value: counts.pendingLeaves + counts.employeeRequestsPending });
    }
    if (hasPermissionValue(access, "salaries.view") || hasPermissionValue(access, "finance.view")) {
      cards.push({ id: "salaries", title: "سجلات الرواتب", value: counts.salaries });
      sections.push({ title: "رواتب قيد المراجعة", value: counts.salariesReview });
    }
    if (!cards.length) {
      cards.push({ id: "personal", title: "حسابي", value: 1 });
      sections.push({ title: "المهام الشخصية", value: 0 });
    }

    res.status(200).json({
      stats: {
        users: counts.users,
        departments: counts.departments,
        employees: counts.employees,
        attendance: counts.attendance,
        salaries: counts.salaries,
        leaves: counts.leaveRequests,
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
