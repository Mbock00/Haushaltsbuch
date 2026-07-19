// ═══════════════════════════════════════════
// App – Navigation, Modal, Toast, Init
// ═══════════════════════════════════════════

let aktiverScreen = 'dashboard';
let aktiverMehrTab = 'dauerauftraege';

// ── Navigation ──
async function navigateTo(screen) {
  aktiverScreen = screen;

  // Nav-Items aktualisieren (Mobile Bottom Nav)
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.screen === screen);
  });

  // Sidebar-Items aktualisieren (Desktop)
  document.querySelectorAll('.sidebar-item[data-screen]').forEach(item => {
    item.classList.toggle('active', item.dataset.screen === screen);
  });

  // Screens umschalten
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const ziel = document.getElementById(`screen-${screen}`);
  if (ziel) ziel.classList.add('active');

  // Header-Titel
  const titel = {
    dashboard:    { title: 'Haushaltsbuch', sub: 'Übersicht' },
    buchungen:    { title: 'Buchungen',     sub: 'Alle Einträge' },
    auswertungen: { title: 'Auswertungen',  sub: 'Statistiken' },
    mehr:         { title: getMehrTitel(),  sub: '' }
  };
  const t = titel[screen] || { title: 'Haushaltsbuch', sub: '' };
  document.getElementById('header-title').textContent = t.title;
  document.getElementById('header-sub').textContent   = t.sub;

  // Screen-Inhalt laden
  switch (screen) {
    case 'dashboard':    await renderDashboard();    break;
    case 'buchungen':    await renderBuchungen();    break;
    case 'auswertungen': await renderAuswertungen(); break;
    case 'mehr':         await renderMehrScreen();   break;
  }
}

function getMehrTitel() {
  const map = {
    dauerauftraege: 'Daueraufträge',
    sparziele:      'Sparziele',
    budget:         'Budgetplanung',
    profil:         'Mein Profil'
  };
  return map[aktiverMehrTab] || 'Mehr';
}

// ── Mehr-Screen ──
async function renderMehrScreen() {
  const screen = document.getElementById('screen-mehr');
  screen.innerHTML = `
    <div class="filter-chips" style="margin-bottom:16px;" id="mehr-tabs">
      <button class="chip ${aktiverMehrTab==='dauerauftraege'?'active':''}" onclick="setMehrTab('dauerauftraege')">🔄 Daueraufträge</button>
      <button class="chip ${aktiverMehrTab==='sparziele'?'active':''}"      onclick="setMehrTab('sparziele')">🐷 Sparziele</button>
      <button class="chip ${aktiverMehrTab==='budget'?'active':''}"         onclick="setMehrTab('budget')">💰 Budget</button>
      <button class="chip ${aktiverMehrTab==='profil'?'active':''}"         onclick="setMehrTab('profil')">👤 Profil</button>
    </div>
    <div id="mehr-inhalt"></div>
  `;
  await ladeMehrInhalt();
}

async function setMehrTab(tab) {
  aktiverMehrTab = tab;
  // Tabs aktualisieren
  document.querySelectorAll('#mehr-tabs .chip').forEach(c => c.classList.remove('active'));
  const btn = document.querySelector(`#mehr-tabs .chip[onclick="setMehrTab('${tab}')"]`);
  if (btn) btn.classList.add('active');
  document.getElementById('header-title').textContent = getMehrTitel();
  const inhalt = document.getElementById('mehr-inhalt');
  if (inhalt) inhalt.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  await ladeMehrInhalt();
}

async function ladeMehrInhalt() {
  switch (aktiverMehrTab) {
    case 'dauerauftraege': await renderDauerauftraegeInhalt(); break;
    case 'sparziele':      await renderSparzielenInhalt();     break;
    case 'budget':         await renderBudgetInhalt();         break;
    case 'profil':         await renderProfilInhalt();         break;
  }
}

// ── Daueraufträge ──
async function renderDauerauftraegeInhalt() {
  const inhalt = document.getElementById('mehr-inhalt');
  const { data } = await db.from('dauerauftraege')
    .select('*').eq('user_id', currentUser.id).order('art').order('beschreibung');
  const alle = data || [];
  const einnahmen = alle.filter(d => d.art === 'Einnahme');
  const ausgaben  = alle.filter(d => d.art !== 'Einnahme');

  inhalt.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:0.95rem;font-weight:700;color:var(--text-muted);">${alle.length} Dauerauftrag${alle.length!==1?'träge':''}</div>
      <button class="btn btn-primary btn-sm" onclick="openDauerauftragModal()">＋ Neu</button>
    </div>
    <div class="card" style="background:var(--primary-light);border:1.5px solid var(--primary);margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="font-size:1.6rem;">⚡</div>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:0.88rem;color:var(--primary-dark);">Automatische Buchung aktiv</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">Aktive Aufträge werden beim App-Start automatisch gebucht</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="fuehreDauerauftraegeAus()">Jetzt</button>
      </div>
    </div>
    ${einnahmen.length > 0 ? `<div class="card-title" style="margin-bottom:8px;">💰 Einnahmen</div>${einnahmen.map(d=>renderDauerauftragCard(d)).join('')}` : ''}
    ${ausgaben.length  > 0 ? `<div class="card-title" style="margin:16px 0 8px;">💸 Ausgaben & Sparen</div>${ausgaben.map(d=>renderDauerauftragCard(d)).join('')}` : ''}
    ${alle.length === 0 ? `<div class="empty-state"><div class="empty-icon">🔄</div><p>Noch keine Daueraufträge</p>
      <button class="btn btn-primary" style="margin-top:16px;width:auto;padding:10px 24px;" onclick="openDauerauftragModal()">Ersten erstellen</button></div>` : ''}
  `;
}

// ── Sparziele ──
async function renderSparzielenInhalt() {
  const inhalt = document.getElementById('mehr-inhalt');
  const { data: ziele } = await db.from('sparziele').select('*').eq('user_id', currentUser.id).order('created_at');
  const { data: gehaltBuchungen } = await db.from('buchungen').select('betrag')
    .eq('user_id', currentUser.id).eq('kategorie', 'Gehalt').eq('art', 'Einnahme')
    .order('datum', { ascending: false }).limit(3);
  let gehalt = 0;
  if (gehaltBuchungen?.length > 0) gehalt = gehaltBuchungen.reduce((s,b)=>s+Number(b.betrag),0) / gehaltBuchungen.length;
  const alle = ziele || [];

  inhalt.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:0.95rem;font-weight:700;color:var(--text-muted);">${alle.length} Ziel${alle.length!==1?'e':''}</div>
      <button class="btn btn-primary btn-sm" onclick="openSparzielModal()">＋ Neu</button>
    </div>
    ${gehalt > 0 ? `
    <div class="card" style="background:var(--primary-light);border:1.5px solid var(--primary);margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="font-size:1.4rem;">🛡️</div>
        <div>
          <div style="font-weight:700;font-size:0.85rem;color:var(--primary-dark);">Empfohlener Notgroschen</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">Ø Gehalt ${formatEuro(gehalt)} × 2,5 = <strong>${formatEuro(gehalt*2.5)}</strong></div>
        </div>
      </div>
    </div>` : ''}
    ${alle.length === 0
      ? `<div class="empty-state"><div class="empty-icon">🐷</div><p>Noch keine Sparziele</p>
         <button class="btn btn-primary" style="margin-top:16px;width:auto;padding:10px 24px;" onclick="openSparzielModal()">Erstes Ziel</button></div>`
      : alle.map(z => {
          const pct  = z.zielbetrag > 0 ? Math.min(z.aktueller_stand/z.zielbetrag*100,100) : 0;
          const fehl = Math.max(0, z.zielbetrag - z.aktueller_stand);
          const pctKl= pct>=100?'green':pct>=50?'':'red';
          return `
            <div class="sparziel-card" onclick="openSparzielModal(${JSON.stringify(z).replace(/"/g,'&quot;')})">
              <div class="sparziel-header">
                <div class="sparziel-name">${z.name}</div>
                <div class="sparziel-pct" style="color:${pct>=100?'var(--secondary-dark)':pct>=50?'var(--primary-dark)':'var(--danger)'};">${pct.toFixed(0)}%</div>
              </div>
              <div class="progress-bar"><div class="progress-fill ${pctKl}" style="width:${pct}%;"></div></div>
              <div class="sparziel-betraege">
                <span>Stand: <strong>${formatEuro(z.aktueller_stand)}</strong></span>
                <span>Ziel: <strong>${formatEuro(z.zielbetrag)}</strong></span>
              </div>
              ${fehl>0 ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;">Noch ${formatEuro(fehl)} bis zum Ziel</div>`
                       : `<div style="font-size:0.75rem;color:var(--secondary-dark);font-weight:700;margin-top:6px;">🎉 Ziel erreicht!</div>`}
            </div>`;
        }).join('')}
  `;
}

// ── Budget ──
async function renderBudgetInhalt() {
  const inhalt = document.getElementById('mehr-inhalt');
  const heute  = new Date();
  const monat  = heute.getMonth();
  const jahr   = heute.getFullYear();
  const { data: budgets } = await db.from('budgetplanung').select('*').eq('user_id', currentUser.id).order('kategorie');
  const buchungen = await ladeBuchungen(monat, jahr);
  const istAusgaben = {};
  buchungen.filter(b=>b.art==='Ausgabe').forEach(b=>{ istAusgaben[b.kategorie]=(istAusgaben[b.kategorie]||0)+Number(b.betrag); });
  const alle = budgets || [];
  const gesamtBudget = alle.reduce((s,b)=>s+Number(b.monatsbudget),0);
  const gesamtIst    = alle.reduce((s,b)=>s+(istAusgaben[b.kategorie]||0),0);

  inhalt.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div>
        <div style="font-size:0.95rem;font-weight:700;color:var(--text-muted);">${getMonatName(monat)} ${jahr}</div>
        ${alle.length>0?`<div style="font-size:0.75rem;color:var(--text-muted);">${formatEuro(gesamtIst)} von ${formatEuro(gesamtBudget)}</div>`:''}
      </div>
      <button class="btn btn-primary btn-sm" onclick="openBudgetModal()">＋ Neu</button>
    </div>
    ${alle.length === 0
      ? `<div class="empty-state"><div class="empty-icon">💰</div><p>Noch kein Budget geplant</p>
         <button class="btn btn-primary" style="margin-top:16px;width:auto;padding:10px 24px;" onclick="openBudgetModal()">Budget erstellen</button></div>`
      : alle.map(b => {
          const ist  = istAusgaben[b.kategorie]||0;
          const abw  = b.monatsbudget - ist;
          const pct  = b.monatsbudget>0 ? Math.min(ist/b.monatsbudget*100,100) : 0;
          const status = ist===0?'⚪':abw>0?'🟢':abw>=-b.monatsbudget*0.1?'🟡':'🔴';
          const pctKl  = ist===0?'':abw>0?'green':abw>=-b.monatsbudget*0.1?'orange':'red';
          return `
            <div class="budget-item" onclick="openBudgetModal(${JSON.stringify(b).replace(/"/g,'&quot;')})">
              <div style="font-size:1.3rem;">${katEmoji(b.kategorie)}</div>
              <div class="budget-info">
                <div class="budget-kat">${b.kategorie}</div>
                <div class="budget-betraege">${formatEuro(ist)} / ${formatEuro(b.monatsbudget)}
                  · <span style="color:${abw>=0?'var(--secondary-dark)':'var(--danger)'};">${abw>=0?'+':''}${formatEuro(abw)}</span>
                </div>
                <div class="progress-bar budget-progress"><div class="progress-fill ${pctKl}" style="width:${pct}%;"></div></div>
              </div>
              <div class="budget-status">${status}</div>
            </div>`;
        }).join('')}
    ${alle.length>0 ? `
      <div class="card" style="margin-top:8px;background:${gesamtBudget-gesamtIst>=0?'var(--success-light)':'var(--danger-light)'};border:1.5px solid ${gesamtBudget-gesamtIst>=0?'var(--success)':'var(--danger)'};">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;">Gesamt</div>
          <div style="text-align:right;">
            <div style="font-weight:800;color:${gesamtBudget-gesamtIst>=0?'var(--secondary-dark)':'var(--danger)'};">
              ${gesamtBudget-gesamtIst>=0?'+':''}${formatEuro(gesamtBudget-gesamtIst)}
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);">${formatEuro(gesamtIst)} / ${formatEuro(gesamtBudget)}</div>
          </div>
        </div>
      </div>` : ''}
  `;
}

// ══════════════════════════════════════════
// PROFIL – mit E-Mail & Passwort ändern
// ══════════════════════════════════════════
async function renderProfilInhalt() {
  const inhalt = document.getElementById('mehr-inhalt');
  const name   = currentProfile?.name || currentUser?.email?.split('@')[0] || 'Nutzer';
  const email  = currentUser?.email || '';
  const farbe  = currentProfile?.avatar_color || '#6c8ebf';
  const initial= name.charAt(0).toUpperCase();

  inhalt.innerHTML = `
    <!-- Avatar & Name -->
    <div class="card" style="text-align:center;padding:28px 20px;">
      <div class="profil-avatar" style="background:${farbe};">${initial}</div>
      <div class="profil-name">${name}</div>
      <div class="profil-email">${email}</div>
    </div>

    <!-- Profil bearbeiten -->
    <div class="card">
      <div class="card-title">👤 Profil bearbeiten</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Anzeigename</label>
          <input type="text" class="form-input" id="profil-name" value="${name}" placeholder="Dein Name">
        </div>
        <div class="form-group">
          <label class="form-label">Avatar-Farbe</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;">
            ${['#6c8ebf','#8ec6a0','#f0a868','#e07070','#a78bca','#60b8d4','#f0c060','#5a9e72'].map(c=>`
              <div onclick="selectAvatarFarbe('${c}')"
                style="width:34px;height:34px;border-radius:50%;background:${c};cursor:pointer;
                border:3px solid ${c===farbe?'var(--text)':'transparent'};transition:0.2s;flex-shrink:0;"
                id="avatar-color-${c.replace('#','')}"></div>
            `).join('')}
          </div>
          <input type="hidden" id="profil-farbe" value="${farbe}">
        </div>
        <button class="btn btn-primary" onclick="speichereProfil()">💾 Profil speichern</button>
      </div>
    </div>

    <!-- E-Mail ändern -->
    <div class="card">
      <div class="card-title">📧 E-Mail-Adresse ändern</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Aktuelle E-Mail</label>
          <input type="text" class="form-input" value="${email}" disabled style="opacity:0.6;">
        </div>
        <div class="form-group">
          <label class="form-label">Neue E-Mail-Adresse</label>
          <input type="email" class="form-input" id="neue-email" placeholder="neue@email.de">
        </div>
        <div class="form-group">
          <label class="form-label">Aktuelles Passwort (zur Bestätigung)</label>
          <input type="password" class="form-input" id="email-passwort" placeholder="••••••••">
        </div>
        <button class="btn btn-primary" onclick="aendereEmail()">📧 E-Mail ändern</button>
        <div style="font-size:0.78rem;color:var(--text-muted);">
          ℹ️ Du erhältst eine Bestätigungs-E-Mail an die neue Adresse.
        </div>
      </div>
    </div>

    <!-- Passwort ändern -->
    <div class="card">
      <div class="card-title">🔑 Passwort ändern</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Aktuelles Passwort</label>
          <input type="password" class="form-input" id="altes-passwort" placeholder="••••••••">
        </div>
        <div class="form-group">
          <label class="form-label">Neues Passwort (min. 8 Zeichen)</label>
          <input type="password" class="form-input" id="neues-passwort" placeholder="••••••••" minlength="8">
        </div>
        <div class="form-group">
          <label class="form-label">Neues Passwort wiederholen</label>
          <input type="password" class="form-input" id="neues-passwort2" placeholder="••••••••">
        </div>
        <!-- Passwort-Stärke -->
        <div id="passwort-staerke" style="display:none;">
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;">Passwortstärke:</div>
          <div class="progress-bar"><div id="staerke-balken" class="progress-fill" style="width:0%;"></div></div>
          <div id="staerke-text" style="font-size:0.75rem;margin-top:4px;"></div>
        </div>
        <button class="btn btn-primary" onclick="aenderePasswort()">🔑 Passwort ändern</button>
      </div>
    </div>

    <!-- Statistiken -->
    <div class="card">
      <div class="card-title">📊 Meine Statistiken</div>
      <div id="profil-stats"><div class="loading"><div class="spinner"></div></div></div>
    </div>

    <!-- Konto -->
    <div class="card">
      <div class="card-title">⚙️ Konto</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btn btn-secondary" onclick="handlePasswordReset()">📧 Passwort-Reset per E-Mail</button>
        <button class="btn btn-danger" onclick="handleLogout()">🚪 Abmelden</button>
      </div>
    </div>
  `;

  // Passwort-Stärke live anzeigen
  document.getElementById('neues-passwort').addEventListener('input', e => {
    pruefePasswortStaerke(e.target.value);
  });

  ladeProfilStats();
}

// ── Passwort-Stärke prüfen ──
function pruefePasswortStaerke(pw) {
  const container = document.getElementById('passwort-staerke');
  const balken    = document.getElementById('staerke-balken');
  const text      = document.getElementById('staerke-text');
  if (!pw) { container.style.display = 'none'; return; }
  container.style.display = 'block';

  let punkte = 0;
  if (pw.length >= 8)  punkte++;
  if (pw.length >= 12) punkte++;
  if (/[A-Z]/.test(pw)) punkte++;
  if (/[0-9]/.test(pw)) punkte++;
  if (/[^A-Za-z0-9]/.test(pw)) punkte++;

  const stufen = [
    { pct: 20,  klasse: 'red',    label: '😟 Sehr schwach' },
    { pct: 40,  klasse: 'red',    label: '😕 Schwach' },
    { pct: 60,  klasse: 'orange', label: '😐 Mittel' },
    { pct: 80,  klasse: 'green',  label: '😊 Stark' },
    { pct: 100, klasse: 'green',  label: '💪 Sehr stark' },
  ];
  const stufe = stufen[Math.min(punkte, 4)];
  balken.style.width   = stufe.pct + '%';
  balken.className     = `progress-fill ${stufe.klasse}`;
  text.textContent     = stufe.label;
  text.style.color     = stufe.klasse === 'green' ? 'var(--secondary-dark)' :
                         stufe.klasse === 'orange' ? 'var(--accent)' : 'var(--danger)';
}

// ── E-Mail ändern ──
async function aendereEmail() {
  const neueEmail   = document.getElementById('neue-email').value.trim();
  const passwort    = document.getElementById('email-passwort').value;

  if (!neueEmail)  { showToast('Bitte neue E-Mail eingeben', 'error'); return; }
  if (!passwort)   { showToast('Bitte aktuelles Passwort eingeben', 'error'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(neueEmail)) {
    showToast('Bitte gültige E-Mail-Adresse eingeben', 'error'); return;
  }

  // Erst neu einloggen zur Verifikation
  const { error: loginError } = await db.auth.signInWithPassword({
    email: currentUser.email, password: passwort
  });
  if (loginError) { showToast('Aktuelles Passwort falsch', 'error'); return; }

  // E-Mail ändern
  const { error } = await db.auth.updateUser({ email: neueEmail });
  if (error) {
    showToast('Fehler: ' + mapAuthError(error.message), 'error'); return;
  }

  showToast('✅ Bestätigungs-E-Mail gesendet! Bitte prüfe dein Postfach.', 'success');
  document.getElementById('neue-email').value    = '';
  document.getElementById('email-passwort').value = '';
}

// ── Passwort ändern ──
async function aenderePasswort() {
  const altes    = document.getElementById('altes-passwort').value;
  const neues    = document.getElementById('neues-passwort').value;
  const neues2   = document.getElementById('neues-passwort2').value;

  if (!altes)          { showToast('Bitte aktuelles Passwort eingeben', 'error'); return; }
  if (!neues)          { showToast('Bitte neues Passwort eingeben', 'error'); return; }
  if (neues.length < 8){ showToast('Neues Passwort muss mindestens 8 Zeichen haben', 'error'); return; }
  if (neues !== neues2){ showToast('Neue Passwörter stimmen nicht überein', 'error'); return; }
  if (altes === neues) { showToast('Neues Passwort muss sich vom alten unterscheiden', 'error'); return; }

  // Erst neu einloggen zur Verifikation
  const { error: loginError } = await db.auth.signInWithPassword({
    email: currentUser.email, password: altes
  });
  if (loginError) { showToast('Aktuelles Passwort falsch', 'error'); return; }

  // Passwort ändern
  const { error } = await db.auth.updateUser({ password: neues });
  if (error) {
    showToast('Fehler: ' + mapAuthError(error.message), 'error'); return;
  }

  showToast('✅ Passwort erfolgreich geändert!', 'success');
  document.getElementById('altes-passwort').value  = '';
  document.getElementById('neues-passwort').value  = '';
  document.getElementById('neues-passwort2').value = '';
  document.getElementById('passwort-staerke').style.display = 'none';
}

// ── Profil-Statistiken ──
async function ladeProfilStats() {
  const { data: buchungen } = await db.from('buchungen').select('art, betrag, datum').eq('user_id', currentUser.id);
  const alle  = buchungen || [];
  const ein   = alle.filter(b=>b.art==='Einnahme').reduce((s,b)=>s+Number(b.betrag),0);
  const aus   = alle.filter(b=>b.art==='Ausgabe').reduce((s,b) =>s+Number(b.betrag),0);
  const spar  = alle.filter(b=>b.art==='Sparen').reduce((s,b)  =>s+Number(b.betrag),0);

  // Älteste Buchung
  const aelteste = alle.sort((a,b)=>a.datum.localeCompare(b.datum))[0];
  const seit = aelteste ? formatDatum(aelteste.datum) : '–';

  document.getElementById('profil-stats').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="text-align:center;padding:12px;background:var(--success-light);border-radius:var(--radius-sm);">
        <div style="font-size:1.1rem;font-weight:800;color:var(--secondary-dark);">${formatEuro(ein)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);">Gesamteinnahmen</div>
      </div>
      <div style="text-align:center;padding:12px;background:var(--danger-light);border-radius:var(--radius-sm);">
        <div style="font-size:1.1rem;font-weight:800;color:var(--danger);">${formatEuro(aus)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);">Gesamtausgaben</div>
      </div>
      <div style="text-align:center;padding:12px;background:var(--primary-light);border-radius:var(--radius-sm);">
        <div style="font-size:1.1rem;font-weight:800;color:var(--primary-dark);">${formatEuro(spar)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);">Gesamt gespart</div>
      </div>
      <div style="text-align:center;padding:12px;background:var(--bg);border-radius:var(--radius-sm);">
        <div style="font-size:1.1rem;font-weight:800;">${alle.length}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);">Buchungen gesamt</div>
      </div>
    </div>
    <div style="margin-top:12px;font-size:0.78rem;color:var(--text-muted);text-align:center;">
      Dabei seit: ${seit}
    </div>
  `;
}

function selectAvatarFarbe(farbe) {
  document.getElementById('profil-farbe').value = farbe;
  document.querySelectorAll('[id^="avatar-color-"]').forEach(el => el.style.border = '3px solid transparent');
  const el = document.getElementById(`avatar-color-${farbe.replace('#','')}`);
  if (el) el.style.border = '3px solid var(--text)';
}

async function speichereProfil() {
  const name  = document.getElementById('profil-name').value.trim();
  const farbe = document.getElementById('profil-farbe').value;
  if (!name) { showToast('Bitte Namen eingeben', 'error'); return; }
  const { error } = await db.from('profile').update({ name, avatar_color: farbe }).eq('id', currentUser.id);
  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
  currentProfile = { ...currentProfile, name, avatar_color: farbe };
  updateHeaderProfile();
  showToast('Profil gespeichert ✅', 'success');
  renderProfilInhalt();
}

// ── Modal ──
function openModal() {
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  window._belegUrl = null;
}

// ── Toast ──
function showToast(msg, typ = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${typ}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[typ]||'ℹ️'}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ── PWA Install ──
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('btn-install').style.display = 'flex';
});
async function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') showToast('App installiert! 🎉', 'success');
  deferredPrompt = null;
  document.getElementById('btn-install').style.display = 'none';
}

// ── App initialisieren ──
document.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/Haushaltsbuch/sw.js').catch(console.error);
  }
  await initAuth();
});