const navIcon=(name)=>({
  dashboard:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z"/></svg>',
  attendance:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M12 7v5l3 2" class="line"/></svg>',
  requests:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 13h8M8 17h6" class="line"/></svg>',
  shifts:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"/><path d="M4 12h3M17 12h3M12 4v3M12 17v3" class="line"/></svg>',
  employees:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-6 2-6 5v1h12v-1c0-3-2-5-6-5Z"/><path d="M17 11a3 3 0 1 0 0-6M16 14c3 .2 5 1.7 5 4v1h-4" class="line"/></svg>',
  departments:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg>',
  salaries:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"/><path d="M7 9h10M8 15h4M16 15h1" class="line"/></svg>',
  reports:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z"/><path d="M8 16V9M12 16v-5M16 16v-8" class="line"/></svg>',
  announcements:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l7 4V6l-7 4H4Z"/><path d="M17 9c1 .8 1.5 1.8 1.5 3S18 14.2 17 15" class="line"/></svg>',
  permissions:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5" class="line"/></svg>',
  settings:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20h-3v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14h-.1v-3H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 9.2 5V4h3v1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v3h-.1a1.7 1.7 0 0 0-1.6 1Z" class="line"/></svg>'
})[name];
window.navigationConfig=[
{id:'dashboard',label:'الرئيسية',path:'./dashboard.html',icon:navIcon('dashboard'),group:'بوابة الموظف',requiredPermissions:['dashboard.view'],showInSidebar:true,showInShortcutMenu:true,order:1},
{id:'my-profile',label:'ملفي الشخصي',path:'./my-profile.html',icon:navIcon('employees'),group:'بوابة الموظف',requiredPermissions:['employees.view.self'],showInSidebar:true,showInShortcutMenu:true,order:2},
{id:'my-requests',label:'طلباتي',path:'./my-requests.html',icon:navIcon('requests'),group:'بوابة الموظف',requiredPermissions:['requests.view.self','requests.create.self'],showInSidebar:true,showInShortcutMenu:true,order:3},
{id:'employee-portal',label:'بوابة الموظف',path:'./employee-portal.html',icon:navIcon('attendance'),group:'بوابة الموظف',requiredPermissions:['attendance.view.self','finance.payroll_slips.view','reports.view.self'],showInSidebar:true,showInShortcutMenu:true,order:4},
{id:'settings',label:'الإعدادات',path:'./settings.html',icon:navIcon('settings'),group:'بوابة الموظف',requiredPermissions:['dashboard.view'],showInSidebar:true,showInShortcutMenu:false,order:5},
{id:'attendance',label:'إدارة الحضور',path:'./attendance.html',icon:navIcon('attendance'),group:'الإدارة والتشغيل',requiredPermissions:['attendance.view.department','attendance.view.all','attendance.manage'],showInSidebar:true,showInShortcutMenu:true,order:10},
{id:'leaves',label:'إدارة الطلبات',path:'./leaves.html',icon:navIcon('requests'),group:'الإدارة والتشغيل',requiredPermissions:['requests.view.department','requests.view.all','requests.manage'],showInSidebar:true,showInShortcutMenu:true,order:11},
{id:'shifts',label:'الشفتات',path:'./shifts.html',icon:navIcon('shifts'),group:'الإدارة والتشغيل',requiredPermissions:['shifts.view'],showInSidebar:true,showInShortcutMenu:false,order:12},
{id:'employees',label:'الموظفون',path:'./employees.html',icon:navIcon('employees'),group:'الموارد البشرية',requiredPermissions:['employees.view.department','employees.view.all','employees.create','employees.update'],showInSidebar:true,showInShortcutMenu:false,order:20},
{id:'departments',label:'الأقسام',path:'./departments.html',icon:navIcon('departments'),group:'الموارد البشرية',requiredPermissions:['departments.view'],showInSidebar:true,showInShortcutMenu:false,order:21},
{id:'salaries',label:'المالية',path:'./salaries.html',icon:navIcon('salaries'),group:'المالية',requiredPermissions:['finance.view','finance.dashboard.view','finance.payroll_slips.view_all','finance.settings.view','finance.advances.view'],showInSidebar:true,showInShortcutMenu:true,order:30},
{id:'reports',label:'التقارير',path:'./reports.html',icon:navIcon('reports'),group:'التقارير',requiredPermissions:['reports.view.department','reports.view.all','reports.salary','reports.attendance'],showInSidebar:true,showInShortcutMenu:true,order:40},
{id:'announcements',label:'الإعلانات',path:'./announcements.html',icon:navIcon('announcements'),group:'النظام',requiredPermissions:['announcements.view.department','announcements.view.all','announcements.create','announcements.manage','announcements.create.general.department','announcements.create.private.employee'],showInSidebar:true,showInShortcutMenu:false,order:45},
{id:'users',label:'الصلاحيات',path:'./users.html',icon:navIcon('permissions'),group:'النظام',requiredPermissions:['users.view','permissions.view'],showInSidebar:true,showInShortcutMenu:false,order:50}
];

window.addEventListener('load',()=>{
  if(!/my-requests\.html(?:$|[?#])/.test(window.location.pathname+window.location.search))return;
  if(document.querySelector('script[data-request-info-helper="true"]'))return;
  const script=document.createElement('script');
  script.src='./js/request-info-response.js?v=req-info-1';
  script.dataset.requestInfoHelper='true';
  document.body.appendChild(script);
});