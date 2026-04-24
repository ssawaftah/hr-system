import { db } from "../firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { showToast } from "../ui/toast.js";

/* =========================
   Employees Module (CORE HR)
   - Create / Read / Update / Delete
   - Role support
   - Integration with all modules
========================= */

const EMP_COL = "users";

/* =========================
   Add Employee
========================= */
export async function addEmployee(data) {

  /*
    data = {
      name,
      employeeId,
      password,
      role,
      department,
      position,
      baseSalary
    }
  */

  try {

    await addDoc(collection(db, EMP_COL), {
      name: data.name,
      employeeId: data.employeeId,
      password: data.password, // (internal system only)
      role: data.role || "employee",
      department: data.department || "",
      position: data.position || "",
      baseSalary: data.baseSalary || 300,
      status: "active",
      createdAt: new Date().toISOString()
    });

    showToast("تم إضافة الموظف بنجاح 👤", "success");

  } catch (err) {
    console.error(err);
    showToast("خطأ في إضافة الموظف", "error");
  }
}

/* =========================
   Get Employees
========================= */
export async function getEmployees() {

  const snap = await getDocs(collection(db, EMP_COL));

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

/* =========================
   Update Employee
========================= */
export async function updateEmployee(id, data) {

  try {

    await updateDoc(doc(db, EMP_COL, id), data);

    showToast("تم تحديث بيانات الموظف ✏️", "success");

  } catch (err) {
    console.error(err);
    showToast("خطأ في التحديث", "error");
  }
}

/* =========================
   Delete Employee
========================= */
export async function deleteEmployee(id) {

  try {

    await deleteDoc(doc(db, EMP_COL, id));

    showToast("تم حذف الموظف 🗑️", "warning");

  } catch (err) {
    console.error(err);
    showToast("خطأ في الحذف", "error");
  }
}

/* =========================
   Find Employee (Login helper)
========================= */
export async function findEmployee(employeeId, password) {

  const employees = await getEmployees();

  return employees.find(e =>
    e.employeeId === employeeId &&
    e.password === password
  );
}

/* =========================
   Render Employees UI
========================= */
export async function renderEmployees(containerId) {

  const data = await getEmployees();

  const html = data.map(e => `

    <div class="card">

      <h3>${e.name}</h3>

      <p>الرقم: ${e.employeeId}</p>
      <p>القسم: ${e.department || "-"}</p>
      <p>المسمى: ${e.position || "-"}</p>

      <p>الدور: <b>${e.role}</b></p>

      <p>الراتب: ${e.baseSalary}</p>

      <p>الحالة: ${e.status}</p>

      <div class="flex mt">

        <button class="btn btn-primary" onclick="editEmp('${e.id}')">تعديل</button>

        <button class="btn btn-danger" onclick="delEmp('${e.id}')">حذف</button>

      </div>

    </div>

  `).join("");

  document.getElementById(containerId).innerHTML = html;
}

/* =========================
   Global UI Actions
========================= */

window.delEmp = async function(id){
  await deleteEmployee(id);
  location.reload();
};

window.editEmp = function(id){
  alert("سيتم ربطه مع modal.js في dashboard");
};
