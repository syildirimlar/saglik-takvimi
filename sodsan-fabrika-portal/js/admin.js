// SODSAN Fabrika Portalı - Yönetici / Admin Paneli (admin.js)
import { appState, ROLES, getRoleInfo, logSystemAction, isAdmin, isViewer, isUserVisibleToCurrentSession } from './data.js';

export class AdminModule {
  constructor() {
    this.filterLogSearch = "";
    this.filterLogUser = "ALL";
    this.filterLogType = "ALL";
  }

  init() {
    this.bindEvents();
    this.populateLogUserSelect();
    this.render();
  }

  bindEvents() {
    const btnAddDept = document.getElementById("btn-open-add-department");
    const formDept = document.getElementById("form-add-department");
    const btnAddUser = document.getElementById("btn-open-add-user");
    const formUser = document.getElementById("form-add-user");
    const btnAddRole = document.getElementById("btn-open-add-role");
    const formAddRole = document.getElementById("form-add-role");
    const formEditRole = document.getElementById("form-edit-role");

    // Yedekleme & Sıfırlama Butonları
    const btnExport = document.getElementById("btn-export-backup");
    const btnImport = document.getElementById("btn-import-backup");
    const inputImport = document.getElementById("file-import-backup");
    const btnReset = document.getElementById("btn-reset-factory");

    if (btnAddDept) {
      btnAddDept.addEventListener("click", () => {
        const modal = document.getElementById("modal-add-department");
        if (modal) modal.classList.add("show");
      });
    }

    if (btnAddUser) {
      btnAddUser.addEventListener("click", () => {
        this.populateUserModalSelects();
        const modal = document.getElementById("modal-add-user");
        if (modal) modal.classList.add("show");
      });
    }

    if (btnAddRole) {
      btnAddRole.addEventListener("click", () => {
        const modal = document.getElementById("modal-add-role");
        if (modal) modal.classList.add("show");
      });
    }

    if (formDept) {
      formDept.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveDepartment();
      });
    }

    const formEditDept = document.getElementById("form-edit-department");
    if (formEditDept) {
      formEditDept.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveEditDepartment();
      });
    }

    if (formUser) {
      formUser.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveUser();
      });
    }

    const formEditUser = document.getElementById("form-edit-user");
    if (formEditUser) {
      formEditUser.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveEditUser();
      });
    }

    if (formAddRole) {
      formAddRole.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveAddRole();
      });
    }

    if (formEditRole) {
      formEditRole.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveEditRole();
      });
    }

    if (btnExport) {
      btnExport.addEventListener("click", () => this.exportBackup());
    }

    if (btnImport && inputImport) {
      btnImport.addEventListener("click", () => inputImport.click());
      inputImport.addEventListener("change", (e) => this.importBackup(e));
    }

    // Bulut Eşitleme Butonları (PC, Tablet ve Telefonlar Arası)
    const btnForcePull = document.getElementById("btn-force-pull-cloud");
    const btnForcePush = document.getElementById("btn-force-push-cloud");
    if (btnForcePull) {
      btnForcePull.addEventListener("click", async () => {
        if (window.__cloudSyncService) {
          btnForcePull.disabled = true;
          btnForcePull.textContent = "⏳ Çekiliyor...";
          const res = await window.__cloudSyncService.pullFromCloud(true);
          btnForcePull.disabled = false;
          btnForcePull.innerHTML = "<span>⬇️</span> <span>Buluttan Çek</span>";
          if (res && res.success) {
            alert("✅ En güncel fabrika verisi buluttan çekildi ve arayüz tazelendi!" + (res.updatedAt ? ` (Son Güncelleme: ${res.updatedAt})` : ""));
          } else {
            alert("ℹ️ " + (res?.message || res?.error || "Cihazınızdaki veriler zaten en güncel sürümde."));
          }
        }
      });
    }
    if (btnForcePush) {
      btnForcePush.addEventListener("click", async () => {
        if (window.__cloudSyncService) {
          btnForcePush.disabled = true;
          btnForcePush.textContent = "⏳ Dağıtılıyor...";
          const res = await window.__cloudSyncService.pushToCloud();
          btnForcePush.disabled = false;
          btnForcePush.innerHTML = "<span>⬆️</span> <span>Buluta Dağıt</span>";
          if (res && res.success) {
            alert("✅ Bu cihazdaki tüm veriler buluta yüklendi ve diğer cihazlara (tablet, telefon) dağıtıldı!");
          } else {
            alert("⚠️ Buluta yüklenirken hata oluştu: " + (res?.error || "Lütfen internet bağlantınızı kontrol ediniz."));
          }
        }
      });
    }

    // İşlem Geçmişi (Audit Log) Filtre Dinleyicileri
    const logSearchInput = document.getElementById("filter-log-search");
    const logUserSelect = document.getElementById("filter-log-user");
    const logTypeSelect = document.getElementById("filter-log-type");
    const btnExportLogs = document.getElementById("btn-export-logs-csv");
    const btnClearLogs = document.getElementById("btn-clear-logs");

    if (logSearchInput) {
      logSearchInput.addEventListener("input", (e) => {
        this.filterLogSearch = e.target.value.toLowerCase().trim();
        this.renderAuditLogsTable();
      });
    }

    if (logUserSelect) {
      logUserSelect.addEventListener("change", (e) => {
        this.filterLogUser = e.target.value;
        this.renderAuditLogsTable();
      });
    }

    if (logTypeSelect) {
      logTypeSelect.addEventListener("change", (e) => {
        this.filterLogType = e.target.value;
        this.renderAuditLogsTable();
      });
    }

    if (btnExportLogs) {
      btnExportLogs.addEventListener("click", () => this.exportLogsCsv());
    }

    // Korumalı Fabrika Sıfırlama Dinleyicileri
    const btnOpenGuardedReset = document.getElementById("btn-open-guarded-reset") || document.getElementById("btn-reset-factory");
    const modalGuardedReset = document.getElementById("modal-guarded-reset");
    const inputConfirmPhrase = document.getElementById("input-confirm-reset-phrase");
    const btnExecuteGuardedReset = document.getElementById("btn-execute-guarded-reset");

    if (btnOpenGuardedReset) {
      btnOpenGuardedReset.addEventListener("click", () => {
        const currentUser = appState.state.currentUser || {};
        if (currentUser.role !== "ADMIN") {
          alert("Yetki Hatası: Fabrika sıfırlama işlemi yalnızca Sistem Yöneticisi (ADMIN) yetkisiyle açılabilir.");
          return;
        }

        if (inputConfirmPhrase) {
          inputConfirmPhrase.value = "";
          setTimeout(() => inputConfirmPhrase.focus(), 150);
        }
        if (btnExecuteGuardedReset) btnExecuteGuardedReset.disabled = true;
        if (modalGuardedReset) modalGuardedReset.classList.add("show");
      });
    }

    if (inputConfirmPhrase && btnExecuteGuardedReset) {
      inputConfirmPhrase.addEventListener("input", (e) => {
        const val = e.target.value.trim().toUpperCase();
        btnExecuteGuardedReset.disabled = (val !== "SIFIRLA");
      });
    }

    if (btnExecuteGuardedReset) {
      btnExecuteGuardedReset.addEventListener("click", () => {
        const phrase = (inputConfirmPhrase ? inputConfirmPhrase.value : "").trim().toUpperCase();
        if (phrase !== "SIFIRLA") {
          alert("Lütfen onaylamak için kutucuğa SIFIRLA yazınız.");
          return;
        }

        // 1. ADIM: Otomatik Acil Kurtarma Yedeği İndir (Veri Asla Kaybolmasın!)
        try {
          this.exportBackup();
        } catch (e) {
          console.error("Otomatik yedek alınırken hata oluştu:", e);
        }

        // 2. ADIM: Log kaydet ve sıfırla
        const uName = appState.state.currentUser ? appState.state.currentUser.name : "Sistem Yöneticisi";
        logSystemAction("FABRİKA_SIFIRLAMA", `${uName}, acil kurtarma yedeği alarak sistemi fabrika ayarlarına sıfırladı.`);
        appState.resetToDefaults();

        alert("Fabrika sıfırlama tamamlandı. Tüm verilerinizi içeren acil durum kurtarma yedeği dosyanız bilgisayarınıza otomatik olarak indirildi.");
        window.location.reload();
      });
    }
  }

  populateLogUserSelect() {
    const userSelect = document.getElementById("filter-log-user");
    if (!userSelect) return;

    const currentVal = this.filterLogUser;
    userSelect.innerHTML = `<option value="ALL">Tüm Personeller</option>`;
    // Kural: İzleyici rolündeki kullanıcılar yalnızca ADMIN tarafından görülebilir!
    const usersToDisplay = (appState.state.users || []).filter(u => isAdmin() || !isViewer(u));
    usersToDisplay.forEach(u => {
      userSelect.innerHTML += `<option value="${u.name}">${u.name} (@${u.username})</option>`;
    });
    userSelect.value = currentVal;
  }

  populateUserModalSelects() {
    const depSelect = document.getElementById("user-department");
    const roleSelect = document.getElementById("user-role");

    if (depSelect) {
      depSelect.innerHTML = "";
      appState.state.departments.forEach(dep => {
        depSelect.innerHTML += `<option value="${dep.id}">${dep.icon} ${dep.name}</option>`;
      });
    }

    if (roleSelect) {
      roleSelect.innerHTML = "";
      const rolesList = appState.state.roles || [];
      rolesList.forEach(r => {
        roleSelect.innerHTML += `<option value="${r.key}">${r.title}</option>`;
      });
    }
  }

  populateEditUserModalSelects() {
    const depSelect = document.getElementById("edit-user-department");
    const roleSelect = document.getElementById("edit-user-role");

    if (depSelect) {
      depSelect.innerHTML = "";
      appState.state.departments.forEach(dep => {
        depSelect.innerHTML += `<option value="${dep.id}">${dep.icon} ${dep.name}</option>`;
      });
    }

    if (roleSelect) {
      roleSelect.innerHTML = "";
      const rolesList = appState.state.roles || [];
      rolesList.forEach(r => {
        roleSelect.innerHTML += `<option value="${r.key}">${r.title}</option>`;
      });
    }
  }

  render() {
    this.populateLogUserSelect();
    this.renderDepartmentsTable();
    this.renderUsersTable();
    this.renderRolesTable();
    this.renderAuditLogsTable();
  }

  renderDepartmentsTable() {
    const tbody = document.getElementById("admin-departments-tbody");
    if (!tbody) return;

    tbody.innerHTML = appState.state.departments.map(dep => {
      // Bu departmandaki kullanıcı sayısı (İzleyiciler yalnızca Admin'e sayılır)
      const userCount = appState.state.users.filter(u => (isAdmin() || !isViewer(u)) && u.departmentId === dep.id).length;

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-sm">
          <td class="py-3 px-3">
            <span class="text-xl mr-2">${dep.icon}</span>
            <span class="font-bold text-slate-800">${dep.name}</span>
          </td>
          <td class="py-3 px-3 text-slate-500 font-medium">${userCount} Kullanıcı</td>
          <td class="py-3 px-3 text-right">
            ${!isViewer() ? `
              <button data-edit-dept="${dep.id}" class="bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded-md text-xs font-bold mr-2 transition">✏️ Düzenle</button>
              <button data-delete-dept="${dep.id}" class="bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 rounded-md text-xs font-bold transition">Sil</button>
            ` : '<span class="text-xs text-slate-400 font-medium italic">Salt Okunur</span>'}
          </td>
        </tr>
      `;
    }).join("");

    // Düzenle Dinleyicisi
    tbody.querySelectorAll("[data-edit-dept]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-edit-dept");
        const dep = appState.state.departments.find(d => d.id === id);
        if (dep) {
          document.getElementById("edit-dept-id").value = dep.id;
          document.getElementById("edit-dept-name").value = dep.name;
          document.getElementById("edit-dept-icon").value = dep.icon;
          document.getElementById("modal-edit-department").classList.add("show");
        }
      });
    });

    tbody.querySelectorAll("[data-delete-dept]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-delete-dept");
        const dep = appState.state.departments.find(d => d.id === id);
        const depName = dep ? dep.name : id;
        if (confirm(`"${depName}" departmanını silmek istediğinize emin misiniz?`)) {
          appState.state.departments = appState.state.departments.filter(d => d.id !== id);
          appState.saveState();
          logSystemAction("DEPARTMAN_SİLME", `"${depName}" departmanı sistemden silindi.`, { deptId: id, name: depName });
          this.render();
          this.refreshAllDepartmentDropdowns();
        }
      });
    });
  }

  saveEditDepartment() {
    if (isViewer()) {
      alert("İzleyici yetkisine sahipsiniz. Sistemde değişiklik yapamazsınız.");
      return;
    }
    const id = document.getElementById("edit-dept-id").value;
    const newName = document.getElementById("edit-dept-name").value.trim();
    const newIcon = document.getElementById("edit-dept-icon").value.trim() || "🏢";

    if (!newName) {
      alert("Lütfen departman adı giriniz.");
      return;
    }

    const dep = appState.state.departments.find(d => d.id === id);
    if (dep) {
      const oldName = dep.name;
      dep.name = newName;
      dep.icon = newIcon;
      appState.saveState();

      logSystemAction("DEPARTMAN_GÜNCELLEME", `Departman güncellendi: "${oldName}" ➔ "${newName}" (${newIcon})`, { deptId: id, oldName, newName });

      document.getElementById("modal-edit-department").classList.remove("show");
      this.render();
      this.refreshAllDepartmentDropdowns();
      alert(`Departman "${newName}" olarak başarıyla güncellendi.`);
    }
  }

  refreshAllDepartmentDropdowns() {
    if (window.portalApp) {
      if (window.portalApp.products) {
        window.portalApp.products.populateDepartmentSelects();
        window.portalApp.products.render();
      }
      if (window.portalApp.supplies) {
        window.portalApp.supplies.populateDepartmentSelect();
        window.portalApp.supplies.render();
      }
      if (window.portalApp.forklift) {
        window.portalApp.forklift.populateDepartmentSelect();
        window.portalApp.forklift.render();
      }
      if (window.portalApp.leave) {
        window.portalApp.leave.populateEmployeeSelect();
        window.portalApp.leave.render();
      }
      window.portalApp.updateUserSessionUI();
    }
  }

  renderUsersTable() {
    const tbody = document.getElementById("admin-users-tbody");
    if (!tbody) return;

    // KURAL: İzleyici rolündeki kullanıcılar YALNIZCA Sistem Yöneticisi (Admin) tarafından görülebilir!
    const usersToDisplay = (appState.state.users || []).filter(u => isAdmin() || !isViewer(u));

    tbody.innerHTML = usersToDisplay.map(u => {
      const dep = appState.state.departments.find(d => d.id === u.departmentId) || { name: "-", icon: "" };
      const roleInfo = getRoleInfo(u.role);

      return `
        <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-sm">
          <td class="py-3 px-3">
            <div class="font-bold text-slate-900 dark:text-slate-100">${u.name}</div>
            <div class="text-xs text-slate-400 font-mono">@${u.username} | Tel: ${u.phone || '-'}</div>
          </td>
          <td class="py-3 px-3 text-xs text-slate-700 dark:text-slate-300 font-medium">${dep.icon} ${dep.name}</td>
          <td class="py-3 px-3">
            <span class="text-[11px] font-bold px-2 py-0.5 rounded ${roleInfo.badge}">
              ${roleInfo.title}
            </span>
          </td>
          <td class="py-3 px-3 text-xs">
            <div class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <span class="font-mono font-bold tracking-widest text-slate-700 dark:text-slate-300 text-sm pin-mask">••••</span>
              <button type="button" data-toggle-pin-reveal="${u.pin || '1234'}" class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer" title="Şifreyi Göster/Gizle">👁️</button>
            </div>
          </td>
          <td class="py-3 px-3 text-right">
            ${!isViewer() ? `
              <button data-edit-user="${u.id}" class="bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded-md text-xs font-bold mr-2 transition">✏️ Düzenle</button>
              ${u.id !== "u_admin" ? `
                <button data-delete-user="${u.id}" class="bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 rounded-md text-xs font-bold transition">Sil</button>
              ` : ''}
            ` : '<span class="text-xs text-slate-400 font-medium italic">Salt Okunur</span>'}
          </td>
        </tr>
      `;
    }).join("");

    // Şifre Göster/Gizle Butonları
    tbody.querySelectorAll("[data-toggle-pin-reveal]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const pin = e.currentTarget.getAttribute("data-toggle-pin-reveal");
        const maskSpan = e.currentTarget.parentElement.querySelector(".pin-mask");
        if (maskSpan.textContent === "••••") {
          maskSpan.textContent = pin;
          maskSpan.classList.remove("tracking-widest");
          e.currentTarget.textContent = "🙈";
        } else {
          maskSpan.textContent = "••••";
          maskSpan.classList.add("tracking-widest");
          e.currentTarget.textContent = "👁️";
        }
      });
    });

    // Kullanıcı Düzenle Dinleyicisi
    tbody.querySelectorAll("[data-edit-user]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-edit-user");
        const user = appState.state.users.find(u => u.id === id);
        if (user) {
          this.populateEditUserModalSelects();

          document.getElementById("edit-user-id").value = user.id;
          document.getElementById("edit-user-name").value = user.name;
          document.getElementById("edit-user-username").value = user.username;
          document.getElementById("edit-user-pin").value = user.pin || "1234";
          document.getElementById("edit-user-phone").value = user.phone || "";
          document.getElementById("edit-user-role").value = user.role;
          document.getElementById("edit-user-department").value = user.departmentId;

          document.getElementById("modal-edit-user").classList.add("show");
        }
      });
    });

    tbody.querySelectorAll("[data-delete-user]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-delete-user");
        const user = appState.state.users.find(u => u.id === id);
        const userName = user ? `${user.name} (@${user.username})` : id;
        if (confirm(`"${userName}" kullanıcısını silmek istediğinize emin misiniz?`)) {
          appState.state.users = appState.state.users.filter(u => u.id !== id);
          appState.saveState();
          logSystemAction("KULLANICI_SİLME", `"${userName}" kullanıcısı sistemden silindi.`, { userId: id });
          this.render();
        }
      });
    });
  }

  saveEditUser() {
    if (isViewer()) {
      alert("İzleyici yetkisine sahipsiniz. Sistemde değişiklik yapamazsınız.");
      return;
    }
    const id = document.getElementById("edit-user-id").value;
    const name = document.getElementById("edit-user-name").value.trim();
    const username = document.getElementById("edit-user-username").value.trim().toLowerCase();
    const pin = document.getElementById("edit-user-pin").value.trim();
    const role = document.getElementById("edit-user-role").value;
    const departmentId = document.getElementById("edit-user-department").value;
    const phone = document.getElementById("edit-user-phone").value.trim();

    if (!name || !username || !pin) {
      alert("Lütfen ad soyad, kullanıcı adı ve şifre alanlarını boş bırakmayınız.");
      return;
    }

    const user = appState.state.users.find(u => u.id === id);
    if (user) {
      user.name = name;
      user.username = username;
      user.pin = pin;
      user.role = role;
      user.departmentId = departmentId;
      user.phone = phone;

      // Eğer şu an aktif olan kullanıcı ise onu da güncelle
      if (appState.state.currentUser && appState.state.currentUser.id === id) {
        appState.state.currentUser = user;
      }

      appState.saveState();
      appState.syncUsersToEmployees();

      logSystemAction("KULLANICI_GÜNCELLEME", `Kullanıcı güncellendi: ${name} (@${username}), Rol: ${role}`, { userId: id, username, role });

      document.getElementById("modal-edit-user").classList.remove("show");
      this.render();
      if (window.portalApp) {
        window.portalApp.updateUserSessionUI();
      }
      alert(`"${name}" kullanıcısı başarıyla güncellendi.`);
    }
  }

  saveDepartment() {
    if (isViewer()) {
      alert("İzleyici yetkisine sahipsiniz. Sistemde değişiklik yapamazsınız.");
      return;
    }
    const nameInput = document.getElementById("dept-name");
    const iconInput = document.getElementById("dept-icon");

    if (!nameInput.value.trim()) {
      alert("Lütfen departman adı giriniz.");
      return;
    }

    const newDept = {
      id: "dep_" + Date.now(),
      name: nameInput.value.trim(),
      icon: iconInput.value.trim() || "🏢",
      color: "#2563eb"
    };

    appState.state.departments.push(newDept);
    appState.saveState();

    logSystemAction("DEPARTMAN_EKLEME", `"${newDept.name}" departmanı (${newDept.icon}) sisteme eklendi.`, { deptId: newDept.id, name: newDept.name });

    nameInput.value = "";
    document.getElementById("modal-add-department").classList.remove("show");
    this.render();
    this.refreshAllDepartmentDropdowns();
  }

  saveUser() {
    if (isViewer()) {
      alert("İzleyici yetkisine sahipsiniz. Sistemde değişiklik yapamazsınız.");
      return;
    }
    const nameInput = document.getElementById("user-name");
    const usernameInput = document.getElementById("user-username");
    const roleInput = document.getElementById("user-role");
    const deptInput = document.getElementById("user-department");
    const phoneInput = document.getElementById("user-phone");
    const pinInput = document.getElementById("user-pin");

    if (!nameInput.value.trim() || !usernameInput.value.trim()) {
      alert("Lütfen isim ve kullanıcı adı alanlarını doldurunuz.");
      return;
    }

    const newUser = {
      id: "u_" + Date.now(),
      name: nameInput.value.trim(),
      username: usernameInput.value.trim().toLowerCase(),
      role: roleInput.value,
      departmentId: deptInput.value,
      phone: phoneInput.value.trim(),
      pin: pinInput.value.trim() || "1234"
    };

    appState.state.users.push(newUser);
    appState.saveState();
    appState.syncUsersToEmployees();

    logSystemAction("KULLANICI_EKLEME", `Yeni kullanıcı oluşturuldu: "${newUser.name}" (@${newUser.username}), Rol: ${newUser.role}`, { userId: newUser.id, username: newUser.username });

    document.getElementById("form-add-user").reset();
    document.getElementById("modal-add-user").classList.remove("show");
    this.render();
  }

  renderRolesTable() {
    const tbody = document.getElementById("admin-roles-tbody");
    if (!tbody) return;

    const rolesList = appState.state.roles || [];

    // Matris Sütun Tanımları (Görünürlük ve Yetki Alanları)
    const PERM_COLUMNS = [
      { key: "canViewAllLeaveBalances", title: "Başkalarının İzin Günlerini Görebilme", icon: "🏖️" },
      { key: "canRequestLeave", title: "Kendi İzin Talebini Açma", icon: "🏖️" },
      { key: "canApproveLeave", title: "İzin Talebini Onaylama", icon: "👔" },
      { key: "canRequestOvertime", title: "Mesai Talebi Açma", icon: "⏰" },
      { key: "canApproveOvertime", title: "Mesai Talebini Onaylama", icon: "👔" },
      { key: "canAddProduct", title: "Malzeme & Stok Girişi Yapma", icon: "📦" },
      { key: "canCallForklift", title: "Forklift Çağrısı Yapabilme", icon: "🚜" },
      { key: "canCompleteForklift", title: "Forklift Görevini Tamamlama", icon: "🛠️" },
      { key: "canAddSupply", title: "Sarf Malzeme İhtiyacı Bildirme", icon: "🛒" },
      { key: "canAddMaintenance", title: "Makinelere Bakım Planı Ekleme", icon: "📅" },
      { key: "canAccessAdmin", title: "Admin Paneli Girişi", icon: "🛡️" }
    ];

    tbody.innerHTML = rolesList.map(r => {
      const perms = r.permissions || {};
      const isReadOnly = isViewer();

      // Hücrelerin HTML üretimi
      const cellsHtml = PERM_COLUMNS.map(col => {
        // Admin Paneli sütunu özel koruma: Sadece ADMIN rolünde kilitli açık, diğerlerinde kilitli kapalı
        if (col.key === "canAccessAdmin") {
          if (r.key === "ADMIN") {
            return `
              <td class="py-3 px-2 text-center whitespace-nowrap">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200" title="Sistem Yöneticisi - Kilitli Güvenlik Yetkisi">
                  🔒 Açık
                </span>
              </td>
            `;
          } else {
            return `
              <td class="py-3 px-2 text-center whitespace-nowrap">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed" title="Admin Paneli kural gereği yalnızca Sistem Yöneticisine aittir">
                  🔒 Kilitli
                </span>
              </td>
            `;
          }
        }

        const isAllowed = !!perms[col.key];

        if (isAllowed) {
          return `
            <td class="py-3 px-2 text-center whitespace-nowrap">
              <button data-matrix-toggle="${r.key}" data-perm="${col.key}" ${isReadOnly ? 'disabled' : ''} class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 transition active:scale-95 shadow-2xs ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}" title="${r.title}: ${col.title} yetkisini KAPAT">
                <span>✅</span> <span>Açık</span>
              </button>
            </td>
          `;
        } else {
          return `
            <td class="py-3 px-2 text-center whitespace-nowrap">
              <button data-matrix-toggle="${r.key}" data-perm="${col.key}" ${isReadOnly ? 'disabled' : ''} class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 hover:text-slate-800 transition active:scale-95 ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}" title="${r.title}: ${col.title} yetkisini AÇ">
                <span>❌</span> <span>Kapalı</span>
              </button>
            </td>
          `;
        }
      }).join("");

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50/70 transition text-sm">
          <td class="py-3 px-3 sticky left-0 bg-white group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] z-10">
            <div class="font-extrabold text-slate-900">${r.title}</div>
            <div class="text-[11px] font-mono text-slate-400 font-semibold">[${r.key}]</div>
          </td>
          ${cellsHtml}
          <td class="py-3 px-3 text-right whitespace-nowrap">
            ${!isViewer() ? `
              <button data-edit-role="${r.key}" class="bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded-md text-xs font-bold mr-1.5 transition">
                ✏️ Rol Adı
              </button>
              ${r.key !== "ADMIN" && r.key !== "IK" ? `
                <button data-delete-role="${r.key}" class="bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 rounded-md text-xs font-bold transition">
                  Sil
                </button>
              ` : ''}
            ` : '<span class="text-xs text-slate-400 font-medium italic">Salt Okunur</span>'}
          </td>
        </tr>
      `;
    }).join("");

    // İnteraktif Matris Aç/Kapa (Toggle) Dinleyicileri
    tbody.querySelectorAll("[data-matrix-toggle]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isViewer()) {
          alert("İzleyici yetkisine sahipsiniz. Yetki matrisini değiştiremezsiniz.");
          return;
        }
        const roleKey = btn.getAttribute("data-matrix-toggle");
        const permKey = btn.getAttribute("data-perm");
        const role = (appState.state.roles || []).find(r => r.key === roleKey);
        if (!role) return;
        if (!role.permissions) role.permissions = {};

        // canAccessAdmin kesinlikle sadece ADMIN'de true kalır
        if (permKey === "canAccessAdmin") return;

        role.permissions[permKey] = !role.permissions[permKey];
        appState.saveState();

        const colDef = PERM_COLUMNS.find(c => c.key === permKey);
        const permTitle = colDef ? colDef.title : permKey;
        const dur = role.permissions[permKey] ? "AÇILDI (✅)" : "KAPATILDI (❌)";
        
        logSystemAction("YETKİ_GÜNCELLEME", `"${role.title}" rolü için "${permTitle}" yetkisi ${dur}.`, { roleKey, permKey, value: role.permissions[permKey] });

        if (window.__cloudSyncService) {
          window.__cloudSyncService.pushToCloud(false).catch(err => console.warn("CloudSync push hatası:", err));
        }

        this.renderRolesTable();
      });
    });

    // Rol Başlığı Düzenleme Dinleyicisi
    tbody.querySelectorAll("[data-edit-role]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const key = e.currentTarget.getAttribute("data-edit-role");
        const role = appState.state.roles.find(x => x.key === key);
        if (role) {
          document.getElementById("edit-role-key").value = role.key;
          document.getElementById("edit-role-title").value = role.title;
          const keyBadge = document.getElementById("edit-role-key-badge");
          if (keyBadge) keyBadge.textContent = role.key;
          const p = role.permissions || {};
          if (document.getElementById("edit-perm-view-leave-balances")) {
            document.getElementById("edit-perm-view-leave-balances").checked = !!p.canViewAllLeaveBalances;
          }
          document.getElementById("edit-perm-add-product").checked = !!p.canAddProduct;
          document.getElementById("edit-perm-call-forklift").checked = !!p.canCallForklift;
          document.getElementById("edit-perm-complete-forklift").checked = !!p.canCompleteForklift;
          document.getElementById("edit-perm-request-leave").checked = !!p.canRequestLeave;
          document.getElementById("edit-perm-approve-leave").checked = !!p.canApproveLeave;
          if (document.getElementById("edit-perm-request-overtime")) document.getElementById("edit-perm-request-overtime").checked = !!p.canRequestOvertime;
          if (document.getElementById("edit-perm-approve-overtime")) document.getElementById("edit-perm-approve-overtime").checked = !!p.canApproveOvertime;
          document.getElementById("edit-perm-add-supply").checked = !!p.canAddSupply;
          document.getElementById("edit-perm-add-maintenance").checked = !!p.canAddMaintenance;

          document.getElementById("modal-edit-role").classList.add("show");
        }
      });
    });

    // Rol Silme Dinleyicisi
    tbody.querySelectorAll("[data-delete-role]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const key = e.currentTarget.getAttribute("data-delete-role");
        const role = appState.state.roles.find(r => r.key === key);
        const roleTitle = role ? role.title : key;
        if (confirm(`"${roleTitle}" (${key}) rolünü silmek istediğinize emin misiniz?`)) {
          appState.state.roles = appState.state.roles.filter(r => r.key !== key);
          appState.saveState();
          logSystemAction("ROL_SİLME", `"${roleTitle}" [${key}] rolü sistemden silindi.`, { roleKey: key });
          this.render();
          this.populateUserModalSelects();
          this.populateEditUserModalSelects();
        }
      });
    });
  }

  saveAddRole() {
    if (isViewer()) {
      alert("İzleyici yetkisine sahipsiniz. Sistemde değişiklik yapamazsınız.");
      return;
    }
    const title = document.getElementById("role-title").value.trim();
    let key = document.getElementById("role-key").value.trim().toUpperCase().replace(/\s+/g, "_");

    if (!title || !key) {
      alert("Lütfen rol başlığı ve kodunu giriniz.");
      return;
    }

    if (appState.state.roles.some(r => r.key === key)) {
      alert(`"${key}" koduna sahip bir rol zaten tanımlı.`);
      return;
    }

    const newRole = {
      key: key,
      title: title,
      badge: "bg-blue-100 text-blue-800",
      permissions: {
        canViewAllLeaveBalances: document.getElementById("perm-view-leave-balances") ? document.getElementById("perm-view-leave-balances").checked : false,
        canAddProduct: document.getElementById("perm-add-product").checked,
        canCallForklift: document.getElementById("perm-call-forklift").checked,
        canCompleteForklift: document.getElementById("perm-complete-forklift").checked,
        canRequestLeave: document.getElementById("perm-request-leave").checked,
        canApproveLeave: document.getElementById("perm-approve-leave").checked,
        canRequestOvertime: document.getElementById("perm-request-overtime") ? document.getElementById("perm-request-overtime").checked : false,
        canApproveOvertime: document.getElementById("perm-approve-overtime") ? document.getElementById("perm-approve-overtime").checked : false,
        canAddSupply: document.getElementById("perm-add-supply").checked,
        canAddMaintenance: document.getElementById("perm-add-maintenance").checked,
        canAccessAdmin: false // Admin paneline erişim kural gereği kesinlikle başka role verilemez, sadece ADMIN'e aittir
      }
    };

    appState.state.roles.push(newRole);
    appState.saveState();

    logSystemAction("ROL_EKLEME", `Yeni rol tanımlandı: "${title}" [${key}]`, { roleKey: key, title: title });

    document.getElementById("form-add-role").reset();
    document.getElementById("modal-add-role").classList.remove("show");

    this.render();
    this.populateUserModalSelects();
    this.populateEditUserModalSelects();
    alert(`"${title}" rolü başarıyla oluşturuldu.`);
  }

  saveEditRole() {
    if (isViewer()) {
      alert("İzleyici yetkisine sahipsiniz. Sistemde değişiklik yapamazsınız.");
      return;
    }
    const key = document.getElementById("edit-role-key").value;
    const title = document.getElementById("edit-role-title").value.trim();

    if (!title) {
      alert("Lütfen rol başlığını giriniz.");
      return;
    }

    const role = appState.state.roles.find(r => r.key === key);
    if (role) {
      const oldTitle = role.title;
      role.title = title;

      if (ROLES && ROLES[key]) {
        ROLES[key].title = title;
      }

      role.permissions = {
        canViewAllLeaveBalances: document.getElementById("edit-perm-view-leave-balances") ? document.getElementById("edit-perm-view-leave-balances").checked : false,
        canAddProduct: document.getElementById("edit-perm-add-product").checked,
        canCallForklift: document.getElementById("edit-perm-call-forklift").checked,
        canCompleteForklift: document.getElementById("edit-perm-complete-forklift").checked,
        canRequestLeave: document.getElementById("edit-perm-request-leave").checked,
        canApproveLeave: document.getElementById("edit-perm-approve-leave").checked,
        canRequestOvertime: document.getElementById("edit-perm-request-overtime") ? document.getElementById("edit-perm-request-overtime").checked : false,
        canApproveOvertime: document.getElementById("edit-perm-approve-overtime") ? document.getElementById("edit-perm-approve-overtime").checked : false,
        canAddSupply: document.getElementById("edit-perm-add-supply").checked,
        canAddMaintenance: document.getElementById("edit-perm-add-maintenance").checked,
        canAccessAdmin: (key === "ADMIN") // Sadece ve sadece ADMIN rolünde true kalabilir
      };

      appState.saveState();

      logSystemAction("ROL_GÜNCELLEME", `"${oldTitle}" rolünün başlığı "${title}" olarak güncellendi.`, { roleKey: key, oldTitle, newTitle: title });

      document.getElementById("modal-edit-role").classList.remove("show");

      this.render();
      this.populateUserModalSelects();
      this.populateEditUserModalSelects();
      if (window.portalApp) {
        window.portalApp.updateUserSessionUI();
        if (window.portalApp.admin) {
          window.portalApp.admin.render();
        }
      }
      alert(`"${title}" rolünün adı ve yetkileri başarıyla güncellendi.`);
    }
  }

  renderAuditLogsTable() {
    const tbody = document.getElementById("admin-logs-tbody");
    const countBadge = document.getElementById("log-count-badge");
    if (!tbody) return;

    const logs = appState.state.activityLogs || [];

    // Filtreleme
    const filtered = logs.filter(log => {
      // Metin arama
      if (this.filterLogSearch) {
        const q = this.filterLogSearch;
        const matchText = (log.userName || "").toLowerCase().includes(q) ||
                          (log.description || "").toLowerCase().includes(q) ||
                          (log.actionType || "").toLowerCase().includes(q) ||
                          (log.departmentName || "").toLowerCase().includes(q);
        if (!matchText) return false;
      }

      // Personel filtresi
      if (this.filterLogUser !== "ALL") {
        if (log.userName !== this.filterLogUser) return false;
      }

      // İşlem türü filtresi
      if (this.filterLogType !== "ALL") {
        if (!log.actionType.includes(this.filterLogType)) return false;
      }

      // Kural: İzleyici rolündeki kullanıcıların kayıtları yalnızca Admin tarafından görülebilir
      if (!isAdmin()) {
        const uObj = (appState.state.users || []).find(u => u.name === log.userName || u.username === log.userName);
        if (isViewer(uObj)) return false;
      }

      return true;
    });

    if (countBadge) {
      countBadge.textContent = `${filtered.length} Kayıt`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="py-8 text-center text-slate-400 text-xs italic">
            Kriterlere uygun herhangi bir denetim kaydı bulunamadı.
          </td>
        </tr>
      `;
      return;
    }

    const getActionBadge = (type) => {
      if (type.startsWith("ÜRÜN")) return '<span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">📦 ' + type + '</span>';
      if (type.startsWith("FORKLİFT")) return '<span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">🚜 ' + type + '</span>';
      if (type.startsWith("ARIZA")) return '<span class="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">🚨 ' + type + '</span>';
      if (type.startsWith("İZİN")) return '<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">🏖️ ' + type + '</span>';
      if (type.startsWith("MESAİ")) return '<span class="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">⏰ ' + type + '</span>';
      if (type.startsWith("SARF")) return '<span class="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">🛒 ' + type + '</span>';
      if (type.startsWith("TAKVİM")) return '<span class="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">📅 ' + type + '</span>';
      if (type.startsWith("DEPARTMAN")) return '<span class="bg-cyan-100 text-cyan-800 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">🏢 ' + type + '</span>';
      if (type.startsWith("KULLANICI")) return '<span class="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">👤 ' + type + '</span>';
      if (type.startsWith("ROL")) return '<span class="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">🛡️ ' + type + '</span>';
      return '<span class="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">⚙️ ' + type + '</span>';
    };

    tbody.innerHTML = filtered.map(log => {
      const d = new Date(log.timestamp);
      const dateFormatted = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
      const timeFormatted = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
          <td class="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono">
            <span class="font-bold text-slate-700">${dateFormatted}</span>
            <span class="text-slate-400 ml-1 text-[11px]">${timeFormatted}</span>
          </td>
          <td class="py-2.5 px-3 whitespace-nowrap">
            <div class="font-bold text-slate-800 flex items-center gap-1.5">
              <span class="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                ${(log.userName || "U").charAt(0)}
              </span>
              <span>${log.userName || "Bilinmiyor"}</span>
            </div>
            <div class="text-[10px] text-slate-400 ml-7">
              ${log.userRole || ""} ${log.departmentName ? "• " + log.departmentName : ""}
            </div>
          </td>
          <td class="py-2.5 px-3 whitespace-nowrap">
            ${getActionBadge(log.actionType)}
          </td>
          <td class="py-2.5 px-3 text-slate-700 font-medium">
            <div>${log.description}</div>
          </td>
        </tr>
      `;
    }).join("");
  }

  exportLogsCsv() {
    const logs = appState.state.activityLogs || [];
    if (logs.length === 0) {
      alert("Dışa aktarılacak denetim kaydı bulunmuyor.");
      return;
    }

    // UTF-8 BOM ekliyoruz (Excel'de Türkçe karakterlerin düzgün görünmesi için)
    let csvContent = "\uFEFF";
    csvContent += "Tarih;Saat;Personel;Rol;Departman;İşlem Türü;Açıklama\r\n";

    logs.forEach(log => {
      const d = new Date(log.timestamp);
      const dateFormatted = d.toLocaleDateString("tr-TR");
      const timeFormatted = d.toLocaleTimeString("tr-TR");

      const escapeCsv = (str) => {
        if (!str) return '""';
        const clean = String(str).replace(/"/g, '""').replace(/\r?\n/g, ' ');
        return `"${clean}"`;
      };

      const row = [
        escapeCsv(dateFormatted),
        escapeCsv(timeFormatted),
        escapeCsv(log.userName),
        escapeCsv(log.userRole),
        escapeCsv(log.departmentName),
        escapeCsv(log.actionType),
        escapeCsv(log.description)
      ];

      csvContent += row.join(";") + "\r\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", `sodsan-denetim-izleri-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportBackup() {
    logSystemAction("YEDEK_ALMA", "Sistem veri tabanı tam yedek dosyası (JSON) indirildi.");
    this.renderAuditLogsTable();

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(appState.exportDataJson());
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sodsan-portal-yedek-${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const success = appState.importDataJson(e.target.result);
      if (success) {
        logSystemAction("YEDEK_YÜKLEME", `"${file.name}" isimli yedek dosyası sisteme geri yüklendi.`);
        alert("Yedek başarıyla yüklendi!");
        window.location.reload();
      } else {
        alert("Geçersiz yedek dosyası!");
      }
    };
    reader.readAsText(file);
  }
}

