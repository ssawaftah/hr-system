const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const loginButton = document.getElementById("loginButton");

function setMessage(text, type) {
  message.textContent = text;
  message.className = `login-message ${type ? `is-${type}` : ""}`;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const employeeInput = document.getElementById("employee_number") || document.getElementById("email");
  const employee_number = employeeInput.value.trim();
  const password = document.getElementById("password").value;

  try {
    if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = "جاري الدخول...";
    }
    setMessage("", "");

    const response = await fetch("https://hr-system-backend-dxj2.onrender.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_number, email: employee_number, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "تعذر تسجيل الدخول. تحقق من رقم الموظف وكلمة المرور.", "error");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    setMessage("تم تسجيل الدخول بنجاح. يتم تحويلك الآن...", "success");
    window.location.href = "./dashboard.html";
  } catch (error) {
    console.log(error);
    setMessage("حدث خطأ أثناء الاتصال بالخادم. حاول مرة أخرى بعد قليل.", "error");
  } finally {
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = "دخول إلى النظام";
    }
  }
});
