// ═══════════════════════════════════════════
// Buchungen – Laden, Anzeigen, Erstellen
// ═══════════════════════════════════════════

let alleBuchungen = [];
let buchungenFilter = 'alle';
let buchungenSuche = '';
let aktiveBuchungId = null;

// ── Buchungen laden ──
async function ladeBuchungen(monat = null, jahr = null) {
  if (!currentUser) return [];

  let query = db.from('buchungen')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('datum', { ascending: false });

  if (monat !== null && jahr !== null) {
    const von  = `${jahr}-${String(monat+1).padStart(2,'0')}-01`;
    const bis  = new Date(jahr, monat+1, 0).toISOString().split('T')[0];
    query = query.gte('datum', von).lte('datum', bis);
  }

  const { data, error } = await query.limit(500);
  if (error) { console.error(error); return []; }
  return data || [];
}

// ── Buchungen-Screen rendern ──
async function renderBuchungen() {
  const screen = document.getElementById('screen-buchungen');
  screen.innerHTML = `
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input type="text" placeholder="Suchen..." id="buchung-search" value="${buchungenSuche}">
    </div>
    <div class="filter-chips">
      <button class="chip ${buchungenFilter==='alle'?'active':''}" onclick="setBuchungFilter('alle')">Alle</button>
      <button class="chip ${buchungenFilter==='Einnahme'?'active':''}" onclick="setBuchungFilter('Einnahme')">💰 Einnahmen</button>
      <button class="chip ${buchungenFilter==='Ausgabe'?'active':''}" onclick="setBuchungFilter('Ausgabe')">💸 Ausgaben</button>
      <button class="chip ${buchungenFilter==='Sparen'?'active':''}" onclick="setBuchungFilter('Sparen')">🐷 Sparen</button>
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

  if (buchungenFilter !== 'alle') {
    gefiltert = gefiltert.filter(b => b.art === buchungenFilter);
  }
  if (buchungenSuche) {
    const s = buchungenSuche.toLowerCase();
    gefiltert = gefiltert.filter(b =>
      b.beschreibung?.toLowerCase().includes(s) ||
      b.kategorie?.toLowerCase().includes(s)
    );
  }

  if (gefiltert.length === 0) {
    liste.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>Keine Buchungen gefunden</p>
      </div>`;
    return;
  }

  // Gruppierung nach Datum
  const gruppen = {};
  gefiltert.forEach(b => {
    const key = b.datum;
    if (!gruppen[key]) gruppen[key] = [];
    gruppen[key].push(b);
  });

  let html = '';
  Object.keys(gruppen).sort((a,b) => b.localeCompare(a)).forEach(datum => {
    html += `<div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);padding:8px 4px 4px;">${formatDatum(datum)}</div>`;
    gruppen[datum].forEach(b => {
      const vorzeichen = b.art === 'Einnahme' ? '+' : '-';
      const klasse = b.art.toLowerCase();
      html += `
        <div class="buchung-item" onclick="openBuchungDetail('${b.id}')">
          <div class="buchung-dot ${klasse}">${katEmoji(b.kategorie)}</div>
          <div class="buchung-info">
            <div class="buchung-beschr">${b.beschreibung || b.kategorie}</div>
            <div class="buchung-meta">${b.kategorie} · ${b.art}</div>
          </div>
          <div class="buchung-betrag ${klasse}">${b.art==='Einnahme'?'+':'−'}${formatEuro(b.betrag)}</div>
        </div>`;
    });
  });

  liste.innerHTML = html;
}

function setBuchungFilter(filter) {
  buchungenFilter = filter;
  renderBuchungen();
}

// ── Buchung Modal öffnen ──
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
            <input type="number" class="form-input" id="buchung-betrag" placeholder="0,00"
              step="0.01" min="0.01" value="${prefill.betrag||''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Kategorie</label>
          <select class="form-select" id="buchung-kategorie">
            ${kategorien.map(k => `<option value="${k.name}" ${k.name===prefill.kategorie?'selected':''}>${katEmoji(k.name)} ${k.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Beschreibung (optional)</label>
          <input type="text" class="form-input" id="buchung-beschr"
            placeholder="z.B. REWE Einkauf" value="${prefill.beschreibung||''}">
        </div>
        <div class="form-group">
          <label class="form-label">📷 Beleg scannen (optional)</label>
          <div class="scanner-area" onclick="document.getElementById('beleg-input').click()">
            <div class="scanner-icon">📄</div>
            <div class="scanner-text">Foto aufnehmen oder Datei wählen</div>
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

  if (!datum)        { showToast('Bitte Datum eingeben', 'error'); return; }
  if (!betrag || betrag <= 0) { showToast('Bitte gültigen Betrag eingeben', 'error'); return; }
  if (!kategorie)    { showToast('Bitte Kategorie wählen', 'error'); return; }

  const payload = {
    user_id: currentUser.id,
    art, datum, betrag, kategorie,
    beschreibung: beschr || null,
    beleg_url: window._belegUrl || null
  };

  let error;
  if (id) {
    ({ error } = await db.from('buchungen').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('buchungen').insert(payload));
  }

  if (error) { showToast('Fehler beim Speichern: ' + error.message, 'error'); return; }

  window._belegUrl = null;
  closeModal();
  showToast(id ? 'Buchung aktualisiert ✅' : 'Buchung gespeichert ✅', 'success');
  alleBuchungen = await ladeBuchungen();
  renderBuchungenListe();
  // Dashboard aktualisieren falls sichtbar
  if (document.getElementById('screen-dashboard').classList.contains('active')) {
    renderDashboard();
  }
}

// ── Buchung löschen ──
async function loescheBuchung(id) {
  if (!confirm('Buchung wirklich löschen?')) return;
  const { error } = await db.from('buchungen').delete().eq('id', id);
  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
  closeModal();
  showToast('Buchung gelöscht 🗑️', 'info');
  alleBuchungen = await ladeBuchungen();
  renderBuchungenListe();
}

// ── Buchung Detail ──
async function openBuchungDetail(id) {
  const b = alleBuchungen.find(x => x.id === id);
  if (!b) return;
  openBuchungModal(b);
}

// ── Kategorien laden ──
async function ladeKategorien() {
  if (!currentUser) return [];
  const { data } = await db.from('kategorien').select('*').eq('user_id', currentUser.id).order('gruppe').order('name');
  return data || [];
}

// ── Beleg Upload ──
async function handleBelegUpload(input) {
  const file = input.files[0];
  if (!file) return;

  // Vorschau
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('beleg-preview-container').innerHTML =
      `<img src="${e.target.result}" class="beleg-preview" alt="Beleg">`;
  };
  reader.readAsDataURL(file);

  showToast('Beleg wird hochgeladen...', 'info');

  // Upload zu Supabase Storage
  const pfad = `${currentUser.id}/${Date.now()}_${file.name}`;
  const { data, error } = await db.storage.from('belege').upload(pfad, file);

  if (error) { showToast('Upload fehlgeschlagen: ' + error.message, 'error'); return; }

  window._belegUrl = pfad;
  showToast('Beleg hochgeladen ✅', 'success');

  // OCR-Scan starten
  await scanBeleg(file);
}

// ── Beleg Scanner (OCR via GPT-4o Vision) ──
async function scanBeleg(file) {
  const resultDiv = document.getElementById('scan-result');
  resultDiv.innerHTML = '<div style="font-size:0.85rem;color:var(--text-muted);margin-top:8px;">🔍 Kassenzettel wird analysiert...</div>';

  try {
    // Bild zu Base64
    const base64 = await fileToBase64(file);

    // OpenAI API aufrufen
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analysiere diesen Kassenzettel/diese Rechnung und extrahiere:
1. Gesamtbetrag (nur die Zahl, z.B. 24.99)
2. Datum (Format YYYY-MM-DD, falls erkennbar)
3. Händler/Verkäufer (Name des Geschäfts)
4. Passende Kategorie aus dieser Liste: Lebensmittel, Drogerie, Restaurants, Kleidung, Mobilität, Gesundheit, Freizeit, Geschenke, Weiterbildung, Ungeplante Ausgaben

Antworte NUR im JSON-Format:
{"betrag": 24.99, "datum": "2026-07-19", "haendler": "REWE", "kategorie": "Lebensmittel"}`
            },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'low' } }
          ]
        }],
        max_tokens: 150
      })
    });

    if (!response.ok) throw new Error('API nicht erreichbar');

    const data = await response.json();
    const text = data.choices[0].message.content;
    const json = JSON.parse(text.match(/\{.*\}/s)[0]);

    // Felder automatisch ausfüllen
    if (json.betrag)    document.getElementById('buchung-betrag').value = json.betrag;
    if (json.datum)     document.getElementById('buchung-datum').value  = json.datum;
    if (json.haendler)  document.getElementById('buchung-beschr').value = json.haendler;
    if (json.kategorie) {
      const sel = document.getElementById('buchung-kategorie');
      for (let opt of sel.options) {
        if (opt.value === json.kategorie) { sel.value = json.kategorie; break; }
      }
    }

    resultDiv.innerHTML = `
      <div class="scanner-result">
        ✅ Erkannt: <strong>${json.haendler || 'Unbekannt'}</strong> –
        <strong>${formatEuro(json.betrag)}</strong>
        ${json.datum ? '· ' + formatDatum(json.datum) : ''}
        <br><small style="color:var(--text-muted)">Bitte Angaben prüfen und ggf. korrigieren</small>
      </div>`;

  } catch (err) {
    resultDiv.innerHTML = `<div style="font-size:0.82rem;color:var(--text-muted);margin-top:8px;">
      ⚠️ Automatische Erkennung nicht verfügbar – bitte manuell ausfüllen.
    </div>`;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// OpenAI Key (optional – nur für Scanner)
const OPENAI_API_KEY = 'DEIN_OPENAI_KEY';