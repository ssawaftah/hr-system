import { db } from "../firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { showToast } from "../ui/toast.js";

/* =========================
   Attendance Module
   - Check In / Check Out
   - Work hours calculation
   - Late / absence tracking
========================= */

const ATTENDANCE_COL = "attendance";

/* =========================
   Check In
========================= */
export async function checkIn(employeeId) {

  try {

    const today = new Date().toISOString().split("T")[0];

    // تحقق إذا موجود سجل اليوم
    const q = query(
      collection(db, ATTENDANCE_COL),
      where("employeeId", "==", employeeId),
      where("date", "==", today)
    );

    const snap = await getDocs(q);

    if (!snap.empty) {
      showToast("تم تسجيل الحضور مسبقاً", "warning");
      return;
    }

    await addDoc(collection(db, ATTENDANCE_COL), {
      employeeId,
      date: today,
      checkIn: new Date().toISOString(),
      checkOut: null,
      status: "present"
    });

    showToast("تم تسجيل الحضور ✅", "success");

  } catch (err) {
    console.error(err);
    showToast("خطأ في تسجيل الحضور", "error");
  }
}

/* =========================
   Check Out
========================= */
export async function checkOut(employeeId) {

  try {

    const today = new Date().toISOString().split("T")[0];

    const q = query(
      collection(db, ATTENDANCE_COL),
      where("employeeId", "==", employeeId),
      where("date", "==", today)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      showToast("لا يوجد تسجيل حضور اليوم", "error");
      return;
    }

    const docRef = snap.docs[0].ref;

    await updateDoc(docRef, {
      checkOut: new Date().toISOString()
    });

    showToast("تم تسجيل الانصراف 👋", "success");

  } catch (err) {
    console.error(err);
    showToast("خطأ في تسجيل الانصراف", "error");
  }
}

/* =========================
   Calculate Work Hours
========================= */
function calculateHours(checkIn, checkOut) {

  if (!checkIn || !checkOut) return 0;

  const inTime = new Date(checkIn);
  const outTime = new Date(checkOut);

  const diff = (outTime - inTime) / (1000 * 60 * 60);

  return Math.max(0, diff.toFixed(2));
}

/* =========================
   Get Attendance Records
========================= */
export async function getAttendance(employeeId = null) {

  const snap = await getDocs(collection(db, ATTENDANCE_COL));

  let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (employeeId) {
    data = data.filter(a => a.employeeId === employeeId);
  }

  return data;
}

/* =========================
   Attendance Report (UI)
========================= */
export async function renderAttendance(containerId) {

  const data = await getAttendance();

  const html = data.map(a => {

    const hours = calculateHours(a.checkIn, a.checkOut);

    return `
      <div class="card">
        <p>الموظف: ${a.employeeId}</p>
        <p>التاريخ: ${a.date}</p>
        <p>الحضور: ${a.checkIn ? "✔" : "—"}</p>
        <p>الانصراف: ${a.checkOut ? "✔" : "—"}</p>
        <p>ساعات العمل: ${hours}</p>
        <p>الحالة: ${a.status}</p>
      </div>
    `;
  }).join("");

  document.getElementById(containerId).innerHTML = html;
}
