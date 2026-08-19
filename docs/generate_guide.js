/* ============================================================================
   Parking Cloud · FM Dashboard — generatore della Guida Funzionale
   ----------------------------------------------------------------------------
   Produce docs/PC_FM_Dashboard_Guida.docx a partire da quanto è realmente
   implementato in src/. Non descrive nulla che il codice non faccia.

   node docs/generate_guide.js
============================================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber, PageBreak, TableOfContents, convertInchesToTwip
} = require('docx');

/* ---- brand ------------------------------------------------------------- */
const BLU     = '1546D4';   // Palatinate Blue
const CIANO   = '30C5FF';   // Deep Sky
const NERO    = '0F0F0F';   // Night
const ALT     = 'F5F0F1';   // righe alternate
const BIANCO  = 'FFFFFF';
const BORDO   = 'D6D6D6';
const ROSSO   = 'EF4444';
const GRIGIO  = '6B6B6B';

const FONT = 'Calibri';

/* ---- helper di composizione -------------------------------------------- */
const p = (text, o = {}) => new Paragraph({
  spacing: { before: o.before !== undefined ? o.before : 60, after: o.after !== undefined ? o.after : 60, line: 276 },
  alignment: o.align || AlignmentType.LEFT,
  indent: o.indent,
  border: o.border,
  shading: o.shading,
  children: (Array.isArray(text) ? text : [text]).map(t =>
    typeof t === 'string'
      ? new TextRun({ text: t, font: FONT, size: (o.size || 11) * 2, color: o.color || NERO, bold: o.bold, italics: o.italics })
      : t)
});

const run = (text, o = {}) => new TextRun({
  text, font: FONT, size: (o.size || 11) * 2,
  color: o.color || NERO, bold: o.bold, italics: o.italics, break: o.break
});

/* I titoli DEVONO usare gli stili Word "Heading 1/2/3": l'indice raccoglie per
   stile, non per aspetto. Formattandoli a mano si ottiene un documento identico
   a vedersi e un indice vuoto. L'aspetto brand vive in styles.paragraphStyles. */
const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BLU, space: 6 } },
  children: [new TextRun({ text })]
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text })]
});

const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  children: [new TextRun({ text })]
});

/** Titolo con l'aspetto di un H1 ma SENZA stile Heading: serve alla pagina
    dell'indice, che altrimenti elencherebbe sé stessa come prima voce. */
const h1FuoriIndice = (text) => new Paragraph({
  spacing: { before: 320, after: 160 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BLU, space: 6 } },
  children: [new TextRun({ text, font: FONT, size: 36, bold: true, color: BLU })]
});

/** etichetta in maiuscoletto usata nelle schede di sezione (SCOPO, FLUSSI…) */
const label = (text) => new Paragraph({
  spacing: { before: 150, after: 40 },
  children: [new TextRun({ text, font: FONT, size: 19, bold: true, color: GRIGIO, characterSpacing: 20 })]
});

const bullet = (text, livello = 0) => new Paragraph({
  bullet: { level: livello },
  spacing: { before: 30, after: 30, line: 276 },
  children: (Array.isArray(text) ? text : [text]).map(t =>
    typeof t === 'string' ? new TextRun({ text: t, font: FONT, size: 22, color: NERO }) : t)
});

const numerato = (text, riferimento) => new Paragraph({
  numbering: { reference: riferimento, level: 0 },
  spacing: { before: 30, after: 30, line: 276 },
  children: (Array.isArray(text) ? text : [text]).map(t =>
    typeof t === 'string' ? new TextRun({ text: t, font: FONT, size: 22, color: NERO }) : t)
});

/** riquadro con barra laterale colorata */
const box = (righe, colore) => (Array.isArray(righe) ? righe : [righe]).map((r, i, arr) => new Paragraph({
  spacing: { before: i === 0 ? 140 : 0, after: i === arr.length - 1 ? 140 : 0, line: 264 },
  indent: { left: convertInchesToTwip(0.12) },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: colore, space: 10 } },
  children: (Array.isArray(r) ? r : [r]).map(t =>
    typeof t === 'string'
      ? new TextRun({ text: t, font: FONT, size: 20, italics: true, color: NERO })
      : t)
}));

const nota    = (righe) => box(righe, BLU);
const avviso  = (righe) => box(righe, ROSSO);

/* ---- tabelle ----------------------------------------------------------- */
const bordiTabella = {
  top:            { style: BorderStyle.SINGLE, size: 4, color: BORDO },
  bottom:         { style: BorderStyle.SINGLE, size: 4, color: BORDO },
  left:           { style: BorderStyle.SINGLE, size: 4, color: BORDO },
  right:          { style: BorderStyle.SINGLE, size: 4, color: BORDO },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: BORDO },
  insideVertical:   { style: BorderStyle.SINGLE, size: 4, color: BORDO }
};

function cella(contenuto, o = {}) {
  const testi = Array.isArray(contenuto) ? contenuto : [contenuto];
  return new TableCell({
    shading: o.shading ? { type: ShadingType.CLEAR, fill: o.shading, color: 'auto' } : undefined,
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    width: o.width ? { size: o.width, type: WidthType.PERCENTAGE } : undefined,
    children: testi.map((t, i) => new Paragraph({
      spacing: { before: i === 0 ? 0 : 40, after: 0, line: 252 },
      children: [new TextRun({
        text: String(t), font: FONT, size: (o.size || 9.5) * 2,
        bold: o.bold, color: o.color || NERO, italics: o.italics
      })]
    }))
  });
}

/** tabella con header blu e righe alternate */
function tabella(intestazioni, righe, larghezze) {
  const head = new TableRow({
    tableHeader: true,
    children: intestazioni.map((t, i) =>
      cella(t, { shading: BLU, color: BIANCO, bold: true, width: larghezze && larghezze[i] }))
  });
  const corpo = righe.map((r, idx) => new TableRow({
    children: r.map((c, i) =>
      cella(c, { shading: idx % 2 === 0 ? BIANCO : ALT, width: larghezze && larghezze[i] }))
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordiTabella,
    rows: [head].concat(corpo)
  });
}

/* ---- checklist --------------------------------------------------------- */
let TOTALE_CHECK = 0;

/** | # | Flusso | Passi | Risultato atteso | Esito | Note | */
function checklist(righe) {
  TOTALE_CHECK += righe.length;
  return tabella(
    ['#', 'Flusso', 'Passi sintetici', 'Risultato atteso', 'Esito', 'Note'],
    righe.map((r, i) => [String(i + 1), r[0], r[1], r[2], '[  ]', '']),
    [4, 16, 30, 32, 8, 10]
  );
}

/** tabella dei flussi cross-ruolo */
function checklistCross(righe) {
  TOTALE_CHECK += righe.length;
  return tabella(
    ['#', 'Flusso', 'Ruolo iniziale', 'Azione', 'Passa a', 'Cosa verificare', 'Esito'],
    righe.map((r, i) => [String(i + 1), r[0], r[1], r[2], r[3], r[4], '[  ]']),
    [4, 18, 11, 22, 11, 26, 8]
  );
}

/* ========================================================================== */
/*  COPERTINA                                                                 */
/* ========================================================================== */
const OGGI = new Date();
const DATA_IT = OGGI.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

const copertina = [
  new Paragraph({ spacing: { before: 2600, after: 0 }, children: [] }),
  new Paragraph({
    spacing: { before: 0, after: 500 },
    children: [
      new TextRun({ text: 'parking', font: FONT, size: 52, bold: true, color: NERO }),
      new TextRun({ text: 'CLOUD', font: FONT, size: 52, bold: true, color: BLU })
    ]
  }),
  new Paragraph({
    spacing: { before: 0, after: 90 },
    border: { top: { style: BorderStyle.SINGLE, size: 12, color: BLU, space: 14 } },
    children: [new TextRun({ text: 'FM Dashboard', font: FONT, size: 72, bold: true, color: NERO })]
  }),
  new Paragraph({
    spacing: { before: 0, after: 700 },
    children: [new TextRun({ text: 'Guida Funzionale e Piano di Test', font: FONT, size: 34, color: BLU })]
  }),
  new Paragraph({
    spacing: { before: 0, after: 140 },
    shading: { type: ShadingType.CLEAR, fill: ALT, color: 'auto' },
    indent: { left: convertInchesToTwip(0.12) },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: ROSSO, space: 10 } },
    children: [new TextRun({
      text: 'Documento interno — Uso riservato al team Parking Cloud',
      font: FONT, size: 21, bold: true, color: NERO
    })]
  }),
  new Paragraph({ spacing: { before: 900, after: 0 }, children: [
    run('Versione 1.0', { size: 11, bold: true }),
    run('Aggiornato al ' + DATA_IT, { size: 11, break: 1 }),
    run('Riferimento codice: blocchi CODE-01 → CODE-21', { size: 11, color: GRIGIO, break: 1 }),
    run('Demo: https://parkingcloud-fm-demo.netlify.app', { size: 11, color: BLU, break: 1 })
  ]}),
  new Paragraph({ children: [new PageBreak()] })
];

/* ========================================================================== */
/*  INDICE                                                                    */
/* ========================================================================== */
const indice = [
  h1FuoriIndice('Indice'),
  ...nota([
    'L’indice si aggiorna da solo all’apertura in Word. Se dopo una modifica i numeri di pagina '
    + 'non fossero allineati: clic destro sull’indice → "Aggiorna campo" → "Aggiorna intero sommario".'
  ]),
  new TableOfContents('Sommario', { hyperlinks: true, headingStyleRange: '1-3' }),
  new Paragraph({ children: [new PageBreak()] })
];

/* ========================================================================== */
/*  SEZIONE 1 — COS'È LA FM DASHBOARD                                         */
/* ========================================================================== */
const sezione1 = [
  h1('1. Cos’è la FM Dashboard'),

  h2('1.1 Obiettivo del prodotto'),
  p('La FM Dashboard è lo strumento con cui un Facility Manager governa un parcheggio '
    + 'aziendale: quanti posti esistono, chi li occupa in questo momento, chi li ha prenotati, '
    + 'chi è entrato e con quale metodo, quali problemi sono aperti e chi ha diritto ad accedere.'),
  p('Il problema che risolve è concreto: nei parcheggi aziendali i posti sono meno delle persone, '
    + 'l’assegnazione è storicamente fissa e quindi i posti dei dipendenti assenti restano vuoti '
    + 'mentre altri colleghi non trovano parcheggio. La dashboard rende il posto una risorsa '
    + 'prenotabile e ne rende visibile l’uso reale.'),
  ...nota([
    'La FM Dashboard è un prodotto B2B di gestione interna. È cosa diversa dall’app consumer B2C: '
    + 'qui non si vendono soste al pubblico, si amministra un parcheggio privato e la sua popolazione.'
  ]),
  p('Destinatari tipici: Facility Manager, HR e uffici tecnici di aziende con parcheggio interno, '
    + 'strutture ospedaliere e sanitarie che lavorano su turni, e in generale ogni organizzazione '
    + 'che debba distribuire un numero limitato di stalli fra più persone.'),

  h2('1.2 I tre ruoli'),
  p('Il prodotto è uno solo. Admin e Facility Manager usano la stessa identica interfaccia: '
    + 'ciò che cambia è unicamente quello che la matrice dei permessi abilita. Il Dipendente '
    + 'ha invece una vista dedicata.'),
  tabella(
    ['Ruolo', 'Chi è', 'Cosa vede', 'Cosa può fare'],
    [
      ['Admin',
        'Referente Parking Cloud che configura la piattaforma per il cliente',
        'Console FM completa, più la voce Amministrazione. Badge "Admin" nel topbar in alto a destra',
        'Tutto ciò che fa il FM, più: creare e disattivare utenti di piattaforma (Admin e FM), gestire i parcheggi, cambiare lo scenario demo, ripristinare i dati'],
      ['Facility Manager',
        'Chi gestisce quotidianamente il parcheggio del cliente',
        'Le stesse 10 sezioni operative, senza Amministrazione. Ruolo "Facility Manager" nel topbar',
        'Mappa e stalli, prenotazioni, accessi, segnalazioni, dipendenti, visitatori, hardware, policy, export'],
      ['Dipendente',
        'Chi usa il parcheggio',
        'Vista Dipendente dedicata: calendario, mappa in sola lettura, le proprie richieste',
        'Prenotare, dichiarare Smart Working, fare check-in e check-out, inviare segnalazioni, richiedere pass visitatore (se abilitato), gestire il profilo']
    ],
    [14, 22, 32, 32]
  ),
  h3('Accesso su invito'),
  p('Non esiste registrazione pubblica: nessuno crea da solo il proprio account. '
    + 'La catena è sempre la stessa e va in una sola direzione:'),
  bullet('Admin crea il Facility Manager dalla sezione Amministrazione → l’account nasce in stato "Invito inviato"'),
  bullet('Il FM crea i Dipendenti dalla sezione Dipendenti, singolarmente o con l’import di lista'),
  bullet('Ogni persona attiva il proprio account dal link ricevuto via email, scegliendo la password'),
  ...nota([
    'Nella demo il link di attivazione è riprodotto dai pulsanti "Simula attivazione": '
    + 'aprono la schermata di attivazione reale (view-activate), dove si imposta la password '
    + 'e si entra. Nessuna email viene realmente inviata.'
  ]),

  h2('1.3 Le due modalità operative'),
  p('Lo stesso prodotto copre due mercati che prenotano in modo diverso. La modalità si imposta '
    + 'in Configurazione e cambia il comportamento della prenotazione in tutte le sezioni.'),
  tabella(
    ['Aspetto', 'Modalità Uffici (giornaliera)', 'Modalità Ospedale (per turni)'],
    [
      ['Unità di prenotazione', 'Il giorno intero', 'Il singolo turno'],
      ['Turni configurati', 'Nessuno', 'Mattino 07:00–15:00 · Pomeriggio 15:00–23:00 · Notte 23:00–07:00'],
      ['Prenotazioni per persona al giorno', 'Una', 'Fino a "Max turni per dipendente" (default 3)'],
      ['Mappa Stalli', 'KPI su tutta la giornata', 'Selettore turno in cima, KPI riferiti al turno scelto'],
      ['Prenotazioni FM', 'Cella = una prenotazione', 'Cella = badge impilati, uno per turno, con "+" per aggiungerne'],
      ['Nuova prenotazione FM', 'Dipendente, data, tipo, stallo, fascia oraria', 'In più il campo Turno, obbligatorio: gli stalli proposti sono quelli liberi in quel turno'],
      ['Vista Dipendente', 'Click sul giorno → prenota o apre il dettaglio', 'Click sul giorno → scelta del turno; i turni già presi sono marcati'],
      ['Lista d’attesa', 'Non prevista', 'Su turno esaurito il dipendente può mettersi in coda'],
      ['Capacità dichiarata', 'Un posto per persona', 'Lo stesso stallo può servire più turni nella stessa giornata']
    ],
    [22, 39, 39]
  ),
  h3('Come si cambia modalità'),
  bullet('Scenario completo (dati + modalità): Admin → Amministrazione → tab Parcheggi → selettore scenario Uffici / Ospedale'),
  bullet('Sola modalità di prenotazione: Policy & Config → tab Policy → riquadro "Modalità Prenotazione"'),
  ...nota([
    'Il toggle di scenario sostituisce l’intero dataset in memoria (stalli, dipendenti, prenotazioni, '
    + 'accessi). Gli utenti di piattaforma sono invece condivisi fra i due scenari, così la sessione '
    + 'aperta sopravvive al cambio e non serve rifare il login.'
  ]),

  h2('1.4 Accesso alla demo'),
  p([run('Indirizzo: ', { bold: true }), run('https://parkingcloud-fm-demo.netlify.app', { color: BLU, bold: true })]),
  tabella(
    ['Ruolo', 'Email', 'Password'],
    [
      ['Admin', 'admin@parkingcloud.eu', 'Qualsiasi — già precompilata'],
      ['Facility Manager', 'manager@demo.parkingcloud.eu', 'Qualsiasi — già precompilata'],
      ['Dipendente', 'dipendente@demo.parkingcloud.eu', 'Qualsiasi — già precompilata']
    ],
    [22, 48, 30]
  ),
  ...nota([
    'Il ruolo si deduce dall’account, non si sceglie al login. La password non viene verificata: '
    + 'la demo non ha backend, quindi il campo è solo scenografico. I tre pulsanti "Account demo" '
    + 'sotto il form compilano l’email al posto tuo.'
  ]),
  ...avviso([
    'IMPORTANTE — Stessa tab obbligatoria',
    'Per vedere le modifiche tra FM e Dipendente in tempo reale, usare la STESSA tab del browser: '
    + 'eseguire logout, poi login con l’altro ruolo.',
    'Tab separate hanno AppState separati e non si sincronizzano — questo è un limite strutturale '
    + 'della demo statica, non un bug.'
  ]),
  h3('Dati della demo'),
  p('I dati nascono da un generatore pseudo-casuale con seme fisso: sono identici a ogni apertura, '
    + 'quindi due tester vedono gli stessi numeri e una demo davanti al cliente non riserva sorprese.'),
  tabella(
    ['Entità', 'Quantità nello scenario Uffici'],
    [
      ['Stalli', '156, distribuiti su 6 zone'],
      ['Dipendenti', '312 anagrafiche'],
      ['Prenotazioni', '~2.070 su storico e settimane future'],
      ['Accessi', '~1.550 record di log'],
      ['Visitatori', '140 pass fra oggi, programmati e storico'],
      ['Segnalazioni', '24, fra aperte, in gestione e risolte']
    ],
    [40, 60]
  ),
  new Paragraph({ children: [new PageBreak()] })
];

/* ========================================================================== */
/*  SEZIONE 2 — GUIDA FUNZIONALE                                              */
/* ========================================================================== */

/** scheda standard di una sezione della dashboard */
function scheda(titolo, dati) {
  const out = [h2(titolo)];
  out.push(label('SCOPO'));
  out.push(p(dati.scopo));
  out.push(label('COSA CONTIENE'));
  dati.contiene.forEach(x => out.push(bullet(x)));
  out.push(label('FLUSSI PRINCIPALI'));
  dati.flussi.forEach((f, i) => {
    out.push(p([run((i + 1) + '. ' + f.nome, { bold: true })], { before: 110, after: 30 }));
    f.passi.forEach(s => out.push(bullet(s, 1)));
  });
  out.push(label('LOGICA E REGOLE'));
  dati.regole.forEach(x => out.push(bullet(x)));
  out.push(label('COLLEGAMENTO AD ALTRE SEZIONI'));
  dati.collegamenti.forEach(x => out.push(bullet(x)));
  if (dati.note) out.push(...nota(dati.note));
  return out;
}

const sezione2 = [
  h1('2. Guida funzionale'),
  p('Ogni sottosezione descrive una voce della barra laterale, nell’ordine in cui compare. '
    + 'Il contenuto rispecchia esclusivamente ciò che il codice fa oggi.'),
  ...nota([
    'Principio che spiega metà dei comportamenti descritti qui: lo stato di uno stallo non è '
    + 'memorizzato, è calcolato al momento da prenotazioni, accessi e pass visitatore. '
    + 'Per questo una modifica in una sezione si riflette immediatamente in tutte le altre, '
    + 'senza alcuna sincronizzazione esplicita.'
  ]),

  ...scheda('2.1 Dashboard Live', {
    scopo: 'La schermata di apertura: in dieci secondi dice se il parcheggio sta funzionando e '
      + 'che cosa richiede attenzione adesso.',
    contiene: [
      'Cinque KPI cliccabili: Posti Totali, Liberi Ora, Occupati, Segnalazioni, Visitatori. Ognuno porta alla sezione corrispondente',
      'Mini-mappa per zona: una card per ciascuna delle 6 zone con posti liberi e occupati calcolati sul dato reale',
      'Card "Segnalazioni Aperte" con le voci attive e un pulsante "Gestisci" per riga',
      'In modalità turni compare anche la card "Lista attesa", con i dipendenti in coda per un turno esaurito'
    ],
    flussi: [
      { nome: 'Dalla panoramica al dettaglio', passi: [
        'Il KPI "Posti Totali" o "Liberi Ora" porta alla Mappa Stalli',
        'Il KPI "Occupati" porta al log Accessi',
        'Il KPI "Segnalazioni" porta alla sezione Segnalazioni',
        'Il KPI "Visitatori" porta alla sezione Visitatori'
      ]},
      { nome: 'Ispezione di una zona', passi: [
        'Click su una card della mini-mappa',
        'La zona viene selezionata e si apre la Mappa Stalli su quella zona'
      ]},
      { nome: 'Gestione rapida di una segnalazione', passi: [
        'Click su "Gestisci" nella riga della segnalazione',
        'Si apre il modale della segnalazione con azione correttiva proposta',
        'Confermando, la segnalazione esce dall’elenco delle attive e il badge in barra laterale si aggiorna'
      ]}
    ],
    regole: [
      'I KPI leggono sempre lo stato calcolato: non esistono numeri memorizzati e quindi non possono divergere dalla mappa',
      'Il conteggio dei visitatori considera solo i pass attivi in questo momento',
      'La card lista d’attesa compare unicamente in modalità turni: in giornaliera una coda non avrebbe significato'
    ],
    collegamenti: [
      'Legge da Mappa Stalli, Accessi, Segnalazioni e Visitatori: è una vista, non una fonte di dati',
      'Assegnare uno stallo dalla lista d’attesa crea una prenotazione reale, visibile in Prenotazioni e in Mappa'
    ]
  }),

  ...scheda('2.2 Mappa Stalli', {
    scopo: 'La rappresentazione fisica del parcheggio: dove sono i posti, come stanno adesso, '
      + 'e il punto da cui si modificano.',
    contiene: [
      '156 stalli su 6 zone (A, B, C, V visitatori, EV ricarica, H disabili), colorati per stato',
      'Cinque KPI: Posti Totali, Liberi, Occupati, EV, Disabili. In modalità turni diventano KPI del turno selezionato',
      'Legenda dei colori e barra di modifica multipla',
      'Pulsante "+ Aggiungi Stallo"',
      'Modale di dettaglio stallo con tipo, disponibilità, titolare, durata massima e note'
    ],
    flussi: [
      { nome: 'Modifica di un singolo stallo', passi: [
        'Click sullo stallo → si apre il modale con i dati di quello stallo',
        'Si modificano tipo, disponibilità, titolare, durata o note',
        'Salva → la mappa si aggiorna immediatamente, senza ricaricare la pagina'
      ]},
      { nome: 'Modifica multipla', passi: [
        'Ctrl+Click su più stalli → ognuno riceve un contorno blu',
        'Compare la barra di modifica multipla',
        '"Applica a selezionati" propaga la modifica a tutti gli stalli scelti'
      ]},
      { nome: 'Aggiunta di uno stallo', passi: [
        'Click su "+ Aggiungi Stallo"',
        'Si sceglie la zona: il codice viene proposto automaticamente in base a quelli esistenti',
        'Conferma → lo stallo compare in mappa e il totale posti aumenta ovunque'
      ]}
    ],
    regole: [
      'Lo stato dello stallo è derivato: libero, prenotato, occupato, violazione, manutenzione o bloccato dipendono da prenotazioni, accessi e pass, non da un campo salvato',
      'Il codice del nuovo stallo segue la numerazione della zona: non si può creare un duplicato',
      'In modalità turni lo stato è relativo al turno selezionato: lo stesso stallo può essere libero nel pomeriggio e occupato al mattino',
      'Una prenotazione senza turno occupa lo stallo per tutti i turni della giornata'
    ],
    collegamenti: [
      'Aggiungere o togliere uno stallo cambia il KPI "Posti Totali" in Dashboard, Prenotazioni e Configurazione',
      'La zona dello stallo determina il metodo di accesso e quindi la modalità di check-in del dipendente',
      'Le zone si creano e si rimuovono da Policy & Config, non da qui'
    ]
  }),

  ...scheda('2.3 Accessi', {
    scopo: 'Il registro di chi è entrato e uscito: la fonte di verità quando si deve ricostruire '
      + 'un episodio o dimostrare un’anomalia.',
    contiene: [
      'KPI del periodo selezionato: accessi totali con distinzione dipendenti/visitatori, presenti ora, anomalie',
      'Pannello filtri: ricerca libera, tipo, stato, stallo, solo anomalie, e un pulsante "✕ Azzera"',
      'Tabella paginata a 20 righe con Persona, Tipo, Stallo, Ingresso, Uscita, Metodo, Stato',
      'Modale di dettaglio del singolo accesso'
    ],
    flussi: [
      { nome: 'Ricerca di un accesso', passi: [
        'Click su "Filtra" per aprire il pannello',
        'Si combinano i filtri: persona, tipo, stato, stallo',
        '"✕ Azzera" riporta la tabella a tutti i record'
      ]},
      { nome: 'Analisi di un’anomalia', passi: [
        'Il KPI "Anomalie" apre direttamente la sezione con il filtro anomalie già attivo',
        'Le righe anomale sono evidenziate',
        'Click sulla riga → dettaglio dell’accesso, con metodo e durata'
      ]},
      { nome: 'Consultazione dello storico', passi: [
        'Si cambia il periodo dal selettore in alto a destra',
        'KPI e tabella si ricalcolano sul periodo scelto',
        'La paginazione permette di scorrere l’intero registro'
      ]}
    ],
    regole: [
      'La colonna Metodo mostra il metodo di accesso della zona dello stallo, non un attributo della persona',
      'Un accesso è "dentro" finché non ha un’uscita registrata',
      'Le anomalie riconosciute sono: durata eccessiva, zona errata e occupazione abusiva',
      'Il filtro e la paginazione vivono nello stato dell’interfaccia: cambiando sezione e tornando indietro restano attivi'
    ],
    collegamenti: [
      'Gli accessi aperti concorrono a determinare lo stato degli stalli in Mappa',
      'Il check-in del dipendente genera o aggiorna la riga di accesso corrispondente',
      'Le anomalie di durata possono generare automaticamente una segnalazione'
    ],
    note: ['In produzione il metodo andrà registrato al momento dell’accesso, non derivato dalla zona: '
      + 'oggi cambiare il varco di una zona riscrive il metodo mostrato anche sullo storico.']
  }),

  ...scheda('2.4 Prenotazioni', {
    scopo: 'La griglia settimanale che dice chi ha un posto e quando: il cuore della '
      + 'redistribuzione degli stalli.',
    contiene: [
      'KPI del giorno: prenotazioni in ufficio, Smart Working, stalli liberi',
      'Griglia settimanale con una riga per dipendente e cinque colonne (lunedì–venerdì), paginata a 20 righe',
      'Navigazione settimane: "‹", "Oggi", "›"',
      'Ricerca dipendente condivisa con la sezione Dipendenti',
      'Pulsanti "+ Prenota" ed esportazione',
      'In modalità turni: card "Capacità per turno" con prenotati, liberi e percentuale di occupazione'
    ],
    flussi: [
      { nome: 'Creazione di una prenotazione', passi: [
        'Click su una cella libera oppure su "+ Prenota"',
        'Si scelgono dipendente, data, tipo (ufficio o Smart Working), stallo e fascia oraria',
        'In modalità turni si sceglie anche il turno, obbligatorio: gli stalli proposti sono quelli liberi in quel turno',
        'Conferma → la prenotazione compare nella griglia'
      ]},
      { nome: 'Modifica di una prenotazione esistente', passi: [
        'Click su una cella già prenotata → si apre il dettaglio, non la creazione',
        'Gli orari mostrati sono quelli reali della prenotazione',
        '"Aggiorna orari" salva mantenendo stessa prenotazione, stesso stallo ed eventuale check-in',
        '"Sostituisci prenotazione" è l’operazione diversa: ricrea, e può riassegnare lo stallo'
      ]},
      { nome: 'Doppio turno (solo modalità ospedale)', passi: [
        'Nella cella compaiono i badge dei turni già prenotati, impilati',
        'Il "+" sotto i badge aggiunge un altro turno, finché il tetto lo consente',
        'Ogni badge apre il dettaglio del proprio turno'
      ]}
    ],
    regole: [
      'In modalità giornaliera una nuova prenotazione sostituisce quella esistente per quel giorno',
      'In modalità turni la prenotazione si aggiunge; sono respinti il turno duplicato, la sovrapposizione oraria e il superamento del tetto "Max turni per dipendente"',
      'L’ora di fine deve essere successiva all’ora di inizio',
      'La griglia mostra sempre una sola riga per dipendente, anche con più turni',
      'Un pallino nella cella indica se la persona è entrata (verde) o già uscita (grigio)',
      'La finestra di prenotazione configurata limita le date accettate'
    ],
    collegamenti: [
      'Ogni prenotazione occupa uno stallo nella Mappa e incide sui KPI di Dashboard e Analytics',
      'Le prenotazioni create dal dipendente compaiono qui senza alcuna sincronizzazione esplicita',
      'Sospendere un dipendente dalla sezione Dipendenti annulla le sue prenotazioni future'
    ]
  }),

  ...scheda('2.5 Segnalazioni', {
    scopo: 'Il canale con cui i problemi arrivano al Facility Manager e il registro di come '
      + 'sono stati chiusi.',
    contiene: [
      'Quattro KPI: aperte, in gestione, risolte, utenti bloccati',
      'Card "Segnalazioni Attive" con tipo, descrizione, segnalante, targa ed eventuale rimando all’originale',
      'Card "Utenti Bloccati" con motivo, data e pulsante di sblocco',
      'Card "Storico risolte": tutte le risolte, con esito, motivazione, durata del ripristino e segnalazioni collegate',
      'Modale di gestione con azione correttiva proposta'
    ],
    flussi: [
      { nome: 'Gestione e chiusura', passi: [
        'Click su "Gestisci" nella segnalazione attiva',
        'Si sceglie l’azione correttiva proposta dal sistema',
        'Conferma → la segnalazione passa a risolta, sparisce dalle attive e il badge in barra laterale scende'
      ]},
      { nome: 'Sblocco di un utente', passi: [
        'Nella card "Utenti Bloccati", click su "Sblocca"',
        'Si indicano la motivazione e la durata del ripristino',
        'Conferma → l’utente torna attivo e la segnalazione collegata si chiude con esito "Utente sbloccato"'
      ]},
      { nome: 'Segnalazione collegata', passi: [
        'Da una segnalazione risolta si può aprire una segnalazione collegata',
        'Si apre un modale di conferma precompilato: nulla viene scritto finché non si conferma',
        'Confermando nasce una nuova segnalazione con il rimando all’originale, visibile da entrambe le parti'
      ]}
    ],
    regole: [
      'I tipi riconosciuti sono generati dal codice, non digitati a mano: occupazione abusiva, zona errata, sosta prolungata, danno, altro',
      'Il superamento della soglia di violazioni configurata porta al blocco automatico dell’accesso',
      'Una sosta oltre la soglia di durata configurata genera una segnalazione automatica, una sola per prenotazione',
      'Lo storico mostra tutte le risolte, ordinate dalla più recente, e ogni riga è apribile'
    ],
    collegamenti: [
      'Le segnalazioni inviate dal dipendente arrivano qui',
      'Il blocco di un utente si riflette nella sezione Dipendenti',
      'La risoluzione di una segnalazione di zona errata può chiudere anche la posizione del visitatore collegato',
      'Il badge in barra laterale conta le segnalazioni non ancora risolte'
    ]
  }),

  ...scheda('2.6 Analytics', {
    scopo: 'La lettura nel tempo: quanto è usato il parcheggio, dove si concentra la domanda '
      + 'e come si sta muovendo rispetto al periodo precedente.',
    contiene: [
      'Cinque KPI con variazione rispetto al periodo precedente',
      'Selettore Settimana / Mese',
      'Grafico dell’occupazione: barre per giorno in vista settimanale, per settimana in vista mensile',
      'Distribuzione per zona, coerente con la mini-mappa della Dashboard',
      'Top 5 stalli per utilizzo',
      'Tabella di confronto con il periodo precedente'
    ],
    flussi: [
      { nome: 'Cambio di periodo', passi: [
        'Click su "Settimana" o "Mese"',
        'KPI, grafico e tabella si ricalcolano insieme'
      ]},
      { nome: 'Lettura della distribuzione', passi: [
        'La distribuzione per zona indica dove si concentra la domanda',
        'La Top 5 stalli individua i posti più contesi'
      ]}
    ],
    regole: [
      'I valori sono deterministici: non cambiano a ogni ricaricamento',
      'I dati derivano dalle stesse collezioni delle altre sezioni, quindi una prenotazione nuova si riflette anche qui'
    ],
    collegamenti: [
      'Legge prenotazioni, accessi e stalli: è una vista di sintesi, non una fonte',
      'La distribuzione per zona deve coincidere con la mini-mappa della Dashboard'
    ]
  }),

  ...scheda('2.7 Dipendenti', {
    scopo: 'L’anagrafica di chi ha diritto ad accedere al parcheggio, e il punto da cui si '
      + 'invitano, si modificano e si sospendono le persone.',
    contiene: [
      'Quattro KPI: autorizzati, app attiva, bloccati, pool rotante',
      'Tabella paginata a 20 righe con Nome, Dipartimento, Stallo, Accesso, Caratteristiche, Pass visitatore, Stato',
      'Ricerca per nome o per stallo, condivisa con la griglia Prenotazioni',
      'Pulsanti "+ Aggiungi Dipendente", "Importa Dipendenti" ed esportazione',
      'Banner delle richieste di pass visitatore in attesa, con pulsante "Approva"',
      'Modale di dettaglio con modifica, invio pass e sospensione'
    ],
    flussi: [
      { nome: 'Inserimento di un dipendente', passi: [
        'Click su "+ Aggiungi Dipendente"',
        'Si compilano nome, email, dipartimento, caratteristiche ed eventuale stallo fisso',
        'Conferma → l’account nasce in stato "Invito inviato"',
        '"Simula attivazione" apre la schermata di attivazione: si sceglie la password e si entra'
      ]},
      { nome: 'Import di una lista', passi: [
        'Click su "Importa Dipendenti"',
        'Si sceglie il file e si conferma',
        'L’import simulato aggiunge le righe previste e le mostra in elenco'
      ]},
      { nome: 'Approvazione di una richiesta di pass', passi: [
        'Il banner in cima segnala la richiesta inviata da un dipendente',
        'Click su "Approva" → si apre il modale con i dati del visitatore',
        'Conferma → il pass viene creato e diventa visibile nella sezione Visitatori'
      ]},
      { nome: 'Sospensione', passi: [
        'Dal dettaglio del dipendente, "Sospendi"',
        'Le prenotazioni future vengono annullate e il conteggio compare nel messaggio di conferma'
      ]}
    ],
    regole: [
      'La colonna "Accesso" mostra il metodo derivato dalla zona dello stallo assegnato: un dipendente sospeso resta segnato come tale a prescindere dal metodo',
      'Il flag "può richiedere pass" è per singolo dipendente e governa la comparsa del pulsante nella Vista Dipendente',
      'La ricerca filtra realmente i dati, non nasconde righe già disegnate',
      'Il banner delle richieste vive in questa sezione, non in Visitatori: la richiesta riguarda una persona interna'
    ],
    collegamenti: [
      'Lo stallo fisso assegnato qui è il primo candidato nell’assegnazione automatica delle prenotazioni',
      'Il blocco di un dipendente nasce dalle Segnalazioni e si vede qui',
      'L’approvazione di un pass crea un visitatore nella sezione Visitatori e una notifica per il dipendente'
    ]
  }),

  ...scheda('2.8 Visitatori', {
    scopo: 'La gestione degli ospiti: chi entra oggi, con quale pass, per quanto tempo, '
      + 'e che cosa gli viene consegnato per accedere.',
    contiene: [
      'KPI dei pass del periodo, fra cui gli attivi in questo momento',
      'Tabella dei visitatori del giorno e tabella dei pass programmati',
      'Pulsante "+ Nuovo Pass" ed esportazione',
      'Modale di dettaglio con contenuto del pass, periodo di validità modificabile, revoca ed estensione'
    ],
    flussi: [
      { nome: 'Creazione di un pass', passi: [
        'Click su "+ Nuovo Pass"',
        'Si compilano nome, email, azienda, data, fascia oraria e referente interno',
        'Il riquadro in fondo anticipa che cosa riceverà il visitatore, in base al varco della zona visitatori',
        'Conferma → il pass compare in elenco e lo stallo viene assegnato'
      ]},
      { nome: 'Gestione del periodo', passi: [
        'Click sulla riga → dettaglio del pass',
        'Si possono anticipare la data e l’ora di inizio, oltre che posticipare la fine',
        '"Aggiorna periodo" salva; la data di fine non può precedere quella di inizio'
      ]},
      { nome: 'Visitatore in zona errata', passi: [
        'Il pass segnalato mostra l’avviso in cima al modale',
        'Si sceglie l’azione: notifica al referente, riassegnazione a uno stallo corretto, oppure revoca',
        'Applicando l’azione la segnalazione di zona collegata si chiude'
      ]}
    ],
    regole: [
      'Il contenuto del pass dipende dal metodo di accesso della zona in cui il visitatore riceve lo stallo, che per i pass è la zona visitatori: codice numerico con keypad o locker, stringa QR con lettore QR, ricevuta senza codice in tutti gli altri casi',
      'Il tipo di pass viene congelato al momento dell’emissione: cambiare in seguito il varco della zona non trasforma un pass già consegnato',
      'Un pass senza stallo assegnato non blocca la creazione: usa il metodo della zona visitatori, o il più diffuso se quella zona non esiste più',
      'Su un pass di più giorni lo stallo deve risultare libero per l’intero periodo',
      'Lo stato del visitatore è calcolato dal periodo, ma le decisioni esplicite del FM — arrivato, uscito, revocato — prevalgono sul calendario'
    ],
    collegamenti: [
      'I pass occupano stalli reali nella zona visitatori e compaiono in Mappa',
      'Le richieste approvate dalla sezione Dipendenti generano i pass che si vedono qui',
      'Il contenuto del pass è governato dalla configurazione della zona in Policy & Config e mostrato in Hardware'
    ]
  }),

  ...scheda('2.9 Hardware', {
    scopo: 'La descrizione dell’impianto: quali barriere esistono e in che modo si superano, '
      + 'zona per zona.',
    contiene: [
      'Quattro KPI: barriere online, in configurazione, anomalie, cicli di oggi',
      'Card "Barriere di accesso": tipo, zona, stato, note, con "+ Aggiungi barriera"',
      'Card "Modalità di accesso per zona": zona, metodo, livello di intervento, check-in, check-out',
      'Card di configurazione con firmware, codice temporaneo visitatori, log accessi e integrazione HR'
    ],
    flussi: [
      { nome: 'Ispezione di una barriera', passi: [
        'Click sulla riga → dettaglio con IP, firmware, cicli, ultimo evento',
        'La riga "Come si supera" riporta il metodo della zona protetta',
        '"Aggiorna firmware" incrementa la versione; su una barriera in anomalia compare "Apri ticket"'
      ]},
      { nome: 'Aggiunta e rimozione', passi: [
        '"+ Aggiungi barriera" → si scelgono tipo, zona protetta e note',
        'La nuova barriera compare in tabella',
        'Dal dettaglio, "Rimuovi" la elimina'
      ]}
    ],
    regole: [
      'Barriera e metodo di accesso sono due cose distinte: la barriera è l’ostacolo fisico, il metodo appartiene alla zona e si configura in Policy & Config',
      'Il livello di intervento riassume quanto deve fare la persona: Automatico (ANPR), Azione rapida (QR, Bluetooth, badge), Manuale (PIN, guardiano, telecomando, locker, prossimità, libero, app)',
      'Il check-out manuale dall’app resta sempre disponibile come ripiego, per ogni metodo',
      'Il check-out automatico oggi è previsto solo per il riconoscimento targa'
    ],
    collegamenti: [
      'Il metodo della zona determina la modalità di check-in mostrata al dipendente e il contenuto del pass visitatore',
      'La colonna Metodo del log Accessi legge la stessa configurazione',
      'Il conteggio delle barriere online compare sotto il logo in barra laterale'
    ]
  }),

  ...scheda('2.10 Policy & Config', {
    scopo: 'Il pannello che governa il comportamento di tutto il resto: zone, regole di '
      + 'prenotazione, notifiche e accessi degli utenti.',
    contiene: [
      'Tab Parcheggio: informazioni sede modificabili, zone e posti con il metodo di accesso, tipologie di stallo',
      'Tab Policy: modalità di prenotazione, turni, finestra di prenotazione, no-show, durata massima, EV, Smart Working, violazioni',
      'Tab Notifiche: destinatari e singoli avvisi attivabili',
      'Tab Utenti & Accessi: matrice dei permessi consultabile'
    ],
    flussi: [
      { nome: 'Modifica delle informazioni sede', passi: [
        'Tab Parcheggio → card "Informazioni sede"',
        'Si modificano nome, nome breve e indirizzo',
        'Salva → topbar, barra laterale ed export si aggiornano insieme'
      ]},
      { nome: 'Gestione delle zone', passi: [
        '"+ Aggiungi" crea una zona; il campo posti crea o rimuove stalli reali',
        'Il selettore del metodo assegna il varco della zona',
        '"Salva Zone e Aggiorna Mappa" applica le modifiche alla mappa'
      ]},
      { nome: 'Modifica delle policy', passi: [
        'Tab Policy → "Modifica" nella card Prenotazioni',
        'Si impostano finestra, no-show, durate, soglia violazioni e massimo turni per dipendente',
        'Salva → le regole si applicano subito, anche alla Vista Dipendente'
      ]}
    ],
    regole: [
      'La finestra di prenotazione è espressa in giorni lavorativi, oggi incluso: restringerla annulla le prenotazioni che cadono fuori',
      'Il metodo di accesso appartiene alla zona ed è ereditato da tutti i suoi stalli',
      'Il massimo turni per dipendente accetta valori da 1 a 5 e ha effetto solo in modalità turni',
      'La riduzione dei posti di una zona richiede una conferma esplicita quando comporta la rimozione di stalli'
    ],
    collegamenti: [
      'Le zone definite qui governano Mappa, prenotazioni, pass visitatore e Hardware',
      'La finestra di prenotazione determina che cosa il dipendente vede come prenotabile',
      'La soglia violazioni governa il blocco automatico gestito in Segnalazioni'
    ]
  }),

  ...scheda('2.11 Esporta Report', {
    scopo: 'Portare fuori i dati per una riunione, un’analisi o un archivio.',
    contiene: [
      'Cinque tipi di export: Log Accessi, Prenotazioni, Segnalazioni & Violazioni, Visitatori, Report Completo su quattro fogli',
      'Indicazione del numero di record per ciascun tipo',
      'Periodo, ereditato dal selettore in alto a destra',
      'Pulsante "⬓ Scarica Excel"'
    ],
    flussi: [
      { nome: 'Generazione di un export', passi: [
        'Apertura dalla barra laterale o dalle icone di sezione',
        'Si sceglie il tipo di report',
        '"Scarica Excel" genera e scarica un file .xlsx reale'
      ]}
    ],
    regole: [
      'Il formato disponibile è solo Excel: è l’unico che la demo produce davvero senza backend',
      'Il contenuto rispetta il periodo selezionato',
      'L’export dei visitatori riporta anche il codice di accesso, il QR e il tipo di pass'
    ],
    collegamenti: [
      'Legge le stesse collezioni delle sezioni operative',
      'Il nome della sede impostato in Configurazione compare nell’export'
    ],
    note: ['La generazione del file usa una libreria caricata da rete: senza connessione a Internet '
      + 'l’export non si completa.']
  }),

  ...scheda('2.12 Amministrazione (solo Admin)', {
    scopo: 'La configurazione della piattaforma per il cliente: chi la amministra e quali '
      + 'parcheggi contiene.',
    contiene: [
      'Quattro KPI: utenti di piattaforma, Admin, Facility Manager, inviti in attesa',
      'Tab Utenti & Ruoli: tabella con nome, email, ruolo, sede, stato, ultimo accesso',
      'Tab Parcheggi: dati della sede, selettore dello scenario demo, ripristino dei dati',
      'Modale di dettaglio utente e "+ Aggiungi"'
    ],
    flussi: [
      { nome: 'Creazione di un Facility Manager', passi: [
        'Tab Utenti & Ruoli → "+ Aggiungi"',
        'Si compilano nome, email e ruolo',
        'Conferma → l’utente compare con stato "Invito inviato"',
        '"Simula attivazione" apre la schermata di attivazione e consente l’accesso come FM'
      ]},
      { nome: 'Cambio di scenario', passi: [
        'Tab Parcheggi → selettore Uffici / Ospedale',
        'L’intero dataset viene sostituito e la modalità di prenotazione cambia di conseguenza'
      ]},
      { nome: 'Ripristino dei dati demo', passi: [
        'Tab Parcheggi → "Ripristina dati demo"',
        'Si conferma nel modale dedicato',
        'I dati tornano allo stato iniziale'
      ]}
    ],
    regole: [
      'La sezione compare solo se il permesso amministrazione è attivo, quindi solo per l’Admin',
      'Gli utenti di piattaforma sono condivisi fra i due scenari: cambiare scenario non fa perdere la sessione',
      'La riduzione dei posti totali della sede chiede conferma prima di rimuovere stalli'
    ],
    collegamenti: [
      'Il nome della sede si può cambiare anche da Policy & Config: è lo stesso dato',
      'Il cambio di scenario si riflette su tutte le sezioni operative e sulla Vista Dipendente'
    ]
  }),

  ...scheda('2.13 Vista Dipendente', {
    scopo: 'Ciò che vede chi il parcheggio lo usa: prenotare, entrare, uscire, segnalare.',
    contiene: [
      'Riquadro di benvenuto con stallo assegnato, dipartimento, segnalazioni in corso, notifiche sui pass e finestra di prenotazione',
      'Navigazione settimanale e griglia dei cinque giorni lavorativi',
      'Blocco di check-in modellato sul metodo della zona, con timer una volta entrati',
      'Mappa del parcheggio in sola lettura con il proprio stallo evidenziato',
      'Elenco "Le mie prenotazioni" e sezione "Le mie richieste" a due o tre tab',
      'Pulsanti "Richiedi Pass" (se abilitato), "Segnala", profilo e uscita'
    ],
    flussi: [
      { nome: 'Prenotazione di un giorno', passi: [
        'Click su un giorno libero della griglia',
        'Si sceglie fra ufficio e Smart Working; in modalità turni si sceglie il turno',
        'Lo stallo viene assegnato automaticamente secondo la priorità dichiarata a schermo',
        'Conferma → il giorno diventa prenotato'
      ]},
      { nome: 'Check-in e check-out', passi: [
        'Sul giorno prenotato compare il blocco di accesso, diverso a seconda del varco della zona',
        'Con ANPR non serve fare nulla: resta comunque un ripiego manuale',
        'Con QR, Bluetooth o badge si conferma di aver effettuato l’accesso; con QR compare il codice della prenotazione',
        'Con PIN, guardiano o simili si preme il pulsante di check-in; con guardiano si può mostrare la prenotazione',
        'Dopo il check-in compaiono il tempo trascorso e il check-out'
      ]},
      { nome: 'Richiesta di un pass visitatore', passi: [
        'Click su "Richiedi Pass" (visibile solo se il FM ha abilitato il dipendente)',
        'Si indicano nome, email, azienda e intervallo di date',
        'La richiesta arriva al FM; l’esito compare in "Le mie richieste" con il contenuto del pass'
      ]},
      { nome: 'Segnalazione di un problema', passi: [
        'Click su "Segnala"',
        'Si scelgono il tipo e la descrizione',
        'La segnalazione compare immediatamente nella sezione Segnalazioni del FM'
      ]}
    ],
    regole: [
      'La finestra di prenotazione riflette la configurazione del FM ed è espressa in giorni lavorativi',
      'La settimana precedente non è navigabile: si prenota in avanti',
      'Il giorno corrente è evidenziato con un contrassegno e un bordo più marcato quando è prenotato',
      'In modalità giornaliera un giorno già prenotato apre il dettaglio; in modalità turni riapre la scelta del turno, così da poter aggiungere il secondo',
      'Dichiarare Smart Working libera lo stallo per gli altri',
      'Dal dettaglio si possono anticipare o posticipare gli orari, con il vincolo che la fine segua l’inizio'
    ],
    collegamenti: [
      'Ogni prenotazione compare nella griglia Prenotazioni del FM e occupa uno stallo in Mappa',
      'Il check-in genera una riga nel log Accessi',
      'Le segnalazioni inviate arrivano nella sezione Segnalazioni',
      'Le richieste di pass arrivano nel banner della sezione Dipendenti'
    ]
  }),
  new Paragraph({ children: [new PageBreak()] })
];

/* ========================================================================== */
/*  SEZIONE 3 — PIANO DI TEST                                                 */
/* ========================================================================== */
const sezione3 = [
  h1('3. Piano di test'),

  h2('3.1 Come usare questo piano'),
  bullet('Usare Chrome o Safari aggiornati. La demo è pensata per desktop.'),
  bullet('Per i flussi che coinvolgono due ruoli, restare nella STESSA tab: logout, poi login con l’altro ruolo.'),
  bullet('Non ricaricare la pagina durante una sequenza di test: il ricaricamento riporta i dati allo stato iniziale.'),
  bullet('Compilare la colonna Esito con ✓ oppure ✗, e usare Note per ogni scostamento.'),
  bullet('Segnalare i problemi con il formato della Sezione 6. Prima di aprire una segnalazione, verificare che non sia una limitazione nota della Sezione 5.'),
  ...nota([
    'Il ricaricamento della pagina è il modo più rapido per ripartire da zero: i dati sono generati '
    + 'con un seme fisso, quindi tornano identici. In alternativa: Admin → Amministrazione → Parcheggi → "Ripristina dati demo".'
  ]),

  h2('3.2 Checklist Admin'),
  checklist([
    ['Login Admin', 'Aprire la demo → "Admin" fra gli account demo → Accedi', 'Si apre la console FM; nel topbar in alto a destra compare il badge "Admin"'],
    ['Voce Amministrazione', 'Osservare la barra laterale', 'La voce "Amministrazione" è presente nel gruppo Sistema'],
    ['Navigazione completa', 'Cliccare tutte le voci della barra laterale', 'Ogni sezione carica il proprio contenuto, nessuna resta vuota'],
    ['Tab orizzontali', 'Cliccare le tab in alto', 'Restano allineate alla barra laterale'],
    ['KPI Amministrazione', 'Aprire Amministrazione', 'Quattro KPI: utenti piattaforma, Admin, Facility Manager, inviti in attesa'],
    ['Tabella utenti piattaforma', 'Tab Utenti & Ruoli', 'Elenco con nome, email, ruolo, sede, stato, ultimo accesso'],
    ['Dettaglio utente', 'Click su "Dettaglio" di un utente', 'Si apre il modale con i dati di quell’utente'],
    ['Creazione FM', '"+ Aggiungi" → nome, email, ruolo FM → conferma', 'Il nuovo FM compare in elenco con stato "Invito inviato"'],
    ['Attivazione simulata', 'Click su "Simula attivazione" sul FM appena creato', 'Si apre la schermata di attivazione; impostando la password si accede come FM'],
    ['Disattivazione utente', 'Interruttore di stato su un utente', 'Lo stato cambia e resta coerente in tabella'],
    ['Reinvio invito', 'Click su "Reinvia invito" su un invito in attesa', 'Compare il messaggio di conferma'],
    ['Tab Parcheggi', 'Aprire la tab Parcheggi', 'Si vedono i dati della sede e i comandi di scenario'],
    ['Modifica sede da Admin', 'Modificare nome e indirizzo → salvare', 'Topbar e barra laterale si aggiornano'],
    ['Riduzione posti con conferma', 'Ridurre i posti totali della sede', 'Compare la richiesta di conferma prima di rimuovere stalli'],
    ['Scenario Ospedale', 'Selettore scenario → Ospedale', 'I dati cambiano, la modalità diventa "per turni", la sessione resta aperta'],
    ['Scenario Uffici', 'Selettore scenario → Uffici', 'Si torna alla prenotazione giornaliera'],
    ['Ripristino dati demo', '"Ripristina dati demo" → confermare nel modale', 'I dati tornano allo stato iniziale'],
    ['Permessi rispettati', 'Logout → login come Facility Manager', 'La voce Amministrazione non compare più'],
    ['Logout', 'Click sull’icona di uscita nel topbar', 'Si torna alla schermata di accesso']
  ]),

  h2('3.3 Checklist Facility Manager'),
  h3('Dashboard, Mappa, Accessi'),
  checklist([
    ['Login FM', 'Account demo "Facility Manager" → Accedi', 'Console FM senza la voce Amministrazione; ruolo "Facility Manager" nel topbar'],
    ['KPI Dashboard', 'Aprire Dashboard Live', 'Cinque KPI con valori coerenti con il parcheggio'],
    ['Mini-mappa per zona', 'Osservare la mini-mappa', 'Sei card di zona con liberi e occupati'],
    ['Navigazione da KPI', 'Click su "Posti Totali", poi su "Segnalazioni"', 'Portano rispettivamente a Mappa Stalli e a Segnalazioni'],
    ['Navigazione da zona', 'Click su una card della mini-mappa', 'Si apre la Mappa Stalli sulla zona scelta'],
    ['Gestisci da Dashboard', 'Click su "Gestisci" in una segnalazione aperta', 'Si apre il modale della segnalazione corretta'],
    ['Rendering mappa', 'Aprire Mappa Stalli', '156 stalli disegnati, ognuno col colore del proprio stato'],
    ['Dettaglio stallo', 'Click su uno stallo', 'Il modale mostra i dati di QUELLO stallo, non un contenuto fisso'],
    ['Modifica stallo', 'Cambiare tipo o note → salvare', 'La mappa si aggiorna subito, senza ricaricare'],
    ['Selezione multipla', 'Ctrl+Click su più stalli', 'Contorno blu sugli stalli scelti e barra di modifica multipla'],
    ['Applica modifica multipla', 'Impostare un valore → "Applica a selezionati"', 'Tutti gli stalli selezionati vengono aggiornati'],
    ['Aggiunta stallo', '"+ Aggiungi Stallo" → scegliere la zona → confermare', 'Codice proposto automaticamente; lo stallo compare in mappa e i totali aumentano'],
    ['Tabella accessi', 'Aprire Accessi', 'Tabella popolata, 20 righe per pagina'],
    ['Pannello filtri', 'Click su "Filtra"', 'Si apre il pannello con ricerca, tipo, stato, stallo'],
    ['Filtro per tipo', 'Tipo → "Vis."', 'Restano solo i visitatori'],
    ['Filtro anomalie', 'Click su "Solo anomalie"', 'Restano solo le righe con anomalia'],
    ['Azzeramento filtri', 'Click su "✕ Azzera"', 'Tornano tutti i record'],
    ['Dettaglio accesso', 'Click su una riga', 'Il modale mostra i dati di QUELLA riga'],
    ['Paginazione accessi', 'Cambiare pagina', 'Le righe cambiano e il conteggio resta coerente']
  ]),
  h3('Prenotazioni, Segnalazioni, Analytics'),
  checklist([
    ['Griglia settimanale', 'Aprire Prenotazioni', 'Griglia con la settimana corrente e una riga per dipendente'],
    ['Settimana successiva', 'Click su "›"', 'Le date avanzano di una settimana'],
    ['Settimana precedente', 'Click su "‹"', 'Le date tornano indietro'],
    ['Ritorno a oggi', 'Click su "Oggi"', 'Si torna alla settimana corrente'],
    ['Ricerca dipendente', 'Digitare un nome nel campo di ricerca', 'Le righe si riducono ai risultati'],
    ['Paginazione prenotazioni', 'Cambiare pagina', 'Le righe cambiano, il filtro resta attivo'],
    ['Creazione da cella libera', 'Click su una cella vuota → completare → confermare', 'La prenotazione compare nella griglia'],
    ['Fascia oraria in creazione', 'In "+ Prenota" impostare ora inizio e fine', 'La prenotazione conserva la fascia indicata'],
    ['Dettaglio da cella prenotata', 'Click su una cella già prenotata', 'Si apre il DETTAGLIO, non "Nuova prenotazione"'],
    ['Orari pre-caricati', 'Osservare i campi ora nel dettaglio', 'Mostrano gli orari reali, non 09:00–18:00 fissi'],
    ['Aggiorna orari', 'Cambiare ora inizio → "Aggiorna orari"', 'Il modale si chiude, il tooltip della cella mostra la nuova fascia'],
    ['Integrità dopo la modifica', 'Riaprire la stessa cella', 'Stessa prenotazione, stesso stallo, eventuale check-in conservato'],
    ['Validazione orari', 'Impostare ora fine precedente all’inizio → aggiornare', 'La modifica viene rifiutata con messaggio'],
    ['Cancellazione', 'Nel dettaglio, "Cancella prenotazione"', 'La cella torna libera'],
    ['KPI Segnalazioni', 'Aprire Segnalazioni', 'Quattro KPI coerenti con gli elenchi sottostanti'],
    ['Gestione segnalazione', 'Click su "Gestisci" → scegliere l’azione → confermare', 'La segnalazione esce dalle attive e il badge in barra laterale scende'],
    ['Storico risolte', 'Osservare la card "Storico risolte"', 'Tutte le risolte, con esito; ogni riga è cliccabile'],
    ['Sblocco utente', 'Card "Utenti Bloccati" → "Sblocca" → motivazione → confermare', 'L’utente torna attivo; la segnalazione si chiude con esito "Utente sbloccato"'],
    ['Segnalazione collegata', 'Da una risolta, "Apri segnalazione collegata" → confermare', 'Nasce una nuova segnalazione con rimando all’originale'],
    ['Analytics KPI', 'Aprire Analytics', 'Cinque KPI, ognuno con la variazione sul periodo precedente'],
    ['Cambio periodo', 'Passare da Settimana a Mese', 'KPI, grafico e tabella si aggiornano insieme'],
    ['Coerenza per zona', 'Confrontare la distribuzione con la mini-mappa di Dashboard', 'I due dati coincidono'],
    ['Determinismo', 'Ricaricare la pagina e riaprire Analytics', 'I valori sono identici a prima']
  ]),
  h3('Dipendenti, Visitatori, Hardware, Configurazione, Export'),
  checklist([
    ['Registro dipendenti', 'Aprire Dipendenti', 'Tabella popolata, 20 righe per pagina'],
    ['Ricerca per nome', 'Digitare un nome', 'Le righe si riducono ai risultati'],
    ['Ricerca per stallo', 'Digitare un codice di stallo', 'Compaiono i dipendenti collegati'],
    ['Azzera ricerca', 'Click su "✕"', 'Tornano tutti i dipendenti'],
    ['Dettaglio dipendente', 'Click su una riga', 'Il modale mostra i dati di QUEL dipendente'],
    ['Modifica dipendente', 'Cambiare un campo → salvare', 'Il dato aggiornato compare nel dettaglio e in tabella'],
    ['Aggiunta dipendente', '"+ Aggiungi Dipendente" → compilare → confermare', 'Compare in elenco con stato "Invito inviato"'],
    ['Attivazione simulata', '"Simula attivazione" → impostare la password', 'L’attivazione si completa e si entra nella Vista Dipendente'],
    ['Import lista', '"Importa Dipendenti" → scegliere il file → confermare', 'Le righe previste compaiono in elenco'],
    ['Sospensione', 'Dal dettaglio, "Sospendi"', 'Le prenotazioni future vengono annullate e il numero è riportato nel messaggio'],
    ['Abilitazione pass visitatore', 'Nel dettaglio, attivare "può richiedere pass"', 'La colonna "Pass vis." si aggiorna in tabella'],
    ['Banner richiesta pass', 'Osservare la parte alta della sezione', 'Se esiste una richiesta in attesa, compare il banner con "Approva"'],
    ['Approvazione pass', 'Click su "Approva" → confermare', 'Il pass viene creato ed è visibile in Visitatori'],
    ['Tabella visitatori', 'Aprire Visitatori', 'Tabella di oggi e tabella dei pass programmati'],
    ['Dettaglio visitatore', 'Click su una riga', 'Il modale mostra i dati di QUEL visitatore e il contenuto del pass'],
    ['Nuovo pass', '"+ Nuovo Pass" → compilare → confermare', 'Il pass compare in elenco con stallo assegnato'],
    ['Contenuto pass — codice', 'Config → Zona V su "PIN Keypad" → creare un pass', 'Il pass mostra un codice numerico'],
    ['Contenuto pass — QR', 'Zona V su "QR Code" → creare un pass', 'Il pass mostra una stringa QR, nessun codice numerico'],
    ['Contenuto pass — ricevuta', 'Zona V su "Guardiano" → creare un pass', 'Il pass è una ricevuta senza codice'],
    ['Nota del pass', 'Zona V su "Bluetooth", poi su "ANPR" → creare un pass', 'Compare la nota corrispondente al metodo'],
    ['Pass congelato', 'Creare un pass con Zona V su PIN, poi cambiare Zona V su Guardiano e riaprire il pass', 'Il pass resta un codice: non si trasforma in ricevuta'],
    ['Periodo pass', 'Nel dettaglio, anticipare la data di inizio → "Aggiorna periodo"', 'Il periodo si aggiorna'],
    ['Validazione periodo', 'Impostare data fine precedente all’inizio', 'La modifica viene rifiutata con messaggio'],
    ['Revoca pass', 'Click su "Revoca"', 'Il pass risulta revocato in elenco'],
    ['Estensione pass', 'Click su "Estendi"', 'L’orario di fine si sposta in avanti'],
    ['Barriere', 'Aprire Hardware', 'Due card distinte: barriere e modalità di accesso per zona'],
    ['Dettaglio barriera', 'Click su una riga', 'Il modale mostra i dati di QUELLA barriera e come si supera'],
    ['Aggiorna firmware', 'Click su "Aggiorna firmware"', 'La versione cambia nella barriera e nel modale'],
    ['Aggiunta barriera', '"+ Aggiungi barriera" → tipo e zona → confermare', 'La barriera compare in tabella'],
    ['Rimozione barriera', 'Dal dettaglio, "Rimuovi"', 'La barriera scompare dalla tabella'],
    ['Livelli di intervento', 'Osservare la seconda card', 'La colonna livello mostra Automatico, Azione rapida e Manuale coerenti con le zone'],
    ['Interruttori hardware', 'Cambiare un interruttore di configurazione', 'Lo stato cambia e resta'],
    ['Tab configurazione', 'Aprire Policy & Config e passare fra le quattro tab', 'Tutte caricano il proprio contenuto'],
    ['Informazioni sede', 'Tab Parcheggio → modificare il nome → salvare', 'Topbar e barra laterale si aggiornano'],
    ['Zone: aggiunta', '"+ Aggiungi" nella card Zone', 'La nuova zona compare in elenco'],
    ['Zone: rimozione', 'Click su "✕" su una zona', 'La zona sparisce dall’elenco e dalla mappa'],
    ['Metodo di zona', 'Cambiare il metodo di una zona', 'La modifica si riflette in Hardware e nel check-in del dipendente'],
    ['Policy prenotazioni', 'Tab Policy → "Modifica" → cambiare la finestra → salvare', 'Il valore aggiornato compare nella card'],
    ['Massimo turni', 'Nella stessa finestra, impostare "Max turni per dipendente"', 'Accetta valori fra 1 e 5 e li conserva'],
    ['Notifiche', 'Tab Notifiche → cambiare un interruttore', 'Lo stato si aggiorna'],
    ['Export', 'Aprire "Esporta Report" → scegliere un tipo → "Scarica Excel"', 'Viene scaricato un file .xlsx']
  ]),

  h2('3.4 Checklist Dipendente — Modalità Uffici'),
  checklist([
    ['Login dipendente', 'Account demo "Dipendente" → Accedi', 'Si apre la Vista Dipendente'],
    ['Riquadro di benvenuto', 'Osservare la parte alta', 'Nome, stallo assegnato e dipartimento corretti'],
    ['Finestra di prenotazione', 'Osservare il contrassegno con i giorni', 'Riflette la configurazione impostata dal FM'],
    ['Griglia settimanale', 'Osservare i cinque giorni', 'Settimana corrente, giorni passati non selezionabili'],
    ['Giorno corrente evidenziato', 'Osservare il giorno di oggi', 'Contrassegno "OGGI"; se prenotato, bordo più marcato'],
    ['Prenotazione', 'Click su un giorno libero → "Vengo in ufficio" → confermare', 'Il giorno risulta prenotato con lo stallo assegnato'],
    ['Smart Working', 'Click su un giorno → "Smart Working" → confermare', 'Il giorno cambia stato e lo stallo viene liberato'],
    ['Dettaglio prenotazione', 'Click su un giorno già prenotato', 'Si apre il dettaglio con stato, accesso, orari e cancellazione'],
    ['Modifica orari', 'Nel dettaglio, cambiare ora fine → "Aggiorna orari"', 'L’orario viene salvato'],
    ['Validazione orari', 'Impostare ora fine precedente all’inizio', 'La modifica viene rifiutata con messaggio'],
    ['Modifica giorno', 'Nel dettaglio, "Modifica giorno"', 'Si riapre la schermata di prenotazione del giorno'],
    ['Cancellazione', 'Nel dettaglio, "Cancella prenotazione"', 'Il giorno torna libero e lo stallo si libera'],
    ['Check-in ANPR', 'Zona dello stallo su "ANPR" → giorno prenotato', 'Testo di accesso automatico e ripiego manuale in secondo piano'],
    ['Check-in azione rapida', 'Zona su "Bluetooth" o "QR Code"', 'Pulsante principale "Ho effettuato l’accesso"; con QR compare il codice della prenotazione'],
    ['Check-in manuale', 'Zona su "PIN Keypad"', 'Testo sul keypad e pulsante di conferma'],
    ['Check-in guardiano', 'Zona su "Guardiano"', 'Pulsante di check-in e "Mostra prenotazione al guardiano"'],
    ['Stato dentro', 'Effettuare il check-in', 'Compaiono lo stato "Dentro", l’orario e il tempo trascorso'],
    ['Check-out ANPR', 'Con zona ANPR, dopo il check-in', 'Testo di uscita automatica e pulsante di ripiego in secondo piano'],
    ['Check-out manuale', 'Con zona PIN o Bluetooth, dopo il check-in', 'Pulsante "Check-out" in primo piano'],
    ['Uscita registrata', 'Effettuare il check-out', 'La sosta risulta conclusa con orari di ingresso e uscita'],
    ['Mappa personale', 'Osservare la mappa in sola lettura', 'Il proprio stallo è evidenziato'],
    ['Navigazione settimane', 'Click su "Succ ›" e "Prec"', 'Avanti entro la finestra; indietro disabilitato sulla settimana corrente'],
    ['Segnalazione', 'Click su "Segnala" → compilare → inviare', 'Compare il messaggio di conferma'],
    ['Richiesta pass', 'Click su "Richiedi Pass" → compilare → inviare', 'Compare la conferma di invio'],
    ['Le mie richieste', 'Aprire la sezione in fondo', 'Tab Pass Visitatori e Segnalazioni con le proprie voci'],
    ['Contenuto del pass approvato', 'Dopo l’approvazione del FM, tab Pass Visitatori', 'Compare il contenuto coerente col metodo: codice, QR o ricevuta'],
    ['Profilo', 'Click sulle iniziali nel topbar', 'Si apre il profilo con i propri dati'],
    ['Storico', 'Click su "Storico"', 'Si apre lo storico delle proprie prenotazioni'],
    ['Logout', 'Click sull’icona di uscita', 'Si torna alla schermata di accesso']
  ]),

  h2('3.5 Checklist Dipendente — Modalità Ospedale'),
  p('Da eseguire dopo aver attivato lo scenario Ospedale da Admin → Amministrazione → Parcheggi. '
    + 'Valgono in aggiunta ai controlli della modalità Uffici.'),
  checklist([
    ['Modalità attiva', 'Accedere come dipendente dopo il cambio scenario', 'La prenotazione avviene per turni'],
    ['Scelta del turno', 'Click su un giorno libero', 'Compaiono i tre turni con orari e disponibilità'],
    ['Prenotazione del turno', 'Scegliere "Mattino" → confermare', 'Il giorno mostra stallo e turno'],
    ['Turno già prenotato', 'Riaprire lo stesso giorno', 'Si riapre la scelta del turno e "Mattino" risulta già prenotato'],
    ['Secondo turno', 'Scegliere "Pomeriggio" → confermare', 'Il giorno mostra due turni; il primo non viene sostituito'],
    ['Terzo turno', 'Scegliere "Notte" → confermare', 'Il giorno mostra tre turni'],
    ['Turno duplicato', 'Provare a prenotare di nuovo "Mattino"', 'Viene rifiutato con messaggio di turno già prenotato'],
    ['Tetto turni', 'Abbassare "Max turni per dipendente" a 2 e provare il terzo', 'Viene rifiutato indicando il numero massimo'],
    ['Turno esaurito', 'Scegliere un turno senza stalli liberi', 'Il turno risulta esaurito e viene proposta la lista d’attesa'],
    ['Ingresso in lista d’attesa', 'Accettare la proposta', 'La voce compare nella tab "Lista Attesa" con la posizione in coda'],
    ['Assegnazione dalla coda', 'Come FM: Dashboard → card lista attesa → "Assegna stallo"', 'Il dipendente riceve uno stallo e la voce passa ad assegnata'],
    ['KPI per turno', 'Come FM: aprire Mappa Stalli', 'Il selettore turno cambia i KPI mostrati'],
    ['Capacità per turno', 'Come FM: aprire Prenotazioni', 'La card capacità mostra prenotati, liberi e percentuale per turno']
  ]),

  h2('3.6 Flussi cross-ruolo (stessa tab)'),
  ...avviso([
    'Tutti i flussi di questa tabella richiedono la STESSA tab: eseguire logout e login, mai aprire una seconda tab.'
  ]),
  checklistCross([
    ['Prenotazione visibile al FM', 'Dipendente', 'Prenota un giorno libero', 'Facility Manager', 'In Prenotazioni la cella di quel dipendente risulta occupata nel giorno scelto'],
    ['Smart Working libera lo stallo', 'Dipendente', 'Dichiara Smart Working su un giorno prenotato', 'Facility Manager', 'In Mappa Stalli lo stallo che aveva risulta libero per quel giorno'],
    ['Check-in visibile in griglia', 'Dipendente', 'Esegue il check-in sulla prenotazione di oggi', 'Facility Manager', 'Nella cella di Prenotazioni compare il pallino verde; in Accessi c’è la riga "dentro"'],
    ['Check-out visibile in griglia', 'Dipendente', 'Esegue il check-out', 'Facility Manager', 'Il pallino diventa grigio e l’accesso risulta chiuso'],
    ['Segnalazione al FM', 'Dipendente', 'Invia una segnalazione', 'Facility Manager', 'La segnalazione compare fra le attive e il badge in barra laterale sale'],
    ['Gestione e badge', 'Facility Manager', 'Gestisce e risolve una segnalazione', 'Facility Manager', 'La segnalazione esce dalle attive, entra nello storico e il badge scende'],
    ['Richiesta pass → banner', 'Dipendente', 'Invia una richiesta di pass visitatore', 'Facility Manager', 'In Dipendenti compare il banner con il pulsante "Approva"'],
    ['Approvazione → pass creato', 'Facility Manager', 'Approva la richiesta', 'Facility Manager', 'Il pass compare nella sezione Visitatori con lo stallo assegnato'],
    ['Esito visibile al dipendente', 'Facility Manager', 'Ha approvato la richiesta', 'Dipendente', 'In "Le mie richieste" lo stato è approvato e compare il contenuto del pass'],
    ['Sospensione annulla prenotazioni', 'Facility Manager', 'Sospende un dipendente con prenotazioni future', 'Facility Manager', 'Il messaggio riporta il numero di prenotazioni annullate; le celle si liberano'],
    ['Finestra di prenotazione', 'Facility Manager', 'Riduce la finestra in Policy & Config', 'Dipendente', 'Il contrassegno della finestra riflette il nuovo valore e i giorni fuori finestra non sono prenotabili'],
    ['Nuovo stallo ovunque', 'Facility Manager', 'Aggiunge uno stallo in Mappa', 'Facility Manager', 'Il totale posti aumenta in Dashboard, Prenotazioni e Configurazione'],
    ['Metodo di zona → check-in', 'Facility Manager', 'Cambia il metodo della zona dello stallo del dipendente', 'Dipendente', 'Il blocco di check-in cambia forma coerentemente col nuovo metodo'],
    ['Metodo di zona → pass', 'Facility Manager', 'Cambia il metodo della zona visitatori e crea un pass', 'Facility Manager', 'Il contenuto del pass cambia tipo; i pass già emessi restano invariati'],
    ['Nome sede ovunque', 'Facility Manager', 'Modifica il nome sede in Policy & Config', 'Facility Manager', 'Topbar, barra laterale ed export mostrano il nome nuovo']
  ]),

  h2('3.7 I dieci flussi prioritari'),
  p('Se il tempo a disposizione è poco, questi sono i controlli da eseguire per primi.'),
  tabella(
    ['#', 'Flusso', 'Perché è prioritario'],
    [
      ['1', 'Login dei tre ruoli e permessi', 'Se un ruolo entra nel posto sbagliato, tutto il resto è irrilevante'],
      ['2', 'Dipendente prenota → visibile al FM', 'La coerenza fra le due viste è la promessa centrale del prodotto'],
      ['3', 'Smart Working libera lo stallo', 'È il beneficio economico che si racconta al cliente'],
      ['4', 'Check-in e check-out per metodo', 'Distingue Parking Cloud dai gestionali generici'],
      ['5', 'Modifica prenotazione dal FM', 'Il difetto corretto più di recente: va verificato che non si perda il check-in'],
      ['6', 'Contenuto del pass per modalità', 'Un codice inutilizzabile davanti al varco è un errore visibile al cliente finale'],
      ['7', 'Segnalazione dipendente → gestione FM', 'Chiude il ciclo del problema, badge compreso'],
      ['8', 'Mappa: modifica singola e multipla', 'È la schermata che si mostra per prima in una demo'],
      ['9', 'Doppio turno in modalità ospedale', 'Abilita il mercato sanitario: se non funziona, quel mercato non è coperto'],
      ['10', 'Export Excel', 'È l’unico artefatto che il cliente porta via dalla riunione']
    ],
    [5, 32, 63]
  ),
  new Paragraph({ children: [new PageBreak()] })
];

/* ========================================================================== */
/*  SEZIONE 4 — SIMULATO VS REALE                                             */
/* ========================================================================== */
const sezione4 = [
  h1('4. Cosa è simulato e cosa è reale'),
  p('La demo è una pagina statica senza backend. Tutta la logica applicativa è reale ed eseguita '
    + 'nel browser; ciò che richiede un server, un impianto o un servizio esterno è riprodotto.'),
  tabella(
    ['Funzionalità', 'Comportamento nella demo', 'Comportamento con backend reale'],
    [
      ['Email (inviti, conferme, notifiche)',
        'Nessun invio. Compare un messaggio a schermo che dichiara il destinatario',
        'Invio effettivo tramite servizio di posta transazionale, con tracciamento della consegna'],
      ['Codice di accesso del pass visitatore',
        'Generato realmente e mostrato, ma non registrato su alcun varco',
        'Generato dal sistema e propagato al controllo accessi, con validità limitata alla fascia concessa'],
      ['Codice QR del pass',
        'Stringa identificativa reale mostrata come testo; non è un’immagine QR',
        'QR grafico generato e inviato al visitatore, leggibile dal varco'],
      ['Accessi hardware',
        'I record del log sono generati dal seme dei dati demo',
        'Ogni transito viene registrato dal varco e sincronizzato in tempo reale'],
      ['Check-in automatico ANPR',
        'Nessuna telecamera: la schermata dichiara l’automatismo e offre un ripiego manuale',
        'La lettura della targa registra l’ingresso senza alcuna azione della persona'],
      ['Check-out automatico ANPR',
        'Dichiarato a schermo; la chiusura avviene con il ripiego manuale',
        'La lettura in uscita chiude la sosta e calcola la durata'],
      ['Check-in QR, Bluetooth, badge',
        'Il pulsante di conferma registra l’accesso: è la persona a dichiararlo',
        'Il varco comunica l’evento e il check-in avviene senza conferma manuale'],
      ['Export Excel',
        'Reale: il file .xlsx viene generato e scaricato dal browser',
        'Identico, con la possibilità di generazione lato server e invio programmato'],
      ['Export PDF',
        'Non disponibile',
        'Generato dal server con impaginazione e intestazioni'],
      ['Dati (stalli, persone, accessi)',
        'Fittizi, generati con un seme fisso: identici a ogni apertura',
        'Dati reali del cliente su database, con storico permanente'],
      ['Persistenza delle modifiche',
        'In memoria: il ricaricamento riporta tutto allo stato iniziale',
        'Scritte su database, permanenti e condivise fra tutti gli utenti'],
      ['Sincronizzazione fra sessioni',
        'Assente: ogni tab ha il proprio stato in memoria',
        'Tutti gli utenti vedono lo stesso dato, con aggiornamento in tempo reale'],
      ['Contatore della sosta in corso',
        'Reale, aggiornato ogni minuto finché la pagina resta aperta',
        'Calcolato dal server, indipendente dal browser'],
      ['Segnalazione automatica di sosta prolungata',
        'Reale: generata al superamento della soglia configurata, una sola volta per prenotazione',
        'Identica, con notifica effettiva alla persona interessata'],
      ['Chiusura automatica dei check-in a fine giornata',
        'Reale, eseguita finché la pagina resta aperta',
        'Eseguita dal server, indipendentemente dalle sessioni attive'],
      ['Stato del visitatore',
        'Calcolato dal periodo del pass e dall’ora locale del browser',
        'Calcolato dal server sull’orario di sistema, uguale per tutti'],
      ['Lista d’attesa su turno esaurito',
        'Reale nella gestione della coda; nessuna notifica al dipendente all’assegnazione',
        'Notifica automatica alla persona quando lo stallo si libera'],
      ['Contenuto del pass per metodo di accesso',
        'Reale: tipo, nota e istruzioni derivano dalla configurazione della zona',
        'Identico, con consegna effettiva del contenuto al visitatore'],
      ['Import dipendenti da file',
        'Simulato: la selezione del file non legge il contenuto, l’esito è predefinito',
        'Lettura reale del file, validazione riga per riga e invio degli inviti'],
      ['Attivazione account',
        'La schermata è reale, ma si raggiunge dal pulsante "Simula attivazione"',
        'Si raggiunge dal link ricevuto via email, con token a scadenza'],
      ['Autenticazione',
        'La password non viene verificata: il ruolo si deduce dall’email',
        'Verifica delle credenziali, sessione con scadenza, eventuale accesso unico aziendale']
    ],
    [22, 39, 39]
  ),
  new Paragraph({ children: [new PageBreak()] })
];

/* ========================================================================== */
/*  SEZIONE 5 — LIMITAZIONI NOTE                                              */
/* ========================================================================== */
const limitazioni = [
  ['Nessuna sincronizzazione fra tab',
    'Ogni tab del browser carica la propria copia dei dati in memoria: due tab non si vedono a vicenda. Per i flussi cross-ruolo serve la stessa tab, con logout e nuovo login.'],
  ['I dati si azzerano al ricaricamento',
    'Non esiste un archivio: tutte le modifiche vivono in memoria e il ricaricamento riporta i dati allo stato iniziale. È anche il modo più rapido per ripartire da zero.'],
  ['Export PDF non disponibile',
    'La generazione di un PDF impaginato richiede un servizio lato server, che la demo statica non ha. L’unico formato prodotto è Excel.'],
  ['Nessuna email realmente inviata',
    'Inviti, conferme e notifiche sono dichiarati a schermo ma non partono: non esiste un servizio di posta collegato.'],
  ['Hardware non connesso',
    'Barriere, lettori e telecamere non esistono: stati, cicli e firmware sono dati dimostrativi e i comandi non raggiungono alcun impianto.'],
  ['Codici e QR non funzionanti su impianti reali',
    'I codici numerici e le stringhe QR sono generati davvero, ma non vengono registrati su alcun sistema di controllo accessi: non aprono nulla.'],
  ['Il codice QR è testo, non un’immagine',
    'Viene mostrata la stringa identificativa della prenotazione o del pass; la generazione grafica del QR non è implementata.'],
  ['Export dipendente dalla connessione',
    'La creazione del file Excel usa una libreria caricata da rete: senza connessione a Internet il download non si completa.'],
  ['Check-in automatico da confermare a mano',
    'Dove il varco dovrebbe rilevare l’accesso da solo, la demo lo dichiara e offre un ripiego manuale: senza impianto non esiste un evento da registrare.'],
  ['Stato del visitatore legato all’orologio del browser',
    'Il passaggio fra atteso, dentro e scaduto è calcolato sull’ora locale del computer: cambiando fuso o orario di sistema cambiano gli stati mostrati.'],
  ['I contatori si fermano con la pagina',
    'Il tempo di sosta e le chiusure automatiche di fine giornata funzionano solo finché la pagina resta aperta.'],
  ['Import dipendenti simulato',
    'La finestra di import accetta la selezione di un file ma non ne legge il contenuto: l’esito è sempre lo stesso.'],
  ['Password non verificata',
    'Il campo password è presente ma non controllato: il ruolo si deduce dall’email. Non c’è alcun sistema di autenticazione.'],
  ['Vista Dipendente non ottimizzata per telefono',
    'L’interfaccia è progettata per schermi desktop: su telefono resta usabile ma non è la resa definitiva.']
];

const sezione5 = [
  h1('5. Limitazioni note'),
  p('Quanto segue è conseguenza diretta del fatto che la demo è una pagina statica senza backend. '
    + 'Sono comportamenti attesi, non difetti: non vanno aperti come segnalazione.'),
  ...limitazioni.map(l => new Paragraph({
    spacing: { before: 110, after: 110, line: 264 },
    indent: { left: convertInchesToTwip(0.12) },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: BLU, space: 10 } },
    children: [
      new TextRun({ text: l[0], font: FONT, size: 22, bold: true, color: NERO }),
      new TextRun({ text: l[1], font: FONT, size: 20, color: NERO, break: 1 })
    ]
  })),
  new Paragraph({ children: [new PageBreak()] })
];

/* ========================================================================== */
/*  SEZIONE 6 — COME SEGNALARE I BUG                                          */
/* ========================================================================== */
const campiTemplate = [
  ['Sezione', 'Dove si verifica: es. Prenotazioni, Vista Dipendente'],
  ['Ruolo', 'Con quale account: Admin, Facility Manager, Dipendente'],
  ['Modalità', 'Uffici oppure Ospedale'],
  ['Passi per riprodurre', 'Sequenza numerata, dall’accesso in poi. Chi legge deve poter ripetere senza chiedere altro'],
  ['Risultato atteso', 'Che cosa avrebbe dovuto succedere'],
  ['Risultato ottenuto', 'Che cosa è successo davvero'],
  ['Priorità', 'Bloccante, Alto, Medio o Basso secondo la tabella 6.2'],
  ['Riproducibilità', 'Sempre, a volte, una sola volta'],
  ['Screenshot', 'Se disponibile, allegare l’immagine']
];

const sezione6 = [
  h1('6. Come segnalare i bug'),

  h2('6.1 Modello di segnalazione'),
  p('Compilare tutti i campi. Una segnalazione senza passi di riproduzione non è lavorabile.'),
  tabella(['Campo', 'Che cosa scrivere'], campiTemplate, [26, 74]),
  ...nota([
    'Esempio di passi ben scritti: "1. Login come Facility Manager. 2. Prenotazioni. '
    + '3. Click sulla cella di Sara Bellotti di lunedì. 4. Cambio ora inizio a 08:00. '
    + '5. Click su Aggiorna orari." Un lettore che non conosce il caso deve poterlo ripetere.'
  ]),

  h2('6.2 Classificazione della priorità'),
  tabella(
    ['Priorità', 'Definizione', 'Esempi'],
    [
      ['Bloccante',
        'Impedisce di proseguire: la demo non è mostrabile al cliente',
        'Il login non funziona; una sezione resta vuota; un errore blocca la pagina; la mappa non si disegna'],
      ['Alto',
        'Il dato mostrato è sbagliato oppure una funzione centrale non produce l’effetto atteso',
        'Una prenotazione non compare al FM; il check-in non si registra; un modale mostra i dati di un’altra entità; una modifica perde il check-in'],
      ['Medio',
        'La funzione arriva al risultato ma con un passaggio scorretto o poco chiaro',
        'Un filtro non si azzera; un messaggio riporta un valore errato; una colonna resta vuota; un pulsante non aggiorna subito la vista'],
      ['Basso',
        'Aspetto, testo o dettaglio di forma',
        'Un refuso; un allineamento impreciso; un’icona incoerente; un testo troppo lungo che va a capo male']
    ],
    [14, 34, 52]
  ),

  h2('6.3 Che cosa non segnalare'),
  p('I punti seguenti sono comportamenti previsti. Prima di aprire una segnalazione, verificare '
    + 'che non rientri qui o nella Sezione 5.'),
  bullet('Le modifiche fatte in una tab non compaiono in un’altra tab — ogni tab ha i propri dati in memoria (Sezione 5)'),
  bullet('Dopo un ricaricamento i dati tornano come prima — non esiste archivio (Sezione 5)'),
  bullet('Non arriva alcuna email — nessun servizio di posta è collegato (Sezione 5)'),
  bullet('Il codice del pass non apre nulla — nessun impianto è connesso (Sezione 5)'),
  bullet('Il QR è una stringa di testo e non un’immagine — la generazione grafica non è implementata (Sezione 5)'),
  bullet('Non si riesce a esportare in PDF — richiede un backend (Sezione 5)'),
  bullet('Il check-in "automatico" richiede comunque un click — senza telecamera non esiste evento da registrare (Sezione 5)'),
  bullet('La password non viene controllata — non c’è autenticazione (Sezione 5)'),
  bullet('Le sezioni "Accessi Esterni" e "Multi-sede" sono bloccate — dichiarate come fase successiva'),
  bullet('Una funzionalità elencata nella Sezione 7 non esiste — non è stata sviluppata'),
  ...avviso([
    'Nel dubbio, segnalare. Una segnalazione in più costa pochi minuti; un difetto che arriva '
    + 'davanti al cliente costa molto di più.'
  ]),
  new Paragraph({ children: [new PageBreak()] })
];

/* ========================================================================== */
/*  SEZIONE 7 — FEATURE PIANIFICATE                                           */
/* ========================================================================== */
const sezione7 = [
  h1('7. Funzionalità pianificate'),
  ...avviso([
    'Nulla di quanto segue è presente nella demo. Non va testato: non esiste. '
    + 'L’elenco serve a distinguere ciò che manca perché non è stato ancora fatto da ciò che manca perché è rotto.'
  ]),

  h2('7.1 Esperienza d’uso e mobile'),
  bullet('Vista Dipendente ottimizzata per telefono — oggi l’interfaccia è progettata per desktop'),

  h2('7.2 Export'),
  bullet('Export PDF impaginato — richiede la generazione lato server'),
  bullet('Invio programmato dei report — richiede backend e servizio di posta'),

  h2('7.3 Backend e dati reali'),
  bullet('Backend applicativo con database PostgreSQL gestito — persistenza reale delle modifiche'),
  bullet('Invio reale delle email tramite servizio di posta transazionale — inviti, conferme e notifiche'),
  bullet('Integrazione con l’impianto di controllo accessi — varchi, lettori e riconoscimento targa'),
  bullet('Sincronizzazione in tempo reale fra sessioni — elimina il limite della singola tab'),
  bullet('Autenticazione reale con verifica delle credenziali e sessioni a scadenza'),

  h2('7.4 Prodotto'),
  bullet('Due livelli di dipendente: standard e dirigente, con priorità diverse nell’assegnazione dello stallo'),
  bullet('Notifiche push su applicazione mobile'),
  bullet('Integrazione con i sistemi HR per l’import automatico dell’anagrafica'),
  bullet('Accesso unico aziendale (SSO)'),
  bullet('Gestione multi-sede — oggi la voce è presente in barra laterale ma dichiarata come fase successiva'),
  bullet('Accessi esterni e ricavi — stessa condizione: voce presente e dichiarata non attiva'),

  h2('7.5 Nota sui fornitori'),
  p('L’integrazione con l’impianto reale riguarderà i fornitori già individuati per varchi, '
    + 'apertura da smartphone e riconoscimento targa. Nell’interfaccia del prodotto i nomi dei '
    + 'fornitori non compaiono: si parla di barriere e di metodi di accesso, così che la stessa '
    + 'dashboard possa essere mostrata a clienti con impianti diversi.')
];

/* ========================================================================== */
/*  DOCUMENTO                                                                 */
/* ========================================================================== */
const intestazione = new Header({
  children: [new Paragraph({
    spacing: { after: 40 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLU, space: 4 } },
    children: [new TextRun({
      text: 'Parking Cloud · FM Dashboard · Documento interno',
      font: FONT, size: 16, color: BLU, bold: true
    })]
  })]
});

const piede = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: '', font: FONT, size: 16, color: GRIGIO }),
      new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: GRIGIO })
    ]
  })]
});

const doc = new Document({
  creator: 'Parking Cloud',
  title: 'FM Dashboard — Guida Funzionale e Piano di Test',
  description: 'Documento interno: guida funzionale e piano di test della FM Dashboard',
  /* Word aggiorna l'indice all'apertura solo se il documento lo chiede. */
  features: { updateFields: true },
  styles: {
    default: {
      document:  { run: { font: FONT, size: 22, color: NERO } },
      heading1: {
        run: { font: FONT, size: 36, bold: true, color: BLU },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 }
      },
      heading2: {
        run: { font: FONT, size: 28, bold: true, color: NERO },
        paragraph: { spacing: { before: 260, after: 110 }, outlineLevel: 1 }
      },
      heading3: {
        run: { font: FONT, size: 24, bold: true, color: BLU },
        paragraph: { spacing: { before: 190, after: 80 }, outlineLevel: 2 }
      }
    }
  },
  numbering: {
    config: [{
      reference: 'passi',
      levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }]
    }]
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 1000, right: 900, bottom: 1000, left: 900 }
      }
    },
    headers: { default: intestazione },
    footers: { default: piede },
    children: [].concat(
      copertina, indice, sezione1, sezione2, sezione3, sezione4, sezione5, sezione6, sezione7
    )
  }]
});

/* ---- scrittura ---------------------------------------------------------- */
const uscita = path.join(__dirname, 'PC_FM_Dashboard_Guida.docx');
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(uscita, buf);
  console.log('Generato: ' + uscita);
  console.log('Dimensione: ' + Math.round(buf.length / 1024) + ' KB');
  console.log('Check totali nelle checklist: ' + TOTALE_CHECK);
});
