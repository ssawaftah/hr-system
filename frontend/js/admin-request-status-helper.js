(() => {
  const lastMeaningfulAction = (logs = []) => {
    return [...logs].reverse().find((log) => log.action && !['created', 'submitted', 'comment'].includes(log.action));
  };

  const hasEmployeeResponse = (logs = []) => {
    const last = lastMeaningfulAction(logs);
    return last?.action === 'respond_info' || last?.new_status === 'pending' && logs.some((log) => log.action === 'respond_info');
  };

  const fetchRequestDetails = async (id) => {
    const response = await fetch(`${API_BASE_URL}/leaves/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'تعذر تحميل تفاصيل الطلب');
    return data;
  };

  const markTableRow = (button) => {
    const row = button.closest('tr');
    if (!row) return;
    const statusCell = row.children[6];
    if (!statusCell) return;
    statusCell.innerHTML = '<span class="status-badge primary-badge">تم تقديم معلومات</span>';
  };

  const markCard = (button) => {
    const card = button.closest('.request-card-mobile');
    if (!card) return;
    const badge = card.querySelector('.status-badge');
    if (!badge) return;
    badge.className = 'status-badge primary-badge';
    badge.textContent = 'تم تقديم معلومات';
  };

  const refreshSubmittedInfoBadges = async () => {
    const buttons = Array.from(document.querySelectorAll('[data-a="details"][data-id]'));
    const ids = [...new Set(buttons.map((button) => button.dataset.id).filter(Boolean))];
    if (!ids.length) return;

    for (const id of ids.slice(0, 80)) {
      try {
        const data = await fetchRequestDetails(id);
        const request = data.request || {};
        const logs = data.logs || [];
        if (request.status !== 'pending' || !hasEmployeeResponse(logs)) continue;
        buttons.filter((button) => String(button.dataset.id) === String(id)).forEach((button) => {
          markTableRow(button);
          markCard(button);
        });
      } catch (_) {}
    }
  };

  const wireRefresh = () => {
    const originalRender = window.renderRequests;
    if (typeof originalRender === 'function' && !originalRender.__submittedInfoWrapped) {
      window.renderRequests = function wrappedRenderRequests(...args) {
        const result = originalRender.apply(this, args);
        setTimeout(refreshSubmittedInfoBadges, 350);
        return result;
      };
      window.renderRequests.__submittedInfoWrapped = true;
    }
    setTimeout(refreshSubmittedInfoBadges, 900);
    document.getElementById('refreshRequestsBtn')?.addEventListener('click', () => setTimeout(refreshSubmittedInfoBadges, 1000));
    document.getElementById('showResultsBtn')?.addEventListener('click', () => setTimeout(refreshSubmittedInfoBadges, 700));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireRefresh);
  else wireRefresh();
})();
