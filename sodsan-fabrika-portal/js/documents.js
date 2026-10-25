// SODSAN Fabrika Portalı - KVKK & Kurumsal Formlar ve E-İmza Modülü (documents.js)
import { appState, isIdariIslerOrAdmin, isAdmin, logSystemAction } from './data.js';

export class DocumentsModule {
  constructor() {
    this.pendingDocsQueue = [];
    this.currentPendingIndex = 0;
    this.canvas = null;
    this.ctx = null;
    this.isDrawing = false;
    this.hasSignatureDrawn = false;
    this.eventsBound = false;
  }

  init() {
    this.bindEvents();
    this.initSignaturePad();
    this.render();
  }

  bindEvents() {
    if (this.eventsBound) return;
    this.eventsBound = true;

    // 1. İK Alt Sekmeler Arasında "KVKK & Kurumsal Formlar" Butonu
    const subtabBtnDocs = document.getElementById("subtab-btn-docs");
    if (subtabBtnDocs) {
      subtabBtnDocs.addEventListener("click", () => {
        this.switchIkSubtabToDocs();
      });
    }

    // 2. Yeni Form Ekle Butonu (Admin / İdari)
    const btnOpenAddDoc = document.getElementById("btn-open-add-document");
    if (btnOpenAddDoc) {
      btnOpenAddDoc.addEventListener("click", () => {
        this.openAddDocumentModal();
      });
    }

    // 3. Form Ekleme / Düzenleme Formu Gönderimi
    const formAddEditDoc = document.getElementById("form-add-edit-document");
    if (formAddEditDoc) {
      formAddEditDoc.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveDocumentSubmit();
      });
    }

    // 4. Zorunlu İmza Formu Onay ve Gönderimi
    const formMandatorySig = document.getElementById("form-mandatory-e-signature");
    if (formMandatorySig) {
      formMandatorySig.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSignatureSubmit();
      });
    }

    // 5. İmzayı Temizle Butonu
    const btnClearSig = document.getElementById("btn-clear-signature");
    if (btnClearSig) {
      btnClearSig.addEventListener("click", () => {
        this.clearSignaturePad();
      });
    }

    // 6. Arşiv Arama ve Filtreleme Dinleyicileri
    const searchInput = document.getElementById("filter-docs-search");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        this.renderSignedArchive();
      });
    }

    const catFilter = document.getElementById("filter-docs-category");
    if (catFilter) {
      catFilter.addEventListener("change", () => {
        this.renderSignedArchive();
      });
    }

    // Mustafa Kara adına sehven atılan imzaların arayüzden ve depodan silinmesi
    if (appState && typeof appState.deleteSignaturesForUser === "function") {
      appState.deleteSignaturesForUser("u_1792690211697");
      appState.deleteSignaturesForUser("Mustafa Kara");
    }
  }

  switchIkSubtabToDocs() {
    // İK alt sekmelerinin buton stillerini ve panellerini güncelle
    const subtabBtns = [
      document.getElementById("subtab-btn-leave"),
      document.getElementById("subtab-btn-overtime"),
      document.getElementById("subtab-btn-catering"),
      document.getElementById("subtab-btn-shuttle"),
      document.getElementById("subtab-btn-docs")
    ];

    const subpanes = [
      document.getElementById("subpane-leave"),
      document.getElementById("subpane-overtime"),
      document.getElementById("subpane-catering"),
      document.getElementById("subpane-shuttle"),
      document.getElementById("subpane-docs")
    ];

    subtabBtns.forEach(btn => {
      if (!btn) return;
      btn.className = "px-3 sm:px-4 py-2 rounded-md text-xs font-bold transition flex items-center gap-1.5 text-slate-600 hover:text-slate-900 cursor-pointer";
    });

    const activeBtn = document.getElementById("subtab-btn-docs");
    if (activeBtn) {
      activeBtn.className = "px-3 sm:px-4 py-2 rounded-md text-xs font-bold transition flex items-center gap-1.5 bg-white text-blue-700 shadow-sm cursor-pointer";
    }

    subpanes.forEach(p => {
      if (p) p.classList.add("hidden");
    });

    const activePane = document.getElementById("subpane-docs");
    if (activePane) {
      activePane.classList.remove("hidden");
    }

    this.render();
  }

  // ==========================================
  // DOKUNMATİK / FARE İMZA TUVALİ (CANVAS PAD)
  // ==========================================
  initSignaturePad() {
    this.canvas = document.getElementById("signature-canvas");
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) return;

    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.strokeStyle = "#0f172a"; // Koyu kurumsal lacivert / siyah

    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      if (e.touches && e.touches[0]) {
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const pos = getPos(e);
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
      this.hasSignatureDrawn = true;
    };

    const endDraw = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      this.isDrawing = false;
    };

    // Fare Olayları
    this.canvas.addEventListener("mousedown", startDraw);
    this.canvas.addEventListener("mousemove", draw);
    window.addEventListener("mouseup", endDraw);

    // Dokunmatik (Mobil / Tablet) Olayları
    this.canvas.addEventListener("touchstart", startDraw, { passive: false });
    this.canvas.addEventListener("touchmove", draw, { passive: false });
    this.canvas.addEventListener("touchend", endDraw, { passive: false });
  }

  clearSignaturePad() {
    if (!this.canvas || !this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.hasSignatureDrawn = false;
  }

  // İmzayı ultra hafif boyuta (240x90 monokrom) sıkıştırarak ~1 KB'lık veri üretir
  getCompressedSignatureData() {
    if (!this.canvas || !this.hasSignatureDrawn) return "";

    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = 240;
    thumbCanvas.height = 90;
    const thumbCtx = thumbCanvas.getContext("2d");

    // Beyaz arkaplan ver
    thumbCtx.fillStyle = "#ffffff";
    thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);

    // Ana imzayı küçülterek çiz
    thumbCtx.drawImage(this.canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

    // Yüksek verimli JPEG / WebP sıkıştırması
    return thumbCanvas.toDataURL("image/jpeg", 0.6);
  }

  // ==========================================
  // İLK GİRİŞTE & GÜNCELLEMEDE ZORUNLU İMZA KONTROLÜ
  // ==========================================
  checkPendingSignaturesAndPrompt(currentUser) {
    if (!currentUser) return;

    const pendingDocs = appState.getPendingDocumentsForUser(currentUser);
    if (pendingDocs.length === 0) {
      // Bekleyen imza yok
      return;
    }

    this.pendingDocsQueue = pendingDocs;
    this.currentPendingIndex = 0;
    this.showPendingDocumentInModal(this.currentPendingIndex);
  }

  showPendingDocumentInModal(index) {
    const doc = this.pendingDocsQueue[index];
    if (!doc) {
      // Tüm bekleyen evraklar imzalandı!
      const modal = document.getElementById("modal-mandatory-e-signature");
      if (modal) modal.classList.remove("show");
      alert("✅ Tüm kurumsal evraklar ve KVKK onayınız başarıyla sisteme kaydedildi. Hoş geldiniz!");
      this.render();
      return;
    }

    const modal = document.getElementById("modal-mandatory-e-signature");
    if (!modal) return;

    // Bilgileri Doldur
    const titleEl = document.getElementById("mandatory-sig-doc-title");
    const versionEl = document.getElementById("mandatory-sig-doc-version");
    const countEl = document.getElementById("mandatory-sig-counter");
    const contentEl = document.getElementById("mandatory-sig-content");
    const userBoxEl = document.getElementById("mandatory-sig-user-name");
    const checkbox = document.getElementById("mandatory-sig-checkbox");

    if (titleEl) titleEl.textContent = doc.title;
    if (versionEl) versionEl.textContent = `Sürüm: ${doc.version} (${doc.category})`;
    if (countEl) countEl.textContent = `Evrak ${index + 1} / ${this.pendingDocsQueue.length}`;
    if (contentEl) contentEl.textContent = doc.content;
    if (userBoxEl) userBoxEl.textContent = (appState.state.currentUser && appState.state.currentUser.name) || "Çalışan Personel";
    if (checkbox) checkbox.checked = false;

    this.clearSignaturePad();
    modal.classList.add("show");
  }

  handleSignatureSubmit() {
    const checkbox = document.getElementById("mandatory-sig-checkbox");
    if (!checkbox || !checkbox.checked) {
      alert("Lütfen metni okuduğunuzu ve onayladığınızı belirten kutucuğu işaretleyiniz!");
      return;
    }

    if (!this.hasSignatureDrawn) {
      alert("Lütfen aşağıdaki imza alanına parmağınız veya fareniz ile imzanızı atınız!");
      return;
    }

    const doc = this.pendingDocsQueue[this.currentPendingIndex];
    if (!doc) return;

    const compressedSig = this.getCompressedSignatureData();
    const curUser = appState.state.currentUser;

    appState.saveDocumentSignature({
      userId: curUser.id,
      userName: curUser.name,
      userRole: curUser.role,
      documentId: doc.id,
      documentTitle: doc.title,
      documentVersion: doc.version,
      signatureImage: compressedSig
    });

    // Sonraki evraka geç
    this.currentPendingIndex++;
    this.showPendingDocumentInModal(this.currentPendingIndex);
  }

  // ==========================================
  // KURUMSAL FORM EKLEME & DÜZENLEME (ADMİN / İDARİ)
  // ==========================================
  openAddDocumentModal() {
    if (!isIdariIslerOrAdmin()) {
      alert("Yetki Hatası: Yalnızca İdari Personel veya Yönetici kurumsal form ekleyebilir!");
      return;
    }

    const modal = document.getElementById("modal-add-edit-document");
    const form = document.getElementById("form-add-edit-document");
    const titleEl = document.getElementById("modal-doc-form-title");
    if (!modal || !form) return;

    form.reset();
    document.getElementById("doc-form-id").value = "";
    document.getElementById("doc-form-version").value = "1.0";
    document.getElementById("doc-form-mandatory").checked = true;
    if (titleEl) titleEl.textContent = "📋 Yeni Kurumsal Form / Evrak Ekle";

    modal.classList.add("show");
  }

  openEditDocumentModal(docId) {
    if (!isIdariIslerOrAdmin()) {
      alert("Yetki Hatası: Yalnızca İdari Personel veya Yönetici kurumsal form düzenleyebilir!");
      return;
    }

    const doc = (appState.state.corporateDocuments || []).find(d => d.id === docId);
    if (!doc) return;

    const modal = document.getElementById("modal-add-edit-document");
    const form = document.getElementById("form-add-edit-document");
    const titleEl = document.getElementById("modal-doc-form-title");
    if (!modal || !form) return;

    document.getElementById("doc-form-id").value = doc.id;
    document.getElementById("doc-form-title").value = doc.title || "";
    document.getElementById("doc-form-category").value = doc.category || "Genel";
    
    // Düzenlemede bir sonraki versiyon öner (örn: 1.0 ise 1.1 öner)
    const verNum = parseFloat(doc.version || "1.0");
    const nextVer = isNaN(verNum) ? "1.1" : (verNum + 0.1).toFixed(1);
    document.getElementById("doc-form-version").value = nextVer;
    
    document.getElementById("doc-form-mandatory").checked = doc.mandatory !== false;
    document.getElementById("doc-form-summary").value = doc.summary || "";
    document.getElementById("doc-form-content").value = doc.content || "";

    if (titleEl) titleEl.textContent = `✏️ Form Düzenle: ${doc.title}`;

    modal.classList.add("show");
  }

  handleSaveDocumentSubmit() {
    if (!isIdariIslerOrAdmin()) {
      alert("Yetki Hatası: Kurumsal form kaydetme yetkiniz bulunmamaktadır!");
      return;
    }

    const id = document.getElementById("doc-form-id").value;
    const title = (document.getElementById("doc-form-title").value || "").trim();
    const category = (document.getElementById("doc-form-category").value || "").trim();
    const version = (document.getElementById("doc-form-version").value || "").trim() || "1.0";
    const mandatory = document.getElementById("doc-form-mandatory").checked;
    const summary = (document.getElementById("doc-form-summary").value || "").trim();
    const content = (document.getElementById("doc-form-content").value || "").trim();

    if (!title || !content) {
      alert("Lütfen en azından Form Başlığı ve Form Metnini giriniz!");
      return;
    }

    const savedDoc = appState.saveCorporateDocument({
      id: id || undefined,
      title,
      category,
      version,
      mandatory,
      active: true,
      summary,
      content
    });

    const modal = document.getElementById("modal-add-edit-document");
    if (modal) modal.classList.remove("show");

    this.render();
    alert(`✅ "${savedDoc.title}" kurumsal formu başarıyla kaydedildi! (Sürüm: ${savedDoc.version})\nPersoneller sisteme girdiğinde bu güncel sürüm için imza istenecektir.`);
  }

  deleteDocument(docId) {
    if (!isIdariIslerOrAdmin()) {
      alert("Yetki Hatası: Kurumsal formu yalnızca İdari Personel veya Yönetici silebilir!");
      return;
    }

    const doc = (appState.state.corporateDocuments || []).find(d => d.id === docId);
    if (!doc) return;

    if (confirm(`"${doc.title} (${doc.version})" formunu silmek istediğinize emin misiniz?`)) {
      appState.deleteCorporateDocument(docId);
      this.render();
      alert("Form sistemden kaldırıldı.");
    }
  }

  deleteSignedDocument(sigId) {
    if (!isIdariIslerOrAdmin()) {
      alert("Yetki Hatası: İmzalı evrakı yalnızca İdari Personel veya Yönetici iptal edebilir!");
      return;
    }
    const sig = (appState.state.signedDocuments || []).find(s => s.id === sigId);
    if (!sig) return;

    if (confirm(`"${sig.userName}" personeline ait "${sig.documentTitle} (${sig.documentVersion})" form imzasını iptal edip kalıcı olarak silmek istediğinize emin misiniz?`)) {
      appState.deleteSignedDocument(sigId);
      this.render();
      alert("✅ İmzalı form kaydı iptal edildi ve sistemden silindi.");
    }
  }

  // ==========================================
  // İMZALI EVRAK İNCELEME & YAZDIRMA
  // ==========================================
  openViewSignedDocumentModal(sigId) {
    const sig = (appState.state.signedDocuments || []).find(s => s.id === sigId);
    if (!sig) return;

    const doc = (appState.state.corporateDocuments || []).find(d => d.id === sig.documentId);
    const contentText = doc ? doc.content : "Evrak metni sistemde kayıtlıdır.";

    const modal = document.getElementById("modal-view-signed-doc");
    if (!modal) return;

    const titleEl = document.getElementById("view-signed-doc-title");
    const metaEl = document.getElementById("view-signed-doc-meta");
    const contentEl = document.getElementById("view-signed-doc-content");
    const sigImgEl = document.getElementById("view-signed-doc-img");
    const signerNameEl = document.getElementById("view-signed-doc-signer");
    const signDateEl = document.getElementById("view-signed-doc-date");

    if (titleEl) titleEl.textContent = sig.documentTitle;
    if (metaEl) metaEl.textContent = `Sürüm: ${sig.documentVersion} • Onay Referansı: ${sig.id}`;
    if (contentEl) contentEl.textContent = contentText;
    if (signerNameEl) signerNameEl.textContent = sig.userName + ` (${sig.userRole || 'Çalışan'})`;
    if (signDateEl) signDateEl.textContent = new Date(sig.signedAt).toLocaleString("tr-TR");

    if (sigImgEl) {
      if (sig.signatureImage) {
        sigImgEl.src = sig.signatureImage;
        sigImgEl.classList.remove("hidden");
      } else {
        sigImgEl.classList.add("hidden");
      }
    }

    modal.classList.add("show");
  }

  // ==========================================
  // RENDER METOTLARI
  // ==========================================
  render() {
    this.renderDocumentDefinitions();
    this.renderSignedArchive();
    this.renderUserPendingAlert();
  }

  renderDocumentDefinitions() {
    const container = document.getElementById("docs-definition-list");
    if (!container) return;

    const list = appState.state.corporateDocuments || [];
    const canManage = isIdariIslerOrAdmin();
    const signedList = appState.state.signedDocuments || [];
    const totalUsers = (appState.state.users || []).filter(u => u.role !== "ADMIN").length || 1;

    // Yetki Butonu Kontrolü
    const btnAdd = document.getElementById("btn-open-add-document");
    if (btnAdd) {
      btnAdd.style.display = canManage ? "" : "none";
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <span class="text-3xl block mb-2">📋</span>
          <p class="text-xs font-bold text-slate-700">Henüz kurumsal form tanımlanmadı.</p>
          ${canManage ? `<button onclick="window.portalApp.documentsModule.openAddDocumentModal()" class="mt-2 bg-blue-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm">İlk Formu Ekle</button>` : ''}
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(doc => {
      // Bu belgenin bu sürümünü imzalayan personel sayısı
      const signedCount = signedList.filter(s => s.documentId === doc.id && s.documentVersion === doc.version).length;
      const pct = Math.min(100, Math.round((signedCount / totalUsers) * 100));

      return `
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-3">
          <div>
            <div class="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div>
                <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${doc.category === 'KVKK' ? 'bg-indigo-100 text-indigo-800' : doc.category === 'İSG' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}">
                  ${doc.category || 'Genel'}
                </span>
                <h4 class="font-black text-slate-900 dark:text-white text-sm sm:text-base mt-1.5 flex items-center gap-1.5">
                  <span>📄</span> <span>${doc.title}</span>
                </h4>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                  v${doc.version}
                </span>
                ${doc.mandatory ? `
                  <span class="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                    Zorunlu
                  </span>
                ` : ''}
              </div>
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
              ${doc.summary || doc.content.substring(0, 150) + '...'}
            </p>
          </div>

          <!-- İmza İlerleme Çubuğu -->
          <div class="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
            <div class="flex items-center justify-between font-bold mb-1">
              <span class="text-slate-600 dark:text-slate-300">İmzalayan Personel:</span>
              <span class="text-blue-700 dark:text-blue-400 font-black">${signedCount} / ${totalUsers} Kişi (%${pct})</span>
            </div>
            <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div class="bg-blue-600 h-2 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
            </div>
          </div>

          <!-- Aksiyon Butonları -->
          <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
            <button type="button" onclick="window.portalApp.documentsModule.openPreviewDocModal('${doc.id}')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-xl transition flex items-center gap-1 cursor-pointer">
              <span>👁️</span> <span>Metni Gör</span>
            </button>

            ${canManage ? `
              <div class="flex items-center gap-1.5">
                <button type="button" onclick="window.portalApp.documentsModule.openEditDocumentModal('${doc.id}')" class="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-1.5 px-3 rounded-xl transition flex items-center gap-1 cursor-pointer">
                  <span>✏️</span> <span>Düzenle (Yeni Sürüm)</span>
                </button>
                <button type="button" onclick="window.portalApp.documentsModule.deleteDocument('${doc.id}')" class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer" title="Sil">
                  🗑️
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join("");
  }

  openPreviewDocModal(docId) {
    const doc = (appState.state.corporateDocuments || []).find(d => d.id === docId);
    if (!doc) return;

    const modal = document.getElementById("modal-view-signed-doc");
    if (!modal) return;

    document.getElementById("view-signed-doc-title").textContent = doc.title;
    document.getElementById("view-signed-doc-meta").textContent = `Kategori: ${doc.category} • Sürüm: ${doc.version}`;
    document.getElementById("view-signed-doc-content").textContent = doc.content;
    document.getElementById("view-signed-doc-signer").textContent = "Şablon Metin Önizlemesi";
    document.getElementById("view-signed-doc-date").textContent = new Date(doc.updatedAt).toLocaleDateString("tr-TR");
    
    const sigImg = document.getElementById("view-signed-doc-img");
    if (sigImg) sigImg.classList.add("hidden");

    modal.classList.add("show");
  }

  renderSignedArchive() {
    const container = document.getElementById("docs-signed-archive-tbody");
    if (!container) return;

    const signedList = appState.state.signedDocuments || [];
    const searchVal = (document.getElementById("filter-docs-search")?.value || "").toLowerCase().trim();
    const catVal = (document.getElementById("filter-docs-category")?.value || "ALL");
    const currentUser = appState.state.currentUser;
    const canManage = isIdariIslerOrAdmin();

    let filtered = signedList.filter(s => {
      // Eğer normal personel ise sadece kendi imzaladığı belgeleri görsün
      if (!canManage && currentUser) {
        if (s.userId !== currentUser.id && s.userName.toLowerCase() !== currentUser.name.toLowerCase()) return false;
      }

      if (searchVal) {
        const matchesUser = s.userName && s.userName.toLowerCase().includes(searchVal);
        const matchesDoc = s.documentTitle && s.documentTitle.toLowerCase().includes(searchVal);
        if (!matchesUser && !matchesDoc) return false;
      }

      if (catVal !== "ALL") {
        const doc = (appState.state.corporateDocuments || []).find(d => d.id === s.documentId);
        if (!doc || doc.category !== catVal) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="5" class="p-8 text-center text-slate-400 text-xs">
            ${signedList.length === 0 ? "Henüz dijital imzalanmış onaylı evrak kaydı bulunmamaktadır." : "Arama kriterine uygun imzalı evrak bulunamadı."}
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = filtered.map(s => {
      return `
        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
          <td class="p-3">
            <div class="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>👤</span> <span>${s.userName}</span>
            </div>
            <div class="text-[10px] text-slate-400 font-mono">${s.userRole || 'PERSONEL'}</div>
          </td>
          <td class="p-3">
            <div class="font-extrabold text-xs text-blue-700 dark:text-blue-400">${s.documentTitle}</div>
            <div class="text-[10px] text-slate-400">Sürüm: ${s.documentVersion}</div>
          </td>
          <td class="p-3 text-xs text-slate-600 dark:text-slate-300">
            ${new Date(s.signedAt).toLocaleString("tr-TR")}
          </td>
          <td class="p-3">
            ${s.signatureImage ? `
              <div class="bg-white border border-slate-200 rounded p-1 inline-block shadow-2xs">
                <img src="${s.signatureImage}" alt="İmza" class="h-6 w-auto max-w-[100px] object-contain">
              </div>
            ` : '<span class="text-xs text-slate-400">Elektronik Onaylı</span>'}
          </td>
          <td class="p-3 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button type="button" onclick="window.portalApp.documentsModule.openViewSignedDocumentModal('${s.id}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs py-1.5 px-2.5 rounded-lg transition flex items-center gap-1 cursor-pointer">
                <span>📜</span> <span>İncele / Yazdır</span>
              </button>
              ${canManage ? `
                <button type="button" onclick="window.portalApp.documentsModule.deleteSignedDocument('${s.id}')" class="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs py-1.5 px-2.5 rounded-lg transition flex items-center gap-1 cursor-pointer" title="İmzayı İptal Et ve Sil">
                  <span>🗑️</span> <span>İptal Et</span>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  renderUserPendingAlert() {
    const alertBox = document.getElementById("user-pending-docs-banner");
    if (!alertBox) return;

    const curUser = appState.state.currentUser;
    if (!curUser) {
      alertBox.classList.add("hidden");
      return;
    }

    const pending = appState.getPendingDocumentsForUser(curUser);
    if (pending.length === 0) {
      alertBox.classList.add("hidden");
    } else {
      alertBox.classList.remove("hidden");
      alertBox.innerHTML = `
        <div class="bg-gradient-to-r from-rose-500 to-amber-600 text-white p-3 sm:p-4 rounded-2xl shadow-md flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl sm:text-3xl">✍️</span>
            <div>
              <div class="text-xs sm:text-sm font-black flex items-center gap-2">
                <span>İMZALAMANIZ GEREKEN ${pending.length} KURUMSAL FORM VAR!</span>
                <span class="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full">Zorunlu</span>
              </div>
              <p class="text-xs text-rose-100 mt-0.5">
                KVKK veya fabrika iç yönergesinde güncellenen/eklenen evraklar bulunmaktadır.
              </p>
            </div>
          </div>
          <button type="button" onclick="window.portalApp.documentsModule.checkPendingSignaturesAndPrompt(window.__sodsanAppState.state.currentUser)" class="bg-white hover:bg-rose-50 text-rose-800 font-black text-xs py-2 px-4 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0 active:scale-95">
            <span>✍️</span> <span>Şimdi İmzala</span> &rarr;
          </button>
        </div>
      `;
    }
  }
}
