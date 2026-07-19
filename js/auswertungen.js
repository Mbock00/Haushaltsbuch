// ═══════════════════════════════════════════
// Auswertungen – Monats- & Jahresübersicht
// ═══════════════════════════════════════════

let auswertungJahr  = new Date().getFullYear();
let auswertungMonat = new Date().getMonth();
let auswertungChart = null;
let auswertungModus = 'monat'; // 'monat' | 'jahr'

async function renderAuswertungen() {
  const screen = document.getElementById('screen-auswertungen');
  screen.innerHTML = `
    <!-- Modus-Tabs -->
    <div class="auth-tabs" style="margin-bottom:16px;">
      <button class="auth-tab ${auswertungModus==='monat'?'active':''}" onclick="setAuswertungModus('monat')">📅 Monat</button>
      <button class="auth-tab ${auswertungModus==='jahr'?'active':''}"  onclick="setAuswertungModus('jahr')">📈 Jahr</button>
    </div>
    <div id="auswertung-inhalt">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `;
  await ladeAuswertungInhalt();
}

async function setAuswertungModus(modus) {
  auswertungModus = modus;
  await renderAuswertungen();
}

async function ladeAuswertungInhalt() {
  if (auswertungModus === 'monat') {
    await renderMonatsauswertung();
  } else {
    await renderJahresauswertung();
  }
}

// ══════════════════════════════════════════
// MONATSAUSWERTUNG
// ══════════════════════════════════════════
async function renderMonatsauswertung() {
  const inhalt = document.getElementById('auswertung-inhalt');
  const buchungen = await ladeBuchungen(auswertungMonat, auswertungJahr);

  const einnahmen = buchungen.filter(b => b.art==='Einnahme').reduce((s,b)=>s+Number(b.betrag),0);
  const ausgaben  = buchungen.filter(b => b.art==='Ausgabe').reduce((s,b) =>s+Number(b.betrag),0);
  const sparen    = buchungen.filter(b => b.art==='Sparen').reduce((s,b)  =>s+Number(b.betrag),0);
  const rest      = einnahmen - ausgaben - sparen;

  // Ausgaben nach Kategorie
  const katSummen = {};
  buchungen.filter(b => b.art==='Ausgabe').forEach(b => {
    katSummen[b.kategorie] = (katSummen[b.kategorie]||0) + Number(b.betrag);
  });
  const katSorted = Object.entries(katSummen).sort((a,b)=>b[1]-a[1]);

  inhalt.innerHTML = `
    <!-- Monat-Navigator -->
    <div class="monat-selector">
      <button class="monat-nav" onclick="navigiereMonat(-1)">◀</button>
      <div class="monat-label">${getMonatName(auswertungMonat)} ${auswertungJahr}</div>
      <button class="monat-nav" onclick="navigiereMonat(1)">▶</button>
    </div>

    <!-- KPI Zusammenfassung -->
    <div class="kpi-grid" style="grid-template-columns:1fr 1fr;">
      <div class="kpi-card">
        <div class="kpi-icon">💰</div>
        <div class="kpi-label">Einnahmen</div>
        <div class="kpi-value green">${formatEuro(einnahmen)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">💸</div>
        <div class="kpi-label">Ausgaben</div>
        <div class="kpi-value red">${formatEuro(ausgaben)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">🐷</div>
        <div class="kpi-label">Gespart</div>
        <div class="kpi-value blue">${formatEuro(sparen)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">✅</div>
        <div class="kpi-label">Überschuss</div>
        <div class="kpi-value ${rest>=0?'green':'red'}">${formatEuro(rest)}</div>
      </div>
    </div>

    <!-- Ausgaben nach Kategorie -->
    <div class="card">
      <div class="card-title">📊 Ausgaben nach Kategorie</div>
      ${katSorted.length === 0
        ? '<div class="empty-state"><div class="empty-icon">📭</div><p>Keine Ausgaben in diesem Monat</p></div>'
        : katSorted.map(([kat, sum]) => {
            const pct = ausgaben > 0 ? (sum/ausgaben*100) : 0;
            const pctKlasse = pct > 40 ? 'red' : pct > 25 ? 'orange' : 'green';
            return `
              <div style="margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <div style="font-size:0.88rem;font-weight:600;">${katEmoji(kat)} ${kat}</div>
                  <div style="font-size:0.88rem;font-weight:700;color:var(--danger);">${formatEuro(sum)}</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div class="progress-bar" style="flex:1;">
                    <div class="progress-fill ${pctKlasse}" style="width:${Math.min(pct,100)}%;"></div>
                  </div>
                  <div style="font-size:0.75rem;color:var(--text-muted);width:36px;text-align:right;">${pct.toFixed(0)}%</div>
                </div>
              </div>`;
          }).join('')
      }
    </div>

    <!-- Diagramm -->
    <div class="card">
      <div class="card-title">🥧 Ausgabenverteilung</div>
      <div class="chart-container" style="height:220px;">
        <canvas id="chart-monat-kat"></canvas>
      </div>
    </div>
  `;

  // Donut Chart
  if (katSorted.length > 0) {
    const farben = ['#6c8ebf','#8ec6a0','#f0a868','#e07070','#a78bca','#60b8d4','#f0c060','#90a4ae'];
    if (auswertungChart) auswertungChart.destroy();
    auswertungChart = new Chart(document.getElementById('chart-monat-kat'), {
      type: 'doughnut',
      data: {
        labels: katSorted.map(([k])=>k),
        datasets: [{
          data: katSorted.map(([,v])=>v),
          backgroundColor: farben,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { font:{size:10}, boxWidth:10, padding:6 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatEuro(ctx.raw)}` } }
        }
      }
    });
  }
}

function navigiereMonat(delta) {
  auswertungMonat += delta;
  if (auswertungMonat < 0)  { auswertungMonat = 11; auswertungJahr--; }
  if (auswertungMonat > 11) { auswertungMonat = 0;  auswertungJahr++; }
  renderMonatsauswertung();
}

// ══════════════════════════════════════════
// JAHRESAUSWERTUNG
// ══════════════════════════════════════════
async function renderJahresauswertung() {
  const inhalt = document.getElementById('auswertung-inhalt');

  // Alle Buchungen des Jahres
  const { data: buchungen } = await db.from('buchungen')
    .select('*')
    .eq('user_id', currentUser.id)
    .gte('datum', `${auswertungJahr}-01-01`)
    .lte('datum', `${auswertungJahr}-12-31`);

  const alle = buchungen || [];

  const gesamtEin  = alle.filter(b=>b.art==='Einnahme').reduce((s,b)=>s+Number(b.betrag),0);
  const gesamtAus  = alle.filter(b=>b.art==='Ausgabe').reduce((s,b) =>s+Number(b.betrag),0);
  const gesamtSpar = alle.filter(b=>b.art==='Sparen').reduce((s,b)  =>s+Number(b.betrag),0);
  const gesamtRest = gesamtEin - gesamtAus - gesamtSpar;

  // Monatliche Werte
  const monate = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const monatsDaten = monate.map((name, i) => {
    const mb = alle.filter(b => new Date(b.datum).getMonth() === i);
    const ein  = mb.filter(b=>b.art==='Einnahme').reduce((s,b)=>s+Number(b.betrag),0);
    const aus  = mb.filter(b=>b.art==='Ausgabe').reduce((s,b) =>s+Number(b.betrag),0);
    const spar = mb.filter(b=>b.art==='Sparen').reduce((s,b)  =>s+Number(b.betrag),0);
    return { name, ein, aus, spar, rest: ein-aus-spar };
  });

  // Bester/schlechtester Monat
  const aktiveMonate = monatsDaten.filter(m => m.ein > 0 || m.aus > 0);
  const besterMonat  = aktiveMonate.sort((a,b)=>b.rest-a.rest)[0];
  const schlechterM  = aktiveMonate.sort((a,b)=>a.rest-b.rest)[0];

  inhalt.innerHTML = `
    <!-- Jahr-Navigator -->
    <div class="monat-selector">
      <button class="monat-nav" onclick="navigiereJahr(-1)">◀</button>
      <div class="monat-label">Jahr ${auswertungJahr}</div>
      <button class="monat-nav" onclick="navigiereJahr(1)">▶</button>
    </div>

    <!-- Jahres-KPIs -->
    <div class="kpi-grid" style="grid-template-columns:1fr 1fr;">
      <div class="kpi-card">
        <div class="kpi-icon">💰</div>
        <div class="kpi-label">Gesamteinnahmen</div>
        <div class="kpi-value green">${formatEuro(gesamtEin)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">💸</div>
        <div class="kpi-label">Gesamtausgaben</div>
        <div class="kpi-value red">${formatEuro(gesamtAus)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">🐷</div>
        <div class="kpi-label">Gesamt gespart</div>
        <div class="kpi-value blue">${formatEuro(gesamtSpar)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">✅</div>
        <div class="kpi-label">Jahresüberschuss</div>
        <div class="kpi-value ${gesamtRest>=0?'green':'red'}">${formatEuro(gesamtRest)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">📊</div>
        <div class="kpi-label">Ø Monatl. Ausgaben</div>
        <div class="kpi-value">${formatEuro(gesamtAus/12)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">📈</div>
        <div class="kpi-label">Ø Sparquote</div>
        <div class="kpi-value blue">${gesamtEin>0?(gesamtSpar/gesamtEin*100).toFixed(1):0}%</div>
      </div>
    </div>

    <!-- Highlights -->
    ${besterMonat ? `
    <div class="card">
      <div class="card-title">🏆 Jahres-Highlights</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--success-light);border-radius:var(--radius-sm);">
          <div><div style="font-weight:700;font-size:0.88rem;">🥇 Bester Monat</div><div style="font-size:0.78rem;color:var(--text-muted);">${besterMonat.name}</div></div>
          <div style="font-weight:800;color:var(--secondary-dark);">${formatEuro(besterMonat.rest)}</div>
        </div>
        ${schlechterM && schlechterM.name !== besterMonat.name ? `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--danger-light);border-radius:var(--radius-sm);">
          <div><div style="font-weight:700;font-size:0.88rem;">📉 Schwächster Monat</div><div style="font-size:0.78rem;color:var(--text-muted);">${schlechterM.name}</div></div>
          <div style="font-weight:800;color:var(--danger);">${formatEuro(schlechterM.rest)}</div>
        </div>` : ''}
      </div>
    </div>` : ''}

    <!-- Jahresverlauf Chart -->
    <div class="card">
      <div class="card-title">📊 Monatlicher Verlauf</div>
      <div class="chart-container">
        <canvas id="chart-jahresverlauf"></canvas>
      </div>
    </div>

    <!-- Monatstabelle -->
    <div class="card">
      <div class="card-title">📋 Monatsübersicht</div>
      <table class="monat-tabelle">
        <thead>
          <tr>
            <th>Monat</th>
            <th style="text-align:right;">Einnahmen</th>
            <th style="text-align:right;">Ausgaben</th>
            <th style="text-align:right;">Überschuss</th>
          </tr>
        </thead>
        <tbody>
          ${monatsDaten.map(m => `
            <tr>
              <td style="font-weight:600;">${m.name}</td>
              <td style="text-align:right;" class="positiv">${m.ein>0?formatEuro(m.ein):'–'}</td>
              <td style="text-align:right;color:var(--danger);">${m.aus>0?formatEuro(m.aus):'–'}</td>
              <td style="text-align:right;" class="${m.rest>=0?'positiv':'negativ'}">${(m.ein>0||m.aus>0)?formatEuro(m.rest):'–'}</td>
            </tr>`).join('')}
          <tr style="border-top:2px solid var(--border);font-weight:800;">
            <td>Gesamt</td>
            <td style="text-align:right;color:var(--secondary-dark);">${formatEuro(gesamtEin)}</td>
            <td style="text-align:right;color:var(--danger);">${formatEuro(gesamtAus)}</td>
            <td style="text-align:right;" class="${gesamtRest>=0?'positiv':'negativ'}">${formatEuro(gesamtRest)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  // Jahresverlauf Chart
  if (auswertungChart) auswertungChart.destroy();
  auswertungChart = new Chart(document.getElementById('chart-jahresverlauf'), {
    type: 'bar',
    data: {
      labels: monate,
      datasets: [
        { label: 'Einnahmen', data: monatsDaten.map(m=>m.ein),  backgroundColor: 'rgba(126,200,160,0.7)', borderColor:'#5a9e72', borderWidth:1.5, borderRadius:5 },
        { label: 'Ausgaben',  data: monatsDaten.map(m=>m.aus),  backgroundColor: 'rgba(224,112,112,0.7)', borderColor:'#c0392b', borderWidth:1.5, borderRadius:5 },
        { label: 'Gespart',   data: monatsDaten.map(m=>m.spar), backgroundColor: 'rgba(108,142,191,0.7)', borderColor:'#4a6fa5', borderWidth:1.5, borderRadius:5 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position:'bottom', labels:{ font:{size:10}, boxWidth:10 } },
        tooltip: { callbacks: { label: ctx => ` ${formatEuro(ctx.raw)}` } }
      },
      scales: {
        x: { grid:{display:false}, ticks:{font:{size:10}} },
        y: { grid:{color:'rgba(0,0,0,0.05)'}, ticks:{ font:{size:10}, callback: v => v>=1000?(v/1000).toFixed(1)+'k':v } }
      }
    }
  });
}

function navigiereJahr(delta) {
  auswertungJahr += delta;
  renderJahresauswertung();
}