/* ============================================================================
   FM · Log Accessi
   Il pulsante 🔍 Filtra apre un pannello che filtra davvero (persona, tipo,
   stato, stallo) e ogni riga apre il dettaglio DELLA RIGA. [fix DV07 · DV08]
============================================================================ */
(function (global) {
'use strict';
const { UI, Selectors: S, Actions: A, State, Modals, Domini: D } = global.PC;

const TAG_TIPO = { dipendente: ['Dip.', 'blue'], visitatore: ['Vis.', 'purple'], anomalia: ['⚠', 'red'] };

global.PC.Sezioni.accessi = {
  render() {
    const k = S.kpiAccessi();
    const filtri = State.ui.filtri.accessi;
    const righe = S.accessiFiltrati();
    const attivi = !!(filtri.q || filtri.tipo || filtri.stato || filtri.stallo || filtri.anomalia);

    const per = State.config.periodo;
    const kpi = UI.kpiGrid([
      UI.kpiPeriodo({ label: 'Ingressi' + (k.multi ? '' : ' Oggi'), tot: k.ingressi, media: k.medie.ingressi,
        multi: k.multi, sub: `${k.dipendenti} dip · ${k.visitatori} vis.`, colore: 'blue' }),
      UI.kpiPeriodo({ label: 'Uscite' + (k.multi ? '' : ' Oggi'), tot: k.uscite, media: k.medie.uscite,
        multi: k.multi, colore: 'green' }),
      /* puntuale: sempre "adesso", non segue il periodo */
      UI.kpi({ label: 'Presenti Ora', val: k.presenti, sub: 'in questo momento', colore: 'cyan' }),
      /* contatore a basso volume: primario il totale, media nel sottotitolo */
      UI.kpiPeriodo({ label: 'Anomalie', tot: k.multi ? k.anomaliePeriodo : k.anomalie, media: k.medie.anomalie,
        multi: k.multi, primario: 'totale', sub: k.anomalie ? 'da gestire' : 'nessuna',
        colore: 'red', azione: 'filtra-anomalie' })
    ], 4);

    /* pannello filtri */
    const stalliCoinvolti = [...new Set(State.accessi.map(a => a.stalloId).filter(Boolean))].sort();
    const pannello = filtri.aperto ? `
      <div class="map-sel-bar" style="border-color:var(--border)">
        <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%;align-items:flex-end">
          <div style="flex:1;min-width:180px">${UI.campo('Persona / targa / stallo',
            UI.input({ valore: filtri.q, placeholder: 'Cerca…', azione: 'filtro-acc-q', focusKey: 'acc-q' }))}</div>
          <div style="width:150px">${UI.campo('Tipo', UI.select([{ v: '', l: 'Tutti' }, { v: 'dipendente', l: 'Dip.' }, { v: 'visitatore', l: 'Vis.' }, { v: 'anomalia', l: '⚠ Anomalia' }], filtri.tipo, { azione: 'filtro-acc-tipo' }))}</div>
          <div style="width:150px">${UI.campo('Stato', UI.select([{ v: '', l: 'Tutti' }, { v: 'dentro', l: 'Dentro' }, { v: 'uscito', l: 'Uscito' }, { v: 'abusivo', l: 'Abusivo' }], filtri.stato, { azione: 'filtro-acc-stato' }))}</div>
          <div style="width:150px">${UI.campo('Stallo', UI.select([{ v: '', l: 'Tutti' }].concat(stalliCoinvolti), filtri.stallo, { azione: 'filtro-acc-stallo' }))}</div>
          <div style="margin-bottom:14px">${UI.btn('⚠ Solo anomalie', { azione: 'filtro-acc-anomalia', variante: filtri.anomalia ? 'btn-primary' : 'btn-ghost' })}</div>
          <div style="margin-bottom:14px">${UI.btn('✕ Azzera', { azione: 'reset-filtri-acc' })}</div>
        </div>
      </div>` : '';

    /* il cap serve solo sui periodi lunghi: su un singolo giorno il log
       dev'essere completo */
    const MAX_RIGHE_LOG = k.multi ? 150 : righe.length;
    const mostrate = righe.slice(0, MAX_RIGHE_LOG);
    const rows = mostrate.map(a => {
      const [lbl, col] = TAG_TIPO[a.tipo];
      const statoBadge = a.stato === 'abusivo' ? UI.badge('Abusivo', 'red')
        : a.stato === 'uscito' ? UI.badge('Uscito', 'gray')
        : a.tipo === 'visitatore' ? UI.badge('Dentro', 'cyan')
        : UI.badge('Dentro', 'green', true);
      return UI.riga([
        `<b>${UI.esc(a.personaNome)}</b>${a.targa ? ` <span class="mono muted" style="font-size:10.5px">${UI.esc(a.targa)}</span>` : ''}`,
        UI.tag(lbl, col),
        UI.esc(a.stalloId || '–'),
        `<span class="mono">${UI.esc(a.ingresso)}</span>`,
        `<span class="mono">${UI.esc(a.uscita || '–')}</span>`,
        UI.esc(D.METODO_ACCESSO[a.metodo] || '–'),
        statoBadge
      ], { azione: 'apri-accesso', params: { accessoId: a.id }, classe: a.anomalia && !a.uscita ? 'row-alert' : '' });
    });

    /* con un periodo lungo il log può superare il migliaio di righe: si mostra
       una finestra, dichiarando quante ne restano fuori */
    const MAX = MAX_RIGHE_LOG;
    return kpi + pannello + UI.card({
      titolo: 'Log Accessi',
      sub: (attivi ? `${righe.length} di ${State.accessi.length} record · filtri attivi`
                   : `${righe.length} record · ${UI.esc(per.label.toLowerCase())}`)
           + (righe.length > MAX ? ` · mostrati i primi ${MAX}` : ''),
      azioni: [
        UI.btn((filtri.aperto ? '▲' : '🔍') + ' Filtra', { azione: 'toggle-filtri-acc', variante: attivi ? 'btn-primary' : 'btn-ghost' }),
        UI.btn('⤓ CSV', { azione: 'apri-modale', params: { modale: 'export' } })
      ],
      body: UI.tabella({
        head: ['Persona', 'Tipo', 'Stallo', 'Ingresso', 'Uscita', 'Metodo', 'Stato'],
        rows: rows,
        vuoto: 'Nessun accesso corrisponde ai filtri impostati.'
      })
    });
  }
};

/* ---- handler ---------------------------------------------------------- */
UI.on('toggle-filtri-acc', () => A.setFiltroAccessi({ aperto: !State.ui.filtri.accessi.aperto }));
UI.on('reset-filtri-acc',  () => { A.resetFiltri('accessi'); A.setFiltroAccessi({ aperto: true }); });
UI.onInput('filtro-acc-q',      (d, ev) => A.setFiltroAccessi({ q: ev.target.value }));
UI.onChange('filtro-acc-tipo',  (d, ev) => A.setFiltroAccessi({ tipo: ev.target.value }));
UI.onChange('filtro-acc-stato', (d, ev) => A.setFiltroAccessi({ stato: ev.target.value }));
UI.onChange('filtro-acc-stallo',(d, ev) => A.setFiltroAccessi({ stallo: ev.target.value }));
UI.on('filtro-acc-anomalia', () => A.setFiltroAccessi({ anomalia: !State.ui.filtri.accessi.anomalia }));
UI.on('filtra-anomalie', () => { A.vaiA('accessi'); A.setFiltroAccessi({ aperto: true, tipo: '', stato: '', q: '', stallo: '', anomalia: true }); });
UI.on('apri-accesso', d => { A.seleziona('accessoId', d.accessoId); Modals.open('acc-det', { accessoId: d.accessoId }); });

})(window);
