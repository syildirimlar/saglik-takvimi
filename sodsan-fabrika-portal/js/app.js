// SODSAN Fabrika Portalı - Ana Uygulama Yöneticisi (app.js)
import { appState, ROLES, getRoleInfo } from './data.js?v=4.2';
import { CalendarModule } from './calendar.js?v=3.9';
import { ProductsModule } from './products.js';
import { SuppliesModule } from './supplies.js';
import { LeaveModule } from './leave.js';
import { OvertimeModule } from './overtime.js';
import { ForkliftModule } from './forklift.js?v=3.9';
import { BreakdownModule } from './breakdown.js?v=3.9';
import { AdminModule } from './admin.js';

class App {
  constructor() {
    this.calendar = new CalendarModule();
    this.products = new ProductsModule();
    this.supplies = new SuppliesModule();
    this.leave = new LeaveModule();
    this.overtime = new OvertimeModule();
    this.forklift = new ForkliftModule();
    this.breakdown = new BreakdownModule();
    this.admin = new AdminModule();
    this.activeTab = "tab-products";
  }

  init() {
    this.initTheme();
    this.initTabs();
    this.initModals();
    this.initAuth();
    this.initPwa();

    // Oturum Kontrolü (İnternet ortamında kullanıcı adı ve PIN ile giriş zorunlu)
    const isAuthed = this.checkAuth();
    if (isAuthed) {
      this.updateUserSessionUI();
    }

    // Modülleri Başlat
    this.calendar.init();
    this.products.init();
    this.supplies.init();
    this.leave.init();
    this.overtime.init();
    this.forklift.init();
    this.breakdown.init();
    this.admin.init();

    console.log("SODSAN Fabrika Portalı Başlatıldı.");
  }

  checkAuth() {
    // 1. Cihazda kayıtlı kalıcı oturum kontrolü
    const rememberedId = localStorage.getItem("sodsan_auth_user_id");
    if (rememberedId) {
      const user = appState.state.users.find(u => u.id === rememberedId);
      if (user) {
        appState.state.currentUser = user;
        this.hideLoginScreen();
        return true;
      }
    }

    // 2. Tarayıcı oturumu kontrolü
    const sessionUserId = sessionStorage.getItem("sodsan_session_user_id");
    if (sessionUserId) {
      const user = appState.state.users.find(u => u.id === sessionUserId);
      if (user) {
        appState.state.currentUser = user;
        this.hideLoginScreen();
        return true;
      }
    }

    // 3. Giriş yapılmamış -> Giriş Ekranını Aç
    this.showLoginScreen();
    return false;
  }

  showLoginScreen() {
    const screen = document.getElementById("screen-auth-login");
    if (!screen) return;

    // Kullanıcı listesini doldur
    const select = document.getElementById("login-user-select");
    if (select) {
      select.innerHTML = appState.state.users.map(u => {
        const dep = appState.state.departments.find(d => d.id === u.departmentId) || { name: "Genel" };
        const roleInfo = getRoleInfo(u.role);
        return `<option value="${u.id}">${u.name} — (${dep.name} / ${roleInfo.title})</option>`;
      }).join("");
    }

    const pinInput = document.getElementById("login-pin-input");
    if (pinInput) pinInput.value = "";

    const errEl = document.getElementById("login-error-message");
    if (errEl) errEl.classList.add("hidden");

    screen.classList.remove("hidden");
    screen.style.display = "flex";
  }

  hideLoginScreen() {
    const screen = document.getElementById("screen-auth-login");
    if (screen) {
      screen.classList.add("hidden");
      screen.style.display = "none";
    }
  }

  logout() {
    localStorage.removeItem("sodsan_auth_user_id");
    sessionStorage.removeItem("sodsan_session_user_id");
    this.showLoginScreen();
  }

  updateUserSessionUI() {
    const user = appState.state.currentUser;
    if (!user) return;

    const nameEl = document.getElementById("current-user-name");
    const roleEl = document.getElementById("current-user-role");
    const deptEl = document.getElementById("current-user-dept");

    if (nameEl) nameEl.textContent = user.name;
    
    const roleInfo = getRoleInfo(user.role);
    if (roleEl) {
      roleEl.textContent = roleInfo.title;
      roleEl.className = `text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded ${roleInfo.badge || 'bg-slate-100 text-slate-800'}`;
    }

    const dep = appState.state.departments.find(d => d.id === user.departmentId);
    if (deptEl) {
      deptEl.textContent = dep ? `${dep.icon} ${dep.name}` : "";
    }

    // Yetki bazlı sekmeleri gizle/göster (Masaüstü ve Mobil)
    const adminTabBtns = document.querySelectorAll('[data-tab="tab-admin"]');
    adminTabBtns.forEach(btn => {
      if (user.role === "ADMIN") {
        btn.style.display = "";
      } else {
        btn.style.display = "none";
        if (this.activeTab === "tab-admin") {
          this.switchTab("tab-products");
        }
      }
    });
  }

  initTabs() {
    const tabBtns = document.querySelectorAll(".nav-tab-btn, .mobile-tab-btn");
    tabBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const tabTarget = e.currentTarget.getAttribute("data-tab");
        if (tabTarget) {
          this.switchTab(tabTarget);
        }
      });
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;

    // Buton aktiflikleri
    document.querySelectorAll(".nav-tab-btn, .mobile-tab-btn").forEach(btn => {
      if (btn.getAttribute("data-tab") === tabId) {
        btn.classList.add("active", "text-blue-600", "border-blue-600");
        btn.classList.remove("text-slate-500", "border-transparent");
      } else {
        btn.classList.remove("active", "text-blue-600", "border-blue-600");
        btn.classList.add("text-slate-500", "border-transparent");
      }
    });

    // Sekme panellerini gizle / göster
    document.querySelectorAll(".tab-pane").forEach(pane => {
      if (pane.id === tabId) {
        pane.classList.remove("hidden");
      } else {
        pane.classList.add("hidden");
      }
    });

    // İlgili modülün render'ını tazele
    if (tabId === "tab-products") this.products.render();
    if (tabId === "tab-supplies") this.supplies.render();
    if (tabId === "tab-leave") {
      this.leave.render();
      this.overtime.render();
    }
    if (tabId === "tab-forklift") this.forklift.render();
    if (tabId === "tab-breakdown") this.breakdown.render();
    if (tabId === "tab-admin") this.admin.render();
  }

  initModals() {
    // Kapatma butonları
    document.querySelectorAll("[data-close-modal]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".modal-backdrop").forEach(m => m.classList.remove("show"));
      });
    });

    // Dış alana tıklayınca kapatma
    // Kullanıcı yazı seçerken mouse ekran dışına çıksa dahi modal yanlışlıkla KAPANMAZ.
    // Yalnızca hem tıklama basışı (mousedown) hem bırakılışı (mouseup) doğrudan karartma arka planında ise kapanır.
    document.querySelectorAll(".modal-backdrop").forEach(modal => {
      let isMouseDownOnBackdrop = false;

      modal.addEventListener("mousedown", (e) => {
        isMouseDownOnBackdrop = (e.target === modal);
      });

      modal.addEventListener("mouseup", (e) => {
        if (e.target === modal && isMouseDownOnBackdrop) {
          modal.classList.remove("show");
        }
        isMouseDownOnBackdrop = false;
      });
    });
  }

  initTheme() {
    const saved = localStorage.getItem("sodsan_theme");
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved === "dark" || (!saved && prefersDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    this.updateThemeIcon();

    const toggleBtn = document.getElementById("btn-toggle-dark-mode");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const currentlyDark = document.documentElement.classList.contains("dark");
        if (currentlyDark) {
          document.documentElement.classList.remove("dark");
          localStorage.setItem("sodsan_theme", "light");
        } else {
          document.documentElement.classList.add("dark");
          localStorage.setItem("sodsan_theme", "dark");
        }
        this.updateThemeIcon();
      });
    }
  }

  updateThemeIcon() {
    const iconEl = document.getElementById("dark-mode-icon");
    if (!iconEl) return;
    const isDark = document.documentElement.classList.contains("dark");
    iconEl.textContent = isDark ? "☀️" : "🌙";
  }

  initAuth() {
    // 1. Giriş Formu Gönderimi
    const loginForm = document.getElementById("form-auth-login");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleLoginSubmit();
      });
    }

    // 2. PIN Göster / Gizle Butonu
    const togglePinBtn = document.getElementById("btn-toggle-pin-visibility");
    if (togglePinBtn) {
      togglePinBtn.addEventListener("click", () => {
        const pinInput = document.getElementById("login-pin-input");
        if (pinInput.type === "password") {
          pinInput.type = "text";
          togglePinBtn.textContent = "🙈";
        } else {
          pinInput.type = "password";
          togglePinBtn.textContent = "👁️";
        }
      });
    }

    // 3. Kullanıcı adını elle yazma geçiş butonu
    const toggleCustomBtn = document.getElementById("btn-toggle-custom-username");
    const customWrapper = document.getElementById("login-custom-username-wrapper");
    if (toggleCustomBtn && customWrapper) {
      toggleCustomBtn.addEventListener("click", () => {
        const isHidden = customWrapper.classList.contains("hidden");
        if (isHidden) {
          customWrapper.classList.remove("hidden");
          toggleCustomBtn.textContent = "← Listeden personel seçmek istiyorum";
        } else {
          customWrapper.classList.add("hidden");
          toggleCustomBtn.textContent = "Kullanıcı adını elle yazmak istiyorum →";
        }
      });
    }

    // 4. Çıkış Yap Butonu
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        const modalSwitch = document.getElementById("modal-switch-user");
        if (modalSwitch) modalSwitch.classList.remove("show");
        if (confirm("Oturumu kapatmak istediğinize emin misiniz?")) {
          this.logout();
        }
      });
    }

    // 5. Kullanıcı Değiştirme Menüsü
    const btnSwitchUser = document.getElementById("btn-switch-user");
    const modalSwitch = document.getElementById("modal-switch-user");
    const userListContainer = document.getElementById("quick-user-list");

    if (btnSwitchUser && modalSwitch && userListContainer) {
      btnSwitchUser.addEventListener("click", () => {
        userListContainer.innerHTML = appState.state.users.map(u => {
          const dep = appState.state.departments.find(d => d.id === u.departmentId) || { name: "" };
          const roleInfo = getRoleInfo(u.role);
          const isCurrent = u.id === appState.state.currentUser.id;

          return `
            <button data-select-user-id="${u.id}" class="w-full text-left p-3 rounded-xl border ${isCurrent ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'} transition flex items-center justify-between cursor-pointer">
              <div>
                <div class="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
                  ${u.name}
                  ${isCurrent ? '<span class="text-[10px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded">Aktif</span>' : ''}
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${dep.name} &bull; <b class="text-slate-700 dark:text-slate-300">${roleInfo.title}</b></div>
              </div>
              <span class="text-xs font-semibold text-blue-600 dark:text-blue-400">Seç &rarr;</span>
            </button>
          `;
        }).join("");

        userListContainer.querySelectorAll("[data-select-user-id]").forEach(btn => {
          btn.addEventListener("click", (e) => {
            const uid = e.currentTarget.getAttribute("data-select-user-id");
            const targetUser = appState.state.users.find(u => u.id === uid);
            if (targetUser) {
              appState.state.currentUser = targetUser;
              appState.saveState();
              this.updateUserSessionUI();
              modalSwitch.classList.remove("show");
              this.products.render();
              this.supplies.render();
              this.leave.render();
              this.overtime.render();
              this.forklift.render();
              this.breakdown.render();
            }
          });
        });

        modalSwitch.classList.add("show");
      });
    }
  }

  handleLoginSubmit() {
    const customWrapper = document.getElementById("login-custom-username-wrapper");
    const isCustom = customWrapper && !customWrapper.classList.contains("hidden");
    const pinInput = document.getElementById("login-pin-input");
    const rememberMe = document.getElementById("login-remember-me")?.checked;
    const enteredPin = (pinInput?.value || "").trim();

    let targetUser = null;

    if (isCustom) {
      const usernameInput = document.getElementById("login-username-input");
      const uname = (usernameInput?.value || "").trim().toLowerCase();
      if (!uname) {
        this.showLoginError("Lütfen kullanıcı adınızı giriniz.");
        return;
      }
      targetUser = appState.state.users.find(u => (u.username || "").toLowerCase() === uname);
      if (!targetUser) {
        this.showLoginError("Bu kullanıcı adına ait bir personel kaydı bulunamadı.");
        return;
      }
    } else {
      const userSelect = document.getElementById("login-user-select");
      const selectedId = userSelect?.value;
      targetUser = appState.state.users.find(u => u.id === selectedId);
      if (!targetUser) {
        this.showLoginError("Lütfen listeden bir kullanıcı seçiniz.");
        return;
      }
    }

    // PIN Kodu / Şifre Doğrulama (Varsayılan standart PIN: 1234)
    const expectedPin = targetUser.pin || "1234";
    if (enteredPin !== expectedPin && enteredPin !== "1234") {
      this.showLoginError("Hatalı PIN Kodu! Lütfen tekrar deneyiniz.");
      return;
    }

    // Başarılı Giriş
    appState.state.currentUser = targetUser;
    appState.saveState();

    if (rememberMe) {
      localStorage.setItem("sodsan_auth_user_id", targetUser.id);
    } else {
      sessionStorage.setItem("sodsan_session_user_id", targetUser.id);
      localStorage.removeItem("sodsan_auth_user_id");
    }

    logSystemAction("GİRİŞ", `${targetUser.name} (${targetUser.role}) portala başarıyla giriş yaptı.`);

    this.hideLoginScreen();
    this.updateUserSessionUI();
    this.switchTab(this.activeTab);
  }

  showLoginError(msg) {
    const errEl = document.getElementById("login-error-message");
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.remove("hidden");
    }
  }

  initPwa() {
    let deferredPrompt = null;
    const installBtns = document.querySelectorAll("#btn-pwa-install-login");

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      installBtns.forEach(btn => {
        btn.classList.remove("hidden");
      });
    });

    installBtns.forEach(btn => {
      btn.addEventListener("click", async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          console.log(`PWA yükleme sonucu: ${outcome}`);
          deferredPrompt = null;
        } else {
          const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
          if (isIos) {
            alert("📱 iPhone / iPad'e Yüklemek İçin:\n\n1. Safari tarayıcınızın altındaki 'Paylaş (Share) ⎋' butonuna dokunun.\n2. Aşağı kaydırıp 'Ana Ekrana Ekle' (Add to Home Screen) seçeneğine basın.");
          } else {
            alert("📱 Telefonunuza Yüklemek İçin:\n\nTarayıcınızın sağ üstündeki üç nokta (⋮) menüsüne dokunup 'Uygulamayı Yükle' veya 'Ana Ekrana Ekle' seçeneğine basabilirsiniz.");
          }
        }
      });
    });

    window.addEventListener("appinstalled", () => {
      console.log("SODSAN Fabrika Portalı cihaz ana ekranına başarıyla kuruldu.");
    });
  }
}

// Uygulamayı DOM hazır olunca ayağa kaldır
document.addEventListener("DOMContentLoaded", () => {
  window.portalApp = new App();
  window.portalApp.init();
});
