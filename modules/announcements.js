import { db } from "../firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { showToast } from "../ui/toast.js";

/* =========================
   Announcements Module
   - Company-wide communication system
   - Public / Private announcements
========================= */

const ANN_COL = "announcements";

/* =========================
   Create Announcement
========================= */
export async function createAnnouncement(data) {

  /*
    data = {
      title,
      content,
      type: "public" | "private",
      targetUserId (optional),
      createdBy
    }
  */

  try {

    await addDoc(collection(db, ANN_COL), {
      title: data.title,
      content: data.content,
      type: data.type || "public",
      targetUserId: data.targetUserId || null,
      createdBy: data.createdBy,
      readBy: [],
      timestamp: new Date().toISOString()
    });

    showToast("تم نشر الإعلان بنجاح 📢", "success");

  } catch (err) {
    console.error(err);
    showToast("خطأ في نشر الإعلان", "error");
  }
}

/* =========================
   Get Announcements (for user)
========================= */
export async function getAnnouncements(userId) {

  const q = query(
    collection(db, ANN_COL),
    orderBy("timestamp", "desc")
  );

  const snap = await getDocs(q);

  const data = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  // فلترة حسب المستخدم
  return data.filter(a => {
    return (
      a.type === "public" ||
      a.targetUserId === userId
    );
  });
}

/* =========================
   Mark as Read
========================= */
export async function markAnnouncementRead(announcement, userId) {

  try {

    const ref = doc(db, ANN_COL, announcement.id);

    const updatedReadBy = announcement.readBy || [];

    if (!updatedReadBy.includes(userId)) {
      updatedReadBy.push(userId);
    }

    await updateDoc(ref, {
      readBy: updatedReadBy
    });

  } catch (err) {
    console.error(err);
  }
}

/* =========================
   Render UI
========================= */
export async function renderAnnouncements(containerId, userId) {

  const data = await getAnnouncements(userId);

  const html = data.map(a => {

    const isRead = (a.readBy || []).includes(userId);

    return `
      <div class="card" style="border-right:4px solid ${a.type === "public" ? "#0071e3" : "#ff3b30"}; opacity:${isRead ? 0.6 : 1}">
        
        <h3>${a.title}</h3>
        <p>${a.content}</p>

        <small>
          ${new Date(a.timestamp).toLocaleString()}
        </small>

        ${!isRead ? `<button onclick="readAnn('${a.id}')">تم القراءة</button>` : ""}
      </div>
    `;
  }).join("");

  document.getElementById(containerId).innerHTML = html;
}

/* =========================
   Global helper
========================= */
window.readAnn = async function(id){

  const snap = await getDocs(collection(db, ANN_COL));
  const ann = snap.docs.find(d => d.id === id);

  if (!ann) return;

  await markAnnouncementRead({ id, ...ann.data() }, JSON.parse(sessionStorage.getItem("user")).employeeId);

  showToast("تم قراءة الإعلان", "success");

  location.reload();
};
