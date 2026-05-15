(() => {
  const latestInfoRequest = (logs = []) => {
    return [...logs]
      .reverse()
      .find((log) => log.action === "request_info" || log.new_status === "needs_info");
  };

  const valueOf = (...values) => {
    for (const value of values) {
      if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
    }
    return "-";
  };

  const box = (label, value) => {
    if (typeof detailBox === "function") return detailBox(label, valueOf(value));
    return `<div class="detail-box-local"><span>${label}</span><strong>${valueOf(value)}</strong></div>`;
  };

  const formatLogDate = (value) => {
    if (!value) return "-";
    try { return new Date(value).toLocaleString("ar-JO", { hour12: false }); } catch (_) { return String(value); }
  };

  const isPending = (request) => {
    const value = typeof requestStatus === "function" ? requestStatus(request) : request?.status;
    return value === "pending";
  };

  const isNeedsInfo = (request) => {
    const value = typeof requestStatus === "function" ? requestStatus(request) : request?.status;
    return value === "needs_info";
  };

  const removeLocalRequest = (id) => {
    try {
      const keys = ["hr_employee_requests_local_echo_v1", "hr_employee_requests_local_echo_v2", "hr_employee_requests_local_echo_v3"];
      for (const key of keys) {
        const rows = JSON.parse(localStorage.getItem(key) || "[]");
        const filtered = rows.filter((row) => String(row.id || row.local_id) !== String(id));
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    } catch (_) {}
  };

  const renderCancelPanel = (request) => {
    if (!isPending(request)) return "";
    if (!request?.id || String(request.id).startsWith("local-")) return "";
    return `
      <div class="detail-box-local" style="grid-column:1/-1;background:#fff8f8;border-color:#ffd9d9">
        <button id="cancelPendingRequestBtn" class="view-request-btn" type="button" style="margin-top:12px;background:#d93025">إلغاء الطلب</button>
        <p id="cancelRequestMsg" class="request-submit-message"></p>
      </div>
    `;
  };

  const renderInfoRequestPanel = (request, logs = []) => {
    const infoLog = latestInfoRequest(logs);
    const infoText = valueOf(infoLog?.comment, infoLog?.reason, request?.final_decision_reason, "لم يتم تحديد معلومات مطلوبة.");
    const infoDate = formatLogDate(infoLog?.created_at);

    if (!isNeedsInfo(request)) {
      return [
        box("آخر طلب معلومات", infoText === "لم يتم تحديد معلومات مطلوبة." ? "لا يوجد" : infoText),
        box("تاريخ طلب المعلومات", infoText === "لم يتم تحديد معلومات مطلوبة." ? "-" : infoDate)
      ].join("");
    }

    return `
      ${box("المعلومات المطلوبة", infoText)}
      ${box("تاريخ طلب المعلومات", infoDate)}
      <div class="detail-box-local" style="grid-column:1/-1">
        <span>إرسال معلومات للرد</span>
        <textarea id="employeeInfoReply" style="width:100%;min-height:110px;border:1px solid #dfe5f2;border-radius:14px;padding:12px;resize:vertical;font-family:inherit" placeholder="اكتب المعلومات المطلوبة هنا..."></textarea>
        <button id="sendInfoReplyBtn" class="view-request-btn" type="button" style="margin-top:10px">إرسال المعلومات</button>
        <p id="infoReplyMsg" class="request-submit-message"></p>
      </div>
    `;
  };

  window.showDetails = async (row) => {
    const content = document.getElementById("requestDetailsContent");
    const modal = document.getElementById("requestDetailsModal");
    if (!content || !modal) return;

    content.innerHTML = `<div class="empty-box" style="grid-column:1/-1">جاري تحميل تفاصيل الطلب...</div>`;
    modal.classList.add("is-open");

    let request = row;
    let logs = [];

    if (row?.id && !String(row.id).startsWith("local-")) {
      try {
        const data = await api(`/leaves/${row.id}`);
        request = data.request || row;
        logs = data.logs || [];
      } catch (error) {
        logs = [];
      }
    }

    const typeName = typeof requestType === "function" ? (typeLabels[requestType(request)] || request.request_title || "طلب") : (request.request_title || "طلب");
    const statusName = typeof requestStatus === "function" ? (statusLabels[requestStatus(request)] || requestStatus(request)) : (request.status || "-");
    const requestDate = typeof formatDate === "function" ? formatDate(request.created_at || request.submitted_at) : valueOf(request.created_at || request.submitted_at);
    const body = typeof requestDetailBoxes === "function" ? requestDetailBoxes(request) : "";

    content.innerHTML = [
      box("نوع الطلب", typeName),
      box("تاريخ التقديم", requestDate),
      box("الحالة", statusName),
      renderCancelPanel(request),
      renderInfoRequestPanel(request, logs),
      body
    ].join("");

    const cancelBtn = document.getElementById("cancelPendingRequestBtn");
    if (cancelBtn) {
      cancelBtn.onclick = async () => {
        const msg = document.getElementById("cancelRequestMsg");
        const ok = confirm("هل أنت متأكد من إلغاء الطلب؟ سيتم حذفه نهائيًا ولن يظهر مرة أخرى.");
        if (!ok) return;
        cancelBtn.disabled = true;
        msg.textContent = "جاري إلغاء الطلب...";
        msg.className = "request-submit-message";
        try {
          await api(`/leaves/${request.id}/self-cancel`, { method: "POST", body: JSON.stringify({}) });
          removeLocalRequest(request.id);
          msg.textContent = "تم إلغاء الطلب وحذفه بنجاح.";
          msg.className = "request-submit-message ok";
          if (typeof reloadRequestsAndRender === "function") await reloadRequestsAndRender();
          setTimeout(() => {
            document.getElementById("requestDetailsModal")?.classList.remove("is-open");
          }, 650);
        } catch (error) {
          msg.textContent = error.message || "تعذر إلغاء الطلب";
          msg.className = "request-submit-message err";
          cancelBtn.disabled = false;
        }
      };
    }

    const sendBtn = document.getElementById("sendInfoReplyBtn");
    if (sendBtn) {
      sendBtn.onclick = async () => {
        const input = document.getElementById("employeeInfoReply");
        const msg = document.getElementById("infoReplyMsg");
        const note = (input?.value || "").trim();
        if (!note) {
          msg.textContent = "اكتب المعلومات المطلوبة أولًا.";
          msg.className = "request-submit-message err";
          return;
        }
        sendBtn.disabled = true;
        msg.textContent = "جاري إرسال المعلومات...";
        msg.className = "request-submit-message";
        try {
          await api(`/leaves/${request.id}/action`, {
            method: "PATCH",
            body: JSON.stringify({ action: "respond_info", note })
          });
          msg.textContent = "تم إرسال المعلومات بنجاح، وعاد الطلب إلى قيد الانتظار.";
          msg.className = "request-submit-message ok";
          request.status = "pending";
          if (typeof reloadRequestsAndRender === "function") await reloadRequestsAndRender();
        } catch (error) {
          msg.textContent = error.message || "تعذر إرسال المعلومات";
          msg.className = "request-submit-message err";
          sendBtn.disabled = false;
        }
      };
    }
  };
})();
