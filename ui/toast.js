export function showToast(message, type = "success", duration = 3000) {
  /*
    type:
    - success (أخضر)
    - error (أحمر)
    - warning (برتقالي)
    - info (أزرق)
  */

  // تأكد أن الكونتينر موجود
  let container = document.getElementById("toast-container");

  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";

    Object.assign(container.style, {
      position: "fixed",
      top: "20px",
      left: "20px",
      zIndex: "9999",
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    });

    document.body.appendChild(container);
  }

  const toast = document.createElement("div");

  toast.innerText = message;

  const colors = {
    success: "#34c759",
    error: "#ff3b30",
    warning: "#ff9500",
    info: "#0071e3"
  };

  Object.assign(toast.style, {
    background: colors[type] || "#0071e3",
    color: "white",
    padding: "10px 14px",
    borderRadius: "10px",
    boxShadow: "0 10px 20px rgba(0,0,0,0.15)",
    fontSize: "14px",
    opacity: "0",
    transform: "translateY(-10px)",
    transition: "all 0.3s ease",
    minWidth: "200px"
  });

  container.appendChild(toast);

  // animation in
  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 10);

  // remove
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";

    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}
