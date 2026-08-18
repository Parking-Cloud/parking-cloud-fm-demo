/* ============================================================================
   PARKING CLOUD · Demo SaaS — state.js
   ----------------------------------------------------------------------------
   UNICA FONTE DI VERITÀ. Nessuna sezione tiene copie locali del dato.

   Struttura del file
     0. Utils            — PRNG deterministico, date, id
     1. Domini           — enum e label dei valori di dominio
     2. Seed             — dati demo (zone, dipendenti, visitatori, HW, config)
     3. AppState         — l'oggetto di stato
     4. Selectors        — TUTTO ciò che è derivato (KPI, stato stallo, filtri)
     5. Actions          — le uniche funzioni che scrivono sullo stato
     6. Store            — pub/sub: ogni mutazione notifica tutte le sezioni

   PRINCIPIO ARCHITETTURALE
     Lo stato di uno stallo (libero / occupato / prenotato / manutenzione)
     NON è memorizzato: è DERIVATO da prenotazioni + accessi + visitatori +
     attributi dello stallo. È questo che rende automatica la coerenza
     inter-sezione richiesta (es. dipendente dichiara Smart Working → lo
     stallo risulta libero nella mappa FM, senza codice di sincronizzazione).

     Sullo stallo si memorizzano solo gli ATTRIBUTI (tipo, disponibilità,
     titolare, durata max, note): quelli sì sono modificabili dal FM.
============================================================================ */
(function (global) {
'use strict';

/* ==========================================================================
   0. UTILS
========================================================================== */

/* PRNG deterministico: il seed demo dev'essere identico ad ogni reload,
   altrimenti i KPI "ballano" ad ogni F5 durante una presentazione. */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const SEED_DEMO = 20260817;
/* `let` e non `const`: il ripristino demo deve poter riavvolgere il PRNG.
   rInt/rPick/shuffle leggono `rnd` al momento della chiamata, quindi
   riassegnarlo qui basta a farli ripartire dalla stessa sequenza. */
let rnd = mulberry32(SEED_DEMO);
const rInt  = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const rPick = (arr) => arr[Math.floor(rnd() * arr.length)];

const DAYS_IT      = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const DAYS_FULL_IT = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MONTHS_IT    = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function startOfDay(d) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function getMonday(d) {
  const r = startOfDay(d);
  const day = r.getDay();                       // 0 = domenica
  return addDays(r, day === 0 ? -6 : 1 - day);
}
function toISO(d)      { const r = new Date(d); return r.getFullYear() + '-' + String(r.getMonth() + 1).padStart(2, '0') + '-' + String(r.getDate()).padStart(2, '0'); }
/** Lunedi'-venerdi'. Sabato e domenica non contano nella finestra di prenotazione. */
function isLavorativo(d) { const g = d.getDay(); return g >= 1 && g <= 5; }
/** I primi `n` giorni lavorativi a partire da `da` INCLUSO.
    La data di partenza e' un parametro e non OGGI: e' l'unico modo di
    verificare il caso "oggi = lunedi'" senza spostare l'orologio del browser. */
function giorniLavorativi(da, n) {
  const out = [];
  let d = startOfDay(da);
  while (out.length < n) { if (isLavorativo(d)) out.push(new Date(d)); d = addDays(d, 1); }
  return out;
}
function fromISO(s)    { const [y, m, g] = s.split('-').map(Number); return new Date(y, m - 1, g); }
function fmtShort(d)   { return DAYS_IT[d.getDay()] + ' ' + d.getDate(); }
function fmtMedium(d)  { return DAYS_FULL_IT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_IT[d.getMonth()]; }
function fmtDM(d)      { return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }
function hhmm(d)       { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function minutesToHHMM(min) { return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
/** Durata leggibile fra due timestamp: "9h 42m" */
function fmtDurata(ms) {
  const tot = Math.max(0, Math.floor(ms / 60000));
  return Math.floor(tot / 60) + 'h ' + String(tot % 60).padStart(2, '0') + 'm';
}
function fmtMinuti(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  return m < 60 ? m + 'min' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
}
/** Array di oggetti -> CSV con delimitatore ';'.
    Il punto e virgola e' quello che Excel si aspetta in locale italiano:
    con la virgola l'intero record finirebbe in una sola colonna. */
function toCSV(righe) {
  if (!righe || !righe.length) return '';
  const SEP = ';';
  const cols = Object.keys(righe[0]);
  const cell = (v) => {
    const s = (v === null || v === undefined) ? '' : String(v);
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(SEP)]
    .concat(righe.map(r => cols.map(c => cell(r[c])).join(SEP)))
    .join('\r\n');
}

function iniziali(nome, cognome) { return (nome[0] + cognome[0]).toUpperCase(); }
function slug(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, ''); }
/** mescolamento deterministico (Fisher-Yates con il PRNG del seed) */
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* Generatore di id progressivi per collezione */
const _seq = {};
function nextId(prefix) { _seq[prefix] = (_seq[prefix] || 0) + 1; return prefix + '-' + String(_seq[prefix]).padStart(4, '0'); }
/** Riavvolge PRNG e contatori: senza questo il rebuild darebbe id diversi. */
function resetGeneratori() {
  rnd = mulberry32(SEED_DEMO);
  Object.keys(_seq).forEach(k => delete _seq[k]);
}

/* Date di riferimento della sessione */
const OGGI       = startOfDay(new Date());
const OGGI_ISO   = toISO(OGGI);
const LUN_CORR   = getMonday(OGGI);
const GIORNI_SET = [0, 1, 2, 3, 4].map(i => addDays(LUN_CORR, i));   // Lun→Ven settimana corrente

/* Settimane gia' trascorse del mese corrente: servono a dare profondita' agli
   Analytics (confronto settimana/mese) e allo storico prenotazioni del
   dipendente. Sono tutte prenotazioni CHIUSE: non occupano stalli. */
const GIORNI_PASSATI = (() => {
  const out = [];
  let lun = addDays(LUN_CORR, -7);
  while (lun.getMonth() === OGGI.getMonth() || lun.getDate() > 21) {
    if (lun.getMonth() !== OGGI.getMonth()) break;
    for (let i = 0; i < 5; i++) {
      const g = addDays(lun, i);
      if (g < OGGI && g.getMonth() === OGGI.getMonth()) out.push(g);
    }
    lun = addDays(lun, -7);
  }
  return out.sort((x, y) => x - y);
})();

/* Tutti i giorni feriali del mese gia' trascorsi, compresi quelli della
   settimana in corso. GIORNI_PASSATI si ferma alla settimana precedente
   (le prenotazioni della corrente le genera GIORNI_SET), ma accessi e
   visitatori storici devono coprire anche lun→ieri. */
const GIORNI_TRASCORSI = (() => {
  const out = [];
  const primo = new Date(OGGI.getFullYear(), OGGI.getMonth(), 1);
  for (let d = new Date(primo); d < OGGI; d = addDays(d, 1)) {
    if (d.getDay() >= 1 && d.getDay() <= 5) out.push(new Date(d));
  }
  return out;
})();

/* ==========================================================================
   1. DOMINI
========================================================================== */

const TIPO_STALLO = {
  standard:    { label: 'Standard',       icona: '',  cls: 'ms-free', tagCls: 'tag-gray'   },
  ev:          { label: 'EV ⚡',          icona: '⚡', cls: 'ms-ev',   tagCls: 'tag-sky'    },
  disabili:    { label: 'Disabili ♿',     icona: '♿', cls: 'ms-dis',  tagCls: 'tag-purple' },
  visitatori:  { label: 'Solo Visitatori', icona: '🪪', cls: 'ms-book', tagCls: 'tag-blue'  },
  manutenzione:{ label: 'Manutenzione',   icona: '🔧', cls: 'ms-maint', tagCls: 'tag-amber' }
};

const DISPONIBILITA = {
  sempre:       'Sempre disponibile',
  prenotazione: 'Solo su prenotazione',
  bloccato:     'Bloccato / fuori servizio'
};

/* Stati DERIVATI dello stallo (mai memorizzati) */
const STATO_STALLO = {
  libero:       { label: 'Libero',               cls: 'ms-free'  },
  prenotato:    { label: 'Prenotato',            cls: 'ms-occ'   },  // RF07: unificato con occupato
  occupato:     { label: 'Occupato',             cls: 'ms-occ'   },
  visitatore:   { label: 'Occupato — visitatore', cls: 'ms-occ'  },
  violazione:   { label: 'Occupazione abusiva',  cls: 'ms-viol'  },
  manutenzione: { label: 'Manutenzione',         cls: 'ms-maint' },
  bloccato:     { label: 'Bloccato',             cls: 'ms-maint' }
};

const METODO_ACCESSO = {
  app:       'App mobile',
  pin:       'PIN Keypad',
  qr:        'QR Code',
  bluetooth: 'Bluetooth',
  targa:     'ANPR (targa)',
  badge2n:   'Badge 2N',
  app2n:     'App + 2N',
  pass:      'Pass temporaneo',
  nd:        '–'
};

const TIPO_SEGNALAZIONE = {
  abusivo: { label: 'Stallo occupato abusivamente', icona: '🚨', gravitaDefault: 'urgente' },
  durata:  { label: 'Durata massima superata',      icona: '⏰', gravitaDefault: 'media'   },
  zona:    { label: 'Veicolo in zona non autorizzata', icona: '🚧', gravitaDefault: 'media' },
  guasto:  { label: 'Guasto / stallo danneggiato',  icona: '🔧', gravitaDefault: 'media'   },
  ev:      { label: 'Colonnina EV non funzionante', icona: '🔋', gravitaDefault: 'media'   },
  altro:   { label: 'Altro problema',               icona: '❓', gravitaDefault: 'bassa'   }
};

/* Dispositivi supportati: in produzione + integrazioni in roadmap */
const TIPI_HW = {
  tastierino2n: { label: 'Tastierino 2N',        icona: '🔢', metodoAccesso: 'pin'       },
  bluetooth:    { label: 'Bluetooth / 1Control', icona: '📶', metodoAccesso: 'bluetooth' },
  anpr:         { label: 'Telecamera ANPR',      icona: '📷', metodoAccesso: 'targa'     },
  qrreader:     { label: 'Lettore QR Code',      icona: '📱', metodoAccesso: 'qr'        },
  sbarra:       { label: 'Sbarra automatica',    icona: '🚧', metodoAccesso: null        },
  pilomat:      { label: 'Pilomat',              icona: '🔩', metodoAccesso: null        }
};

const DIPARTIMENTI = ['Finance', 'HR', 'Design', 'Marketing', 'IT', 'Sales', 'Operations', 'Legal'];

/* ── RUOLI E PERMESSI ──────────────────────────────────────────────────────
   Gerarchia: Admin > Facility Manager > Dipendente.
   Un solo prodotto: Admin e FM condividono la stessa interfaccia, cambia
   solo ciò che i permessi abilitano.                                       */
const RUOLI = {
  admin:      { label: 'Admin',            badge: 'Admin',            colore: 'cyan' },
  fm:         { label: 'Facility Manager', badge: 'Facility Manager', colore: 'blue' },
  dipendente: { label: 'Dipendente',       badge: 'Dipendente',       colore: 'gray' }
};

const PERMISSIONS = {
  admin: {
    dashboard: true, mappa: true, mappaEdit: true, accessi: true, prenotazioni: true,
    analytics: true, segnalazioni: true, dipendenti: true, visitatori: true,
    hardware: true, config: true,
    amministrazione: true, gestioneRuoli: true, creaFM: true, creaAdmin: true
  },
  fm: {
    dashboard: true, mappa: true, mappaEdit: true, accessi: true, prenotazioni: true,
    analytics: true, segnalazioni: true, dipendenti: true, visitatori: true,
    hardware: true, config: true,
    amministrazione: false, gestioneRuoli: false, creaFM: false, creaAdmin: false
  },
  dipendente: {
    dashboard: false, mappa: false, mappaEdit: false, accessi: false, prenotazioni: false,
    analytics: false, segnalazioni: false, dipendenti: false, visitatori: false,
    hardware: false, config: false,
    amministrazione: false, gestioneRuoli: false, creaFM: false, creaAdmin: false,
    /* permessi esclusivi del dipendente */
    vistaDipendente: true, prenotazionePersonale: true, inviaSegnalazione: true,
    storico: true, profilo: true
  }
};

/* Stati dell'account (modello invite-only: nessuna registrazione pubblica) */
const STATO_ACCOUNT = {
  attivo:            { label: 'Attivo',            colore: 'green' },
  invito_inviato:    { label: 'Invito inviato',    colore: 'amber' },
  invito_da_inviare: { label: 'Invito da inviare', colore: 'gray'  },
  disattivato:       { label: 'Disattivato',       colore: 'red'   }
};

/* ==========================================================================
   2. SEED
========================================================================== */

const SEDE = {
  nome:      'Sede Demo — Centro Direzionale A',
  nomeBreve: 'Centro Direzionale A',
  descrizione: 'Sede Demo · Centro Direzionale A',
  dominioEmail: 'aziendademo.it',
  helpdesk:  'helpdesk@parkingcloud.eu'
};

/* --- 2.1 Zone -------------------------------------------------------------
   40+48+36+16+6+8 = 154 nell'AS-IS, ma la sede è dichiarata a 156 posti.
   Incoerenza risolta portando la Zona A a 42 → totale esattamente 156.
   Il KPI "Posti Totali" è comunque derivato da stalli.length.            */
const ZONE_SEED = [
  { id: 'A',  nome: 'Zona A — Piano -1',        piano: 'Piano -1', posti: 42, tipoDefault: 'standard',   colore: 'gold',   note: '' },
  { id: 'B',  nome: 'Zona B — Piano -1 (2N)',   piano: 'Piano -1', posti: 48, tipoDefault: 'standard',   colore: 'gold',   note: 'Accesso cancello 2N' },
  { id: 'C',  nome: 'Zona C — Piano -2',        piano: 'Piano -2', posti: 36, tipoDefault: 'standard',   colore: 'gold',   note: '' },
  { id: 'V',  nome: 'Zona V — Visitatori',      piano: 'Piano -1', posti: 16, tipoDefault: 'visitatori', colore: 'purple', note: 'Riservata pass temporanei' },
  { id: 'EV', nome: 'Zona EV ⚡',               piano: 'Piano -1', posti:  6, tipoDefault: 'ev',         colore: 'sky',    note: 'Colonnine 22 kW' },
  { id: 'H',  nome: 'Zona H — ♿ Disabili',      piano: 'Piano -1', posti:  8, tipoDefault: 'disabili',   colore: 'blue',   note: '' }
];

/* Stalli fuori servizio nel seed (mostrano il colore "manutenzione" in mappa) */
const STALLI_MANUTENZIONE = ['C-35', 'C-36'];
/* Stalli tenuti fuori dall'assegnazione automatica perché "raccontano" una
   storia specifica: A-31 ospita il veicolo in sosta prolungata (segnalazione),
   B-42 è il posto di Sara Bellotti occupato abusivamente. */
const STALLI_RISERVATI_DEMO = ['A-31', 'B-42'];

function buildStalli(zone) {
  const out = [];
  zone.forEach(z => {
    for (let i = 1; i <= z.posti; i++) {
      const codice = z.id + '-' + String(i).padStart(2, '0');
      out.push({
        id:            codice,          // il codice È l'id: leggibile ovunque
        codice,
        zonaId:        z.id,
        piano:         z.piano,
        tipo:          STALLI_MANUTENZIONE.includes(codice) ? 'manutenzione' : z.tipoDefault,
        disponibilita: 'sempre',
        titolareId:    null,            // dipendente con stallo fisso assegnato
        durataMaxOre:  z.tipoDefault === 'ev' ? 4 : z.tipoDefault === 'visitatori' ? 8 : 10,
        note:          ''
      });
    }
  });
  return out;
}

/* --- 2.2 Dipendenti -------------------------------------------------------
   12 dipendenti "in evidenza" (usati da prenotazioni, segnalazioni, accessi
   e da tutti i percorsi di test) + anagrafica generata fino a 312.        */
const DIPENDENTI_SEED = [
  /* utenteDemo = l'account con cui si entra come Dipendente.
     NB: "Marco Bianchi" è il Facility Manager di piattaforma (vedi
     UTENTI_PIATTAFORMA); il dipendente demo ha un nome diverso per non
     avere due persone omonime con ruoli diversi. */
  { nome: 'Matteo',   cognome: 'Bruni',    dip: 'Finance',    stallo: 'A-07', caratt: 'standard', utenteDemo: true, email: 'dipendente@demo.parkingcloud.eu', pass: true },
  { nome: 'Laura',    cognome: 'Conti',    dip: 'Design',     stallo: 'B-22', caratt: 'standard', pass: true },
  { nome: 'Elena',    cognome: 'Ricci',    dip: 'Marketing',  stallo: 'EV-02', caratt: 'ev' },
  { nome: 'Paolo',    cognome: 'Marini',   dip: 'IT',         stallo: null,   caratt: 'standard', bloccato: { motivo: '3x occupazione abusiva', tipo: 'abusivo', giorniFa: 15 } },
  { nome: 'Anna',     cognome: 'Ferri',    dip: 'Sales',      stallo: null,   caratt: 'standard', bloccato: { motivo: 'Superamento durata max', tipo: 'durata', giorniFa: 21 } },
  { nome: 'Sara',     cognome: 'Bellotti', dip: 'HR',         stallo: 'B-42', caratt: 'standard', pass: true },
  { nome: 'Davide',   cognome: 'Neri',     dip: 'Operations', stallo: 'B-15', caratt: 'standard' },
  { nome: 'Giulia',   cognome: 'Moretti',  dip: 'Finance',    stallo: 'H-03', caratt: 'disabili' },
  { nome: 'Luca',     cognome: 'Gatti',    dip: 'IT',         stallo: 'C-14', caratt: 'standard' },
  { nome: 'Chiara',   cognome: 'Riva',     dip: 'Legal',      stallo: 'A-25', caratt: 'standard' },
  { nome: 'Stefano',  cognome: 'Longo',    dip: 'Sales',      stallo: 'B-31', caratt: 'standard' },
  { nome: 'Martina',  cognome: 'Serra',    dip: 'Design',     stallo: 'C-22', caratt: 'standard' }
];

const NOMI_M = ['Alessandro','Andrea','Antonio','Carlo','Daniele','Emanuele','Fabio','Federico','Filippo','Francesco','Gabriele','Giacomo','Giovanni','Jacopo','Lorenzo','Matteo','Michele','Nicola','Pietro','Riccardo','Roberto','Samuele','Simone','Tommaso','Valerio'];
const NOMI_F = ['Alessia','Alice','Beatrice','Camilla','Caterina','Cristina','Eleonora','Federica','Francesca','Ilaria','Irene','Lucia','Marta','Michela','Monica','Noemi','Paola','Roberta','Sofia','Silvia','Valentina','Veronica','Viola'];
const COGNOMI = ['Aldini','Barbieri','Basile','Bruni','Caputo','Carbone','Colombo','Costa','Damiani','De Angelis','Esposito','Fabbri','Fontana','Galli','Giordano','Grassi','Guerra','Leone','Lombardi','Mancini','Marchetti','Martinelli','Mazza','Messina','Milani','Montanari','Negri','Orlando','Palmieri','Parisi','Pellegrini','Piras','Rizzo','Rossetti','Sala','Santoro','Sartori','Silvestri','Testa','Valenti','Vitali','Zanetti'];

const N_DIPENDENTI = 312;   // KPI "Autorizzati"
const N_APP_ATTIVA = 287;   // KPI "App attiva"  (92%)
/* Il "pool rotante" NON è un parametro: è derivato (dipendenti senza stallo
   fisso). Con 312 autorizzati e 126 stalli standard è fisiologicamente alto —
   è esattamente il problema che il prodotto risolve. */

function buildDipendenti(stalli) {
  const out = [];
  const usati = new Set();

  DIPENDENTI_SEED.forEach(s => {
    const id = nextId('DIP');
    if (s.stallo) usati.add(s.stallo);
    out.push({
      id,
      nome: s.nome, cognome: s.cognome,
      nomeCompleto: s.nome + ' ' + s.cognome,
      iniziali: iniziali(s.nome, s.cognome),
      email: s.email || (slug(s.nome)[0] + '.' + slug(s.cognome) + '@' + SEDE.dominioEmail),
      dipartimento: s.dip,
      stalloId: s.stallo || null,
      poolRotante: !s.stallo && !s.bloccato,
      caratteristica: s.caratt,
      metodoAccesso: s.bloccato ? 'sospeso' : 'app2n',
      appAttiva: !s.bloccato,
      stato: s.bloccato ? 'bloccato' : 'attivo',
      bloccoMotivo: s.bloccato ? s.bloccato.motivo : null,
      bloccoTipo:   s.bloccato ? s.bloccato.tipo   : null,
      bloccoDal:    s.bloccato ? toISO(addDays(OGGI, -s.bloccato.giorniFa)) : null,
      accessiMese: rInt(12, 21),
      noShow: 0,
      segnalazioniFatte: 0,
      statoAccount: 'attivo',
      /* abilitazione a richiedere un pass visitatore: concessa dal FM caso
         per caso, quindi false per default e true solo dove il seed la dichiara */
      puoRichiederePass: !!s.pass,
      utenteDemo: !!s.utenteDemo,
      inEvidenza: true
    });
  });

  /* Stalli standard assegnabili come "fissi" (esclusi V / manutenzione /
     riservati alla narrazione demo), mescolati per distribuire le zone. */
  const assegnabili = shuffle(stalli
    .filter(s => ['A', 'B', 'C'].includes(s.zonaId) && s.tipo !== 'manutenzione'
              && !usati.has(s.codice) && !STALLI_RISERVATI_DEMO.includes(s.codice))
    .map(s => s.codice));

  let k = 0;
  while (out.length < N_DIPENDENTI) {
    const f = rnd() < 0.46;
    const nome = f ? rPick(NOMI_F) : rPick(NOMI_M);
    const cognome = rPick(COGNOMI);
    const stalloId = k < assegnabili.length ? assegnabili[k++] : null;
    const id = nextId('DIP');
    out.push({
      id,
      nome, cognome,
      nomeCompleto: nome + ' ' + cognome,
      iniziali: iniziali(nome, cognome),
      email: slug(nome)[0] + '.' + slug(cognome) + out.length + '@' + SEDE.dominioEmail,
      dipartimento: rPick(DIPARTIMENTI),
      stalloId,
      poolRotante: !stalloId,
      caratteristica: 'standard',
      metodoAccesso: 'app2n',
      appAttiva: true,
      stato: 'attivo',
      bloccoMotivo: null, bloccoTipo: null, bloccoDal: null,
      accessiMese: rInt(6, 22),
      noShow: rnd() < 0.12 ? rInt(1, 2) : 0,
      segnalazioniFatte: rnd() < 0.1 ? 1 : 0,
      statoAccount: 'attivo',
      puoRichiederePass: false,
      utenteDemo: false,
      inEvidenza: false
    });
  }

  /* Allinea il conteggio "App attiva" al KPI dichiarato */
  const attivi = out.filter(d => d.stato === 'attivo');
  for (let i = attivi.length - 1, spente = attivi.length - N_APP_ATTIVA; spente > 0 && i >= 0; i--) {
    if (attivi[i].appAttiva && !attivi[i].inEvidenza) { attivi[i].appAttiva = false; attivi[i].metodoAccesso = 'app'; spente--; }
  }

  /* Ribalta il titolare sullo stallo (relazione bidirezionale coerente) */
  const byCode = new Map(stalli.map(s => [s.codice, s]));
  out.forEach(d => { if (d.stalloId && byCode.has(d.stalloId)) byCode.get(d.stalloId).titolareId = d.id; });

  return out;
}

/* --- 2.3 Prenotazioni della settimana corrente ----------------------------
   Volumi per giorno (Lun→Ven). "attive" = tengono occupato lo stallo;
   "completate" = il dipendente è già uscito, lo stallo è tornato libero.  */
const PRENOTAZIONI_GIORNO = [
  { ufficioAttive: 112, ufficioCompletate: 21, sw: 22 },  // Lun
  { ufficioAttive: 110, ufficioCompletate: 24, sw: 25 },  // Mar
  { ufficioAttive: 108, ufficioCompletate: 25, sw: 24 },  // Mer
  { ufficioAttive: 104, ufficioCompletate: 23, sw: 29 },  // Gio
  { ufficioAttive:  84, ufficioCompletate: 19, sw: 41 }   // Ven
];

function buildPrenotazioni(dipendenti, stalli) {
  const out = [];
  const attivi = dipendenti.filter(d => d.stato === 'attivo');
  const byCode = new Map(stalli.map(s => [s.codice, s]));
  /* pool prenotabile: niente zona V (visitatori), niente manutenzione,
     niente stalli riservati alla narrazione demo. Mescolato → l'occupazione
     si distribuisce su tutte le zone invece di riempire la A per prima. */
  const pool = shuffle(stalli
    .filter(s => s.tipo !== 'manutenzione' && s.tipo !== 'visitatori'
              && !STALLI_RISERVATI_DEMO.includes(s.codice))
    .map(s => s.codice));

  /** compatibilità stallo ↔ caratteristica del dipendente */
  const compatibile = (codice, dip) => {
    const st = byCode.get(codice);
    if (!st) return false;
    if (st.tipo === 'ev')       return dip.caratteristica === 'ev';
    if (st.tipo === 'disabili') return dip.caratteristica === 'disabili';
    return dip.caratteristica === 'standard';
  };

  /* --- storico: giorni gia' passati del mese, tutti chiusi --- */
  GIORNI_PASSATI.forEach((giorno, idx) => {
    const iso = toISO(giorno);
    const gi = (giorno.getDay() + 6) % 5;
    const conf = PRENOTAZIONI_GIORNO[Math.min(gi, 4)];
    const quanti = Math.round(conf.ufficioAttive * (0.86 + (idx % 5) * 0.05));
    const ordinati = attivi.slice(idx * 13).concat(attivi.slice(0, idx * 13));
    for (let n = 0; n < quanti && n < ordinati.length; n++) {
      const dip = ordinati[n];
      out.push({
        id: nextId('PRE'), dipendenteId: dip.id, data: iso, tipo: 'ufficio',
        stalloId: dip.stalloId || pool[n % pool.length],
        stato: 'completata',
        checkIn: minutesToHHMM(rInt(7 * 60 + 40, 9 * 60 + 30)),
        checkOut: minutesToHHMM(rInt(13 * 60, 18 * 60)),
        creataDa: 'dipendente',
        turnoId: null              // null = prenotazione giornaliera
      });
    }
    const swQuanti = Math.round(conf.sw * (0.8 + (idx % 4) * 0.1));
    for (let n = 0; n < swQuanti && n < ordinati.length; n++) {
      const dip = ordinati[ordinati.length - 1 - n];
      out.push({
        id: nextId('PRE'), dipendenteId: dip.id, data: iso, tipo: 'sw',
        stalloId: null, stato: 'completata', checkIn: null, checkOut: null,
        creataDa: 'dipendente',
        turnoId: null
      });
    }
  });

  GIORNI_SET.forEach((giorno, gi) => {
    const iso = toISO(giorno);
    const conf = PRENOTAZIONI_GIORNO[gi];
    /* rotazione deterministica: ogni giorno parte da un offset diverso, così
       nessuno risulta prenotato tutti i giorni per costruzione */
    const ordinati = attivi.slice(gi * 11).concat(attivi.slice(0, gi * 11));
    const occupati = new Set();     // stalli tenuti da prenotazioni ATTIVE del giorno

    /** assegna uno stallo libero e compatibile, preferendo quello fisso */
    const assegna = (dip, tieni) => {
      if (dip.stalloId && !occupati.has(dip.stalloId) && byCode.has(dip.stalloId)) {
        if (tieni) occupati.add(dip.stalloId);
        return dip.stalloId;
      }
      for (const c of pool) {
        if (occupati.has(c) || !compatibile(c, dip)) continue;
        if (tieni) occupati.add(c);
        return c;
      }
      return null;
    };

    const push = (dip, tipo, stato) => {
      /* le prenotazioni "completate" non tengono più lo stallo: il dipendente
         è già uscito, quindi il posto può essere riusato nella stessa giornata */
      const stalloId = tipo === 'ufficio' ? assegna(dip, stato === 'attiva') : null;
      if (tipo === 'ufficio' && !stalloId) return false;
      out.push({
        id: nextId('PRE'),
        dipendenteId: dip.id,
        data: iso,
        tipo,                                  // 'ufficio' | 'sw'
        stalloId,
        stato,                                 // 'attiva' | 'completata' | 'annullata'
        checkIn:  stato !== 'attiva' ? minutesToHHMM(rInt(7 * 60 + 40, 9 * 60 + 30)) : null,
        checkOut: stato === 'completata' ? minutesToHHMM(rInt(13 * 60, 17 * 60)) : null,
        creataDa: 'dipendente',
        turnoId: null
      });
      return true;
    };

    let i = 0;
    for (let n = 0; n < conf.ufficioAttive     && i < ordinati.length; i++) { if (push(ordinati[i], 'ufficio', 'attiva'))     n++; }
    for (let n = 0; n < conf.ufficioCompletate && i < ordinati.length; i++) { if (push(ordinati[i], 'ufficio', 'completata')) n++; }
    for (let n = 0; n < conf.sw                && i < ordinati.length; i++) { if (push(ordinati[i], 'sw', 'attiva'))          n++; }
  });

  return out;
}

/* Forza i pattern dei dipendenti in evidenza: sono le righe che il FM vede
   nella vista settimanale e devono raccontare una storia leggibile. */
const PATTERN_EVIDENZA = {
  'Matteo Bruni':   ['ufficio', 'ufficio', 'ufficio', 'ufficio', null],
  'Laura Conti':    ['ufficio', 'sw', 'ufficio', 'sw', 'ufficio'],
  'Sara Bellotti':  ['ufficio', 'ufficio', 'ufficio', 'sw', null],
  'Davide Neri':    ['ufficio', 'ufficio', 'sw', 'ufficio', 'ufficio'],
  'Elena Ricci':    ['ufficio', 'ufficio', 'ufficio', null, 'sw'],
  'Giulia Moretti': ['sw', 'ufficio', 'ufficio', 'ufficio', null],
  'Luca Gatti':     ['ufficio', 'sw', 'ufficio', 'ufficio', 'sw'],
  'Chiara Riva':    ['ufficio', 'ufficio', null, 'ufficio', 'ufficio'],
  'Stefano Longo':  ['sw', 'ufficio', 'ufficio', 'sw', 'ufficio'],
  'Martina Serra':  ['ufficio', 'ufficio', 'ufficio', 'ufficio', 'ufficio']
};

function applicaPatternEvidenza(prenotazioni, dipendenti, stalli) {
  const byNome = new Map(dipendenti.map(d => [d.nomeCompleto, d]));

  Object.entries(PATTERN_EVIDENZA).forEach(([nome, pattern]) => {
    const dip = byNome.get(nome);
    if (!dip) return;
    GIORNI_SET.forEach((giorno, gi) => {
      const iso = toISO(giorno);
      /* rimuove la prenotazione generata, liberando il relativo stallo */
      const idx = prenotazioni.findIndex(p => p.dipendenteId === dip.id && p.data === iso);
      if (idx >= 0) prenotazioni.splice(idx, 1);

      const tipo = pattern[gi];
      if (!tipo) return;

      let stalloId = null;
      if (tipo === 'ufficio') {
        const occupati = new Set(prenotazioni.filter(p => p.data === iso && p.stato === 'attiva' && p.stalloId).map(p => p.stalloId));
        if (dip.stalloId && !occupati.has(dip.stalloId)) {
          stalloId = dip.stalloId;
        } else {
          const libero = stalli.find(s =>
            !occupati.has(s.codice) && s.tipo !== 'manutenzione' && s.tipo !== 'visitatori' &&
            !STALLI_RISERVATI_DEMO.includes(s.codice) &&
            (s.tipo === 'ev' ? dip.caratteristica === 'ev' : s.tipo === 'disabili' ? dip.caratteristica === 'disabili' : dip.caratteristica === 'standard'));
          stalloId = libero ? libero.codice : null;
        }
        if (!stalloId) return;             // nessuno stallo: niente prenotazione fantasma
      }

      prenotazioni.push({
        id: nextId('PRE'),
        dipendenteId: dip.id,
        data: iso,
        tipo,
        stalloId,
        stato: 'attiva',
        checkIn: null, checkOut: null,
        creataDa: 'dipendente',
        turnoId: null
      });
    });
  });
}

/* --- 2.4 Visitatori di oggi ----------------------------------------------
   14 pass previsti · 11 check-in · 7 dentro ora · 2 pass scaduti          */
const VISITATORI_SEED = [
  { nome: 'Marta Vezzoli',   azienda: 'Delta Consulting', stallo: 'V-04', da: '09:00', a: '18:00', stato: 'dentro' },
  { nome: 'Roberto Brunetti',azienda: 'Nord Servizi',     stallo: 'V-06', da: '10:00', a: '13:00', stato: 'dentro', zonaErrata: true },
  { nome: 'Alice Trentini',  azienda: 'Acme Italia',      stallo: 'V-02', da: '14:00', a: '17:00', stato: 'atteso' },
  { nome: 'Giorgio Pavan',   azienda: 'Sisma Group',      stallo: 'V-01', da: '08:30', a: '12:30', stato: 'uscito' },
  { nome: 'Ilaria Bonetti',  azienda: 'Delta Consulting', stallo: 'V-03', da: '09:00', a: '11:00', stato: 'uscito' },
  { nome: 'Nicola Perego',   azienda: 'Rea Engineering',  stallo: 'V-05', da: '09:30', a: '18:00', stato: 'dentro' },
  { nome: 'Serena Lodi',     azienda: 'Acme Italia',      stallo: 'V-07', da: '10:00', a: '16:00', stato: 'dentro' },
  { nome: 'Fabrizio Amato',  azienda: 'Kore Partners',    stallo: 'V-08', da: '10:15', a: '14:00', stato: 'dentro', scaduto: true },
  { nome: 'Rita Zanella',    azienda: 'Nord Servizi',     stallo: 'V-09', da: '08:45', a: '12:00', stato: 'uscito' },
  { nome: 'Dario Fusco',     azienda: 'Sisma Group',      stallo: 'V-10', da: '11:00', a: '18:00', stato: 'dentro' },
  { nome: 'Chiara Bosco',    azienda: 'Rea Engineering',  stallo: 'V-11', da: '09:20', a: '13:00', stato: 'dentro', scaduto: true },
  { nome: 'Enrico Salvi',    azienda: 'Kore Partners',    stallo: 'V-12', da: '08:00', a: '11:30', stato: 'uscito' },
  { nome: 'Laura Piccoli',   azienda: 'Acme Italia',      stallo: 'V-13', da: '15:00', a: '18:00', stato: 'atteso' },
  { nome: 'Sandro Vitale',   azienda: 'Delta Consulting', stallo: 'V-14', da: '16:00', a: '19:00', stato: 'atteso' }
];

function buildVisitatori(dipendenti) {
  const fmId = 'USR-0002';
  const out = VISITATORI_SEED.map((v, i) => ({
    id: nextId('VIS'),
    passId: 'VIS-' + String(41 + i).padStart(4, '0'),
    nome: v.nome,
    azienda: v.azienda,
    email: slug(v.nome.split(' ')[0])[0] + '.' + slug(v.nome.split(' ')[1]) + '@' + slug(v.azienda) + '.it',
    stalloId: v.stallo,
    data: OGGI_ISO,
    oraInizio: v.da,
    oraFine: v.a,
    stato: v.stato,                     // atteso | dentro | uscito | revocato
    zonaErrata: !!v.zonaErrata,
    scaduto: !!v.scaduto,
    codiceMy2N: String(rInt(1000, 9999)),
    referenteId: i % 3 === 0 ? fmId : (dipendenti[(i % 12)] || dipendenti[0]).id,
    creatoIl: OGGI_ISO
  }));

  /* storico visitatori sui giorni gia' trascorsi: tutti usciti */
  GIORNI_TRASCORSI.forEach((giorno, gi) => {
    const isoG = toISO(giorno);
    const quanti = 8 + (gi % 6);
    for (let i = 0; i < quanti; i++) {
      const base = VISITATORI_SEED[(gi + i) % VISITATORI_SEED.length];
      out.push({
        id: nextId('VIS'),
        passId: 'VIS-' + String(1000 + gi * 20 + i).padStart(4, '0'),
        nome: base.nome, azienda: base.azienda,
        email: 'storico' + gi + i + '@' + slug(base.azienda) + '.it',
        stalloId: 'V-' + String((i % 16) + 1).padStart(2, '0'),
        data: isoG, oraInizio: base.da, oraFine: base.a,
        stato: 'uscito', zonaErrata: false, scaduto: false,
        codiceMy2N: String(rInt(1000, 9999)),
        referenteId: fmId, creatoIl: isoG
      });
    }
  });
  return out;
}

/* --- 2.5 Accessi di oggi --------------------------------------------------
   Derivati dalle prenotazioni: ogni prenotazione attiva/completata di oggi
   genera il relativo record di accesso. Così i KPI Accessi e i KPI Mappa
   raccontano gli stessi numeri.                                           */
function buildAccessi(prenotazioni, dipendenti, visitatori) {
  const out = [];
  const byId = new Map(dipendenti.map(d => [d.id, d]));

  prenotazioni.filter(p => p.data === OGGI_ISO && p.tipo === 'ufficio').forEach(p => {
    const dip = byId.get(p.dipendenteId);
    if (!dip) return;
    /* Sara Bellotti ha trovato lo stallo occupato: non ha un accesso valido */
    if (dip.nomeCompleto === 'Sara Bellotti') return;   // stallo occupato: nessun accesso valido
    const dentro = p.stato === 'attiva';
    out.push({
      id: nextId('ACC'),
      data: OGGI_ISO,
      tipo: 'dipendente',
      personaId: dip.id,
      personaNome: dip.nomeCompleto,
      stalloId: p.stalloId,
      ingresso: p.checkIn || minutesToHHMM(rInt(7 * 60 + 40, 10 * 60 + 20)),
      uscita: dentro ? null : (p.checkOut || minutesToHHMM(rInt(13 * 60, 17 * 60))),
      /* zona B passa dal cancello 2N (PIN); altrove app o QR alternati */
      metodo: !dip.appAttiva ? 'badge2n'
            : (p.stalloId && p.stalloId.startsWith('B')) ? 'pin'
            : (out.length % 2 === 0 ? 'app' : 'qr'),
      stato: dentro ? 'dentro' : 'uscito',
      anomalia: null,
      targa: null,
      prenotazioneId: p.id
    });
  });

  visitatori.filter(v => v.stato === 'dentro' || v.stato === 'uscito').forEach(v => {
    out.push({
      id: nextId('ACC'),
      data: v.data,        /* NON OGGI_ISO: i visitatori storici hanno la loro data */
      tipo: 'visitatore',
      personaId: v.id,
      personaNome: v.nome,
      stalloId: v.stalloId,
      ingresso: v.oraInizio,
      uscita: v.stato === 'uscito' ? v.oraFine : null,
      metodo: 'pin',        /* il codice My2N del pass e' un PIN sul tastierino */
      stato: v.stato === 'uscito' ? 'uscito' : 'dentro',
      anomalia: v.zonaErrata ? 'zona' : null,
      targa: null,
      prenotazioneId: null
    });
  });

  /* Anomalia 1 — veicolo non autorizzato su B-42 (stallo prenotato da Sara) */
  out.push({
    id: nextId('ACC'), data: OGGI_ISO, tipo: 'anomalia',
    personaId: null, personaNome: 'Veicolo N/D',
    stalloId: 'B-42', ingresso: '09:55', uscita: null,
    metodo: 'nd', stato: 'abusivo', anomalia: 'abusivo', targa: 'DF 891 KL',
    prenotazioneId: null
  });

  /* Anomalia 2 — sosta prolungata su A-31 (oltre policy) */
  const overstay = new Date(Date.now() - (9 * 60 + 42) * 60000);
  out.push({
    id: nextId('ACC'), data: OGGI_ISO, tipo: 'dipendente',
    personaId: null, personaNome: 'Veicolo EK 447 MN',
    stalloId: 'A-31', ingresso: hhmm(overstay), uscita: null,
    metodo: 'badge2n', stato: 'dentro', anomalia: 'durata', targa: 'EK 447 MN',
    ingressoTs: overstay.getTime(),
    prenotazioneId: null
  });

  /* Storico: i giorni feriali gia' trascorsi del mese. Senza questi, il
     selettore di periodo mostrerebbe sempre e solo i numeri di oggi. Sono
     tutti accessi CHIUSI: non occupano stalli, non pesano su "presenti ora". */
  GIORNI_TRASCORSI.forEach((giorno, gi) => {
    const isoG = toISO(giorno);
    const prenDelGiorno = prenotazioni.filter(p => p.data === isoG && p.tipo === 'ufficio');
    prenDelGiorno.forEach((p, i) => {
      const dip = byId.get(p.dipendenteId);
      if (!dip) return;
      out.push({
        id: nextId('ACC'), data: isoG, tipo: 'dipendente',
        personaId: dip.id, personaNome: dip.nomeCompleto, stalloId: p.stalloId,
        ingresso: p.checkIn || minutesToHHMM(rInt(7 * 60 + 40, 9 * 60 + 30)),
        uscita:   p.checkOut || minutesToHHMM(rInt(13 * 60, 18 * 60)),
        metodo: (p.stalloId && p.stalloId.startsWith('B')) ? 'pin' : (i % 2 === 0 ? 'app' : 'qr'),
        stato: 'uscito', anomalia: null, targa: null, prenotazioneId: p.id
      });
    });
    /* una manciata di anomalie storiche, per dare senso al filtro nel periodo */
    if (gi % 3 === 0) {
      out.push({
        id: nextId('ACC'), data: isoG, tipo: 'anomalia',
        personaId: null, personaNome: 'Veicolo N/D', stalloId: 'B-' + String(30 + (gi % 9)).padStart(2, '0'),
        ingresso: minutesToHHMM(rInt(8 * 60, 11 * 60)), uscita: minutesToHHMM(rInt(12 * 60, 17 * 60)),
        metodo: 'nd', stato: 'uscito', anomalia: 'abusivo',
        targa: 'AB ' + (100 + gi) + ' CD', prenotazioneId: null
      });
    }
  });

  /* ordina: i più recenti in cima, anomalie sempre visibili */
  return out.sort((a, b) => (b.data.localeCompare(a.data)) || (b.ingresso || '').localeCompare(a.ingresso || ''));
}

/* --- 2.6 Segnalazioni -----------------------------------------------------
   3 aperte + 1 in gestione + 18 risolte nel mese (KPI derivati).          */
function buildSegnalazioni(dipendenti) {
  const byNome = (n) => dipendenti.find(d => d.nomeCompleto === n);
  const now = Date.now();
  const out = [
    {
      id: nextId('SEG'), tipo: 'abusivo', gravita: 'urgente', stato: 'aperta',
      stalloId: 'B-42', segnalanteId: byNome('Sara Bellotti')?.id, targa: 'DF 891 KL',
      titolo: 'B-42 — Stallo occupato abusivamente',
      descrizione: 'Stallo prenotato dalle 08:00 occupato da veicolo non autorizzato.',
      apertaIlTs: now - 47 * 60000, aggiornataIlTs: now - 47 * 60000, risoltaIlTs: null,
      policyOre: null, azione: null, note: []
    },
    {
      id: nextId('SEG'), tipo: 'durata', gravita: 'media', stato: 'in_gestione',
      stalloId: 'A-31', segnalanteId: null, targa: 'EK 447 MN',
      titolo: 'A-31 — Durata massima superata',
      descrizione: 'Sosta oltre la policy di 8 ore. Prima notifica già inviata al veicolo.',
      apertaIlTs: now - 102 * 60000, aggiornataIlTs: now - 34 * 60000, risoltaIlTs: null,
      policyOre: 8, azione: 'notifica_inviata', note: ['Notifica automatica inviata alle ' + hhmm(new Date(now - 34 * 60000))]
    },
    {
      id: nextId('SEG'), tipo: 'zona', gravita: 'media', stato: 'aperta',
      stalloId: 'V-06', segnalanteId: null, targa: null,
      titolo: 'V-06 — Visitatore in zona non autorizzata',
      descrizione: 'Pass VIS-0042 valido per Zona V ma rilevato accesso fuori fascia oraria.',
      apertaIlTs: now - 26 * 60000, aggiornataIlTs: now - 26 * 60000, risoltaIlTs: null,
      policyOre: null, azione: null, note: []
    },
    {
      id: nextId('SEG'), tipo: 'ev', gravita: 'media', stato: 'aperta',
      stalloId: 'EV-03', segnalanteId: byNome('Elena Ricci')?.id, targa: null,
      titolo: 'EV-03 — Colonnina non funzionante',
      descrizione: 'Colonnina di ricarica non eroga. Segnalato dal dipendente via app.',
      apertaIlTs: now - 3 * 3600000, aggiornataIlTs: now - 3 * 3600000, risoltaIlTs: null,
      policyOre: null, azione: null, note: []
    }
  ];

  /* 18 risolte DENTRO il mese corrente → KPI "Risolte (mese)" sempre = 18 */
  const tipiStorico = ['abusivo', 'durata', 'zona', 'guasto', 'ev'];
  const giorniDelMese = Math.max(1, OGGI.getDate() - 1);
  for (let i = 0; i < 18; i++) {
    const giorniFa = giorniDelMese > 1 ? rInt(1, giorniDelMese) : 0;
    const ts = now - giorniFa * 86400000 - rInt(1, 6) * 3600000;
    const tipo = tipiStorico[i % tipiStorico.length];
    out.push({
      id: nextId('SEG'), tipo, gravita: 'bassa', stato: 'risolta',
      stalloId: rPick(['A', 'B', 'C'])[0] + '-' + String(rInt(1, 30)).padStart(2, '0'),
      segnalanteId: null, targa: null,
      titolo: TIPO_SEGNALAZIONE[tipo].label,
      descrizione: 'Segnalazione chiusa dal Facility Manager.',
      apertaIlTs: ts, aggiornataIlTs: ts + 3600000, risoltaIlTs: ts + 3600000,
      policyOre: null, azione: 'risolta', note: []
    });
  }
  return out;
}

/* --- 2.7 Hardware 2N ------------------------------------------------------ */
function buildHardware() {
  const ev = (min) => hhmm(new Date(Date.now() - min * 60000));
  return [
    { id: nextId('HW'), nome: 'Cancello 2N',       tipo: 'tastierino2n', ruolo: 'principale',
      cicli: 286, stato: 'online', ip: '192.168.1.40', firmware: 'v5.3.2',
      ultimoEvento: 'Ultimo ciclo ' + ev(4), messaggio: null },

    { id: nextId('HW'), nome: 'Lettore QR Code',   tipo: 'qrreader', ruolo: 'ausiliario',
      cicli: 143, stato: 'online', ip: '192.168.1.41', firmware: 'v1.4.0',
      ultimoEvento: 'Ultima scansione ' + ev(7), messaggio: null },

    { id: nextId('HW'), nome: 'Sbarra automatica', tipo: 'sbarra', ruolo: 'ausiliario',
      cicli: 118, stato: 'online', ip: '192.168.1.42', firmware: 'v2.1.0',
      ultimoEvento: 'Ultimo ciclo ' + ev(11), messaggio: null },

    { id: nextId('HW'), nome: 'Sistema Bluetooth', tipo: 'bluetooth', ruolo: 'ausiliario',
      cicli: 0, stato: 'in_configurazione', ip: null, firmware: 'v0.9.1-beta',
      ultimoEvento: 'Integrazione 1Control in corso', messaggio: 'Integrazione One Control in fase di test.' },

    { id: nextId('HW'), nome: 'Telecamera ANPR',   tipo: 'anpr', ruolo: 'ausiliario',
      cicli: 0, stato: 'in_configurazione', ip: null, firmware: 'v0.8.0-beta',
      ultimoEvento: 'Integrazione Infoproget in corso', messaggio: 'Riconoscimento targhe in fase di attivazione.' },

    { id: nextId('HW'), nome: 'Pilomat #1',        tipo: 'pilomat', ruolo: 'ausiliario',
      cicli: 12, stato: 'anomalia', ip: '192.168.1.45', firmware: 'v3.2.1',
      ultimoEvento: 'Sensor timeout 09:47', messaggio: 'Sensor timeout · verificare alimentazione.' }
  ];
}

/* --- 2.8 Config ----------------------------------------------------------- */
function buildConfig() {
  return {
    sede: {
      id: 'SEDE-DEMO',
      nome: SEDE.nome,
      indirizzo: 'Via della Dimostrazione 1 · 00100 Città Demo',
      nomeBreve: SEDE.nomeBreve,
      descrizione: SEDE.descrizione,
      dominioEmail: SEDE.dominioEmail,
      helpdesk: SEDE.helpdesk
    },
    /* Modalita' di prenotazione. 'giornaliera' e' il comportamento storico e
       resta il default: la modalita' 'turni' e' dichiarata qui ma NON e'
       ancora attiva (CODE-17A e' sola infrastruttura). */
    modalitaPrenotazione: 'giornaliera',   // 'giornaliera' | 'turni'
    turni: [
      { id: 'mattino',    label: 'Mattino',    inizio: '07:00', fine: '15:00' },
      { id: 'pomeriggio', label: 'Pomeriggio', inizio: '15:00', fine: '23:00' },
      { id: 'notte',      label: 'Notte',      inizio: '23:00', fine: '07:00' }
    ],
    tolleranzaCambioTurnoMin: 30,
    prenotazioni: {
      finestraGiorniLavorativi: 10, // finestra prenotazione dipendente, in giorni lavorativi (oggi incluso)
      noShowMinuti: 30,
      durataMaxDipendenteOre: 10,
      notificaDurataOre: 8,
      durataMaxEvOre: 4,
      bloccoDopoViolazioni: true,
      sogliaViolazioni: 3,
      smartWorkingAbilitato: true,
      swPreavvisoOre: 12
    },
    notifiche: {
      peerToPeer: true,
      anomaliaHardware: true,
      sostaProlungata: true,
      reportSettimanale: true,
      emailDestinatari: ['facility.manager@parkingcloud.eu']
    },
    hardware2n: {
      codiceTemporaneoVisitatori: true,
      logAccessiCloud: true,
      integrazioneHr: 'in_valutazione'   // SSO / HR feed
    },
    /* referenti interni non-piattaforma (sola lettura in Config) */
    referentiInterni: [
      { id: 'REF-001', nome: 'Elena Nardi', ruolo: 'HR · Viewer', badge: 'Viewer', email: 'elena.nardi@' + SEDE.dominioEmail }
    ],
    periodo: { tipo: 'oggi', dal: OGGI_ISO, al: OGGI_ISO, label: 'Oggi' },
    export: { destinatario: 'facility.manager@' + SEDE.dominioEmail }
  };
}

/* Righe usate dall'import simulato da CSV/Excel */
const IMPORT_DEMO = [
  { nome: 'Giorgio', cognome: 'Fabbri',  email: 'g.fabbri@aziendademo.it',  dipartimento: 'Operations' },
  { nome: 'Nadia',   cognome: 'Costa',   email: 'n.costa@aziendademo.it',   dipartimento: 'Marketing' },
  { nome: 'Simone',  cognome: 'Rovelli', email: 's.rovelli@aziendademo.it', dipartimento: 'IT' }
];

/* --- 2.8bis Utenti di piattaforma (Admin e FM) ----------------------------
   NON sono dipendenti: i dipendenti sono utenti del parcheggio e vivono
   nella sezione Dipendenti. Questi si gestiscono in Amministrazione.     */
function buildUtentiPiattaforma() {
  /* gli id passano da nextId() anche nel seed: altrimenti il contatore
     ripartirebbe da USR-0001 e il primo utente creato dall'Admin
     collidebbe con l'Admin stesso. */
  const idAdmin = nextId('USR');   // USR-0001
  const idFm    = nextId('USR');   // USR-0002
  return [
    {
      id: idAdmin, nome: 'Alex', cognome: 'Martini', nomeCompleto: 'Alex Martini',
      iniziali: 'AM', email: 'admin@parkingcloud.eu', ruolo: 'admin',
      sedeId: null, statoAccount: 'attivo',
      ultimoAccesso: OGGI_ISO, invitatoDa: null
    },
    {
      id: idFm, nome: 'Marco', cognome: 'Bianchi', nomeCompleto: 'Marco Bianchi',
      iniziali: 'MB', email: 'manager@demo.parkingcloud.eu', ruolo: 'fm',
      sedeId: 'SEDE-DEMO', statoAccount: 'attivo',
      ultimoAccesso: toISO(addDays(OGGI, -1)), invitatoDa: idAdmin
    }
  ];
}

/* --- 2.9 Richieste pass in attesa ----------------------------------------- */
function buildRichiestePass(dipendenti) {
  const richiedente = dipendenti.find(d => d.nomeCompleto === 'Laura Conti');
  return [{
    id: nextId('REQ'),
    dipendenteId: richiedente ? richiedente.id : dipendenti[1].id,
    visitatoreNome: 'Andrea Bianchi',
    visitatoreEmail: 'a.bianchi@korepartners.it',
    azienda: 'Kore Partners',
    dataInizio: toISO(addDays(OGGI, 2)),
    dataFine:   toISO(addDays(OGGI, 2)),
    stato: 'in_attesa',
    note: '',
    codiceMy2N: null,
    esitoIlTs: null,
    letta: true
  }];
}

/* ==========================================================================
   3. APPSTATE
========================================================================== */

/** Costruisce l'intero set di dati demo dal seed.
    L'ORDINE delle chiamate e' significativo: i contatori nextId() assegnano
    DIP/PRE/VIS/ACC/SEG/HW/REQ/USR in sequenza, quindi cambiarlo cambierebbe
    gli id. Va tenuto identico a quello originale, altrimenti il ripristino
    non produce lo stesso stato di partenza. */
function costruisciDati() {
  resetGeneratori();
  const zone         = ZONE_SEED.map(z => Object.assign({}, z));
  const stalli       = buildStalli(zone);
  const dipendenti   = buildDipendenti(stalli);
  const prenotazioni = buildPrenotazioni(dipendenti, stalli);
  applicaPatternEvidenza(prenotazioni, dipendenti, stalli);
  const visitatori   = buildVisitatori(dipendenti);
  const accessi      = buildAccessi(prenotazioni, dipendenti, visitatori);
  const segnalazioni = buildSegnalazioni(dipendenti);
  return {
    zone, stalli, dipendenti, prenotazioni, visitatori, segnalazioni, accessi,
    hardware: buildHardware(),
    richiestePass: buildRichiestePass(dipendenti),
    config: buildConfig(),
    utentiPiattaforma: buildUtentiPiattaforma(),
    dipendenteDemoId: dipendenti.find(d => d.utenteDemo).id
  };
}

const DATI = costruisciDati();

const AppState = {
  /* --- dati --- */
  zone:              DATI.zone,
  stalli:            DATI.stalli,
  dipendenti:        DATI.dipendenti,
  prenotazioni:      DATI.prenotazioni,
  visitatori:        DATI.visitatori,
  segnalazioni:      DATI.segnalazioni,
  accessi:           DATI.accessi,
  hardware:          DATI.hardware,
  richiestePass:     DATI.richiestePass,
  config:            DATI.config,

  /* --- identità --- */
  utentiPiattaforma: DATI.utentiPiattaforma,
  utenti: {
    dipendenteDemoId: DATI.dipendenteDemoId
  },

  /* --- stato UI (anch'esso centralizzato: filtri e navigazione sono dato) --- */
  ui: {
    ruolo: null,                 // 'admin' | 'fm' | 'dipendente'
    utenteCorrenteId: null,      // id in utentiPiattaforma oppure in dipendenti
    vista: 'login',              // 'login' | 'attiva' | 'fm' | 'dipendente'
    sezione: 'dashboard',
    adminTab: 'utenti',          // 'utenti' | 'parcheggi'
    configTab: 'parcheggio',     // 'parcheggio' | 'policy' | 'notifiche' | 'utenti'
    analyticsPeriodo: 'settimana',  // 'settimana' | 'mese'
    editSede: false,
    attivazione: null,           // { utenteId, tipo, invitatoDa } per view-activate
    fmWeekOffset: 0,
    empWeekOffset: 0,
    empRichiesteTab: 'pass',   // 'pass' | 'segnalazioni'
    filtri: {
      accessi:    { q: '', tipo: '', stato: '', stallo: '', anomalia: false, aperto: false },
      dipendenti: { q: '' }
    },
    selezione: {                 // "cosa ho cliccato": alimenta i modali dinamici
      stalloId: null, dipendenteId: null, accessoId: null, visitatoreId: null,
      segnalazioneId: null, hardwareId: null, richiestaId: null, giornoISO: null,
      empTipoGiorno: 'ufficio'
    },
    mapSelection: [],            // Ctrl+Click multiselezione
    toast: null
  }
};

/* ==========================================================================
   4. SELECTORS — tutto ciò che è derivato
========================================================================== */

const S = {

  /* ---- lookup ---- */
  stallo:      (id) => AppState.stalli.find(s => s.id === id) || null,
  dipendente:  (id) => AppState.dipendenti.find(d => d.id === id) || null,
  visitatore:  (id) => AppState.visitatori.find(v => v.id === id) || null,
  accesso:     (id) => AppState.accessi.find(a => a.id === id) || null,
  segnalazione:(id) => AppState.segnalazioni.find(s => s.id === id) || null,
  dispositivo: (id) => AppState.hardware.find(h => h.id === id) || null,
  zona:        (id) => AppState.zone.find(z => z.id === id) || null,
  utenteDemo:  ()   => S.dipendente(AppState.utenti.dipendenteDemoId),
  utentePiattaforma: (id) => AppState.utentiPiattaforma.find(u => u.id === id) || null,

  /** Il dipendente della SESSIONE corrente.
      Restituisce null se chi e' loggato non e' un dipendente (Admin/FM) o se
      l'utente non esiste: la vista deve gestire il caso, non assumerlo.
      NB: utenteDemo() e' un'altra cosa — e' il dipendente del seed, e va usato
      solo dove serve proprio quello (dati demo), mai per rappresentare
      l'utente autenticato. */
  dipendenteCorrente() {
    const u = S.utenteCorrente();
    return (u && S.dipendente(u.id)) ? u : null;
  },
  nomePersona: (id) => {
    const d = S.dipendente(id);
    if (d) return d.nomeCompleto;
    const u = S.utentePiattaforma(id);
    if (u) return u.nomeCompleto;
    if (id === 'FM') { const fm = S.facilityManager(); return fm ? fm.nomeCompleto : 'Facility Manager'; }
    return '—';
  },

  /* ---- RUOLI E PERMESSI ---- */
  /** l'utente loggato: può essere di piattaforma (admin/fm) o un dipendente */
  utenteCorrente() {
    const id = AppState.ui.utenteCorrenteId;
    return S.utentePiattaforma(id) || S.dipendente(id) || null;
  },
  ruoloCorrente() { return AppState.ui.ruolo; },
  permessi(ruolo)  { return PERMISSIONS[ruolo || AppState.ui.ruolo] || {}; },
  /** puo('amministrazione') → true/false per il ruolo corrente */
  puo(chiave, ruolo) { return !!S.permessi(ruolo)[chiave]; },
  etichettaRuolo(ruolo) { return (RUOLI[ruolo] || {}).label || '—'; },

  /** il primo FM attivo — usato come referente di default per i pass */
  facilityManager() {
    return AppState.utentiPiattaforma.find(u => u.ruolo === 'fm' && u.statoAccount === 'attivo')
        || AppState.utentiPiattaforma.find(u => u.ruolo === 'fm') || null;
  },

  /** risoluzione dell'account dall'email: è così che il login determina il ruolo */
  trovaAccountPerEmail(email) {
    const e = (email || '').trim().toLowerCase();
    if (!e) return null;
    const u = AppState.utentiPiattaforma.find(x => x.email.toLowerCase() === e);
    if (u) return { tipo: 'piattaforma', ruolo: u.ruolo, utente: u };
    const d = AppState.dipendenti.find(x => x.email.toLowerCase() === e);
    if (d) return { tipo: 'dipendente', ruolo: 'dipendente', utente: d };
    return null;
  },

  /* ---- STATO STALLO: il cuore della coerenza inter-sezione ----
     Restituisce { stato, cls, label, occupanteNome, prenotazioneId, accessoId } */
  /** Punto d'innesto della modalita' a turni dentro statoStallo().
      In 'giornaliera' accetta ogni prenotazione: comportamento storico.
      In 'turni' oggi accetta ANCORA tutto — e' uno STUB voluto: CODE-17A e'
      sola infrastruttura. Il filtro reale (p.turnoId === turno attivo) arriva
      con CODE-17B, insieme alla UI che permette di scegliere un turno.
      Attivarlo prima farebbe sparire dalla mappa tutte le prenotazioni
      esistenti, che hanno turnoId === null. */
  turnoCompatibile(prenotazione) {
    if (AppState.config.modalitaPrenotazione !== 'turni') return true;
    return true;   // STUB CODE-17A — non filtrare finche' la UI non esiste
  },

  statoStallo(stalloId, dataISO) {
    const st = S.stallo(stalloId);
    if (!st) return { stato: 'libero', cls: 'ms-free', label: 'Libero' };
    const data = dataISO || OGGI_ISO;
    const oggi = data === OGGI_ISO;

    if (st.tipo === 'manutenzione')        return { ...STATO_STALLO.manutenzione, stato: 'manutenzione', stalloId };
    if (st.disponibilita === 'bloccato')   return { ...STATO_STALLO.bloccato,     stato: 'bloccato',     stalloId };

    /* 1. accesso in corso (solo per oggi) */
    if (oggi) {
      const acc = AppState.accessi.find(a => a.stalloId === stalloId && a.uscita === null && a.data === data);
      if (acc) {
        const abusivo = acc.stato === 'abusivo';
        return {
          stato: abusivo ? 'violazione' : (acc.tipo === 'visitatore' ? 'visitatore' : 'occupato'),
          cls: abusivo ? 'ms-viol' : 'ms-occ',
          label: abusivo ? 'Occupazione abusiva' : 'Occupato',
          occupanteNome: acc.personaNome, accessoId: acc.id, stalloId
        };
      }
      /* visitatore atteso su stallo di zona V */
      /* Il pass puo' coprire piu' giorni: `data` e' l'inizio, `dataFine` la
         fine (assente sui pass di un solo giorno). Confrontare solo `v.data`
         lascerebbe lo stallo libero dal secondo giorno in poi. */
      const vis = AppState.visitatori.find(v => v.stalloId === stalloId && v.stato === 'atteso'
        && v.data <= data && (v.dataFine || v.data) >= data);
      if (vis) return { stato: 'prenotato', cls: 'ms-occ', label: 'Riservato — visitatore atteso', occupanteNome: vis.nome, visitatoreId: vis.id, stalloId };
    }

    /* 2. prenotazione attiva del giorno */
    const pre = AppState.prenotazioni.find(p => p.stalloId === stalloId && p.data === data
      && p.tipo === 'ufficio' && p.stato === 'attiva' && S.turnoCompatibile(p));
    if (pre) {
      const dip = S.dipendente(pre.dipendenteId);
      return { stato: 'prenotato', cls: 'ms-occ', label: 'Prenotato', occupanteNome: dip ? dip.nomeCompleto : '—', prenotazioneId: pre.id, dipendenteId: pre.dipendenteId, stalloId };
    }

    /* 3. libero — il colore riflette la caratteristica dello stallo */
    const clsLibero = st.tipo === 'ev' ? 'ms-ev' : st.tipo === 'disabili' ? 'ms-dis' : st.tipo === 'visitatori' ? 'ms-book' : 'ms-free';
    return { stato: 'libero', cls: clsLibero, label: 'Libero', stalloId };
  },

  /** true se lo stallo è prenotabile da quel dipendente in quella data */
  stalloPrenotabile(stalloId, dataISO, dipendenteId) {
    const st = S.stallo(stalloId);
    if (!st) return false;
    if (S.statoStallo(stalloId, dataISO).stato !== 'libero') return false;
    if (st.tipo === 'visitatori' || st.tipo === 'manutenzione') return false;
    if (st.disponibilita === 'bloccato') return false;
    const dip = S.dipendente(dipendenteId);
    if (st.tipo === 'ev'       && (!dip || dip.caratteristica !== 'ev'))       return false;
    if (st.tipo === 'disabili' && (!dip || dip.caratteristica !== 'disabili')) return false;
    return true;
  },

  /** Stallo assegnato automaticamente + PERCHE (RF09).
      Priorita: 1) stallo fisso  2) caratteristica  3) stesso piano  4) primo libero */
  assegnaStalloConMotivo(dipendenteId, dataISO) {
    const dip = S.dipendente(dipendenteId);
    if (dip && dip.stalloId && S.stalloPrenotabile(dip.stalloId, dataISO, dipendenteId)) {
      return { stalloId: dip.stalloId, motivo: 'fisso' };
    }
    const candidati = AppState.stalli.filter(s => S.stalloPrenotabile(s.id, dataISO, dipendenteId));
    const preferenza = dip && dip.caratteristica !== 'standard' ? dip.caratteristica : null;
    if (preferenza) {
      const m = candidati.find(s => s.tipo === preferenza);
      if (m) return { stalloId: m.id, motivo: 'caratteristica' };
    }
    const pianoDip = dip && dip.stalloId ? (S.stallo(dip.stalloId) || {}).piano : null;
    const stessoPiano = pianoDip ? candidati.find(s => s.piano === pianoDip) : null;
    if (stessoPiano) return { stalloId: stessoPiano.id, motivo: 'piano' };
    return candidati[0] ? { stalloId: candidati[0].id, motivo: 'primo' } : { stalloId: null, motivo: null };
  },

  /** wrapper storico: restituisce solo il codice (usato da prenota, segnalazioni, ...) */
  assegnaStalloAutomatico(dipendenteId, dataISO) {
    return S.assegnaStalloConMotivo(dipendenteId, dataISO).stalloId;
  },

  /** Perche' questo dipendente ha PROPRIO questo stallo.
      Serve per le prenotazioni gia' esistenti, dove il motivo non puo' essere
      dato per scontato: lo stallo puo' essere diverso da quello fisso.
      Rispecchia la stessa priorita' di assegnaStalloConMotivo(). */
  motivoPerStallo(dipendenteId, stalloId) {
    const dip = S.dipendente(dipendenteId);
    const st  = S.stallo(stalloId);
    if (!dip || !st) return null;
    if (dip.stalloId === stalloId) return 'fisso';
    if (dip.caratteristica !== 'standard' && st.tipo === dip.caratteristica) return 'caratteristica';
    const pianoDip = dip.stalloId ? (S.stallo(dip.stalloId) || {}).piano : null;
    if (pianoDip && st.piano === pianoDip) return 'piano';
    return 'primo';
  },

  motivoAssegnazione(motivo) {
    return {
      fisso:          'il tuo stallo fisso',
      caratteristica: 'stallo compatibile con la tua caratteristica',
      piano:          'stallo libero sul tuo stesso piano',
      primo:          'primo stallo libero compatibile'
    }[motivo] || 'assegnazione automatica';
  },

  /* ---- PERIODO ------------------------------------------------------
     Accetta: undefined (= periodo selezionato in topbar), una data ISO
     (retrocompatibile con le chiamate esistenti) oppure {dal, al}.
     `giorniConDati` è il divisore delle medie: contare i giorni di calendario
     darebbe medie falsate dai weekend e dai giorni non ancora avvenuti. */
  normalizzaPeriodo(p) {
    let dal, al;
    if (!p)                        { const c = AppState.config.periodo; dal = c.dal; al = c.al; }
    else if (typeof p === 'string'){ dal = al = p; }
    else                           { dal = p.dal; al = p.al; }
    const giorni = [];
    for (let d = fromISO(dal); toISO(d) <= al; d = addDays(d, 1)) giorni.push(toISO(d));
    return { dal, al, giorni, multi: giorni.length > 1 };
  },

  /** giorni del periodo che contengono almeno un record della collezione */
  giorniConDati(giorni, righe, campoData) {
    const presenti = new Set(righe.map(r => r[campoData || 'data']));
    const n = giorni.filter(g => presenti.has(g)).length;
    return n || 1;
  },

  /** media giornaliera arrotondata */
  media(totale, giorni) { return Math.round(totale / Math.max(1, giorni)); },

  /* ---- KPI mappa / dashboard ---- */
  kpiStalli(dataISO) {
    const data = dataISO || OGGI_ISO;
    let liberi = 0, occupati = 0, manutenzione = 0;
    AppState.stalli.forEach(s => {
      const st = S.statoStallo(s.id, data).stato;
      if (st === 'libero') liberi++;
      else if (st === 'manutenzione' || st === 'bloccato') manutenzione++;
      else occupati++;
    });
    const totale = AppState.stalli.length;
    return {
      totale, liberi, occupati, manutenzione,
      ev:       AppState.stalli.filter(s => s.tipo === 'ev').length,
      disabili: AppState.stalli.filter(s => s.tipo === 'disabili').length,
      percOccupazione: totale ? Math.round(occupati / totale * 100) : 0,
      percDisponibilita: totale ? Math.round(liberi / totale * 100) : 0
    };
  },

  /** Occupazione per zona — alimenta la mini-mappa della Dashboard */
  occupazionePerZona(dataISO) {
    return AppState.zone.map(z => {
      const stalliZona = AppState.stalli.filter(s => s.zonaId === z.id);
      const occupati = stalliZona.filter(s => S.statoStallo(s.id, dataISO).stato !== 'libero').length;
      const tot = stalliZona.length;
      return { id: z.id, nome: z.nome, colore: z.colore, occupati, totale: tot, perc: tot ? Math.round(occupati / tot * 100) : 0 };
    });
  },

  kpiAccessi(periodo) {
    const P = S.normalizzaPeriodo(periodo);
    const righe = AppState.accessi.filter(a => a.data >= P.dal && a.data <= P.al);
    const gg = S.giorniConDati(P.giorni, righe);
    /* "Presenti ora" e "Anomalie aperte" sono grandezze PUNTUALI: restano
       sempre su oggi, qualunque periodo sia selezionato. Altrimenti il badge
       in sidebar conterebbe anomalie già chiuse settimane fa. */
    const diOggi = AppState.accessi.filter(a => a.data === OGGI_ISO);
    const ingressi = righe.length;
    const uscite   = righe.filter(a => a.uscita !== null).length;
    const anomalie = righe.filter(a => a.anomalia !== null).length;
    return {
      ingressi,
      dipendenti: righe.filter(a => a.tipo === 'dipendente').length,
      visitatori: righe.filter(a => a.tipo === 'visitatore').length,
      uscite,
      presenti:   diOggi.filter(a => a.uscita === null).length,
      /* anomalie ANCORA APERTE — usato dal badge sidebar, sempre su oggi */
      anomalie:   diOggi.filter(a => a.anomalia !== null && a.uscita === null).length,
      /* anomalie registrate NEL PERIODO — usato dal KPI di sezione */
      anomaliePeriodo: anomalie,
      anomalieTotali:  anomalie,
      giorni: gg, multi: P.multi,
      medie: { ingressi: S.media(ingressi, gg), uscite: S.media(uscite, gg), anomalie: S.media(anomalie, gg) }
    };
  },

  kpiPrenotazioni(periodo) {
    const P = S.normalizzaPeriodo(periodo);
    const righe = AppState.prenotazioni.filter(p => p.data >= P.dal && p.data <= P.al && p.stato !== 'annullata');
    const gg = S.giorniConDati(P.giorni, righe);
    const ufficio = righe.filter(p => p.tipo === 'ufficio').length;
    const sw      = righe.filter(p => p.tipo === 'sw').length;
    return {
      totali: righe.length, ufficio, sw,
      /* "Stalli liberi" è puntuale: sempre oggi */
      liberi: S.kpiStalli(P.multi ? OGGI_ISO : P.dal).liberi,
      giorni: gg, multi: P.multi,
      medie: { ufficio: S.media(ufficio, gg), sw: S.media(sw, gg), totali: S.media(righe.length, gg) }
    };
  },

  kpiSegnalazioni(periodo) {
    const s = AppState.segnalazioni;
    const P = S.normalizzaPeriodo(periodo);
    const inizioMese = new Date(OGGI.getFullYear(), OGGI.getMonth(), 1).getTime();
    const nelPeriodo = s.filter(x => {
      const d = toISO(new Date(x.apertaIlTs));
      return d >= P.dal && d <= P.al;
    });
    const risolteP = s.filter(x => x.stato === 'risolta' && x.risoltaIlTs &&
      toISO(new Date(x.risoltaIlTs)) >= P.dal && toISO(new Date(x.risoltaIlTs)) <= P.al);
    return {
      /* aperte / in gestione / bloccati sono STATI correnti: mai filtrati per
         periodo, altrimenti il badge in sidebar mentirebbe */
      aperte:      s.filter(x => x.stato === 'aperta').length,
      inGestione:  s.filter(x => x.stato === 'in_gestione').length,
      apertePeriodo: nelPeriodo.length,
      risoltePeriodo: risolteP.length,
      multi: P.multi,
      giorni: S.giorniConDati(P.giorni, nelPeriodo.map(x => ({ data: toISO(new Date(x.apertaIlTs)) }))),
      risolteMese: s.filter(x => x.stato === 'risolta' && x.risoltaIlTs >= inizioMese).length,
      bloccati:    AppState.dipendenti.filter(d => d.stato === 'bloccato').length,
      abusive:     s.filter(x => x.stato !== 'risolta' && x.tipo === 'abusivo').length,
      zona:        s.filter(x => x.stato !== 'risolta' && x.tipo === 'zona').length
    };
  },

  kpiDipendenti() {
    const d = AppState.dipendenti;
    const attivi = d.filter(x => x.stato === 'attivo');
    return {
      autorizzati: d.length,
      appAttiva:   d.filter(x => x.appAttiva).length,
      percApp:     d.length ? Math.round(d.filter(x => x.appAttiva).length / d.length * 100) : 0,
      bloccati:    d.filter(x => x.stato === 'bloccato').length,
      poolRotante: attivi.filter(x => x.poolRotante).length
    };
  },

  kpiVisitatori(periodo) {
    const P = S.normalizzaPeriodo(periodo);
    const v = AppState.visitatori.filter(x => x.data >= P.dal && x.data <= P.al && x.stato !== 'revocato');
    const gg = S.giorniConDati(P.giorni, v);
    const previsti = v.length;
    const checkIn  = v.filter(x => x.stato === 'dentro' || x.stato === 'uscito').length;
    return {
      /* "Attivi ora" è puntuale: sempre oggi */
      attivi: AppState.visitatori.filter(x => x.data === OGGI_ISO && x.stato === 'dentro').length,
      previsti, checkIn,
      scaduti: v.filter(x => x.scaduto).length,
      giorni: gg, multi: P.multi,
      medie: { previsti: S.media(previsti, gg), checkIn: S.media(checkIn, gg) }
    };
  },

  kpiHardware() {
    const h = AppState.hardware;
    const anomalie = h.filter(x => x.stato === 'anomalia');
    return {
      online:         h.filter(x => x.stato === 'online').length,
      configurazione: h.filter(x => x.stato === 'in_configurazione').length,
      totale:         h.length,
      anomalie:       anomalie.length,
      anomaliaNome:   (anomalie[0] || {}).nome || '—',
      cicli2n:        (h.find(x => x.ruolo === 'principale') || {}).cicli || 0,
      uptime:         '99.8%'
    };
  },

  /** metodi di accesso derivati dall'hardware effettivamente installato */
  metodiAccesso() {
    return AppState.hardware
      .filter(h => TIPI_HW[h.tipo] && TIPI_HW[h.tipo].metodoAccesso)
      .map(h => ({
        metodo:      TIPI_HW[h.tipo].metodoAccesso,
        label:       METODO_ACCESSO[TIPI_HW[h.tipo].metodoAccesso],
        icona:       TIPI_HW[h.tipo].icona,
        dispositivo: h.nome,
        stato:       h.stato
      }));
  },

  /* ---- badge sidebar (derivati, si aggiornano da soli) ---- */
  badges() {
    /* i badge sono notifiche del "adesso": passano OGGI esplicitamente, così
       cambiare periodo in topbar non li altera */
    return {
      accessi:     S.kpiAccessi(OGGI_ISO).anomalie,
      segnalazioni: S.kpiSegnalazioni(OGGI_ISO).aperte,
      dipendenti:  AppState.richiestePass.filter(r => r.stato === 'in_attesa').length
    };
  },

  /* ---- liste filtrate ---- */
  accessiFiltrati() {
    const f = AppState.ui.filtri.accessi;
    const q = f.q.trim().toLowerCase();
    const P = S.normalizzaPeriodo();
    return AppState.accessi.filter(a => {
      if (a.data < P.dal || a.data > P.al) return false;
      if (q && !(a.personaNome.toLowerCase().includes(q) || (a.stalloId || '').toLowerCase().includes(q) || (a.targa || '').toLowerCase().includes(q))) return false;
      if (f.tipo     && a.tipo !== f.tipo) return false;
      if (f.stato    && a.stato !== f.stato) return false;
      if (f.stallo   && a.stalloId !== f.stallo) return false;
      if (f.anomalia && !a.anomalia) return false;
      return true;
    });
  },

  dipendentiFiltrati() {
    const q = AppState.ui.filtri.dipendenti.q.trim().toLowerCase();
    const base = q
      ? AppState.dipendenti.filter(d =>
          d.nomeCompleto.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q) ||
          d.dipartimento.toLowerCase().includes(q) ||
          (d.stalloId || '').toLowerCase().includes(q))
      : AppState.dipendenti;
    /* i dipendenti in evidenza restano in cima: sono quelli "raccontati" */
    return base.slice().sort((a, b) => (b.inEvidenza - a.inEvidenza) || a.cognome.localeCompare(b.cognome));
  },

  /* ---- prenotazioni ---- */
  settimanaFM()  { return [0, 1, 2, 3, 4].map(i => addDays(getMonday(addDays(OGGI, AppState.ui.fmWeekOffset * 7)), i)); },
  settimanaEmpOffset(off) { return [0, 1, 2, 3, 4].map(i => addDays(getMonday(addDays(OGGI, off * 7)), i)); },
  settimanaEmp() { return S.settimanaEmpOffset(AppState.ui.empWeekOffset); },
  /** true se la settimana a quell'offset contiene almeno un giorno prenotabile.
      Serve al pulsante "Succ >": la finestra non e' piu' un numero intero di
      settimane, quindi il limite non si puo' piu' derivare da un contatore. */
  settimanaHaGiorniPrenotabili(off) { return S.settimanaEmpOffset(off).some(g => S.dataPrenotabile(g)); },

  prenotazione(dipendenteId, dataISO) {
    return AppState.prenotazioni.find(p => p.dipendenteId === dipendenteId && p.data === dataISO && p.stato !== 'annullata') || null;
  },
  prenotazioniDipendente(dipendenteId, daISO) {
    return AppState.prenotazioni
      .filter(p => p.dipendenteId === dipendenteId && p.stato !== 'annullata' && (!daISO || p.data >= daISO))
      .sort((a, b) => a.data.localeCompare(b.data));
  },
  /** righe della vista settimanale FM: dipendenti in evidenza + eventuale ricerca */
  righeSettimanaFM() {
    const giorni = S.settimanaFM().map(toISO);
    return S.dipendentiFiltrati()
      .filter(d => d.inEvidenza || AppState.ui.filtri.dipendenti.q)
      .slice(0, 14)
      .map(d => ({ dipendente: d, celle: giorni.map(iso => ({ iso, prenotazione: S.prenotazione(d.id, iso) })) }));
  },

  /** I giorni lavorativi prenotabili, oggi incluso (10 per default). */
  finestraPrenotazione() { return giorniLavorativi(OGGI, AppState.config.prenotazioni.finestraGiorniLavorativi); },
  /** Ultima data prenotabile — **inclusiva**. Prima era un limite esclusivo
      (OGGI + N*7): chi la confronta deve usare <=, non <. */
  ultimaDataPrenotabile() { const f = S.finestraPrenotazione(); return f[f.length - 1]; },
  /** Giorni di anticipo dichiarati all'utente: oggi non e' "anticipo". */
  giorniAnticipo()       { return Math.max(0, AppState.config.prenotazioni.finestraGiorniLavorativi - 1); },
  dataPrenotabile(d) {
    const g = startOfDay(d);
    return isLavorativo(g) && g >= OGGI && g <= S.ultimaDataPrenotabile();
  },

  /** Richieste pass inoltrate da un dipendente, dalla piu' recente. */
  richiestePassDipendente(dipendenteId) {
    return AppState.richiestePass
      .filter(r => r.dipendenteId === dipendenteId)
      .slice()
      .sort((a, b) => (b.esitoIlTs || 0) - (a.esitoIlTs || 0) || b.id.localeCompare(a.id));
  },
  /** Segnalazioni aperte da un dipendente, dalla piu' recente. */
  segnalazioniDipendente(dipendenteId) {
    return AppState.segnalazioni
      .filter(s => s.segnalanteId === dipendenteId)
      .slice()
      .sort((a, b) => b.apertaIlTs - a.apertaIlTs);
  },
  /** Esiti non ancora letti dal dipendente: alimentano il badge nell'hero. */
  notifichePassNonLette(dipendenteId) {
    return AppState.richiestePass.filter(r =>
      r.dipendenteId === dipendenteId && r.stato !== 'in_attesa' && !r.letta);
  },

  /** Il turno attivo adesso, secondo config.turni.
      `quando` esiste solo per i test — senza argomento usa l'ora corrente,
      come da specifica. Accetta una Date oppure i minuti dalla mezzanotte:
      e' l'unico modo di verificare "alle 02:00" senza spostare l'orologio.
      Se nessun turno copre l'ora, restituisce il primo. */
  turnoCorrente(quando) {
    const turni = AppState.config.turni || [];
    if (!turni.length) return null;
    const daData = (d) => d.getHours() * 60 + d.getMinutes();
    const ora = (quando === undefined || quando === null) ? daData(new Date())
      : (quando instanceof Date ? daData(quando) : Number(quando));
    const min = (hhmm) => {
      const [h, m] = String(hhmm).split(':').map(Number);
      return h * 60 + (m || 0);
    };
    const trovato = turni.find(t => {
      const dal = min(t.inizio), al = min(t.fine);
      /* Il turno di notte attraversa la mezzanotte: 23:00-07:00 va letto come
         "dalle 23 in poi OPPURE prima delle 7", non come intervallo vuoto. */
      return dal <= al ? (ora >= dal && ora < al) : (ora >= dal || ora < al);
    });
    return trovato || turni[0];
  },

  /** Il turno con quell'id, o null. */
  turno(turnoId) { return (AppState.config.turni || []).find(t => t.id === turnoId) || null; },

  /* ---- segnalazioni ---- */
  segnalazioniAttive() {
    return AppState.segnalazioni
      .filter(s => s.stato !== 'risolta')
      .sort((a, b) => (a.gravita === 'urgente' ? -1 : 1) - (b.gravita === 'urgente' ? -1 : 1) || b.apertaIlTs - a.apertaIlTs);
  },
  /** durata "live" di una segnalazione — ricalcolata ad ogni render */
  durataSegnalazione(seg) { return fmtMinuti(Date.now() - seg.apertaIlTs); },
  /** durata sosta "live" di un accesso ancora aperto */
  durataSosta(accessoId) {
    const a = S.accesso(accessoId);
    if (!a) return '—';
    let ts = a.ingressoTs;
    if (!ts) {
      const [h, m] = a.ingresso.split(':').map(Number);
      ts = fromISO(a.data).getTime() + h * 3600000 + m * 60000;
    }
    return fmtDurata(Date.now() - ts);
  },

  /* ---- EXPORT ----
     Restituiscono dati gia' pronti per il file: nessuna formattazione nella
     UI, cosi' il contenuto e' verificabile anche fuori dal browser. */
  esportaAccessi(periodo) {
    const P = S.normalizzaPeriodo(periodo);
    const tipi = { dipendente: 'Dipendente', visitatore: 'Visitatore', anomalia: 'Anomalia' };
    return AppState.accessi
      .filter(a => a.data >= P.dal && a.data <= P.al)
      .slice()
      .sort((a, b) => a.data.localeCompare(b.data) || (a.ingresso || '').localeCompare(b.ingresso || ''))
      .map(a => ({
        'Data':         a.data,
        'Ora ingresso': a.ingresso || '',
        'Ora uscita':   a.uscita || '',
        'Persona':      a.personaNome,
        'Tipo':         tipi[a.tipo] || a.tipo,
        'Stallo':       a.stalloId || '',
        'Metodo':       METODO_ACCESSO[a.metodo] || a.metodo,
        'Stato':        a.stato
      }));
  },

  esportaDipendenti() {
    return AppState.dipendenti.map(d => ({
      id:            d.id,
      nomeCompleto:  d.nomeCompleto,
      dipartimento:  d.dipartimento,
      stalloId:      d.stalloId,
      metodoAccesso: d.metodoAccesso,
      stato:         d.stato,
      accessiMese:   d.accessiMese
    }));
  },

  /** Cosa succederebbe portando il totale posti a `target`, SENZA applicarlo.
      Rispecchia la logica di impostaPostiTotali(), che toglie dalla coda della
      prima zona standard. */
  anteprimaPosti(target) {
    const attuale = AppState.stalli.length;
    const delta = (parseInt(target, 10) || 0) - attuale;
    if (delta >= 0) return { delta, rimossi: [], prenotazioni: 0, zona: null };
    const zona = AppState.zone.find(z => z.tipoDefault === 'standard') || AppState.zone[0];
    if (!zona) return { delta, rimossi: [], prenotazioni: 0, zona: null };
    const dellaZona = AppState.stalli.filter(s => s.zonaId === zona.id);
    const quanti = Math.min(-delta, dellaZona.length);
    const rimossi = dellaZona.slice(dellaZona.length - quanti).map(s => s.id);
    const pren = AppState.prenotazioni.filter(p =>
      p.stato !== 'annullata' && rimossi.indexOf(p.stalloId) >= 0).length;
    return { delta, rimossi, prenotazioni: pren, zona: zona.id };
  },

  /* ---- prossimo codice stallo libero in una zona ---- */
  prossimoCodiceStallo(zonaId) {
    const usati = AppState.stalli.filter(s => s.zonaId === zonaId).map(s => parseInt(s.codice.split('-')[1], 10));
    const max = usati.length ? Math.max(...usati) : 0;
    return zonaId + '-' + String(max + 1).padStart(2, '0');
  },

  /* ---- stalli selezionabili in un modale ---- */
  stalliDisponibiliPer(dipendenteId, dataISO) {
    return AppState.stalli.filter(s => S.stalloPrenotabile(s.id, dataISO || OGGI_ISO, dipendenteId)).map(s => s.id);
  }
};

/* ==========================================================================
   5. ACTIONS — le uniche funzioni che scrivono
   Ogni action muta lo stato e chiama Store.emit(): tutte le sezioni montate
   si ridisegnano. Nessuna action tocca il DOM.
========================================================================== */

const A = {

  /* ---- SESSIONE ----
     Non esiste selezione di ruolo: il ruolo si deduce dall'account. */
  loginConEmail(email) {
    if (!email || !email.trim()) return { errore: 'Inserisci l\'email aziendale' };
    const acc = S.trovaAccountPerEmail(email);
    if (!acc) return { errore: 'Credenziali non valide' };
    if (acc.utente.statoAccount === 'disattivato') return { errore: 'Account disattivato. Contatta l\'amministratore.' };
    if (acc.utente.statoAccount && acc.utente.statoAccount.startsWith('invito')) {
      return { errore: 'Account non ancora attivato. Usa il link di invito ricevuto via email.' };
    }
    A.entraCome(acc.ruolo, acc.utente.id);
    return { ok: true, ruolo: acc.ruolo, utente: acc.utente };
  },

  /** apre la sessione per un ruolo/utente già risolto */
  entraCome(ruolo, utenteId) {
    AppState.ui.ruolo = ruolo;
    AppState.ui.utenteCorrenteId = utenteId;
    AppState.ui.vista = ruolo === 'dipendente' ? 'dipendente' : 'fm';
    AppState.ui.sezione = 'dashboard';
    AppState.ui.attivazione = null;
    const u = S.utentePiattaforma(utenteId);
    if (u) u.ultimoAccesso = OGGI_ISO;
    Store.emit('login');
  },

  logout() {
    AppState.ui.vista = 'login';
    AppState.ui.ruolo = null;
    AppState.ui.utenteCorrenteId = null;
    AppState.ui.empWeekOffset = 0;
    AppState.ui.fmWeekOffset = 0;
    AppState.ui.mapSelection = [];
    AppState.ui.attivazione = null;
    Store.emit('logout');
  },

  /* ---- ATTIVAZIONE ACCOUNT (invite-only, simulata) ---- */
  avviaAttivazione(utenteId, tipo, invitatoDaId) {
    AppState.ui.attivazione = {
      utenteId, tipo,
      invitatoDa: invitatoDaId || AppState.ui.utenteCorrenteId || 'USR-0001'
    };
    AppState.ui.vista = 'attiva';
    Store.emit('attivazione');
  },

  completaAttivazione() {
    const att = AppState.ui.attivazione;
    if (!att) return { errore: 'Nessuna attivazione in corso' };
    const u = S.utentePiattaforma(att.utenteId);
    const d = S.dipendente(att.utenteId);
    const target = u || d;
    if (!target) return { errore: 'Utente non trovato' };
    target.statoAccount = 'attivo';
    if (d) { d.stato = 'attivo'; d.appAttiva = true; d.metodoAccesso = 'app2n'; }
    A.entraCome(u ? u.ruolo : 'dipendente', target.id);
    return { ok: true, utente: target };
  },

  /* ---- UI di navigazione delle tab interne ---- */
  setConfigTab(tab) { AppState.ui.configTab = tab; Store.emit('nav'); },
  setAdminTab(tab)  { AppState.ui.adminTab = tab; Store.emit('nav'); },

  /* ---- UTENTI DI PIATTAFORMA (solo Admin) ---- */
  creaUtentePiattaforma({ nome, cognome, email, ruolo, sedeId }) {
    if (!nome || !cognome || !email) return { errore: 'Nome, cognome ed email sono obbligatori' };
    if (S.trovaAccountPerEmail(email)) return { errore: 'Esiste già un account con questa email' };
    if (ruolo === 'fm' && !sedeId) return { errore: 'Seleziona il parcheggio da assegnare al Facility Manager' };
    const u = {
      id: nextId('USR'),
      nome: nome.trim(), cognome: cognome.trim(),
      nomeCompleto: nome.trim() + ' ' + cognome.trim(),
      iniziali: iniziali(nome.trim(), cognome.trim()),
      email: email.trim(),
      ruolo: ruolo || 'fm',
      sedeId: ruolo === 'admin' ? null : (sedeId || 'SEDE-DEMO'),
      statoAccount: 'invito_inviato',
      ultimoAccesso: null,
      invitatoDa: AppState.ui.utenteCorrenteId
    };
    AppState.utentiPiattaforma.push(u);
    Store.emit('utenti');
    return u;
  },

  cambiaRuoloUtente(utenteId, ruolo) {
    const u = S.utentePiattaforma(utenteId);
    if (!u) return null;
    u.ruolo = ruolo;
    if (ruolo === 'admin') u.sedeId = null;
    else if (!u.sedeId) u.sedeId = 'SEDE-DEMO';
    Store.emit('utenti');
    return u;
  },

  toggleAttivoUtente(utenteId) {
    const u = S.utentePiattaforma(utenteId);
    if (!u) return null;
    u.statoAccount = u.statoAccount === 'disattivato' ? 'attivo' : 'disattivato';
    Store.emit('utenti');
    return u;
  },

  reinviaInvito(utenteId) {
    const u = S.utentePiattaforma(utenteId) || S.dipendente(utenteId);
    if (!u) return null;
    u.statoAccount = 'invito_inviato';
    Store.emit('utenti');
    return u;
  },

  /* ---- IMPORT MASSIVO DIPENDENTI ---- */
  importaDipendenti(righe) {
    const creati = (righe || IMPORT_DEMO).map(r => {
      const d = A.aggiungiDipendente({
        nome: r.nome, cognome: r.cognome, email: r.email,
        dipartimento: r.dipartimento, stalloId: r.stalloId || null, caratteristica: 'standard'
      });
      d.statoAccount = 'invito_da_inviare';
      d.appAttiva = false;
      d.importato = true;
      return d;
    });
    Store.emit('dipendenti');
    return creati;
  },
  vaiA(sezione) { AppState.ui.sezione = sezione; Store.emit('nav'); },

  /* ---- selezione (alimenta i modali dinamici — fix DV05/DV08/DV18) ---- */
  seleziona(chiave, id) { AppState.ui.selezione[chiave] = id; Store.emit('selezione'); },

  /* ---- filtri (fix DV07/DV17) ---- */
  setFiltroAccessi(patch)    { Object.assign(AppState.ui.filtri.accessi, patch); Store.emit('filtri'); },
  setFiltroDipendenti(patch) { Object.assign(AppState.ui.filtri.dipendenti, patch); Store.emit('filtri'); },
  resetFiltri(sezione)       {
    if (sezione === 'accessi')    AppState.ui.filtri.accessi = { q: '', tipo: '', stato: '', stallo: '', anomalia: false, aperto: AppState.ui.filtri.accessi.aperto };
    if (sezione === 'dipendenti') AppState.ui.filtri.dipendenti = { q: '' };
    Store.emit('filtri');
  },

  /* ---- navigazione settimane (fix DV09) ---- */
  fmWeek(delta)  { AppState.ui.fmWeekOffset += delta; Store.emit('week'); },
  empWeek(delta) {
    const next = AppState.ui.empWeekOffset + delta;
    if (next < 0) return;
    /* In avanti ci si sposta solo se la settimana contiene ancora almeno un
       giorno prenotabile: con una finestra in giorni lavorativi l'ultima
       settimana raggiungibile e' quasi sempre parziale. */
    if (delta > 0 && !S.settimanaHaGiorniPrenotabili(next)) return;
    AppState.ui.empWeekOffset = next;
    Store.emit('week');
  },

  /* ---- STALLI ---- */
  aggiornaStallo(stalloId, patch) {
    const s = S.stallo(stalloId);
    if (!s) return null;
    /* cambio titolare: mantieni coerente la relazione con il dipendente */
    if ('titolareId' in patch && patch.titolareId !== s.titolareId) {
      const vecchio = S.dipendente(s.titolareId);
      if (vecchio) { vecchio.stalloId = null; vecchio.poolRotante = true; }
      const nuovo = S.dipendente(patch.titolareId);
      if (nuovo) {
        const precedente = AppState.stalli.find(x => x.titolareId === nuovo.id && x.id !== stalloId);
        if (precedente) precedente.titolareId = null;
        nuovo.stalloId = stalloId; nuovo.poolRotante = false;
      }
    }
    Object.assign(s, patch);
    /* stallo messo in manutenzione o bloccato → libera le prenotazioni future */
    if (s.tipo === 'manutenzione' || s.disponibilita === 'bloccato') {
      AppState.prenotazioni.forEach(p => {
        if (p.stalloId === stalloId && p.data >= OGGI_ISO && p.stato === 'attiva') {
          const alt = S.assegnaStalloAutomatico(p.dipendenteId, p.data);
          p.stalloId = alt;
          if (!alt) p.stato = 'annullata';
        }
      });
    }
    Store.emit('stalli');
    return s;
  },

  aggiornaStalliMultipli(stalliIds, patch) {
    stalliIds.forEach(id => A.aggiornaStallo(id, patch));
    Store.emit('stalli');
    return stalliIds.length;
  },

  aggiungiStallo({ zonaId, tipo, disponibilita, durataMaxOre, titolareId, note }) {
    const zona = S.zona(zonaId);
    if (!zona) return null;
    const codice = S.prossimoCodiceStallo(zonaId);
    const stallo = {
      id: codice, codice, zonaId, piano: zona.piano,
      tipo: tipo || zona.tipoDefault,
      disponibilita: disponibilita || 'sempre',
      titolareId: titolareId || null,
      durataMaxOre: durataMaxOre || 10,
      note: note || ''
    };
    AppState.stalli.push(stallo);
    zona.posti = AppState.stalli.filter(s => s.zonaId === zonaId).length;
    if (titolareId) { const d = S.dipendente(titolareId); if (d) { d.stalloId = codice; d.poolRotante = false; } }
    Store.emit('stalli');
    return stallo;
  },

  toggleSelezioneStallo(stalloId) {
    const sel = AppState.ui.mapSelection;
    const i = sel.indexOf(stalloId);
    if (i >= 0) sel.splice(i, 1); else sel.push(stalloId);
    Store.emit('mapSelection');
    return sel.length;
  },
  pulisciSelezioneStalli() { AppState.ui.mapSelection = []; Store.emit('mapSelection'); },

  /* ---- ZONE ---- */
  aggiungiZona() {
    const usati = AppState.zone.map(z => z.id);
    let code = 'G';
    while (usati.includes(code)) code = String.fromCharCode(code.charCodeAt(0) + 1);
    AppState.zone.push({ id: code, nome: 'Nuova Zona ' + code, piano: 'Piano -1', posti: 10, tipoDefault: 'standard', colore: 'gold', note: '' });
    Store.emit('zone');
    return code;
  },
  aggiornaZona(zonaId, patch) { const z = S.zona(zonaId); if (z) Object.assign(z, patch); Store.emit('zone'); },
  rimuoviZona(zonaId) {
    AppState.zone = AppState.zone.filter(z => z.id !== zonaId);
    AppState.stalli = AppState.stalli.filter(s => s.zonaId !== zonaId);
    Store.emit('zone');
  },
  /** applica il numero di posti dichiarato in Config creando/rimuovendo stalli */
  salvaZone() {
    AppState.zone.forEach(z => {
      const attuali = AppState.stalli.filter(s => s.zonaId === z.id);
      const target = Math.max(0, parseInt(z.posti, 10) || 0);
      if (attuali.length < target) {
        for (let i = attuali.length; i < target; i++) {
          const codice = z.id + '-' + String(i + 1).padStart(2, '0');
          if (!S.stallo(codice)) AppState.stalli.push({
            id: codice, codice, zonaId: z.id, piano: z.piano, tipo: z.tipoDefault,
            disponibilita: 'sempre', titolareId: null, durataMaxOre: 10, note: ''
          });
        }
      } else if (attuali.length > target) {
        const daRimuovere = attuali.slice(target).map(s => s.id);
        AppState.stalli = AppState.stalli.filter(s => !daRimuovere.includes(s.id));
        AppState.prenotazioni.forEach(p => { if (daRimuovere.includes(p.stalloId)) { p.stalloId = null; p.stato = 'annullata'; } });
      }
      z.posti = AppState.stalli.filter(s => s.zonaId === z.id).length;
    });
    Store.emit('zone');
    return AppState.stalli.length;
  },

  /* ---- PRENOTAZIONI ---- */
  prenota({ dipendenteId, dataISO, tipo, stalloId, creataDa }) {
    const esistente = S.prenotazione(dipendenteId, dataISO);
    if (esistente) A.annullaPrenotazione(esistente.id, { silent: true });
    const spot = tipo === 'ufficio' ? (stalloId || S.assegnaStalloAutomatico(dipendenteId, dataISO)) : null;
    if (tipo === 'ufficio' && !spot) { Store.emit('prenotazioni'); return { errore: 'Nessuno stallo disponibile per la data selezionata.' }; }
    const p = {
      id: nextId('PRE'), dipendenteId, data: dataISO, tipo,
      stalloId: spot, stato: 'attiva', checkIn: null, checkOut: null,
      creataDa: creataDa || 'dipendente',
      /* anche le prenotazioni create a runtime nascono giornaliere: senza
         questo campo le nuove differirebbero da quelle del seed */
      turnoId: null
    };
    AppState.prenotazioni.push(p);
    Store.emit('prenotazioni');
    return p;
  },

  annullaPrenotazione(prenotazioneId, opts) {
    const p = AppState.prenotazioni.find(x => x.id === prenotazioneId);
    if (!p) return null;
    p.stato = 'annullata';
    /* Se il dipendente era già entrato, l'accesso resta aperto e statoStallo()
       continuerebbe a vedere lo stallo occupato.
       Il match non può basarsi solo su prenotazioneId: una prenotazione creata
       dopo il seed non ha un accesso collegato, mentre l'accesso del seed sullo
       stesso stallo è ancora aperto. Si cerca quindi anche per stallo+persona.
       Le occupazioni abusive NON si chiudono: le gestisce il FM. */
    if (p.data === OGGI_ISO) {
      const acc = AppState.accessi.find(a =>
        a.uscita === null && a.stato !== 'abusivo' &&
        (a.prenotazioneId === p.id ||
         (a.stalloId === p.stalloId && a.personaId === p.dipendenteId)));
      if (acc) { acc.uscita = hhmm(new Date()); acc.stato = 'uscito'; }
    }
    if (!opts || !opts.silent) Store.emit('prenotazioni');
    return p;
  },

  dichiaraSmartWorking(dipendenteId, dataISO) {
    return A.prenota({ dipendenteId, dataISO, tipo: 'sw' });
  },

  /* ---- DIPENDENTI ---- */
  aggiungiDipendente({ nome, cognome, email, dipartimento, stalloId, caratteristica }) {
    const d = {
      id: nextId('DIP'), nome, cognome,
      nomeCompleto: nome + ' ' + cognome,
      iniziali: iniziali(nome, cognome),
      email: email || (slug(nome)[0] + '.' + slug(cognome) + '@' + AppState.config.sede.dominioEmail),
      dipartimento: dipartimento || 'Operations',
      stalloId: stalloId || null,
      poolRotante: !stalloId,
      caratteristica: caratteristica || 'standard',
      metodoAccesso: 'app2n', appAttiva: true, stato: 'attivo',
      bloccoMotivo: null, bloccoTipo: null, bloccoDal: null,
      accessiMese: 0, noShow: 0, segnalazioniFatte: 0,
      statoAccount: 'invito_inviato',
      puoRichiederePass: false,
      utenteDemo: false, inEvidenza: true
    };
    AppState.dipendenti.push(d);
    if (stalloId) { const s = S.stallo(stalloId); if (s) s.titolareId = d.id; }
    Store.emit('dipendenti');
    return d;
  },
  aggiornaDipendente(id, patch) { const d = S.dipendente(id); if (d) Object.assign(d, patch); Store.emit('dipendenti'); return d; },

  /** Abilita/disabilita un singolo dipendente a richiedere pass visitatore. */
  togglePuoRichiederePass(id) {
    const d = S.dipendente(id);
    if (!d) return null;
    d.puoRichiederePass = !d.puoRichiederePass;
    Store.emit('dipendenti');
    return d;
  },

  /** Sospende l'accesso e libera il parcheggio da quel dipendente.
      Ritorna { dipendente, annullate }: il conteggio serve al toast e non ha
      senso conservarlo sull'anagrafica. */
  sospendiDipendente(id, motivo) {
    const d = S.dipendente(id);
    if (!d) return null;
    Object.assign(d, { stato: 'bloccato', metodoAccesso: 'sospeso', appAttiva: false, bloccoMotivo: motivo || 'Sospensione manuale FM', bloccoTipo: 'manuale', bloccoDal: OGGI_ISO });
    /* Le prenotazioni future passano da annullaPrenotazione() e non da un
       assegnamento diretto: quella funzione chiude anche l'accesso rimasto
       aperto, senza il quale lo stallo di oggi resterebbe rosso in mappa
       (e' esattamente il bug corretto in CODE-03). */
    const future = AppState.prenotazioni.filter(p =>
      p.dipendenteId === id && p.data >= OGGI_ISO && p.stato === 'attiva');
    future.forEach(p => A.annullaPrenotazione(p.id, { silent: true }));
    Store.emit('dipendenti');
    return { dipendente: d, annullate: future.length };
  },

  sbloccaDipendente(id, { motivazione, durata }) {
    const d = S.dipendente(id);
    if (!d) return null;
    Object.assign(d, { stato: 'attivo', metodoAccesso: 'app2n', appAttiva: true, bloccoMotivo: null, bloccoTipo: null, bloccoDal: null, noteSblocco: motivazione, ripristino: durata });
    Store.emit('dipendenti');
    return d;
  },

  /* ---- VISITATORI ---- */
  creaPassVisitatore({ nome, azienda, email, dataISO, dataFineISO, oraInizio, oraFine, referenteId, stalloId }) {
    const data = dataISO || OGGI_ISO;
    const fine = dataFineISO && dataFineISO > data ? dataFineISO : null;
    /* Su un pass multi-giorno lo stallo deve essere libero TUTTI i giorni:
       sceglierlo guardando solo il primo produrrebbe un doppio uso al secondo. */
    const giorni = [data];
    if (fine) { for (let d = addDays(fromISO(data), 1); toISO(d) <= fine; d = addDays(d, 1)) giorni.push(toISO(d)); }
    /* Due controlli distinti, perche' coprono buchi diversi:
       - statoStallo() vede accessi e prenotazioni, ma valuta i visitatori solo
         per OGGI: sulle date future non saprebbe di un altro pass gia' emesso;
       - la sovrapposizione fra pass va quindi verificata a mano sul range,
         altrimenti due pass futuri riceverebbero entrambi lo stesso V-01. */
    const occupatoDaAltroPass = (id) => AppState.visitatori.some(v =>
      v.stalloId === id && v.stato !== 'revocato'
      && v.data <= (fine || data) && (v.dataFine || v.data) >= data);
    const spot = stalloId || (AppState.stalli.find(s => s.zonaId === 'V'
      && giorni.every(g => S.statoStallo(s.id, g).stato === 'libero')
      && !occupatoDaAltroPass(s.id)) || {}).id || null;
    const v = {
      id: nextId('VIS'),
      passId: 'VIS-' + String(AppState.visitatori.length + 41).padStart(4, '0'),
      nome, azienda: azienda || '—', email,
      stalloId: spot, data, dataFine: fine, oraInizio: oraInizio || '09:00', oraFine: oraFine || '18:00',
      stato: 'atteso', zonaErrata: false, scaduto: false,
      codiceMy2N: String(Math.floor(1000 + Math.random() * 9000)),
      referenteId: referenteId || 'USR-0002',
      creatoIl: OGGI_ISO
    };
    AppState.visitatori.push(v);
    Store.emit('visitatori');
    return v;
  },
  revocaPass(id) {
    const v = S.visitatore(id);
    if (!v) return null;
    v.stato = 'revocato';
    const acc = AppState.accessi.find(a => a.personaId === id && a.uscita === null);
    if (acc) { acc.uscita = hhmm(new Date()); acc.stato = 'uscito'; }
    Store.emit('visitatori');
    return v;
  },
  estendiPass(id, oraFine) { const v = S.visitatore(id); if (v) { v.oraFine = oraFine || '20:00'; v.scaduto = false; } Store.emit('visitatori'); return v; },

  /** modifica un pass esistente (es. riassegnazione dopo "zona errata") */
  mutaVisitatore(id, patch) {
    const v = S.visitatore(id);
    if (!v) return null;
    const vecchioStallo = v.stalloId;
    Object.assign(v, patch);
    /* l'accesso in corso segue il visitatore sul nuovo stallo */
    if (patch.stalloId && patch.stalloId !== vecchioStallo) {
      const acc = AppState.accessi.find(a => a.personaId === id && a.uscita === null);
      if (acc) { acc.stalloId = patch.stalloId; acc.anomalia = v.zonaErrata ? 'zona' : null; }
    }
    Store.emit('visitatori');
    return v;
  },

  /** Richiesta di pass inoltrata dal dipendente al FM. Nasce sempre
      'in_attesa': e' il FM a deciderne l'esito da Dipendenti -> req-pass. */
  creaRichiestaPass({ dipendenteId, visitatoreNome, visitatoreEmail, azienda, dataInizio, dataFine, note }) {
    const dal = dataInizio || OGGI_ISO;
    const al  = dataFine || dal;
    const r = {
      id: nextId('REQ'),
      dipendenteId,
      visitatoreNome: (visitatoreNome || '').trim(),
      visitatoreEmail: (visitatoreEmail || '').trim(),
      azienda: (azienda || '').trim() || '—',
      /* il pass approvato vale H24 su tutti i giorni del range: non si
         memorizzano orari, solo l'intervallo di date */
      dataInizio: dal,
      dataFine: al < dal ? dal : al,
      stato: 'in_attesa',
      note: (note || '').trim(),
      codiceMy2N: null,
      esitoIlTs: null,
      letta: true
    };
    AppState.richiestePass.push(r);
    Store.emit('richieste');
    return r;
  },

  /** Approva: crea il pass H24 sul range e riporta l'esito SULLA RICHIESTA.
      Il codice My2N va scritto anche qui, non solo sul visitatore: il
      dipendente vede la richiesta, non l'anagrafica visitatori. */
  approvaRichiestaPass(richiestaId, note) {
    const r = AppState.richiestePass.find(x => x.id === richiestaId);
    if (!r) return null;
    const v = A.creaPassVisitatore({
      nome: r.visitatoreNome, azienda: r.azienda, email: r.visitatoreEmail,
      dataISO: r.dataInizio, dataFineISO: r.dataFine,
      oraInizio: '00:00', oraFine: '23:59',
      referenteId: r.dipendenteId
    });
    Object.assign(r, {
      stato: 'approvata', note: note || '',
      codiceMy2N: v.codiceMy2N, visitatoreId: v.id,
      esitoIlTs: Date.now(), letta: false
    });
    Store.emit('visitatori');
    return v;
  },
  rifiutaRichiestaPass(richiestaId, note) {
    const r = AppState.richiestePass.find(x => x.id === richiestaId);
    if (r) Object.assign(r, { stato: 'rifiutata', note: note || '', esitoIlTs: Date.now(), letta: false });
    Store.emit('visitatori');
    return r;
  },

  /** Il dipendente ha aperto la tab Pass: gli esiti non sono piu' "novita'". */
  segnaRichiestePassLette(dipendenteId) {
    let n = 0;
    AppState.richiestePass.forEach(r => {
      if (r.dipendenteId === dipendenteId && r.stato !== 'in_attesa' && !r.letta) { r.letta = true; n++; }
    });
    if (n) Store.emit('richieste');
    return n;
  },

  setEmpRichiesteTab(tab) {
    AppState.ui.empRichiesteTab = tab;
    if (tab === 'pass') {
      const d = S.dipendenteCorrente();
      if (d) A.segnaRichiestePassLette(d.id);
    }
    Store.emit('emp-tab');
  },

  /* ---- SEGNALAZIONI ---- */
  creaSegnalazione({ tipo, stalloId, segnalanteId, descrizione, targa }) {
    const seg = {
      id: nextId('SEG'), tipo: tipo || 'altro',
      gravita: (TIPO_SEGNALAZIONE[tipo] || TIPO_SEGNALAZIONE.altro).gravitaDefault,
      stato: 'aperta', stalloId: stalloId || null, segnalanteId: segnalanteId || null,
      targa: targa || null,
      titolo: (stalloId ? stalloId + ' — ' : '') + (TIPO_SEGNALAZIONE[tipo] || TIPO_SEGNALAZIONE.altro).label,
      descrizione: descrizione || '',
      apertaIlTs: Date.now(), aggiornataIlTs: Date.now(), risoltaIlTs: null,
      policyOre: null, azione: null, note: []
    };
    AppState.segnalazioni.unshift(seg);
    const d = S.dipendente(segnalanteId);
    if (d) d.segnalazioniFatte++;
    Store.emit('segnalazioni');
    return seg;
  },

  /** azione FM su una segnalazione: 'assegna_alternativo' | 'blocca_veicolo' |
      'rinvia_notifica' | 'risolvi' */
  gestisciSegnalazione(segId, azione, dettagli) {
    const seg = S.segnalazione(segId);
    if (!seg) return null;
    seg.aggiornataIlTs = Date.now();
    seg.azione = azione;

    if (azione === 'assegna_alternativo') {
      const pre = AppState.prenotazioni.find(p => p.stalloId === seg.stalloId && p.data === OGGI_ISO && p.stato === 'attiva');
      if (pre) {
        const alt = S.assegnaStalloAutomatico(pre.dipendenteId, OGGI_ISO);
        if (alt) { pre.stalloId = alt; seg.note.push('Stallo alternativo ' + alt + ' assegnato.'); }
      }
      seg.stato = 'risolta'; seg.risoltaIlTs = Date.now();
    }
    else if (azione === 'blocca_veicolo') {
      seg.note.push('Veicolo ' + (seg.targa || 'N/D') + ' segnalato come non autorizzato.');
      const acc = AppState.accessi.find(a => a.stalloId === seg.stalloId && a.uscita === null && a.stato === 'abusivo');
      if (acc) { acc.uscita = hhmm(new Date()); acc.stato = 'uscito'; }
      seg.stato = 'risolta'; seg.risoltaIlTs = Date.now();
    }
    else if (azione === 'rinvia_notifica') {
      seg.stato = 'in_gestione';
      seg.note.push('Seconda notifica inviata alle ' + hhmm(new Date()) + '.');
    }
    else if (azione === 'risolvi') {
      seg.stato = 'risolta'; seg.risoltaIlTs = Date.now();
    }
    if (dettagli) seg.note.push(dettagli);
    Store.emit('segnalazioni');
    return seg;
  },

  /* ---- HARDWARE ---- */
  aggiornaFirmware(hwId) {
    const h = S.dispositivo(hwId);
    if (!h) return null;
    const [maj, min, patch] = h.firmware.replace('v', '').split('.').map(Number);
    h.firmware = 'v' + maj + '.' + min + '.' + (patch + 1);
    h.ultimoEvento = 'Firmware aggiornato ' + hhmm(new Date());
    Store.emit('hardware');
    return h;
  },
  apriTicketHardware(hwId) {
    const h = S.dispositivo(hwId);
    if (!h) return null;
    h.ticket = 'TCK-' + String(rInt(1000, 9999));
    Store.emit('hardware');
    return h;
  },
  setHardwareToggle(chiave, valore) { AppState.config.hardware2n[chiave] = valore; Store.emit('config'); },

  /* ---- CONFIG ---- */
  setPolicy(patch) {
    Object.assign(AppState.config.prenotazioni, patch);
    /* la finestra si è ristretta → annulla le prenotazioni fuori finestra.
       `limite` e' ora INCLUSIVO: il confronto e' > e non >=. */
    const limite = toISO(S.ultimaDataPrenotabile());
    AppState.prenotazioni.forEach(p => { if (p.data > limite && p.stato === 'attiva') p.stato = 'annullata'; });
    /* riporta il dipendente sull'ultima settimana che contiene giorni ancora
       prenotabili, altrimenti resterebbe su una griglia tutta grigia */
    while (AppState.ui.empWeekOffset > 0 && !S.settimanaHaGiorniPrenotabili(AppState.ui.empWeekOffset)) {
      AppState.ui.empWeekOffset--;
    }
    Store.emit('config');
  },
  setNotifica(chiave, valore) { AppState.config.notifiche[chiave] = valore; Store.emit('config'); },

  /* ---- MODALITA' A TURNI (CODE-17A: infrastruttura, UI in CODE-17B) ---- */
  setModalitaPrenotazione(modalita) {
    AppState.config.modalitaPrenotazione = modalita;
    Store.emit('config');
  },
  setTurni(turniArray) {
    AppState.config.turni = turniArray;
    Store.emit('config');
  },
  setTolleranzaCambioTurno(minuti) {
    AppState.config.tolleranzaCambioTurnoMin = minuti;
    Store.emit('config');
  },
  /** Prenotazione con turno. NON duplica prenota(): la chiama e le aggiunge il
      turno, cosi' assegnazione dello stallo, sostituzione di una prenotazione
      esistente e chiusura degli accessi restano in un posto solo. */
  prenotaTurno({ dipendenteId, stalloId, giornoIso, turnoId }) {
    const p = A.prenota({ dipendenteId, dataISO: giornoIso, tipo: 'ufficio', stalloId });
    if (!p || p.errore) return p;
    p.turnoId = turnoId || null;
    Store.emit('prenotazioni');
    return p;
  },

  /* ---- destinatari delle notifiche segnalazioni ---- */
  addEmailDestinatario(email) {
    const e = (email || '').trim();
    const lista = AppState.config.notifiche.emailDestinatari;
    if (!e) return { errore: 'Inserisci un indirizzo email' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e)) return { errore: 'Indirizzo email non valido' };
    if (lista.includes(e)) return { errore: 'Destinatario gia presente' };
    /* Il tetto di 5 destinatari e' imposto dalla UI, che disabilita il bottone:
       un controllo anche qui sarebbe un ramo mai eseguito. */
    lista.push(e);
    Store.emit('config');
    return { ok: true, email: e };
  },
  removeEmailDestinatario(email) {
    const n = AppState.config.notifiche.emailDestinatari;
    AppState.config.notifiche.emailDestinatari = n.filter(e => e !== email);
    Store.emit('config');
  },

  /* ---- sede: personalizzabile per ogni demo cliente ---- */
  aggiornaSede(patch) {
    const p = Object.assign({}, patch);
    const posti = p.postiTotali;
    delete p.postiTotali;
    if (p.nome) { p.nomeBreve = p.nome.split('—').pop().trim() || p.nome; p.descrizione = p.nome; }
    Object.assign(AppState.config.sede, p);
    if (posti) A.impostaPostiTotali(parseInt(posti, 10));
    AppState.ui.editSede = false;
    Store.emit('config');
    return AppState.config.sede;
  },

  /** porta il totale stalli al valore richiesto agendo sulla prima zona standard */
  impostaPostiTotali(target) {
    if (!target || target < 1) return AppState.stalli.length;
    const zona = AppState.zone.find(z => z.tipoDefault === 'standard') || AppState.zone[0];
    if (!zona) return AppState.stalli.length;
    let delta = target - AppState.stalli.length;
    while (delta > 0) { A.aggiungiStallo({ zonaId: zona.id }); delta--; }
    while (delta < 0) {
      const rimovibili = AppState.stalli.filter(s => s.zonaId === zona.id);
      if (!rimovibili.length) break;
      const ultimo = rimovibili[rimovibili.length - 1];
      AppState.stalli = AppState.stalli.filter(s => s.id !== ultimo.id);
      AppState.prenotazioni.forEach(p => { if (p.stalloId === ultimo.id) { p.stalloId = null; p.stato = 'annullata'; } });
      delta++;
    }
    zona.posti = AppState.stalli.filter(s => s.zonaId === zona.id).length;
    return AppState.stalli.length;
  },

  toggleEditSede() { AppState.ui.editSede = !AppState.ui.editSede; Store.emit('nav'); },

  /** Riporta i dati allo stato iniziale SENZA ricaricare la pagina.
      AppState non viene sostituito ma riempito di nuovo: ogni modulo ne
      tiene un riferimento preso al load, quindi rimpiazzare l'oggetto
      lascerebbe le sezioni agganciate a dati morti.
      La sessione (ruolo, utente, vista) resta, a meno che l'utente loggato
      sia stato creato durante la demo: in quel caso non esiste piu' e si esce. */
  ripristinaDemo() {
    const d = costruisciDati();
    AppState.zone              = d.zone;
    AppState.stalli            = d.stalli;
    AppState.dipendenti        = d.dipendenti;
    AppState.prenotazioni      = d.prenotazioni;
    AppState.visitatori        = d.visitatori;
    AppState.segnalazioni      = d.segnalazioni;
    AppState.accessi           = d.accessi;
    AppState.hardware          = d.hardware;
    AppState.richiestePass     = d.richiestePass;
    AppState.config            = d.config;
    AppState.utentiPiattaforma = d.utentiPiattaforma;
    AppState.utenti.dipendenteDemoId = d.dipendenteDemoId;

    /* lo stato UI operativo va ripulito: filtri e selezioni puntano a id
       che non esistono piu'. Ruolo e utente restano. */
    AppState.ui.filtri = {
      accessi:    { q: '', tipo: '', stato: '', stallo: '', anomalia: false, aperto: false },
      dipendenti: { q: '' }
    };
    AppState.ui.selezione = {
      stalloId: null, dipendenteId: null, accessoId: null, visitatoreId: null,
      segnalazioneId: null, hardwareId: null, richiestaId: null, giornoISO: null,
      empTipoGiorno: 'ufficio'
    };
    AppState.ui.mapSelection = [];
    AppState.ui.fmWeekOffset = 0;
    AppState.ui.empWeekOffset = 0;
    AppState.ui.editSede = false;
    AppState.ui.attivazione = null;

    const utenteSopravvive = !!S.utenteCorrente();
    if (!utenteSopravvive) { A.logout(); return { ok: true, sessioneChiusa: true }; }
    Store.emit('ripristino');
    return { ok: true, sessioneChiusa: false };
  },
  setAnalyticsPeriodo(tipo) { AppState.ui.analyticsPeriodo = tipo; Store.emit('nav'); },
  setPeriodo(tipo) {
    const mappa = {
      oggi:      { dal: OGGI_ISO, al: OGGI_ISO, label: 'Oggi' },
      settimana: { dal: toISO(getMonday(OGGI)), al: toISO(addDays(getMonday(OGGI), 6)), label: 'Questa settimana' },
      mese:      { dal: toISO(new Date(OGGI.getFullYear(), OGGI.getMonth(), 1)), al: toISO(new Date(OGGI.getFullYear(), OGGI.getMonth() + 1, 0)), label: 'Questo mese' },
      trimestre: { dal: toISO(new Date(OGGI.getFullYear(), Math.floor(OGGI.getMonth() / 3) * 3, 1)), al: toISO(new Date(OGGI.getFullYear(), Math.floor(OGGI.getMonth() / 3) * 3 + 3, 0)), label: 'Trimestre corrente' }
    };
    AppState.config.periodo = Object.assign({ tipo }, mappa[tipo] || mappa.oggi);
    Store.emit('config');
  },
  setPeriodoManuale(dal, al) {
    AppState.config.periodo = { tipo: 'custom', dal, al, label: fmtDM(fromISO(dal)) + ' – ' + fmtDM(fromISO(al)) };
    Store.emit('config');
  },
  aggiungiAmministratore({ nome, ruolo, badge, email }) {
    AppState.config.referentiInterni.push({ id: nextId('REF'), nome, ruolo: ruolo || 'Viewer', badge: badge || 'Viewer', email });
    Store.emit('config');
  }
};

/* ==========================================================================
   6. STORE — pub/sub
   Ogni sezione registra una render function; ogni mutazione le richiama.
   È questo che soddisfa il requisito "coerenza inter-sezione".
========================================================================== */

const Store = {
  _subs: [],
  /** subscribe(fn) → unsubscribe() */
  subscribe(fn) { this._subs.push(fn); return () => { this._subs = this._subs.filter(f => f !== fn); }; },
  emit(motivo) { this._subs.forEach(fn => { try { fn(motivo, AppState); } catch (e) { console.error('[PC] render error', motivo, e); } }); },
  /** helper per mutazioni ad-hoc dalle sezioni, sempre notificate */
  mutate(fn, motivo) { const r = fn(AppState); this.emit(motivo || 'mutate'); return r; }
};

/* ==========================================================================
   EXPORT
========================================================================== */
global.PC = global.PC || {};
global.PC.State     = AppState;
global.PC.Selectors = S;
global.PC.Actions   = A;
global.PC.Store     = Store;
global.PC.Utils = {
  DAYS_IT, DAYS_FULL_IT, MONTHS_IT, MONTHS_SHORT,
  OGGI, OGGI_ISO,
  startOfDay, addDays, getMonday, toISO, fromISO,
  fmtShort, fmtMedium, fmtDM, hhmm, fmtDurata, fmtMinuti,
  iniziali, nextId, rInt, toCSV,
  isLavorativo, giorniLavorativi
};
global.PC.Domini = { TIPO_STALLO, DISPONIBILITA, STATO_STALLO, METODO_ACCESSO, TIPO_SEGNALAZIONE, DIPARTIMENTI, RUOLI, PERMISSIONS, STATO_ACCOUNT, TIPI_HW };

})(window);
