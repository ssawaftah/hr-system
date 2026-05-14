const typeLabel=(t)=>t==='general'?'إعلان عام':'إعلان خاص';
const fmtDate=(x)=>x?String(x).slice(0,10):'غير محدد';
const setText=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value??0};

const renderDashboardAnnouncements=(items=[])=>{
  const box=document.getElementById('dashboardAnnouncements');
  if(!box)return;
  if(!items.length){box.innerHTML='<div class="empty-soft">لا توجد إعلانات حالياً</div>';return}
  box.innerHTML=items.slice(0,4).map(a=>`<article class="announcement-card ${a.type==='general'?'general':'private'}"><div class="announcement-card-head"><span class="announcement-badge ${a.type==='general'?'general':'private'}">${typeLabel(a.type)}</span></div><h3>${a.title}</h3><p>${a.content}</p><div class="announcement-meta"><span>تاريخ النشر: ${fmtDate(a.published_at||a.created_at)}</span>${a.end_date?`<span>تاريخ الانتهاء: ${fmtDate(a.end_date)}</span>`:''}</div><footer><strong>نشر بواسطة: ${a.publisher_name||'-'}</strong><small>${a.publisher_job_title||'-'}</small></footer></article>`).join('')
};

const renderTodayReport=(today={},user=null)=>{
  setText('todayPresentCount',today.present||0);
  setText('todayAbsentCount',today.absent||0);
  setText('todayLateCount',today.late||0);
  setText('todayPendingRequestsCount',today.pendingRequests||0);
  const title=document.getElementById('todayReportTitle');
  const subtitle=document.getElementById('todayReportSubtitle');
  if(title)title.textContent='ملخص اليوم';
  if(subtitle){
    const name=user?.full_name?`مرحبًا ${user.full_name}، `:'';
    subtitle.textContent=`${name}تقرير اليوم محدث حسب بيانات النظام${today.date?` - ${today.date}`:''}.`;
  }
};

const initDashboard = async () => {
  const user = await loadLoggedUser();
  if (!user) return;
  try {
    const [statsResponse,announcementsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_BASE_URL}/announcements/visible`, { headers: { Authorization: `Bearer ${token}` } }).catch(()=>null)
    ]);
    const data = await statsResponse.json().catch(()=>({}));
    if (statsResponse.ok) renderTodayReport(data.today||{},user);
    else renderTodayReport({},user);
    if(announcementsResponse&&announcementsResponse.ok){
      const a=await announcementsResponse.json();
      renderDashboardAnnouncements(a.announcements||[]);
    }else renderDashboardAnnouncements([]);
  } catch (error) {
    console.log(error);
    renderTodayReport({},user);
    renderDashboardAnnouncements([]);
  }
};

initDashboard();
