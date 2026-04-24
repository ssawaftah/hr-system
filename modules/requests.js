import { db } from "../firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { showToast } from "../ui/toast.js";

/* =========================
   Requests Engine (HR Workflow)
   - Leave / Resignation / Advance / Complaints
   - Approval workflow
========================= */

const REQ_COL = "requests";

/* =========================
   Create Request
========================= */
export async function createRequest(data) {

  /*
    data = {
      employeeId,
      type,
      payload,
      createdBy
    }
  */

  try {

    await addDoc(collection(db, REQ_COL), {
      employeeId: data.employeeId,
      type: data.type,
      payload: data.payload || {},
      status: "pending",
      createdBy: data.createdBy,
      approvedBy: null,
      rejectedBy: null,
      reason: "",
      timestamp: new Date().toISOString()
    });

    showToast("تم إرسال الطلب بنجاح 📄", "success");

  } catch (err) {
    console.error(err);
    showToast("خطأ في إرسال الطلب", "error");
  }
}

/* =========================
   Get Requests
========================= */
export async function getRequests(user = null) {

  const q = query(
    collection(db, REQ_COL),
    orderBy("timestamp", "desc")
  );

  const snap = await getDocs(q);

  let data = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  // إذا موظف → يشوف طلباته فقط
  if (user?.role === "employee") {
    data = data.filter(r => r.employeeId === user.employeeId);
  }

  return data;
}

/* =========================
   Approve Request
========================= */
export async function approveRequest(requestId, admin) {

  try {

    await updateDoc(doc(db, REQ_COL, requestId), {
      status: "approved",
      approvedBy: admin.name,
      rejectedBy: null
    });

    showToast("تم قبول الطلب ✅", "success");

  } catch (err) {
    console.error(err);
    showToast("خطأ في الموافقة", "error");
  }
}

/* =========================
   Reject Request
========================= */
export async function rejectRequest(requestId, admin, reason = "") {

  try {

    await updateDoc(doc(db, REQ_COL, requestId), {
      status: "rejected",
      rejectedBy: admin.name,
      reason
    });

    showToast("تم رفض الطلب ❌", "error");

  } catch (err) {
    console.error(err);
    showToast("خطأ في الرفض", "error");
  }
}

/* =========================
   Cancel Request (Employee)
========================= */
export async function cancelRequest(requestId) {

  try {

    await updateDoc(doc(db, REQ_COL, requestId), {
      status: "cancelled"
    });

    showToast("تم إلغاء الطلب", "warning");

  } catch (err) {
    console.error(err);
  }
}

/* =========================
   Render UI
========================= */
export async function renderRequests(containerId, user) {

  const data = await getRequests(user);

  const html = data.map(r => `

    <div class="card">

      <h3>${r.type}</h3>

      <p>الحالة: <b>${r.status}</b></p>

      <p>الموظف: ${r.employeeId}</p>

      <small>${new Date(r.timestamp).toLocaleString()}</small>

      ${r.status === "pending" && user.role !== "employee" ? `
        <div class="flex mt">
          <button class="btn btn-success" onclick="approveReq('${r.id}')">قبول</button>
          <button class="btn btn-danger" onclick="rejectReq('${r.id}')">رفض</button>
        </div>
      ` : ""}

      ${r.status === "pending" && user.role === "employee" ? `
        <button class="btn btn-danger mt" onclick="cancelReq('${r.id}')">إلغاء الطلب</button>
      ` : ""}

    </div>

  `).join("");

  document.getElementById(containerId).innerHTML = html;
}

/* =========================
   Global Actions
========================= */

window.approveReq = async function(id){
  const user = JSON.parse(sessionStorage.getItem("user"));
  await approveRequest(id, user);
  location.reload();
};

window.rejectReq = async function(id){
  const user = JSON.parse(sessionStorage.getItem("user"));
  const reason = prompt("سبب الرفض؟");
  await rejectRequest(id, user, reason);
  location.reload();
};

window.cancelReq = async function(id){
  await cancelRequest(id);
  location.reload();
};
