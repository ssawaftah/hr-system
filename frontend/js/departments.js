const tableBody = document.getElementById("departmentsTableBody");
const form = document.getElementById("departmentForm");
const formMessage = document.getElementById("formMessage");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const parentSelect = document.getElementById("parentDepartmentId");
const treeBox = document.getElementById("departmentTree");
let departments = [];
let departmentTree = [];

const initDepartments = async () => {
  const user = await loadLoggedUser();
  if (!user || user.role === "employee") {
    window.location.href = "./dashboard.html";
    return;
  }
  await loadDepartments();
};

const loadDepartments = async () => {
  const response = await fetch(`${API_BASE_URL}/departments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    tableBody.innerHTML = `<tr><td colspan="6">${data.error}</td></tr>`;
    return;
  }
  departments = data.departments || [];
  departmentTree = data.tree || [];
  renderParentOptions();
  renderDepartments();
  renderTree();
};

const renderParentOptions = (currentId = "") => {
  parentSelect.innerHTML = `<option value="">قسم رئيسي بدون أب</option>`;
  departments
    .filter((department) => String(department.id) !== String(currentId))
    .forEach((department) => {
      const prefix = department.parent_id ? "— " : "";
      parentSelect.innerHTML += `<option value="${department.id}">${prefix}${department.name}</option>`;
    });
};

const renderTreeNode = (node, level = 0) => {
  const children = node.children || [];
  return `
    <div class="tree-node" style="margin-right:${level * 18}px">
      <div class="tree-node-card">
        <span class="soft-badge ${level === 0 ? "primary-badge" : ""}">${level === 0 ? "رئيسي" : "فرعي"}</span>
        <strong>${node.name}</strong>
        <small>${node.description || "لا يوجد وصف"}</small>
      </div>
      ${children.map((child) => renderTreeNode(child, level + 1)).join("")}
    </div>
  `;
};

const renderTree = () => {
  if (!treeBox) return;
  if (!departmentTree.length) {
    treeBox.innerHTML = `<p>لا توجد أقسام بعد</p>`;
    return;
  }
  treeBox.innerHTML = departmentTree.map((node) => renderTreeNode(node)).join("");
};

const renderDepartments = () => {
  tableBody.innerHTML = "";
  if (!departments.length) {
    tableBody.innerHTML = `<tr><td colspan="6">لا توجد أقسام</td></tr>`;
    return;
  }
  departments.forEach((department) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${department.id}</td>
      <td>${department.name}</td>
      <td>${department.parent_name || "قسم رئيسي"}</td>
      <td>${department.description || "-"}</td>
      <td><span class="status-badge ${department.is_active ? "active-badge" : "inactive-badge"}">${department.is_active ? "نشط" : "معطل"}</span></td>
      <td>
        <button class="edit-btn" onclick="editDepartment(${department.id})">تعديل</button>
        <button class="danger-btn" onclick="deleteDepartment(${department.id})">حذف</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
};

const editDepartment = (id) => {
  const department = departments.find((item) => item.id === id);
  if (!department) return;
  document.getElementById("departmentId").value = department.id;
  document.getElementById("departmentName").value = department.name;
  document.getElementById("departmentDescription").value = department.description || "";
  document.getElementById("departmentActive").value = String(department.is_active);
  renderParentOptions(id);
  parentSelect.value = department.parent_id || "";
  document.getElementById("departmentFormTitle").textContent = "تعديل قسم";
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const resetForm = () => {
  form.reset();
  document.getElementById("departmentId").value = "";
  document.getElementById("departmentFormTitle").textContent = "إضافة قسم";
  renderParentOptions();
};

cancelEditBtn.addEventListener("click", resetForm);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("departmentId").value;
  const body = {
    name: document.getElementById("departmentName").value.trim(),
    description: document.getElementById("departmentDescription").value.trim(),
    parent_id: parentSelect.value || null,
    is_active: document.getElementById("departmentActive").value === "true",
  };
  const url = id ? `${API_BASE_URL}/departments/${id}` : `${API_BASE_URL}/departments`;
  const method = id ? "PUT" : "POST";
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    formMessage.className = "inline-message error-message";
    formMessage.textContent = data.error || "تعذر حفظ القسم";
    return;
  }
  formMessage.className = "inline-message success-message";
  formMessage.textContent = data.message || "تم حفظ القسم بنجاح";
  resetForm();
  await loadDepartments();
});

const deleteDepartment = async (id) => {
  if (!confirm("هل أنت متأكد من حذف القسم؟")) return;
  const response = await fetch(`${API_BASE_URL}/departments/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    alert(data.error || "تعذر حذف القسم");
    return;
  }
  await loadDepartments();
};

initDepartments();
