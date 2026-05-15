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

  const renderInfoRequestPanel = (request, logs = []) => {
    const infoLog = latestInfoRequest(logs);
    const infoText = valueOf(infoLog?.comment, infoLog?.reason, request?.final_decision_reason, "لم يتم تحديد معلومات مطلوبة.");
    const infoDate = formatLogDate(infoLog?.created_at);

    if ((request?.status || requestStatus?.(request)) !== "needs_info") {
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

  const originalShowDetails = window.showDetails;

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
      renderInfoRequestPanel(request, logs),
      body
    ].join("");

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
