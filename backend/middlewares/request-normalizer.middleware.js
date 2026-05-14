const normalizeRequestType = (value) => {
  const v = String(value || '').trim();
  const map = {
    leave: 'leave', 'إجازة': 'leave', 'اجازة': 'leave', 'طلب إجازة': 'leave', 'طلب اجازة': 'leave',
    exit: 'exit', 'مغادرة': 'exit', 'طلب مغادرة': 'exit', 'إذن مغادرة': 'exit', 'اذن مغادرة': 'exit',
    advance: 'advance', 'سلفة': 'advance', 'سلفه': 'advance', 'طلب سلفة': 'advance', 'طلب سلفه': 'advance',
    resignation: 'resignation', 'استقالة': 'resignation', 'طلب استقالة': 'resignation',
    complaint: 'complaint', 'شكوى': 'complaint', 'شكاوى': 'complaint',
    custom: 'custom', 'طلب مخصص': 'custom', 'أخرى': 'custom', 'اخرى': 'custom'
  };
  return map[v] || v;
};

const normalizeLeaveType = (value) => {
  const v = String(value || '').trim();
  const map = {
    annual: 'annual', 'سنوية': 'annual', 'إجازة سنوية': 'annual', 'اجازة سنوية': 'annual',
    sick: 'sick', 'مرضية': 'sick', 'إجازة مرضية': 'sick', 'اجازة مرضية': 'sick',
    emergency: 'emergency', 'طارئة': 'emergency', 'إجازة طارئة': 'emergency', 'اجازة طارئة': 'emergency',
    unpaid: 'unpaid', 'بدون راتب': 'unpaid', 'إجازة بدون راتب': 'unpaid', 'اجازة بدون راتب': 'unpaid',
    other: 'other', 'أخرى': 'other', 'اخرى': 'other'
  };
  return map[v] || v;
};

const normalizeExitType = (value) => {
  const v = String(value || '').trim();
  const map = {
    personal: 'personal', 'شخصية': 'personal', 'مغادرة شخصية': 'personal', 'اذن شخصي': 'personal', 'إذن شخصي': 'personal',
    work: 'work', 'عمل': 'work', 'مهمة عمل': 'work', 'مغادرة عمل': 'work', 'رسمية': 'work',
    medical: 'medical', 'طبية': 'medical', 'مغادرة طبية': 'medical',
    other: 'other', 'أخرى': 'other', 'اخرى': 'other'
  };
  return map[v] || v;
};

const normalizeDeductionMethod = (value) => {
  const v = String(value || '').trim();
  const map = {
    one_time: 'one_time', 'مرة واحدة': 'one_time', 'دفعه واحده': 'one_time', 'دفعة واحدة': 'one_time',
    installments: 'installments', 'أقساط': 'installments', 'اقساط': 'installments', 'تقسيط': 'installments'
  };
  return map[v] || v;
};

const normalizeRequestPayload = (req, _res, next) => {
  if (!req.body) return next();
  req.body.request_type = normalizeRequestType(req.body.request_type);
  const data = req.body.request_data || {};
  if (data.leave_type !== undefined) data.leave_type = normalizeLeaveType(data.leave_type);
  if (data.exit_type !== undefined) data.exit_type = normalizeExitType(data.exit_type);
  if (data.deduction_method !== undefined) data.deduction_method = normalizeDeductionMethod(data.deduction_method);
  req.body.request_data = data;
  next();
};

module.exports = {
  normalizeRequestPayload,
  normalizeRequestType,
  normalizeLeaveType,
  normalizeExitType,
  normalizeDeductionMethod,
};
