const salarySummaryBody=document.getElementById('salarySummaryBody');
const salaryReportSection=document.getElementById('salaryReportSection');
const exportSalarySummaryBtn=document.getElementById('exportSalarySummary');
const employeeFilter=document.getElementById('reportEmployeeFilter');
const mainDepartmentFilter=document.getElementById('reportMainDepartmentFilter');
const subDepartmentFilter=document.getElementById('reportSubDepartmentFilter');
const monthFilter=document.getElementById('reportMonthFilter');
const statusFilter=document.getElementById('reportStatusFilter');
const absenceReasonFilter=document.getElementById('reportAbsenceReasonFilter');
const applyBtn=document.getElementById('applyAttendanceReportFilters');
const exportAttendanceBtn=document.getElementById('exportAttendanceDetailed');
const monthlyBody=document.getElementById('attendanceMonthlyBody');
const recordsBody=document.getElementById('attendanceRecordsBody');
const monthlyCount=document.getElementById('monthlyReportCount');
const recordsCount=document.getElementById('recordsReportCount');
const totalCard=document.getElementById('reportTotalRecords');
const presentCard=document.getElementById('reportPresentDays');
const excusedAbsentCard=document.getElementById('reportExcusedAbsentDays');
const unexcusedAbsentCard=document.getElementById('reportUnexcusedAbsentDays');

let currentUserRoles=[];
let salarySummary=[];
let employees=[];
let reportData={totals:{},monthly_by_employee:[],records:[]};
const hasRole=(role)=>currentUserRoles.includes(role);
const statusLabels={present:'حاضر',absent:'غائب',late:'متأخر',leave:'إجازة',early_leave:'خروج مبكر',excused_absence:'غياب بعذر',unexcused_absence:'غياب بدون عذر'};
const sourceLabels={system:'النظام',fingerprint:'البصمة',manual:'إدخال يدوي'};
const leaveTypeLabels={annual:'إجازة سنوية',sick:'إجازة مرضية',unpaid:'إجازة بدون راتب',emergency:'إجازة طارئة',other:'إجازة أخرى'};

const initReports=async()=>{
  const user=await loadLoggedUser();
  if(!user||user.role==='employee'){window.location.href='./dashboard.html';return;}
  currentUserRoles=Array.isArray(user.roles)?user.roles:[user.role];
  setDefaultMonth();
  await loadEmployees();
  await loadAttendanceDetailedReport();
  if(hasRole('admin')) await loadSalarySummary();
  else if(salaryReportSection) salaryReportSection.style.display='none';
};

const setDefaultMonth=()=>{
  if(!monthFilter.value){
    const now=new Date();
    monthFilter.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }
};

const formatDate=(date)=>date?String(date).split('T')[0]:'-';

const loadEmployees=async()=>{
  const response=await fetch(`${API_BASE_URL}/employees`,{headers:{Authorization:`Bearer ${token}`}});
  const data=await response.json();
  if(!response.ok)return;
  employees=data.employees||[];
  renderEmployeeAndDepartmentFilters();
};

const renderEmployeeAndDepartmentFilters=()=>{
  employeeFilter.innerHTML='<option value="">كل الموظفين</option>';
  employees.forEach((employee)=>{
    employeeFilter.innerHTML+=`<option value="${employee.id}">${employee.full_name}</option>`;
  });
  const main=new Map();
  const sub=new Map();
  employees.forEach((employee)=>{
    if(employee.primary_department) main.set(String(employee.primary_department.department_id),employee.primary_department.department_name);
    else if(employee.department_id&&employee.department_name) main.set(String(employee.department_id),employee.department_name);
    (employee.additional_departments||[]).forEach((d)=>sub.set(String(d.department_id),d.department_name));
  });
  mainDepartmentFilter.innerHTML='<option value="">كل الأقسام الرئيسية</option>'+Array.from(main).map(([id,name])=>`<option value="${id}">${name}</option>`).join('');
  subDepartmentFilter.innerHTML='<option value="">كل الأقسام الفرعية</option>'+Array.from(sub).map(([id,name])=>`<option value="${id}">${name}</option>`).join('');
};

const buildReportUrl=()=>{
  const params=new URLSearchParams();
  if(employeeFilter.value)params.set('employee_id',employeeFilter.value);
  if(mainDepartmentFilter.value)params.set('department_id',mainDepartmentFilter.value);
  if(subDepartmentFilter.value)params.set('sub_department_id',subDepartmentFilter.value);
  if(monthFilter.value)params.set('month',monthFilter.value);
  if(statusFilter.value)params.set('status',statusFilter.value);
  if(absenceReasonFilter?.value)params.set('absence_reason',absenceReasonFilter.value);
  return `${API_BASE_URL}/reports/attendance-detailed?${params.toString()}`;
};

const loadAttendanceDetailedReport=async()=>{
  monthlyCount.textContent='جاري تحميل التقرير...';
  recordsCount.textContent='جاري تحميل السجلات...';
  const response=await fetch(buildReportUrl(),{headers:{Authorization:`Bearer ${token}`}});
  const data=await response.json();
  if(!response.ok){
    monthlyBody.innerHTML='<tr><td colspan="12">تعذر تحميل تقرير الحضور</td></tr>';
    recordsBody.innerHTML='<tr><td colspan="10">تعذر تحميل السجلات</td></tr>';
    return;
  }
  reportData=data;
  renderTotals(data.totals||{});
  renderMonthly(data.monthly_by_employee||[]);
  renderRecords(data.records||[]);
};

const renderTotals=(totals)=>{
  totalCard.textContent=totals.total_records||0;
  presentCard.textContent=totals.present||0;
  excusedAbsentCard.textContent=totals.excused_absent||0;
  unexcusedAbsentCard.textContent=totals.unexcused_absent||0;
};

const absenceReasonText=(row)=>{
  if(row.status!=='absent')return '-';
  if(row.approved_leave_id){
    const type=leaveTypeLabels[row.approved_leave_type]||'إجازة معتمدة';
    const reason=row.approved_leave_reason?` - ${row.approved_leave_reason}`:'';
    return `غياب بعذر - ${type}${reason}`;
  }
  return 'غياب بدون طلب إجازة معتمد';
};

const renderMonthly=(rows)=>{
  monthlyCount.textContent=`عرض ${rows.length} موظف في التقرير`;
  if(!rows.length){monthlyBody.innerHTML='<tr><td colspan="12">لا توجد بيانات شهرية مطابقة</td></tr>';return;}
  monthlyBody.innerHTML='';
  rows.forEach((row)=>{
    monthlyBody.innerHTML+=`
      <tr>
        <td>${row.employee_name}</td>
        <td>${row.primary_department_name||'-'}</td>
        <td>${row.sub_department_name||'-'}</td>
        <td>${row.total_records||0}</td>
        <td>${row.present_days||0}</td>
        <td>${row.absent_days||0}</td>
        <td>${row.excused_absent_days||0}</td>
        <td>${row.unexcused_absent_days||0}</td>
        <td>${row.late_days||0}</td>
        <td>${row.early_leave_days||0}</td>
        <td>${row.leave_days||0}</td>
        <td><a class="secondary-btn small-btn" href="./employee-profile.html?id=${row.employee_id}">عرض الملف</a></td>
      </tr>`;
  });
};

const renderRecords=(rows)=>{
  recordsCount.textContent=`عرض ${rows.length} سجل تفصيلي`;
  if(!rows.length){recordsBody.innerHTML='<tr><td colspan="10">لا توجد سجلات مطابقة</td></tr>';return;}
  recordsBody.innerHTML='';
  rows.forEach((row)=>{
    recordsBody.innerHTML+=`
      <tr>
        <td>${row.id}</td>
        <td>${row.employee_name}</td>
        <td>${row.primary_department_name||'-'}</td>
        <td>${row.sub_department_name||'-'}</td>
        <td>${formatDate(row.attendance_date)}</td>
        <td>${row.check_in||'-'}</td>
        <td>${row.check_out||'-'}</td>
        <td>${statusLabels[row.effective_status]||statusLabels[row.status]||row.status||'-'}</td>
        <td>${absenceReasonText(row)}</td>
        <td>${sourceLabels[row.source]||row.source||'النظام'}</td>
      </tr>`;
  });
};

const loadSalarySummary=async()=>{
  const response=await fetch(`${API_BASE_URL}/reports/salary-summary`,{headers:{Authorization:`Bearer ${token}`}});
  const data=await response.json();
  if(!response.ok){if(salaryReportSection)salaryReportSection.style.display='none';return;}
  salarySummary=data.summary||[];
  salarySummaryBody.innerHTML='';
  if(!salarySummary.length){salarySummaryBody.innerHTML='<tr><td colspan="3">لا توجد بيانات رواتب</td></tr>';return;}
  salarySummary.forEach((row)=>{
    salarySummaryBody.innerHTML+=`<tr><td>${row.salary_month}</td><td>${row.records_count}</td><td>${row.total_net_salary||0}</td></tr>`;
  });
};

const escapeCsvValue=(value)=>`"${String(value??'').replace(/"/g,'""')}"`;
const exportCSV=(filename,rows)=>{
  const csv=rows.map((row)=>row.map(escapeCsvValue).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=filename;
  link.click();
  URL.revokeObjectURL(url);
};

exportAttendanceBtn?.addEventListener('click',()=>{
  const monthlyRows=[['الموظف','القسم الرئيسي','القسم الفرعي','إجمالي السجلات','حضور','غياب','غياب بعذر','غياب بدون عذر','تأخير','خروج مبكر','إجازة'],...(reportData.monthly_by_employee||[]).map((r)=>[r.employee_name,r.primary_department_name||'',r.sub_department_name||'',r.total_records||0,r.present_days||0,r.absent_days||0,r.excused_absent_days||0,r.unexcused_absent_days||0,r.late_days||0,r.early_leave_days||0,r.leave_days||0])];
  exportCSV('attendance-report.csv',monthlyRows);
});

exportSalarySummaryBtn?.addEventListener('click',()=>{
  if(!hasRole('admin'))return;
  exportCSV('salary-summary.csv',[['salary_month','records_count','total_net_salary'],...salarySummary.map((row)=>[row.salary_month,row.records_count,row.total_net_salary||0])]);
});

applyBtn.addEventListener('click',loadAttendanceDetailedReport);
[employeeFilter,mainDepartmentFilter,subDepartmentFilter,monthFilter,statusFilter,absenceReasonFilter].filter(Boolean).forEach((el)=>el.addEventListener('change',loadAttendanceDetailedReport));

initReports();
