/**
 * Rakip & B2B Açık Tarayıcı Oturumu Köprüsü — Content Script
 * Güvenlik İlkeleri:
 * - Kesinlikle document.cookie, localStorage token veya şifre alanı okumaz.
 * - Sadece ekranda görünür olan ürün adı, OEM, B2B fiyat, liste fiyatı ve stok bilgisini okur.
 * - Sayfada SMS, OTP, CAPTCHA veya MFA doğrulama ekranı varsa "Kullanıcı müdahalesi gerekiyor" (🟡) durumu bildirir.
 */

(function () {
  function detectIntervention() {
    const bodyText = (document.body ? document.body.innerText : '').toLowerCase();
    const hasCaptcha =
      !!document.querySelector('iframe[src*="recaptcha"], iframe[src*="turnstile"], .g-recaptcha, .cf-turnstile') ||
      bodyText.includes('güvenlik doğrulaması') ||
      bodyText.includes('robot olmadığınızı');
    const hasSmsOtp =
      !!document.querySelector('input[name*="otp" i], input[name*="sms" i], input[autocomplete="one-time-code"]') ||
      bodyText.includes('sms doğrulama') ||
      bodyText.includes('tek kullanımlık şifre');

    if (hasCaptcha) {
      return { required: true, reason: 'CAPTCHA doğrulaması bekleniyor — Kullanıcı müdahalesi gerekiyor.' };
    }
    if (hasSmsOtp) {
      return { required: true, reason: 'SMS / OTP doğrulaması bekleniyor — Kullanıcı müdahalesi gerekiyor.' };
    }
    return { required: false, reason: null };
  }

  function extractVisiblePageSummary() {
    const intervention = detectIntervention();
    return {
      domain: window.location.hostname,
      url: window.location.href,
      title: document.title,
      session_status: intervention.required ? 'intervention' : 'open',
      intervention_reason: intervention.reason,
      timestamp: new Date().toISOString()
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.action === 'INSPECT_ACTIVE_B2B_TAB') {
      sendResponse(extractVisiblePageSummary());
    }
    return true;
  });
})();
