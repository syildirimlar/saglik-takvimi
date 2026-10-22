/**
 * UBL-TR (GİB / Zirve e-Fatura & e-Arşiv) XML Ayrıştırıcı
 * Hem Zirve XML klasöründen okunan hem de sürükle-bırak ile yüklenen XML faturaları
 * Cari Kart + Cari Hareket + Fatura Detayı olarak ayrıştırır.
 */

window.UblParser = {
    getText(parent, localName) {
        if (!parent) return "";
        const els = parent.getElementsByTagName("*");
        for (let i = 0; i < els.length; i++) {
            const ln = els[i].localName || els[i].tagName.split(":").pop();
            if (ln === localName) {
                return (els[i].textContent || "").trim();
            }
        }
        return "";
    },

    getDirectChildText(parent, localName) {
        if (!parent || !parent.children) return "";
        for (let i = 0; i < parent.children.length; i++) {
            const ch = parent.children[i];
            const ln = ch.localName || ch.tagName.split(":").pop();
            if (ln === localName) {
                return (ch.textContent || "").trim();
            }
        }
        return "";
    },

    findFirstNode(parent, localName) {
        if (!parent) return null;
        const els = parent.getElementsByTagName("*");
        for (let i = 0; i < els.length; i++) {
            const ln = els[i].localName || els[i].tagName.split(":").pop();
            if (ln === localName) return els[i];
        }
        return null;
    },

    findAllNodes(parent, localName) {
        const result = [];
        if (!parent) return result;
        const els = parent.getElementsByTagName("*");
        for (let i = 0; i < els.length; i++) {
            const ln = els[i].localName || els[i].tagName.split(":").pop();
            if (ln === localName) result.push(els[i]);
        }
        return result;
    },

    extractParty(partyNode) {
        if (!partyNode) return { unvan: "", vkn: "", vergiDairesi: "", sehir: "", tel: "", email: "" };
        const party = this.findFirstNode(partyNode, "Party") || partyNode;

        let vkn = "";
        const partyIds = this.findAllNodes(party, "PartyIdentification");
        for (const pid of partyIds) {
            const idEl = this.findFirstNode(pid, "ID");
            if (idEl) {
                const scheme = (idEl.getAttribute("schemeID") || "").toUpperCase();
                const val = (idEl.textContent || "").trim();
                if (scheme === "VKN" || scheme === "TCKN" || /^\d{10,11}$/.test(val)) {
                    vkn = val;
                    break;
                }
            }
        }

        let unvan = "";
        const partyNameNode = this.findFirstNode(party, "PartyName");
        if (partyNameNode) {
            unvan = this.getText(partyNameNode, "Name");
        }
        if (!unvan) {
            const personNode = this.findFirstNode(party, "Person");
            if (personNode) {
                const first = this.getText(personNode, "FirstName");
                const fam = this.getText(personNode, "FamilyName");
                unvan = `${first} ${fam}`.trim();
            }
        }

        const taxScheme = this.findFirstNode(party, "TaxScheme");
        const vergiDairesi = taxScheme ? this.getText(taxScheme, "Name") : "";
        const address = this.findFirstNode(party, "PostalAddress");
        const sehir = address ? this.getText(address, "CityName") : "";
        const contact = this.findFirstNode(party, "Contact");
        const tel = contact ? this.getText(contact, "Telephone") : "";
        const email = contact ? this.getText(contact, "ElectronicMail") : "";

        return { unvan, vkn, vergiDairesi, sehir, tel, email };
    },

    parseXml(xmlString, ownFirmVkn = "", ownFirmName = "") {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, "application/xml");
        if (doc.getElementsByTagName("parsererror").length > 0) {
            throw new Error("Geçersiz XML formatı");
        }

        const root = doc.documentElement;
        const faturaNo = this.getDirectChildText(root, "ID") || this.getText(root, "ID");
        const ettn = this.getDirectChildText(root, "UUID") || this.getText(root, "UUID");
        const tarih = this.getDirectChildText(root, "IssueDate") || this.getText(root, "IssueDate");
        const faturaTipKodu = (this.getDirectChildText(root, "InvoiceTypeCode") || "SATIS").toUpperCase();
        const profilId = (this.getDirectChildText(root, "ProfileID") || "TICARIFATURA").toUpperCase();
        const doviz = (this.getDirectChildText(root, "DocumentCurrencyCode") || "TRY").toUpperCase();

        // Döviz kuru
        let kur = 1.0;
        const exRateNode = this.findFirstNode(root, "PricingExchangeRate") || this.findFirstNode(root, "PaymentExchangeRate");
        if (exRateNode) {
            const rateTxt = this.getText(exRateNode, "CalculationRate");
            if (rateTxt && !isNaN(parseFloat(rateTxt))) {
                kur = parseFloat(rateTxt);
            }
        }

        // Vade tarihi
        let vadeTarihi = "";
        const payMeans = this.findFirstNode(root, "PaymentMeans");
        if (payMeans) {
            vadeTarihi = this.getText(payMeans, "PaymentDueDate");
        }

        const supplier = this.extractParty(this.findFirstNode(root, "AccountingSupplierParty"));
        const customer = this.extractParty(this.findFirstNode(root, "AccountingCustomerParty"));

        // Parasal toplamlar
        const monetary = this.findFirstNode(root, "LegalMonetaryTotal");
        const malHizmetToplam = monetary ? parseFloat(this.getText(monetary, "LineExtensionAmount") || "0") : 0;
        const vergiHaricToplam = monetary ? parseFloat(this.getText(monetary, "TaxExclusiveAmount") || "0") : malHizmetToplam;
        const vergiDahilToplam = monetary ? parseFloat(this.getText(monetary, "TaxInclusiveAmount") || "0") : 0;
        const odenecekTutar = monetary ? parseFloat(this.getText(monetary, "PayableAmount") || "0") : vergiDahilToplam;

        const taxTotalNode = this.findFirstNode(root, "TaxTotal");
        const kdvTutar = taxTotalNode ? parseFloat(this.getText(taxTotalNode, "TaxAmount") || "0") : Math.max(0, odenecekTutar - vergiHaricToplam);

        // Alış mı Satış mı belirle
        let yon = "ALIS"; // Varsayılan: Gelen fatura (Alış)
        const cleanOwnVkn = (ownFirmVkn || "").replace(/\D/g, "");
        const cleanOwnName = (ownFirmName || "").toUpperCase().trim();

        if (cleanOwnVkn && supplier.vkn === cleanOwnVkn) {
            yon = "SATIS";
        } else if (cleanOwnVkn && customer.vkn === cleanOwnVkn) {
            yon = "ALIS";
        } else if (cleanOwnName && supplier.unvan.toUpperCase().includes(cleanOwnName)) {
            yon = "SATIS";
        } else if (cleanOwnName && customer.unvan.toUpperCase().includes(cleanOwnName)) {
            yon = "ALIS";
        }

        const karsiTaraf = yon === "SATIS" ? customer : supplier;

        // Kalemler
        const lines = [];
        const lineNodes = this.findAllNodes(root, "InvoiceLine");
        for (const ln of lineNodes) {
            const itemNode = this.findFirstNode(ln, "Item");
            const kalemAd = itemNode ? (this.getText(itemNode, "Name") || this.getText(itemNode, "Description")) : "Mal/Hizmet";
            const miktar = parseFloat(this.getText(ln, "InvoicedQuantity") || "1");
            const satirTutar = parseFloat(this.getText(ln, "LineExtensionAmount") || "0");
            const priceNode = this.findFirstNode(ln, "Price");
            const birimFiyat = priceNode ? parseFloat(this.getText(priceNode, "PriceAmount") || "0") : (miktar ? satirTutar / miktar : satirTutar);
            lines.push({
                ad: kalemAd,
                miktar: isNaN(miktar) ? 1 : miktar,
                birimFiyat: isNaN(birimFiyat) ? 0 : birimFiyat,
                tutar: isNaN(satirTutar) ? 0 : satirTutar
            });
        }

        const notNodes = this.findAllNodes(root, "Note");
        const notlar = notNodes.map(n => (n.textContent || "").trim()).filter(Boolean).join(" | ");

        return {
            faturaNo: faturaNo || ("FTR-" + Math.floor(Math.random() * 90000 + 10000)),
            ettn: ettn || "",
            tarih: tarih || new Date().toISOString().slice(0, 10),
            vadeTarihi: vadeTarihi || "",
            yon, // "SATIS" veya "ALIS"
            faturaTipKodu,
            profilId,
            doviz: doviz === "TRL" ? "TRY" : doviz,
            kur: kur || 1,
            matrah: isNaN(vergiHaricToplam) ? 0 : vergiHaricToplam,
            kdv: isNaN(kdvTutar) ? 0 : kdvTutar,
            genelToplam: isNaN(odenecekTutar) ? 0 : odenecekTutar,
            tlTutar: Math.round((isNaN(odenecekTutar) ? 0 : odenecekTutar) * (doviz === "TRY" || doviz === "TRL" ? 1 : kur) * 100) / 100,
            karsiTaraf,
            supplier,
            customer,
            kalemler: lines,
            aciklama: notlar
        };
    }
};
