// ═══════════════════════════════════════════
// Dashboard – KPIs, Ampel, Diagramme
// ═══════════════════════════════════════════

let dashboardChart = null;
let kuchenChart = null;

async function renderDashboard() {
  const heute = new Date();
  const monat = heute.getMonth();
  const jahr  = heute.getFullYear();

  const buchungen = await ladeBuchungen(monat, jahr);

  // Berechnungen
  const einnahmen = buchungen.filter(b => b.art === 'Einnahme').reduce((s,b) => s + Number(b.betrag), 0);
  const ausgaben  = buchungen.filter(b => b.art === 'Ausgabe').reduce((s,b)  => s + Number(b.betrag), 0);
  const sparen    = buchungen.filter(b => b.art === 'Sparen').reduce((s,b)   => s + Number(b.betrag), 0);
  const rest      = einnahmen - ausgaben - sparen;
  const sparquote = einnahmen > 0 ? (sparen / einnahmen * 100) : 0;

  // Größte Ausgabenkategorie
  const katSummen = {};
  buchungen.filter(b => b.art === 'Ausgabe').forEach(b => {
    katSummen[b.kategorie] = (katSummen[b.kategorie] || 0) + Number(b.betrag);
  });
  const groessteKat = Object.entries(katSummen).sort((a,b) => b[1]-a[1])[0];

  // Ampel
  let ampelKlasse, ampelIcon, ampelTitel, ampelSub;
  if (rest > 500) {
    ampelKlasse = 'green'; ampelIcon = '🟢';
    ampelTitel = 'Gut – Du liegst im Budget!';
    ampelSub = `Noch ${formatEuro(rest)} verfügbar`;
  } else if (rest > 0) {
    ampelKlasse = 'yellow'; ampelIcon = '🟡';
    ampelTitel = 'Knapp – Ausgaben im Blick behalten!';
    ampelSub = `Noch ${formatEuro(rest)} verfügbar`;
  } else {
    ampelKlasse = 'red'; ampelIcon = '🔴';
    ampelTitel = 'Budget überschritten!';
    ampelSub = `${formatEuro(Math.abs(rest))} über dem Budget`;
  }

  const monatName = getMonatName(monat) + ' ' + jahr;

  document.getElementById('screen-dashboard').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div>
        <div style="font-size:1.1rem;font-weight:800;color:var(--text);">Guten ${tageszeit()}! 👋</div>
        <div style="font-size:0.82rem;color:var(--text-muted);">${monatName}</div>
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted);text-align:right;">
        ${buchungen.length} Buchungen<br>diesen Monat
      </div>
    </div>

    <!-- KPI Grid -->
    <div class="kpi-grid">
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
        <div class="kpi-label">Restbudget</div>
        <div class="kpi-value ${rest>=0?'green':'red'}">${formatEuro(rest)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">📈</div>
        <div class="kpi-label">Sparquote</div>
        <div class="kpi-value blue">${sparquote.toFixed(1)}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">🏆</div>
        <div class="kpi-label">Größte Ausgabe</div>
        <div class="kpi-value orange" style="font-size:0.9rem;">${groessteKat ? groessteKat[0] : '–'}</div>
        <div class="kpi-sub">${groessteKat ? formatEuro(groessteKat[1]) : ''}</div>
      </div>
    </div>

    <!-- Ampel -->
    <div class="ampel-card ${ampelKlasse}">
      <div class="ampel-icon">${ampelIcon}</div>
      <div class="ampel-text">
        <div class="ampel-title">${ampelTitel}</div>
        <div class="ampel-sub">${ampelSub}</div>
      </div>
    </div>

    <!-- Diagramm Einnahmen vs Ausgaben -->
    <div class="card">
      <div class="card-title">📊 Jahresverlauf</div>
      <div class="chart-container">
        <canvas id="chart-verlauf"></canvas>
      </div>
    </div>

    <!-- Diagramm Ausgaben nach Kategorie -->
    <div class="card">
      <div class="card-title">🥧 Ausgaben nach Kategorie</div>
      <div class="chart-container" style="height:200px;">
        <canvas id="chart-kategorien"></canvas>
      </div>
    </div>

    <!-- Letzte Buchungen -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div class="card-title" style="margin:0;">📋 Letzte Buchungen</div>
        <button class="btn btn-secondary btn-sm" onclick="navigateTo('buchungen')">Alle →</button>
      </div>
      <div class="buchung-liste">
        ${buchungen.slice(0,5).map(b => `
          <div class="buchung-item" onclick="navigateTo('buchungen')">
            <div class="buchung-dot ${b.art.toLowerCase()}">${katEmoji(b.kategorie)}</div>
            <div class="buchung-info">
              <div class="buchung-beschr">${b.beschreibung || b.kategorie}</div>
              <div class="buchung-meta">${b.kategorie} · ${formatDatum(b.datum)}</div>
            </div>
            <div class="buchung-betrag ${b.art.toLowerCase()}">${b.art==='Einnahme'?'+':'−'}${formatEuro(b.betrag)}</div>
          </div>`).join('') || '<div class="empty-state"><div class="empty-icon">📭</div><p>Noch keine Buchungen</p></div>'}
      </div>
    </div>
  `;

  // Jahresverlauf-Diagramm
  await renderJahresverlaufChart(jahr);

  // Kategorie-Diagramm
  renderKategorienChart(katSummen);
}

// ── Jahresverlauf Chart ──
async function renderJahresverlaufChart(jahr) {
  const canvas = document.getElementById('chart-verlauf');
  if (!canvas) return;

  // Alle Buchungen des Jahres laden
  const { data } = await db.from('buchungen')
    .select('datum, art, betrag')
    .eq('user_id', currentUser.id)
    .gte('datum', `${jahr}-01-01`)
    .lte('datum', `${jahr}-12-31`);

  const monate = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const einArr = new Array(12).fill(0);
  const ausArr = new Array(12).fill(0);

  (data || []).forEach(b => {
    const m = new Date(b.datum).getMonth();
    if (b.art === 'Einnahme') einArr[m] += Number(b.betrag);
    if (b.art === 'Ausgabe')  ausArr[m] += Number(b.betrag);
  });

  if (dashboardChart) dashboardChart.destroy();
  dashboardChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: monate,
      datasets: [
        {
          label: 'Einnahmen',
          data: einArr,
          backgroundColor: 'rgba(126,200,160,0.7)',
          borderColor: '#5a9e72',
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: 'Ausgaben',
          data: ausArr,
          backgroundColor: 'rgba(224,112,112,0.7)',
          borderColor: '#c0392b',
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${formatEuro(ctx.raw)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            font: { size: 10 },
            callback: v => v >= 1000 ? (v/1000).toFixed(1)+'k' : v
          }
        }
      }
    }
  });
}

// ── Kategorien Donut Chart ──
function renderKategorienChart(katSummen) {
  const canvas = document.getElementById('chart-kategorien');
  if (!canvas || Object.keys(katSummen).length === 0) return;

  const sorted = Object.entries(katSummen).sort((a,b) => b[1]-a[1]).slice(0,8);
  const labels = sorted.map(([k]) => k);
  const values = sorted.map(([,v]) => v);

  const farben = [
    '#6c8ebf','#8ec6a0','#f0a868','#e07070','#a78bca',
    '#60b8d4','#f0c060','#90a4ae'
  ];

  if (kuchenChart) kuchenChart.destroy();
  kuchenChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: farben,
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: { font: { size: 10 }, boxWidth: 10, padding: 8 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatEuro(ctx.raw)}`
          }
        }
      }
    }
  });
}

// ── Tageszeit-Begrüßung ──
function tageszeit() {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}