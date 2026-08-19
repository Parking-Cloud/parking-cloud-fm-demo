/* ============================================================================
   FM · Prenotazioni — vista settimanale
   I pulsanti ‹ › spostano davvero la settimana: le date e le celle vengono
   ricalcolate da AppState.prenotazioni. [fix DV09]
============================================================================ */
(function (global) {
'use strict';
const { UI, Selectors: S, Actions: A, State, Modals, Utils: U } = global.PC;

global.PC.Sezioni.prenotazioni = {
  render() {
    const giorni = S.settimanaFM();
    const isoGiorni = giorni.map(U.toISO);
    const offset = State.ui.fmWeekOffset;
    const k = S.kpiPrenotazioni(isoGiorni.includes(U.OGGI_ISO) ? U.OGGI_ISO : isoGiorni[0]);
    const finestra = State.config.prenotazioni.finestraGiorniLavorativi;
    const pag = S.righeSettimanaFM();
    const righe = pag.righe;
    const q = State.ui.filtri.dipendenti.q;

    /* Stessa ricerca della sezione Dipendenti, stesso stato: filtrare qui
       filtra anche li'. */
    const ricerca = `<input class="form-input" style="width:230px;padding:6px 11px;font-size:12px"
        placeholder="🔍 Cerca dipendente…" value="${UI.esc(q)}"
        data-act="cerca-dip-pren" data-focus-key="pren-q">`;
    const chip = q ? `<div class="filtro-chip">Filtro attivo: <strong>${UI.esc(q)}</strong>
        ${UI.btn('✕', { azione: 'azzera-filtro-pren', titolo: 'Azzera filtro' })}</div>` : '';

    const paginazione = UI.paginazione(pag, 'pagina-pren', 'Dipendenti');

    const kpi = UI.kpiGrid([
      UI.kpi({ label: offset === 0 ? 'Prenotazioni Oggi' : 'Prenotazioni ' + U.fmtDM(giorni[0]), val: k.ufficio, sub: `${k.sw} in Smart Working`, colore: 'blue' }),
      UI.kpi({ label: 'Stalli Liberi', val: k.liberi, colore: 'green', azione: 'nav', params: { sezione: 'mappa' } })
    ], 2);

    const titolo = offset === 0
      ? 'Questa settimana'
      : `Settimana del ${U.fmtDM(giorni[0])} – ${U.fmtDM(giorni[4])}`;

    const griglia = `
      <div class="scroll-x">
        <div class="week-grid hd">
          <div></div>
          ${giorni.map(g => `<div class="wday${U.toISO(g) === U.OGGI_ISO ? ' today' : ''}">${UI.esc(U.fmtShort(g))}</div>`).join('')}
        </div>
        ${righe.map(r => `
          <div class="week-grid bk-row">
            <div class="bk-lbl">${UI.avatar(r.dipendente.iniziali, r.dipendente.stato === 'bloccato' ? 'background:linear-gradient(135deg,var(--red),#900)' : '')} ${UI.esc(r.dipendente.nomeCompleto)}</div>
            ${r.celle.map(c => cella(c, r.dipendente)).join('')}
          </div>`).join('')}
      </div>`;

    /* Tabella capacita': una riga per turno, solo in modalita' turni. */
    const capacita = State.config.modalitaPrenotazione === 'turni'
      ? UI.card({
          titolo: '📊 Capacità per turno — oggi',
          sub: 'Lo stesso parcheggio, servito più volte nella stessa giornata',
          stile: 'margin-top:14px',
          body: UI.tabella({
            head: ['Turno', 'Orario', 'Prenotati', 'Liberi', '% Occupazione'],
            rows: S.kpiPerTurno(U.OGGI_ISO).map(k => `<tr>
              <td><b>${UI.esc(k.label)}</b></td>
              <td class="mono">${UI.esc(k.orario)}</td>
              <td>${k.prenotati}</td>
              <td>${k.liberi}</td>
              <td><b>${k.perc}%</b></td>
            </tr>`),
            vuoto: 'Nessun turno configurato.'
          })
        })
      : '';

    return kpi
      + UI.alert(`📅 Finestra di prenotazione: <strong>${finestra} giorni lavorativi</strong> (oggi incluso) — modificabile in <a data-act="nav" data-sezione="config" style="color:inherit;text-decoration:underline;cursor:pointer">Config → Policy</a>`, 'info')
      + UI.card({
          titolo: 'Vista Settimanale',
          sub: UI.esc(titolo) + (q ? ` · ${pag.totale} risultat${pag.totale === 1 ? 'o' : 'i'} per "${UI.esc(q)}"` : ` · ${pag.totale} dipendenti`),
          azioni: [
            ricerca,
            UI.btn('‹', { azione: 'week-fm', params: { delta: -1 }, titolo: 'Settimana precedente' }),
            UI.btn('Oggi', { azione: 'week-fm', params: { delta: 0 }, disabled: offset === 0 }),
            UI.btn('›', { azione: 'week-fm', params: { delta: 1 }, titolo: 'Settimana successiva' }),
            UI.btn('⤓', { azione: 'apri-modale', params: { modale: 'export' } }),
            UI.btn('+ Prenota', { azione: 'apri-modale', params: { modale: 'add-bk' }, variante: 'btn-primary' })
          ],
          body: chip + (righe.length ? griglia + paginazione : UI.vuoto('Nessun dipendente corrisponde alla ricerca.'))
        })
      + capacita;
  }
};

/** una cella della griglia: prenotazione, smart working, violazione o vuoto */
function cella(c, dip) {
  const p = c.prenotazione;
  const params = { dipendenteId: dip.id, giornoIso: c.iso };
  if (!p) {
    return `<div class="bk-slot s-free"${UI.act('cella-prenota', params)} title="Nessuna prenotazione — click per crearne una">–</div>`;
  }
  if (p.tipo === 'sw') {
    return `<div class="bk-slot s-sw"${UI.act('cella-prenota', params)} title="Smart Working">SW</div>`;
  }
  /* In modalita' a turni la cella dice ANCHE quale turno, e ne mostra PIU' DI
     UNO se la persona copre un doppio turno. Una riga per dipendente resta la
     regola: i turni si impilano dentro la cella, non generano righe nuove. */
  if (State.config.modalitaPrenotazione === 'turni') {
    const conTurno = (c.prenotazioni || [p]).filter(x => x.turnoId);
    if (conTurno.length) {
      const badge = (x) => {
        const t = S.turno(x.turnoId);
        const cls = { mattino: 't-mattino', pomeriggio: 't-pomeriggio', notte: 't-notte' }[x.turnoId] || 't-altro';
        return `<div class="bk-slot s-turno ${cls}"${UI.act('cella-turno', { prenotazioneId: x.id })} title="${UI.esc(x.stalloId + ' · ' + (t ? t.label + ' ' + t.inizio + '–' + t.fine : x.turnoId))}">
          <span class="bk-stallo">${UI.esc(x.stalloId)}</span><span class="bk-turno">${UI.esc(t ? t.label : x.turnoId)}</span></div>`;
      };
      /* il "+" resta raggiungibile: senza, il secondo turno non si potrebbe
         aggiungere dalla griglia */
      const puoAggiungere = conTurno.length < S.maxTurniPerDipendente();
      return `<div class="bk-turni-stack">${conTurno.map(badge).join('')}${
        puoAggiungere ? `<div class="bk-add-turno"${UI.act('cella-prenota', Object.assign({}, params, { nuovo: '1' }))} title="Aggiungi un turno">+</div>` : ''
      }</div>`;
    }
  }
  /* violazione: lo stallo prenotato risulta occupato abusivamente */
  const stato = S.statoStallo(p.stalloId, c.iso);
  const viol = stato.stato === 'violazione';
    /* Il pallino dice se la persona e' entrata (verde) o gia' uscita (grigio):
       la cella da sola direbbe solo che lo stallo era riservato. */
    const dot = p.checkOutTs ? '<span class="bk-dot bk-dot-out">●</span>'
      : p.checkInTs ? '<span class="bk-dot bk-dot-in">●</span>' : '';
  /* La fascia sta nel tooltip: senza, una modifica agli orari non produce
     alcun effetto visibile e sembra non essere stata salvata. */
  const fascia = p.oraInizio && p.oraFine ? ' · ' + p.oraInizio + '–' + p.oraFine : '';
  return `<div class="bk-slot ${viol ? 's-viol' : 's-book'}"${UI.act('cella-prenota', params)} title="${UI.esc(p.stalloId + fascia + (viol ? ' — occupazione abusiva in corso' : ''))}">${UI.esc(p.stalloId)}${dot}${viol ? ' ⚠' : ''}</div>`;
}

/* ---- handler ---------------------------------------------------------- */
UI.on('week-fm', d => {
  const delta = parseInt(d.delta, 10);
  if (delta === 0) { State.ui.fmWeekOffset = 0; A.fmWeek(0); } else A.fmWeek(delta);
});

UI.onInput('cerca-dip-pren', (d, ev) => A.setFiltroDipendenti({ q: ev.target.value }));
UI.on('azzera-filtro-pren', () => A.resetFiltri('dipendenti'));
UI.on('pagina-pren', d => A.setPaginaPrenotazioni(parseInt(d.pagina, 10)));

UI.on('cella-prenota', d => {
  /* Su una cella gia' prenotata si apre il DETTAGLIO. Riaprire "Nuova
     prenotazione" significava passare da prenota(), che annulla l'esistente:
     bastava un click esplorativo per riassegnare lo stallo e perdere il
     check-in. La creazione resta per le celle libere. */
  /* Il "+" della pila turni chiede esplicitamente una prenotazione NUOVA. */
  if (d.nuovo) { apriNuovaPrenotazione(d.dipendenteId, d.giornoIso); return; }
  const p = S.prenotazione(d.dipendenteId, d.giornoIso);
  if (p) { Modals.open('bk-det', { prenotazioneId: p.id }); return; }
  apriNuovaPrenotazione(d.dipendenteId, d.giornoIso);
});

/* Un badge nella pila punta a UNA prenotazione precisa: con piu' turni nello
   stesso giorno, risalire dal solo (dipendente, data) sarebbe ambiguo. */
UI.on('cella-turno', d => Modals.open('bk-det', { prenotazioneId: d.prenotazioneId }));

function apriNuovaPrenotazione(dipendenteId, giornoIso) {
  Modals.open('add-bk', {});
  Modals.form = {
    dipendente: dipendenteId, data: giornoIso, tipo: 'ufficio', stallo: '',
    oraInizio: '09:00', oraFine: '18:00'
  };
  Modals._render();
}

UI.on('fm-aggiorna-orari', d => {
  Modals._collect();
  const r = A.modificaOrariPrenotazione({
    prenotazioneId: d.prenotazioneId,
    oraInizio: Modals.form.oraInizio, oraFine: Modals.form.oraFine
  });
  if (r && r.errore) { UI.toast('⚠ ' + r.errore); return; }
  Modals.close();
  const dip = S.dipendente(r.dipendenteId);
  UI.toast(`🕓 ${dip ? dip.nome : 'Prenotazione'}: fascia aggiornata · ${r.oraInizio}–${r.oraFine}`);
});

UI.on('fm-cancella-pren', d => {
  const p = S.prenotazioneById(d.prenotazioneId);
  if (!p) return;
  const dip = S.dipendente(p.dipendenteId);
  A.annullaPrenotazione(p.id);
  Modals.close();
  UI.toast(`Prenotazione di ${dip ? dip.nome : '—'} del ${U.fmtDM(U.fromISO(p.data))} cancellata`);
});

/* Sostituire e' un'operazione DIVERSA dal modificare: qui si accetta
   consapevolmente di ricreare la prenotazione (stallo riassegnato, check-in
   azzerato). Prima era l'unico comportamento possibile, e non era dichiarato. */
UI.on('fm-sostituisci-pren', d => {
  Modals.close();
  apriNuovaPrenotazione(d.dipendenteId, d.giornoIso);
});

UI.on('crea-prenotazione-fm', () => {
  Modals._collect();
  const fm = Modals.form;
  if (!fm.dipendente) { UI.toast('Seleziona un dipendente'); return; }
  const perTurni = State.config.modalitaPrenotazione === 'turni';
  const tipo = fm.tipo || 'ufficio';
  if (perTurni && tipo === 'ufficio' && !fm.turnoId) { UI.toast('Seleziona il turno'); return; }
  const r = A.prenota({
    dipendenteId: fm.dipendente, dataISO: fm.data,
    tipo, stalloId: fm.stallo || null, creataDa: 'fm',
    turnoId: perTurni && tipo === 'ufficio' ? fm.turnoId : null
  });
  if (r.errore) { UI.toast('⚠ ' + r.errore); return; }
  /* La fascia si applica DOPO: `prenota` scrive gli orari standard, e qui si
     sovrascrivono solo se il FM li ha davvero toccati. Se sono incoerenti la
     prenotazione resta valida con la fascia di default. */
  if (r.tipo === 'ufficio' && (fm.oraInizio || fm.oraFine)) {
    const esito = A.modificaOrariPrenotazione({
      prenotazioneId: r.id, oraInizio: fm.oraInizio, oraFine: fm.oraFine
    });
    if (esito && esito.errore) UI.toast('⚠ ' + esito.errore + ' · orari standard applicati');
  }
  Modals.close();
  const dip = S.dipendente(fm.dipendente);
  const t = r.turnoId ? S.turno(r.turnoId) : null;
  UI.toast(r.tipo === 'sw'
    ? `✓ Smart Working registrato per ${dip.nome} il ${U.fmtDM(U.fromISO(fm.data))}`
    : `✓ ${dip.nome}: stallo ${r.stalloId}${t ? ' · ' + t.label : ''} prenotato per il ${U.fmtDM(U.fromISO(fm.data))}`);
});

})(window);
