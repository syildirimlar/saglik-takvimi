/**
 * Sağlık & Yaşam Takvim Programı - Ana Kontrolcü (App Controller)
 * Sekme geçişleri, modal kontrolleri, form yönetimi, tema ve toast bildirimleri.
 */

// Global Bildirim Gösterici (Toast)
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'info') icon = 'ℹ️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

const App = {
  currentTab: 'calendar',
  activeEditingEventId: null,

  init() {
    try { this.setupAuthSystem(); } catch (e) { console.error('Auth hatası:', e); }
    try { this.setupAdminDashboard(); } catch (e) { console.error('AdminDashboard hatası:', e); }
    try { this.setupUserProfileModal(); } catch (e) { console.error('ProfileModal hatası:', e); }
    try { this.setupLinkPhoneModal(); } catch (e) { console.error('LinkPhoneModal hatası:', e); }
    try { this.setupTheme(); } catch (e) { console.error('Theme hatası:', e); }
    try { this.setupNavigationTabs(); } catch (e) { console.error('Tabs hatası:', e); }
    try { this.setupQuickButtons(); } catch (e) { console.error('QuickButtons hatası:', e); }
    try { this.setupModal(); } catch (e) { console.error('Modal hatası:', e); }
    try { this.setupAllEventsListView(); } catch (e) { console.error('ListView hatası:', e); }
    try { this.setupBackupTab(); } catch (e) { console.error('BackupTab hatası:', e); }

    // Alt modülleri başlat
    try { CategoryManager.init(); } catch (e) { console.error('CategoryManager hatası:', e); }
    try { Calendar.init(); } catch (e) { console.error('Calendar hatası:', e); }
    try { Reports.init(); } catch (e) { console.error('Reports hatası:', e); }
    try { this.setupNotificationEngine(); } catch (e) { console.error('Notification hatası:', e); }
    try { if (window.CloudSync) CloudSync.init(); } catch (e) { console.error('CloudSync hatası:', e); }

    // Oturum kontrolü ve arayüz başlatma
    if (!Storage.isLoggedIn()) {
      this.applyProfileGenderUI();
      setTimeout(() => {
        this.showLoginModal();
      }, 350);
    } else {
      this.applyProfileGenderUI();
      try {
        const events = Storage.getEvents();
        if (events.length === 0) {
          setTimeout(() => {
            showToast('Hoş geldiniz! Takvimi test etmek için "✨ Örnek Veri" butonuna tıklayabilirsiniz.', 'info');
          }, 800);
        }
      } catch (e) {}
    }
  },

  // Tüm görünümleri senkronize yenile
  refreshAllViews() {
    CategoryManager.populateAllCategoryDropdowns();
    CategoryManager.renderCategoryCards();
    Calendar.render();
    Reports.render();
    this.renderAllEventsList();
    this.checkScheduledAppointments();
    this.updateDemoButtonState();
  },

  // ================= 1. KULLANICI GİRİŞ & OTURUM SİSTEMİ (AUTH) =================
  setupAuthSystem() {
    // 1. URL'de davet / hızlı giriş parametresi var mı (?invite=...&bin=...&sync=...)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const invitePayload = urlParams.get('invite');
      const syncParam = urlParams.get('sync');
      const binParam = urlParams.get('bin');
      const dataParam = urlParams.get('d');

      if (invitePayload) {
        const importedUser = Storage.importInvitePayload(invitePayload);
        if (importedUser) {
          showToast(`Hoş geldiniz ${importedUser.name}! Hesabınız tanımlandı ve oturumunuz açıldı.`, 'success');
        }
      }

      // Eğer URL'de sync, bin veya d parametresi de varsa CloudSync'i hemen bağla
      if ((syncParam || binParam || dataParam) && window.CloudSync) {
        CloudSync.handleIncomingUrlParams(syncParam, dataParam, binParam);
      }

      // İşlem bitince URL'yi temizle
      if (invitePayload || syncParam || binParam || dataParam) {
        try {
          window.history.replaceState(null, '', window.location.pathname);
        } catch (e) {}
      }
    } catch (e) {
      console.error('Invite ve sync kontrol hatası:', e);
    }

    const loginModal = document.getElementById('modal-login');
    const loginForm = document.getElementById('form-login');
    const loginUserInput = document.getElementById('login-username');
    const loginPassInput = document.getElementById('login-password');
    const loginErrBox = document.getElementById('login-error-alert');
    const loginErrText = document.getElementById('login-error-text');
    const togglePassBtn = document.getElementById('btn-toggle-login-pass');
    const headerLogoutBtn = document.getElementById('btn-header-logout');

    // Şifre göster / gizle butonu
    if (togglePassBtn && loginPassInput) {
      togglePassBtn.addEventListener('click', () => {
        const isPass = loginPassInput.type === 'password';
        loginPassInput.type = isPass ? 'text' : 'password';
        togglePassBtn.textContent = isPass ? '🙈' : '👁️';
      });
    }

    // Kullanıcı giriş yapana kadar ESC ile kapanmasını engelle
    if (loginModal) {
      loginModal.addEventListener('cancel', (e) => {
        if (!Storage.isLoggedIn()) {
          e.preventDefault();
        }
      });
    }

    // Giriş formu gönderimi
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = loginUserInput ? loginUserInput.value.trim() : '';
        const p = loginPassInput ? loginPassInput.value : '';

        let user = Storage.authenticate(u, p);

        // Eğer yerel şifre tutmadıysa ve bir bulut odasına bağlıysak, bilgisayarda şifre değişmiş olabilir!
        if (!user && window.CloudSync && CloudSync.hasActiveSync()) {
          try {
            if (loginErrText) loginErrText.textContent = 'Buluttaki güncel hesap bilgileri kontrol ediliyor...';
            if (loginErrBox) loginErrBox.style.display = 'flex';
            await CloudSync.pull(false);
            user = Storage.authenticate(u, p);
          } catch (syncErr) {
            console.warn('Giriş anında bulut kontrolü uyarısı:', syncErr);
          }
        }

        if (!user) {
          if (loginErrBox && loginErrText) {
            loginErrText.textContent = 'Kullanıcı adı veya şifre hatalı! Lütfen kontrol edin.';
            loginErrBox.style.display = 'flex';
          } else {
            alert('Kullanıcı adı veya şifre hatalı!');
          }
          return;
        }

        if (loginErrBox) loginErrBox.style.display = 'none';
        loginForm.reset();
        this.closeLoginModal();
        this.applyProfileGenderUI();
        this.refreshAllViews();
        showToast(`Hoş geldiniz, ${user.name}! Oturumunuz açıldı.`, 'success');
      });
    }

    // Giriş ekranından doğrudan eşitleme koduna bağlanma
    const toggleConnectBtn = document.getElementById('btn-login-toggle-connect');
    const connectFields = document.getElementById('login-connect-fields');
    const connectInput = document.getElementById('login-sync-code-input');
    const connectSubmitBtn = document.getElementById('btn-login-submit-connect');

    if (toggleConnectBtn && connectFields) {
      toggleConnectBtn.addEventListener('click', () => {
        const isShown = connectFields.style.display !== 'none';
        connectFields.style.display = isShown ? 'none' : 'block';
        if (!isShown && connectInput) {
          connectInput.focus();
        }
      });
    }

    if (connectSubmitBtn && connectInput) {
      connectSubmitBtn.addEventListener('click', async () => {
        const val = connectInput.value.trim();
        if (!val) {
          alert('Lütfen bilgisayardaki 7 haneli eşitleme kodunu veya bağlantısını girin.');
          return;
        }

        connectSubmitBtn.disabled = true;
        const originalText = connectSubmitBtn.textContent;
        connectSubmitBtn.textContent = '⏳ Bağlanıyor...';

        try {
          if (window.CloudSync) {
            const ok = await CloudSync.connectWithCode(val);
            if (ok) {
              const users = Storage.getUsers();
              const curUser = Storage.getCurrentUser() || (users.length > 0 ? users[0] : null);
              if (curUser) {
                Storage.setCurrentUser(curUser);
                this.closeLoginModal();
                this.applyProfileGenderUI();
                this.refreshAllViews();
              }
              return;
            }
          }
        } catch (err) {
          console.error('Giriş ekranı eşitleme hatası:', err);
          alert('Eşitleme bağlantısı kurulamadı: ' + err.message);
        } finally {
          connectSubmitBtn.disabled = false;
          connectSubmitBtn.textContent = originalText;
        }
      });
    }

    // Header çıkış butonu
    if (headerLogoutBtn) {
      headerLogoutBtn.addEventListener('click', () => this.handleLogout());
    }
  },

  showLoginModal() {
    const modal = document.getElementById('modal-login');
    if (!modal) return;
    const errBox = document.getElementById('login-error-alert');
    if (errBox) errBox.style.display = 'none';
    try {
      modal.showModal();
    } catch (e) {
      modal.setAttribute('open', '');
      modal.style.display = 'flex';
    }
  },

  closeLoginModal() {
    const modal = document.getElementById('modal-login');
    if (!modal) return;
    try { if (modal.open) modal.close(); } catch (e) {}
    modal.removeAttribute('open');
    modal.style.display = 'none';
  },

  handleLogout() {
    if (confirm('Oturumu kapatmak istediğinize emin misiniz?')) {
      Storage.logout();
      this.applyProfileGenderUI();
      this.refreshAllViews();
      this.closeProfileModal();
      this.closeAdminModal();
      this.showLoginModal();
      showToast('Oturum kapatıldı.', 'info');
    }
  },

  // ================= 2. YÖNETİCİ PANELİ (ADMIN HESAP YÖNETİMİ) =================
  setupAdminDashboard() {
    const adminBtn = document.getElementById('btn-admin-panel');
    const adminModal = document.getElementById('modal-admin');
    const adminCloseBtn = document.getElementById('modal-admin-btn-close');

    if (adminBtn) {
      adminBtn.addEventListener('click', () => {
        if (!Storage.isAdmin()) {
          showToast('Bu alana sadece Sistem Yöneticisi erişebilir.', 'error');
          return;
        }
        this.openAdminModal();
      });
    }

    if (adminCloseBtn) {
      adminCloseBtn.addEventListener('click', () => this.closeAdminModal());
    }

    // Tab geçişleri
    const tabUsersBtn = document.getElementById('admin-tab-btn-users');
    const tabCreateBtn = document.getElementById('admin-tab-btn-create');
    const tabUsersContent = document.getElementById('admin-tab-users');
    const tabCreateContent = document.getElementById('admin-tab-create');

    if (tabUsersBtn && tabCreateBtn) {
      tabUsersBtn.addEventListener('click', () => {
        tabUsersBtn.classList.add('active');
        tabCreateBtn.classList.remove('active');
        if (tabUsersContent) tabUsersContent.style.display = 'block';
        if (tabCreateContent) tabCreateContent.style.display = 'none';
        this.renderAdminUsersList();
      });

      tabCreateBtn.addEventListener('click', () => {
        tabCreateBtn.classList.add('active');
        tabUsersBtn.classList.remove('active');
        if (tabCreateContent) tabCreateContent.style.display = 'block';
        if (tabUsersContent) tabUsersContent.style.display = 'none';
      });
    }

    // Rastgele şifre üretme butonu
    const genPassBtn = document.getElementById('btn-admin-gen-pass');
    const newPassInput = document.getElementById('admin-new-password');
    if (genPassBtn && newPassInput) {
      genPassBtn.addEventListener('click', () => {
        const chars = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
        let res = '';
        for (let i = 0; i < 6; i++) {
          res += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        newPassInput.value = res;
        showToast(`Rastgele şifre üretildi: ${res}`, 'info');
      });
    }

    // Yeni kullanıcı oluşturma formu
    const createForm = document.getElementById('form-admin-create-user');
    const resultBox = document.getElementById('admin-create-result-box');
    const previewEl = document.getElementById('admin-invite-msg-preview');
    const copyTextBtn = document.getElementById('btn-copy-invite-text');
    const copyUrlBtn = document.getElementById('btn-copy-direct-url');
    let lastInviteUrl = '';
    let lastInviteMessage = '';

    if (createForm) {
      createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('admin-new-username')?.value.trim();
        const name = document.getElementById('admin-new-name')?.value.trim();
        const gender = document.getElementById('admin-new-gender')?.value || 'female';
        const password = document.getElementById('admin-new-password')?.value.trim();

        try {
          const newUser = Storage.createUser({ username, password, name, gender, role: 'user' });
          this.renderAdminUsersList();

          if (window.CloudSync) {
            if (!CloudSync.hasActiveSync() || CloudSync.provider !== 'hybrid-ext') {
              await CloudSync.startNewSync();
            } else {
              await CloudSync.pushDirect(Storage.getEvents(), Storage.getCategories(false), Storage.getUsers());
            }
          }

          lastInviteUrl = Storage.generateInviteUrl(newUser);
          lastInviteMessage = `Merhaba ${newUser.name},\nSağlık & Yaşam Takvimi hesabınız hazırlandı!\n\n🔗 Giriş Linki: ${lastInviteUrl}\n👤 Kullanıcı Adı: ${newUser.username}\n🔑 Şifreniz: ${newUser.password}\n\nYukarıdaki linke tıklayarak doğrudan hesabınıza giriş yapabilir ve profilinizden şifrenizi dilediğiniz zaman değiştirebilirsiniz.`;

          if (previewEl) previewEl.textContent = lastInviteMessage;
          if (resultBox) resultBox.style.display = 'block';

          createForm.reset();
          const passEl = document.getElementById('admin-new-password');
          if (passEl) passEl.value = '123456';

          showToast(`"${newUser.name}" hesabı oluşturuldu ve buluta kaydedildi!`, 'success');
        } catch (err) {
          alert(err.message);
        }
      });
    }

    if (copyTextBtn) {
      copyTextBtn.addEventListener('click', () => {
        if (!lastInviteMessage) return;
        navigator.clipboard.writeText(lastInviteMessage).then(() => {
          showToast('WhatsApp davet metni kopyalandı!', 'success');
        }).catch(() => {
          alert(lastInviteMessage);
        });
      });
    }

    if (copyUrlBtn) {
      copyUrlBtn.addEventListener('click', () => {
        if (!lastInviteUrl) return;
        navigator.clipboard.writeText(lastInviteUrl).then(() => {
          showToast('Giriş linki kopyalandı!', 'success');
        }).catch(() => {
          alert(lastInviteUrl);
        });
      });
    }
  },

  openAdminModal() {
    const modal = document.getElementById('modal-admin');
    if (!modal) return;
    this.renderAdminUsersList();
    if (window.CloudSync && CloudSync.hasActiveSync()) {
      CloudSync.pull(false).then(() => {
        this.renderAdminUsersList();
      }).catch(() => {});
    }
    try {
      modal.showModal();
    } catch (e) {
      modal.setAttribute('open', '');
      modal.style.display = 'flex';
    }
  },

  closeAdminModal() {
    const modal = document.getElementById('modal-admin');
    if (!modal) return;
    try { if (modal.open) modal.close(); } catch (e) {}
    modal.removeAttribute('open');
    modal.style.display = 'none';
  },

  renderAdminUsersList() {
    const tableWrap = document.getElementById('admin-users-table-wrap');
    const countBadge = document.getElementById('admin-users-count');
    if (!tableWrap) return;

    const users = Storage.getUsers();
    if (countBadge) countBadge.textContent = users.length;

    if (users.length === 0) {
      tableWrap.innerHTML = '<p style="padding:16px; color:var(--text-secondary);">Kayıtlı kullanıcı bulunamadı.</p>';
      return;
    }

    let html = `
      <table class="admin-users-table">
        <thead>
          <tr>
            <th>Kullanıcı</th>
            <th>Kullanıcı Adı</th>
            <th>Cinsiyet & Rol</th>
            <th>Son Giriş</th>
            <th style="text-align: right;">İşlemler</th>
          </tr>
        </thead>
        <tbody>
    `;

    users.forEach(u => {
      const isAdm = u.role === 'admin';
      const avatar = u.avatar || (u.gender === 'female' ? '👩' : (u.gender === 'male' ? '👨' : '👤'));
      const genderText = u.gender === 'female' ? 'Kadın (Döngü Takibi)' : (u.gender === 'male' ? 'Erkek' : 'Genel');
      const lastLoginText = u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Henüz girmedi';

      html += `
        <tr>
          <td>
            <div class="admin-user-cell">
              <div class="admin-user-avatar">${avatar}</div>
              <div>
                <strong>${u.name || u.username}</strong>
              </div>
            </div>
          </td>
          <td><code>@${u.username}</code></td>
          <td>
            <span class="admin-role-badge ${isAdm ? 'role-admin' : 'role-user'}">${isAdm ? '👑 Admin' : '👤 Kullanıcı'}</span>
            <div style="font-size: 0.75rem; color:var(--text-secondary); margin-top:2px;">${genderText}</div>
          </td>
          <td><small style="color:var(--text-secondary);">${lastLoginText}</small></td>
          <td>
            <div class="admin-actions-cell" style="justify-content: flex-end;">
              <button type="button" class="btn btn-sm btn-outline btn-admin-invite" data-id="${u.id}" title="WhatsApp Giriş Metnini Kopyala">
                📋 Giriş Linki
              </button>
              <button type="button" class="btn btn-sm btn-outline btn-admin-reset-pass" data-id="${u.id}" title="Şifreyi Güncelle/Sıfırla">
                🔑 Şifre
              </button>
              ${!isAdm ? `<button type="button" class="btn btn-sm btn-danger btn-admin-delete" data-id="${u.id}" title="Kullanıcıyı Sil">🗑️ Sil</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    tableWrap.innerHTML = html;

    // İşlem butonları dinleyicileri
    tableWrap.querySelectorAll('.btn-admin-invite').forEach(b => {
      b.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const u = Storage.getUserById(id);
        if (!u) return;
        const url = Storage.generateInviteUrl(u);
        const msg = `Merhaba ${u.name},\nSağlık & Yaşam Takvimi hesabınız:\n\n🔗 Giriş Linki: ${url}\n👤 Kullanıcı Adı: ${u.username}\n🔑 Şifre: ${u.password}\n\nLinke tıklayarak doğrudan hesabınıza giriş yapabilirsiniz.`;
        navigator.clipboard.writeText(msg).then(() => {
          showToast(`"${u.name}" için WhatsApp giriş bilgileri kopyalandı!`, 'success');
        }).catch(() => {
          alert(msg);
        });
      });
    });

    tableWrap.querySelectorAll('.btn-admin-reset-pass').forEach(b => {
      b.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const u = Storage.getUserById(id);
        if (!u) return;
        const newPass = prompt(`"${u.name}" (@${u.username}) için yeni şifre belirleyin:`, u.password || '123456');
        if (newPass && newPass.trim().length >= 3) {
          Storage.updateUser(u.id, { password: newPass.trim() });
          if (window.CloudSync && CloudSync.hasActiveSync()) {
            CloudSync.push(false);
          }
          showToast(`"${u.name}" kullanıcısının şifresi güncellendi.`, 'success');
        } else if (newPass !== null) {
          alert('Şifre en az 3 karakter olmalıdır.');
        }
      });
    });

    tableWrap.querySelectorAll('.btn-admin-delete').forEach(b => {
      b.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const u = Storage.getUserById(id);
        if (!u) return;
        if (confirm(`"${u.name}" (@${u.username}) kullanıcısını ve bu kullanıcının tüm takvim kayıtlarını silmek istediğinize emin misiniz?`)) {
          try {
            Storage.deleteUser(id);
            this.renderAdminUsersList();
            showToast(`"${u.name}" kullanıcısı silindi.`, 'info');
          } catch (err) {
            alert(err.message);
          }
        }
      });
    });
  },

  // ================= 3. KİŞİSEL PROFİL & ŞİFRE DEĞİŞTİRME =================
  setupUserProfileModal() {
    const profileBtn = document.getElementById('btn-user-profile');
    const profileModal = document.getElementById('modal-profile');
    const closeProfileBtn = document.getElementById('modal-profile-btn-close');
    const saveActiveBtn = document.getElementById('btn-save-profile-active');
    const passForm = document.getElementById('form-change-password');
    const modalLogoutBtn = document.getElementById('btn-modal-logout');

    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        if (!Storage.isLoggedIn()) {
          this.showLoginModal();
        } else {
          this.openProfileModal();
        }
      });
    }

    if (closeProfileBtn) {
      closeProfileBtn.addEventListener('click', () => this.closeProfileModal());
    }

    if (modalLogoutBtn) {
      modalLogoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Profil bilgilerini güncelle butonu
    if (saveActiveBtn) {
      saveActiveBtn.addEventListener('click', () => {
        const cur = Storage.getCurrentUser();
        if (!cur) return;

        const nameInput = document.getElementById('profile-name-input');
        const gender = document.querySelector('input[name="profile-gender"]:checked')?.value || 'female';
        const name = (nameInput?.value || '').trim() || cur.name || 'Kullanıcı';

        Storage.updateUser(cur.id, { name, gender });
        this.applyProfileGenderUI();
        this.refreshAllViews();
        this.closeProfileModal();
        showToast('Profil bilgileriniz başarıyla güncellendi.', 'success');
      });
    }

    // Kendi şifresini değiştirme formu
    if (passForm) {
      passForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const cur = Storage.getCurrentUser();
        if (!cur) return;

        const currentPass = document.getElementById('pass-current')?.value;
        const newPass = document.getElementById('pass-new')?.value;
        const confirmPass = document.getElementById('pass-confirm')?.value;

        if (String(currentPass).trim() !== String(cur.password).trim()) {
          alert('Mevcut şifrenizi yanlış girdiniz! Lütfen kontrol edin.');
          return;
        }

        if (!newPass || newPass.trim().length < 3) {
          alert('Yeni şifreniz en az 3 karakter olmalıdır.');
          return;
        }

        if (newPass !== confirmPass) {
          alert('Yeni şifreler birbiriyle eşleşmiyor! Lütfen iki kutucuğa da aynı şifreyi giriniz.');
          return;
        }

        Storage.updateUser(cur.id, { password: newPass.trim() });
        if (window.CloudSync && CloudSync.hasActiveSync()) {
          CloudSync.push(false);
        }
        passForm.reset();
        showToast('Şifreniz başarıyla değiştirildi! Yeni şifreniz buluta da aktarıldı.', 'success');
      });
    }
  },

  openProfileModal() {
    const profileModal = document.getElementById('modal-profile');
    if (!profileModal) return;

    const cur = Storage.getCurrentUser();
    if (!cur) {
      this.showLoginModal();
      return;
    }

    const dispUser = document.getElementById('profile-display-username');
    const dispRole = document.getElementById('profile-display-role');
    const nameInput = document.getElementById('profile-name-input');

    if (dispUser) dispUser.textContent = cur.username;
    if (dispRole) dispRole.textContent = cur.role === 'admin' ? '👑 Sistem Yöneticisi' : '👤 Kullanıcı';
    if (nameInput) nameInput.value = cur.name || '';

    const genderRadio = document.querySelector(`input[name="profile-gender"][value="${cur.gender || 'female'}"]`);
    if (genderRadio) genderRadio.checked = true;

    try {
      profileModal.showModal();
    } catch (err) {
      profileModal.setAttribute('open', '');
      profileModal.style.display = 'flex';
    }
  },

  closeProfileModal() {
    const profileModal = document.getElementById('modal-profile');
    if (!profileModal) return;
    try { if (profileModal.open) profileModal.close(); } catch (err) {}
    profileModal.removeAttribute('open');
    profileModal.style.display = 'none';
  },

  // ================= 4. TELEFON BAĞLAMA & KAREKOD SİSTEMİ =================
  setupLinkPhoneModal() {
    const modal = document.getElementById('modal-link-phone');
    const closeBtn = document.getElementById('modal-link-phone-btn-close');
    const headerBtn = document.getElementById('btn-header-link-phone');
    const profileBtn = document.getElementById('btn-profile-open-link-phone');
    const adminBtn = document.getElementById('admin-btn-open-link-phone');
    const copyUrlBtn = document.getElementById('btn-link-phone-copy-url');
    const copyCodeBtn = document.getElementById('btn-link-phone-copy-code');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeLinkPhoneModal());
    }

    if (headerBtn) {
      headerBtn.addEventListener('click', () => this.openLinkPhoneModal());
    }

    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        this.closeProfileModal();
        this.openLinkPhoneModal();
      });
    }

    if (adminBtn) {
      adminBtn.addEventListener('click', () => {
        this.closeAdminModal();
        this.openLinkPhoneModal();
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeLinkPhoneModal();
      });
    }

    if (copyCodeBtn) {
      copyCodeBtn.addEventListener('click', () => {
        const shortCode = window.CloudSync && typeof CloudSync.getShortDisplayCode === 'function'
          ? CloudSync.getShortDisplayCode()
          : (window.CloudSync ? CloudSync.getSyncId() : null);
        if (!shortCode) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shortCode).then(() => {
            showToast(`📋 Eşitleme kodu (${shortCode}) kopyalandı!`, 'success');
          }).catch(() => showToast('Eşitleme Kodu: ' + shortCode, 'info'));
        } else {
          showToast('Eşitleme Kodu: ' + shortCode, 'info');
        }
      });
    }

    if (copyUrlBtn) {
      copyUrlBtn.addEventListener('click', () => {
        const urlInput = document.getElementById('link-phone-url-input');
        if (!urlInput || !urlInput.value) return;
        const val = urlInput.value;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(val).then(() => {
            showToast('📋 Bağlantı kopyalandı! WhatsApp veya tarayıcınızda açabilirsiniz.', 'success');
          }).catch(() => {
            urlInput.select();
            document.execCommand('copy');
            showToast('📋 Bağlantı kopyalandı!', 'success');
          });
        } else {
          urlInput.select();
          document.execCommand('copy');
          showToast('📋 Bağlantı kopyalandı!', 'success');
        }
      });
    }
  },

  async openLinkPhoneModal() {
    const modal = document.getElementById('modal-link-phone');
    if (!modal) return;

    const qrImg = document.getElementById('link-phone-qr-img');
    const syncCodeEl = document.getElementById('link-phone-sync-code');
    const urlInput = document.getElementById('link-phone-url-input');
    const whatsappBtn = document.getElementById('btn-link-phone-whatsapp');

    if (syncCodeEl) syncCodeEl.textContent = 'Hazırlanıyor...';
    if (urlInput) urlInput.value = 'Bulut paketi oluşturuluyor, lütfen bekleyin...';

    try {
      modal.showModal();
    } catch (err) {
      modal.setAttribute('open', '');
      modal.style.display = 'flex';
    }

    // Buluta güncel tüm aboneleri, kullanıcıları ve takvim olaylarını yükle ve tamamlanmasını bekle
    if (window.CloudSync) {
      if (!CloudSync.hasActiveSync() || CloudSync.provider !== 'hybrid-ext') {
        await CloudSync.startNewSync();
      } else {
        await CloudSync.pushDirect(Storage.getEvents(), Storage.getCategories(false), Storage.getUsers());
      }
    }

    const curUser = Storage.getCurrentUser();
    const shortCode = window.CloudSync && typeof CloudSync.getShortDisplayCode === 'function'
      ? CloudSync.getShortDisplayCode()
      : (window.CloudSync ? CloudSync.getSyncId() : null);

    let pairingUrl = '';
    if (window.CloudSync && typeof CloudSync.getDevicePairingUrl === 'function') {
      pairingUrl = CloudSync.getDevicePairingUrl(curUser);
    } else {
      pairingUrl = Storage.generateInviteUrl(curUser, shortCode);
    }

    if (syncCodeEl) syncCodeEl.textContent = shortCode || 'Hata';
    if (urlInput) urlInput.value = pairingUrl;
    if (qrImg && pairingUrl) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pairingUrl)}`;
    }

    if (whatsappBtn && pairingUrl) {
      const uName = curUser ? curUser.name : 'Hesabım';
      const msg = `📱 Sağlık Takvimi - Cihaz Eşitleme ve Giriş Bağlantısı:\n\nHesap: ${uName}\nKısa Eşitleme Kodu: ${shortCode}\n\nBu linke tıklayarak telefonunuzda şifrenizle anında oturum açabilir, abonelerinizi ve takviminizi senkronize edebilirsiniz:\n\n${pairingUrl}`;
      whatsappBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    }
  },

  closeLinkPhoneModal() {
    const modal = document.getElementById('modal-link-phone');
    if (!modal) return;
    try { if (modal.open) modal.close(); } catch (err) {}
    modal.removeAttribute('open');
    modal.style.display = 'none';
  },

  applyProfileGenderUI() {
    const cur = Storage.getCurrentUser();
    const isLogged = !!cur;
    const isAdmin = isLogged && cur.role === 'admin';
    const gender = cur ? (cur.gender || 'unspecified') : 'unspecified';

    const adminBtn = document.getElementById('btn-admin-panel');
    const logoutBtn = document.getElementById('btn-header-logout');
    const periodQuickBtn = document.getElementById('btn-quick-period');
    const headerAvatar = document.getElementById('header-profile-avatar');
    const headerName = document.getElementById('header-profile-name');

    if (adminBtn) {
      adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    }

    if (logoutBtn) {
      logoutBtn.style.display = isLogged ? 'inline-flex' : 'none';
    }

    if (periodQuickBtn) {
      periodQuickBtn.style.display = (gender === 'female') ? 'inline-flex' : 'none';
    }

    if (headerAvatar) {
      headerAvatar.textContent = cur ? (cur.avatar || (gender === 'female' ? '👩' : (gender === 'male' ? '👨' : '👤'))) : '👤';
    }

    if (headerName) {
      if (cur) {
        const name = cur.name || cur.username;
        headerName.textContent = name.length > 12 ? name.slice(0, 10) + '...' : name;
      } else {
        headerName.textContent = 'Giriş Yap';
      }
    }

    // Kategorileri cinsiyet filtresine göre yeniden doldur
    if (typeof CategoryManager !== 'undefined' && typeof CategoryManager.populateAllCategoryDropdowns === 'function') {
      CategoryManager.populateAllCategoryDropdowns();
    }
  },

  // ================= 1. TEMA YÖNETİMİ =================
  setupTheme() {
    const themeBtn = document.getElementById('btn-toggle-theme');
    const themeIcon = document.getElementById('theme-icon');
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';

    if (savedTheme === 'dark') {
      document.body.classList.remove('light-mode');
      document.body.classList.add('dark-mode');
      if (themeIcon) themeIcon.textContent = '☀️';
    } else {
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
      if (themeIcon) themeIcon.textContent = '🌙';
    }

    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-mode');
        if (isDark) {
          document.body.classList.remove('dark-mode');
          document.body.classList.add('light-mode');
          if (themeIcon) themeIcon.textContent = '🌙';
          localStorage.setItem(STORAGE_KEYS.THEME, 'light');
        } else {
          document.body.classList.remove('light-mode');
          document.body.classList.add('dark-mode');
          if (themeIcon) themeIcon.textContent = '☀️';
          localStorage.setItem(STORAGE_KEYS.THEME, 'dark');
        }
      });
    }
  },

  // ================= 2. SEKME GEÇİŞLERİ =================
  setupNavigationTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        this.currentTab = targetTab;

        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const targetContent = document.getElementById(`tab-${targetTab}`);
        if (targetContent) targetContent.classList.add('active');

        // Sekmeye özel yenilemeler
        if (targetTab === 'calendar') {
          Calendar.render();
        } else if (targetTab === 'reports') {
          Reports.render();
        } else if (targetTab === 'list') {
          this.renderAllEventsList();
        } else if (targetTab === 'categories') {
          CategoryManager.renderCategoryCards();
        }
      });
    });
  },

  // ================= 3. HIZLI İŞLEM BUTONLARI =================
  setupQuickButtons() {
    // Üst Çubuk: WC Butonu
    const wcBtn = document.getElementById('btn-quick-wc');
    if (wcBtn) {
      wcBtn.addEventListener('click', () => {
        this.openEventModal(null, null, 'wc');
      });
    }

    // Üst Çubuk: Baş Ağrısı Butonu
    const headacheBtn = document.getElementById('btn-quick-headache');
    if (headacheBtn) {
      headacheBtn.addEventListener('click', () => {
        this.openEventModal(null, null, 'headache');
      });
    }

    // Üst Çubuk: Spor Butonu
    const sportBtn = document.getElementById('btn-quick-sport');
    if (sportBtn) {
      sportBtn.addEventListener('click', () => {
        this.openEventModal(null, null, 'sport');
      });
    }

    // Üst Çubuk: Masaj Butonu
    const massageBtn = document.getElementById('btn-quick-massage');
    if (massageBtn) {
      massageBtn.addEventListener('click', () => {
        this.openEventModal(null, null, 'massage');
      });
    }

    // Üst Çubuk: Adet / Döngü Butonu (Kadınlar için)
    const periodBtn = document.getElementById('btn-quick-period');
    if (periodBtn) {
      periodBtn.addEventListener('click', () => {
        this.openEventModal(null, null, 'period');
      });
    }

    // Üst Çubuk: Yeni Olay Ekle Butonu
    const addBtn = document.getElementById('btn-open-add-modal');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.openEventModal();
      });
    }

    // Üst Çubuk: Örnek Veri Yükle Butonu
    const demoBtn = document.getElementById('btn-load-demo');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        this.loadDemo();
      });
    }

    // Üst Çubuk: Örnek Verileri Temizle / Kaldır Butonu
    const clearDemoBtn = document.getElementById('btn-clear-demo');
    if (clearDemoBtn) {
      clearDemoBtn.addEventListener('click', () => {
        this.clearDemoData();
      });
    }

    this.updateDemoButtonState();
  },

  updateDemoButtonState() {
    const hasDemo = Storage.hasDemoData();
    const clearBtn1 = document.getElementById('btn-clear-demo');
    const clearBtn2 = document.getElementById('btn-clear-demo-2');

    if (clearBtn1) {
      clearBtn1.style.display = 'inline-flex';
      clearBtn1.innerHTML = hasDemo ? '<span>🗑️ Örnekleri Temizle</span>' : '<span>🗑️ Takvimi Temizle</span>';
    }
    if (clearBtn2) {
      clearBtn2.style.display = 'inline-flex';
    }
  },

  loadDemo() {
    if (confirm('30 günlük gerçekçi örnek kayıtlar yüklenecek. Devam etmek istiyor musunuz?')) {
      const count = Storage.loadDemoData();
      this.refreshAllViews();
      showToast(`${count} adet örnek kayıt başarıyla yüklendi!`, 'success');
    }
  },

  clearDemoData() {
    const events = Storage.getEvents();
    if (events.length === 0) {
      showToast('Takvim zaten tertemiz ve boş durumda! ✨', 'info');
      return;
    }

    if (confirm('Takvimdeki kayıtları temizlemek istediğinize emin misiniz? (Örnek veriler ve olaylar silinerek takvim sıfırlanacaktır)')) {
      Storage.clearAllData();
      this.refreshAllViews();
      showToast('Takvim başarıyla temizlendi ve sıfırlandı! 👍', 'success');
    }
  },

  // ================= 4. MODAL & FORM YÖNETİMİ =================
  setupModal() {
    const modal = document.getElementById('modal-event');
    const closeBtn = document.getElementById('modal-btn-close');
    const cancelBtn = document.getElementById('modal-btn-cancel');
    const form = document.getElementById('form-event');
    const delBtn = document.getElementById('modal-btn-delete');

    // Kapatma butonları
    const closeModal = () => {
      if (modal) {
        try {
          if (modal.open) modal.close();
        } catch (err) {
          modal.removeAttribute('open');
          modal.style.display = 'none';
        }
      }
      this.activeEditingEventId = null;
    };
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Baş Ağrısı Şiddet Slider'ı
    const hSlider = document.getElementById('headache-intensity');
    const hBadge = document.getElementById('headache-intensity-badge');
    if (hSlider && hBadge) {
      hSlider.addEventListener('input', () => {
        const val = parseInt(hSlider.value, 10);
        let text = `${val} / 10 - Orta`;
        let cls = 'level-5';

        if (val <= 2) { text = `${val} / 10 - Çok Hafif`; cls = 'level-1'; }
        else if (val <= 4) { text = `${val} / 10 - Hafif`; cls = 'level-3'; }
        else if (val <= 6) { text = `${val} / 10 - Orta`; cls = 'level-5'; }
        else if (val <= 8) { text = `${val} / 10 - Şiddetli`; cls = 'level-7'; }
        else { text = `${val} / 10 - Çok Şiddetli / Dayanılmaz`; cls = 'level-10'; }

        hBadge.textContent = text;
        hBadge.className = `intensity-badge ${cls}`;
      });
    }

    // Baş Ağrısı İlaç Checkbox'ı
    const medCheckbox = document.getElementById('headache-med-taken');
    const medNameInput = document.getElementById('headache-med-name');
    if (medCheckbox && medNameInput) {
      medCheckbox.addEventListener('change', () => {
        medNameInput.style.display = medCheckbox.checked ? 'block' : 'none';
        if (medCheckbox.checked) medNameInput.focus();
      });
    }

    // Genel Şiddet Slider'ı
    const gSlider = document.getElementById('generic-intensity');
    const gBadge = document.getElementById('generic-intensity-badge');
    if (gSlider && gBadge) {
      gSlider.addEventListener('input', () => {
        const val = parseInt(gSlider.value, 10);
        gBadge.textContent = `${val} / 10`;
      });
    }

    // Masaj Rahatlama Slider'ı
    const mSlider = document.getElementById('massage-relief');
    const mBadge = document.getElementById('massage-relief-badge');
    if (mSlider && mBadge) {
      mSlider.addEventListener('input', () => {
        const val = parseInt(mSlider.value, 10);
        let text = `${val} / 10 - İyi`;
        let cls = 'level-7';
        if (val <= 3) { text = `${val} / 10 - Az Etki`; cls = 'level-1'; }
        else if (val <= 6) { text = `${val} / 10 - Orta Rahatlama`; cls = 'level-5'; }
        else if (val <= 8) { text = `${val} / 10 - Çok İyi`; cls = 'level-7'; }
        else { text = `${val} / 10 - Mükemmel Rahatlama`; cls = 'level-10'; }
        mBadge.textContent = text;
        mBadge.className = `intensity-badge ${cls}`;
      });
    }

    // Adet / Sancı Şiddet Slider'ı
    const pSlider = document.getElementById('period-cramps');
    const pBadge = document.getElementById('period-cramps-badge');
    if (pSlider && pBadge) {
      pSlider.addEventListener('input', () => {
        const val = parseInt(pSlider.value, 10);
        let text = `${val} / 10 - Orta Kramp`;
        let cls = 'level-5';

        if (val <= 2) { text = `${val} / 10 - Çok Hafif Sızı`; cls = 'level-1'; }
        else if (val <= 4) { text = `${val} / 10 - Hafif Kramp`; cls = 'level-3'; }
        else if (val <= 6) { text = `${val} / 10 - Orta Sancı`; cls = 'level-5'; }
        else if (val <= 8) { text = `${val} / 10 - Şiddetli Ağrı`; cls = 'level-7'; }
        else { text = `${val} / 10 - Çok Şiddetli / Dinlenme Gerekli`; cls = 'level-10'; }

        pBadge.textContent = text;
        pBadge.className = `intensity-badge ${cls}`;
      });
    }

    // Adet İlaç Checkbox'ı
    const pMedCheckbox = document.getElementById('period-med-taken');
    const pMedNameInput = document.getElementById('period-med-name');
    if (pMedCheckbox && pMedNameInput) {
      pMedCheckbox.addEventListener('change', () => {
        pMedNameInput.style.display = pMedCheckbox.checked ? 'block' : 'none';
        if (pMedCheckbox.checked) pMedNameInput.focus();
      });
    }

    // Adet Semptom Etiketleri (Cloud Tag Toggle)
    const symptomTags = document.querySelectorAll('#period-symptoms-cloud .symptom-tag');
    symptomTags.forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
      });
    });

    // Etkinlik Durumu (Tamamlandı vs Randevu) Değişimi
    const statusRadios = form.querySelectorAll('input[name="event-status"]');
    const hintBox = document.getElementById('status-hint-box');
    statusRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (hintBox) {
          hintBox.style.display = radio.value === 'planned' ? 'block' : 'none';
        }
      });
    });

    // Tarih veya saat değiştiğinde gelecekteyse otomatik "Randevu" modunu seç
    const dateInput = document.getElementById('event-date');
    const timeInput = document.getElementById('event-time');
    const checkFutureDate = () => {
      if (dateInput.value && timeInput.value && !this.activeEditingEventId) {
        const selectedDt = new Date(`${dateInput.value}T${timeInput.value}`);
        if (selectedDt > new Date()) {
          const plannedRadio = form.querySelector('input[name="event-status"][value="planned"]');
          if (plannedRadio) {
            plannedRadio.checked = true;
            if (hintBox) hintBox.style.display = 'block';
          }
        }
      }
    };
    if (dateInput) dateInput.addEventListener('change', checkFutureDate);
    if (timeInput) timeInput.addEventListener('change', checkFutureDate);

    // Modal Silme Butonu
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (this.activeEditingEventId) {
          if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
            Storage.deleteEvent(this.activeEditingEventId);
            closeModal();
            this.refreshAllViews();
            showToast('Kayıt silindi.', 'info');
          }
        }
      });
    }

    // Form Gönderimi (Ekle / Güncelle)
    let isSaving = false;
    const handleSave = (e) => {
      if (e) e.preventDefault();
      if (isSaving) return;
      isSaving = true;
      try {
        const saved = this.saveEventFromModal();
        if (saved !== false) {
          closeModal();
        }
      } catch (err) {
        console.error('Kaydetme hatası:', err);
        alert('Kaydetme sırasında bir hata oluştu: ' + err.message);
      } finally {
        setTimeout(() => { isSaving = false; }, 300);
      }
    };

    if (form) {
      form.addEventListener('submit', handleSave);
    }

    const saveBtn = document.getElementById('modal-btn-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        if (form && typeof form.checkValidity === 'function' && !form.checkValidity()) {
          form.reportValidity();
          return;
        }
        handleSave(e);
      });
    }
  },

  // Modalı Aç (Yeni veya Düzenleme)
  openEventModal(eventToEdit = null, defaultDateStr = null, defaultCategoryId = null) {
    const modal = document.getElementById('modal-event');
    const modalTitle = document.getElementById('modal-event-title');
    const delBtn = document.getElementById('modal-btn-delete');
    const form = document.getElementById('form-event');

    if (!modal) return;
    form.reset();

    const dateInput = document.getElementById('event-date');
    const timeInput = document.getElementById('event-time');
    const notesInput = document.getElementById('event-notes');
    const medNameInput = document.getElementById('headache-med-name');
    if (medNameInput) medNameInput.style.display = 'none';

    const now = new Date();
    const todayStr = Calendar.formatDate(now);
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (eventToEdit) {
      // Düzenleme Modu
      this.activeEditingEventId = eventToEdit.id;
      modalTitle.textContent = 'Kaydı Düzenle';
      if (delBtn) delBtn.style.display = 'inline-flex';

      document.getElementById('event-edit-id').value = eventToEdit.id;
      if (dateInput) dateInput.value = eventToEdit.date;
      if (timeInput) timeInput.value = eventToEdit.time || '12:00';
      if (notesInput) notesInput.value = eventToEdit.notes || '';

      CategoryManager.renderModalCategoryPills(eventToEdit.categoryId);

      // Kategori Detaylarını Doldur
      if (eventToEdit.categoryId === 'wc') {
        const r = form.querySelector(`input[name="wc-type"][value="${eventToEdit.details?.wcType || 'Küçük (İdrar)'}"]`);
        if (r) r.checked = true;
        const cond = document.getElementById('wc-condition');
        if (cond) cond.value = eventToEdit.details?.wcCondition || 'Normal';
      } else if (eventToEdit.categoryId === 'headache') {
        const hSlider = document.getElementById('headache-intensity');
        if (hSlider) {
          hSlider.value = eventToEdit.details?.intensity || 5;
          hSlider.dispatchEvent(new Event('input'));
        }
        const loc = document.getElementById('headache-location');
        if (loc) loc.value = eventToEdit.details?.location || 'Şakaklar';
        const trig = document.getElementById('headache-trigger');
        if (trig) trig.value = eventToEdit.details?.trigger || 'Bilinmiyor';
        const medTaken = document.getElementById('headache-med-taken');
        if (medTaken) {
          medTaken.checked = !!eventToEdit.details?.medTaken;
          medTaken.dispatchEvent(new Event('change'));
        }
        if (medNameInput) medNameInput.value = eventToEdit.details?.medName || '';
      } else if (eventToEdit.categoryId === 'sport') {
        const spType = document.getElementById('sport-type');
        if (spType) spType.value = eventToEdit.details?.sportType || 'Yürüyüş';
        const spDur = document.getElementById('sport-duration');
        if (spDur) spDur.value = eventToEdit.details?.duration || eventToEdit.details?.quantity || 30;
        const spInt = form.querySelector(`input[name="sport-intensity"][value="${eventToEdit.details?.intensityLevel || 'Orta Seviye'}"]`);
        if (spInt) spInt.checked = true;
      } else if (eventToEdit.categoryId === 'massage') {
        const mArea = document.getElementById('massage-area');
        if (mArea) mArea.value = eventToEdit.details?.massageArea || 'Boyun & Omuz';
        const mDur = document.getElementById('massage-duration');
        if (mDur) mDur.value = eventToEdit.details?.duration || eventToEdit.details?.quantity || 20;
        const mSlider = document.getElementById('massage-relief');
        if (mSlider) {
          mSlider.value = eventToEdit.details?.reliefScore || eventToEdit.details?.intensity || 8;
          mSlider.dispatchEvent(new Event('input'));
        }
        const mProv = document.getElementById('massage-provider');
        if (mProv) mProv.value = eventToEdit.details?.provider || 'Kendim';
      } else if (eventToEdit.categoryId === 'period') {
        const pFlow = form.querySelector(`input[name="period-flow"][value="${eventToEdit.details?.flow || 'Orta (Medium)'}"]`);
        if (pFlow) pFlow.checked = true;

        const pCramps = document.getElementById('period-cramps');
        if (pCramps) {
          pCramps.value = eventToEdit.details?.cramps || eventToEdit.details?.intensity || 3;
          pCramps.dispatchEvent(new Event('input'));
        }

        const pPhase = document.getElementById('period-phase');
        if (pPhase) pPhase.value = eventToEdit.details?.phase || 'Regl (Adet Günü)';

        const pProtection = document.getElementById('period-protection');
        if (pProtection) pProtection.value = eventToEdit.details?.protection || 'Hijyenik Ped';

        const savedSymptoms = new Set(eventToEdit.details?.symptoms || []);
        document.querySelectorAll('#period-symptoms-cloud .symptom-tag').forEach(tag => {
          if (savedSymptoms.has(tag.dataset.val)) {
            tag.classList.add('active');
          } else {
            tag.classList.remove('active');
          }
        });

        const pMedTaken = document.getElementById('period-med-taken');
        if (pMedTaken) {
          pMedTaken.checked = !!eventToEdit.details?.medTaken;
          pMedTaken.dispatchEvent(new Event('change'));
        }
        const pMedName = document.getElementById('period-med-name');
        if (pMedName) pMedName.value = eventToEdit.details?.medName || '';
      } else {
        if (eventToEdit.details?.intensity) {
          const gSlider = document.getElementById('generic-intensity');
          if (gSlider) {
            gSlider.value = eventToEdit.details.intensity;
            gSlider.dispatchEvent(new Event('input'));
          }
        }
        if (eventToEdit.details?.quantity !== undefined) {
          const qty = document.getElementById('generic-quantity');
          if (qty) qty.value = eventToEdit.details.quantity;
        }
      }

      // Durumu doldur (Yapıldı vs Randevu)
      const statusVal = eventToEdit.status || 'completed';
      const statusRadio = form.querySelector(`input[name="event-status"][value="${statusVal}"]`);
      if (statusRadio) statusRadio.checked = true;
      const hintBox = document.getElementById('status-hint-box');
      if (hintBox) hintBox.style.display = statusVal === 'planned' ? 'block' : 'none';

    } else {
      // Yeni Ekleme Modu
      this.activeEditingEventId = null;
      modalTitle.textContent = 'Yeni Olay Kaydet';
      if (delBtn) delBtn.style.display = 'none';

      document.getElementById('event-edit-id').value = '';
      if (dateInput) dateInput.value = defaultDateStr || Calendar.selectedDateStr || todayStr;
      if (timeInput) timeInput.value = currentTimeStr;
      if (notesInput) notesInput.value = '';

      const targetCatId = defaultCategoryId || 'wc';
      CategoryManager.renderModalCategoryPills(targetCatId);

      // Baş ağrısı slider varsayılanı tetikle
      const hSlider = document.getElementById('headache-intensity');
      if (hSlider) {
        hSlider.value = 5;
        hSlider.dispatchEvent(new Event('input'));
      }
      // Masaj slider varsayılanı tetikle
      const mSlider = document.getElementById('massage-relief');
      if (mSlider) {
        mSlider.value = 8;
        mSlider.dispatchEvent(new Event('input'));
      }
      // Adet döngüsü varsayılanları sıfırla
      const defFlow = form.querySelector('input[name="period-flow"][value="Orta (Medium)"]');
      if (defFlow) defFlow.checked = true;
      const pCramps = document.getElementById('period-cramps');
      if (pCramps) {
        pCramps.value = 3;
        pCramps.dispatchEvent(new Event('input'));
      }
      document.querySelectorAll('#period-symptoms-cloud .symptom-tag').forEach(tag => tag.classList.remove('active'));
      const pMedTaken = document.getElementById('period-med-taken');
      if (pMedTaken) {
        pMedTaken.checked = false;
        pMedTaken.dispatchEvent(new Event('change'));
      }
      const pMedName = document.getElementById('period-med-name');
      if (pMedName) pMedName.value = '';

      // Başlangıç durumunu ayarla (Gelecek gün seçildiyse varsayılan Randevu)
      const isFutureDate = (dateInput.value > todayStr) || (dateInput.value === todayStr && timeInput.value > currentTimeStr);
      const initialStatus = isFutureDate ? 'planned' : 'completed';
      const statusRadio = form.querySelector(`input[name="event-status"][value="${initialStatus}"]`);
      if (statusRadio) statusRadio.checked = true;
      const hintBox = document.getElementById('status-hint-box');
      if (hintBox) hintBox.style.display = initialStatus === 'planned' ? 'block' : 'none';
    }

    try {
      modal.showModal();
    } catch (e) {
      modal.setAttribute('open', '');
      modal.style.display = 'flex';
    }
  },

  // Modal Verisini Kaydet
  saveEventFromModal() {
    const editId = document.getElementById('event-edit-id')?.value || '';
    const catId = document.getElementById('event-category')?.value || 'wc';
    const dateInput = document.getElementById('event-date');
    const timeInput = document.getElementById('event-time');
    const notesInput = document.getElementById('event-notes');

    const date = dateInput ? dateInput.value : Calendar.formatDate(new Date());
    const time = timeInput ? timeInput.value : '12:00';
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!catId || !date) {
      alert('Lütfen zorunlu alanları (Kategori ve Tarih) doldurun.');
      return false;
    }

    const details = {};

    if (catId === 'wc') {
      const selectedType = document.querySelector('input[name="wc-type"]:checked')?.value || 'Küçük (İdrar)';
      const cond = document.getElementById('wc-condition')?.value || 'Normal';
      details.wcType = selectedType;
      details.wcCondition = cond;
    } else if (catId === 'headache') {
      const intensity = parseInt(document.getElementById('headache-intensity')?.value, 10) || 5;
      const location = document.getElementById('headache-location')?.value || '';
      const trigger = document.getElementById('headache-trigger')?.value || '';
      const medTaken = document.getElementById('headache-med-taken')?.checked || false;
      const medName = document.getElementById('headache-med-name')?.value.trim() || '';

      details.intensity = intensity;
      details.location = location;
      details.trigger = trigger;
      details.medTaken = medTaken;
      if (medTaken) details.medName = medName;
    } else if (catId === 'sport') {
      const spType = document.getElementById('sport-type')?.value || 'Yürüyüş';
      const spDur = parseInt(document.getElementById('sport-duration')?.value, 10) || 30;
      const spInt = document.querySelector('input[name="sport-intensity"]:checked')?.value || 'Orta Seviye';
      details.sportType = spType;
      details.duration = spDur;
      details.intensityLevel = spInt;
      details.quantity = spDur;
      details.unit = 'dk';
    } else if (catId === 'massage') {
      const mArea = document.getElementById('massage-area')?.value || 'Boyun & Omuz';
      const mDur = parseInt(document.getElementById('massage-duration')?.value, 10) || 20;
      const mRelief = parseInt(document.getElementById('massage-relief')?.value, 10) || 8;
      const mProv = document.getElementById('massage-provider')?.value || 'Kendim';
      details.massageArea = mArea;
      details.duration = mDur;
      details.reliefScore = mRelief;
      details.provider = mProv;
      details.intensity = mRelief;
      details.quantity = mDur;
      details.unit = 'dk';
    } else if (catId === 'period') {
      const flow = document.querySelector('input[name="period-flow"]:checked')?.value || 'Orta (Medium)';
      const cramps = parseInt(document.getElementById('period-cramps')?.value, 10) || 3;
      const phase = document.getElementById('period-phase')?.value || 'Regl (Adet Günü)';
      const protection = document.getElementById('period-protection')?.value || 'Hijyenik Ped';
      const symptoms = Array.from(document.querySelectorAll('#period-symptoms-cloud .symptom-tag.active')).map(b => b.dataset.val);
      const medTaken = document.getElementById('period-med-taken')?.checked || false;
      const medName = document.getElementById('period-med-name')?.value.trim() || '';

      details.flow = flow;
      details.cramps = cramps;
      details.intensity = cramps;
      details.phase = phase;
      details.protection = protection;
      details.symptoms = symptoms;
      details.medTaken = medTaken;
      if (medTaken) details.medName = medName;
    } else {
      const cat = Storage.getCategoryById(catId);
      if (cat?.hasIntensity) {
        details.intensity = parseInt(document.getElementById('generic-intensity')?.value, 10) || 5;
      }
      if (cat?.hasQuantity) {
        const qtyVal = document.getElementById('generic-quantity')?.value;
        if (qtyVal !== '' && qtyVal !== undefined) details.quantity = parseFloat(qtyVal);
        details.unit = cat?.unit || '';
      }
    }

    const status = document.querySelector('input[name="event-status"]:checked')?.value || 'completed';

    const eventData = {
      id: editId || undefined,
      categoryId: catId,
      date,
      time,
      status,
      reminderSent: editId ? (Storage.getEvents().find(e => e.id === editId)?.reminderSent || false) : false,
      checkinPrompted: editId ? (Storage.getEvents().find(e => e.id === editId)?.checkinPrompted || false) : false,
      details,
      notes
    };

    if (editId) {
      Storage.updateEvent(eventData);
      showToast('Kayıt başarıyla güncellendi.', 'success');
    } else {
      Storage.addEvent(eventData);
      const isPlanned = status === 'planned';
      const msg = isPlanned 
        ? 'Randevu takvime eklendi! (1 saat önce sessiz bildirim alacaksınız ⏰)' 
        : 'Yeni olay takvime kaydedildi!';
      showToast(msg, 'success');
    }

    this.refreshAllViews();
    return true;
  },

  // ================= 5. TÜM KAYITLAR LİSTESİ =================
  setupAllEventsListView() {
    const searchInput = document.getElementById('list-search-query');
    const filterCat = document.getElementById('list-filter-category');
    const sortSelect = document.getElementById('list-sort');

    if (searchInput) searchInput.addEventListener('input', () => this.renderAllEventsList());
    if (filterCat) filterCat.addEventListener('change', () => this.renderAllEventsList());
    if (sortSelect) sortSelect.addEventListener('change', () => this.renderAllEventsList());
  },

  renderAllEventsList() {
    const tbody = document.getElementById('all-events-tbody');
    const emptyState = document.getElementById('list-empty-state');
    if (!tbody) return;

    tbody.innerHTML = '';

    const query = (document.getElementById('list-search-query')?.value || '').toLowerCase();
    const catFilter = document.getElementById('list-filter-category')?.value || 'all';
    const sortMode = document.getElementById('list-sort')?.value || 'date-desc';

    let events = Storage.getEvents();

    // Filtreleme
    events = events.filter(e => {
      const matchCat = (catFilter === 'all') || (e.categoryId === catFilter);
      if (!matchCat) return false;

      if (!query) return true;

      const cat = Storage.getCategoryById(e.categoryId);
      const textToSearch = [
        e.date,
        e.time,
        cat.name,
        e.notes,
        e.details?.wcType,
        e.details?.wcCondition,
        e.details?.location,
        e.details?.trigger,
        e.details?.medName
      ].filter(Boolean).join(' ').toLowerCase();

      return textToSearch.includes(query);
    });

    // Sıralama
    events.sort((a, b) => {
      if (sortMode === 'date-desc') {
        return `${b.date}T${b.time || '00:00'}`.localeCompare(`${a.date}T${a.time || '00:00'}`);
      } else if (sortMode === 'date-asc') {
        return `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`);
      } else if (sortMode === 'intensity-desc') {
        const intA = a.details?.intensity || 0;
        const intB = b.details?.intensity || 0;
        return intB - intA;
      }
      return 0;
    });

    if (events.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    } else {
      if (emptyState) emptyState.style.display = 'none';
    }

    events.forEach(e => {
      const cat = Storage.getCategoryById(e.categoryId);
      const tr = document.createElement('tr');

      let subDetail = '-';
      let valueStr = '-';
      let noteAndTrigger = e.notes || '-';

      if (e.categoryId === 'wc') {
        subDetail = `${e.details?.wcType || 'WC'} (${e.details?.wcCondition || 'Normal'})`;
      } else if (e.categoryId === 'headache') {
        subDetail = `${e.details?.location || 'Belirtilmedi'}`;
        const intVal = e.details?.intensity || 5;
        let bClass = intVal >= 7 ? 'level-10' : (intVal >= 4 ? 'level-5' : 'level-1');
        valueStr = `<span class="intensity-badge ${bClass}">${intVal}/10 Şiddet</span>`;
        if (e.details?.medTaken) {
          valueStr += `<br><small style="color:var(--success);">İlaç: ${e.details?.medName || 'Alındı'}</small>`;
        }
        if (e.details?.trigger) {
          noteAndTrigger = `<strong>Tetikleyici:</strong> ${e.details.trigger} ${e.notes ? ` &bull; ${e.notes}` : ''}`;
        }
      } else if (e.categoryId === 'sport') {
        subDetail = `${e.details?.sportType || 'Spor'} (${e.details?.duration || 30} dk)`;
        valueStr = `<span style="color:var(--success); font-weight:700;">${e.details?.intensityLevel || 'Orta Seviye'}</span>`;
      } else if (e.categoryId === 'massage') {
        subDetail = `${e.details?.massageArea || 'Masaj'} (${e.details?.duration || 20} dk)`;
        const rScore = e.details?.reliefScore || e.details?.intensity || 8;
        valueStr = `<span class="intensity-badge level-7">Rahatlama: ${rScore}/10</span>`;
        if (e.details?.provider) {
          noteAndTrigger = `<strong>Uygulayan:</strong> ${e.details.provider} ${e.notes ? ` &bull; ${e.notes}` : ''}`;
        }
      } else if (e.categoryId === 'period') {
        subDetail = `${e.details?.flow || 'Orta'} (${e.details?.phase || 'Döngü'})`;
        const cScore = e.details?.cramps || e.details?.intensity || 3;
        let bClass = cScore >= 7 ? 'level-10' : (cScore >= 4 ? 'level-5' : 'level-1');
        valueStr = `<span class="intensity-badge ${bClass}">Sancı: ${cScore}/10</span>`;
        if (e.details?.symptoms && e.details.symptoms.length > 0) {
          noteAndTrigger = `<strong>Semptomlar:</strong> ${e.details.symptoms.join(', ')} ${e.notes ? ` &bull; ${e.notes}` : ''}`;
        }
        if (e.details?.medTaken) {
          valueStr += `<br><small style="color:var(--success);">İlaç: ${e.details?.medName || 'Alındı'}</small>`;
        }
      } else {
        if (e.details?.intensity) {
          valueStr = `<span class="intensity-badge level-5">${e.details.intensity}/10</span>`;
        }
        if (e.details?.quantity !== undefined) {
          subDetail = `${e.details.quantity} ${cat.unit || ''}`;
        }
      }

      // Durum rozeti oluştur
      let statusHtml = '';
      if (e.status === 'planned') {
        statusHtml = `<div style="margin-top:4px;"><span class="status-badge badge-planned">⏳ Randevu / Plan</span></div>`;
      } else if (e.status === 'skipped') {
        statusHtml = `<div style="margin-top:4px;"><span class="status-badge badge-skipped">❌ Yapılmadı</span></div>`;
      } else {
        const isSpOrMas = (e.categoryId === 'sport' || e.categoryId === 'massage');
        statusHtml = `<div style="margin-top:4px;"><span class="status-badge badge-completed">${isSpOrMas ? '✅ Yapıldı & Bitti' : '✅ Tamamlandı'}</span></div>`;
      }

      // Hızlı onay butonları (randevu ise)
      let quickCheckinBtns = '';
      if (e.status === 'planned') {
        quickCheckinBtns = `
          <button class="btn btn-sm btn-success btn-row-mark-complete" title="Hemen Yapıldı Olarak İşaretle">✅</button>
          <button class="btn btn-sm btn-outline btn-row-mark-skip" title="Yapılmadı / İptal">❌</button>
        `;
      }

      tr.innerHTML = `
        <td>
          <strong>${e.date}</strong> <span style="color:var(--text-muted); font-size:0.8rem;">${e.time || ''}</span>
          ${statusHtml}
        </td>
        <td>
          <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600;">
            <span style="background:${cat.color}; color:#fff; width:22px; height:22px; border-radius:4px; display:inline-flex; align-items:center; justify-content:center; font-size:0.8rem;">${cat.icon}</span>
            ${cat.name}
          </span>
        </td>
        <td>${subDetail}</td>
        <td>${valueStr}</td>
        <td><small>${noteAndTrigger}</small></td>
        <td>
          <div style="display:flex; gap:6px; align-items:center;">
            ${quickCheckinBtns}
            <button class="btn btn-sm btn-outline btn-edit-row" title="Düzenle">✏️</button>
            <button class="btn btn-sm btn-outline btn-del-row" style="color:var(--danger);" title="Sil">🗑️</button>
          </div>
        </td>
      `;

      const rowDoneBtn = tr.querySelector('.btn-row-mark-complete');
      if (rowDoneBtn) {
        rowDoneBtn.addEventListener('click', () => {
          Storage.setEventStatus(e.id, 'completed');
          this.refreshAllViews();
          showToast(`"${cat.name}" başarıyla YAPILDI olarak kaydedildi! 🎉`, 'success');
        });
      }

      const rowSkipBtn = tr.querySelector('.btn-row-mark-skip');
      if (rowSkipBtn) {
        rowSkipBtn.addEventListener('click', () => {
          Storage.setEventStatus(e.id, 'skipped');
          this.refreshAllViews();
          showToast(`"${cat.name}" yapılmadı olarak işaretlendi.`, 'info');
        });
      }

      tr.querySelector('.btn-edit-row').addEventListener('click', () => {
        this.openEventModal(e);
      });

      tr.querySelector('.btn-del-row').addEventListener('click', () => {
        if (confirm(`Bu kaydı silmek istediğinize emin misiniz?`)) {
          Storage.deleteEvent(e.id);
          this.refreshAllViews();
          showToast('Kayıt silindi.', 'info');
        }
      });

      tbody.appendChild(tr);
    });
  },

  // ================= 6. YEDEKLEME & VERİ AKTARIMI =================
  setupBackupTab() {
    // Bulut Eşitleme (CloudSync) Butonları
    const startSyncBtn = document.getElementById('btn-start-cloud-sync');
    if (startSyncBtn) {
      startSyncBtn.addEventListener('click', async () => {
        startSyncBtn.disabled = true;
        const originalText = startSyncBtn.innerHTML;
        startSyncBtn.innerHTML = '🔄 Hazırlanıyor...';
        try {
          const syncObj = (typeof CloudSync !== 'undefined') ? CloudSync : window.CloudSync;
          if (syncObj && syncObj.startNewSync) {
            await syncObj.startNewSync();
          } else {
            alert('Bulut modülü henüz yüklenemedi. Lütfen sayfayı bir kez yenileyin.');
          }
        } catch (e) {
          console.error(e);
          alert('Bulut eşitleme hatası: ' + e.message);
        } finally {
          startSyncBtn.disabled = false;
          startSyncBtn.innerHTML = originalText;
        }
      });
    }

    const toggleEnterCodeBtn = document.getElementById('btn-toggle-enter-code');
    const inputContainer = document.getElementById('cloud-sync-input-container');
    if (toggleEnterCodeBtn && inputContainer) {
      toggleEnterCodeBtn.addEventListener('click', () => {
        const isHidden = inputContainer.style.display === 'none';
        inputContainer.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          const inp = document.getElementById('input-cloud-sync-code');
          if (inp) inp.focus();
        }
      });
    }

    const submitCodeBtn = document.getElementById('btn-submit-cloud-code');
    const codeInput = document.getElementById('input-cloud-sync-code');
    if (submitCodeBtn && codeInput) {
      submitCodeBtn.addEventListener('click', async () => {
        const val = codeInput.value.trim();
        if (!val) {
          alert('Lütfen eşitleme kodunu veya bağlantı linkini yapıştırın.');
          return;
        }
        submitCodeBtn.disabled = true;
        const orig = submitCodeBtn.innerHTML;
        submitCodeBtn.innerHTML = '🔄 Bağlanıyor...';
        try {
          const syncObj = (typeof CloudSync !== 'undefined') ? CloudSync : window.CloudSync;
          if (syncObj && syncObj.connectWithCode) {
            await syncObj.connectWithCode(val);
          }
        } finally {
          submitCodeBtn.disabled = false;
          submitCodeBtn.innerHTML = orig;
        }
      });
    }

    const copyLinkBtn = document.getElementById('btn-copy-sync-link');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        const syncObj = (typeof CloudSync !== 'undefined') ? CloudSync : window.CloudSync;
        if (syncObj && syncObj.copyShareLink) syncObj.copyShareLink();
      });
    }

    const manualSyncBtn = document.getElementById('btn-manual-sync-now');
    if (manualSyncBtn) {
      manualSyncBtn.addEventListener('click', () => {
        const syncObj = (typeof CloudSync !== 'undefined') ? CloudSync : window.CloudSync;
        if (syncObj && syncObj.syncNow) {
          syncObj.syncNow(true);
        } else if (syncObj && syncObj.pull) {
          syncObj.pull(true);
        }
      });
    }

    const pushNowBtn = document.getElementById('btn-push-now');
    if (pushNowBtn) {
      pushNowBtn.addEventListener('click', () => {
        const syncObj = (typeof CloudSync !== 'undefined') ? CloudSync : window.CloudSync;
        if (syncObj && syncObj.push) syncObj.push(true);
      });
    }

    const autoSyncToggle = document.getElementById('toggle-auto-sync');
    if (autoSyncToggle) {
      const syncObj = (typeof CloudSync !== 'undefined') ? CloudSync : window.CloudSync;
      if (syncObj) {
        autoSyncToggle.checked = syncObj.isAutoSyncEnabled();
        autoSyncToggle.addEventListener('change', (e) => {
          syncObj.setAutoSyncEnabled(e.target.checked);
          if (e.target.checked) {
            showToast('Arka planda otomatik eşitleme açıldı (Daha fazla şarj tüketebilir).', 'info');
          } else {
            showToast('🔋 Batarya Tasarrufu Modu aktif: Veriler sadece tuşa basınca eşitlenecektir.', 'success');
          }
        });
      }
    }

    const disconnectSyncBtn = document.getElementById('btn-disconnect-sync');
    if (disconnectSyncBtn) {
      disconnectSyncBtn.addEventListener('click', () => {
        const syncObj = (typeof CloudSync !== 'undefined') ? CloudSync : window.CloudSync;
        if (syncObj && syncObj.disconnect) syncObj.disconnect();
      });
    }

    const headerSyncBadge = document.getElementById('header-sync-badge');
    if (headerSyncBadge) {
      headerSyncBadge.addEventListener('click', () => {
        const syncObj = (typeof CloudSync !== 'undefined') ? CloudSync : window.CloudSync;
        if (syncObj && syncObj.hasActiveSync()) {
          syncObj.syncNow(true);
        } else {
          this.switchTab('backup');
          const heroCard = document.querySelector('.cloud-sync-hero-card');
          if (heroCard) {
            heroCard.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    }

    // JSON İndir
    const exportBtn = document.getElementById('btn-export-json');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        Storage.exportJSON();
        showToast('Yedek dosyası bilgisayarınıza indirildi.', 'success');
      });
    }

    // JSON İçe Aktar
    const triggerImportBtn = document.getElementById('btn-trigger-import');
    const importInput = document.getElementById('input-import-json');

    if (triggerImportBtn && importInput) {
      triggerImportBtn.addEventListener('click', () => {
        importInput.click();
      });

      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const res = Storage.importJSON(event.target.result);
          if (res.success) {
            this.refreshAllViews();
            showToast(`${res.count} adet kayıt başarıyla geri yüklendi!`, 'success');
          } else {
            alert('Hata: ' + res.error);
          }
          importInput.value = '';
        };
        reader.readAsText(file);
      });
    }

    // Demo Verisi Butonu 2
    const demoBtn2 = document.getElementById('btn-load-demo-2');
    if (demoBtn2) {
      demoBtn2.addEventListener('click', () => {
        this.loadDemo();
      });
    }

    // Demo Verilerini Temizle Butonu 2
    const clearDemoBtn2 = document.getElementById('btn-clear-demo-2');
    if (clearDemoBtn2) {
      clearDemoBtn2.addEventListener('click', () => {
        this.clearDemoData();
      });
    }

    // Tüm Verileri Temizle
    const clearBtn = document.getElementById('btn-clear-all-data');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('DİKKAT: Tüm kayıtlarınız ve özel kategorileriniz silinecektir! Devam etmek istiyor musunuz?')) {
          Storage.clearAllData();
          this.refreshAllViews();
          showToast('Tüm veriler temizlendi ve varsayılan ayarlara dönüldü.', 'info');
        }
      });
    }
  },

  // ================= 7. SESSİZ BİLDİRİM & RANDEVU TAKİP SİSTEMİ =================
  setupNotificationEngine() {
    const notifBtn = document.getElementById('btn-toggle-notif');
    const notifIcon = document.getElementById('notif-icon');

    const updateNotifState = () => {
      if (!('Notification' in window)) {
        if (notifBtn) notifBtn.style.display = 'none';
        return;
      }
      if (Notification.permission === 'granted') {
        if (notifIcon) notifIcon.textContent = '🔔';
        if (notifBtn) {
          notifBtn.title = 'Randevu bildirimleri açık (Etkinlikten 1 saat önce sessiz bildirim)';
          notifBtn.classList.add('active');
        }
      } else {
        if (notifIcon) notifIcon.textContent = '🔕';
        if (notifBtn) {
          notifBtn.title = 'Randevu bildirimlerini açmak için tıklayın';
          notifBtn.classList.remove('active');
        }
      }
    };

    updateNotifState();

    if (notifBtn) {
      notifBtn.addEventListener('click', async () => {
        if (!('Notification' in window)) {
          alert('Tarayıcınız masaüstü veya mobil bildirimleri desteklemiyor.');
          return;
        }

        if (Notification.permission === 'granted') {
          showToast('Randevu bildirimleri aktif durumda (1 saat önce sessiz bildirim gönderilir ⏰).', 'info');
        } else {
          try {
            const perm = await Notification.requestPermission();
            updateNotifState();
            if (perm === 'granted') {
              showToast('Randevu bildirimleri açıldı! Spor ve masaj saatlerinden 1 saat önce sessiz bildirim alacaksınız.', 'success');
              // Örnek ilk sessiz bildirim gönder
              try {
                new Notification('Sağlık Takvimi Aktif! ⏰', {
                  body: 'Randevularınızdan 1 saat önce bu şekilde sessiz bildirim alacaksınız (Alarm sesi çalmaz).',
                  icon: './icons/icon-192.png',
                  silent: true
                });
              } catch (e) {
                console.log('Bildirim önizleme hatası:', e);
              }
            } else {
              showToast('Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz.', 'info');
            }
          } catch (err) {
            console.error('Bildirim izin talebi hatası:', err);
          }
        }
      });
    }

    // Batarya Dostu Kontrol: Uygulama açılışında randevuları denetle
    this.checkScheduledAppointments();

    // Sekme tekrar odaklandığında veya ekrana gelindiğinde anında denetle
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkScheduledAppointments();
      }
    });

    // Nazik kontrol: Sadece sekme AÇIK ve GÖRÜNÜR durumdayken 5 dakikada bir kontrol (25 saniyelik agresif döngü kaldırıldı)
    if (!this._notifInterval) {
      this._notifInterval = setInterval(() => {
        if (!document.hidden) {
          this.checkScheduledAppointments();
        }
      }, 300000); // 5 dakika (25 saniye değil)
    }
  },

  // Randevu ve Onay Kontrol Motoru
  checkScheduledAppointments() {
    const events = Storage.getEvents();
    const now = new Date();
    const nowTs = now.getTime();
    let hasChanges = false;
    const pendingCheckins = [];

    events.forEach(event => {
      if (event.status !== 'planned') return;

      const eventDateStr = event.date;
      const eventTimeStr = event.time || '12:00';
      const eventDateTime = new Date(`${eventDateStr}T${eventTimeStr}:00`);
      const eventTs = eventDateTime.getTime();

      if (isNaN(eventTs)) return;

      const diffMs = eventTs - nowTs;
      const diffMinutes = Math.floor(diffMs / (60 * 1000));
      const cat = Storage.getCategoryById(event.categoryId);

      // KURAL 1: 1 SAAT ÖNCE SESSİZ BİLDİRİM (Alarm sesi çalmaz!)
      // Randevuya 60 dakika veya daha az kalmışsa ve henüz bildirim gitmediyse
      if (diffMinutes <= 60 && diffMinutes >= -120 && !event.reminderSent) {
        event.reminderSent = true;
        hasChanges = true;

        const catName = cat.name;
        const subInfo = event.details?.sportType || event.details?.massageArea || '';
        const title = `⏰ Hatırlatıcı: ${catName} (${eventTimeStr})`;
        const bodyText = `1 saat sonra randevunuz var! (${subInfo ? subInfo + ' - ' : ''}${eventDateStr} ${eventTimeStr})`;

        // Web Notification API ile SESSİZ bildirim (silent: true)
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(title, {
              body: bodyText,
              icon: './icons/icon-192.png',
              badge: './icons/icon-192.png',
              silent: true, // Kullanıcı isteği: Alarm çalmasın, sessiz bildirim olsun!
              tag: `reminder-${event.id}`
            });
          } catch (e) {
            console.log('Sessiz bildirim hatası:', e);
          }
        }

        // Uygulama içi görsel uyarı
        showToast(`⏰ Sessiz Hatırlatma: ${catName} randevunuza 1 saat kaldı! (${eventTimeStr})`, 'info');
      }

      // KURAL 2: 1 SAAT SONRA VE ETKİNLİK ZAMANINDA YAPILDI / YAPILMADI ONAYI
      // "spor ve masaj saatinden 1 saat sonra da yapılıp yapılmadıgına dair ısaretlememe ızın versın"
      const passedMinutes = Math.floor((nowTs - eventTs) / (60 * 1000));

      if (passedMinutes >= 0) {
        pendingCheckins.push({
          event,
          cat,
          passedMinutes
        });

        // Randevu saatinden 60 dakika (1 saat) geçtikten sonra onay bildirimi gönder
        if (passedMinutes >= 60 && !event.checkinPrompted) {
          event.checkinPrompted = true;
          hasChanges = true;

          const catName = cat.name;
          const title = `📋 Onay: ${catName} Yapıldı mı?`;
          const bodyText = `Saat ${eventTimeStr} randevunuzun üzerinden 1 saat geçti. Yapıldı veya yapılmadı olarak işaretleyebilirsiniz.`;

          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(title, {
                body: bodyText,
                icon: './icons/icon-192.png',
                silent: true,
                tag: `checkin-${event.id}`
              });
            } catch (e) {
              console.log('Onay bildirim hatası:', e);
            }
          }

          showToast(`📋 ${catName} saatinin üzerinden 1 saat geçti. Yapıldı mı? İşaretleyebilirsiniz.`, 'info');
        }
      }
    });

    if (hasChanges) {
      Storage.saveEvents(events);
    }

    // Ekranın üst kısmındaki onay bannerını güncelle
    this.renderCheckinBanner(pendingCheckins);
  },

  // Üst Onay Bannerını Çiz
  renderCheckinBanner(pendingList) {
    const banner = document.getElementById('checkin-alert-banner');
    if (!banner) return;

    if (!pendingList || pendingList.length === 0) {
      banner.style.display = 'none';
      banner.innerHTML = '';
      return;
    }

    // Onay bekleyen ilk randevuyu al
    const currentItem = pendingList[0];
    const e = currentItem.event;
    const cat = currentItem.cat;
    const remainingOtherCount = pendingList.length - 1;

    let subText = e.details?.sportType || e.details?.massageArea || '';
    if (subText) subText = ` (${subText})`;

    const otherBadge = remainingOtherCount > 0 
      ? ` <span style="font-size:0.75rem; background:rgba(245,158,11,0.2); padding:2px 6px; border-radius:10px; font-weight:700;">+${remainingOtherCount} diğer bekleyen</span>` 
      : '';

    banner.innerHTML = `
      <div class="banner-content">
        <span class="banner-icon">🔔</span>
        <div class="banner-text">
          <strong>Aktivite Onayı:</strong> 
          <span>${cat.icon} <strong>${cat.name}${subText}</strong> (${e.date} ${e.time || '12:00'}) yapıldı mı?</span>
          ${otherBadge}
        </div>
      </div>
      <div class="banner-actions">
        <button id="banner-btn-complete" class="btn btn-sm btn-success" title="Yapıldı olarak işaretle">
          ✅ Yapıldı
        </button>
        <button id="banner-btn-skip" class="btn btn-sm btn-outline" title="Yapılmadı olarak işaretle">
          ❌ Yapılmadı
        </button>
      </div>
    `;
    banner.style.display = 'flex';

    const btnComp = document.getElementById('banner-btn-complete');
    if (btnComp) {
      btnComp.addEventListener('click', () => {
        Storage.setEventStatus(e.id, 'completed');
        showToast(`"${cat.name}" başarıyla YAPILDI olarak onaylandı! 🎉`, 'success');
        this.refreshAllViews();
      });
    }

    const btnSkip = document.getElementById('banner-btn-skip');
    if (btnSkip) {
      btnSkip.addEventListener('click', () => {
        Storage.setEventStatus(e.id, 'skipped');
        showToast(`"${cat.name}" yapılmadı olarak işaretlendi.`, 'info');
        this.refreshAllViews();
      });
    }
  }
};

// Sayfa yüklendiğinde başlat
window.addEventListener('DOMContentLoaded', () => {
  window.App = App;
  try {
    App.init();
  } catch (err) {
    console.error('App.init kritik hata:', err);
    try {
      CategoryManager.init();
      Calendar.init();
    } catch (e2) {
      console.error('Kurtarma hatası:', e2);
    }
  }

  // PWA Service Worker Kaydı (Mobil Çevrimdışı Çalışma & Anında Güncelleme)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.update();
    }).catch((err) => {
      console.log('SW kayıt durumu:', err);
    });
  }
});
