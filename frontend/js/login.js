const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const employeeInput = document.getElementById("employee_number") || document.getElementById("email");
  const employee_number = employeeInput.value.trim();
  const password = document.getElementById("password").value;

  try {
    const response = await fetch("https://hr-system-backend-dxj2.onrender.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_number, email: employee_number, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      message.style.color = "#dc2626";
      message.textContent = data.error || "تعذر تسجيل الدخول";
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    message.style.color = "#0f766e";
    message.textContent = "تم تسجيل الدخول بنجاح";
    window.location.href = "./dashboard.html";
  } catch (error) {
    console.log(error);
    message.style.color = "#dc2626";
    message.textContent = "حدث خطأ أثناء الاتصال بالخادم";
  }
});
