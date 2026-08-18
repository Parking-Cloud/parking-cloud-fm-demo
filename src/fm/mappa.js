/* ============================================================================
   FM · Mappa Stalli
   La planimetria è generata da AppState.stalli e colorata da
   Selectors.statoStallo(): dopo un salvataggio si aggiorna da sola.
   [fix DV05 · DV06]
============================================================================ */
(function (global) {
'use strict';
const { UI, Selectors: S, Actions: A, State, Modals, Utils: U, Domini: D } = global.PC;

/* la legenda riusa le stesse classi dei tile, così resta allineata al brand */
const LEGENDA = [
  ['Libero',               'ms-free'],
  ['Occupato / Prenotato', 'ms-occ'],
  ['EV ⚡ libero',         'ms-ev'],
  ['♿ Disabili libero',    'ms-dis'],
  ['Manutenzione',         'ms-maint']
];

global.PC.Sezioni.mappa = {
  render() {
    const st = S.kpiStalli();
    const sel = State.ui.mapSelection;

    const perTurni = State.config.modalitaPrenotazione === 'turni';
    const turnoSel = perTurni ? S.turnoAttivoMappa() : null;
    const kTurno   = perTurni && turnoSel
      ? S.kpiPerTurno(U.OGGI_ISO).find(k => k.turnoId === turnoSel.id) : null;

    /* Selettore orizzontale dei turni: non appare in modalita' giornaliera. */
    const selettoreTurni = perTurni ? `
      <div class="turni-tabs">
        ${(State.config.turni || []).map(t => `<div class="turno-tab${turnoSel && t.id === turnoSel.id ? ' active' : ''}"${UI.act('mappa-turno', { turnoId: t.id })}>
          <span class="turno-tab-lbl">${UI.esc(t.label)}</span>
          <span class="turno-tab-ora">${UI.esc(t.inizio.slice(0, 2))}–${UI.esc(t.fine.slice(0, 2))}</span>
        </div>`).join('')}
      </div>` : '';

    const kpi = UI.kpiGrid(perTurni && kTurno ? [
      UI.kpi({ label: 'Liberi turno ' + kTurno.label, val: kTurno.liberi + '/' + kTurno.totale, colore: 'green' }),
      UI.kpi({ label: 'Occupati turno',  val: kTurno.occupati, sub: kTurno.perc + '% occupato', colore: 'red' }),
      UI.kpi({ label: 'Prenotati turno', val: kTurno.prenotati, colore: 'blue' }),
      UI.kpi({ label: 'EV ⚡',        val: st.ev,           colore: 'cyan' }),
      UI.kpi({ label: '♿ Disabili',   val: st.disabili,     colore: 'purple' })
    ] : [
      UI.kpi({ label: 'Posti Totali', val: st.totale,       colore: 'blue' }),
      UI.kpi({ label: 'Liberi',       val: st.liberi,       sub: st.percDisponibilita + '% disponibile', colore: 'green' }),
      UI.kpi({ label: 'Occupati',     val: st.occupati,     sub: st.percOccupazione + '% occupato', colore: 'red' }),
      UI.kpi({ label: 'EV ⚡',        val: st.ev,           colore: 'cyan' }),
      UI.kpi({ label: '♿ Disabili',   val: st.disabili,     colore: 'purple' })
    ], 5);

    const barraLegenda = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <div class="map-legend">
          ${LEGENDA.concat(State.config.modalitaPrenotazione === 'turni'
              ? [['Cambio turno', 'ms-cambio']] : [])
            .map(([l, cls]) => `<span class="leg"><span class="leg-sq ${cls}"></span>${l}</span>`).join('')}
        </div>
        ${UI.btn('🅿️ + Aggiungi Stallo', { azione: 'apri-modale', params: { modale: 'add-stallo' }, variante: 'btn-primary' })}
      </div>`;

    /* barra selezione multipla — compare solo con Ctrl+Click attivo */
    const barraSel = sel.length ? `
      <div class="map-sel-bar">
        <span style="font-size:12px;color:var(--blue);font-weight:700">${sel.length} stall${sel.length === 1 ? 'o' : 'i'} selezionat${sel.length === 1 ? 'o' : 'i'}: <span class="mono" style="font-weight:400">${UI.esc(sel.slice(0, 8).join(', '))}${sel.length > 8 ? '…' : ''}</span></span>
        <div style="display:flex;gap:8px;margin-left:auto;flex-wrap:wrap">
          ${UI.select([{ v: '', l: 'Tipo stallo…' }].concat(Object.keys(D.TIPO_STALLO).map(k => ({ v: k, l: D.TIPO_STALLO[k].label }))), '', { id: 'bulk-tipo', stile: 'font-size:11px;padding:5px 8px;width:auto' })}
          ${UI.select([{ v: '', l: 'Disponibilità…' }].concat(Object.keys(D.DISPONIBILITA).map(k => ({ v: k, l: D.DISPONIBILITA[k] }))), '', { id: 'bulk-avail', stile: 'font-size:11px;padding:5px 8px;width:auto' })}
          ${UI.btn('✓ Applica a selezionati', { azione: 'applica-bulk', variante: 'btn-primary' })}
          ${UI.btn('✕ Deseleziona', { azione: 'pulisci-sel' })}
        </div>
      </div>` : '';

    /* planimetria */
    const mappa = State.zone.map(z => {
      const stalli = State.stalli.filter(s => s.zonaId === z.id);
      if (!stalli.length) return '';
      const liberi = stalli.filter(s => S.statoStallo(s.id).stato === 'libero').length;
      return `<div class="zone-lbl">${UI.esc(z.nome)} <span class="zone-count">${stalli.length - liberi}/${stalli.length}</span></div>
        <div class="map-row">${stalli.map(s => {
          const stato = S.statoStallo(s.id, U.OGGI_ISO, turnoSel ? turnoSel.id : undefined);
          const icona = D.TIPO_STALLO[s.tipo].icona;
          /* Giallo = passaggio di consegne in corso: si e' dentro la finestra
             di tolleranza E lo stallo e' prenotato nei due turni a cavallo. */
          const inCambio = perTurni && S.cambioTurnoInCorso(s.id, U.OGGI_ISO);
          const cls = inCambio ? 'ms-cambio' : stato.cls;
          const titolo = inCambio
            ? `${s.codice} · cambio turno in corso (±${State.config.tolleranzaCambioTurnoMin} min)`
            : `${s.codice} · ${stato.label}${stato.occupanteNome ? ' · ' + stato.occupanteNome : ''}`;
          return `<div class="mspot ${cls}${State.ui.mapSelection.includes(s.id) ? ' selected' : ''}"${UI.act('click-stallo', { stalloId: s.id })} title="${UI.esc(titolo)}">${icona}${UI.esc(s.codice)}</div>`;
        }).join('')}</div>`;
    }).join('');

    return kpi + selettoreTurni + barraLegenda + barraSel
      + '<div class="map-hint">💡 Click = dettaglio &amp; modifica stallo · Ctrl+Click (o ⌘+Click) = selezione multipla</div>'
      + `<div class="pmap">${mappa}</div>`;
  }
};

/* ---- handler ---------------------------------------------------------- */
UI.on('mappa-turno', d => A.setMappaTurno(d.turnoId));

UI.on('click-stallo', (d, ev) => {
  if (ev.ctrlKey || ev.metaKey) { A.toggleSelezioneStallo(d.stalloId); return; }
  Modals.open('stallo-det', { stalloId: d.stalloId });
});

UI.on('salva-stallo', d => {
  Modals._collect();
  const fm = Modals.form;
  A.aggiornaStallo(d.stalloId, {
    tipo: fm.tipo,
    disponibilita: fm.disponibilita,
    titolareId: fm.titolare || null,
    durataMaxOre: parseInt(fm.durata, 10) || 10,
    note: fm.note || ''
  });
  Modals.close();
  UI.toast('✓ Stallo ' + d.stalloId + ' aggiornato · mappa e KPI ricalcolati');
});

UI.on('applica-bulk', () => {
  const tipo  = document.getElementById('bulk-tipo').value;
  const avail = document.getElementById('bulk-avail').value;
  if (!tipo && !avail) { UI.toast('Seleziona almeno un tipo o una disponibilità'); return; }
  const patch = {};
  if (tipo)  patch.tipo = tipo;
  if (avail) patch.disponibilita = avail;
  const n = A.aggiornaStalliMultipli(State.ui.mapSelection.slice(), patch);
  A.pulisciSelezioneStalli();
  UI.toast(`✓ Caratteristiche aggiornate su ${n} stall${n === 1 ? 'o' : 'i'}`);
});

UI.on('pulisci-sel', () => A.pulisciSelezioneStalli());

UI.on('crea-stallo', () => {
  Modals._collect();
  const fm = Modals.form;
  const s = A.aggiungiStallo({
    zonaId: fm.zona, tipo: fm.tipo, disponibilita: fm.disponibilita,
    durataMaxOre: parseInt(fm.durata, 10) || 10,
    titolareId: fm.titolare || null, note: fm.note || ''
  });
  Modals.close();
  UI.toast(s ? `✅ Stallo ${s.codice} aggiunto · ora visibile e prenotabile` : 'Zona non valida');
});

UI.on('vai-stallo', d => { Modals.close(); A.vaiA('mappa'); Modals.open('stallo-det', { stalloId: d.stalloId }); });

})(window);
