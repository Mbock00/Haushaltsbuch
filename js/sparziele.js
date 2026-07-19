// ═══════════════════════════════════════════
// Sparziele & Budgetplanung
// ═══════════════════════════════════════════

// ── SPARZIELE ──────────────────────────────
async function renderSparziele() {
  const { data: ziele } = await db.from('sparziele')
    .select('*').eq('user_id', currentUser.id).order('created_at');

  const alle = ziele || [];

  // Notgroschen-Ziel dynamisch berechnen (Gehalt × 2,5)
  const { data: gehaltBuchungen } = await db.from('buchungen')
    .select('betrag')
    .eq('user_id', currentUser.id)
    .eq('kategorie', 'Gehalt')
    .eq('art', 'Einnahme')
    .order('datum', { ascending: false })
    .limit(3);

  let gehalt = 0;
  if (gehaltBuchungen && gehaltBuchungen.length > 0) {
    gehalt = gehaltBuchungen.reduce((s,b)=>s+Number(b.betrag),0) / gehaltBuchungen.length;
  }
  const notgroschenZiel = gehalt * 2.5;

  const screen = document.getElementById('screen-mehr');
  screen.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:1.1rem;font-weight:800;">🐷 Sparziele</div>
      <button class="btn btn-primary btn-sm" onclick="openSparzielModal()">＋ Neu</button>
    </div>

    <!-- Notgroschen Info -->
    ${gehalt > 0 ? `
    <div class="card" style="background:var(--primary-light);border:1.5px solid var(--primary);margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="font-size:1.5rem;">🛡️</div>
        <div>
          <div style="font-weight:700;font-size:0.88rem;color:var(--primary-dark);">Empfohlener Notgroschen</div>
          <div style="font-size:0.78rem;color:var(--text-muted);">
            Dein Ø Gehalt: ${formatEuro(gehalt)} × 2,5 = <strong>${formatEuro(notgroschenZiel)}</strong>
          </div>
        </div>
      </div>
    </div>` : ''}

    <!-- Sparziele Liste -->
    ${alle.length === 0
      ? `<div class="empty-state">
           <div class="empty-icon">🐷</div>
           <p>Noch keine Sparziele angelegt</p>
           <button class="btn btn-primary" style="margin-top:16px;width:auto;padding:10px 24px;" onclick="openSparzielModal()">Erstes Ziel erstellen</button>
         </div>`
      : alle.map(z => {
          const pct = z.zielbetrag > 0 ? Math.min(z.aktueller_stand / z.zielbetrag * 100, 100) : 0;
          const fehlbetrag = Math.max(0, z.zielbetrag - z.aktueller_stand);
          const pctKlasse = pct >= 100 ? 'green' : pct >= 50 ? '' : 'red';
          return `
            <div class="sparziel-card" onclick="openSparzielModal(${JSON.stringify(z).replace(/"/g,'&quot;')})">
              <div class="sparziel-header">
                <div class="sparziel-name">${z.name}</div>
                <div class="sparziel-pct" style="color:${pct>=100?'var(--secondary-dark)':pct>=50?'var(--primary-dark)':'var(--danger)'}">
                  ${pct.toFixed(0)}%
                </div>
              </div>
              <div class="progress-bar">
                <div class="progress-fill ${pctKlasse}" style="width:${pct}%;"></div>
              </div>
              <div class="sparziel-betraege">
                <span>Stand: <strong>${formatEuro(z.aktueller_stand)}</strong></span>
                <span>Ziel: <strong>${formatEuro(z.zielbetrag)}</strong></span>
              </div>
              ${fehlbetrag > 0
                ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;">Noch ${formatEuro(fehlbetrag)} bis zum Ziel</div>`
                : `<div style="font-size:0.75rem;color:var(--secondary-dark);font-weight:700;margin-top:6px;">🎉 Ziel erreicht!</div>`}
            </div>`;
        }).join('')}
  `;
}

async function openSparzielModal(z = null) {
  const isEdit = z && z.id;
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-title">${isEdit ? 'Sparziel bearbeiten' : 'Neues Sparziel'}</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Name des Sparziels</label>
          <input type="text" class="form-input" id="sz-name" placeholder="z.B. Urlaub Italien" value="${z?.name||''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Zielbetrag (€)</label>
            <input type="number" class="form-input" id="sz-ziel" placeholder="0,00" step="0.01" min="0.01" value="${z?.zielbetrag||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Aktueller Stand (€)</label>
            <input type="number" class="form-input" id="sz-stand" placeholder="0,00" step="0.01" min="0" value="${z?.aktueller_stand||0}">
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:8px;">
          ${isEdit ? `<button class="btn btn-danger btn-sm" onclick="loescheSparziel('${z.id}')">🗑️</button>` : ''}
          <button class="btn btn-secondary" onclick="closeModal()" style="flex:1">Abbrechen</button>
          <button class="btn btn-primary" onclick="speichereSparziel('${z?.id||''}')" style="flex:2">
            ${isEdit ? '💾 Speichern' : '✅ Erstellen'}
          </button>
        </div>
      </div>
    </div>`;
  openModal();
}

async function speichereSparziel(id = '') {
  const name  = document.getElementById('sz-name').value.trim();
  const ziel  = parseFloat(document.getElementById('sz-ziel').value);
  const stand = parseFloat(document.getElementById('sz-stand').value) || 0;

  if (!name)           { showToast('Bitte Namen eingeben', 'error'); return; }
  if (!ziel || ziel<=0){ showToast('Bitte Zielbetrag eingeben', 'error'); return; }

  const payload = { user_id: currentUser.id, name, zielbetrag: ziel, aktueller_stand: stand };
  let error;
  if (id) {
    ({ error } = await db.from('sparziele').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('sparziele').insert(payload));
  }
  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
  closeModal();
  showToast(id ? 'Sparziel aktualisiert ✅' : 'Sparziel erstellt ✅', 'success');
  renderSparziele();
}

async function loescheSparziel(id) {
  if (!confirm('Sparziel wirklich löschen?')) return;
  await db.from('sparziele').delete().eq('id', id);
  closeModal();
  showToast('Sparziel gelöscht 🗑️', 'info');
  renderSparziele();
}

// ── BUDGETPLANUNG ──────────────────────────
async function renderBudgetplanung() {
  const heute = new Date();
  const monat = heute.getMonth();
  const jahr  = heute.getFullYear();

  const { data: budgets } = await db.from('budgetplanung')
    .select('*').eq('user_id', currentUser.id).order('kategorie');

  const buchungen = await ladeBuchungen(monat, jahr);

  const alle = budgets || [];

  // Ist-Ausgaben pro Kategorie
  const istAusgaben = {};
  buchungen.filter(b => b.art === 'Ausgabe').forEach(b => {
    istAusgaben[b.kategorie] = (istAusgaben[b.kategorie] || 0) + Number(b.betrag);
  });

  const screen = document.getElementById('screen-mehr');
  screen.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div>
        <div style="font-size:1.1rem;font-weight:800;">💰 Budgetplanung</div>
        <div style="font-size:0.78rem;color:var(--text-muted);">${getMonatName(monat)} ${jahr}</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openBudgetModal()">＋ Neu</button>
    </div>

    ${alle.length === 0
      ? `<div class="empty-state">
           <div class="empty-icon">💰</div>
           <p>Noch kein Budget geplant</p>
           <button class="btn btn-primary" style="margin-top:16px;width:auto;padding:10px 24px;" onclick="openBudgetModal()">Budget erstellen</button>
         </div>`
      : alle.map(b => {
          const ist = istAusgaben[b.kategorie] || 0;
          const abw = b.monatsbudget - ist;
          const pct = b.monatsbudget > 0 ? Math.min(ist / b.monatsbudget * 100, 100) : 0;
          let status, statusKlasse, pctKlasse;
          if (ist === 0)              { status = '⚪'; statusKlasse = ''; pctKlasse = ''; }
          else if (abw > 0)           { status = '🟢'; statusKlasse = 'success'; pctKlasse = 'green'; }
          else if (abw >= -b.monatsbudget*0.1) { status = '🟡'; statusKlasse = 'warning'; pctKlasse = 'orange'; }
          else                        { status = '🔴'; statusKlasse = 'danger'; pctKlasse = 'red'; }

          return `
            <div class="budget-item" onclick="openBudgetModal(${JSON.stringify(b).replace(/"/g,'&quot;')})">
              <div style="font-size:1.4rem;">${katEmoji(b.kategorie)}</div>
              <div class="budget-info">
                <div class="budget-kat">${b.kategorie}</div>
                <div class="budget-betraege">
                  ${formatEuro(ist)} von ${formatEuro(b.monatsbudget)}
                  · <span style="color:${abw>=0?'var(--secondary-dark)':'var(--danger)'}">
                    ${abw>=0?'+':''}${formatEuro(abw)}
                  </span>
                </div>
                <div class="progress-bar budget-progress">
                  <div class="progress-fill ${pctKlasse}" style="width:${pct}%;"></div>
                </div>
              </div>
              <div class="budget-status">${status}</div>
            </div>`;
        }).join('')}

    <!-- Gesamt -->
    ${alle.length > 0 ? (() => {
      const gesamtBudget = alle.reduce((s,b)=>s+Number(b.monatsbudget),0);
      const gesamtIst    = alle.reduce((s,b)=>s+(istAusgaben[b.kategorie]||0),0);
      const gesamtAbw    = gesamtBudget - gesamtIst;
      return `
        <div class="card" style="margin-top:8px;background:${gesamtAbw>=0?'var(--success-light)':'var(--danger-light)'};border:1.5px solid ${gesamtAbw>=0?'var(--success)':'var(--danger)'};">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-weight:700;">Gesamt</div>
            <div>
              <div style="font-weight:800;font-size:1rem;color:${gesamtAbw>=0?'var(--secondary-dark)':'var(--danger)'};">
                ${gesamtAbw>=0?'+':''}${formatEuro(gesamtAbw)}
              </div>
              <div style="font-size:0.75rem;color:var(--text-muted);text-align:right;">
                ${formatEuro(gesamtIst)} / ${formatEuro(gesamtBudget)}
              </div>
            </div>
          </div>
        </div>`;
    })() : ''}
  `;
}

async function openBudgetModal(b = null) {
  const kategorien = await ladeKategorien();
  const isEdit = b && b.id;
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-title">${isEdit ? 'Budget bearbeiten' : 'Neues Budget'}</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Kategorie</label>
          <select class="form-select" id="budget-kat">
            ${kategorien.filter(k=>k.gruppe!=='Einnahmen').map(k=>`
              <option value="${k.name}" ${k.name===b?.kategorie?'selected':''}>${katEmoji(k.name)} ${k.name}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Monatsbudget (€)</label>
          <input type="number" class="form-input" id="budget-betrag" placeholder="0,00" step="0.01" min="0" value="${b?.monatsbudget||''}">
        </div>
        <div style="display:flex;gap:10px;margin-top:8px;">
          ${isEdit ? `<button class="btn btn-danger btn-sm" onclick="loescheBudget('${b.id}')">🗑️</button>` : ''}
          <button class="btn btn-secondary" onclick="closeModal()" style="flex:1">Abbrechen</button>
          <button class="btn btn-primary" onclick="speichereBudget('${b?.id||''}')" style="flex:2">
            ${isEdit ? '💾 Speichern' : '✅ Erstellen'}
          </button>
        </div>
      </div>
    </div>`;
  openModal();
}

async function speichereBudget(id = '') {
  const kategorie = document.getElementById('budget-kat').value;
  const betrag    = parseFloat(document.getElementById('budget-betrag').value);
  if (!betrag || betrag < 0) { showToast('Bitte gültigen Betrag eingeben', 'error'); return; }
  const payload = { user_id: currentUser.id, kategorie, monatsbudget: betrag };
  let error;
  if (id) {
    ({ error } = await db.from('budgetplanung').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('budgetplanung').insert(payload));
  }
  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
  closeModal();
  showToast(id ? 'Budget aktualisiert ✅' : 'Budget erstellt ✅', 'success');
  renderBudgetplanung();
}

async function loescheBudget(id) {
  if (!confirm('Budget wirklich löschen?')) return;
  await db.from('budgetplanung').delete().eq('id', id);
  closeModal();
  showToast('Budget gelöscht 🗑️', 'info');
  renderBudgetplanung();
}