# HR System V2 Full

نسخة شاملة عملية من نظام الموارد البشرية.

## المزايا

- تسجيل الدخول JWT
- صلاحيات Admin / HR / Employee
- Dashboard بإحصائيات
- المستخدمون
- الأقسام
- الموظفون
- ملف موظف تفصيلي
- الحضور
- الرواتب
- الإجازات
- تقارير بسيطة
- تصدير CSV للموظفين والتقارير
- Setup/Migration قوي لقاعدة البيانات القديمة

## التشغيل

1. تأكد أن PostgreSQL يعمل وأن قاعدة البيانات اسمها:

```text
hr_system
```

2. افتح Terminal داخل مجلد backend:

```bash
cd backend
npm install
node server.js
```

3. افتح هذا الرابط مرة واحدة:

```text
http://localhost:5000/api/auth/setup
```

4. افتح هذا الرابط لإنشاء/تثبيت حساب المدير:

```text
http://localhost:5000/api/auth/create-admin
```

5. افتح الواجهة:

```text
frontend/login.html
```

بيانات الدخول:

```text
admin@test.com
123456
```

## الجداول

- users
- departments
- employees
- attendance_records
- salary_records
- leave_requests

## ملاحظة مهمة

هذه نسخة MVP+ شاملة للتجربة والبناء، وليست Production نهائية لشركة حقيقية.
قبل الاستخدام التجاري تحتاج:
- نسخ احتياطي
- تحسين أمان
- إعداد استضافة
- إدارة جلسات أقوى
- اختبار شامل
