/* ============================================================================
   PARKING CLOUD · modals.js
   ----------------------------------------------------------------------------
   Un solo overlay nel DOM. Ogni modale è una DEFINIZIONE che riceve un
   contesto (l'id di ciò che hai cliccato) e legge i dati da AppState al
   momento dell'apertura.

   È la correzione strutturale dei bug DV05 / DV08 / DV18 dell'AS-IS: non
   esistono più modali con contenuto statico nell'HTML, quindi è
   impossibile che mostrino la persona sbagliata.

   Stato del form: Modals.form. Prima di ogni refresh i campi [data-field]
   vengono raccolti, così un re-render (es. cambio zona in "Aggiungi Stallo")
   non cancella quello che l'utente ha già scritto.
============================================================================ */
(function (global) {
'use strict';

const PC = global.PC;
const { UI, Selectors: S, Actions: A, State, Utils: U, Domini: D } = PC;

const Modals = {
  defs: {},
  corrente: null,
  ctx: {},
  form: {},

  register(nome, def) { this.defs[nome] = def; },

  open(nome, ctx) {
    const def = this.defs[nome];
    if (!def) { console.warn('[PC] modale sconosciuto:', nome); return; }
    this.corrente = nome;
    this.ctx = ctx || {};
    this.form = def.initForm ? def.initForm(this.ctx) : {};
    this._render();
    document.body.style.overflow = 'hidden';
  },

  close() {
    this.corrente = null; this.ctx = {}; this.form = {};
    const root = document.getElementById('modal-root');
    if (root) { root.classList.add('hidden'); root.innerHTML = ''; }
    document.body.style.overflow = '';
  },

  /** raccoglie i campi e ridisegna: usato dai controlli interni al modale */
  refresh() { this._collect(); this._render(); },

  /** valore corrente di un campo (form → default) */
  val(campo, def) { return this.form[campo] !== undefined ? this.form[campo] : def; },

  _collect() {
    document.querySelectorAll('#modal-root [data-field]').forEach(el => {
      this.form[el.dataset.field] = el.type === 'checkbox' ? el.checked : el.value;
    });
  },

  _render() {
    const def = this.defs[this.corrente];
    const root = document.getElementById('modal-root');
    if (!def || !root) return;
    const ctx = this.ctx;
    root.classList.remove('hidden');
    root.innerHTML = `
      <div class="modal ${def.size || ''}" data-act="modal-stop">
        <div class="modal-hd">
          <div class="modal-title">${def.titolo(ctx)}</div>
          <button class="modal-close" data-act="modal-close">✕</button>
        </div>
        <div class="modal-body">${def.body(ctx)}</div>
        ${def.footer ? `<div class="modal-footer">${def.footer(ctx)}</div>` : ''}
      </div>`;
  }
};

/* helper interni ------------------------------------------------------- */
const f  = (campo, def) => Modals.val(campo, def);
const fld = (campo) => ` data-field="${campo}"`;
const chiudi = (label) => UI.btn(label || 'Annulla', { azione: 'modal-close', variante: 'btn-ghost', sm: false });
const ok = (label, azione, params) => UI.btn(label, { azione, params, variante: 'btn-primary', sm: false });

const OPZ_TIPO_STALLO = Object.keys(D.TIPO_STALLO).map(k => ({ v: k, l: D.TIPO_STALLO[k].label }));
const OPZ_DISPONIBILITA = Object.keys(D.DISPONIBILITA).map(k => ({ v: k, l: D.DISPONIBILITA[k] }));

/* ============================================================================
   MAPPA — Dettaglio & modifica stallo   [fix DV05: contenuto dinamico]
============================================================================ */
Modals.register('stallo-det', {
  size: 'modal-lg',
  initForm: (c) => {
    const s = S.stallo(c.stalloId) || {};
    return { tipo: s.tipo, disponibilita: s.disponibilita, titolare: s.titolareId || '', durata: s.durataMaxOre, note: s.note || '' };
  },
  titolo: (c) => `🅿️ Stallo ${UI.esc(c.stalloId)} — Dettaglio & Modifica`,
  body: (c) => {
    const s = S.stallo(c.stalloId);
    if (!s) return UI.alert('Stallo non trovato.', 'danger');
    const st = S.statoStallo(s.id);
    const zona = S.zona(s.zonaId);
    const titolare = S.dipendente(s.titolareId);
    const candidati = [{ v: '', l: '— Nessuno / Pool rotante —' }]
      .concat(State.dipendenti.filter(d => d.inEvidenza).map(d => ({ v: d.id, l: d.nomeCompleto })));

    return `
      ${st.stato === 'violazione' ? UI.alert(`🚨 <strong>Occupazione abusiva rilevata.</strong> Veicolo ${UI.esc(st.occupanteNome)} presente senza autorizzazione.`, 'danger') : ''}
      ${UI.infoGrid([
        UI.infoBox('Stato attuale', `<span class="b b-${st.stato === 'libero' ? 'green' : st.stato === 'manutenzione' ? 'amber' : 'red'}">${UI.esc(st.label)}</span>`),
        UI.infoBox('Zona', `${UI.esc(zona ? zona.nome : s.zonaId)} · ${UI.esc(s.piano)}`),
        UI.infoBox('Occupato da', st.occupanteNome ? UI.esc(st.occupanteNome) : '<span class="muted">—</span>'),
        UI.infoBox('Titolare assegnato', titolare ? UI.esc(titolare.nomeCompleto) : '<span class="muted">Nessuno (pool)</span>')
      ])}
      <div class="sep"></div>
      <div class="form-grid2">
        ${UI.campo('Tipo stallo', UI.select(OPZ_TIPO_STALLO, f('tipo'), { azione: 'modal-field' }) .replace('<select', '<select' + fld('tipo')))}
        ${UI.campo('Disponibilità', UI.select(OPZ_DISPONIBILITA, f('disponibilita')).replace('<select', '<select' + fld('disponibilita')))}
        ${UI.campo('Dipendente assegnato', UI.select(candidati, f('titolare')).replace('<select', '<select' + fld('titolare')))}
        ${UI.campo('Durata max sosta (ore)', UI.input({ tipo: 'number', valore: f('durata'), min: 1, max: 24 }).replace('<input', '<input' + fld('durata')))}
      </div>
      ${UI.campo('Note', UI.input({ valore: f('note'), placeholder: 'Es: vicino all\'ascensore, colonnina 22 kW…' }).replace('<input', '<input' + fld('note')))}
    `;
  },
  footer: (c) => chiudi() + ok('Salva Modifiche', 'salva-stallo', { stalloId: c.stalloId })
});

/* ============================================================================
   ACCESSI — Dettaglio riga   [fix DV08: mostra la riga cliccata]
============================================================================ */
Modals.register('acc-det', {
  titolo: (c) => { const a = S.accesso(c.accessoId); return `⇆ Dettaglio Accesso — ${UI.esc(a ? a.personaNome : '—')}`; },
  body: (c) => {
    const a = S.accesso(c.accessoId);
    if (!a) return UI.alert('Accesso non trovato.', 'danger');
    const stallo = S.stallo(a.stalloId);
    const tipoLbl = { dipendente: 'Dipendente', visitatore: 'Visitatore', anomalia: 'Non identificato' }[a.tipo];
    const dip = S.dipendente(a.personaId);
    const vis = S.visitatore(a.personaId);

    return `
      ${a.anomalia === 'abusivo' ? UI.alert(`🚨 Veicolo <strong>${UI.esc(a.targa)}</strong> senza autorizzazione sullo stallo ${UI.esc(a.stalloId)}.`, 'danger') : ''}
      ${a.anomalia === 'durata'  ? UI.alert(`⏰ Sosta in corso da <strong>${UI.esc(S.durataSosta(a.id))}</strong> · policy max ${State.config.prenotazioni.notificaDurataOre}h.`, 'warn') : ''}
      ${a.anomalia === 'zona'    ? UI.alert('🚧 Visitatore rilevato in zona non autorizzata dal pass.', 'warn') : ''}
      ${UI.infoGrid([
        UI.infoBox('Persona', UI.esc(a.personaNome)),
        UI.infoBox('Tipo', tipoLbl + (a.targa ? ` · <span class="mono">${UI.esc(a.targa)}</span>` : '')),
        UI.infoBox('Stallo', stallo ? `${UI.esc(a.stalloId)} · ${UI.esc(stallo.piano)}` : UI.esc(a.stalloId || '—')),
        UI.infoBox('Metodo', D.METODO_ACCESSO[a.metodo] || '—'),
        UI.infoBox('Ingresso', UI.esc(a.ingresso), true),
        UI.infoBox('Uscita', a.uscita ? UI.esc(a.uscita) : '<span class="muted">— ancora dentro</span>', true)
      ])}
      ${dip ? `<div class="sep"></div>${UI.infoGrid([
        UI.infoBox('Dipartimento', UI.esc(dip.dipartimento)),
        UI.infoBox('Accessi (mese)', dip.accessiMese)
      ])}` : ''}
      ${vis ? `<div class="sep"></div>${UI.infoGrid([
        UI.infoBox('Azienda', UI.esc(vis.azienda)),
        UI.infoBox('Pass', UI.esc(vis.passId), true)
      ])}` : ''}
    `;
  },
  footer: (c) => {
    const a = S.accesso(c.accessoId);
    const seg = a && S.segnalazioniAttive().find(x => x.stalloId === a.stalloId);
    return chiudi('Chiudi')
      + (a && a.stalloId ? UI.btn('🗺 Vedi in mappa', { azione: 'vai-stallo', params: { stalloId: a.stalloId }, sm: false }) : '')
      + (seg ? UI.btn('🚨 Gestisci segnalazione', { azione: 'apri-seg', params: { segId: seg.id }, variante: 'btn-danger', sm: false }) : '');
  }
});

/* ============================================================================
   DIPENDENTI — Dettaglio   [fix DV18: mostra il dipendente cliccato]
============================================================================ */
Modals.register('dip-det', {
  initForm: (c) => { const d = S.dipendente(c.dipendenteId) || {}; return { metodo: d.metodoAccesso, caratteristica: d.caratteristica }; },
  titolo: (c) => { const d = S.dipendente(c.dipendenteId); return `👤 ${UI.esc(d ? d.nomeCompleto : '—')}`; },
  body: (c) => {
    const d = S.dipendente(c.dipendenteId);
    if (!d) return UI.alert('Dipendente non trovato.', 'danger');
    const prossime = S.prenotazioniDipendente(d.id, U.OGGI_ISO).slice(0, 4);
    return `
      ${d.stato === 'bloccato' ? UI.alert(`🚫 Accesso sospeso dal ${UI.esc(d.bloccoDal)} — ${UI.esc(d.bloccoMotivo)}.`, 'danger') : ''}
      ${UI.infoGrid([
        UI.infoBox('Email', `<span style="font-size:12px">${UI.esc(d.email)}</span>`),
        UI.infoBox('Dipartimento', UI.esc(d.dipartimento)),
        UI.infoBox('Stallo assegnato', d.stalloId ? `${UI.esc(d.stalloId)} · ${UI.esc((S.stallo(d.stalloId) || {}).piano || '')}` : '<span class="muted">Pool rotante</span>'),
        UI.infoBox('Accessi (mese)', d.accessiMese),
        UI.infoBox('No-show', `<span style="color:var(--${d.noShow ? 'amber' : 'green'})">${d.noShow}</span>`),
        UI.infoBox('Segnalazioni fatte', d.segnalazioniFatte)
      ])}
      ${UI.setting('Metodo accesso', '', UI.select([{ v: 'app2n', l: 'App + 2N' }, { v: 'app', l: 'Solo App' }, { v: 'sospeso', l: 'Sospeso' }], f('metodo'), { stile: 'width:160px' }).replace('<select', '<select' + fld('metodo')))}
      ${UI.setting('Caratteristiche', '', UI.select([{ v: 'standard', l: 'Standard' }, { v: 'ev', l: 'EV ⚡' }, { v: 'disabili', l: 'Disabili ♿' }], f('caratteristica'), { stile: 'width:160px' }).replace('<select', '<select' + fld('caratteristica')))}
      ${UI.setting('Può richiedere pass visitatore', 'Il dipendente può inoltrare una richiesta di pass; l\'approvazione resta al FM',
        UI.toggle('toggle-pass-dip', d.puoRichiederePass, { dipendenteId: d.id }))}
      <div class="sep"></div>
      <div class="form-label" style="margin-bottom:6px">Prossime prenotazioni</div>
      ${prossime.length
        ? prossime.map(p => `<div class="setting-row"><div><div class="setting-name">${UI.esc(U.fmtMedium(U.fromISO(p.data)))}</div><div class="setting-desc">${p.tipo === 'sw' ? '🏠 Smart Working' : 'Stallo ' + UI.esc(p.stalloId)}</div></div>${UI.badge(p.tipo === 'sw' ? 'Smart W.' : 'Prenotato', p.tipo === 'sw' ? 'amber' : 'blue')}</div>`).join('')
        : '<div class="muted" style="font-size:12px">Nessuna prenotazione futura.</div>'}
    `;
  },
  footer: (c) => {
    const d = S.dipendente(c.dipendenteId);
    if (!d) return chiudi('Chiudi');
    return (d.stato === 'bloccato'
        ? UI.btn('🔓 Sblocca', { azione: 'apri-sblocco', params: { dipendenteId: d.id }, variante: 'btn-success', sm: false })
        : UI.btn('Sospendi', { azione: 'sospendi-dip', params: { dipendenteId: d.id }, variante: 'btn-danger', sm: false }))
      + chiudi('Chiudi')
      + UI.btn('🔑 Pass', { azione: 'apri-dip-pass', params: { dipendenteId: d.id }, sm: false })
      + ok('Salva', 'salva-dip', { dipendenteId: d.id });
  }
});

/* ============================================================================
   DIPENDENTI — Aggiungi / Sblocca / Pass / Richiesta pass
============================================================================ */
Modals.register('add-user', {
  size: 'modal-lg',
  initForm: () => ({ dipartimento: 'Finance', stallo: '', caratteristica: 'standard' }),
  titolo: () => '+ Aggiungi Dipendente',
  body: () => {
    const liberi = [{ v: '', l: 'Auto-assegna (pool rotante)' }]
      .concat(S.stalliDisponibiliPer(null, U.OGGI_ISO).slice(0, 20).map(c => ({ v: c, l: c + ' (libero)' })));
    return UI.alert("ℹ️ L'utente riceverà un'email con link di attivazione app e codice 2N.", 'info') + `
      <div class="form-grid2">
        ${UI.campo('Nome', UI.input({ placeholder: 'Nome' }).replace('<input', '<input' + fld('nome')))}
        ${UI.campo('Cognome', UI.input({ placeholder: 'Cognome' }).replace('<input', '<input' + fld('cognome')))}
        ${UI.campo('Email', UI.input({ tipo: 'email', placeholder: 'nome.cognome@' + State.config.sede.dominioEmail }).replace('<input', '<input' + fld('email')))}
        ${UI.campo('Dipartimento', UI.select(D.DIPARTIMENTI, f('dipartimento')).replace('<select', '<select' + fld('dipartimento')))}
        ${UI.campo('Stallo', UI.select(liberi, f('stallo')).replace('<select', '<select' + fld('stallo')))}
        ${UI.campo('Caratteristiche', UI.select([{ v: 'standard', l: 'Standard' }, { v: 'ev', l: 'EV ⚡' }, { v: 'disabili', l: 'Disabili ♿' }], f('caratteristica')).replace('<select', '<select' + fld('caratteristica')))}
      </div>`;
  },
  footer: () => chiudi() + ok('Crea', 'crea-dip')
});

Modals.register('sblocco', {
  initForm: () => ({ durata: 'Permanente (con monitoraggio)' }),
  titolo: (c) => { const d = S.dipendente(c.dipendenteId); return `🔓 Sblocca Accesso — ${UI.esc(d ? d.nomeCompleto : '')}`; },
  body: (c) => {
    const d = S.dipendente(c.dipendenteId);
    if (!d) return UI.alert('Dipendente non trovato.', 'danger');
    return UI.alert(`<strong>${UI.esc(d.nomeCompleto)}</strong> — bloccato dal ${UI.esc(d.bloccoDal || '—')} · ${UI.esc(d.bloccoMotivo || '')}.`, 'danger')
      + UI.campo('Motivazione sblocco', `<textarea class="form-textarea"${fld('motivazione')} placeholder="Es: colloquio effettuato, impegno ricevuto…"></textarea>`)
      + UI.campo('Durata ripristino', UI.select(['Permanente (con monitoraggio)', 'Periodo di prova 30 giorni', 'Solo giorni specifici'], f('durata')).replace('<select', '<select' + fld('durata')));
  },
  footer: (c) => chiudi() + UI.btn('Sblocca', { azione: 'conferma-sblocco', params: { dipendenteId: c.dipendenteId }, variante: 'btn-success', sm: false })
});

Modals.register('dip-pass', {
  initForm: (c) => { const d = S.dipendente(c.dipendenteId) || {}; return { data: U.OGGI_ISO, stallo: d.stalloId || '', da: '09:00', a: '18:00', codice: String(U.rInt(1000, 9999)) }; },
  titolo: (c) => { const d = S.dipendente(c.dipendenteId); return `🔑 Genera Pass — ${UI.esc(d ? d.nomeCompleto : '')}`; },
  body: (c) => {
    const d = S.dipendente(c.dipendenteId) || {};
    const opzioni = [{ v: d.stalloId || '', l: d.stalloId ? `Stallo assegnato (${d.stalloId})` : 'Auto-assegna' }]
      .concat(S.stalliDisponibiliPer(d.id, f('data')).slice(0, 12).map(x => ({ v: x, l: x + ' (libero)' })));
    return UI.alert('Il dipendente riceverà un codice My2N temporaneo valido nella fascia oraria indicata.', 'info') + `
      <div class="form-grid2">
        ${UI.campo('Data', UI.input({ tipo: 'date', valore: f('data') }).replace('<input', '<input' + fld('data')))}
        ${UI.campo('Stallo', UI.select(opzioni, f('stallo')).replace('<select', '<select' + fld('stallo')))}
        ${UI.campo('Ora inizio', UI.input({ tipo: 'time', valore: f('da') }).replace('<input', '<input' + fld('da')))}
        ${UI.campo('Ora fine', UI.input({ tipo: 'time', valore: f('a') }).replace('<input', '<input' + fld('a')))}
      </div>
      <div class="code-box"><span style="font-size:22px">🔑</span>
        <div><div class="code-box-lbl">Codice My2N</div><div class="code-val">${UI.esc(f('codice'))}</div></div>
        ${UI.btn('↻ Rigenera', { azione: 'rigenera-codice', stile: 'margin-left:auto' })}
      </div>`;
  },
  footer: (c) => chiudi() + ok('Invia Codice', 'invia-dip-pass', { dipendenteId: c.dipendenteId })
});

Modals.register('req-pass', {
  size: 'modal-lg',
  titolo: () => '🔔 Richiesta Pass Visitatore',
  body: (c) => {
    const r = State.richiestePass.find(x => x.id === c.richiestaId);
    if (!r) return UI.alert('Richiesta non trovata.', 'danger');
    const dip = S.dipendente(r.dipendenteId);
    return UI.alert(`<strong>${UI.esc(dip ? dip.nomeCompleto : '—')}</strong> (${UI.esc(dip ? dip.dipartimento : '')}) ha richiesto un pass per un visitatore esterno.`, 'info')
      + UI.infoGrid([
        UI.infoBox('Visitatore', UI.esc(r.visitatoreNome)),
        UI.infoBox('Email', `<span style="font-size:12px">${UI.esc(r.visitatoreEmail)}</span>`),
        UI.infoBox('Azienda', UI.esc(r.azienda)),
        UI.infoBox('Dal', UI.esc(U.fmtMedium(U.fromISO(r.dataInizio)))),
        UI.infoBox('Al', UI.esc(U.fmtMedium(U.fromISO(r.dataFine))) + ' <span class="muted" style="font-size:11px">· H24</span>'),
        UI.infoBox('Stato', UI.badge(r.stato === 'in_attesa' ? 'In attesa' : r.stato, r.stato === 'in_attesa' ? 'amber' : 'green'))
      ])
      + UI.campo('Note FM', UI.input({ placeholder: 'Note opzionali…' }).replace('<input', '<input' + fld('note')));
  },
  footer: (c) => UI.btn('Rifiuta', { azione: 'rifiuta-req', params: { richiestaId: c.richiestaId }, variante: 'btn-danger', sm: false })
    + chiudi('Chiudi')
    + ok('Approva e Invia', 'approva-req', { richiestaId: c.richiestaId })
});

/* ============================================================================
   VISITATORI
============================================================================ */
Modals.register('add-vis', {
  size: 'modal-lg',
  initForm: () => ({ data: U.OGGI_ISO, da: '09:00', a: '18:00', referente: 'FM', codice: String(U.rInt(1000, 9999)) }),
  titolo: () => '🪪 Crea Pass Visitatore',
  body: () => {
    const fmDefault = S.facilityManager() || {};
    const referenti = State.utentiPiattaforma.map(u => ({ v: u.id, l: u.nomeCompleto + ' (' + S.etichettaRuolo(u.ruolo) + ')' }))
      .concat(State.dipendenti.filter(d => d.inEvidenza && d.stato === 'attivo').map(d => ({ v: d.id, l: d.nomeCompleto })));
    return UI.alert('Il visitatore riceverà il <strong>codice My2N</strong> via email. Il referente riceverà conferma.', 'info') + `
      <div class="form-grid2">
        ${UI.campo('Nome visitatore', UI.input({ placeholder: 'Nome Cognome' }).replace('<input', '<input' + fld('nome')))}
        ${UI.campo('Email visitatore ✱', UI.input({ tipo: 'email', placeholder: 'email@azienda.com' }).replace('<input', '<input' + fld('email')))}
        ${UI.campo('Azienda', UI.input({ placeholder: 'Azienda' }).replace('<input', '<input' + fld('azienda')))}
        ${UI.campo('Data', UI.input({ tipo: 'date', valore: f('data') }).replace('<input', '<input' + fld('data')))}
        ${UI.campo('Ora inizio', UI.input({ tipo: 'time', valore: f('da') }).replace('<input', '<input' + fld('da')))}
        ${UI.campo('Ora fine', UI.input({ tipo: 'time', valore: f('a') }).replace('<input', '<input' + fld('a')))}
        ${UI.campo('Referente interno', UI.select(referenti, f('referente', fmDefault.id)).replace('<select', '<select' + fld('referente')))}
        ${UI.campo('Email referente', UI.input({ tipo: 'email', valore: fmDefault.email || '' }).replace('<input', '<input' + fld('emailReferente')))}
      </div>
      <div class="code-box"><span style="font-size:22px">🔑</span>
        <div><div class="code-box-lbl">Codice My2N (generato automaticamente)</div>
        <div class="code-val">${UI.esc(f('codice'))}</div>
        <div class="code-box-lbl" style="font-size:10px;margin-top:2px">Valido solo nella fascia oraria selezionata</div></div>
        ${UI.btn('↻ Rigenera', { azione: 'rigenera-codice', stile: 'margin-left:auto' })}
      </div>`;
  },
  footer: () => chiudi() + ok('Genera e Invia Codice', 'crea-visitatore')
});

Modals.register('vis-det', {
  titolo: (c) => { const v = S.visitatore(c.visitatoreId); return `🪪 ${UI.esc(v ? v.nome : 'Visitatore')}`; },
  body: (c) => {
    const v = S.visitatore(c.visitatoreId);
    if (!v) return UI.alert('Visitatore non trovato.', 'danger');
    const stati = { atteso: ['Atteso', 'amber'], dentro: ['Dentro', 'cyan'], uscito: ['Uscito', 'gray'], revocato: ['Revocato', 'red'] };
    const [lbl, col] = stati[v.stato] || ['—', 'gray'];
    return `
      ${v.zonaErrata ? UI.alert('🚧 <strong>Zona errata</strong> — il veicolo risulta fuori dall\'area autorizzata dal pass.', 'danger') : ''}
      ${v.scaduto ? UI.alert('⏰ Pass <strong>scaduto</strong>: l\'orario di fine è superato e il check-out non è stato registrato.', 'warn') : ''}
      ${UI.infoGrid([
        UI.infoBox('Visitatore', UI.esc(v.nome)),
        UI.infoBox('Azienda', UI.esc(v.azienda)),
        UI.infoBox('Pass', UI.esc(v.passId), true),
        UI.infoBox('Codice My2N', UI.esc(v.codiceMy2N), true),
        UI.infoBox('Stallo', UI.esc(v.stalloId || '—')),
        UI.infoBox('Validità', `${UI.esc(v.oraInizio)} – ${UI.esc(v.oraFine)}`, true),
        UI.infoBox('Stato', UI.badge(lbl, col)),
        UI.infoBox('Referente', UI.esc(S.nomePersona(v.referenteId)))
      ])}
      ${v.zonaErrata ? UI.campo('Azione correttiva', UI.select([
          { v: 'notifica', l: 'Notifica il referente' },
          { v: 'riassegna', l: 'Riassegna a stallo corretto in Zona V' },
          { v: 'revoca', l: 'Revoca il pass' }
        ], f('azione', 'notifica')).replace('<select', '<select' + fld('azione'))) : ''}
    `;
  },
  footer: (c) => {
    const v = S.visitatore(c.visitatoreId);
    return UI.btn('Revoca', { azione: 'revoca-pass', params: { visitatoreId: c.visitatoreId }, variante: 'btn-danger', sm: false })
      + chiudi('Chiudi')
      + (v && v.zonaErrata ? UI.btn('Applica azione', { azione: 'risolvi-zona-errata', params: { visitatoreId: c.visitatoreId }, variante: 'btn-primary', sm: false }) : '')
      + ok('Estendi (+2h)', 'estendi-pass', { visitatoreId: c.visitatoreId });
  }
});

/* ============================================================================
   SEGNALAZIONI
============================================================================ */
Modals.register('seg', {
  size: 'modal-lg',
  initForm: () => ({ azione: 'assegna_alternativo' }),
  titolo: (c) => { const s = S.segnalazione(c.segId); return `${s ? D.TIPO_SEGNALAZIONE[s.tipo].icona : '🚨'} ${UI.esc(s ? s.titolo : 'Segnalazione')}`; },
  body: (c) => {
    const seg = S.segnalazione(c.segId);
    if (!seg) return UI.alert('Segnalazione non trovata.', 'danger');
    const segnalante = S.dipendente(seg.segnalanteId);
    const alt = S.assegnaStalloAutomatico(seg.segnalanteId, U.OGGI_ISO);

    const opzioni = {
      abusivo: [
        { v: 'assegna_alternativo', icona: '🚗', titolo: 'Assegna stallo alternativo' + (segnalante ? ' a ' + segnalante.nome : ''), sub: alt ? `${alt} (libero) — notifica via app` : 'Nessuno stallo libero disponibile' },
        { v: 'blocca_veicolo', icona: '🚫', titolo: 'Blocca veicolo / utente', sub: 'Segnala la targa come non autorizzata', colore: 'red' }
      ],
      durata: [
        { v: 'rinvia_notifica', icona: '📢', titolo: 'Invia seconda notifica', sub: 'Sollecito al conducente' },
        { v: 'risolvi', icona: '✓', titolo: 'Chiudi la segnalazione', sub: 'Il veicolo è uscito / caso rientrato' }
      ],
      zona: [
        { v: 'assegna_alternativo', icona: '🚗', titolo: 'Riassegna stallo corretto', sub: 'Sposta nella zona autorizzata dal pass' },
        { v: 'risolvi', icona: '✓', titolo: 'Chiudi la segnalazione', sub: 'Verificato, nessuna azione necessaria' }
      ]
    };
    const lista = opzioni[seg.tipo] || [
      { v: 'risolvi', icona: '✓', titolo: 'Segna come risolta', sub: 'Intervento effettuato' },
      { v: 'rinvia_notifica', icona: '📢', titolo: 'Notifica il team tecnico', sub: 'Apri un intervento di manutenzione' }
    ];

    return `
      ${UI.alert(UI.esc(seg.descrizione), seg.gravita === 'urgente' ? 'danger' : 'warn')}
      ${UI.infoGrid([
        UI.infoBox('Stallo', UI.esc(seg.stalloId || '—')),
        UI.infoBox('Targa', seg.targa ? `<span class="mono">${UI.esc(seg.targa)}</span>` : '<span class="muted">—</span>'),
        UI.infoBox('Segnalato da', segnalante ? UI.esc(segnalante.nomeCompleto) : '<span class="muted">Rilevazione automatica</span>'),
        UI.infoBox('Aperta da', S.durataSegnalazione(seg))
      ])}
      ${seg.policyOre ? UI.alert(`⏰ Sosta in corso: <strong>${UI.esc(S.durataSosta((State.accessi.find(a => a.stalloId === seg.stalloId && !a.uscita) || {}).id))}</strong> · policy max ${seg.policyOre}h.`, 'warn') : ''}
      ${seg.note.length ? `<div class="form-label" style="margin-bottom:6px">Storico</div>${seg.note.map(n => `<div class="setting-row"><div class="setting-desc">• ${UI.esc(n)}</div></div>`).join('')}<div class="sep"></div>` : ''}
      <div style="font-weight:700;font-size:13px;margin-bottom:10px">Azione</div>
      ${lista.map(o => UI.opt({ icona: o.icona, titolo: o.titolo, sub: o.sub, coloreTitolo: o.colore, sel: f('azione', lista[0].v) === o.v, azione: 'sel-azione-seg', params: { valore: o.v } })).join('')}
    `;
  },
  footer: (c) => {
    const seg = S.segnalazione(c.segId);
    return chiudi() + UI.btn('Conferma azione', {
      azione: 'conferma-seg', params: { segId: c.segId },
      variante: seg && seg.gravita === 'urgente' ? 'btn-danger' : 'btn-primary', sm: false
    });
  }
});

/* ============================================================================
   HARDWARE
============================================================================ */
Modals.register('hw', {
  titolo: (c) => { const h = S.dispositivo(c.hardwareId); return `⚡ ${UI.esc(h ? h.nome : 'Dispositivo')}`; },
  body: (c) => {
    const h = S.dispositivo(c.hardwareId);
    if (!h) return UI.alert('Dispositivo non trovato.', 'danger');
    return `
      ${h.stato === 'anomalia' ? UI.alert(`⚠ ${UI.esc(h.messaggio)}`, 'danger') : UI.alert('✓ Dispositivo operativo, nessuna anomalia rilevata.', 'success')}
      ${UI.infoGrid([
        UI.infoBox('Tipo', UI.esc(h.tipo)),
        UI.infoBox('Ruolo', UI.esc(h.ruolo === 'principale' ? 'Principale' : 'Ausiliario')),
        UI.infoBox('Indirizzo IP', UI.esc(h.ip), true),
        UI.infoBox('Firmware', UI.esc(h.firmware), true),
        UI.infoBox('Cicli oggi', h.cicli),
        UI.infoBox('Ultimo evento', `<span style="font-size:12px">${UI.esc(h.ultimoEvento)}</span>`)
      ])}
      ${h.ticket ? UI.alert(`🎫 Ticket <strong>${UI.esc(h.ticket)}</strong> aperto verso l'assistenza.`, 'info') : ''}
    `;
  },
  footer: (c) => {
    const h = S.dispositivo(c.hardwareId);
    return chiudi('Chiudi')
      + UI.btn('⬆ Aggiorna firmware', { azione: 'aggiorna-fw', params: { hardwareId: c.hardwareId }, sm: false })
      + (h && h.stato === 'anomalia' ? ok('Apri ticket', 'apri-ticket', { hardwareId: c.hardwareId }) : '');
  }
});

/* ============================================================================
   MAPPA — Aggiungi stallo
============================================================================ */
Modals.register('add-stallo', {
  size: 'modal-lg',
  initForm: () => ({ zona: 'A', tipo: 'standard', durata: 10, disponibilita: 'sempre', titolare: '', note: '' }),
  titolo: () => '🅿️ Aggiungi Nuovo Stallo',
  body: () => {
    const zona = f('zona', 'A');
    const tipo = f('tipo', 'standard');
    const codice = S.prossimoCodiceStallo(zona);
    const z = S.zona(zona);
    const tipoDef = D.TIPO_STALLO[tipo];
    const candidati = [{ v: '', l: '— Nessuno / Pool rotante —' }]
      .concat(State.dipendenti.filter(d => d.inEvidenza && d.stato === 'attivo').map(d => ({ v: d.id, l: d.nomeCompleto })));

    return UI.alert('ℹ️ Il nuovo stallo sarà immediatamente visibile in mappa e disponibile per le prenotazioni.', 'info') + `
      <div class="form-grid2">
        ${UI.campo('Zona', UI.select(State.zone.map(x => ({ v: x.id, l: x.nome })), zona, { azione: 'refresh-modale' }).replace('<select', '<select' + fld('zona')))}
        ${UI.campo('Codice stallo (auto-generato)', `<div class="spot-assegnato">
          <span class="mono spot-assegnato-code" style="font-size:15px">${UI.esc(codice)}</span>
          <span class="spot-assegnato-meta">prossimo disponibile</span></div>`)}
        ${UI.campo('Tipo', UI.select(OPZ_TIPO_STALLO, tipo, { azione: 'refresh-modale' }).replace('<select', '<select' + fld('tipo')))}
        ${UI.campo('Durata massima sosta (ore)', UI.input({ tipo: 'number', valore: f('durata', 10), min: 1, max: 24 }).replace('<input', '<input' + fld('durata')))}
        ${UI.campo('Disponibilità', UI.select(OPZ_DISPONIBILITA, f('disponibilita')).replace('<select', '<select' + fld('disponibilita')))}
        ${UI.campo('Assegna a dipendente (opzionale)', UI.select(candidati, f('titolare')).replace('<select', '<select' + fld('titolare')))}
      </div>
      ${UI.campo('Note (opzionale)', UI.input({ valore: f('note'), placeholder: 'Es: vicino all\'ascensore, colonnina 22 kW…' }).replace('<input', '<input' + fld('note')))}
      <div class="periodo-box" style="padding:12px;margin-top:4px">
        <div class="form-label" style="margin-bottom:6px">Anteprima</div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="mspot ${tipoDef.cls}" style="pointer-events:none;width:54px;height:44px;font-size:10px">${tipoDef.icona}${UI.esc(codice)}</div>
          <div><div style="font-weight:700;font-size:13px">Stallo ${UI.esc(codice)} · ${UI.esc(tipoDef.label)} · ${UI.esc(z ? z.nome : '')}</div>
          <div style="font-size:11px;color:var(--text-muted)">${UI.esc(D.DISPONIBILITA[f('disponibilita', 'sempre')])} · ${f('titolare') ? UI.esc(S.nomePersona(f('titolare'))) : 'nessun dipendente assegnato'}</div></div>
        </div>
      </div>`;
  },
  footer: () => chiudi() + ok('🅿️ Aggiungi Stallo', 'crea-stallo')
});

/* ============================================================================
   PRENOTAZIONI — Nuova prenotazione FM
============================================================================ */
Modals.register('add-bk', {
  initForm: () => ({ dipendente: '', data: U.OGGI_ISO, tipo: 'ufficio', stallo: '' }),
  titolo: () => '📅 Nuova Prenotazione (FM)',
  body: () => {
    const dips = State.dipendenti.filter(d => d.stato === 'attivo' && d.inEvidenza).map(d => ({ v: d.id, l: d.nomeCompleto }));
    const dipId = f('dipendente', dips[0] ? dips[0].v : '');
    const data = f('data', U.OGGI_ISO);
    const liberi = [{ v: '', l: 'Auto-assegna (stallo più vicino)' }]
      .concat(S.stalliDisponibiliPer(dipId, data).slice(0, 25).map(c => ({ v: c, l: c + ' (libero)' })));
    const esistente = dipId ? S.prenotazione(dipId, data) : null;
    return `
      ${esistente ? UI.alert(`⚠ Esiste già una prenotazione per questo giorno (${esistente.tipo === 'sw' ? 'Smart Working' : 'Stallo ' + UI.esc(esistente.stalloId)}). Confermando verrà sostituita.`, 'warn') : ''}
      <div class="form-grid2">
        ${UI.campo('Dipendente', UI.select(dips, dipId, { azione: 'refresh-modale' }).replace('<select', '<select' + fld('dipendente')))}
        ${UI.campo('Data', UI.input({ tipo: 'date', valore: data, azione: 'refresh-modale' }).replace('<input', '<input' + fld('data')))}
        ${UI.campo('Tipo', UI.select([{ v: 'ufficio', l: 'In ufficio' }, { v: 'sw', l: 'Smart Working' }], f('tipo'), { azione: 'refresh-modale' }).replace('<select', '<select' + fld('tipo')))}
        ${f('tipo', 'ufficio') === 'ufficio' ? UI.campo('Stallo', UI.select(liberi, f('stallo')).replace('<select', '<select' + fld('stallo'))) : ''}
      </div>
      ${f('tipo', 'ufficio') === 'ufficio' && liberi.length === 1 ? UI.alert('Nessuno stallo libero in questa data.', 'danger') : ''}`;
  },
  footer: () => chiudi() + ok('Conferma', 'crea-prenotazione-fm')
});

/* ============================================================================
   CONFIG — Policy
============================================================================ */
Modals.register('policy', {
  initForm: () => Object.assign({}, State.config.prenotazioni),
  titolo: () => '⚙ Modifica Policy Prenotazioni',
  body: () => `
    <div class="form-grid2">
      ${UI.campo('Finestra prenotazione (giorni lavorativi)', UI.input({ tipo: 'number', valore: f('finestraGiorniLavorativi'), min: 1, max: 20 }).replace('<input', '<input' + fld('finestraGiorniLavorativi')))}
      ${UI.campo('No-show: libera dopo (minuti)', UI.input({ tipo: 'number', valore: f('noShowMinuti'), min: 5, max: 180 }).replace('<input', '<input' + fld('noShowMinuti')))}
      ${UI.campo('Durata max sosta dipendenti (ore)', UI.input({ tipo: 'number', valore: f('durataMaxDipendenteOre'), min: 1, max: 24 }).replace('<input', '<input' + fld('durataMaxDipendenteOre')))}
      ${UI.campo('Notifica sosta prolungata a (ore)', UI.input({ tipo: 'number', valore: f('notificaDurataOre'), min: 1, max: 24 }).replace('<input', '<input' + fld('notificaDurataOre')))}
      ${UI.campo('Durata max sosta EV (ore)', UI.input({ tipo: 'number', valore: f('durataMaxEvOre'), min: 1, max: 24 }).replace('<input', '<input' + fld('durataMaxEvOre')))}
      ${UI.campo('Blocco dopo N violazioni', UI.input({ tipo: 'number', valore: f('sogliaViolazioni'), min: 1, max: 10 }).replace('<input', '<input' + fld('sogliaViolazioni')))}
    </div>
    ${UI.alert('La finestra di prenotazione si riflette immediatamente nella Vista Dipendente.', 'info')}`,
  footer: () => chiudi() + ok('Salva', 'salva-policy')
});

/* ============================================================================
   EXPORT / PERIODO
============================================================================ */
Modals.register('export', {
  size: 'modal-lg',
  initForm: () => ({ report: 'completo', formato: 'PDF', email: State.config.export.destinatario }),
  titolo: () => '⤓ Esporta Report',
  body: () => {
    const tipi = [
      { v: 'completo', icona: '📊', titolo: 'Report Completo', sub: 'Accessi, prenotazioni, segnalazioni, hardware' },
      { v: 'accessi', icona: '⇆', titolo: 'Log Accessi', sub: `${S.kpiAccessi().ingressi} record nel periodo selezionato` },
      { v: 'segnalazioni', icona: '🚨', titolo: 'Segnalazioni & Violazioni', sub: `${S.kpiSegnalazioni().aperte + S.kpiSegnalazioni().inGestione} aperte · ${S.kpiSegnalazioni().risolteMese} risolte` },
      { v: 'dipendenti', icona: '👥', titolo: 'Report Dipendenti', sub: `${S.kpiDipendenti().autorizzati} autorizzati` }
    ];
    return tipi.map(t => UI.opt({ icona: t.icona, titolo: t.titolo, sub: t.sub, sel: f('report', 'completo') === t.v, azione: 'sel-report', params: { valore: t.v } })).join('')
      + '<div class="sep"></div>'
      + `<div class="form-grid2">
        ${UI.campo('Periodo', `<div class="periodo-box">${UI.esc(State.config.periodo.label)}</div>`)}
        ${UI.campo('Formato', UI.select(['PDF', 'Excel (.xlsx)', 'CSV', 'JSON'], f('formato')).replace('<select', '<select' + fld('formato')))}
      </div>`
      + UI.campo('Invia a', UI.input({ tipo: 'email', valore: f('email') }).replace('<input', '<input' + fld('email')));
  },
  footer: () => chiudi() + ok('Genera ed Esporta', 'genera-export')
});

Modals.register('daterange', {
  initForm: () => ({ dal: State.config.periodo.dal, al: State.config.periodo.al }),
  titolo: () => '📅 Periodo',
  body: () => {
    const attivo = State.config.periodo.tipo;
    const quick = [['oggi', 'Oggi'], ['settimana', 'Questa settimana'], ['mese', 'Questo mese'], ['trimestre', 'Trimestre corrente']];
    return UI.alert('Default: <strong>giorno corrente</strong>. Le selezioni multi-giorno mostrano <strong>medie giornaliere</strong> nei KPI.', 'info')
      + `<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px">
        ${quick.map(([v, l]) => UI.btn(l, { azione: 'set-periodo', params: { valore: v }, variante: attivo === v ? 'btn-primary' : 'btn-ghost' })).join('')}
      </div>
      <div class="form-grid2">
        ${UI.campo('Dal', UI.input({ tipo: 'date', valore: f('dal') }).replace('<input', '<input' + fld('dal')))}
        ${UI.campo('Al', UI.input({ tipo: 'date', valore: f('al') }).replace('<input', '<input' + fld('al')))}
      </div>`;
  },
  footer: () => chiudi() + ok('Applica', 'applica-periodo')
});

/* ============================================================================
   VISTA DIPENDENTE
============================================================================ */
Modals.register('emp-book', {
  initForm: (c) => {
    const dip = S.dipendenteCorrente();
    if (!dip) return {};
    const pre = S.prenotazione(dip.id, c.giornoISO);
    const auto = S.assegnaStalloConMotivo(dip.id, c.giornoISO);
    return {
      tipo: pre ? pre.tipo : 'ufficio',
      stallo: pre ? pre.stalloId : auto.stalloId,
      /* Il motivo va DEDOTTO dallo stallo effettivo: una prenotazione esistente
         puo' essere su uno stallo diverso da quello fisso (se era occupato). */
      motivoAssegnazione: pre ? S.motivoPerStallo(dip.id, pre.stalloId) : auto.motivo
    };
  },
  titolo: (c) => '📅 ' + UI.esc(U.fmtMedium(U.fromISO(c.giornoISO))),
  body: (c) => {
    const dip = S.dipendenteCorrente();
    if (!dip) return UI.alert('Sessione non valida per la Vista Dipendente.', 'warn');
    const pre = S.prenotazione(dip.id, c.giornoISO);
    const tipo = f('tipo', 'ufficio');
    /* Modalita' a turni: PRIMA si sceglie il turno, poi il sistema assegna.
       Finche' non e' scelto non ha senso mostrare uno stallo, perche' la
       disponibilita' dipende dal turno. */
    if (State.config.modalitaPrenotazione === 'turni' && tipo === 'ufficio') {
      const turnoSel = f('turnoId', '');
      const cards = (State.config.turni || []).map(t => {
        const liberi = S.stalliDisponibiliPer(dip.id, c.giornoISO, t.id).length;
        const pieno = liberi === 0;
        return `<div class="turno-card${turnoSel === t.id ? ' active' : ''}${pieno ? ' pieno' : ''}"${pieno ? '' : UI.act('emp-sel-turno', { turnoId: t.id })}>
          <div class="turno-card-hd">
            <div class="turno-card-lbl">${UI.esc(t.label)}</div>
            ${UI.badge(pieno ? 'Esaurito' : 'Disponibile', pieno ? 'red' : 'green')}
          </div>
          <div class="turno-card-ora mono">${UI.esc(t.inizio)} – ${UI.esc(t.fine)}</div>
          <div class="turno-card-posti">${liberi} post${liberi === 1 ? 'o' : 'i'} disponibil${liberi === 1 ? 'e' : 'i'}</div>
        </div>`;
      }).join('');
      const auto = turnoSel ? S.assegnaStalloConMotivo(dip.id, c.giornoISO, turnoSel) : null;
      return (pre ? UI.alert('Hai già una prenotazione per questo giorno: confermando verrà sostituita.', 'warn') : '')
        + `<div class="form-label" style="margin-bottom:8px">Seleziona il tuo turno</div>
           <div class="turni-cards">${cards}</div>`
        + (auto && auto.stalloId
            ? UI.alert(`Stallo assegnato: <strong>${UI.esc(auto.stalloId)}</strong> — ${UI.esc(S.motivoAssegnazione(auto.motivo))}.`, 'info')
              + `<div class="form-hint">Il tuo turno include ±${State.config.tolleranzaCambioTurnoMin} min di tolleranza per il cambio consegne</div>`
            : turnoSel
              ? UI.alert('Nessuno stallo disponibile in questo turno.', 'danger')
              : `<div class="form-hint">Scegli un turno per vedere lo stallo che ti verrà assegnato.</div>`);
    }
    const stallo = f('stallo') || S.assegnaStalloAutomatico(dip.id, c.giornoISO);
    const st = stallo ? S.stallo(stallo) : null;

    return `
      ${pre
        ? UI.alert(pre.tipo === 'ufficio'
            ? `✅ Giorno già prenotato — stallo <strong>${UI.esc(pre.stalloId)}</strong>. Puoi cambiarlo o cancellarlo.`
            : '🏠 Hai dichiarato <strong>Smart Working</strong> per questo giorno.', 'success')
        : UI.alert('Seleziona come passerai la giornata.', 'info')}
      <div style="display:flex;gap:10px;margin-bottom:14px">
        <div class="opt-card${tipo === 'ufficio' ? ' sel-blue' : ''}" data-act="emp-sel-tipo" data-valore="ufficio">
          <div class="opt-card-ico">🏢</div>
          <div class="opt-card-title">Vengo in ufficio</div>
          <div class="opt-card-sub">Stallo riservato</div>
        </div>
        <div class="opt-card${tipo === 'sw' ? ' sel-amber' : ''}" data-act="emp-sel-tipo" data-valore="sw">
          <div class="opt-card-ico">🏠</div>
          <div class="opt-card-title">Smart Working</div>
          <div class="opt-card-sub">Stallo non necessario</div>
        </div>
      </div>
      ${tipo === 'ufficio' ? (stallo ? UI.campo('Stallo assegnato', `
        <div class="spot-assegnato">
          <div style="flex:1">
            <span class="spot-assegnato-code">${UI.esc(stallo)}</span>
            <span class="spot-assegnato-meta">${UI.esc(st ? st.piano : '')}</span>
            <small class="spot-motivo">Assegnato automaticamente — ${UI.esc(S.motivoAssegnazione(f('motivoAssegnazione')))}</small>
          </div>
          ${UI.btn('Cambia ↻', { azione: 'emp-cambia-stallo', params: { giornoIso: c.giornoISO }, stile: 'margin-left:auto' })}
        </div>`)
        : UI.alert('Nessuno stallo disponibile per questo giorno. Prova con un altro giorno o dichiara Smart Working.', 'danger')) : ''}
    `;
  },
  footer: (c) => {
    const dip = S.dipendenteCorrente();
    if (!dip) return chiudi('Chiudi');
    const pre = S.prenotazione(dip.id, c.giornoISO);
    const tipo = f('tipo', 'ufficio');
    if (State.config.modalitaPrenotazione === 'turni' && tipo === 'ufficio') {
      const turnoSel = f('turnoId', '');
      const auto = turnoSel ? S.assegnaStalloConMotivo(dip.id, c.giornoISO, turnoSel) : null;
      return chiudi() + UI.btn('Conferma prenotazione', {
        azione: 'emp-conferma', params: { giornoIso: c.giornoISO },
        variante: 'btn-primary', sm: false, disabled: !(auto && auto.stalloId) });
    }
    return (pre ? UI.btn('Cancella prenotazione', { azione: 'emp-cancella', params: { giornoIso: c.giornoISO }, variante: 'btn-danger', sm: false }) : chiudi())
      + ok(tipo === 'sw' ? '✓ Dichiara Smart Working' : '✓ Conferma prenotazione', 'emp-conferma', { giornoIso: c.giornoISO });
  }
});

Modals.register('emp-cancel', {
  titolo: () => 'Cancella Prenotazione',
  body: (c) => {
    const dip = S.dipendenteCorrente();
    if (!dip) return UI.alert('Sessione non valida.', 'warn');
    const pre = S.prenotazione(dip.id, c.giornoISO);
    return UI.alert(`⚠ Vuoi cancellare la prenotazione di <strong>${UI.esc(U.fmtMedium(U.fromISO(c.giornoISO)))}</strong>?${pre && pre.stalloId ? ` Lo stallo <strong>${UI.esc(pre.stalloId)}</strong> tornerà disponibile per gli altri colleghi.` : ''}`, 'warn');
  },
  footer: (c) => chiudi() + UI.btn('Cancella prenotazione', { azione: 'emp-cancella', params: { giornoIso: c.giornoISO }, variante: 'btn-danger', sm: false })
});

Modals.register('emp-segnala', {
  initForm: () => ({ tipo: 'abusivo' }),
  titolo: () => '🚨 Segnala Problema',
  body: () => {
    const dip = S.dipendenteCorrente();
    if (!dip) return UI.alert('Sessione non valida.', 'warn');
    const pre = S.prenotazione(dip.id, U.OGGI_ISO);
    return UI.alert(`ℹ️ Stai segnalando un problema${pre && pre.stalloId ? ' sullo stallo <strong>' + UI.esc(pre.stalloId) + '</strong>' : ''}. Il Facility Manager riceverà notifica immediata.`, 'info')
      + UI.campo('Tipo problema', UI.select([
          { v: 'abusivo', l: '🚗 Stallo occupato da veicolo non autorizzato' },
          { v: 'guasto',  l: '⚠️ Stallo danneggiato' },
          { v: 'ev',      l: '🔋 Colonnina EV non funzionante' },
          { v: 'altro',   l: '🚧 Altro problema' }
        ], f('tipo')).replace('<select', '<select' + fld('tipo')))
      + UI.campo('Note aggiuntive', `<textarea class="form-textarea"${fld('note')} placeholder="Descrivi il problema… (targa se disponibile)"></textarea>`);
  },
  footer: () => chiudi() + UI.btn('Invia Segnalazione', { azione: 'emp-invia-segnalazione', variante: 'btn-danger', sm: false })
});

/** Richiesta di pass visitatore inoltrata dal dipendente al FM.
    Visibile solo a chi ha puoRichiederePass: il pulsante che lo apre non viene
    nemmeno reso agli altri. */
Modals.register('emp-richiedi-pass', {
  size: 'modal-lg',
  initForm: () => ({ dataInizio: U.OGGI_ISO, dataFine: U.OGGI_ISO }),
  titolo: () => '🪪 Richiedi Pass Visitatore',
  body: () => {
    const d = S.dipendenteCorrente();
    if (!d) return UI.alert('Sessione non valida.', 'warn');
    const dal = f('dataInizio', U.OGGI_ISO);
    const al  = f('dataFine', U.OGGI_ISO);
    const invertito = al < dal;
    const giorni = invertito ? 0
      : Math.round((U.fromISO(al) - U.fromISO(dal)) / 86400000) + 1;
    return UI.alert('Il Facility Manager approva o rifiuta la richiesta. Il pass non è attivo finché non viene approvato.', 'info')
      + `<div class="form-grid2">
        ${UI.campo('Nome visitatore *', UI.input({ valore: f('visitatoreNome', ''), placeholder: 'Nome e cognome', focusKey: 'req-nome' }).replace('<input', '<input' + fld('visitatoreNome')))}
        ${UI.campo('Email visitatore *', UI.input({ tipo: 'email', valore: f('visitatoreEmail', ''), placeholder: 'nome@azienda.com', focusKey: 'req-email' }).replace('<input', '<input' + fld('visitatoreEmail')))}
        ${UI.campo('Azienda', UI.input({ valore: f('azienda', ''), placeholder: 'Azienda di provenienza', focusKey: 'req-azienda' }).replace('<input', '<input' + fld('azienda')))}
        <div></div>
        ${UI.campo('Data inizio *', UI.input({ tipo: 'date', valore: dal, azione: 'refresh-modale', focusKey: 'req-dal' }).replace('<input', '<input' + fld('dataInizio')))}
        ${UI.campo('Data fine *', UI.input({ tipo: 'date', valore: al, min: dal, azione: 'refresh-modale', focusKey: 'req-al' }).replace('<input', '<input' + fld('dataFine')))}
      </div>`
      + (invertito
          ? UI.alert('La <strong>data fine</strong> non può precedere la data inizio.', 'danger')
          : `<div class="form-hint">Pass valido <strong>H24</strong> per ${giorni} giorn${giorni === 1 ? 'o' : 'i'}, dal ${UI.esc(U.fmtDM(U.fromISO(dal)))} al ${UI.esc(U.fmtDM(U.fromISO(al)))}.</div>`)
      + UI.campo('Note per il FM', `<textarea class="form-textarea"${fld('note')} placeholder="Motivo della visita, indicazioni particolari…">${UI.esc(f('note', ''))}</textarea>`);
  },
  footer: () => chiudi() + ok('Invia richiesta', 'emp-invia-richiesta-pass')
});

Modals.register('emp-profile', {
  titolo: () => '👤 Il mio profilo',
  body: () => {
    const d = S.dipendenteCorrente();
    if (!d) return UI.alert('Sessione non valida.', 'warn');
    return `<div style="display:flex;align-items:center;gap:14px;padding:14px;background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--r);margin-bottom:16px">
        ${UI.avatar(d.iniziali, 'width:46px;height:46px;font-size:17px')}
        <div><div style="font-size:15px;font-weight:700">${UI.esc(d.nomeCompleto)}</div>
        <div style="font-size:12px;color:var(--text-muted)">${UI.esc(d.dipartimento)} · ${UI.esc(d.email)}</div></div>
      </div>`
      + UI.infoGrid([
        UI.infoBox('Stallo assegnato', d.stalloId ? `${UI.esc(d.stalloId)} · ${UI.esc((S.stallo(d.stalloId) || {}).piano || '')}` : '<span class="muted">Pool rotante</span>'),
        UI.infoBox('Accessi (mese)', d.accessiMese),
        UI.infoBox('Segnalazioni fatte', d.segnalazioniFatte)
      ]);
  },
  footer: () => chiudi('Chiudi') + UI.btn('⏻ Esci', { azione: 'logout', variante: 'btn-danger', sm: false })
});

Modals.register('emp-history', {
  size: 'modal-lg',
  titolo: () => '📋 Storico Prenotazioni',
  body: () => {
    const d = S.dipendenteCorrente();
    if (!d) return UI.alert('Sessione non valida.', 'warn');
    const passate = State.prenotazioni
      .filter(p => p.dipendenteId === d.id && p.data < U.OGGI_ISO)
      .sort((a, b) => b.data.localeCompare(a.data)).slice(0, 12);
    if (!passate.length) return UI.vuoto('Nessuna prenotazione passata registrata.');
    return UI.tabella({
      head: ['Data', 'Stallo', 'Check-in', 'Check-out', 'Stato'],
      rows: passate.map(p => `<tr>
        <td class="mono">${UI.esc(U.fmtDM(U.fromISO(p.data)))}</td>
        <td>${UI.esc(p.stalloId || '–')}</td>
        <td class="mono">${UI.esc(p.checkIn || '–')}</td>
        <td class="mono">${UI.esc(p.checkOut || '–')}</td>
        <td>${p.tipo === 'sw' ? UI.badge('Smart Working', 'amber') : p.stato === 'annullata' ? UI.badge('Annullata', 'gray') : UI.badge('Completato', 'green')}</td>
      </tr>`)
    });
  },
  footer: () => chiudi('Chiudi')
});

/* ============================================================================
   AMMINISTRAZIONE — utenti di piattaforma (solo Admin)
============================================================================ */
Modals.register('add-platform-user', {
  size: 'modal-lg',
  initForm: () => ({ ruolo: 'fm', sede: 'SEDE-DEMO' }),
  titolo: () => '＋ Aggiungi utente di piattaforma',
  body: () => {
    const ruolo = f('ruolo', 'fm');
    const ruoliDisponibili = [];
    if (S.puo('creaAdmin')) ruoliDisponibili.push({ v: 'admin', l: 'Admin' });
    if (S.puo('creaFM'))    ruoliDisponibili.push({ v: 'fm', l: 'Facility Manager' });
    return UI.alert("L'utente riceverà un invito via email con il link di attivazione. Non esiste registrazione pubblica.", 'info') + `
      <div class="form-grid2">
        ${UI.campo('Nome ✱', UI.input({ valore: f('nome', ''), placeholder: 'Nome' }).replace('<input', '<input' + fld('nome')))}
        ${UI.campo('Cognome ✱', UI.input({ valore: f('cognome', ''), placeholder: 'Cognome' }).replace('<input', '<input' + fld('cognome')))}
        ${UI.campo('Email ✱', UI.input({ tipo: 'email', valore: f('email', ''), placeholder: 'nome@parkingcloud.eu' }).replace('<input', '<input' + fld('email')))}
        ${UI.campo('Ruolo', UI.select(ruoliDisponibili, ruolo, { azione: 'refresh-modale' }).replace('<select', '<select' + fld('ruolo')))}
      </div>
      ${ruolo === 'fm'
        ? UI.campo('Parcheggio / Sede ✱', UI.select([{ v: 'SEDE-DEMO', l: State.config.sede.nome }], f('sede', 'SEDE-DEMO')).replace('<select', '<select' + fld('sede')))
        : UI.alert('Un <strong>Admin</strong> ha visibilità su tutti i parcheggi: nessuna sede da assegnare.', 'info')}`;
  },
  footer: () => chiudi() + ok('Invia invito', 'crea-utente-piattaforma')
});

Modals.register('platform-user-det', {
  titolo: (c) => { const u = S.utentePiattaforma(c.utenteId); return `👤 ${UI.esc(u ? u.nomeCompleto : '—')}`; },
  body: (c) => {
    const u = S.utentePiattaforma(c.utenteId);
    if (!u) return UI.alert('Utente non trovato.', 'danger');
    const st = D.STATO_ACCOUNT[u.statoAccount] || D.STATO_ACCOUNT.attivo;
    const perm = D.PERMISSIONS[u.ruolo] || {};
    const attivi = Object.keys(perm).filter(k => perm[k]);
    return `
      ${u.statoAccount === 'invito_inviato' ? UI.alert(`📧 Invito inviato a <span class="mono">${UI.esc(u.email)}</span>, in attesa di attivazione.`, 'warn') : ''}
      ${u.statoAccount === 'disattivato' ? UI.alert('🚫 Account disattivato: non può accedere alla piattaforma.', 'danger') : ''}
      ${UI.infoGrid([
        UI.infoBox('Email', `<span class="mono" style="font-size:12px">${UI.esc(u.email)}</span>`),
        UI.infoBox('Ruolo', UI.tag(S.etichettaRuolo(u.ruolo), u.ruolo === 'admin' ? 'cyan' : 'blue')),
        UI.infoBox('Parcheggio', u.sedeId ? UI.esc(State.config.sede.nome) : '<span class="muted">tutte le sedi</span>'),
        UI.infoBox('Stato', UI.badge(st.label, st.colore)),
        UI.infoBox('Ultimo accesso', u.ultimoAccesso ? UI.esc(U.fmtMedium(U.fromISO(u.ultimoAccesso))) : '<span class="muted">mai</span>'),
        UI.infoBox('Invitato da', UI.esc(S.nomePersona(u.invitatoDa)))
      ])}
      <div class="sep"></div>
      <div class="form-label" style="margin-bottom:7px">Permessi attivi (${attivi.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        ${attivi.map(k => UI.tag(k, u.ruolo === 'admin' ? 'cyan' : 'blue')).join('')}
      </div>`;
  },
  footer: (c) => {
    const u = S.utentePiattaforma(c.utenteId);
    return chiudi('Chiudi')
      + (u && u.statoAccount === 'invito_inviato'
          ? UI.btn('▶ Simula attivazione', { azione: 'simula-attivazione-utente', params: { utenteId: c.utenteId }, variante: 'btn-cyan', sm: false })
          : UI.btn('Reinvia invito', { azione: 'reinvia-invito', params: { utenteId: c.utenteId }, sm: false }));
  }
});

/* ============================================================================
   DIPENDENTI — import massivo + conferma creazione con attivazione
============================================================================ */
Modals.register('import-dipendenti', {
  size: 'modal-lg',
  initForm: () => ({ file: null }),
  titolo: () => '⤓ Importa Dipendenti',
  body: () => {
    const file = f('file');
    return UI.alert('Importa una lista di dipendenti da file CSV o Excel. Ognuno riceverà un invito di attivazione.', 'info') + `
      <div class="dropzone${file ? ' dropzone-ok' : ''}" data-act="scegli-file">
        <div class="dropzone-ico">${file ? '📄' : '⬆'}</div>
        <div class="dropzone-txt">${file ? UI.esc(file) : 'Trascina il file qui o clicca per selezionare'}</div>
        <div class="dropzone-sub">Formati supportati: .csv, .xlsx</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 10px;gap:10px;flex-wrap:wrap">
        <div class="form-label" style="margin:0">Colonne attese</div>
        ${UI.btn('⤓ Scarica template CSV', { azione: 'scarica-template' })}
      </div>
      <div class="colonne-attese">
        ${['Nome', 'Cognome', 'Email', 'Dipartimento'].map(c => `<span class="tag tag-blue">${c}</span>`).join('')}
        <span class="tag tag-gray">Stallo (opzionale)</span>
      </div>`;
  },
  footer: () => chiudi() + ok('Importa', 'conferma-import')
});

Modals.register('dip-creato', {
  titolo: () => '✓ Dipendente creato',
  body: (c) => {
    const d = S.dipendente(c.dipendenteId);
    if (!d) return UI.alert('Dipendente non trovato.', 'danger');
    return UI.alert(`📧 Invito inviato a <span class="mono">${UI.esc(d.email)}</span>. L'account si attiva dal link ricevuto via email.`, 'success')
      + UI.infoGrid([
        UI.infoBox('Nome', UI.esc(d.nomeCompleto)),
        UI.infoBox('Dipartimento', UI.esc(d.dipartimento)),
        UI.infoBox('Stallo', d.stalloId ? UI.esc(d.stalloId) : '<span class="muted">pool rotante</span>'),
        UI.infoBox('Stato', UI.badge('Invito inviato', 'amber'))
      ])
      + UI.alert('In questa demo puoi simulare il click sul link di invito.', 'info');
  },
  footer: (c) => chiudi('Chiudi')
    + UI.btn('▶ Simula attivazione account', { azione: 'simula-attivazione-dip', params: { dipendenteId: c.dipendenteId }, variante: 'btn-cyan', sm: false })
});

/* ============================================================================
   AMMINISTRAZIONE — conferme distruttive
============================================================================ */
Modals.register('conferma-riduzione', {
  titolo: () => '⚠ Riduzione posti',
  body: (c) => {
    const a = S.anteprimaPosti(c.posti);
    return UI.alert('Stai riducendo il numero di posti del parcheggio.', 'warn')
      + UI.infoGrid([
        UI.infoBox('Posti', S.kpiStalli().totale + ' → ' + UI.esc(c.posti)),
        UI.infoBox('Stalli rimossi', '<span style="color:var(--red-text)">' + a.rimossi.length + '</span>'),
        UI.infoBox('Prenotazioni annullate', '<span style="color:var(--red-text)">' + a.prenotazioni + '</span>'),
        UI.infoBox('Zona interessata', UI.esc(a.zona || '—'))
      ])
      + (a.rimossi.length
          ? '<div class="form-label" style="margin-bottom:6px">Stalli che verranno eliminati</div>'
            + '<div style="display:flex;flex-wrap:wrap;gap:5px">'
            + a.rimossi.map(id => UI.tag(id, 'red')).join('') + '</div>'
          : '')
      + UI.alert('<strong>Questa azione non è reversibile.</strong>', 'danger');
  },
  footer: (c) => chiudi()
    + UI.btn('Confermo, procedi', { azione: 'conferma-riduzione-posti',
        params: { nome: c.nome, indirizzo: c.indirizzo, posti: c.posti },
        variante: 'btn-danger', sm: false })
});

Modals.register('conferma-ripristino', {
  titolo: () => '🔄 Ripristina dati demo',
  body: () => {
    const k = S.kpiStalli(), d = S.kpiDipendenti();
    return UI.alert('Tutti i dati inseriti o modificati durante questa sessione andranno persi.', 'warn')
      + UI.infoGrid([
        UI.infoBox('Sede attuale', UI.esc(State.config.sede.nome)),
        UI.infoBox('Stalli', k.totale),
        UI.infoBox('Dipendenti', d.autorizzati),
        UI.infoBox('Utenti piattaforma', State.utentiPiattaforma.length)
      ])
      + UI.alert('Resti collegato con il tuo ruolo: la pagina non viene ricaricata.', 'info');
  },
  footer: () => chiudi()
    + UI.btn('🔄 Ripristina', { azione: 'conferma-ripristino-demo', variante: 'btn-danger', sm: false })
});

/* ============================================================================
   HANDLER DI SERVIZIO (comuni a tutti i modali)
============================================================================ */
UI.on('modal-close', () => Modals.close());
UI.on('modal-stop', () => { /* blocca la chiusura al click dentro al modale */ });
UI.on('refresh-modale', () => Modals.refresh(), 'change');
UI.on('modal-field', () => Modals.refresh(), 'change');
UI.on('rigenera-codice', () => { Modals._collect(); Modals.form.codice = String(U.rInt(1000, 9999)); Modals._render(); });

global.PC.Modals = Modals;

})(window);
