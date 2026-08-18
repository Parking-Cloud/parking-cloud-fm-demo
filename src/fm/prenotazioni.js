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
    const righe = S.righeSettimanaFM();
    const q = State.ui.filtri.dipendenti.q;

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
          sub: UI.esc(titolo) + (q ? ` · ricerca "${UI.esc(q)}"` : ' · dipendenti in evidenza'),
          azioni: [
            UI.btn('‹', { azione: 'week-fm', params: { delta: -1 }, titolo: 'Settimana precedente' }),
            UI.btn('Oggi', { azione: 'week-fm', params: { delta: 0 }, disabled: offset === 0 }),
            UI.btn('›', { azione: 'week-fm', params: { delta: 1 }, titolo: 'Settimana successiva' }),
            UI.btn('⤓', { azione: 'apri-modale', params: { modale: 'export' } }),
            UI.btn('+ Prenota', { azione: 'apri-modale', params: { modale: 'add-bk' }, variante: 'btn-primary' })
          ],
          body: righe.length ? griglia : UI.vuoto('Nessun dipendente corrisponde alla ricerca.')
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
  /* In modalita' a turni la cella dice ANCHE quale turno: senza, due
     prenotazioni sullo stesso stallo nello stesso giorno sarebbero
     indistinguibili, che e' esattamente cio' che la modalita' introduce. */
  if (State.config.modalitaPrenotazione === 'turni' && p.turnoId) {
    const t = S.turno(p.turnoId);
    const cls = { mattino: 't-mattino', pomeriggio: 't-pomeriggio', notte: 't-notte' }[p.turnoId] || 't-altro';
    return `<div class="bk-slot s-turno ${cls}"${UI.act('cella-prenota', params)} title="${UI.esc(p.stalloId + ' · ' + (t ? t.label + ' ' + t.inizio + '–' + t.fine : p.turnoId))}">
      <span class="bk-stallo">${UI.esc(p.stalloId)}</span><span class="bk-turno">${UI.esc(t ? t.label : p.turnoId)}</span></div>`;
  }
  /* violazione: lo stallo prenotato risulta occupato abusivamente */
  const stato = S.statoStallo(p.stalloId, c.iso);
  const viol = stato.stato === 'violazione';
  return `<div class="bk-slot ${viol ? 's-viol' : 's-book'}"${UI.act('cella-prenota', params)} title="${UI.esc(p.stalloId + (viol ? ' — occupazione abusiva in corso' : ''))}">${UI.esc(p.stalloId)}${viol ? ' ⚠' : ''}</div>`;
}

/* ---- handler ---------------------------------------------------------- */
UI.on('week-fm', d => {
  const delta = parseInt(d.delta, 10);
  if (delta === 0) { State.ui.fmWeekOffset = 0; A.fmWeek(0); } else A.fmWeek(delta);
});

UI.on('cella-prenota', d => {
  Modals.open('add-bk', {});
  Modals.form = { dipendente: d.dipendenteId, data: d.giornoIso, tipo: 'ufficio', stallo: '' };
  Modals._render();
});

UI.on('crea-prenotazione-fm', () => {
  Modals._collect();
  const fm = Modals.form;
  if (!fm.dipendente) { UI.toast('Seleziona un dipendente'); return; }
  const r = A.prenota({
    dipendenteId: fm.dipendente, dataISO: fm.data,
    tipo: fm.tipo || 'ufficio', stalloId: fm.stallo || null, creataDa: 'fm'
  });
  if (r.errore) { UI.toast('⚠ ' + r.errore); return; }
  Modals.close();
  const dip = S.dipendente(fm.dipendente);
  UI.toast(r.tipo === 'sw'
    ? `✓ Smart Working registrato per ${dip.nome} il ${U.fmtDM(U.fromISO(fm.data))}`
    : `✓ ${dip.nome}: stallo ${r.stalloId} prenotato per il ${U.fmtDM(U.fromISO(fm.data))}`);
});

})(window);
