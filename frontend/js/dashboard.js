const typeLabel=(t)=>t==='general'?'إعلان عام':'إعلان خاص';
const fmtDate=(x)=>x?String(x).slice(0,10):'غير محدد';
const renderDashboardAnnouncements=(items=[])=>{
  const box=document.getElementById('dashboardAnnouncements');
  if(!box)return;
  if(!items.length){box.innerHTML='<div class="empty-soft">لا توجد إعلانات حالياً</div>';return}
  box.innerHTML=items.slice(0,4).map(a=>`<article class="announcement-card ${a.type==='general'?'general':'private'}"><div class="announcement-card-head"><span class="announcement-badge ${a.type==='general'?'general':'private'}">${typeLabel(a.type)}</span></div><h3>${a.title}</h3><p>${a.content}</p><div class="announcement-meta"><span>تاريخ النشر: ${fmtDate(a.published_at||a.created_at)}</span>${a.end_date?`<span>تاريخ الانتهاء: ${fmtDate(a.end_date)}</span>`:''}</div><footer><strong>نشر بواسطة: ${a.publisher_name||'-'}</strong><small>${a.publisher_job_title||'-'}</small></footer></article>`).join('')
};
const initDashboard = async () => {
  const user = await loadLoggedUser();

  if (!user) return;

  const roleText=Array.isArray(user.roles)?user.roles.join('، '):(user.role||'');
  document.getElementById("welcomeMessage").textContent = `مرحبًا ${user.full_name} - ${roleText}`;

  try {
    const [statsResponse,announcementsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_BASE_URL}/announcements/visible`, { headers: { Authorization: `Bearer ${token}` } }).catch(()=>null)
    ]);

    const data = await statsResponse.json();

    if (statsResponse.ok) {
      document.getElementById("usersCount").textContent = data.stats.users;
      document.getElementById("departmentsCount").textContent = data.stats.departments;
      document.getElementById("employeesCount").textContent = data.stats.employees;
      document.getElementById("attendanceCount").textContent = data.stats.attendance;
      document.getElementById("salariesCount").textContent = data.stats.salaries;
      document.getElementById("leavesCount").textContent = data.stats.leaves;
    }
    if(announcementsResponse&&announcementsResponse.ok){
      const a=await announcementsResponse.json();
      renderDashboardAnnouncements(a.announcements||[]);
    }else{
      renderDashboardAnnouncements([]);
    }
  } catch (error) {
    console.log(error);
    renderDashboardAnnouncements([]);
  }
};

initDashboard();
