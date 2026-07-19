// ═══════════════════════════════════════════
// Supabase Konfiguration
// ═══════════════════════════════════════════

// ⚠️ HIER DEINE SUPABASE-DATEN EINTRAGEN:
const SUPABASE_URL = 'DEINE_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'DEIN_ANON_KEY';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

// Aktueller Nutzer
let currentUser = null;
let currentProfile = null;

async function getUser() {
  const { data: { user } } = await db.auth.getUser();
  currentUser = user;
  return user;
}

async function getProfile() {
  if (!currentUser) return null;
  const { data } = await db.from('profile').select('*').eq('id', currentUser.id).single();
  currentProfile = data;
  return data;
}

// Hilfsfunktion: Formatierung
function formatEuro(betrag) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(betrag || 0);
}

function formatDatum(datum) {
  if (!datum) return '';
  return new Date(datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMonat(datum) {
  if (!datum) return '';
  return new Date(datum).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function heuteISO() {
  return new Date().toISOString().split('T')[0];
}

function getMonatName(monat) {
  const monate = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  return monate[monat] || '';
}

// Kategorie-Emoji
function katEmoji(kategorie) {
  const map = {
    'Gehalt': '💼', 'Nebenjob': '💻', 'Verkäufe': '🛍️', 'Rückerstattungen': '↩️',
    'Sonstige Einnahmen': '💰', 'Miete': '🏠', 'Strom': '⚡', 'Internet': '🌐',
    'Handy': '📱', 'Versicherungen': '🛡️', 'Rundfunkbeitrag': '📺',
    'Lebensmittel': '🛒', 'Drogerie': '🧴', 'Freizeit': '🎮', 'Restaurants': '🍽️',
    'Kleidung': '👕', 'Mobilität': '🚗', 'Gesundheit': '💊',
    'Notgroschen': '🛡️', 'Urlaub': '✈️', 'Investitionen': '📈',
    'Geschenke': '🎁', 'Weiterbildung': '📚', 'Ungeplante Ausgaben': '⚠️'
  };
  return map[kategorie] || '📌';
}