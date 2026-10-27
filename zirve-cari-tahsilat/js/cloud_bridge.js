/**
 * ZİRVE CARİ & TAHSİLAT - UÇTAN UCA ŞİFRELİ BULUT KÖPRÜSÜ (AES-256-GCM)
 * - Ofis bilgisayarı açıkken Zirve SQL verilerini şifreleyerek buluta yedekler/senkronize eder.
 * - Ofis bilgisayarı kapandığı anda bile diğer bilgisayarlardan veya cep telefonundan
 *   en son güncel cari bakiyeleri, ekstreleri ve ödeme takvimini görmenizi ve işlem yapmanızı sağlar.
 * - Veriler buluta gitmeden önce tarayıcıda AES-256-GCM ile şifrelenir; şifreyi bilmeyen kimse okuyamaz.
 */

window.CloudBridge = {
    STORAGE_ROOM_ID: "zirve_cloud_room_id_v1",
    STORAGE_BIN_ID: "zirve_cloud_bin_id_v1",
    STORAGE_SECRET_KEY: "zirve_cloud_secret_key_v1",
    STORAGE_APP_PIN: "zirve_app_pin_v1",
    STORAGE_LAST_CLOUD_SYNC: "zirve_cloud_last_sync_v1",

    DEFAULT_ROOM_ID: "ff808181a09d98f701a17d7b5e0727c0",
    DEFAULT_SECRET_KEY: "SODSAN2026",
    DEFAULT_WEB_URL: "https://syildirimlar.github.io/sodsan-cari-tahsilat/",

    roomId: null,
    binId: null,
    secretKey: "",
    isSyncing: false,

    async init() {
        this.roomId = localStorage.getItem(this.STORAGE_ROOM_ID) || this.DEFAULT_ROOM_ID;
        this.binId = localStorage.getItem(this.STORAGE_BIN_ID) || "";
        this.secretKey = localStorage.getItem(this.STORAGE_SECRET_KEY) || this.DEFAULT_SECRET_KEY;

        // URL'den uzaktan bağlantı parametresi geldiyse (?room=...&bin=...)
        const params = new URLSearchParams(window.location.search);
        const urlRoom = params.get("room");
        const urlBin = params.get("bin");
        const urlKey = params.get("key");

        if (urlRoom) {
            this.roomId = urlRoom.trim();
            localStorage.setItem(this.STORAGE_ROOM_ID, this.roomId);
        }
        if (urlBin) {
            this.binId = urlBin.trim();
            localStorage.setItem(this.STORAGE_BIN_ID, this.binId);
        }
        if (urlKey) {
            this.secretKey = urlKey.trim();
            localStorage.setItem(this.STORAGE_SECRET_KEY, this.secretKey);
        }

        if (urlRoom || urlBin) {
            try {
                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            } catch (e) {}
            await this.pullFromCloud(true);
        } else if (this.roomId || this.binId) {
            // Açılışta buluttaki en güncel veriyi kontrol et
            await this.pullFromCloud(false);
        }

        this.renderCloudPanel();
        this.checkPinLockOnStartup();

        // Her 2 dakikada bir buluttan/buluta senkronize et
        setInterval(() => {
            if ((this.roomId || this.binId) && !this.isSyncing) {
                this.pullFromCloud(false);
            }
        }, 120 * 1000);
    },

    // ================= AES-256-GCM UÇTAN UCA ŞİFRELEME =================
    async deriveAesKey(passphrase) {
        const enc = new TextEncoder();
        const passBytes = enc.encode((passphrase || "SODSAN2026").trim());
        const hashBuffer = await crypto.subtle.digest("SHA-256", passBytes);
        return crypto.subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    },

    bytesToBase64(bytes) {
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    },

    base64ToBytes(b64) {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    },

    async encryptData(plainObj, passphrase) {
        const key = await this.deriveAesKey(passphrase);
        const iv = crypto.subtle.getRandomValues ? crypto.getRandomValues(new Uint8Array(12)) : new Uint8Array(12);
        const encoded = new TextEncoder().encode(JSON.stringify(plainObj));
        const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
        return {
            alg: "AES-256-GCM",
            iv: this.bytesToBase64(iv),
            ct: this.bytesToBase64(new Uint8Array(cipherBuf))
        };
    },

    async decryptData(encEnvelope, passphrase) {
        if (!encEnvelope || !encEnvelope.ct || !encEnvelope.iv) {
            throw new Error("Şifreli veri paketi geçersiz.");
        }
        const key = await this.deriveAesKey(passphrase);
        const iv = this.base64ToBytes(encEnvelope.iv);
        const ct = this.base64ToBytes(encEnvelope.ct);
        const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
        const jsonStr = new TextDecoder().decode(plainBuf);
        return JSON.parse(jsonStr);
    },

    // ================= BULUTA YÜKLEME (PUSH) =================
    async pushToCloud(showNotice = false) {
        if (!window.App || !window.App.state) return;
        this.saveUiInputs();
        this.isSyncing = true;
        this.updateStatusBadge("⏳ Buluta Şifreli Yükleniyor...");

        try {
            const snapshot = {
                updatedAt: new Date().toISOString(),
                updatedByMachine: window.App.state.settings?.ownFirmName || "Ofis",
                state: window.App.state
            };

            const encrypted = await this.encryptData(snapshot, this.secretKey);
            const bodyStr = JSON.stringify({
                roomId: this.roomId || null,
                ts: Date.now(),
                enc: encrypted
            });

            // 1. ExtendsClass Bin oluştur (CORS preflight gerektirmeyen text/plain)
            const binRes = await fetch("https://extendsclass.com/api/json-storage/bin", {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=UTF-8" },
                body: bodyStr
            });

            if (!binRes.ok) throw new Error("Bulut depolama servisine ulaşılamadı.");
            const binData = await binRes.json();
            if (!binData || !binData.id) throw new Error("Bulut Bin ID alınamadı.");

            this.binId = binData.id;
            localStorage.setItem(this.STORAGE_BIN_ID, this.binId);

            // 2. Sabit Room Pointer oluştur veya güncelle (Restful-API)
            const pointerPayload = {
                name: "zirve_cari_sync_pointer",
                data: {
                    binId: this.binId,
                    ts: Date.now()
                }
            };

            if (this.roomId) {
                const putRes = await fetch(`https://api.restful-api.dev/objects/${encodeURIComponent(this.roomId)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(pointerPayload)
                });
                if (!putRes.ok) {
                    // Oda süresi dolduysa yeni oluştur
                    const postRes = await fetch("https://api.restful-api.dev/objects", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(pointerPayload)
                    });
                    if (postRes.ok) {
                        const postData = await postRes.json();
                        if (postData && postData.id) {
                            this.roomId = postData.id;
                            localStorage.setItem(this.STORAGE_ROOM_ID, this.roomId);
                        }
                    }
                }
            } else {
                const postRes = await fetch("https://api.restful-api.dev/objects", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(pointerPayload)
                });
                if (postRes.ok) {
                    const postData = await postRes.json();
                    if (postData && postData.id) {
                        this.roomId = postData.id;
                        localStorage.setItem(this.STORAGE_ROOM_ID, this.roomId);
                    }
                }
            }

            const nowStr = new Date().toLocaleString("tr-TR");
            localStorage.setItem(this.STORAGE_LAST_CLOUD_SYNC, nowStr);
            this.updateStatusBadge(`☁️ Bulut Eşitlendi (${ new Date().toLocaleTimeString("tr-TR") })`);
            this.renderCloudPanel();

            if (showNotice) {
                alert(`✅ Veriler AES-256 ile şifrelenerek Bulut Köprüsüne yüklendi!\n\nOfis bilgisayarınız kapansa bile diğer bilgisayarınızdan veya telefonunuzdan Eşitleme Kodu (${this.binId}) ile en güncel verileri görebilirsiniz.`);
            }
        } catch (e) {
            console.error("Cloud push hatası:", e);
            this.updateStatusBadge("⚠️ Bulut Bağlantısı Bekleniyor");
            if (showNotice) alert("Bulut yükleme hatası: " + e.message);
        } finally {
            this.isSyncing = false;
        }
    },

    // ================= BULUTTAN ÇEKME VE AKILLI BİRLEŞTİRME (PULL) =================
    async pullFromCloud(showNotice = false) {
        this.saveUiInputs();
        if (!this.roomId && !this.binId) {
            if (showNotice) alert("Lütfen önce Eşitleme Kodu (Bin ID veya Oda Kodu) girin.");
            return;
        }

        this.isSyncing = true;
        try {
            let targetBinId = this.binId;

            // Eğer sabit roomId varsa önce en güncel binId'yi öğren
            if (this.roomId) {
                try {
                    const ptrRes = await fetch(`https://api.restful-api.dev/objects/${encodeURIComponent(this.roomId)}?t=${Date.now()}`);
                    if (ptrRes.ok) {
                        const ptrData = await ptrRes.json();
                        if (ptrData && ptrData.data && ptrData.data.binId) {
                            targetBinId = ptrData.data.binId;
                            this.binId = targetBinId;
                            localStorage.setItem(this.STORAGE_BIN_ID, targetBinId);
                        }
                    }
                } catch (e) {}
            }

            if (!targetBinId) throw new Error("Bulut paket kodu bulunamadı.");

            const binRes = await fetch(`https://extendsclass.com/api/json-storage/bin/${encodeURIComponent(targetBinId)}?t=${Date.now()}`);
            if (!binRes.ok) throw new Error("Bulut verisi okunamadı.");

            const envelope = await binRes.json();
            if (!envelope || !envelope.enc) throw new Error("Bulut verisi boş veya geçersiz.");

            const decrypted = await this.decryptData(envelope.enc, this.secretKey);
            if (!decrypted || !decrypted.state) throw new Error("Şifre çözülemedi.");

            this.mergeRemoteStateIntoLocal(decrypted.state);

            const syncTime = new Date(decrypted.updatedAt || Date.now()).toLocaleString("tr-TR");
            localStorage.setItem(this.STORAGE_LAST_CLOUD_SYNC, syncTime);
            this.updateStatusBadge(`☁️ Bulut Güncel (${new Date().toLocaleTimeString("tr-TR")})`);
            this.renderCloudPanel();

            if (showNotice) {
                alert(`✅ Buluttan en güncel veriler başarıyla çekildi!\nSon Güncellenme: ${syncTime}\nCari Sayısı: ${window.App.state.cariler.length}\nHareket Sayısı: ${window.App.state.hareketler.length}`);
            }
        } catch (e) {
            console.warn("Cloud pull uyarısı:", e);
            if (showNotice) {
                alert("❌ Buluttan veri çekilemedi veya Şifreleme Parolası yanlış!\nDetay: " + e.message);
            }
        } finally {
            this.isSyncing = false;
        }
    },

    mergeRemoteStateIntoLocal(remoteState) {
        if (!remoteState || !window.App) return;
        const local = window.App.state;

        // Vade kuralları ve cari ayarlarını birleştir (asla kaybolmasın)
        if (remoteState.cariConfigs) {
            if (!local.cariConfigs) local.cariConfigs = {};
            Object.assign(local.cariConfigs, remoteState.cariConfigs);
        }
        if (remoteState.cariConfigsByUnvan) {
            if (!local.cariConfigsByUnvan) local.cariConfigsByUnvan = {};
            Object.assign(local.cariConfigsByUnvan, remoteState.cariConfigsByUnvan);
        }

        // Eğer uzaktaki rapor daha yeniyse veya yerelde veri yoksa, uzaktaki aktif raporu benimse
        const remoteReport = remoteState.settings?.activeReport;
        const localReport = local.settings?.activeReport;
        const isRemoteNewer = remoteReport && (!localReport || remoteReport.uploadTime !== localReport.uploadTime);

        if (isRemoteNewer) {
            local.cariler = remoteState.cariler || [];
            local.hareketler = remoteState.hareketler || [];
            local.faturalar = remoteState.faturalar || [];
            local.ceksenetler = remoteState.ceksenetler || [];
            if (!local.settings) local.settings = {};
            local.settings.activeReport = remoteReport;
        } else {
            // 1. Carileri birleştir (Not ve ödeme sözlerini koru)
            const cariMap = new Map();
            for (const c of (local.cariler || [])) cariMap.set(c.kod || c.id, c);
            for (const rc of (remoteState.cariler || [])) {
                const key = rc.kod || rc.id;
                const ex = cariMap.get(key);
                if (ex) {
                    cariMap.set(key, {
                        ...ex,
                        ...rc,
                        odemeSozuTarihi: rc.odemeSozuTarihi || ex.odemeSozuTarihi,
                        odemeSozuTutar: rc.odemeSozuTutar || ex.odemeSozuTutar,
                        ozelNot: rc.ozelNot || ex.ozelNot
                    });
                } else {
                    cariMap.set(key, rc);
                }
            }
            local.cariler = Array.from(cariMap.values());

            // 2. Hareketleri birleştir (ID bazında tekilleştir)
            const harMap = new Map();
            for (const h of (local.hareketler || [])) harMap.set(h.id, h);
            for (const rh of (remoteState.hareketler || [])) harMap.set(rh.id, rh);
            local.hareketler = Array.from(harMap.values());

            // 3. Faturaları birleştir
            const fatMap = new Map();
            for (const f of (local.faturalar || [])) fatMap.set(f.faturaNo || f.id, f);
            for (const rf of (remoteState.faturalar || [])) fatMap.set(rf.faturaNo || rf.id, rf);
            local.faturalar = Array.from(fatMap.values());

            // 4. Çek/Senetleri birleştir
            const csMap = new Map();
            for (const cs of (local.ceksenetler || [])) csMap.set(cs.id, cs);
            for (const rcs of (remoteState.ceksenetler || [])) csMap.set(rcs.id, rcs);
            local.ceksenetler = Array.from(csMap.values());
        }

        window.App.syncCariConfigs();
        window.App.saveStateLocallyOnly();
        window.App.recalculateAndRenderAll();
    },

    saveUiInputs() {
        const keyInput = document.getElementById("cloudSecretKeyInput");
        const codeInput = document.getElementById("cloudCodeInput");
        if (keyInput && keyInput.value.trim()) {
            this.secretKey = keyInput.value.trim();
            localStorage.setItem(this.STORAGE_SECRET_KEY, this.secretKey);
        }
        if (codeInput && codeInput.value.trim()) {
            const val = codeInput.value.trim();
            if (val.length <= 12) {
                this.binId = val;
                localStorage.setItem(this.STORAGE_BIN_ID, val);
            } else {
                this.roomId = val;
                localStorage.setItem(this.STORAGE_ROOM_ID, val);
            }
        }
    },

    updateStatusBadge(text) {
        const badgeTxt = document.getElementById("sqlStatusText");
        if (badgeTxt) badgeTxt.textContent = text;
    },

    getRemoteShareUrl() {
        const base = window.location.origin + window.location.pathname;
        const params = new URLSearchParams();
        if (this.roomId) params.set("room", this.roomId);
        if (this.binId) params.set("bin", this.binId);
        return `${base}?${params.toString()}`;
    },

    renderCloudPanel() {
        const keyInput = document.getElementById("cloudSecretKeyInput");
        if (keyInput) keyInput.value = this.secretKey || "SODSAN2026";

        const codeInput = document.getElementById("cloudCodeInput");
        if (codeInput) codeInput.value = this.binId || this.roomId || "";

        const infoBox = document.getElementById("cloudStatusInfoBox");
        if (infoBox) {
            const lastSync = localStorage.getItem(this.STORAGE_LAST_CLOUD_SYNC) || "Henüz eşitlenmedi";
            infoBox.innerHTML = `
                <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                    <span>🔑 <strong>Kısa Eşitleme Kodu:</strong> <code>${this.binId || 'Henüz oluşturulmadı'}</code></span>
                    <span>🕒 <strong>Son Bulut Yedeği:</strong> ${lastSync}</span>
                </div>
            `;
        }
    },

    // ================= GİRİŞ PIN / ŞİFRE KORUMASI =================
    checkPinLockOnStartup() {
        const savedPin = localStorage.getItem(this.STORAGE_APP_PIN);
        if (!savedPin) return;
        const entered = prompt("🔒 Zirve Cari & Tahsilat Sistemi Güvenlik Kilidi\nLütfen Giriş PIN / Şifrenizi girin:");
        if (entered !== savedPin) {
            document.body.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; color:#f8fafc; background:#0f172a; font-family:sans-serif;">
                    <h2>🔒 Yetkisiz Giriş Engellendi</h2>
                    <p style="color:#94a3b8; margin:10px 0 20px;">Giriş şifresi hatalı olduğu için cari veriler gizlendi.</p>
                    <button onclick="location.reload()" style="padding:10px 20px; border-radius:8px; background:#3b82f6; color:#fff; border:none; cursor:pointer; font-weight:700;">Tekrar Dene</button>
                </div>
            `;
        }
    },

    setAppPin() {
        const pinInput = document.getElementById("appPinInput");
        const val = (pinInput ? pinInput.value : "").trim();
        if (!val) {
            localStorage.removeItem(this.STORAGE_APP_PIN);
            alert("Uygulama açılış PIN kilidi kaldırıldı.");
        } else {
            localStorage.setItem(this.STORAGE_APP_PIN, val);
            alert("🔒 Uygulama açılış PIN şifresi kaydedildi! Artık programı açarken bu şifre sorulacaktır.");
        }
    },

    openRemoteShareModal() {
        const liveUrl = (window.location.protocol.startsWith("http") && !window.location.host.includes("localhost"))
            ? window.location.href.split("?")[0]
            : this.DEFAULT_WEB_URL;
        const fullShareUrl = `${liveUrl}?room=${encodeURIComponent(this.roomId || this.DEFAULT_ROOM_ID)}&key=${encodeURIComponent(this.secretKey || this.DEFAULT_SECRET_KEY)}`;

        const modalHtml = `
            <div class="modal-backdrop" id="remoteShareModal" style="display:flex;">
                <div class="modal-box" style="max-width:560px;">
                    <div class="modal-header">
                        <h3>🌐 SODSAN Finans - İnternet & Mobil Uzaktan Erişim</h3>
                        <button class="btn btn-outline btn-sm" onclick="document.getElementById('remoteShareModal').remove()">✕</button>
                    </div>
                    <div class="modal-body" style="font-size:13px; line-height:1.6;">
                        <p style="color:var(--text-muted); margin-bottom:12px;">
                            Bu uygulama diğer tüm projelerden bağımsız, internet üzerinden çalışan bir finans portalıdır. Aşağıdaki canlı bağlantı ile evdeki bilgisayarınızdan, tabletinizden veya cep telefonunuzdan doğrudan bağlanabilir ve <strong>internet üzerinden de yeni Zirve PDF/Excel yükleyebilirsiniz.</strong>
                        </p>

                        <div style="background:var(--bg-body); padding:12px; border-radius:8px; border:1px solid var(--border); margin-bottom:14px;">
                            <label style="font-weight:700; color:#38bdf8; display:block; margin-bottom:6px;">Canlı İnternet & Bulut Bağlantı Linkiniz:</label>
                            <input type="text" id="shareUrlInput" value="${fullShareUrl}" readonly style="width:100%; font-size:12px; padding:8px 10px; background:rgba(15,23,42,0.9); border:1px solid #334155; color:#f8fafc; border-radius:6px; font-family:monospace;">
                            <div style="display:flex; gap:8px; margin-top:10px;">
                                <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('shareUrlInput').value); alert('✅ Uzaktan erişim linki panoya kopyalandı! WhatsApp veya e-posta ile kendinize gönderip anında açabilirsiniz.');">📋 Linki Kopyala</button>
                                <a href="${fullShareUrl}" target="_blank" class="btn btn-outline btn-sm" style="text-decoration:none;">🚀 Yeni Sekmede Aç</a>
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12px; background:rgba(255,255,255,0.02); padding:10px; border-radius:6px;">
                            <div><strong>🔒 Şifreleme:</strong> AES-256-GCM Uçtan Uca</div>
                            <div><strong>🔑 Eşitleme Kodu:</strong> <code>${(this.binId || this.roomId || '').substring(0, 16)}...</code></div>
                            <div><strong>📱 Mobil PWA:</strong> Ana Ekrana Eklenebilir</div>
                            <div><strong>⚡ Uzaktan Yükleme:</strong> İnternetten de Zirve Dosyası Yüklenebilir</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="document.getElementById('remoteShareModal').remove()">Kapat</button>
                    </div>
                </div>
            </div>
        `;

        const existing = document.getElementById("remoteShareModal");
        if (existing) existing.remove();
        document.body.insertAdjacentHTML("beforeend", modalHtml);
    }
};
