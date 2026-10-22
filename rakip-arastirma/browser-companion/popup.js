document.addEventListener('DOMContentLoaded', async () => {
  const statusBox = document.getElementById('statusBox');
  const syncBtn = document.getElementById('syncBtn');
  let latestData = null;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'INSPECT_ACTIVE_B2B_TAB' }, (resp) => {
      if (chrome.runtime.lastError || !resp) {
        statusBox.textContent = 'Sekme bilgisi okunamadı. Sayfayı yenileyip tekrar deneyin.';
        return;
      }
      latestData = resp;
      if (resp.session_status === 'intervention') {
        statusBox.innerHTML = `🟡 <strong>Kullanıcı müdahalesi gerekiyor</strong><br><small>${resp.intervention_reason}</small>`;
      } else {
        statusBox.innerHTML = `🟢 <strong>Oturum Açık — Araştırılabilir</strong><br><small>${resp.domain}</small>`;
      }
    });
  }

  syncBtn.addEventListener('click', async () => {
    if (!latestData) return;
    try {
      const res = await fetch('http://localhost:8765/api/browser-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(latestData)
      });
      if (res.ok) {
        statusBox.innerHTML += '<br><span style="color:#4ade80;">✓ Yerel Dashboard ile senkronize edildi.</span>';
      }
    } catch (e) {
      statusBox.innerHTML += '<br><span style="color:#f87171;">Yerel sunucu (localhost:8765) kapalı.</span>';
    }
  });
});
