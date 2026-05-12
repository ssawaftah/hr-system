const tableBody = document.getElementById("leavesTableBody");
const form = document.getElementById("leaveForm");
const formMessage = document.getElementById("formMessage");
const employeeSelect = document.getElementById("employee_id");

const initLeaves = async () => {
  const user = await loadLoggedUser();

  if (!user || user.role === "employee") {
    window.location.href = "./dashboard.html";
    return;
  }

  await loadEmployees();
  await loadLeaves();
};

const formatDate = (date) => date ? date.split("T")[0] : "-";

const loadEmployees = async () => {
  const response = await fetch(`${API_BASE_URL}/employees`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) return;

  employeeSelect.innerHTML = `<option value="">اختر الموظف</option>`;

  data.employees.forEach((employee) => {
    employeeSelect.innerHTML += `<option value="${employee.id}">${employee.full_name}</option>`;
  });
};

const loadLeaves = async () => {
  const response = await fetch(`${API_BASE_URL}/leaves`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    tableBody.innerHTML = `<tr><td colspan="8">${data.error}</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";

  data.leaves.forEach((leave) => {
    tableBody.innerHTML += `
      <tr>
        <td>${leave.id}</td>
        <td>${leave.employee_name}</td>
        <td>${leave.leave_type}</td>
        <td>${formatDate(leave.start_date)}</td>
        <td>${formatDate(leave.end_date)}</td>
        <td>${leave.reason || "-"}</td>
        <td>${leave.status}</td>
        <td>
          <button class="edit-btn" onclick="updateLeaveStatus(${leave.id}, 'approved')">قبول</button>
          <button class="secondary-btn" onclick="updateLeaveStatus(${leave.id}, 'rejected')">رفض</button>
          <button class="danger-btn" onclick="deleteLeave(${leave.id})">حذف</button>
        </td>
      </tr>
    `;
  });
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    employee_id: document.getElementById("employee_id").value,
    leave_type: document.getElementById("leave_type").value,
    start_date: document.getElementById("start_date").value,
    end_date: document.getElementById("end_date").value,
    reason: document.getElementById("reason").value.trim(),
  };

  const response = await fetch(`${API_BASE_URL}/leaves`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    formMessage.style.color = "red";
    formMessage.textContent = data.error;
    return;
  }

  formMessage.style.color = "green";
  formMessage.textContent = data.message;
  form.reset();
  await loadLeaves();
});

const updateLeaveStatus = async (id, status) => {
  const response = await fetch(`${API_BASE_URL}/leaves/${id}/status`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status,
      admin_notes: "",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error);
    return;
  }

  await loadLeaves();
};

const deleteLeave = async (id) => {
  if (!confirm("هل أنت متأكد من حذف طلب الإجازة؟")) return;

  const response = await fetch(`${API_BASE_URL}/leaves/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error);
    return;
  }

  await loadLeaves();
};

initLeaves();
