import { db } from "../firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { showToast } from "../ui/toast.js";
import { logAction } from "./audit.js";
import { loadUser } from "../core/state.js";

const USERS = "users";

/* =========================
   ADD EMPLOYEE (FIXED)
========================= */

export async function addEmployee(data) {

  try {

    const user = loadUser();

    if (!user || user.role !== "admin") {
      showToast("غير مصرح لك بإضافة موظف ❌", "error");
      return;
    }

    // Validation
    if (!data.employeeId || !data.password || !data.name) {
      showToast("الرجاء تعبئة الحقول المطلوبة", "warning");
      return;
    }

    // Check duplicate employeeId
    const snap = await getDocs(collection(db, USERS));

    const exists = snap.docs.find(d => d.data().employeeId === data.employeeId);

    if (exists) {
      showToast("رقم الموظف موجود مسبقاً ❌", "error");
      return;
    }

    // Create employee
    const ref = await addDoc(collection(db, USERS), {
      ...data,
      createdAt: new Date().toISOString()
    });

    logAction(user, "CREATE_EMPLOYEE", `Added ${data.name}`);

    showToast("تم إضافة الموظف بنجاح ✅", "success");

    return ref.id;

  } catch (err) {
    console.error(err);
    showToast("خطأ أثناء إضافة الموظف", "error");
  }
}

/* =========================
   GET EMPLOYEES
========================= */

export async function getEmployees() {
  const snap = await getDocs(collection(db, USERS));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* =========================
   DELETE EMPLOYEE
========================= */

export async function deleteEmployee(id) {

  try {

    const user = loadUser();

    if (!user || user.role !== "admin") {
      showToast("غير مصرح لك بالحذف ❌", "error");
      return;
    }

    await deleteDoc(doc(db, USERS, id));

    logAction(user, "DELETE_EMPLOYEE", id);

    showToast("تم حذف الموظف", "success");

  } catch (err) {
    console.error(err);
    showToast("خطأ في الحذف", "error");
  }
}

/* =========================
   UPDATE EMPLOYEE
========================= */

export async function updateEmployee(id, data) {

  try {

    const user = loadUser();

    if (!user || user.role !== "admin") {
      showToast("غير مصرح لك بالتعديل ❌", "error");
      return;
    }

    await updateDoc(doc(db, USERS, id), data);

    logAction(user, "UPDATE_EMPLOYEE", id);

    showToast("تم تحديث البيانات", "success");

  } catch (err) {
    console.error(err);
    showToast("خطأ في التحديث", "error");
  }
}
