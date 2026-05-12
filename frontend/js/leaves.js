const API_BASE_URL = "https://hr-system-backend.onrender.com/api";
const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
const role = currentUser.role;
// Only allow admin or hr roles to view this page
if (!token || (role !== 'admin' && role !== 'hr')) {
  window.location.href = './dashboard.html';
}

// DOM elements
const leaveTableBody = document.getElementById('leaveTableBody');
const leaveForm = document.getElementById('leaveForm');
const leaveSearchInput = document.getElementById('leaveSearchInput');
const leaveEmployeeFilter = document.getElementById('leaveEmployeeFilter');
const leaveStatusFilter = document.getElementById('leaveStatusFilter');
const leaveTypeFilter = document.getElementById('leaveTypeFilter');
const leaveFromDate = document.getElementById('leaveFromDate');
const leaveToDate = document.getElementById('leaveToDate');
const leavesCountText = document.getElementById('leavesCountText');
const refreshLeavesBtn = document.getElementById('refreshLeavesBtn');
const exportLeavesBtn = document.getElementById('exportLeavesBtn');
const employeeSelect = document.getElementById('employee_id');
const message = document.getElementById('message');

let leavesData = [];
let employees = [];

function calculateDays(fromDate, toDate) {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  const diffTime = end - start;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function getStatusBadge(status) {
  switch (status) {
    case 'pending':
      return '<span class="badge badge-warning">معلقة</span>';
    case 'approved':
      return '<span class="badge badge-success">مقبولة</span>';
    case 'rejected':
      return '<span class="badge badge-danger">مرفوضة</span>';
    default:
      return `<span class="badge badge-secondary">${status}</span>`;
  }
}

async function loadEmployees() {
  try {
    const res = await fetch(`${API_BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    employees = data.users || [];
    // Populate select options if exist
    if (employeeSelect) {
      employeeSelect.innerHTML = '<option value="">اختر الموظف</option>';
      employees.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = emp.full_name;
        employeeSelect.appendChild(option);
      });
    }
    if (leaveEmployeeFilter) {
      leaveEmployeeFilter.innerHTML = '<option value="">جميع الموظفين</option>';
      employees.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = emp.full_name;
        leaveEmployeeFilter.appendChild(option);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadLeaves() {
  try {
    const res = await fetch(`${API_BASE_URL}/leaves`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    leavesData = data.leaves || [];
    applyFiltersAndRender();
  } catch (err) {
    console.error(err);
  }
}

function applyFiltersAndRender() {
  let filtered = leavesData.slice();
  const searchVal = leaveSearchInput?.value.toLowerCase() || '';
  const empFilter = leaveEmployeeFilter?.value || '';
  const statusFilter = leaveStatusFilter?.value || '';
  const typeFilter = leaveTypeFilter?.value || '';
  const fromDateVal = leaveFromDate?.value || '';
  const toDateVal = leaveToDate?.value || '';

  filtered = filtered.filter(leave => {
    const employee = employees.find(emp => emp.id === leave.employee_id);
    const searchMatch = !searchVal || leave.reason.toLowerCase().includes(searchVal) || (employee && employee.full_name.toLowerCase().includes(searchVal));
    const empMatch = !empFilter || leave.employee_id === parseInt(empFilter);
    const statusMatch = !statusFilter || leave.status === statusFilter;
    const typeMatch = !typeFilter || leave.leave_type === typeFilter;
    const fromMatch = !fromDateVal || new Date(leave.from_date) >= new Date(fromDateVal);
    const toMatch = !toDateVal || new Date(leave.to_date) <= new Date(toDateVal);
    return searchMatch && empMatch && statusMatch && typeMatch && fromMatch && toMatch;
  });

  renderLeaves(filtered);
  if (leavesCountText) {
    leavesCountText.textContent = `عرض ${filtered.length} من أصل ${leavesData.length} طلب`;
  }
}

function renderLeaves(leaves) {
  if (!leaveTableBody) return;
  leaveTableBody.innerHTML = '';
  leaves.forEach(leave => {
    const employee = employees.find(emp => emp.id === leave.employee_id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${leave.id}</td>
      <td>${employee ? employee.full_name : ''}</td>
      <td>${leave.leave_type}</td>
      <td>${leave.reason}</td>
      <td>${leave.from_date}</td>
      <td>${leave.to_date}</td>
      <td>${calculateDays(leave.from_date, leave.to_date)}</td>
      <td>${getStatusBadge(leave.status)}</td>
      <td>
        ${leave.status === 'pending' ? `
          <button data-id="${leave.id}" data-action="approve" class="btn btn-success btn-sm">قبول</button>
          <button data-id="${leave.id}" data-action="reject" class="btn btn-danger btn-sm">رفض</button>
        ` : ''}
        <button data-id="${leave.id}" data-action="delete" class="btn btn-secondary btn-sm">حذف</button>
      </td>
    `;
    leaveTableBody.appendChild(tr);
  });
}

// Table button actions
if (leaveTableBody) {
  leaveTableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (!id || !action) return;
    if (action === 'approve' || action === 'reject') {
      try {
        await fetch(`${API_BASE_URL}/leaves/${id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: action === 'approve' ? 'approved' : 'rejected' })
        });
        await loadLeaves();
      } catch (err) {
        console.error(err);
      }
    } else if (action === 'delete') {
      if (confirm('هل أنت متأكد من حذف هذا الطلب؟')) {
        try {
          await fetch(`${API_BASE_URL}/leaves/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          await loadLeaves();
        } catch (err) {
          console.error(err);
        }
      }
    }
  });
}

// Filter listeners
leaveSearchInput?.addEventListener('input', applyFiltersAndRender);
leaveEmployeeFilter?.addEventListener('change', applyFiltersAndRender);
leaveStatusFilter?.addEventListener('change', applyFiltersAndRender);
leaveTypeFilter?.addEventListener('change', applyFiltersAndRender);
leaveFromDate?.addEventListener('change', applyFiltersAndRender);
leaveToDate?.addEventListener('change', applyFiltersAndRender);

refreshLeavesBtn?.addEventListener('click', () => {
  loadLeaves();
});

// CSV export of filtered leaves
exportLeavesBtn?.addEventListener('click', () => {
  let filtered = leavesData.slice();
  const searchVal = leaveSearchInput?.value.toLowerCase() || '';
  const empFilter = leaveEmployeeFilter?.value || '';
  const statusFilter = leaveStatusFilter?.value || '';
  const typeFilter = leaveTypeFilter?.value || '';
  const fromDateVal = leaveFromDate?.value || '';
  const toDateVal = leaveToDate?.value || '';
  filtered = filtered.filter(leave => {
    const employee = employees.find(emp => emp.id === leave.employee_id);
    const searchMatch = !searchVal || leave.reason.toLowerCase().includes(searchVal) || (employee && employee.full_name.toLowerCase().includes(searchVal));
    const empMatch = !empFilter || leave.employee_id === parseInt(empFilter);
    const statusMatch = !statusFilter || leave.status === statusFilter;
    const typeMatch = !typeFilter || leave.leave_type === typeFilter;
    const fromMatch = !fromDateVal || new Date(leave.from_date) >= new Date(fromDateVal);
    const toMatch = !toDateVal || new Date(leave.to_date) <= new Date(toDateVal);
    return searchMatch && empMatch && statusMatch && typeMatch && fromMatch && toMatch;
  });
  const csvRows = [];
  csvRows.push(['رقم الطلب', 'الموظف', 'نوع الإجازة', 'السبب', 'تاريخ البداية', 'تاريخ النهاية', 'عدد الأيام', 'الحالة'].join(','));
  filtered.forEach(leave => {
    const employee = employees.find(emp => emp.id === leave.employee_id);
    csvRows.push([
      leave.id,
      employee ? employee.full_name : '',
      leave.leave_type,
      leave.reason.replace(/,/g, ';'),
      leave.from_date,
      leave.to_date,
      calculateDays(leave.from_date, leave.to_date),
      leave.status
    ].join(','));
  });
  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + csvRows.join('\n');
  const link = document.createElement('a');
  link.setAttribute('href', encodeURI(csvContent));
  link.setAttribute('download', 'leaves.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// Form submission to add leave
if (leaveForm) {
  leaveForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    message.textContent = '';
    message.style.color = '';
    const payload = {
      employee_id: parseInt(employeeSelect.value),
      leave_type: leaveForm.leave_type.value,
      reason: leaveForm.reason.value,
      from_date: leaveForm.from_date.value,
      to_date: leaveForm.to_date.value
    };
    // Validate
    if (!payload.employee_id || !payload.leave_type || !payload.reason || !payload.from_date || !payload.to_date) {
      message.style.color = 'red';
      message.textContent = 'الرجاء ملء جميع الحقول';
      return;
    }
    if (new Date(payload.to_date) < new Date(payload.from_date)) {
      message.style.color = 'red';
      message.textContent = 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية';
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/leaves`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        message.style.color = 'green';
        message.textContent = 'تم تقديم طلب الإجازة بنجاح';
        leaveForm.reset();
        await loadLeaves();
      } else {
        const err = await res.json();
        message.style.color = 'red';
        message.textContent = err.error || 'حدث خطأ ما';
      }
    } catch (error) {
      console.error(error);
      message.style.color = 'red';
      message.textContent = 'حدث خطأ ما';
    }
  });
}

// Initialization on DOM load
window.addEventListener('DOMContentLoaded', async () => {
  await loadEmployees();
  await loadLeaves();
});
