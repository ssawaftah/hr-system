const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const response = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      message.style.color = "red";
      message.textContent = data.error;
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    message.style.color = "green";
    message.textContent = "تم تسجيل الدخول بنجاح";

    window.location.href = "./dashboard.html";
  } catch (error) {
    console.log(error);
    message.style.color = "red";
    message.textContent = "حدث خطأ في الاتصال بالسيرفر";
  }
});
