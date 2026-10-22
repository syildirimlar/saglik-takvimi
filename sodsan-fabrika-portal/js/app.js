// SODSAN Fabrika Portalı - Ana Uygulama Yöneticisi (app.js)
import { appState, ROLES, getRoleInfo } from './data.js';
import { CalendarModule } from './calendar.js';
import { ProductsModule } from './products.js';
import { SuppliesModule } from './supplies.js';
import { LeaveModule } from './leave.js';
import { OvertimeModule } from './overtime.js';
import { ForkliftModule } from './forklift.js';
import { BreakdownModule } from './breakdown.js';
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
    this.updateUserSessionUI();
    this.initTabs();
    this.initModals();
    this.initAuth();

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

  updateUserSessionUI() {
    const user = appState.state.currentUser;
    const nameEl = document.getElementById("current-user-name");
    const roleEl = document.getElementById("current-user-role");
    const deptEl = document.getElementById("current-user-dept");

    if (nameEl) nameEl.textContent = user.name;
    
    const roleInfo = getRoleInfo(user.role);
    if (roleEl) {
      roleEl.textContent = roleInfo.title;
      roleEl.className = `text-[11px] font-bold px-2 py-0.5 rounded ${roleInfo.badge || 'bg-slate-100 text-slate-800'}`;
    }

    const dep = appState.state.departments.find(d => d.id === user.departmentId);
    if (deptEl) {
      deptEl.textContent = dep ? `${dep.icon} ${dep.name}` : "";
    }

    // Yetki bazlı sekmeleri gizle/göster
    const adminTabBtn = document.querySelector('[data-tab="tab-admin"]');
    if (adminTabBtn) {
      if (user.role === "ADMIN") {
        adminTabBtn.style.display = "inline-flex";
      } else {
        adminTabBtn.style.display = "none";
        if (this.activeTab === "tab-admin") {
          this.switchTab("tab-products");
        }
      }
    }
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
    const btnSwitchUser = document.getElementById("btn-switch-user");
    const modalSwitch = document.getElementById("modal-switch-user");
    const userListContainer = document.getElementById("quick-user-list");

    if (btnSwitchUser && modalSwitch && userListContainer) {
      btnSwitchUser.addEventListener("click", () => {
        // Hızlı kullanıcı değiştirme listesini oluştur
        userListContainer.innerHTML = appState.state.users.map(u => {
          const dep = appState.state.departments.find(d => d.id === u.departmentId) || { name: "" };
          const roleInfo = getRoleInfo(u.role);
          const isCurrent = u.id === appState.state.currentUser.id;

          return `
            <button data-select-user-id="${u.id}" class="w-full text-left p-3 rounded-xl border ${isCurrent ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'} transition flex items-center justify-between">
              <div>
                <div class="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  ${u.name}
                  ${isCurrent ? '<span class="text-[10px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded">Aktif</span>' : ''}
                </div>
                <div class="text-xs text-slate-500 mt-0.5">${dep.name} &bull; <b class="text-slate-700">${roleInfo.title}</b></div>
              </div>
              <span class="text-xs font-semibold text-blue-600">Giriş Yap &rarr;</span>
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
              // Tüm panelleri tazele
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
}

// Uygulamayı DOM hazır olunca ayağa kaldır
document.addEventListener("DOMContentLoaded", () => {
  window.portalApp = new App();
  window.portalApp.init();
});
