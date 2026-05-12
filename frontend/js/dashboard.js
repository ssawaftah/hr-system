const initDashboard = async () => {
  const user = await loadLoggedUser();

  if (!user) return;

  document.getElementById("welcomeMessage").textContent =
    `مرحبًا ${user.full_name} - ${user.role}`;

  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();

    if (!response.ok) return;

    document.getElementById("usersCount").textContent = data.stats.users;
    document.getElementById("departmentsCount").textContent = data.stats.departments;
    document.getElementById("employeesCount").textContent = data.stats.employees;
    document.getElementById("attendanceCount").textContent = data.stats.attendance;
    document.getElementById("salariesCount").textContent = data.stats.salaries;
    document.getElementById("leavesCount").textContent = data.stats.leaves;
  } catch (error) {
    console.log(error);
  }
};

initDashboard();
