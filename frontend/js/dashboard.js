const typeLabel=(t)=>t==='general'?'إعلان عام':'إعلان خاص';
const fmtDate=(x)=>x?String(x).slice(0,10):'غير محدد';
const setText=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value??0};

const todayInJordan=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Amman',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const rowDate=(row)=>String(row.attendance_date||row.date||row.created_at||'').slice(0,10);
const rowStatus=(row)=>String(row.status||'').toLowerCase();
const employeeKey=(row)=>String(row.employee_id||row.employee_number||row.id||Math.random());

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

const computeTodayFromAttendance=(rows=[])=>{
  const today=todayInJordan();
  const present=new Set();
  const late=new Set();
  const absent=new Set();
  rows.filter(row=>rowDate(row)===today).forEach(row=>{
    const key=employeeKey(row);
    const status=rowStatus(row);
    const hasCheckIn=Boolean(row.check_in||row.checkIn||row.time_in);
    if(status==='absent'||status==='غائب') absent.add(key);
    if(status==='late'||status==='متأخر'||status==='متاخر') late.add(key);
    if(hasCheckIn||['present','late','early_leave','حاضر','متأخر','متاخر'].includes(status)) present.add(key);
  });
  return {date:today,present:present.size,absent:absent.size,late:late.size};
};

const loadAttendanceTodayFallback=async()=>{
  try{
    const r=await fetch(`${API_BASE_URL}/attendance?auto=1&_=${Date.now()}`,{headers:{Authorization:`Bearer ${token}`}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'attendance failed');
    return computeTodayFromAttendance(d.attendance||d.records||[]);
  }catch(error){
    console.warn('Dashboard attendance fallback failed:',error.message);
    return null;
  }
};

const loadPendingRequestsFallback=async()=>{
  try{
    const r=await fetch(`${API_BASE_URL}/leaves?_=${Date.now()}`,{headers:{Authorization:`Bearer ${token}`}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'requests failed');
    return (d.requests||[]).filter(x=>['pending','needs_info'].includes(String(x.status||''))).length;
  }catch(error){
    console.warn('Dashboard requests fallback failed:',error.message);
    return 0;
  }
};

const initDashboard = async () => {
  const user = await loadLoggedUser();
  if (!user) return;
  try {
    const [statsResponse,announcementsResponse,attendanceToday,pendingRequests] = await Promise.all([
      fetch(`${API_BASE_URL}/dashboard/stats?_=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` } }).catch(()=>null),
      fetch(`${API_BASE_URL}/announcements/visible?_=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` } }).catch(()=>null),
      loadAttendanceTodayFallback(),
      loadPendingRequestsFallback()
    ]);
    const data = statsResponse ? await statsResponse.json().catch(()=>({})) : {};
    const backendToday = statsResponse&&statsResponse.ok ? (data.today||{}) : {};
    const today = {
      date: attendanceToday?.date || backendToday.date || todayInJordan(),
      present: attendanceToday ? attendanceToday.present : (backendToday.present||0),
      absent: attendanceToday ? attendanceToday.absent : (backendToday.absent||0),
      late: attendanceToday ? attendanceToday.late : (backendToday.late||0),
      pendingRequests: pendingRequests || backendToday.pendingRequests || 0,
    };
    renderTodayReport(today,user);
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
