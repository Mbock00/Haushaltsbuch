// ═══════════════════════════════════════════
// Daueraufträge – Verwaltung & Auto-Buchung
// ═══════════════════════════════════════════

async function renderDauerauftraege() {
  const screen = document.getElementById('screen-mehr');
  const { data: dauerauftraege } = await db.from('dauerauftraege')
    .select('*').eq('user_id', currentUser.id).order('art').order('beschreibung');

  const alle = dauerauftraege || [];
  const einnahmen = alle.filter(d => d.art === 'Einnahme');
  const ausgaben  = alle.filter(d => d.art === 'Ausgabe');

  screen.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:1.1rem;font-weight:800;">🔄 Daueraufträge</div>
      <button class="btn btn-primary btn-sm" onclick="openDauerauftragModal()">＋ Neu</button>
    </div>

    <!-- Auto-Buchung Banner -->
    <div class="card" style="background:var(--primary-light);border:1.5px solid var(--primary);">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="font-size:1.8rem;">⚡</div>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:0.9rem;color:var(--primary-dark);">Automatische Buchung</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">
            Aktive Daueraufträge werden beim App-Start automatisch für den aktuellen Monat gebucht.
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="fuehreDauerauftraegeAus()">Jetzt</button>
      </div>
    </div>

    <!-- Einnahmen -->
    <div class="card-title" style="margin:16px 0 8px;">💰 Regelmäßige Einnahmen</div>
    ${einnahmen.length === 0
      ? '<div class="empty-state" style="padding:20px;"><p>Noch keine Einnahmen-Daueraufträge</p></div>'
      : einnahmen.map(d => renderDauerauftragCard(d)).join('')}

    <!-- Ausgaben -->
    <div class="card-title" style="margin:16px 0 8px;">💸 Regelmäßige Ausgaben</div>
    ${ausgaben.length === 0
      ? '<div class="empty-state" style="padding:20px;"><p>Noch keine Ausgaben-Daueraufträge</p></div>'
      : ausgaben.map(d => renderDauerauftragCard(d)).join('')}
  `;
}

function renderDauerauftragCard(d) {
  const naechsteDatum = berechneNaechstesBuchungsdatum(d.buchungstag);
  return `
    <div class="da-card">
      <div class="da-toggle ${d.aktiv?'active':''}" onclick="toggleDauerauftrag('${d.id}', ${d.aktiv})"></div>
      <div class="da-info" onclick="openDauerauftragModal(${JSON.stringify(d).replace(/"/g,'&quot;')})">
        <div class="da-name">${katEmoji(d.kategorie)} ${d.beschreibung || d.kategorie}</div>
        <div class="da-meta">${d.kategorie} · ${d.turnus} · Tag ${d.buchungstag}</div>
      </div>
      <div style="text-align:right;">
        <div class="da-betrag">${formatEuro(d.betrag)}</div>
        <div class="da-tag">nächste: ${formatDatum(naechsteDatum)}</div>
      </div>
    </div>`;
}

// ── Nächstes Buchungsdatum berechnen ──
function berechneNaechstesBuchungsdatum(tag) {
  const heute = new Date();
  const heuteTag = heute.getDate();
  let monat = heute.getMonth();
  let jahr  = heute.getFullYear();

  if (tag < heuteTag) {
    monat++;
    if (monat > 11) { monat = 0; jahr++; }
  }

  // Sicherstellen dass Tag im Monat existiert
  const maxTag = new Date(jahr, monat+1, 0).getDate();
  const buchTag = Math.min(tag, maxTag);
  return new Date(jahr, monat, buchTag).toISOString().split('T')[0];
}

// ── Toggle Aktiv/Inaktiv ──
async function toggleDauerauftrag(id, aktiv) {
  const { error } = await db.from('dauerauftraege')
    .update({ aktiv: !aktiv }).eq('id', id);
  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
  showToast(aktiv ? 'Dauerauftrag deaktiviert' : 'Dauerauftrag aktiviert ✅', 'info');
  renderDauerauftraege();
}

// ── Dauerauftrag Modal ──
async function openDauerauftragModal(d = null) {
  const kategorien = await ladeKategorien();
  const isEdit = d && d.id;

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-title">${isEdit ? 'Dauerauftrag bearbeiten' : 'Neuer Dauerauftrag'}</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Art</label>
          <div class="art-selector" style="grid-template-columns:1fr 1fr;">
            <button class="art-btn ${(!d||d.art==='Ausgabe')?'active ausgabe':''}" data-art="Ausgabe" onclick="selectArt('Ausgabe')">
              <span class="art-emoji">💸</span>Ausgabe
            </button>
            <button class="art-btn ${d?.art==='Einnahme'?'active einnahme':''}" data-art="Einnahme" onclick="selectArt('Einnahme')">
              <span class="art-emoji">💰</span>Einnahme
            </button>
          </div>
          <input type="hidden" id="buchung-art" value="${d?.art||'Ausgabe'}">
        </div>
        <div class="form-group">
          <label class="form-label">Kategorie</label>
          <select class="form-select" id="da-kategorie">
            ${kategorien.map(k=>`<option value="${k.name}" ${k.name===d?.kategorie?'selected':''}>${katEmoji(k.name)} ${k.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Beschreibung</label>
          <input type="text" class="form-input" id="da-beschr" placeholder="z.B. Monatliche Miete" value="${d?.beschreibung||''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Betrag (€)</label>
            <input type="number" class="form-input" id="da-betrag" placeholder="0,00" step="0.01" min="0.01" value="${d?.betrag||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Buchungstag (1–28)</label>
            <input type="number" class="form-input" id="da-tag" placeholder="1" min="1" max="28" value="${d?.buchungstag||1}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Turnus</label>
          <select class="form-select" id="da-turnus">
            <option value="Monatlich"     ${d?.turnus==='Monatlich'?'selected':''}>Monatlich</option>
            <option value="Quartalsweise" ${d?.turnus==='Quartalsweise'?'selected':''}>Quartalsweise</option>
            <option value="Jährlich"      ${d?.turnus==='Jährlich'?'selected':''}>Jährlich</option>
          </select>
        </div>
        <div style="display:flex;gap:10px;margin-top:8px;">
          ${isEdit ? `<button class="btn btn-danger btn-sm" onclick="loescheDauerauftrag('${d.id}')">🗑️</button>` : ''}
          <button class="btn btn-secondary" onclick="closeModal()" style="flex:1">Abbrechen</button>
          <button class="btn btn-primary" onclick="speichereDauerauftrag('${d?.id||''}')" style="flex:2">
            ${isEdit ? '💾 Speichern' : '✅ Erstellen'}
          </button>
        </div>
      </div>
    </div>`;
  openModal();
}

// ── Dauerauftrag speichern ──
async function speichereDauerauftrag(id = '') {
  const art       = document.getElementById('buchung-art').value;
  const kategorie = document.getElementById('da-kategorie').value;
  const beschr    = document.getElementById('da-beschr').value.trim();
  const betrag    = parseFloat(document.getElementById('da-betrag').value);
  const tag       = parseInt(document.getElementById('da-tag').value);
  const turnus    = document.getElementById('da-turnus').value;

  if (!betrag || betrag <= 0) { showToast('Bitte gültigen Betrag eingeben', 'error'); return; }
  if (!tag || tag < 1 || tag > 28) { showToast('Buchungstag muss zwischen 1 und 28 liegen', 'error'); return; }

  const payload = {
    user_id: currentUser.id,
    art, kategorie, betrag, turnus,
    buchungstag: tag,
    beschreibung: beschr || null,
    aktiv: true
  };

  let error;
  if (id) {
    ({ error } = await db.from('dauerauftraege').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('dauerauftraege').insert(payload));
  }

  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
  closeModal();
  showToast(id ? 'Dauerauftrag aktualisiert ✅' : 'Dauerauftrag erstellt ✅', 'success');
  renderDauerauftraege();
}

// ── Dauerauftrag löschen ──
async function loescheDauerauftrag(id) {
  if (!confirm('Dauerauftrag wirklich löschen?')) return;
  await db.from('dauerauftraege').delete().eq('id', id);
  closeModal();
  showToast('Dauerauftrag gelöscht 🗑️', 'info');
  renderDauerauftraege();
}

// ── Automatische Ausführung beim App-Start ──
async function fuehreDauerauftraegeAus() {
  if (!currentUser) return;

  const heute = new Date();
  const heuteTag  = heute.getDate();
  const heuteISO_ = heuteISO();
  const monatVon  = `${heute.getFullYear()}-${String(heute.getMonth()+1).padStart(2,'0')}-01`;
  const monatBis  = new Date(heute.getFullYear(), heute.getMonth()+1, 0).toISOString().split('T')[0];

  // Aktive Daueraufträge laden
  const { data: dauerauftraege } = await db.from('dauerauftraege')
    .select('*').eq('user_id', currentUser.id).eq('aktiv', true);

  if (!dauerauftraege || dauerauftraege.length === 0) return;

  let gebucht = 0;

  for (const d of dauerauftraege) {
    // Prüfen ob Buchungstag heute oder in der Vergangenheit dieses Monats
    if (d.buchungstag > heuteTag) continue;

    // Turnus prüfen
    if (d.turnus === 'Quartalsweise' && heute.getMonth() % 3 !== 0) continue;
    if (d.turnus === 'Jährlich' && heute.getMonth() !== 0) continue;

    // Prüfen ob bereits diesen Monat gebucht
    const { data: vorhandene } = await db.from('buchungen')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('kategorie', d.kategorie)
      .eq('betrag', d.betrag)
      .eq('art', d.art)
      .gte('datum', monatVon)
      .lte('datum', monatBis)
      .limit(1);

    if (vorhandene && vorhandene.length > 0) continue; // Bereits gebucht

    // Buchung erstellen
    const buchDatum = `${heute.getFullYear()}-${String(heute.getMonth()+1).padStart(2,'0')}-${String(Math.min(d.buchungstag, new Date(heute.getFullYear(), heute.getMonth()+1, 0).getDate())).padStart(2,'0')}`;

    const { error } = await db.from('buchungen').insert({
      user_id: currentUser.id,
      datum: buchDatum,
      art: d.art,
      kategorie: d.kategorie,
      beschreibung: d.beschreibung || `${d.kategorie} (Dauerauftrag)`,
      betrag: d.betrag
    });

    if (!error) {
      gebucht++;
      // letzte_buchung aktualisieren
      await db.from('dauerauftraege').update({ letzte_buchung: buchDatum }).eq('id', d.id);
    }
  }

  if (gebucht > 0) {
    showToast(`✅ ${gebucht} Dauerauftrag${gebucht>1?'träge':''} automatisch gebucht!`, 'success');
    alleBuchungen = await ladeBuchungen();
  }
}