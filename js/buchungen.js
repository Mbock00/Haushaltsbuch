// ═══════════════════════════════════════════
// Buchungen – Laden, Anzeigen, Erstellen
// ═══════════════════════════════════════════

let alleBuchungen = [];
let buchungenFilter = 'alle';
let buchungenSuche = '';

// ── Buchungen laden ──
async function ladeBuchungen(monat = null, jahr = null) {
  if (!currentUser) return [];
  let query = db.from('buchungen')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('datum', { ascending: false });
  if (monat !== null && jahr !== null) {
    const von = `${jahr}-${String(monat+1).padStart(2,'0')}-01`;
    const bis = new Date(jahr, monat+1, 0).toISOString().split('T')[0];
    query = query.gte('datum', von).lte('datum', bis);
  }
  const { data, error } = await query.limit(500);
  if (error) { console.error(error); return []; }
  return data || [];
}

// ── Buchungen-Screen ──
async function renderBuchungen() {
  const screen = document.getElementById('screen-buchungen');
  screen.innerHTML = `
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input type="text" placeholder="Suchen..." id="buchung-search" value="${buchungenSuche}">
    </div>
    <div class="filter-chips">
      <button class="chip ${buchungenFilter==='alle'?'active':''}"     onclick="setBuchungFilter('alle')">Alle</button>
      <button class="chip ${buchungenFilter==='Einnahme'?'active':''}" onclick="setBuchungFilter('Einnahme')">💰 Einnahmen</button>
      <button class="chip ${buchungenFilter==='Ausgabe'?'active':''}"  onclick="setBuchungFilter('Ausgabe')">💸 Ausgaben</button>
      <button class="chip ${buchungenFilter==='Sparen'?'active':''}"   onclick="setBuchungFilter('Sparen')">🐷 Sparen</button>
    </div>
    <div id="buchungen-liste" class="buchung-liste">
      <div class="loading"><div class="spinner"></div></div>
    </div>
    <button class="btn-fab" onclick="openBuchungModal()">＋</button>
  `;
  document.getElementById('buchung-search').addEventListener('input', e => {
    buchungenSuche = e.target.value;
    renderBuchungenListe();
  });
  alleBuchungen = await ladeBuchungen();
  renderBuchungenListe();
}

function renderBuchungenListe() {
  const liste = document.getElementById('buchungen-liste');
  if (!liste) return;
  let gefiltert = alleBuchungen;
  if (buchungenFilter !== 'alle') gefiltert = gefiltert.filter(b => b.art === buchungenFilter);
  if (buchungenSuche) {
    const s = buchungenSuche.toLowerCase();
    gefiltert = gefiltert.filter(b =>
      b.beschreibung?.toLowerCase().includes(s) || b.kategorie?.toLowerCase().includes(s)
    );
  }
  if (gefiltert.length === 0) {
    liste.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>Keine Buchungen gefunden</p></div>`;
    return;
  }
  const gruppen = {};
  gefiltert.forEach(b => { if (!gruppen[b.datum]) gruppen[b.datum] = []; gruppen[b.datum].push(b); });
  let html = '';
  Object.keys(gruppen).sort((a,b) => b.localeCompare(a)).forEach(datum => {
    html += `<div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);padding:8px 4px 4px;">${formatDatum(datum)}</div>`;
    gruppen[datum].forEach(b => {
      html += `
        <div class="buchung-item" onclick="openBuchungDetail('${b.id}')">
          <div class="buchung-dot ${b.art.toLowerCase()}">${katEmoji(b.kategorie)}</div>
          <div class="buchung-info">
            <div class="buchung-beschr">${b.beschreibung || b.kategorie}</div>
            <div class="buchung-meta">${b.kategorie} · ${b.art}</div>
          </div>
          <div class="buchung-betrag ${b.art.toLowerCase()}">${b.art==='Einnahme'?'+':'−'}${formatEuro(b.betrag)}</div>
        </div>`;
    });
  });
  liste.innerHTML = html;
}

function setBuchungFilter(filter) {
  buchungenFilter = filter;
  renderBuchungen();
}

// ── Buchung Modal ──
async function openBuchungModal(prefill = {}) {
  const kategorien = await ladeKategorien();
  const heute = prefill.datum || heuteISO();
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-title">${prefill.id ? 'Buchung bearbeiten' : 'Neue Buchung'}</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Art der Buchung</label>
          <div class="art-selector">
            <button class="art-btn ${(!prefill.art||prefill.art==='Ausgabe')?'active ausgabe':''}" data-art="Ausgabe" onclick="selectArt('Ausgabe')">
              <span class="art-emoji">💸</span>Ausgabe
            </button>
            <button class="art-btn ${prefill.art==='Einnahme'?'active einnahme':''}" data-art="Einnahme" onclick="selectArt('Einnahme')">
              <span class="art-emoji">💰</span>Einnahme
            </button>
            <button class="art-btn ${prefill.art==='Sparen'?'active sparen':''}" data-art="Sparen" onclick="selectArt('Sparen')">
              <span class="art-emoji">🐷</span>Sparen
            </button>
          </div>
          <input type="hidden" id="buchung-art" value="${prefill.art||'Ausgabe'}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Datum</label>
            <input type="date" class="form-input" id="buchung-datum" value="${heute}">
          </div>
          <div class="form-group">
            <label class="form-label">Betrag (€)</label>
            <input type="number" class="form-input" id="buchung-betrag" placeholder="0,00" step="0.01" min="0.01" value="${prefill.betrag||''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Kategorie</label>
          <select class="form-select" id="buchung-kategorie">
            ${kategorien.map(k=>`<option value="${k.name}" ${k.name===prefill.kategorie?'selected':''}>${katEmoji(k.name)} ${k.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Beschreibung (optional)</label>
          <input type="text" class="form-input" id="buchung-beschr" placeholder="z.B. REWE Einkauf" value="${prefill.beschreibung||''}">
        </div>

        <!-- Beleg Scanner -->
        <div class="form-group">
          <label class="form-label">📷 Beleg scannen (optional)</label>
          <div class="scanner-area" onclick="document.getElementById('beleg-input').click()">
            <div class="scanner-icon">📄</div>
            <div class="scanner-text">Foto aufnehmen oder Datei wählen<br><small>Betrag, Datum & Händler werden automatisch erkannt</small></div>
          </div>
          <input type="file" id="beleg-input" accept="image/*" capture="environment" style="display:none" onchange="handleBelegUpload(this)">
          <div id="beleg-preview-container"></div>
          <div id="scan-result"></div>
        </div>

        <div style="display:flex;gap:10px;margin-top:8px;">
          ${prefill.id ? `<button class="btn btn-danger btn-sm" onclick="loescheBuchung('${prefill.id}')">🗑️ Löschen</button>` : ''}
          <button class="btn btn-secondary" onclick="closeModal()" style="flex:1">Abbrechen</button>
          <button class="btn btn-primary" onclick="speichereBuchung('${prefill.id||''}')" style="flex:2">
            ${prefill.id ? '💾 Speichern' : '✅ Buchen'}
          </button>
        </div>
      </div>
    </div>`;
  openModal();
}

function selectArt(art) {
  document.getElementById('buchung-art').value = art;
  document.querySelectorAll('.art-btn').forEach(b => {
    b.classList.remove('active','einnahme','ausgabe','sparen');
    if (b.dataset.art === art) b.classList.add('active', art.toLowerCase());
  });
}

// ── Buchung speichern ──
async function speichereBuchung(id = '') {
  const art       = document.getElementById('buchung-art').value;
  const datum     = document.getElementById('buchung-datum').value;
  const betrag    = parseFloat(document.getElementById('buchung-betrag').value);
  const kategorie = document.getElementById('buchung-kategorie').value;
  const beschr    = document.getElementById('buchung-beschr').value.trim();
  if (!datum)             { showToast('Bitte Datum eingeben', 'error'); return; }
  if (!betrag || betrag<=0){ showToast('Bitte gültigen Betrag eingeben', 'error'); return; }
  if (!kategorie)         { showToast('Bitte Kategorie wählen', 'error'); return; }
  const payload = {
    user_id: currentUser.id, art, datum, betrag, kategorie,
    beschreibung: beschr || null,
    beleg_url: window._belegUrl || null
  };
  let error;
  if (id) { ({ error } = await db.from('buchungen').update(payload).eq('id', id)); }
  else    { ({ error } = await db.from('buchungen').insert(payload)); }
  if (error) { showToast('Fehler beim Speichern: ' + error.message, 'error'); return; }
  window._belegUrl = null;
  closeModal();
  showToast(id ? 'Buchung aktualisiert ✅' : 'Buchung gespeichert ✅', 'success');
  alleBuchungen = await ladeBuchungen();
  renderBuchungenListe();
  if (document.getElementById('screen-dashboard').classList.contains('active')) renderDashboard();
}

async function loescheBuchung(id) {
  if (!confirm('Buchung wirklich löschen?')) return;
  const { error } = await db.from('buchungen').delete().eq('id', id);
  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
  closeModal();
  showToast('Buchung gelöscht 🗑️', 'info');
  alleBuchungen = await ladeBuchungen();
  renderBuchungenListe();
}

async function openBuchungDetail(id) {
  const b = alleBuchungen.find(x => x.id === id);
  if (b) openBuchungModal(b);
}

async function ladeKategorien() {
  if (!currentUser) return [];
  const { data } = await db.from('kategorien').select('*').eq('user_id', currentUser.id).order('gruppe').order('name');
  return data || [];
}

// ══════════════════════════════════════════
// BELEG SCANNER – Google Vision OCR
// ══════════════════════════════════════════

async function handleBelegUpload(input) {
  const file = input.files[0];
  if (!file) return;

  // Schritt 1: Bild komprimieren
  setScanStep('compress');
  const komprimiert = await komprimiereBeleg(file);

  // Vorschau anzeigen
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('beleg-preview-container').innerHTML =
      `<img src="${e.target.result}" class="beleg-preview" alt="Beleg">`;
  };
  reader.readAsDataURL(komprimiert);

  // Schritt 2: Upload
  setScanStep('upload');
  const pfad = `${currentUser.id}/${Date.now()}.jpg`;
  const { error: uploadError } = await db.storage.from('belege').upload(pfad, komprimiert, {
    contentType: 'image/jpeg', upsert: false
  });
  if (uploadError) {
    showToast('Upload fehlgeschlagen: ' + uploadError.message, 'error');
    clearScanSteps();
    return;
  }
  window._belegUrl = pfad;

  // Schritt 3: OCR
  setScanStep('ocr');
  await scanMitGoogleVision(komprimiert);
}

// ── Bild komprimieren (max 800px, JPEG 75%) ──
function komprimiereBeleg(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxSize = 800;
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else       { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        resolve(blob || file);
      }, 'image/jpeg', 0.75);
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

// ── Google Vision OCR ──
async function scanMitGoogleVision(file) {
  const resultDiv = document.getElementById('scan-result');

  if (!GOOGLE_VISION_KEY || GOOGLE_VISION_KEY === 'DEIN_GOOGLE_VISION_KEY') {
    // Kein API-Key – manuelle Eingabe
    resultDiv.innerHTML = `
      <div style="background:var(--warning-light);border:1.5px solid var(--warning);border-radius:var(--radius);padding:14px;font-size:0.85rem;color:var(--text);">
        ⚠️ <strong>Kein Scanner-Key hinterlegt</strong><br>
        Bitte Betrag, Datum und Beschreibung manuell eintragen.<br>
        <small style="color:var(--text-muted);">Beleg wurde gespeichert ✅</small>
      </div>`;
    return;
  }

  try {
    // Bild zu Base64
    const base64 = await fileToBase64(file);

    // Google Vision API aufrufen
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }]
          }]
        })
      }
    );

    if (!response.ok) throw new Error(`API Fehler: ${response.status}`);
    const data = await response.json();
    const text = data.responses?.[0]?.fullTextAnnotation?.text || '';

    if (!text) throw new Error('Kein Text erkannt');

    // Text auswerten
    setScanStep('analyse');
    const ergebnis = analysiereKassenzettel(text);

    // Felder befüllen
    if (ergebnis.betrag)    document.getElementById('buchung-betrag').value = ergebnis.betrag;
    if (ergebnis.datum)     document.getElementById('buchung-datum').value  = ergebnis.datum;
    if (ergebnis.haendler)  document.getElementById('buchung-beschr').value = ergebnis.haendler;
    if (ergebnis.kategorie) {
      const sel = document.getElementById('buchung-kategorie');
      for (let opt of sel.options) {
        if (opt.value === ergebnis.kategorie) { sel.value = ergebnis.kategorie; break; }
      }
    }

    resultDiv.innerHTML = `
      <div class="scanner-result">
        ✅ <strong>Erkannt:</strong>
        ${ergebnis.haendler ? `<strong>${ergebnis.haendler}</strong>` : ''}
        ${ergebnis.betrag   ? `· <strong>${formatEuro(ergebnis.betrag)}</strong>` : ''}
        ${ergebnis.datum    ? `· ${formatDatum(ergebnis.datum)}` : ''}
        <br><small style="color:var(--text-muted);">Bitte Angaben prüfen und ggf. korrigieren</small>
      </div>`;

  } catch (err) {
    console.error('Scanner Fehler:', err);
    resultDiv.innerHTML = `
      <div style="background:var(--warning-light);border:1.5px solid var(--warning);border-radius:var(--radius);padding:14px;font-size:0.85rem;">
        ⚠️ Automatische Erkennung fehlgeschlagen – bitte manuell ausfüllen.<br>
        <small style="color:var(--text-muted);">Beleg wurde gespeichert ✅</small>
      </div>`;
  }
}

// ── Kassenzettel-Text analysieren ──
function analysiereKassenzettel(text) {
  const zeilen = text.split('\n').map(z => z.trim()).filter(z => z);
  const ergebnis = { betrag: null, datum: null, haendler: null, kategorie: null };

  // Betrag finden (größter Geldbetrag = Gesamtbetrag)
  const betragsRegex = /(\d{1,4}[.,]\d{2})\s*[€$]?/g;
  const betraege = [];
  let match;
  while ((match = betragsRegex.exec(text)) !== null) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (val > 0 && val < 10000) betraege.push(val);
  }
  // Suche nach "Gesamt", "Total", "Summe", "Zu zahlen"
  const gesamtZeile = zeilen.find(z =>
    /gesamt|total|summe|zu zahlen|betrag|endbetrag/i.test(z)
  );
  if (gesamtZeile) {
    const m = gesamtZeile.match(/(\d{1,4}[.,]\d{2})/);
    if (m) ergebnis.betrag = parseFloat(m[1].replace(',', '.'));
  }
  if (!ergebnis.betrag && betraege.length > 0) {
    ergebnis.betrag = Math.max(...betraege);
  }

  // Datum finden
  const datumRegexe = [
    /(\d{2})\.(\d{2})\.(\d{4})/,   // DD.MM.YYYY
    /(\d{2})\.(\d{2})\.(\d{2})/,   // DD.MM.YY
    /(\d{4})-(\d{2})-(\d{2})/,     // YYYY-MM-DD
    /(\d{2})\/(\d{2})\/(\d{4})/,   // DD/MM/YYYY
  ];
  for (const regex of datumRegexe) {
    const m = text.match(regex);
    if (m) {
      try {
        let tag, monat, jahr;
        if (regex.source.startsWith('(\\d{4})')) {
          [, jahr, monat, tag] = m;
        } else if (regex.source.includes('-')) {
          [, jahr, monat, tag] = m;
        } else {
          [, tag, monat, jahr] = m;
          if (jahr.length === 2) jahr = '20' + jahr;
        }
        const d = new Date(`${jahr}-${monat}-${tag}`);
        if (!isNaN(d.getTime()) && d.getFullYear() >= 2020) {
          ergebnis.datum = `${jahr}-${monat}-${tag}`;
          break;
        }
      } catch(e) {}
    }
  }

  // Händler finden (erste nicht-leere Zeile, max 30 Zeichen)
  const haendlerKandidaten = zeilen.slice(0, 5).filter(z =>
    z.length > 2 && z.length < 40 &&
    !/^\d/.test(z) &&
    !/datum|uhrzeit|kasse|bon|beleg|mwst|ust/i.test(z)
  );
  if (haendlerKandidaten.length > 0) {
    ergebnis.haendler = haendlerKandidaten[0]
      .replace(/[^a-zA-ZäöüÄÖÜß\s&\-\.]/g, '')
      .trim()
      .substring(0, 30);
  }

  // Kategorie aus Händlername ableiten
  const haendlerLower = (ergebnis.haendler || '').toLowerCase();
  const kategorieMap = [
    { keywords: ['rewe','edeka','aldi','lidl','penny','netto','kaufland','tegut','dm','rossmann','müller'], kat: 'Lebensmittel' },
    { keywords: ['dm','rossmann','müller','budni','douglas'], kat: 'Drogerie' },
    { keywords: ['restaurant','pizza','burger','mcdonalds','kfc','subway','döner','asia','sushi','bistro','café','cafe','bäcker','backerei'], kat: 'Restaurants' },
    { keywords: ['zara','h&m','c&a','primark','saturn','mediamarkt','zalando','deichmann'], kat: 'Kleidung' },
    { keywords: ['shell','aral','bp','esso','total','tankstelle','bahn','db','mvv','hvv','bvg','uber','taxi'], kat: 'Mobilität' },
    { keywords: ['apotheke','arzt','zahnarzt','krankenhaus','optiker','sanitäts'], kat: 'Gesundheit' },
    { keywords: ['kino','theater','konzert','sport','fitness','gym','steam','netflix','spotify'], kat: 'Freizeit' },
    { keywords: ['amazon','ebay','otto','ikea','bauhaus','obi','hornbach'], kat: 'Ungeplante Ausgaben' },
  ];
  for (const { keywords, kat } of kategorieMap) {
    if (keywords.some(k => haendlerLower.includes(k))) {
      ergebnis.kategorie = kat;
      break;
    }
  }

  return ergebnis;
}

// ── Scan-Schritte UI ──
function setScanStep(schritt) {
  const resultDiv = document.getElementById('scan-result');
  if (!resultDiv) return;
  const schritte = {
    compress: { icon: '🗜️', text: 'Bild wird komprimiert...' },
    upload:   { icon: '☁️', text: 'Beleg wird hochgeladen...' },
    ocr:      { icon: '🔍', text: 'Text wird erkannt...' },
    analyse:  { icon: '🧠', text: 'Daten werden ausgewertet...' },
  };
  const s = schritte[schritt];
  if (!s) return;
  resultDiv.innerHTML = `
    <div class="scanner-loading">
      <div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>
      <span>${s.icon} ${s.text}</span>
    </div>`;
}

function clearScanSteps() {
  const resultDiv = document.getElementById('scan-result');
  if (resultDiv) resultDiv.innerHTML = '';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Google Vision API Key ──
// Eintragen nach Einrichtung in der Google Cloud Console
const GOOGLE_VISION_KEY = 'DEIN_GOOGLE_VISION_KEY';