// SODSAN Fabrika Portalı - Sarf Malzeme ve İhtiyaç Panosu (supplies.js)
import { appState, playAlertSound, logSystemAction, isViewer } from './data.js';

export class SuppliesModule {
  constructor() {
    this.filterStatus = "ALL";
  }

  init() {
    this.populateDepartmentSelect();
    this.bindEvents();
    this.render();
  }

  populateDepartmentSelect() {
    const depSelect = document.getElementById("supply-department");
    if (depSelect) {
      depSelect.innerHTML = "";
      appState.state.departments.forEach(dep => {
        depSelect.innerHTML += `<option value="${dep.id}">${dep.icon} ${dep.name}</option>`;
      });
    }
  }

  bindEvents() {
    const btnOpenModal = document.getElementById("btn-open-add-supply");
    const form = document.getElementById("form-add-supply");
    const filterStatus = document.getElementById("filter-supply-status");

    if (btnOpenModal) {
      btnOpenModal.addEventListener("click", () => {
        const modal = document.getElementById("modal-add-supply");
        if (modal) {
          // Varsayılan olarak kullanıcının departmanı seçili gelsin
          const depSelect = document.getElementById("supply-department");
          if (depSelect && appState.state.currentUser && appState.state.currentUser.departmentId) {
            depSelect.value = appState.state.currentUser.departmentId;
          }
          modal.classList.add("show");
        }
      });
    }

    if (filterStatus) {
      filterStatus.addEventListener("change", (e) => {
        this.filterStatus = e.target.value;
        this.render();
      });
    }

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveSupply();
      });
    }
  }

  render() {
    const container = document.getElementById("supplies-list");
    if (!container) return;

    let items = [...appState.state.supplies].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (this.filterStatus !== "ALL") {
      items = items.filter(s => s.status === this.filterStatus);
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
          <p class="text-2xl mb-1">🛒</p>
          <p class="font-medium">Kayıtlı sarf malzeme ihtiyacı bulunmuyor.</p>
          <p class="text-xs mt-1">Koli bandı, poşet, kelepçe gibi malzeme ihtiyaçları için yukarıdaki butonu kullanın.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => {
      const dep = appState.state.departments.find(d => d.id === item.departmentId) || { name: "Bilinmeyen", icon: "🏢" };
      
      let statusBadge = "";
      if (item.status === "Talep Edildi") {
        statusBadge = `<span class="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">🟡 Talep Edildi</span>`;
      } else if (item.status === "Sipariş Verildi") {
        statusBadge = `<span class="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-bold">🔵 Sipariş Verildi</span>`;
      } else {
        statusBadge = `<span class="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">🟢 Teslim Edildi</span>`;
      }

      const isUrgent = item.urgency === "Acil";

      return `
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3 relative overflow-hidden">
          ${isUrgent ? `<div class="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-extrabold px-3 py-0.5 rounded-bl-lg">ACİL İHTİYAÇ</div>` : ''}

          <div>
            <div class="flex items-center gap-2 mb-1.5">
              <span>${dep.icon}</span>
              <span class="text-xs font-bold text-slate-600">${dep.name}</span>
            </div>

            <h4 class="font-extrabold text-slate-900 text-base">${item.itemName}</h4>
            <div class="mt-1 flex items-baseline gap-2">
              <span class="text-xl font-extrabold text-blue-600">${item.amount}</span>
              <span class="text-xs font-semibold text-slate-500">${item.unit}</span>
            </div>

            ${item.note ? `
              <p class="text-xs text-slate-600 bg-slate-50 p-2 rounded mt-2 border border-slate-100">
                💬 ${item.note}
              </p>
            ` : ''}
          </div>

          <div class="border-t border-slate-100 pt-3 space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-1">
              ${statusBadge}
              <div class="text-[11px] text-slate-500">
                <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">Talep Eden: ${item.requestedBy}</span>
              </div>
            </div>

            ${item.updatedBy ? `
              <div class="text-[10px] text-blue-700 bg-blue-50/70 px-2 py-0.5 rounded font-semibold border border-blue-100">
                ⚡ Son İşlem Yapan: <b>${item.updatedBy}</b> (${item.status})
              </div>
            ` : ''}

            <div class="flex gap-1.5 pt-1">
              ${!isViewer() ? `
                ${item.status !== "Sipariş Verildi" && item.status !== "Teslim Edildi" ? `
                  <button data-status-supply="${item.id}" data-new-status="Sipariş Verildi" class="flex-1 text-xs py-1.5 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-semibold transition">
                    Sipariş Verildi
                  </button>
                ` : ''}
                ${item.status !== "Teslim Edildi" ? `
                  <button data-status-supply="${item.id}" data-new-status="Teslim Edildi" class="flex-1 text-xs py-1.5 px-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-semibold transition">
                    Teslim Edildi
                  </button>
                ` : ''}
                <button data-delete-supply="${item.id}" class="text-xs py-1.5 px-2 text-slate-400 hover:text-red-600 rounded" title="Sil">
                  ✕
                </button>
              ` : `
                <span class="text-[11px] text-slate-400 italic">Yalnızca İzleme</span>
              `}
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Durum Değiştirme ve Silme Dinleyicileri
    container.querySelectorAll("[data-status-supply]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-status-supply");
        const newStatus = e.currentTarget.getAttribute("data-new-status");
        const target = appState.state.supplies.find(s => s.id === id);
        if (target) {
          const uName = appState.state.currentUser ? appState.state.currentUser.name : "Yetkili";
          target.status = newStatus;
          target.updatedBy = uName;
          appState.saveState();
          logSystemAction("SARF_GÜNCELLEME", `${uName}, "${target.itemName}" talebini "${newStatus}" olarak güncelledi.`, { supplyId: target.id, newStatus, item: target.itemName });
          this.render();
        }
      });
    });

    container.querySelectorAll("[data-delete-supply]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-delete-supply");
        const target = appState.state.supplies.find(s => s.id === id);
        if (confirm("Bu sarf malzeme talebini silmek istediğinize emin misiniz?")) {
          if (target) {
            const uName = appState.state.currentUser ? appState.state.currentUser.name : "Yetkili";
            logSystemAction("SARF_SİLME", `${uName}, "${target.itemName}" sarf malzeme talebini sildi.`);
          }
          appState.state.supplies = appState.state.supplies.filter(s => s.id !== id);
          appState.saveState();
          this.render();
        }
      });
    });
  }

  saveSupply() {
    if (isViewer()) {
      alert("İzleyici yetkisine sahipsiniz. Sarf malzeme talebi açamazsınız.");
      return;
    }
    const departmentId = document.getElementById("supply-department").value;
    const itemName = document.getElementById("supply-name").value.trim();
    const amount = parseFloat(document.getElementById("supply-amount").value) || 1;
    const unit = document.getElementById("supply-unit").value;
    const urgency = document.getElementById("supply-urgency").value;
    const note = document.getElementById("supply-note").value.trim();

    if (!itemName) {
      alert("Lütfen talep edilen malzeme adını giriniz.");
      return;
    }

    const uName = appState.state.currentUser ? appState.state.currentUser.name : "Personel";
    const newSupply = {
      id: "sup_" + Date.now(),
      departmentId,
      requestedBy: uName,
      itemName,
      amount,
      unit,
      urgency,
      status: "Talep Edildi",
      date: new Date().toISOString(),
      note
    };

    appState.state.supplies.unshift(newSupply);
    appState.saveState();

    logSystemAction("SARF_TALEP", `${uName}, "${itemName}" (${amount} ${unit}) sarf malzeme talebi açtı.`, { itemName, amount, unit, urgency });

    playAlertSound("call");

    document.getElementById("form-add-supply").reset();
    document.getElementById("modal-add-supply").classList.remove("show");

    this.render();
  }
}
