const pool = require("../db");
const { ensureAttendanceSchema, upsertAutoAttendance } = require("./attendance.controller");
const { ensureSalarySchema, ensureLeaveBalanceForEmployee } = require("./finance.controller");
const { getUserAccess, hasPermissionValue } = require("../services/permission.service");

const REQUEST_TYPES = ["leave", "exit", "advance", "resignation", "complaint", "custom"];

const ensureRequestSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_requests (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      department_id INTEGER,
      request_type VARCHAR(50) NOT NULL,
      request_title VARCHAR(180) NOT NULL,
      request_data JSONB DEFAULT '{}'::jsonb,
      status VARCHAR(40) DEFAULT 'pending',
      priority VARCHAR(40),
      current_reviewer_id INTEGER,
      created_by INTEGER,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      cancelled_at TIMESTAMP,
      final_decision_by INTEGER,
      final_decision_reason TEXT,
      final_decision_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_request_action_logs (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES employee_requests(id) ON DELETE CASCADE,
      action VARCHAR(80) NOT NULL,
      actor_user_id INTEGER,
      actor_employee_id INTEGER,
      actor_name VARCHAR(160),
      reason TEXT,
      comment TEXT,
      old_status VARCHAR(40),
      new_status VARCHAR(40),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS employee_requests_employee_idx ON employee_requests(employee_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS employee_requests_created_by_idx ON employee_requests(created_by)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS employee_requests_status_idx ON employee_requests(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS employee_requests_type_idx ON employee_requests(request_type)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS employee_requests_updated_idx ON employee_requests(updated_at DESC)`);
};

const getAccess = async (req) => getUserAccess(req.user.id, req.user);
const can = (access, permission) => hasPermissionValue(access, permission);
const canAny = (access, permissions) => permissions.some((permission) => can(access, permission));
const asInt = (value) => (value === undefined || value === null || value === "" ? null : Number(value));
const asText = (value) => (value === undefined || value === null || value === "" ? null : String(value));
const money = (value) => Number(value || 0);
const currentMonth = () => new Date().toISOString().slice(0, 7);

const getCurrentEmployeeId = async (req) => {
  if (req.user?.employee_id) return Number(req.user.employee_id);
  const user = await pool.query(`SELECT employee_id, employee_number, email FROM users WHERE id=$1::int`, [asInt(req.user?.id) || 0]);
  if (user.rows[0]?.employee_id) return Number(user.rows[0].employee_id);
  if (user.rows[0]?.employee_number) {
    const employee = await pool.query(`SELECT id FROM employees WHERE employee_number=$1::text`, [String(user.rows[0].employee_number)]);
    return employee.rows[0]?.id ? Number(employee.rows[0].id) : null;
  }
  if (user.rows[0]?.email) {
    const employee = await pool.query(`SELECT id FROM employees WHERE LOWER(email)=LOWER($1) LIMIT 1`, [user.rows[0].email]);
    return employee.rows[0]?.id ? Number(employee.rows[0].id) : null;
  }
  return null;
};

const addLog = async ({ requestId, action, req, reason = null, comment = null, oldStatus = null, newStatus = null }) => {
  const actorEmployeeId = await getCurrentEmployeeId(req);
  await pool.query(
    `INSERT INTO employee_request_action_logs
     (request_id, action, actor_user_id, actor_employee_id, actor_name, reason, comment, old_status, new_status)
     VALUES ($1::int,$2::text,$3::int,$4::int,$5::text,$6::text,$7::text,$8::text,$9::text)`,
    [asInt(requestId), asText(action), asInt(req.user?.id), asInt(actorEmployeeId), asText(req.user?.full_name), asText(reason), asText(comment), asText(oldStatus), asText(newStatus)]
  );
};

const getPrimaryDepartmentId = async (employeeId) => {
  if (!employeeId) return null;
  const result = await pool.query(
    `SELECT COALESCE(ed.department_id, e.department_id) AS department_id
     FROM employees e
     LEFT JOIN employee_departments ed ON ed.employee_id=e.id AND ed.is_primary=true
     WHERE e.id=$1::int LIMIT 1`,
    [asInt(employeeId)]
  );
  return result.rows[0]?.department_id ? Number(result.rows[0].department_id) : null;
};

const isSameDepartmentRequest = async (request, actorEmployeeId) => {
  if (!request?.department_id || !actorEmployeeId) return false;
  const departmentId = await getPrimaryDepartmentId(actorEmployeeId);
  return Number(request.department_id) === Number(departmentId);
};

const dateRange = (startDate, endDate) => {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) dates.push(cursor.toISOString().split("T")[0]);
  return dates;
};
const calculateDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  return Math.max(0, Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1);
};
const hoursDiff = (from, to) => {
  if (!from || !to) return 0;
  const [fh, fm] = String(from).split(":").map(Number);
  const [th, tm] = String(to).split(":").map(Number);
  return Math.max(0, ((th * 60 + tm) - (fh * 60 + fm)) / 60);
};
const requiredLeaveDaysForRequest = (type, data) => {
  if (type === "leave" && data.leave_type === "annual") return calculateDays(data.start_date, data.end_date);
  if (type === "exit" && (data.exit_type === "personal" || data.exit_type === "شخصية" || data.is_personal === true)) return hoursDiff(data.exit_time, data.return_time || data.expected_return_time) / 8;
  return 0;
};
const ensureEnoughLeaveBalance = async (employeeId, type, data) => {
  const required = requiredLeaveDaysForRequest(type, data);
  if (required <= 0) return;
  await ensureSalarySchema();
  const balance = await ensureLeaveBalanceForEmployee(employeeId);
  if (money(balance.remaining_days) < required) {
    throw new Error(`لا يمكن تقديم هذا الطلب لأن رصيد الإجازات غير كافٍ. المطلوب ${required.toFixed(2)} يوم والمتبقي ${money(balance.remaining_days).toFixed(2)} يوم.`);
  }
};
const consumeLeaveBalanceForApprovedRequest = async (request, req) => {
  const data = request.request_data || {};
  const required = requiredLeaveDaysForRequest(request.request_type, data);
  if (required <= 0) return;
  await ensureSalarySchema();
  const balance = await ensureLeaveBalanceForEmployee(request.employee_id, req);
  const consumed = money(balance.consumed_days) + required;
  await pool.query(
    `UPDATE employee_leave_balances SET consumed_days=$1, remaining_days=current_balance-$1, updated_by=$2, updated_at=CURRENT_TIMESTAMP WHERE employee_id=$3`,
    [consumed, asInt(req.user?.id), request.employee_id]
  );
};

const validateRequest = (type, data) => {
  if (!REQUEST_TYPES.includes(type)) return "نوع الطلب غير صحيح";
  if (type === "leave") {
    if (!data.leave_type) return "نوع الإجازة مطلوب";
    if (!data.start_date) return "تاريخ البداية مطلوب";
    if (!data.end_date) return "تاريخ النهاية مطلوب";
    if (new Date(data.end_date) < new Date(data.start_date)) return "تاريخ النهاية لا يمكن أن يكون قبل تاريخ البداية";
    if (!data.reason) return "يجب إدخال سبب الطلب";
  }
  if (type === "exit") {
    if (!data.exit_date) return "تاريخ المغادرة مطلوب";
    if (!data.exit_time) return "وقت المغادرة مطلوب";
    if (!data.reason) return "يجب إدخال سبب الطلب";
  }
  if (type === "advance") {
    if (!Number(data.amount) || Number(data.amount) <= 0) return "يرجى إدخال قيمة صحيحة للمبلغ";
    if (!data.reason) return "يجب إدخال سبب السلفة";
    if (!data.deduction_method) return "طريقة خصم السلفة مطلوبة";
    if (data.deduction_method === "installments" && (!Number(data.installments_count) || Number(data.installments_count) < 1)) return "عدد الأقساط مطلوب";
    if (!data.deduction_start_month) return "شهر بداية الخصم مطلوب";
  }
  if (type === "resignation") {
    if (!data.last_working_day) return "تاريخ آخر يوم عمل مطلوب";
    if (!data.reason) return "سبب الاستقالة مطلوب";
  }
  if (type === "complaint") {
    if (!data.title) return "عنوان الشكوى مطلوب";
    if (!data.details) return "تفاصيل الشكوى مطلوبة";
  }
  if (type === "custom") {
    if (!data.title) return "عنوان الطلب مطلوب";
    if (!data.details) return "تفاصيل الطلب مطلوبة";
  }
  return null;
};

const titleFor = (type, data) => {
  const labels = { leave: "طلب إجازة", exit: "طلب مغادرة", advance: "طلب سلفة", resignation: "طلب استقالة", complaint: "شكوى", custom: "طلب مخصص" };
  if (type === "advance") return `طلب سلفة - ${money(data.amount).toFixed(2)}`;
  return data.title || labels[type] || "طلب";
};

const materializeApprovedLeave = async (request) => {
  if (!request || request.request_type !== "leave" || request.status !== "approved") return;
  const data = request.request_data || {};
  if (!data.start_date || !data.end_date) return;
  await ensureAttendanceSchema();
  for (const date of dateRange(data.start_date, data.end_date)) {
    await upsertAutoAttendance({ employeeId: request.employee_id, date, status: "absent", source: "approved_leave", notes: `غياب بعذر - إجازة معتمدة (${data.leave_type || "إجازة"})${data.reason ? ` - ${data.reason}` : ""}`, leaveRequestId: request.id, absenceReason: "excused_leave" });
  }
};

const materializeApprovedAdvance = async (request, req) => {
  if (!request || request.request_type !== "advance" || request.status !== "approved") return;
  await ensureSalarySchema();
  const existing = await pool.query(`SELECT id FROM employee_advances WHERE request_id=$1`, [request.id]);
  if (existing.rows.length) return;
  const data = request.request_data || {};
  const amount = money(data.amount);
  if (amount <= 0) return;
  const deductionMethod = data.deduction_method || "installments";
  const installmentsCount = deductionMethod === "one_time" ? 1 : Number(data.installments_count || 1);
  const monthlyAmount = money(data.monthly_installment_amount || (amount / installmentsCount));
  const startMonth = data.deduction_start_month || currentMonth();
  const paidAt = data.paid_at || new Date().toISOString().slice(0, 10);
  const advance = await pool.query(`INSERT INTO employee_advances (employee_id, request_id, amount, paid_at, deduction_method, installments_count, monthly_installment_amount, deduction_start_month, status, reason, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10,$11) RETURNING *`, [request.employee_id, request.id, amount, paidAt, deductionMethod, installmentsCount, monthlyAmount, startMonth, data.reason || null, data.notes || null, asInt(req.user?.id)]);
  const [startYear, startMonthNumber] = startMonth.split("-").map(Number);
  for (let i = 0; i < installmentsCount; i += 1) {
    const date = new Date(Date.UTC(startYear, startMonthNumber - 1 + i, 1));
    const salaryMonth = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    await pool.query(`INSERT INTO advance_installments (advance_id, salary_month, amount, status) VALUES ($1,$2,$3,'due')`, [advance.rows[0].id, salaryMonth, monthlyAmount]);
  }
};

const baseSelect = `
  SELECT r.id, r.employee_id, r.department_id, r.request_type, r.request_title, r.request_data, r.status,
         r.priority, r.submitted_at, r.completed_at, r.cancelled_at, r.final_decision_reason,
         r.created_at, r.updated_at, e.full_name AS employee_name, e.employee_number, d.name AS department_name
  FROM employee_requests r
  JOIN employees e ON e.id=r.employee_id
  LEFT JOIN departments d ON d.id=r.department_id
`;

const getRequests = async (req, res) => {
  try {
    await ensureRequestSchema();
    const access = await getAccess(req);
    const employeeId = await getCurrentEmployeeId(req);
    const userId = asInt(req.user?.id) || 0;
    let where = ""; const params = [];
    if (canAny(access, ["requests.view.all", "requests.manage"])) where = "";
    else if (can(access, "requests.view.department")) {
      const departmentId = await getPrimaryDepartmentId(employeeId);
      if (!departmentId) { where = "WHERE r.employee_id=$1::int OR r.created_by=$2::int"; params.push(asInt(employeeId) || 0, userId); }
      else { where = "WHERE r.department_id=$1::int OR r.employee_id=$2::int OR r.created_by=$3::int"; params.push(asInt(departmentId), asInt(employeeId) || 0, userId); }
    } else { where = "WHERE r.employee_id=$1::int OR r.created_by=$2::int"; params.push(asInt(employeeId) || 0, userId); }
    const result = await pool.query(`${baseSelect} ${where} ORDER BY CASE WHEN r.status='pending' THEN 0 WHEN r.status='needs_info' THEN 1 ELSE 2 END, r.id DESC LIMIT 150`, params);
    res.status(200).json({ requests: result.rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getRequestById = async (req, res) => {
  try {
    await ensureRequestSchema();
    const access = await getAccess(req);
    const employeeId = await getCurrentEmployeeId(req);
    const result = await pool.query(`${baseSelect} WHERE r.id=$1::int`, [asInt(req.params.id)]);
    if (!result.rows.length) return res.status(404).json({ error: "الطلب غير موجود" });
    const request = result.rows[0];
    const sameEmployee = Number(request.employee_id) === Number(employeeId);
    const sameCreator = Number(request.created_by) === Number(req.user?.id);
    const sameDepartment = request.department_id && Number(request.department_id) === await getPrimaryDepartmentId(employeeId);
    if (!sameEmployee && !sameCreator && !canAny(access, ["requests.view.all", "requests.manage"]) && !(sameDepartment && can(access, "requests.view.department"))) return res.status(403).json({ error: "لا تملك صلاحية الوصول" });
    const logs = await pool.query(`SELECT * FROM employee_request_action_logs WHERE request_id=$1::int ORDER BY id ASC`, [asInt(req.params.id)]);
    res.status(200).json({ request, logs: logs.rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const createRequest = async (req, res) => {
  try {
    await ensureRequestSchema();
    const access = await getAccess(req);
    const currentEmployeeId = await getCurrentEmployeeId(req);
    if (!canAny(access, ["requests.create.self", "requests.manage"])) return res.status(403).json({ error: "لا تملك صلاحية تنفيذ هذا الإجراء" });
    const type = req.body.request_type; const data = req.body.request_data || {};
    const validation = validateRequest(type, data); if (validation) return res.status(400).json({ error: validation });
    const employeeId = can(access, "requests.manage") && req.body.employee_id ? asInt(req.body.employee_id) : asInt(currentEmployeeId);
    if (!employeeId) return res.status(400).json({ error: "لا يوجد موظف مرتبط بحسابك" });
    await ensureEnoughLeaveBalance(employeeId, type, data);
    const departmentId = await getPrimaryDepartmentId(employeeId);
    const status = req.body.status === "draft" ? "draft" : "pending";
    const submittedAt = status === "pending" ? new Date() : null;
    const result = await pool.query(`INSERT INTO employee_requests (employee_id, department_id, request_type, request_title, request_data, status, priority, created_by, submitted_at, updated_at) VALUES ($1::int,$2::int,$3::text,$4::text,$5::jsonb,$6::text,$7::text,$8::int,$9::timestamp,CURRENT_TIMESTAMP) RETURNING *`, [employeeId, asInt(departmentId), asText(type), asText(titleFor(type, data)), JSON.stringify(data), asText(status), asText(req.body.priority), asInt(req.user?.id), submittedAt]);
    await addLog({ requestId: result.rows[0].id, action: status === "draft" ? "created" : "submitted", req, oldStatus: null, newStatus: status });
    const enriched = await pool.query(`${baseSelect} WHERE r.id=$1::int`, [result.rows[0].id]);
    res.status(201).json({ message: status === "draft" ? "تم حفظ الطلب كمسودة" : "تم إرسال الطلب بنجاح", request: enriched.rows[0] || result.rows[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const actOnRequest = async (req, res) => {
  try {
    await ensureRequestSchema();
    const access = await getAccess(req);
    const employeeId = await getCurrentEmployeeId(req);
    const requestId = asInt(req.params.id);
    const existing = await pool.query(`SELECT * FROM employee_requests WHERE id=$1::int`, [requestId]);
    if (!existing.rows.length) return res.status(404).json({ error: "الطلب غير موجود" });
    const request = existing.rows[0];
    const action = String(req.body.action || "");
    const note = String(req.body.note || req.body.comment || req.body.reason || "").trim();
    const sameDepartment = await isSameDepartmentRequest(request, employeeId);
    let newStatus = request.status;

    if (action === "approve") {
      const allowed = canAny(access, ["requests.approve.all", "requests.manage"]) || (sameDepartment && can(access, "requests.approve.department"));
      if (!allowed) return res.status(403).json({ error: "لا تملك صلاحية اعتماد هذا الطلب" });
      await ensureEnoughLeaveBalance(request.employee_id, request.request_type, request.request_data || {});
      newStatus = "approved";
    } else if (action === "reject") {
      const allowed = canAny(access, ["requests.reject.all", "requests.manage"]) || (sameDepartment && can(access, "requests.reject.department"));
      if (!allowed) return res.status(403).json({ error: "لا تملك صلاحية رفض هذا الطلب" });
      newStatus = "rejected";
    } else if (action === "cancel") {
      const selfCancel = Number(request.employee_id) === Number(employeeId) && request.status === "pending" && can(access, "requests.cancel.self_pending");
      const departmentCancel = sameDepartment && can(access, "requests.cancel.department");
      if (!selfCancel && !departmentCancel && !canAny(access, ["requests.cancel.all", "requests.manage"])) return res.status(403).json({ error: "لا تملك صلاحية إلغاء هذا الطلب" });
      newStatus = "cancelled";
    } else if (action === "request_info") {
      const allowed = canAny(access, ["requests.request_info", "requests.manage"]) && (sameDepartment || canAny(access, ["requests.view.all", "requests.manage"]));
      if (!allowed) return res.status(403).json({ error: "لا تملك صلاحية طلب معلومات لهذا الطلب" });
      if (!note) return res.status(400).json({ error: "يرجى كتابة المعلومات المطلوبة" });
      newStatus = "needs_info";
    } else if (action === "respond_info") {
      if (Number(request.employee_id) !== Number(employeeId)) return res.status(403).json({ error: "لا تملك صلاحية تنفيذ هذا الإجراء" });
      if (!note) return res.status(400).json({ error: "يرجى كتابة الرد" });
      newStatus = "pending";
    } else if (action === "comment") {
      const allowed = Number(request.employee_id) === Number(employeeId) || canAny(access, ["requests.manage", "requests.view.all"]) || (sameDepartment && canAny(access, ["requests.comment", "requests.view.department"]));
      if (!allowed) return res.status(403).json({ error: "لا تملك صلاحية التعليق على هذا الطلب" });
      if (!note) return res.status(400).json({ error: "يجب إدخال تعليق" });
    } else return res.status(400).json({ error: "الإجراء غير صحيح" });

    const now = new Date(); const isFinal = ["approved", "rejected", "cancelled"].includes(newStatus);
    const completedAt = ["approved", "rejected"].includes(newStatus) ? now : request.completed_at || null;
    const cancelledAt = newStatus === "cancelled" ? now : request.cancelled_at || null;
    const finalDecisionBy = isFinal ? asInt(req.user?.id) : asInt(request.final_decision_by);
    const finalDecisionAt = isFinal ? now : request.final_decision_at || null;
    const finalReason = isFinal ? (note || null) : (request.final_decision_reason || null);
    const result = await pool.query(`UPDATE employee_requests SET status=$1::text, final_decision_reason=$2::text, final_decision_by=$3::int, final_decision_at=$4::timestamp, completed_at=$5::timestamp, cancelled_at=$6::timestamp, updated_at=CURRENT_TIMESTAMP WHERE id=$7::int RETURNING *`, [asText(newStatus), asText(finalReason), asInt(finalDecisionBy), finalDecisionAt, completedAt, cancelledAt, requestId]);
    const reason = ["reject", "cancel"].includes(action) ? note || null : null;
    const comment = ["approve", "request_info", "respond_info", "comment"].includes(action) ? note || null : null;
    await addLog({ requestId, action, req, reason, comment, oldStatus: request.status, newStatus });
    await materializeApprovedLeave(result.rows[0]);
    await consumeLeaveBalanceForApprovedRequest(result.rows[0], req);
    await materializeApprovedAdvance(result.rows[0], req);
    const enriched = await pool.query(`${baseSelect} WHERE r.id=$1::int`, [requestId]);
    res.status(200).json({ message: "تم تنفيذ الإجراء بنجاح", request: enriched.rows[0] || result.rows[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const deleteRequest = async (req, res) => {
  try {
    await ensureRequestSchema();
    const access = await getAccess(req);
    if (!can(access, "requests.manage")) return res.status(403).json({ error: "لا تملك صلاحية تنفيذ هذا الإجراء" });
    const result = await pool.query(`DELETE FROM employee_requests WHERE id=$1::int RETURNING id`, [asInt(req.params.id)]);
    if (!result.rows.length) return res.status(404).json({ error: "الطلب غير موجود" });
    res.status(200).json({ message: "تم حذف الطلب بنجاح" });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

module.exports = { getRequests, getRequestById, createRequest, actOnRequest, deleteRequest, ensureRequestSchema };
