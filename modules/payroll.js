import { db } from "../firebase-config.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { showToast } from "../ui/toast.js";

/*
  Payroll Module - HR SaaS Core
  - حساب الرواتب
  - إنشاء قسيمة راتب
  - عرض الرواتب
*/

const USERS_COL = "users";
const PAYROLL_COL = "payroll";
const REQUESTS_COL = "requests";

/* =========================
   Get Employees
========================= */
async function getEmployees() {
  const snap = await getDocs(collection(db, USERS_COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* =========================
   Get Requests (for deductions / extras)
========================= */
async function getRequests(employeeId) {
  const q = query(
    collection(db, REQUESTS_COL),
    where("employeeId", "==", employeeId),
    where("status", "==", "approved")
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

/* =========================
   Salary Calculator (Core Logic)
========================= */
function calculateSalary(employee, requests = []) {

  const baseSalary = employee.baseSalary || 300; // default

  let additions = 0;
  let deductions = 0;

  requests.forEach(r => {

    // إضافات
    if (r.type === "overtime") additions += r.amount || 0;
    if (r.type === "bonus") additions += r.amount || 0;

    // خصومات
    if (r.type === "leave_unpaid") deductions += r.amount || 0;
    if (r.type === "advance") deductions += r.amount || 0;

  });

  const net = baseSalary + additions - deductions;

  return {
    baseSalary,
    additions,
    deductions,
    net
  };
}

/* =========================
   Generate Payroll for All Employees
========================= */
export async function generatePayroll(month) {

  try {

    const employees = await getEmployees();

    for (const emp of employees) {

      const requests = await getRequests(emp.employeeId);

      const salary = calculateSalary(emp, requests);

      await addDoc(collection(db, PAYROLL_COL), {
        employeeId: emp.employeeId,
        name: emp.name,
        month,
        baseSalary: salary.baseSalary,
        additions: salary.additions,
        deductions: salary.deductions,
        netSalary: salary.net,
        createdAt: new Date().toISOString()
      });

    }

    showToast("تم إنشاء الرواتب بنجاح 💰", "success");

  } catch (err) {
    console.error(err);
    showToast("خطأ في إنشاء الرواتب", "error");
  }
}

/* =========================
   Get Payroll Records
========================= */
export async function getPayroll(employeeId = null) {

  let q = collection(db, PAYROLL_COL);

  const snap = await getDocs(q);

  let data = snap.docs.map(d => d.data());

  if (employeeId) {
    data = data.filter(p => p.employeeId === employeeId);
  }

  return data;
}

/* =========================
   UI Renderer
========================= */
export async function renderPayrollUI(containerId) {

  const data = await getPayroll();

  const html = data.map(p => `
    <div class="card">
      <h4>${p.name}</h4>
      <p>الشهر: ${p.month}</p>
      <p>الراتب الأساسي: ${p.baseSalary}</p>
      <p>الإضافات: ${p.additions}</p>
      <p>الخصومات: ${p.deductions}</p>
      <b>الصافي: ${p.netSalary}</b>
    </div>
  `).join("");

  document.getElementById(containerId).innerHTML = html;
}
