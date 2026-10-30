// SODSAN Fabrika Portalı - Yemek Menüsü & Personel Servisleri Modülü (catering_shuttle.js)
import { appState, isManagerOrHr, logSystemAction, isAdmin, isViewer, isUserVisibleToCurrentSession } from './data.js';

export class CateringShuttleModule {
  constructor() {
    this.currentZoom = 1;
  }

  init() {
    this.bindEvents();
    this.render();
  }

  // Tüm kayıtlı personelleri (employees + users) tek listede birleştirir (Admin hariç)
  getFactoryEmployees() {
    const list = [];
    const seen = new Set();
    const isAdminPerson = (p) => p && (p.id === 'u_admin' || p.userId === 'u_admin' || String(p.role || '').toUpperCase() === 'ADMIN' || String(p.name || '').toLowerCase() === 'admin' || String(p.name || '').toLowerCase() === 'sistem yöneticisi');

    (appState.state.employees || []).forEach(emp => {
      if (emp && emp.name && emp.name.trim() && !isAdminPerson(emp)) {
        // Kural: İzleyici rolündeki çalışanlar yalnızca Admin tarafından görülebilir!
        if (!isAdmin() && (isViewer(emp) || isViewer(emp.role))) return;
        const key = emp.name.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          list.push(emp);
        }
      }
    });

    (appState.state.users || []).forEach(u => {
      if (u && u.name && u.name.trim() && !isAdminPerson(u)) {
        // Kural: İzleyici rolündeki kullanıcılar yalnızca Admin tarafından görülebilir!
        if (!isAdmin() && (isViewer(u) || isViewer(u.role))) return;
        const key = u.name.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            id: u.id,
            userId: u.id,
            name: u.name,
            role: u.role || "PERSONEL",
            departmentId: u.departmentId || "dep_genel"
          });
        }
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }

  bindEvents() {
    // 1. Üst Çubuk & Menü Hızlı Butonları: Yemek Menüsü
    document.querySelectorAll("[data-open-catering-menu]").forEach(btn => {
      btn.addEventListener("click", () => {
        this.openCateringModal();
      });
    });

    // 2. Üst Çubuk & Menü Hızlı Butonları: Servis Güzergahları
    document.querySelectorAll("[data-open-shuttle-info]").forEach(btn => {
      btn.addEventListener("click", () => {
        this.openShuttleModal();
      });
    });

    // 2b. Servis Anlık Konum Göster (Arvento) Butonları Tıklama Delegasyonu
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-show-live-shuttle]");
      if (btn) {
        const routeId = btn.getAttribute("data-show-live-shuttle");
        if (routeId) {
          this.openLiveLocationModal(routeId);
        }
      }
    });

    // 3. İK Alt Sekmeleri Tıklamaları (İzinler, Mesai, Yemek, Servis)
    const subtabBtnCatering = document.getElementById("subtab-btn-catering");
    const subtabBtnShuttle = document.getElementById("subtab-btn-shuttle");
    const subtabBtnLeave = document.getElementById("subtab-btn-leave");
    const subtabBtnOvertime = document.getElementById("subtab-btn-overtime");

    if (subtabBtnCatering) {
      subtabBtnCatering.addEventListener("click", () => {
        this.switchIkSubtab("catering");
      });
    }

    if (subtabBtnShuttle) {
      subtabBtnShuttle.addEventListener("click", () => {
        this.switchIkSubtab("shuttle");
      });
    }

    // 4. Admin Paneli: Yemek Şirketi Ayarları Formu
    const formCateringAdmin = document.getElementById("form-admin-catering-config");
    if (formCateringAdmin) {
      formCateringAdmin.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveCateringAdminConfig();
      });
    }

    // Admin Paneli: Şifre Göster/Gizle Butonu
    const btnToggleCateringPass = document.getElementById("btn-toggle-catering-pass");
    if (btnToggleCateringPass) {
      btnToggleCateringPass.addEventListener("click", () => {
        const passInput = document.getElementById("catering-admin-password");
        if (passInput) {
          passInput.type = passInput.type === "password" ? "text" : "password";
        }
      });
    }

    // Admin Paneli: Yemek Şirketi Sitesine Git Butonu
    const btnGoCateringSite = document.getElementById("btn-go-catering-site");
    if (btnGoCateringSite) {
      btnGoCateringSite.addEventListener("click", () => {
        this.openCateringWebsiteWithCredentials();
      });
    }

    // Admin Paneli: Görsel Dosya Seçimi (Base64)
    const fileCateringImage = document.getElementById("catering-admin-image-file");
    if (fileCateringImage) {
      fileCateringImage.addEventListener("change", (e) => {
        this.handleMenuImageUpload(e);
      });
    }

    // Menü Görselini Kaldırma Butonu
    const btnRemoveMenuImage = document.getElementById("btn-remove-menu-image");
    if (btnRemoveMenuImage) {
      btnRemoveMenuImage.addEventListener("click", () => {
        if (confirm("Kayıtlı yemek menüsü görselini kaldırmak istediğinize emin misiniz?")) {
          appState.state.cateringConfig.menuImage = "";
          appState.saveState();
          this.render();
          alert("Menü görseli kaldırıldı.");
        }
      });
    }

    // 5. Servis Ekleme & Düzenleme Butonları
    const btnOpenAddShuttle = document.getElementById("btn-open-add-shuttle");
    if (btnOpenAddShuttle) {
      btnOpenAddShuttle.addEventListener("click", () => {
        this.openAddShuttleModal();
      });
    }

    const formShuttle = document.getElementById("form-add-edit-shuttle");
    if (formShuttle) {
      formShuttle.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveShuttleRoute();
      });
    }

    // Servis Yolcu Seçiminde "Tümünü Seç / Temizle"
    const btnSelectAllPass = document.getElementById("btn-select-all-passengers");
    if (btnSelectAllPass) {
      btnSelectAllPass.addEventListener("click", () => {
        document.querySelectorAll("input[name='shuttle-passenger']").forEach(cb => {
          cb.checked = true;
        });
      });
    }

    const btnClearAllPass = document.getElementById("btn-clear-all-passengers");
    if (btnClearAllPass) {
      btnClearAllPass.addEventListener("click", () => {
        document.querySelectorAll("input[name='shuttle-passenger']").forEach(cb => {
          cb.checked = false;
        });
      });
    }

    // Servis Arama / Filtreleme
    const filterShuttleInput = document.getElementById("filter-shuttle-search");
    if (filterShuttleInput) {
      filterShuttleInput.addEventListener("input", () => {
        this.renderShuttleRoutesList();
      });
    }

    // Günlük Menü Satırı Ekleme (İsteğe Bağlı Yemek Çizelgesi)
    const btnAddDailyMeal = document.getElementById("btn-add-daily-meal");
    if (btnAddDailyMeal) {
      btnAddDailyMeal.addEventListener("click", () => {
        this.addDailyMealRow();
      });
    }
  }

  // İK Alt Sekmelerini Değiştirir
  switchIkSubtab(target) {
    const subtabs = [
      { id: "leave", btn: "subtab-btn-leave", pane: "subpane-leave" },
      { id: "overtime", btn: "subtab-btn-overtime", pane: "subpane-overtime" },
      { id: "catering", btn: "subtab-btn-catering", pane: "subpane-catering" },
      { id: "shuttle", btn: "subtab-btn-shuttle", pane: "subpane-shuttle" }
    ];

    subtabs.forEach(t => {
      const btnEl = document.getElementById(t.btn);
      const paneEl = document.getElementById(t.pane);

      if (t.id === target) {
        if (btnEl) {
          btnEl.classList.add("bg-white", "text-blue-700", "shadow-sm");
          btnEl.classList.remove("text-slate-600");
        }
        if (paneEl) paneEl.classList.remove("hidden");
      } else {
        if (btnEl) {
          btnEl.classList.remove("bg-white", "text-blue-700", "shadow-sm");
          btnEl.classList.add("text-slate-600");
        }
        if (paneEl) paneEl.classList.add("hidden");
      }
    });

    if (target === "catering") {
      this.renderCateringSection();
    } else if (target === "shuttle") {
      this.renderShuttleSection();
    } else if (target === "leave" && window.portalApp && window.portalApp.leave) {
      window.portalApp.leave.render();
    } else if (target === "overtime" && window.portalApp && window.portalApp.overtime) {
      window.portalApp.overtime.render();
    }
  }

  // ==========================================
  // YEMEK MENÜSÜ FONKSİYONLARI
  // ==========================================

  openCateringModal() {
    this.renderCateringModalContent();
    const modal = document.getElementById("modal-catering-menu");
    if (modal) {
      modal.classList.add("show");
    }
  }

  renderCateringModalContent() {
    const config = appState.state.cateringConfig || {};
    const titleEl = document.getElementById("modal-catering-title");
    const subtitleEl = document.getElementById("modal-catering-subtitle");
    const container = document.getElementById("modal-catering-image-container");
    const linkBtn = document.getElementById("modal-catering-website-btn");
    const todayBanner = document.getElementById("modal-catering-today-banner");
    const editBtn = document.getElementById("modal-catering-edit-btn");

    // Güvenlik Kuralı: Yemek şirketinin şifreli yönetim sayfasına personelin yeni sekmede açmasına kesinlikle izin verilmez!
    if (linkBtn) {
      linkBtn.classList.add("hidden");
      linkBtn.style.display = "none";
    }

    // Yalnızca içinde bulunduğumuz aktif ayın menüsünü göster
    const now = new Date();
    const currentYearMonth = now.toISOString().slice(0, 7); // Örn: "2026-10"
    const monthNamesTr = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const currentMonthName = monthNamesTr[now.getMonth()];
    const currentYear = now.getFullYear();
    const currentMonthTitle = `${currentMonthName} ${currentYear}`;

    if (titleEl) {
      titleEl.textContent = `🍽️ ${currentMonthTitle} Yemek Menüsü`;
    }

    if (subtitleEl) {
      subtitleEl.innerHTML = `Tedarikçi: <b class="text-slate-800 dark:text-slate-200">${config.companyName || "Kayra Yemek"}</b> &bull; SODSAN Fabrika Aylık Yemek Listesi`;
    }

    // Yetkili Güncelle Butonu (Sadece Admin ayarları açabilir)
    if (editBtn) {
      if (isAdmin()) {
        editBtn.classList.remove("hidden");
        editBtn.onclick = () => {
          const modal = document.getElementById("modal-catering-menu");
          if (modal) modal.classList.remove("show");
          if (window.portalApp) {
            window.portalApp.switchTab("tab-admin");
            const adminSection = document.getElementById("admin-catering-section");
            if (adminSection) {
              adminSection.scrollIntoView({ behavior: "smooth" });
              adminSection.classList.add("ring-2", "ring-blue-500");
              setTimeout(() => adminSection.classList.remove("ring-2", "ring-blue-500"), 2000);
            }
          }
        };
      } else {
        editBtn.classList.add("hidden");
      }
    }

    // Bugünün Tarihi
    const todayStr = now.toISOString().split("T")[0];

    // Sadece içinde bulunulan aya ait menü günlerini filtrele
    const monthDays = (config.menuDays || []).filter(d => d.date && d.date.startsWith(currentYearMonth));

    // Bugünün Yemekleri Banner'ı
    if (todayBanner) {
      const todayMeal = monthDays.find(m => m.date === todayStr);

      if (todayMeal && (todayMeal.soup || todayMeal.mainDish || (Array.isArray(todayMeal.items) && todayMeal.items.length > 0))) {
        const soup = todayMeal.soup || (todayMeal.items && todayMeal.items[0]) || "";
        const main = todayMeal.mainDish || (todayMeal.items && todayMeal.items[1]) || "";
        const side = todayMeal.sideDish || (todayMeal.items && todayMeal.items[2]) || "";
        const extra = todayMeal.extra || (todayMeal.items && todayMeal.items[3]) || "";

        todayBanner.classList.remove("hidden");
        todayBanner.innerHTML = `
          <div class="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-4 rounded-2xl shadow-md border border-emerald-500 flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <span class="text-3xl bg-white/20 p-2.5 rounded-xl flex-shrink-0">🍲</span>
              <div class="min-w-0">
                <div class="text-[11px] font-black uppercase tracking-wider text-emerald-100 flex items-center gap-2">
                  <span>⭐ BUGÜNÜN MENÜSÜ</span>
                  <span class="bg-white/25 px-2 py-0.5 rounded text-[10px] font-bold">${todayMeal.date} &bull; ${todayMeal.dayName || ''}</span>
                </div>
                <div class="text-xs sm:text-sm font-bold mt-1 flex flex-wrap gap-x-4 gap-y-1 text-white">
                  ${soup ? `<span>🥣 <b class="font-black">${soup}</b></span>` : ""}
                  ${main ? `<span>🥩 <b class="font-black">${main}</b></span>` : ""}
                  ${side ? `<span>🍚 <b class="font-black">${side}</b></span>` : ""}
                  ${extra ? `<span>🥗 <b class="font-black">${extra}</b></span>` : ""}
                </div>
              </div>
            </div>
            <span class="text-xs font-black bg-white text-emerald-800 px-3 py-1.5 rounded-xl shadow-xs flex-shrink-0">
              Afiyet Olsun! 😋
            </span>
          </div>
        `;
      } else {
        todayBanner.classList.add("hidden");
        todayBanner.innerHTML = "";
      }
    }

    // Menü İçerik Alanı (Aylık Liste & Kartlar)
    if (container) {
      if (monthDays.length > 0) {
        container.innerHTML = `
          <div class="space-y-4">
            <!-- Arama & Filtreleme Çubuğu -->
            <div class="flex items-center justify-between flex-wrap gap-2.5 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div class="flex-1 min-w-[200px] relative">
                <input type="text" id="input-search-catering-menu" placeholder="Menüde yemek ara... (Örn: Köfte, Çorba, Fasulye, Makarna)" class="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 font-medium">
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
              </div>
              <div class="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span class="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md font-black text-[11px]">${monthDays.length} Gün</span>
                <span>${currentMonthTitle}</span>
              </div>
              ${config.menuImage ? `
                <div class="flex items-center gap-1.5">
                  <button type="button" id="btn-toggle-menu-view-list" class="bg-blue-600 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer">📋 Günlük Liste</button>
                  <button type="button" id="btn-toggle-menu-view-img" class="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer">🖼️ Menü Görseli</button>
                </div>
              ` : ''}
            </div>

            <!-- Günlük Kartlar Izgarası -->
            <div id="catering-days-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              ${monthDays.map(day => {
                const isToday = day.date === todayStr;
                const soup = day.soup || (day.items && day.items[0]) || "-";
                const main = day.mainDish || (day.items && day.items[1]) || "-";
                const side = day.sideDish || (day.items && day.items[2]) || "-";
                const extra = day.extra || (day.items && day.items[3]) || "-";

                return `
                  <div class="catering-day-card p-3.5 rounded-2xl border transition ${isToday ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-2 ring-emerald-500/30' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'}" data-menu-text="${(day.items || [soup, main, side, extra]).join(' ').toLowerCase()}">
                    <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                      <div class="flex items-center gap-1.5">
                        <span class="text-xs font-black ${isToday ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}">
                          ${day.date.split('-')[2]} ${currentMonthName}
                        </span>
                        <span class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">(${day.dayName || ''})</span>
                      </div>
                      ${isToday ? '<span class="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">BUGÜN</span>' : ''}
                    </div>

                    <div class="space-y-1.5 text-xs">
                      <div class="flex items-start gap-1.5">
                        <span class="text-[13px] leading-tight">🥣</span>
                        <span class="font-bold text-slate-800 dark:text-slate-200">${soup}</span>
                      </div>
                      <div class="flex items-start gap-1.5">
                        <span class="text-[13px] leading-tight">🥩</span>
                        <span class="font-black text-blue-700 dark:text-blue-400">${main}</span>
                      </div>
                      <div class="flex items-start gap-1.5">
                        <span class="text-[13px] leading-tight">🍚</span>
                        <span class="font-semibold text-slate-700 dark:text-slate-300">${side}</span>
                      </div>
                      <div class="flex items-start gap-1.5">
                        <span class="text-[13px] leading-tight">🥗</span>
                        <span class="font-medium text-slate-600 dark:text-slate-400">${extra}</span>
                      </div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>

            <!-- Görsel Menü Görünümü (Varsa ve kullanıcı tıklandığında gösterilir) -->
            ${config.menuImage ? `
              <div id="catering-image-view" class="hidden relative bg-slate-900 rounded-2xl p-2 flex flex-col items-center justify-center min-h-[300px] overflow-hidden group">
                <img id="catering-modal-img" src="${config.menuImage}" alt="Aylık Menü Görseli" class="max-h-[72vh] w-auto max-w-full object-contain rounded-xl shadow-2xl transition duration-200 cursor-zoom-in">
                <div class="absolute bottom-4 right-4 flex items-center gap-2 opacity-90 group-hover:opacity-100 transition">
                  <button type="button" id="btn-fullscreen-menu" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-3 py-1.5 rounded-lg shadow-md transition flex items-center gap-1.5 cursor-pointer">
                    <span>🔍</span> <span>Tam Ekran</span>
                  </button>
                </div>
              </div>
            ` : ''}
          </div>
        `;

        // Arama kutusu canlı filtreleme
        const searchInput = container.querySelector("#input-search-catering-menu");
        if (searchInput) {
          searchInput.addEventListener("input", (e) => {
            const query = (e.target.value || "").trim().toLowerCase();
            const cards = container.querySelectorAll(".catering-day-card");
            cards.forEach(card => {
              const text = card.getAttribute("data-menu-text") || "";
              if (!query || text.includes(query)) {
                card.style.display = "";
              } else {
                card.style.display = "none";
              }
            });
          });
        }

        // Liste / Görsel sekme geçişi
        const btnViewList = container.querySelector("#btn-toggle-menu-view-list");
        const btnViewImg = container.querySelector("#btn-toggle-menu-view-img");
        const gridView = container.querySelector("#catering-days-grid");
        const imgView = container.querySelector("#catering-image-view");

        if (btnViewList && btnViewImg && gridView && imgView) {
          btnViewList.addEventListener("click", () => {
            gridView.classList.remove("hidden");
            imgView.classList.add("hidden");
            btnViewList.className = "bg-blue-600 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer";
            btnViewImg.className = "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer";
          });
          btnViewImg.addEventListener("click", () => {
            gridView.classList.add("hidden");
            imgView.classList.remove("hidden");
            btnViewImg.className = "bg-blue-600 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer";
            btnViewList.className = "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer";
          });
        }

        const imgEl = container.querySelector("#catering-modal-img");
        const fsBtn = container.querySelector("#btn-fullscreen-menu");
        if (imgEl) imgEl.onclick = () => this.toggleImageZoom(imgEl);
        if (fsBtn && imgEl) {
          fsBtn.onclick = () => {
            if (imgEl.requestFullscreen) {
              imgEl.requestFullscreen();
            } else {
              window.open(config.menuImage, "_blank");
            }
          };
        }
      } else if (config.menuImage) {
        // Sadece görsel varsa görseli göster
        container.innerHTML = `
          <div class="relative bg-slate-900 rounded-2xl p-2 flex flex-col items-center justify-center min-h-[300px] overflow-hidden group">
            <img id="catering-modal-img" src="${config.menuImage}" alt="Aylık Yemek Menüsü" class="max-h-[72vh] w-auto max-w-full object-contain rounded-xl shadow-2xl transition duration-200 cursor-zoom-in" title="Büyütmek için tıklayın">
            <div class="absolute bottom-4 right-4 flex items-center gap-2 opacity-90 group-hover:opacity-100 transition">
              <button type="button" id="btn-fullscreen-menu" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-3 py-1.5 rounded-lg shadow-md transition flex items-center gap-1.5 cursor-pointer">
                <span>🔍</span> <span>Tam Ekran</span>
              </button>
            </div>
          </div>
        `;
        const imgEl = container.querySelector("#catering-modal-img");
        const fsBtn = container.querySelector("#btn-fullscreen-menu");
        if (imgEl) imgEl.onclick = () => this.toggleImageZoom(imgEl);
        if (fsBtn && imgEl) {
          fsBtn.onclick = () => {
            if (imgEl.requestFullscreen) imgEl.requestFullscreen();
            else window.open(config.menuImage, "_blank");
          };
        }
      } else {
        // Menü henüz bulunmuyor
        container.innerHTML = `
          <div class="bg-slate-50 dark:bg-slate-800/60 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center">
            <div class="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-3xl mb-3 shadow-inner">
              🍽️
            </div>
            <h4 class="text-base font-black text-slate-800 dark:text-white">${currentMonthTitle} Menüsü Hazırlanmaktadır</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-4">
              Bu aya ait yemek menüsü bilgileri yemek şirketinden güncellendiğinde burada otomatik olarak yayınlanacaktır.
            </p>
          </div>
        `;
      }
    }
  }

  toggleImageZoom(imgEl) {
    if (!imgEl) return;
    if (imgEl.classList.contains("scale-150")) {
      imgEl.classList.remove("scale-150", "cursor-zoom-out");
      imgEl.classList.add("cursor-zoom-in");
    } else {
      imgEl.classList.add("scale-150", "cursor-zoom-out");
      imgEl.classList.remove("cursor-zoom-in");
    }
  }

  openCateringWebsiteWithCredentials() {
    // Güvenlik Kuralı: Yemek şirketinin portalına doğrudan giriş yalnızca Sistem Yöneticisi (Admin) içindir!
    if (!isAdmin()) {
      alert("Yetki Hatası: Yemek şirketi yönetim sayfasına erişim yalnızca Sistem Yöneticisi (Admin) yetkisindedir!");
      return;
    }

    const config = appState.state.cateringConfig || {};
    if (!config.websiteUrl) {
      alert("Yemek şirketinin web sitesi adresi henüz yapılandırılmamış!");
      return;
    }

    if (config.username || config.password) {
      const msg = `Yemek Şirketi Giriş Bilgileri:\nKullanıcı: ${config.username || '-'}\nŞifre: ${config.password || '-'}\n\nYönetici olarak web sitesi yeni sekmede açılıyor...`;
      if (navigator.clipboard && config.password) {
        navigator.clipboard.writeText(config.password).catch(() => {});
      }
      alert(msg);
    }

    window.open(config.websiteUrl, "_blank");
  }

  handleMenuImageUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Lütfen yalnızca resim dosyası seçiniz (PNG, JPG, WebP)!");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result;
      if (!appState.state.cateringConfig) {
        appState.state.cateringConfig = {};
      }
      appState.state.cateringConfig.menuImage = base64Data;
      appState.state.cateringConfig.updatedAt = new Date().toISOString();
      appState.state.cateringConfig.updatedBy = (appState.state.currentUser && appState.state.currentUser.name) || "Yönetici";
      appState.saveState();

      logSystemAction(
        "YEMEK_MENÜSÜ_GÜNCELLEME",
        `${appState.state.cateringConfig.menuMonth || 'Güncel'} ayı yemek menüsü görseli yüklendi.`,
        {}
      );

      this.render();
      alert("✅ Yemek menüsü görseli başarıyla sisteme yüklendi ve güncellendi!");
    };
    reader.readAsDataURL(file);
  }

  saveCateringAdminConfig() {
    if (!isAdmin()) {
      alert("Yetki Hatası: Yalnızca Sistem Yöneticisi (Admin) yemek şirketi ayarlarını değiştirebilir!");
      return;
    }

    const companyName = (document.getElementById("catering-admin-company").value || "").trim();
    const websiteUrl = (document.getElementById("catering-admin-website").value || "").trim();
    const username = (document.getElementById("catering-admin-username").value || "").trim();
    const password = (document.getElementById("catering-admin-password").value || "").trim();
    const menuMonth = (document.getElementById("catering-admin-month").value || "").trim() || "Ekim 2026";
    const directMenuUrl = (document.getElementById("catering-admin-menu-url").value || "").trim();

    if (!appState.state.cateringConfig) {
      appState.state.cateringConfig = {};
    }

    appState.state.cateringConfig.companyName = companyName || "Yemek Şirketi";
    appState.state.cateringConfig.websiteUrl = websiteUrl;
    appState.state.cateringConfig.username = username;
    appState.state.cateringConfig.password = password;
    appState.state.cateringConfig.menuMonth = menuMonth;
    appState.state.cateringConfig.menuUrl = directMenuUrl;
    appState.state.cateringConfig.updatedAt = new Date().toISOString();
    appState.state.cateringConfig.updatedBy = (appState.state.currentUser && appState.state.currentUser.name) || "Yönetici";

    appState.saveState();

    logSystemAction(
      "YEMEK_ŞİRKETİ_AYARI",
      `Yemek şirketi (${companyName}) ve menü ayarları güncellendi.`,
      {}
    );

    this.render();
    alert("✅ Yemek şirketi ve menü ayarları başarıyla kaydedildi!");
  }

  renderCateringSection() {
    const config = appState.state.cateringConfig || {};
    const imgPreview = document.getElementById("ik-catering-menu-preview");
    const monthEl = document.getElementById("ik-catering-month-display");
    const companyEl = document.getElementById("ik-catering-company-display");

    if (monthEl) monthEl.textContent = config.menuMonth || "Ekim 2026";
    if (companyEl) companyEl.textContent = config.companyName || "Yemek Şirketi";

    if (imgPreview) {
      if (config.menuImage) {
        imgPreview.innerHTML = `
          <div class="relative bg-slate-900 rounded-2xl p-2 flex flex-col items-center overflow-hidden">
            <img src="${config.menuImage}" alt="Aylık Yemek Menüsü" class="max-h-[60vh] w-auto max-w-full object-contain rounded-xl shadow-lg">
            <div class="mt-3 flex items-center gap-2">
              <button type="button" onclick="window.portalApp.cateringShuttle.openCateringModal()" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2 px-4 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer">
                <span>🔍</span> <span>Büyük Ekranda İncele</span>
              </button>
              <a href="${config.menuImage}" download="SODSAN-Yemek-Menusu.png" class="bg-white/90 hover:bg-white text-slate-800 text-xs font-black py-2 px-3 rounded-xl shadow-sm transition flex items-center gap-1">
                <span>⬇️</span> <span>İndir</span>
              </a>
            </div>
          </div>
        `;
      } else {
        imgPreview.innerHTML = `
          <div class="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
            <span class="text-3xl block mb-2">🍽️</span>
            <div class="text-xs font-bold text-slate-700 dark:text-slate-200">Görsel Yüklenmedi</div>
            <p class="text-[11px] text-slate-500 mt-1">Yönetici panelinden bu aya ait menü resmini yükleyebilirsiniz.</p>
          </div>
        `;
      }
    }
  }

  // ==========================================
  // PERSONEL SERVİS GÜZERGAHLARI FONKSİYONLARI
  // ==========================================

  openShuttleModal() {
    this.renderShuttleModalContent();
    const modal = document.getElementById("modal-shuttle-info");
    if (modal) {
      modal.classList.add("show");
    }
  }

  renderShuttleModalContent() {
    const list = appState.state.shuttleRoutes || [];
    const container = document.getElementById("modal-shuttle-routes-list");
    const currentUser = appState.state.currentUser;
    const allEmps = this.getFactoryEmployees();

    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="bg-slate-50 dark:bg-slate-800/60 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center">
          <div class="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-3xl mb-3 shadow-inner">
            🚐
          </div>
          <h4 class="text-base font-black text-slate-800 dark:text-white">Henüz Servis Güzergahı Tanımlanmadı</h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-4">
            Fabrika servis güzergahları, araç plakaları ve şoför bilgileri İK tarafından sisteme eklendiğinde burada listelenecektir.
          </p>
          ${isManagerOrHr() ? `
            <button type="button" onclick="window.portalApp.cateringShuttle.openAddShuttleModal()" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-2.5 px-5 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer">
              <span>+</span> <span>Yeni Servis Güzergahı Ekle</span>
            </button>
          ` : ""}
        </div>
      `;
      return;
    }

    // Oturum açan kullanıcının bindiği servisi her zaman en üste taşı
    const sortedList = [...list].sort((a, b) => {
      const aIsMine = currentUser && (
        (a.passengerEmployeeIds || []).includes(currentUser.id) ||
        (a.passengerEmployeeIds || []).some(empId => {
          const emp = allEmps.find(e => e.id === empId || e.userId === empId);
          return emp && (emp.userId === currentUser.id || (emp.name && emp.name.toLowerCase() === currentUser.name.toLowerCase()));
        })
      );
      const bIsMine = currentUser && (
        (b.passengerEmployeeIds || []).includes(currentUser.id) ||
        (b.passengerEmployeeIds || []).some(empId => {
          const emp = allEmps.find(e => e.id === empId || e.userId === empId);
          return emp && (emp.userId === currentUser.id || (emp.name && emp.name.toLowerCase() === currentUser.name.toLowerCase()));
        })
      );
      if (aIsMine && !bIsMine) return -1;
      if (!aIsMine && bIsMine) return 1;
      return 0;
    });

    container.innerHTML = sortedList.map(route => {
      // Oturum açan kullanıcının bu serviste olup olmadığını kontrol et
      const isMyShuttle = currentUser && (
        (route.passengerEmployeeIds || []).includes(currentUser.id) ||
        (route.passengerEmployeeIds || []).some(empId => {
          const emp = allEmps.find(e => e.id === empId || e.userId === empId);
          return emp && (emp.userId === currentUser.id || (emp.name && emp.name.toLowerCase() === currentUser.name.toLowerCase()));
        })
      );

      const passengerNames = (route.passengerEmployeeIds || []).map(empId => {
        const emp = allEmps.find(e => e.id === empId || e.userId === empId);
        return emp ? emp.name : empId;
      });

      return `
        <div class="bg-white dark:bg-slate-900 border ${isMyShuttle ? 'border-2 border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-950 shadow-md' : 'border-slate-200 dark:border-slate-800'} rounded-2xl p-4 sm:p-5 space-y-3.5 transition hover:shadow-lg">
          
          <div class="flex items-start justify-between flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-lg">🚐</span>
                <h3 class="text-sm sm:text-base font-black text-slate-900 dark:text-white">${route.routeName}</h3>
                ${isMyShuttle ? `
                  <span class="bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                    <span>⭐</span> <span>SİZİN SERVİSİNİZ</span>
                  </span>
                ` : ""}
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${route.notes || "Günlük personel vardiya servisi"}</p>
            </div>

            <div class="flex items-center gap-2">
              <button type="button" data-show-live-shuttle="${route.id}" class="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs py-1.5 px-3 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer">
                <span>📍</span> <span>Anlık Konum Göster</span>
              </button>
              <span class="bg-slate-900 text-white text-xs font-mono font-black px-3 py-1 rounded-lg tracking-wider border border-slate-700 shadow-xs">
                ${route.plateNumber || "Plaka Belirtilmedi"}
              </span>
              <span class="text-[11px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg">
                👥 ${passengerNames.length} / ${route.capacity || 16} Kişi
              </span>
            </div>
          </div>

          <!-- Şoför Bilgileri -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs">
            <div class="flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black">
                👤
              </span>
              <div>
                <div class="text-[10px] text-slate-400 font-bold uppercase">Servis Şoförü</div>
                <div class="font-extrabold text-slate-800 dark:text-slate-200">${route.driverName || "Belirtilmedi"}</div>
              </div>
            </div>

            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <span class="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black">
                  📞
                </span>
                <div>
                  <div class="text-[10px] text-slate-400 font-bold uppercase">Şoför İletişim</div>
                  <div class="font-extrabold text-slate-800 dark:text-slate-200">${route.driverPhone || "Telefon Belirtilmedi"}</div>
                </div>
              </div>

              ${route.driverPhone ? `
                <a href="tel:${route.driverPhone}" class="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg shadow-xs transition flex items-center gap-1">
                  <span>📞</span> <span>Hemen Ara</span>
                </a>
              ` : ""}
            </div>
          </div>

          <!-- Güzergah ve Durak Saatleri -->
          <div>
            <div class="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 flex items-center gap-1">
              <span>📍</span> <span>GÜZERGAH & DURAK BİLGİSİ</span>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-pre-line leading-relaxed">
              ${route.stops || "Durak ve saat bilgisi girilmemiştir."}
            </div>
          </div>

          <!-- Binecek Personeller -->
          <div>
            <div class="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 flex items-center justify-between">
              <span>👥 BİNECEK PERSONELLER (${passengerNames.length} ÇALIŞAN)</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
              ${passengerNames.length > 0 ? passengerNames.map(name => `
                <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                  <span>👤</span> <span>${name}</span>
                </span>
              `).join("") : `<span class="text-xs text-slate-400 italic">Bu araca henüz kayıtlı personel atanmadı.</span>`}
            </div>
          </div>

        </div>
      `;
    }).join("");
  }

  renderShuttleSection() {
    this.renderShuttleRoutesList();
  }

  renderShuttleRoutesList() {
    const listContainer = document.getElementById("ik-shuttle-routes-table-tbody");
    if (!listContainer) return;

    const list = appState.state.shuttleRoutes || [];
    const searchVal = (document.getElementById("filter-shuttle-search")?.value || "").toLowerCase().trim();
    const allEmps = this.getFactoryEmployees();

    const filtered = list.filter(r => {
      if (!searchVal) return true;
      return (
        (r.routeName && r.routeName.toLowerCase().includes(searchVal)) ||
        (r.plateNumber && r.plateNumber.toLowerCase().includes(searchVal)) ||
        (r.driverName && r.driverName.toLowerCase().includes(searchVal)) ||
        (r.stops && r.stops.toLowerCase().includes(searchVal))
      );
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <tr>
          <td colspan="6" class="p-8 text-center text-slate-400 text-xs">
            ${list.length === 0 ? "Kayıtlı servis güzergahı bulunmuyor. Yeni servis güzergahı ekleyebilirsiniz." : "Arama kriterine uygun servis bulunamadı."}
          </td>
        </tr>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(r => {
      const passengerNames = (r.passengerEmployeeIds || []).map(empId => {
        const emp = allEmps.find(e => e.id === empId || e.userId === empId);
        return emp ? emp.name : empId;
      });

      return `
        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
          <td class="p-3">
            <div class="font-black text-slate-900 dark:text-white text-xs">${r.routeName}</div>
            <div class="text-[10px] text-slate-500 truncate max-w-xs">${r.notes || "-"}</div>
          </td>
          <td class="p-3">
            <span class="font-mono font-black text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
              ${r.plateNumber || "-"}
            </span>
          </td>
          <td class="p-3">
            <div class="font-bold text-xs text-slate-800 dark:text-slate-200">${r.driverName || "-"}</div>
            ${r.driverPhone ? `<a href="tel:${r.driverPhone}" class="text-[11px] text-blue-600 font-semibold hover:underline">📞 ${r.driverPhone}</a>` : '<span class="text-[10px] text-slate-400">-</span>'}
          </td>
          <td class="p-3">
            <div class="text-xs text-slate-700 dark:text-slate-300 font-medium max-w-xs truncate" title="${r.stops || ''}">
              ${r.stops || "-"}
            </div>
          </td>
          <td class="p-3">
            <span class="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold px-2 py-0.5 rounded">
              👥 ${passengerNames.length} / ${r.capacity || 16} Kişi
            </span>
          </td>
          <td class="p-3 text-right">
            <div class="inline-flex items-center gap-1.5">
              <button type="button" data-show-live-shuttle="${r.id}" class="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg text-xs font-bold transition cursor-pointer" title="Anlık Konum Göster">
                📍
              </button>
              <button type="button" onclick="window.portalApp.cateringShuttle.openEditShuttleModal('${r.id}')" class="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg text-xs font-bold transition cursor-pointer" title="Düzenle">
                ✏️
              </button>
              <button type="button" onclick="window.portalApp.cateringShuttle.deleteShuttleRoute('${r.id}')" class="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg text-xs font-bold transition cursor-pointer" title="Sil">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  openAddShuttleModal() {
    if (!isManagerOrHr()) {
      alert("Yetki Hatası: Yalnızca İK veya Yönetici servis güzergahı ekleyebilir!");
      return;
    }

    const modal = document.getElementById("modal-add-edit-shuttle");
    const form = document.getElementById("form-add-edit-shuttle");
    const titleEl = document.getElementById("modal-shuttle-form-title");
    if (!modal || !form) return;

    form.reset();
    document.getElementById("shuttle-form-id").value = "";
    const arventoUrlInput = document.getElementById("shuttle-form-arvento-url");
    const arventoIdInput = document.getElementById("shuttle-form-arvento-id");
    if (arventoUrlInput) arventoUrlInput.value = "";
    if (arventoIdInput) arventoIdInput.value = "";
    if (titleEl) titleEl.textContent = "🚐 Yeni Servis Güzergahı Ekle";

    this.populateDriverUserSelect("");
    this.populatePassengerChecklist([]);
    modal.classList.add("show");
  }

  openEditShuttleModal(shuttleId) {
    if (!isManagerOrHr()) {
      alert("Yetki Hatası: Yalnızca İK veya Yönetici servis güzergahı düzenleyebilir!");
      return;
    }

    const route = (appState.state.shuttleRoutes || []).find(r => r.id === shuttleId);
    if (!route) return;

    const modal = document.getElementById("modal-add-edit-shuttle");
    const form = document.getElementById("form-add-edit-shuttle");
    const titleEl = document.getElementById("modal-shuttle-form-title");
    if (!modal || !form) return;

    document.getElementById("shuttle-form-id").value = route.id;
    document.getElementById("shuttle-form-name").value = route.routeName || "";
    document.getElementById("shuttle-form-plate").value = route.plateNumber || "";
    document.getElementById("shuttle-form-driver").value = route.driverName || "";
    document.getElementById("shuttle-form-phone").value = route.driverPhone || "";
    document.getElementById("shuttle-form-capacity").value = route.capacity || 16;
    document.getElementById("shuttle-form-stops").value = route.stops || "";
    document.getElementById("shuttle-form-notes").value = route.notes || "";
    const arventoUrlInput = document.getElementById("shuttle-form-arvento-url");
    const arventoIdInput = document.getElementById("shuttle-form-arvento-id");
    if (arventoUrlInput) arventoUrlInput.value = route.arventoUrl || "";
    if (arventoIdInput) arventoIdInput.value = route.arventoVehicleId || "";

    if (titleEl) titleEl.textContent = `✏️ Servis Düzenle: ${route.routeName}`;

    this.populateDriverUserSelect(route.driverUserId || "");
    this.populatePassengerChecklist(route.passengerEmployeeIds || []);
    modal.classList.add("show");
  }

  populateDriverUserSelect(selectedDriverUserId = "") {
    const sel = document.getElementById("shuttle-form-driver-user");
    if (!sel) return;

    const employees = this.getFactoryEmployees();
    sel.innerHTML = `<option value="">-- Personel Seçiniz (Opsiyonel) --</option>` +
      employees.map(emp => {
        const isSel = (emp.id === selectedDriverUserId || emp.userId === selectedDriverUserId) ? "selected" : "";
        return `<option value="${emp.id}" ${isSel}>${emp.name} (${emp.role})</option>`;
      }).join("");

    sel.onchange = () => {
      const chosenId = sel.value;
      if (!chosenId) return;
      const chosenEmp = employees.find(e => e.id === chosenId || e.userId === chosenId);
      if (chosenEmp) {
        const driverNameInput = document.getElementById("shuttle-form-driver");
        const driverPhoneInput = document.getElementById("shuttle-form-phone");
        if (driverNameInput && !driverNameInput.value.trim()) {
          driverNameInput.value = chosenEmp.name;
        }
        if (driverPhoneInput && !driverPhoneInput.value.trim() && (chosenEmp.phone || chosenEmp.phoneNumber)) {
          driverPhoneInput.value = chosenEmp.phone || chosenEmp.phoneNumber;
        }
      }
    };
  }

  populatePassengerChecklist(selectedIds = []) {
    const container = document.getElementById("shuttle-passengers-checklist");
    if (!container) return;

    const employees = this.getFactoryEmployees();
    if (employees.length === 0) {
      container.innerHTML = `<div class="p-3 text-xs text-slate-400">Sistemde kayıtlı personel bulunamadı.</div>`;
      return;
    }

    container.innerHTML = employees.map(emp => {
      const isChecked = selectedIds.includes(emp.id) || selectedIds.includes(emp.userId);
      const dep = appState.state.departments.find(d => d.id === emp.departmentId) || { name: "Genel" };

      return `
        <label class="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 cursor-pointer transition text-xs select-none ${isChecked ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-300 font-bold' : 'bg-white dark:bg-slate-800'}">
          <div class="flex items-center gap-2">
            <input type="checkbox" name="shuttle-passenger" value="${emp.id}" ${isChecked ? 'checked' : ''} class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer">
            <span class="text-slate-800 dark:text-slate-200">${emp.name}</span>
          </div>
          <span class="text-[10px] text-slate-400 font-normal">${dep.name}</span>
        </label>
      `;
    }).join("");
  }

  saveShuttleRoute() {
    if (!isManagerOrHr()) {
      alert("Yetki Hatası: Servis güzergahı kaydetme yetkiniz bulunmamaktadır!");
      return;
    }

    const id = document.getElementById("shuttle-form-id").value;
    const routeName = (document.getElementById("shuttle-form-name").value || "").trim();
    const plateNumber = (document.getElementById("shuttle-form-plate").value || "").trim().toUpperCase();
    const driverUserId = (document.getElementById("shuttle-form-driver-user")?.value || "").trim();
    let driverName = (document.getElementById("shuttle-form-driver").value || "").trim();
    const driverPhone = (document.getElementById("shuttle-form-phone").value || "").trim();
    const capacity = parseInt(document.getElementById("shuttle-form-capacity").value, 10) || 16;
    const stops = (document.getElementById("shuttle-form-stops").value || "").trim();
    const notes = (document.getElementById("shuttle-form-notes").value || "").trim();
    const arventoUrl = (document.getElementById("shuttle-form-arvento-url")?.value || "").trim();
    const arventoVehicleId = (document.getElementById("shuttle-form-arvento-id")?.value || "").trim();

    if (!routeName || !plateNumber) {
      alert("Lütfen en azından Güzergah Adı ve Araç Plakasını giriniz!");
      return;
    }

    if (driverUserId && !driverName) {
      const allEmps = this.getFactoryEmployees();
      const emp = allEmps.find(e => e.id === driverUserId || e.userId === driverUserId);
      if (emp) driverName = emp.name;
    }

    const checkedBoxes = Array.from(document.querySelectorAll("input[name='shuttle-passenger']:checked"));
    const passengerEmployeeIds = checkedBoxes.map(cb => cb.value);

    if (!Array.isArray(appState.state.shuttleRoutes)) {
      appState.state.shuttleRoutes = [];
    }

    if (id) {
      // Güncelleme
      const idx = appState.state.shuttleRoutes.findIndex(r => r.id === id);
      if (idx !== -1) {
        appState.state.shuttleRoutes[idx] = {
          ...appState.state.shuttleRoutes[idx],
          routeName,
          plateNumber,
          driverUserId,
          driverName,
          driverPhone,
          capacity,
          stops,
          notes,
          arventoUrl,
          arventoVehicleId,
          passengerEmployeeIds,
          updatedAt: new Date().toISOString()
        };

        logSystemAction(
          "SERVİS_GÜNCELLEME",
          `${routeName} (${plateNumber}) servis güzergahı güncellendi.`,
          { id, passengerCount: passengerEmployeeIds.length }
        );
      }
    } else {
      // Yeni Ekleme
      const newRoute = {
        id: `shuttle_${Date.now()}`,
        routeName,
        plateNumber,
        driverUserId,
        driverName,
        driverPhone,
        capacity,
        stops,
        notes,
        arventoUrl,
        arventoVehicleId,
        passengerEmployeeIds,
        createdAt: new Date().toISOString()
      };

      appState.state.shuttleRoutes.push(newRoute);

      logSystemAction(
        "SERVİS_EKLEME",
        `Yeni servis güzergahı eklendi: ${routeName} (${plateNumber})`,
        { id: newRoute.id, passengerCount: passengerEmployeeIds.length }
      );
    }

    appState.saveState();

    const modal = document.getElementById("modal-add-edit-shuttle");
    if (modal) modal.classList.remove("show");

    this.render();
    alert("✅ Servis güzergahı ve yolcu listesi başarıyla kaydedildi!");
  }

  deleteShuttleRoute(shuttleId) {
    if (!isManagerOrHr()) {
      alert("Yetki Hatası: Servis güzergahını yalnızca İK veya Yönetici silebilir!");
      return;
    }

    const route = (appState.state.shuttleRoutes || []).find(r => r.id === shuttleId);
    if (!route) return;

    if (confirm(`"${route.routeName} (${route.plateNumber})" güzergahını silmek istediğinize emin misiniz?`)) {
      appState.state.shuttleRoutes = appState.state.shuttleRoutes.filter(r => r.id !== shuttleId);
      appState.saveState();

      logSystemAction(
        "SERVİS_SİLME",
        `${route.routeName} (${route.plateNumber}) servis güzergahı silindi.`,
        { shuttleId }
      );

      this.render();
    }
  }

  // ==========================================
  // ARVENTO CANLI SERVİS KONUMU MODALI
  // ==========================================

  openLiveLocationModal(routeId) {
    const route = (appState.state.shuttleRoutes || []).find(r => r.id === routeId);
    if (!route) {
      alert("Servis güzergahı bulunamadı.");
      return;
    }

    const modal = document.getElementById("modal-live-shuttle-location");
    if (!modal) return;

    const plateEl = document.getElementById("live-loc-plate");
    const routeEl = document.getElementById("live-loc-route");
    const driverEl = document.getElementById("live-loc-driver");
    const phoneBox = document.getElementById("live-loc-phone-box");
    const container = document.getElementById("live-loc-frame-container");
    const refreshBtn = document.getElementById("btn-refresh-live-location");

    if (plateEl) plateEl.textContent = route.plateNumber || "Plakasız Araç";
    if (routeEl) routeEl.textContent = route.routeName || "Servis Güzergahı";
    if (driverEl) driverEl.textContent = route.driverName || "Belirtilmedi";

    if (phoneBox) {
      if (route.driverPhone) {
        phoneBox.innerHTML = `
          <a href="tel:${route.driverPhone}" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-2 px-3 rounded-xl shadow-xs transition flex items-center gap-1.5">
            <span>📞</span> <span>Şoförü Ara (${route.driverPhone})</span>
          </a>
        `;
      } else {
        phoneBox.innerHTML = "";
      }
    }

    if (container) {
      const hasCustomUrl = !!(route.arventoUrl && route.arventoUrl.trim());
      const arventoId = route.arventoVehicleId ? route.arventoVehicleId.trim() : (route.plateNumber || "");
      const arventoPortalUrl = hasCustomUrl ? route.arventoUrl.trim() : "https://takip.arvento.com/";

      if (hasCustomUrl) {
        container.innerHTML = `
          <!-- Canlı Harita İframe Önizleme -->
          <div class="w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 shadow-inner relative">
            <iframe src="${arventoPortalUrl}" class="w-full h-72 sm:h-80 border-0 rounded-2xl" loading="lazy" allow="geolocation" title="Arvento Canlı Servis Haritası"></iframe>
          </div>

          <div class="flex items-center flex-wrap gap-2 justify-center pt-1">
            <a href="${arventoPortalUrl}" target="_blank" rel="noopener noreferrer" class="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-xs py-2 px-4 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95">
              <span>🗺️</span> <span>Haritayı Yeni Sekmede / Tam Ekran Aç</span> <span>↗</span>
            </a>
            ${isManagerOrHr() ? `
              <button type="button" onclick="window.portalApp.cateringShuttle.openEditShuttleModal('${route.id}')" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs py-2 px-3 rounded-xl transition flex items-center gap-1 cursor-pointer">
                <span>⚙️</span> <span>Ayarları Düzenle</span>
              </button>
            ` : ""}
          </div>

          <div class="text-[10px] text-slate-400 font-mono text-center">
            Plaka / Cihaz No: <b>${arventoId}</b> • Son Sorgu: ${new Date().toLocaleTimeString("tr-TR")}
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-3xl mb-1 shadow-inner">
            🛰️
          </div>
          <div>
            <h4 class="text-sm font-black text-slate-800 dark:text-white">Arvento Araç Takip Sistemi</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
              Bu servis aracı (${route.plateNumber}) için henüz doğrudan bir canlı harita linki tanımlanmamış. Arvento giriş ekranına giderek araç konumunu sorgulayabilirsiniz.
            </p>
          </div>

          <div class="flex items-center flex-wrap gap-2 justify-center pt-2">
            <a href="${arventoPortalUrl}" target="_blank" rel="noopener noreferrer" class="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-xs py-2.5 px-5 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95">
              <span>🗺️</span> <span>Arvento Takip Ekranını Aç</span> <span>↗</span>
            </a>
            ${isManagerOrHr() ? `
              <button type="button" onclick="window.portalApp.cateringShuttle.openEditShuttleModal('${route.id}')" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs py-2 px-3 rounded-xl transition flex items-center gap-1 cursor-pointer">
                <span>⚙️</span> <span>Takip Linki Ekle</span>
              </button>
            ` : ""}
          </div>

          <div class="mt-2 text-[10px] text-slate-400 font-mono">
            Araç Takip ID / Plaka: <b>${arventoId}</b> • Son Sorgu: ${new Date().toLocaleTimeString("tr-TR")}
          </div>
        `;
      }
    }

    if (refreshBtn) {
      refreshBtn.onclick = () => {
        this.openLiveLocationModal(routeId);
      };
    }

    modal.classList.add("show");
  }

  // ==========================================
  // GENEL RENDER
  // ==========================================

  render() {
    // 1. Admin Paneli Alanlarını Doldur
    const config = appState.state.cateringConfig || {};
    const companyInput = document.getElementById("catering-admin-company");
    const websiteInput = document.getElementById("catering-admin-website");
    const userInput = document.getElementById("catering-admin-username");
    const passInput = document.getElementById("catering-admin-password");
    const monthInput = document.getElementById("catering-admin-month");
    const menuUrlInput = document.getElementById("catering-admin-menu-url");
    const previewContainer = document.getElementById("catering-admin-image-preview");

    if (companyInput && !companyInput.value) companyInput.value = config.companyName || "Kayra Yemek";
    if (websiteInput && !websiteInput.value) websiteInput.value = config.websiteUrl || "https://musteri.kayrayemek.com.tr:4638/AylikMenu";
    if (userInput && !userInput.value) userInput.value = config.username || "Sodsan";
    if (passInput && !passInput.value) passInput.value = config.password || "2025";
    if (monthInput && !monthInput.value) monthInput.value = config.menuMonth || "Ekim 2026";
    if (menuUrlInput && !menuUrlInput.value) menuUrlInput.value = config.menuUrl || "";

    if (previewContainer) {
      if (config.menuImage) {
        previewContainer.innerHTML = `
          <div class="relative inline-block border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
            <img src="${config.menuImage}" alt="Menü Önizleme" class="h-32 w-auto object-cover">
            <span class="absolute top-1 right-1 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">Yüklü</span>
          </div>
        `;
      } else {
        previewContainer.innerHTML = `<span class="text-xs text-slate-400 italic">Henüz menü görseli yüklenmedi.</span>`;
      }
    }

    // 2. İK Ekranındaki Bölümleri Güncelle
    const btnCateringAdmin = document.getElementById("btn-open-catering-admin");
    if (btnCateringAdmin) {
      btnCateringAdmin.style.display = isAdmin() ? "" : "none";
    }
    const btnAddShuttle = document.getElementById("btn-open-add-shuttle");
    if (btnAddShuttle) {
      btnAddShuttle.style.display = isManagerOrHr() ? "" : "none";
    }

    this.renderCateringSection();
    this.renderShuttleSection();
  }
}

// Oturum açan kullanıcının bu haftaki servis şoförlüğü veya yolculuk bildirimlerini üretir
export function getUserShuttleBanners(currentUser) {
  if (!currentUser || !Array.isArray(appState.state.shuttleRoutes)) return [];
  const routes = appState.state.shuttleRoutes;
  const banners = [];

  const emp = (appState.state.employees || []).find(e => e.userId === currentUser.id || e.id === currentUser.id || (e.name && e.name.toLowerCase() === currentUser.name.toLowerCase()));
  const userEmpId = emp ? emp.id : currentUser.id;
  const userNameLower = (currentUser.name || "").toLowerCase().trim();

  routes.forEach(route => {
    // 1. Şoför kontrolü
    const isDriver = (route.driverUserId && (route.driverUserId === currentUser.id || route.driverUserId === userEmpId)) ||
      (route.driverName && route.driverName.toLowerCase().trim() === userNameLower);

    if (isDriver) {
      banners.push({
        type: "DRIVER",
        routeId: route.id,
        arventoUrl: route.arventoUrl || "",
        arventoVehicleId: route.arventoVehicleId || "",
        title: "HAFTALIK ŞOFÖRLÜK GÖREVİNİZ",
        plateNumber: route.plateNumber || "Plakasız",
        routeName: route.routeName,
        stops: route.stops || "",
        capacity: route.capacity || 16,
        passengerCount: (route.passengerEmployeeIds || []).length
      });
    }

    // 2. Yolcu kontrolü
    const isPassenger = (route.passengerEmployeeIds || []).some(id => id === currentUser.id || id === userEmpId);
    if (isPassenger) {
      banners.push({
        type: "PASSENGER",
        routeId: route.id,
        arventoUrl: route.arventoUrl || "",
        arventoVehicleId: route.arventoVehicleId || "",
        title: "HAFTALIK PERSONEL SERVİS BİLGİNİZ",
        plateNumber: route.plateNumber || "Plakasız",
        routeName: route.routeName,
        driverName: route.driverName || "Belirtilmedi",
        driverPhone: route.driverPhone || "",
        stops: route.stops || ""
      });
    }
  });

  return banners;
}
