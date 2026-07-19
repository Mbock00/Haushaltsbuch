// ═══════════════════════════════════════════
// CSV-Import – Sparkasse, VR Bank, Revolut, N26
// ═══════════════════════════════════════════

let erkannteCsvBuchungen = [];

async function renderCsvImport() {
  const target = document.getElementById('screen-mehr');

target.classList.add('active');

document.querySelectorAll('.screen').forEach(screen => {
  if (screen.id !== 'screen-mehr') {
    screen.classList.remove('active');
  }
});

target.innerHTML = `
    <div class="card">
      <h3>CSV-Import</h3>

      <p class="meta">
        Lade hier eine CSV-Datei deiner Bank hoch.
        Unterstützt werden Sparkasse, VR Bank, Revolut, N26 und viele ähnliche CSV-Dateien.
      </p>

      <div class="drop">
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
        >

        <p>
          CSV-Datei auswählen
        </p>
      </div>
    </div>

    <div id="csv-result"></div>
  `;

  document
    .getElementById('csv-file')
    .addEventListener('change', handleCsvImport);
}

async function handleCsvImport(event) {
  const file = event.target.files[0];

  if (!file) {
    toast('Keine Datei ausgewählt.');
    return;
  }

  const text = await file.text();

  erkannteCsvBuchungen = parseBankCsv(text);

  if (!erkannteCsvBuchungen.length) {
    document.getElementById('csv-result').innerHTML = `
      <div class="card">
        <h3>Keine Buchungen erkannt</h3>
        <p class="meta">
          Die Datei konnte nicht gelesen werden.
          Prüfe bitte, ob es wirklich eine CSV-Datei ist.
        </p>
      </div>
    `;
    return;
  }

  renderCsvPreview(erkannteCsvBuchungen);
}

function renderCsvPreview(rows) {
  const einnahmen = rows.filter(row => row.art === 'Einnahme').length;
  const ausgaben = rows.filter(row => row.art === 'Ausgabe').length;

  document.getElementById('csv-result').innerHTML = `
    <div class="card">
      <h3>${rows.length} Buchungen erkannt</h3>

      <p class="meta">
        ${einnahmen} Einnahmen · ${ausgaben} Ausgaben
      </p>

      <button
        class="primary"
        onclick="importCsvRows()">
        Alle Buchungen importieren
      </button>
    </div>

    <div class="card">
      <h3>Vorschau</h3>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Beschreibung</th>
              <th>Art</th>
              <th>Kategorie</th>
              <th>Betrag</th>
            </tr>
          </thead>

          <tbody>
            ${rows
              .slice(0, 100)
              .map(row => `
                <tr>
                  <td>${formatDate(row.datum)}</td>
                  <td>${escapeHtml(row.beschreibung)}</td>
                  <td>${escapeHtml(row.art)}</td>
                  <td>${escapeHtml(row.kategorie)}</td>
                  <td>${euro(row.betrag)}</td>
                </tr>
              `)
              .join('')}
          </tbody>
        </table>
      </div>

      ${
        rows.length > 100
          ? `<p class="meta">Es werden nur die ersten 100 Zeilen angezeigt. Importiert werden alle.</p>`
          : ''
      }
    </div>
  `;
}

function parseBankCsv(text) {
  const lines = text
    .replace(/\uFEFF/g, '')
    .split(/\r?\n/)
    .filter(line => line.trim());

  if (lines.length < 2) {
    return [];
  }

  const separator = detectSeparator(lines[0]);

  const header = splitCsvLine(lines[0], separator)
    .map(item => normalizeHeader(item));

  const bankType = detectBankType(header);

  return lines
    .slice(1)
    .map(line => splitCsvLine(line, separator))
    .map(columns => mapCsvRow(columns, header, bankType))
    .filter(Boolean)
    .filter(row => row.datum && row.betrag > 0);
}

function detectSeparator(firstLine) {
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (tabCount > semicolonCount && tabCount > commaCount) {
    return '\t';
  }

  return semicolonCount >= commaCount ? ';' : ',';
}

function splitCsvLine(line, separator) {
  const result = [];
  let current = '';
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === separator && !quoted) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());

  return result;
}

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\uFEFF/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectBankType(header) {
  const joined = header.join(' | ');

  if (
    joined.includes('buchungstag') ||
    joined.includes('verwendungszweck') ||
    joined.includes('beguenstigter') ||
    joined.includes('auftraggeber')
  ) {
    return 'sparkasse';
  }

  if (
    joined.includes('valuta') ||
    joined.includes('buchungstext') ||
    joined.includes('umsatz')
  ) {
    return 'vrbank';
  }

  if (
    joined.includes('started date') ||
    joined.includes('completed date') ||
    joined.includes('description') ||
    joined.includes('fee')
  ) {
    return 'revolut';
  }

  if (
    joined.includes('payee') ||
    joined.includes('amount eur') ||
    joined.includes('amount (eur)')
  ) {
    return 'n26';
  }

  return 'unknown';
}

function mapCsvRow(columns, header, bankType) {
  let dateValue = '';
  let descriptionValue = '';
  let amountValue = '';

  if (bankType === 'sparkasse') {
    dateValue =
      getColumn(columns, header, ['buchungstag', 'valuta', 'datum']);

    descriptionValue = [
      getColumn(columns, header, ['verwendungszweck']),
      getColumn(columns, header, ['beguenstigter']),
      getColumn(columns, header, ['auftraggeber']),
      getColumn(columns, header, ['buchungstext'])
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    amountValue =
      getColumn(columns, header, ['betrag', 'umsatz']);
  }

  if (bankType === 'vrbank') {
    dateValue =
      getColumn(columns, header, ['valuta', 'buchungstag', 'datum']);

    descriptionValue = [
      getColumn(columns, header, ['buchungstext']),
      getColumn(columns, header, ['verwendungszweck']),
      getColumn(columns, header, ['name zahlungspflichtiger']),
      getColumn(columns, header, ['name zahlungsempfaenger'])
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    amountValue =
      getColumn(columns, header, ['umsatz', 'betrag']);
  }

  if (bankType === 'revolut') {
    dateValue =
      getColumn(columns, header, ['completed date', 'started date', 'date']);

    descriptionValue =
      getColumn(columns, header, ['description', 'merchant', 'type']);

    amountValue =
      getColumn(columns, header, ['amount']);
  }

  if (bankType === 'n26') {
    dateValue =
      getColumn(columns, header, ['date', 'booking date']);

    descriptionValue =
      getColumn(columns, header, ['payee', 'partner iban', 'reference text', 'description']);

    amountValue =
      getColumn(columns, header, ['amount eur', 'amount (eur)', 'amount']);
  }

  if (bankType === 'unknown') {
    dateValue =
      getColumn(columns, header, ['datum', 'date', 'buchungstag', 'valuta']);

    descriptionValue =
      getColumn(columns, header, [
        'beschreibung',
        'description',
        'verwendungszweck',
        'buchungstext',
        'payee',
        'merchant'
      ]);

    amountValue =
      getColumn(columns, header, [
        'betrag',
        'amount',
        'umsatz',
        'wert'
      ]);
  }

  const amount = parseCsvAmount(amountValue);

  if (!dateValue || !amount) {
    return null;
  }

  const datum = normalizeCsvDate(dateValue);

  if (!datum) {
    return null;
  }

  const beschreibung =
    descriptionValue ||
    'CSV Import';

  return {
    datum,
    art: amount >= 0 ? 'Einnahme' : 'Ausgabe',
    betrag: Math.abs(amount),
    beschreibung,
    kategorie: guessCsvCategory(beschreibung, amount)
  };
}

function getColumn(columns, header, possibleNames) {
  const index = header.findIndex(headerName =>
    possibleNames.some(name =>
      headerName.includes(normalizeHeader(name))
    )
  );

  if (index < 0) {
    return '';
  }

  return columns[index] || '';
}

function parseCsvAmount(value) {
  if (!value) {
    return 0;
  }

  let cleaned = String(value)
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(/EUR/gi, '');

  const isNegative =
    cleaned.includes('-') ||
    cleaned.includes('−');

  cleaned = cleaned
    .replace(/[−]/g, '-')
    .replace(/[+]/g, '');

  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  cleaned = cleaned.replace(/[^0-9.-]/g, '');

  let number = Number(cleaned);

  if (!Number.isFinite(number)) {
    return 0;
  }

  if (isNegative && number > 0) {
    number = number * -1;
  }

  return number;
}

function normalizeCsvDate(value) {
  const clean = String(value || '').trim();

  let match = clean.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  match = clean.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (match) {
    return `20${match[3]}-${match[2]}-${match[1]}`;
  }

  match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  match = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  match = clean.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (match) {
    return `20${match[3]}-${match[2]}-${match[1]}`;
  }

  return null;
}

function guessCsvCategory(description, amount) {
  const text = String(description || '').toLowerCase();

  if (amount > 0 && /gehalt|lohn|salary|arbeitgeber|entgelt/.test(text)) {
    return 'Gehalt';
  }

  if (/rewe|edeka|aldi|lidl|penny|netto|kaufland|tegut|supermarkt/.test(text)) {
    return 'Lebensmittel';
  }

  if (/dm|rossmann|mueller|müller|douglas/.test(text)) {
    return 'Drogerie';
  }

  if (/miete|vermieter|wohnung|garage/.test(text)) {
    return 'Miete';
  }

  if (/strom|energie|stadtwerke|ewr|vattenfall|enbw|eon|e\.on/.test(text)) {
    return 'Strom';
  }

  if (/telekom|vodafone|o2|telefonica|handy|mobilfunk/.test(text)) {
    return 'Handy';
  }

  if (/internet|dsl|glasfaser/.test(text)) {
    return 'Internet';
  }

  if (/versicherung|allianz|huk|devk|axa|ergo|signal iduna/.test(text)) {
    return 'Versicherungen';
  }

  if (/rundfunk|ard zdf|beitragsservice|gez/.test(text)) {
    return 'Rundfunkbeitrag';
  }

  if (/shell|aral|esso|total|tankstelle|bahn|deutsche bahn|db vertrieb|taxi|uber|bolt/.test(text)) {
    return 'Mobilität';
  }

  if (/restaurant|pizza|burger|mcdonald|kfc|subway|döner|doener|cafe|café|bäcker|baecker/.test(text)) {
    return 'Restaurants';
  }

  if (/netflix|spotify|disney|prime video|kino|steam|playstation|xbox|fitness|gym/.test(text)) {
    return 'Freizeit';
  }

  if (/apotheke|arzt|zahnarzt|klinikum|krankenhaus|optiker/.test(text)) {
    return 'Gesundheit';
  }

  if (/amazon|paypal|ebay|otto|ikea|obi|bauhaus|hornbach/.test(text)) {
    return 'Ungeplante Ausgaben';
  }

  if (/spar|tagesgeld|depot|trade republic|scalable|invest/.test(text)) {
    return 'Investitionen';
  }

  return amount >= 0 ? 'Sonstige Einnahmen' : 'Ungeplante Ausgaben';
}

async function importCsvRows() {
  if (!erkannteCsvBuchungen.length) {
    toast('Keine Buchungen zum Importieren vorhanden.');
    return;
  }

  let imported = 0;
  let skipped = 0;

  for (const row of erkannteCsvBuchungen) {
    const isDuplicate = await csvRowExists(row);

    if (isDuplicate) {
      skipped++;
      continue;
    }

    const { error } = await saveCsvTransaction(row);

    if (!error) {
      imported++;
    }
  }

  toast(`${imported} Buchungen importiert. ${skipped} Duplikate übersprungen.`);

  erkannteCsvBuchungen = [];
  await routeTo('buchungen');
}

async function csvRowExists(row) {
  const { data, error } = await db
    .from('buchungen')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('datum', row.datum)
    .eq('betrag', row.betrag)
    .eq('beschreibung', row.beschreibung)
    .limit(1);

  if (error) {
    console.warn(error);
    return false;
  }

  return data && data.length > 0;
}

async function saveCsvTransaction(row) {
  return db
    .from('buchungen')
    .insert({
      user_id: currentUser.id,
      datum: row.datum,
      art: row.art,
      kategorie: row.kategorie,
      beschreibung: row.beschreibung,
      betrag: row.betrag
    });
}
