export function openModal(contentHTML) {
  // إذا في مودال قديم احذفه
  closeModal();

  // الخلفية
  const overlay = document.createElement("div");
  overlay.id = "modal-overlay";

  Object.assign(overlay.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10000
  });

  // صندوق المودال
  const modal = document.createElement("div");
  modal.id = "modal-box";

  Object.assign(modal.style, {
    background: "#fff",
    width: "420px",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
    animation: "fadeIn 0.2s ease"
  });

  modal.innerHTML = contentHTML;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // إغلاق عند الضغط خارج الصندوق
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });
}

export function closeModal() {
  const old = document.getElementById("modal-overlay");
  if (old) old.remove();
}
