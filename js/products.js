// SODSAN Fabrika Portalı - Gelen / Giden Ürünler ve İletişim Akışı (products.js)
import { appState, playAlertSound, logSystemAction, registerCompany, isViewer } from './data.js';

export class ProductsModule {
  constructor() {
    this.filterDepartment = "ALL";
    this.filterType = "ALL";
    this.filterUnit = "ALL";
    this.filterCompany = "ALL";
  }

  init() {
    this.populateDepartmentSelects();
    this.populateCompanySelects();
    this.bindEvents();
    this.render();
  }

  populateDepartmentSelects() {
    const filterSelect = document.getElementById("filter-product-department");
    const modalSelect = document.getElementById("product-department");
    const editModalSelect = document.getElementById("edit-product-department");

    if (filterSelect) {
      filterSelect.innerHTML = `<option value="ALL">Tüm Departmanlar</option>`;
      appState.state.departments.forEach(dep => {
        filterSelect.innerHTML += `<option value="${dep.id}">${dep.icon} ${dep.name}</option>`;
      });
    }

    const fillSelect = (sel) => {
      if (!sel) return;
      sel.innerHTML = "";
      appState.state.departments.forEach(dep => {
        sel.innerHTML += `<option value="${dep.id}">${dep.icon} ${dep.name}</option>`;
      });
    };

    fillSelect(modalSelect);
    fillSelect(editModalSelect);
  }

  populateCompanySelects() {
    const filterCompany = document.getElementById("filter-product-company");
    const modalCompany = document.getElementById("product-company-select");
    const editModalCompany = document.getElementById("edit-product-company-select");
    const companies = appState.state.companies || [];

    if (filterCompany) {
      const currentVal = filterCompany.value || "ALL";
      filterCompany.innerHTML = `<option value="ALL">Tüm Firmalar</option>`;
      companies.forEach(comp => {
        filterCompany.innerHTML += `<option value="${comp}">${comp}</option>`;
      });
      filterCompany.value = currentVal;
    }

    const fillCompanySelect = (sel) => {
      if (!sel) return;
      const currentVal = sel.value;
      sel.innerHTML = `
        <option value="">-- Firma / Tedarikçi Seçiniz --</option>
        ${companies.map(comp => `<option value="${comp}">🏢 ${comp}</option>`).join("")}
        <option value="__NEW__">➕ [Yeni Firma Yaz ve Listeye Kaydet...]</option>
      `;
      if (currentVal && currentVal !== "__NEW__") {
        sel.value = currentVal;
      }
    };

    fillCompanySelect(modalCompany);
    fillCompanySelect(editModalCompany);
  }

  bindEvents() {
    const btnOpenModal = document.getElementById("btn-open-add-product");
    const formAdd = document.getElementById("form-add-product");
    const formEdit = document.getElementById("form-edit-product");
    const filterDep = document.getElementById("filter-product-department");
    const filterType = document.getElementById("filter-product-type");
    const filterUnit = document.getElementById("filter-product-unit");
    const filterComp = document.getElementById("filter-product-company");

    // Ekleme Modalı Firma Dinleyicileri
    const companySelect = document.getElementById("product-company-select");
    const btnToggleNewComp = document.getElementById("btn-toggle-new-company");
    const newCompWrap = document.getElementById("product-company-new-wrap");
    const newCompInput = document.getElementById("product-company-new");

    // Düzenleme Modalı Firma Dinleyicileri
    const editCompanySelect = document.getElementById("edit-product-company-select");
    const editBtnToggleNewComp = document.getElementById("btn-edit-toggle-new-company");
    const editNewCompWrap = document.getElementById("edit-product-company-new-wrap");
    const editNewCompInput = document.getElementById("edit-product-company-new");

    if (btnOpenModal) {
      btnOpenModal.addEventListener("click", () => {
        this.populateCompanySelects();
        const modal = document.getElementById("modal-add-product");
        if (modal) modal.classList.add("show");
      });
    }

    if (companySelect && newCompWrap) {
      companySelect.addEventListener("change", (e) => {
        if (e.target.value === "__NEW__") {
          newCompWrap.classList.remove("hidden");
          if (newCompInput) newCompInput.focus();
        } else {
          newCompWrap.classList.add("hidden");
          if (newCompInput) newCompInput.value = "";
        }
      });
    }

    if (btnToggleNewComp && companySelect && newCompWrap) {
      btnToggleNewComp.addEventListener("click", () => {
        companySelect.value = "__NEW__";
        newCompWrap.classList.remove("hidden");
        if (newCompInput) newCompInput.focus();
      });
    }

    if (editCompanySelect && editNewCompWrap) {
      editCompanySelect.addEventListener("change", (e) => {
        if (e.target.value === "__NEW__") {
          editNewCompWrap.classList.remove("hidden");
          if (editNewCompInput) editNewCompInput.focus();
        } else {
          editNewCompWrap.classList.add("hidden");
          if (editNewCompInput) editNewCompInput.value = "";
        }
      });
    }

    if (editBtnToggleNewComp && editCompanySelect && editNewCompWrap) {
      editBtnToggleNewComp.addEventListener("click", () => {
        editCompanySelect.value = "__NEW__";
        editNewCompWrap.classList.remove("hidden");
        if (editNewCompInput) editNewCompInput.focus();
      });
    }

    if (filterDep) {
      filterDep.addEventListener("change", (e) => {
        this.filterDepartment = e.target.value;
        this.render();
      });
    }

    if (filterType) {
      filterType.addEventListener("change", (e) => {
        this.filterType = e.target.value;
        this.render();
      });
    }

    if (filterUnit) {
      filterUnit.addEventListener("change", (e) => {
        this.filterUnit = e.target.value;
        this.render();
      });
    }

    if (filterComp) {
      filterComp.addEventListener("change", (e) => {
        this.filterCompany = e.target.value;
        this.render();
      });
    }

    if (formAdd) {
      formAdd.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveProduct();
      });
    }

    if (formEdit) {
      formEdit.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveEditedProduct();
      });
    }
  }

  isUserManager() {
    if (isViewer()) return false;
    const user = appState.state.currentUser;
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "YONETICI") return true;
    const roleDef = appState.state.roles.find(r => r.key === user.role);
    return roleDef && roleDef.permissions && roleDef.permissions.canAccessAdmin;
  }

  render() {
    const kpiContainer = document.getElementById("products-kpi-summary");
    const feedContainer = document.getElementById("products-feed-list");
    if (!feedContainer) return;

    const allProducts = appState.state.products || [];

    // Özet KPI Sayaçları (Ton ve Kg kesinlikle ayrı hücrelerde hesaplanır)
    if (kpiContainer) {
      const inCount = allProducts.filter(p => p.type === "GELEN").length;
      const outCount = allProducts.filter(p => p.type === "GIDEN").length;
      const totalTon = allProducts
        .filter(p => (p.unit || "").toLowerCase() === "ton")
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const totalKg = allProducts
        .filter(p => (p.unit || "").toLowerCase() === "kg")
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

      kpiContainer.innerHTML = `
        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div class="text-[11px] font-bold text-slate-500 uppercase">Gelen Malzeme</div>
            <div class="text-xl font-black text-emerald-600 mt-0.5">${inCount} <span class="text-xs font-semibold text-slate-400">Giriş</span></div>
          </div>
          <span class="text-2xl p-2 bg-emerald-50 rounded-lg">📥</span>
        </div>

        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div class="text-[11px] font-bold text-slate-500 uppercase">Giden Sevkiyat</div>
            <div class="text-xl font-black text-amber-600 mt-0.5">${outCount} <span class="text-xs font-semibold text-slate-400">Çıkış</span></div>
          </div>
          <span class="text-2xl p-2 bg-amber-50 rounded-lg">📤</span>
        </div>

        <div class="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm flex items-center justify-between">
          <div>
            <div class="text-[11px] font-bold text-amber-800 uppercase">Toplam TON</div>
            <div class="text-xl font-black text-amber-700 mt-0.5">
              ${totalTon.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} <span class="text-xs font-bold text-amber-900">TON</span>
            </div>
            <div class="text-[10px] text-amber-600 font-medium">Sadece Ton Birimi</div>
          </div>
          <span class="text-2xl p-2 bg-amber-100 rounded-lg">⚖️</span>
        </div>

        <div class="bg-white p-3 rounded-xl border border-teal-200 bg-teal-50/20 shadow-sm flex items-center justify-between">
          <div>
            <div class="text-[11px] font-bold text-teal-800 uppercase">Toplam KG</div>
            <div class="text-xl font-black text-teal-700 mt-0.5">
              ${totalKg.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} <span class="text-xs font-bold text-teal-900">KG</span>
            </div>
            <div class="text-[10px] text-teal-600 font-medium">Sadece Kg Birimi</div>
          </div>
          <span class="text-2xl p-2 bg-teal-100 rounded-lg">⚖️</span>
        </div>
      `;
    }

    let items = [...allProducts].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (this.filterDepartment !== "ALL") {
      items = items.filter(p => p.departmentId === this.filterDepartment);
    }

    if (this.filterType !== "ALL") {
      items = items.filter(p => p.type === this.filterType);
    }

    if (this.filterUnit !== "ALL") {
      items = items.filter(p => (p.unit || "").toLowerCase() === this.filterUnit.toLowerCase());
    }

    if (this.filterCompany !== "ALL") {
      items = items.filter(p => {
        const comp = (p.company || p.supplier || "").toLowerCase();
        return comp.includes(this.filterCompany.toLowerCase());
      });
    }

    if (items.length === 0) {
      feedContainer.innerHTML = `
        <div class="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
          <p class="text-2xl mb-1">📦</p>
          <p class="font-medium">Kayıtlı ürün hareketi bulunamadı.</p>
          <p class="text-xs mt-1">Yeni bir ürün geldiğinde veya sevk edildiğinde "Ürün Hareketi Ekle" butonunu kullanın.</p>
        </div>
      `;
      return;
    }

    const canEdit = !isViewer() && this.isUserManager();

    // TEK SATIRDA SADE VE ANLAŞILIR ÇİZELGE GÖRÜNÜMÜ
    feedContainer.innerHTML = `
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th class="py-3 px-3">Tarih / Saat</th>
                <th class="py-3 px-3">Hareket</th>
                <th class="py-3 px-3">Departman</th>
                <th class="py-3 px-3">Ürün / Malzeme</th>
                <th class="py-3 px-3 text-right">Miktar & Birim</th>
                <th class="py-3 px-3">Firma / Müşteri</th>
                <th class="py-3 px-3">İşlemi Yapan</th>
                <th class="py-3 px-3 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-xs">
              ${items.map(item => {
                const dep = appState.state.departments.find(d => d.id === item.departmentId) || { name: "Bilinmeyen", icon: "🏢" };
                const dateObj = new Date(item.date);
                const timeStr = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                const dateStr = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

                let typeBadge = "";
                if (item.type === "GELEN") {
                  typeBadge = `<span class="bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">📥 GELEN</span>`;
                } else if (item.type === "GIDEN") {
                  typeBadge = `<span class="bg-amber-100 text-amber-800 text-[11px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">📤 GİDEN</span>`;
                } else {
                  typeBadge = `<span class="bg-purple-100 text-purple-800 text-[11px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">🔄 TRANSFER</span>`;
                }

                // Ton ve Kg kesinlikle ayrılmış, bağımsız rozetler
                const unitClean = (item.unit || "").trim();
                let unitBadge = "";
                if (unitClean.toLowerCase() === "ton") {
                  unitBadge = `
                    <span class="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded font-black text-xs">
                      ${item.amount.toLocaleString('tr-TR')} TON
                    </span>
                  `;
                } else if (unitClean.toLowerCase() === "kg") {
                  unitBadge = `
                    <span class="inline-flex items-center gap-1 bg-teal-50 text-teal-900 border border-teal-300 px-2 py-0.5 rounded font-black text-xs">
                      ${item.amount.toLocaleString('tr-TR')} KG
                    </span>
                  `;
                } else {
                  unitBadge = `
                    <span class="inline-flex items-center gap-1 bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded font-bold text-xs">
                      ${item.amount} ${unitClean}
                    </span>
                  `;
                }

                const companyDisplay = item.company || item.supplier || 'Belirtilmedi';
                const invoiceDisplay = item.invoiceNo ? `<span class="text-slate-400 font-normal">(${item.invoiceNo})</span>` : '';

                return `
                  <tr class="hover:bg-slate-50/80 transition">
                    <td class="py-2.5 px-3 font-medium text-slate-600 whitespace-nowrap">
                      ${dateStr} <span class="text-slate-400 text-[11px] font-normal">${timeStr}</span>
                    </td>
                    <td class="py-2.5 px-3 whitespace-nowrap">
                      ${typeBadge}
                    </td>
                    <td class="py-2.5 px-3 whitespace-nowrap font-semibold text-slate-700">
                      ${dep.icon} ${dep.name}
                    </td>
                    <td class="py-2.5 px-3">
                      <div class="font-extrabold text-slate-900">${item.productName}</div>
                      ${item.note ? `<div class="text-[10px] text-slate-500 truncate max-w-xs" title="${item.note}">💬 ${item.note}</div>` : ''}
                    </td>
                    <td class="py-2.5 px-3 text-right whitespace-nowrap">
                      ${unitBadge}
                      ${item.unitDetail ? `<div class="text-[10px] text-slate-400 font-medium">(${item.unitDetail})</div>` : ''}
                    </td>
                    <td class="py-2.5 px-3 whitespace-nowrap font-medium text-slate-800">
                      🏢 ${companyDisplay} ${invoiceDisplay}
                    </td>
                    <td class="py-2.5 px-3 whitespace-nowrap text-slate-600">
                      👤 ${item.createdBy || 'Anonim'}
                    </td>
                    <td class="py-2.5 px-3 text-center whitespace-nowrap">
                      ${canEdit ? `
                        <div class="inline-flex items-center gap-1.5">
                          <button data-edit-product="${item.id}" class="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded text-xs transition flex items-center gap-1" title="Yönetici Düzenlemesi">
                            <span>✏️</span> <span class="hidden sm:inline">Düzenle</span>
                          </button>
                          <button data-delete-product="${item.id}" class="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2 py-1 rounded text-xs transition flex items-center gap-1" title="Yönetici Silme">
                            <span>🗑️</span> <span class="hidden sm:inline">Sil</span>
                          </button>
                        </div>
                      ` : `
                        <span class="text-slate-400 text-[11px] italic font-medium">Yalnızca İzleme</span>
                      `}
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Düzenleme dinleyicileri (Sadece Yönetici)
    feedContainer.querySelectorAll("[data-edit-product]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        if (!this.isUserManager()) {
          alert("Yetkisiz işlem: Hareket kayıtlarını sadece yöneticiler düzenleyebilir.");
          return;
        }
        const id = e.currentTarget.getAttribute("data-edit-product");
        this.openEditModal(id);
      });
    });

    // Silme dinleyicileri (Sadece Yönetici - Arşiv Loguyla Birlikte)
    feedContainer.querySelectorAll("[data-delete-product]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        if (!this.isUserManager()) {
          alert("Yetkisiz işlem: Hareket kayıtlarını sadece yöneticiler silebilir.");
          return;
        }
        const id = e.currentTarget.getAttribute("data-delete-product");
        const target = appState.state.products.find(p => p.id === id);
        if (!target) return;

        const confirmMsg = `Bu ürün hareket kaydını silmek istediğinize emin misiniz?\n\n` +
          `• Ürün: ${target.productName}\n` +
          `• Miktar: ${target.amount} ${target.unit}\n` +
          `• Firma: ${target.company || target.supplier || 'Belirtilmedi'}\n\n` +
          `⚠️ Not: Kayıt tablodan silinse dahi tüm detayları ve silen kişi bilgisi sistem log arşivinde süresiz saklanacaktır.`;

        if (confirm(confirmMsg)) {
          // Sistem Arşiv Logu - Silinse bile tüm detaylar burada kalır
          const uName = appState.state.currentUser ? appState.state.currentUser.name : "Yönetici";
          const uRole = appState.state.currentUser ? appState.state.currentUser.role : "ADMIN";
          logSystemAction(
            "ÜRÜN_SİLME",
            `[YÖNETİCİ SİLME ARŞİVİ] ${uName}, "${target.productName}" (${target.amount} ${target.unit}, Hareket: ${target.type}, Firma: ${target.company || target.supplier || '-'}, Giriş Tarihi: ${target.date}, Ekleyen: ${target.createdBy || 'Bilinmiyor'}) kaydını sildi.`,
            {
              deletedRecordId: target.id,
              productName: target.productName,
              amount: target.amount,
              unit: target.unit,
              unitDetail: target.unitDetail || '',
              type: target.type,
              company: target.company || target.supplier || '',
              invoiceNo: target.invoiceNo || '',
              originalDate: target.date,
              departmentId: target.departmentId,
              originalCreatedBy: target.createdBy || '',
              deletedBy: uName,
              deletedByUserRole: uRole,
              deletedAt: new Date().toISOString()
            }
          );

          appState.state.products = appState.state.products.filter(p => p.id !== id);
          appState.saveState();
          this.render();
        }
      });
    });
  }

  openEditModal(productId) {
    const item = appState.state.products.find(p => p.id === productId);
    if (!item) return;

    this.populateDepartmentSelects();
    this.populateCompanySelects();

    document.getElementById("edit-product-id").value = item.id;
    document.getElementById("edit-product-type").value = item.type || "GELEN";
    document.getElementById("edit-product-department").value = item.departmentId || "";
    document.getElementById("edit-product-name").value = item.productName || "";
    document.getElementById("edit-product-amount").value = item.amount || 1;
    document.getElementById("edit-product-unit").value = item.unit || "Kg";
    document.getElementById("edit-product-unit-detail").value = item.unitDetail || "";
    document.getElementById("edit-product-supplier").value = item.invoiceNo || "";
    document.getElementById("edit-product-note").value = item.note || "";

    const companySelect = document.getElementById("edit-product-company-select");
    const newCompWrap = document.getElementById("edit-product-company-new-wrap");
    const newCompInput = document.getElementById("edit-product-company-new");

    const compName = item.company || item.supplier || "";
    const companies = appState.state.companies || [];

    if (companies.includes(compName)) {
      companySelect.value = compName;
      newCompWrap.classList.add("hidden");
    } else if (compName && compName !== "Belirtilmedi") {
      companySelect.value = "__NEW__";
      newCompWrap.classList.remove("hidden");
      newCompInput.value = compName;
    } else {
      companySelect.value = "";
      newCompWrap.classList.add("hidden");
    }

    const modal = document.getElementById("modal-edit-product");
    if (modal) modal.classList.add("show");
  }

  saveEditedProduct() {
    if (isViewer()) {
      alert("İzleyici yetkisine sahipsiniz. Ürün hareketi düzenleyemezsiniz.");
      return;
    }
    const id = document.getElementById("edit-product-id").value;
    const item = appState.state.products.find(p => p.id === id);
    if (!item) return;

    const newType = document.getElementById("edit-product-type").value;
    const newDeptId = document.getElementById("edit-product-department").value;
    const newName = document.getElementById("edit-product-name").value.trim();
    const newAmount = parseFloat(document.getElementById("edit-product-amount").value) || 0;
    const newUnit = document.getElementById("edit-product-unit").value;
    const newUnitDetail = document.getElementById("edit-product-unit-detail").value.trim();
    const newInvoiceNo = document.getElementById("edit-product-supplier").value.trim();
    const newNote = document.getElementById("edit-product-note").value.trim();

    if (!newName || newAmount <= 0) {
      alert("Lütfen ürün adını ve geçerli bir miktar giriniz.");
      return;
    }

    // Firma seçimi
    const compSelect = document.getElementById("edit-product-company-select");
    const newCompInput = document.getElementById("edit-product-company-new");
    let chosenCompany = "";

    if (compSelect && compSelect.value === "__NEW__") {
      chosenCompany = newCompInput ? newCompInput.value.trim() : "";
    } else if (compSelect && compSelect.value) {
      chosenCompany = compSelect.value.trim();
    } else if (newCompInput && newCompInput.value.trim()) {
      chosenCompany = newCompInput.value.trim();
    }

    if (!chosenCompany) {
      chosenCompany = "Belirtilmedi";
    } else if (chosenCompany !== "Belirtilmedi") {
      registerCompany(chosenCompany);
      this.populateCompanySelects();
    }

    // Değişiklikleri tespit et ve logla (Yönetici Düzenlemesi Kayıt Takibi)
    const changes = [];
    if (item.productName !== newName) changes.push(`Ürün: "${item.productName}" -> "${newName}"`);
    if (item.amount !== newAmount) changes.push(`Miktar: ${item.amount} -> ${newAmount}`);
    if (item.unit !== newUnit) changes.push(`Birim: ${item.unit} -> ${newUnit}`);
    if (item.type !== newType) changes.push(`Tip: ${item.type} -> ${newType}`);
    if (item.departmentId !== newDeptId) changes.push(`Departman güncellendi`);
    if ((item.company || "") !== chosenCompany) changes.push(`Firma: "${item.company || ''}" -> "${chosenCompany}"`);
    if ((item.invoiceNo || "") !== newInvoiceNo) changes.push(`Belge/İrsaliye güncellendi`);

    item.productName = newName;
    item.amount = newAmount;
    item.unit = newUnit;
    item.type = newType;
    item.departmentId = newDeptId;
    item.unitDetail = newUnitDetail;
    const uName = appState.state.currentUser ? appState.state.currentUser.name : "Yönetici";
    item.company = chosenCompany;
    item.supplier = chosenCompany + (newInvoiceNo ? ` (${newInvoiceNo})` : "");
    item.invoiceNo = newInvoiceNo;
    item.note = newNote;
    item.lastEditedBy = uName;
    item.lastEditedAt = new Date().toISOString();

    appState.saveState();

    // Sistem günlüğüne açık ve detaylı kayıt tut
    logSystemAction(
      "ÜRÜN_DÜZENLEME",
      `Yönetici ${uName}, "${newName}" ürün hareketini güncelledi. (${changes.length > 0 ? changes.join(", ") : "Bilgiler teyit edildi"})`,
      { productId: item.id, changes, editedBy: uName }
    );

    playAlertSound("call");

    document.getElementById("form-edit-product").reset();
    document.getElementById("modal-edit-product").classList.remove("show");

    this.render();
  }

  saveProduct() {
    if (isViewer()) {
      alert("İzleyici yetkisine sahipsiniz. Ürün hareketi ekleyemezsiniz.");
      return;
    }
    const type = document.getElementById("product-type").value;
    const departmentId = document.getElementById("product-department").value;
    const productName = document.getElementById("product-name").value.trim();
    const amount = parseFloat(document.getElementById("product-amount").value) || 0;
    const unit = document.getElementById("product-unit").value;
    const unitDetail = document.getElementById("product-unit-detail").value.trim();
    const invoiceNo = document.getElementById("product-supplier") ? document.getElementById("product-supplier").value.trim() : "";
    const note = document.getElementById("product-note").value.trim();

    if (!productName || amount <= 0) {
      alert("Lütfen ürün adını ve geçerli bir miktar giriniz.");
      return;
    }

    // Firma Belirleme & Açılır Menüye Otomatik Kayıt
    const compSelect = document.getElementById("product-company-select");
    const newCompInput = document.getElementById("product-company-new");
    let chosenCompany = "";

    if (compSelect && compSelect.value === "__NEW__") {
      chosenCompany = newCompInput ? newCompInput.value.trim() : "";
    } else if (compSelect && compSelect.value) {
      chosenCompany = compSelect.value.trim();
    } else if (newCompInput && newCompInput.value.trim()) {
      chosenCompany = newCompInput.value.trim();
    }

    if (!chosenCompany) {
      chosenCompany = "Belirtilmedi";
    } else if (chosenCompany !== "Belirtilmedi") {
      registerCompany(chosenCompany);
      this.populateCompanySelects();
    }

    const typeLabel = type === 'GELEN' ? 'ürün girişini' : type === 'GIDEN' ? 'sevkiyatını' : 'iç transferini';

    const newProduct = {
      id: "p_" + Date.now(),
      date: new Date().toISOString(),
      type,
      departmentId,
      productName,
      amount,
      unit,
      unitDetail,
      company: chosenCompany,
      supplier: chosenCompany + (invoiceNo ? ` (${invoiceNo})` : ""),
      invoiceNo,
      createdBy: appState.state.currentUser ? appState.state.currentUser.name : "Fabrika Yetkilisi",
      note
    };

    appState.state.products.unshift(newProduct);
    appState.saveState();

    const uName = appState.state.currentUser ? appState.state.currentUser.name : "Fabrika Yetkilisi";
    logSystemAction(
      type === 'GELEN' ? "ÜRÜN_GİRİŞİ" : type === 'GIDEN' ? "ÜRÜN_ÇIKIŞI" : "ÜRÜN_TRANSFER",
      `${uName}, "${productName}" (${amount} ${unit}) - Firma: "${chosenCompany}" ${typeLabel} kaydetti.`,
      { productName, amount, unit, type, company: chosenCompany, invoiceNo }
    );

    playAlertSound("call");

    document.getElementById("form-add-product").reset();
    const newWrap = document.getElementById("product-company-new-wrap");
    if (newWrap) newWrap.classList.add("hidden");
    document.getElementById("modal-add-product").classList.remove("show");

    this.render();
  }
}
