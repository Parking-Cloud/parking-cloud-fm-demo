/* ============================================================================
   FM · Dashboard Live
   Ogni numero è derivato: nessun valore è scritto nell'HTML.
============================================================================ */
(function (global) {
'use strict';
const { UI, Selectors: S, Actions: A, State, Modals, Domini: D } = global.PC;

function coloreBarra(perc, colore) {
  if (colore === 'purple') return 'var(--purple)';
  if (colore === 'sky')    return 'var(--cyan)';
  if (colore === 'blue')   return 'var(--blue)';
  return perc >= 85 ? 'var(--red)' : perc >= 60 ? 'var(--amber)' : 'var(--green)';
}

global.PC.Sezioni.dashboard = {
  render() {
    const st  = S.kpiStalli();
    const seg = S.kpiSegnalazioni();
    const vis = S.kpiVisitatori();
    const zone = S.occupazionePerZona();
    const attive = S.segnalazioniAttive();

    /* ---- mini-mappa per zona ---- */
    const miniMappa = `
      <div class="card" style="margin-bottom:18px">
        <div class="card-hd">
          <div class="card-title">🗺 Occupazione per Zona
            <small style="font-weight:400;font-size:11px;color:var(--text-muted);margin-left:6px">Real-time · aggiornato ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</small>
          </div>
          ${UI.btn('Mappa completa →', { azione: 'nav', params: { sezione: 'mappa' } })}
        </div>
        <div style="display:grid;grid-template-columns:repeat(${zone.length},1fr);gap:10px">
          ${zone.map(z => `
            <div class="zone-mini"${UI.act('vai-zona', { zonaId: z.id })}>
              <div class="zone-mini-lbl">${UI.esc(z.id === 'EV' ? 'EV ⚡' : z.id === 'H' ? '♿ Disabili' : 'Zona ' + z.id)}</div>
              <div class="zone-mini-val">${z.occupati}/${z.totale}</div>
              <div class="zone-mini-bar"><div style="width:${z.perc}%;background:${coloreBarra(z.perc, z.colore)}"></div></div>
              <div class="zone-mini-perc">${z.perc}%</div>
            </div>`).join('')}
        </div>
      </div>`;

    /* ---- KPI ---- */
    const kpi = UI.kpiGrid([
      UI.kpi({ label: 'Posti Totali', val: st.totale, sub: UI.esc(State.config.sede.nomeBreve), colore: 'blue',  azione: 'nav', params: { sezione: 'mappa' } }),
      UI.kpi({ label: 'Liberi Ora',   val: st.liberi, sub: `<span class="delta delta-up">${st.percDisponibilita}%</span> disp.`, colore: 'green', azione: 'nav', params: { sezione: 'mappa' } }),
      UI.kpi({ label: 'Occupati',     val: st.occupati, sub: `<span class="delta delta-warn">${st.percOccupazione}%</span> occup.`, colore: 'red', azione: 'nav', params: { sezione: 'accessi' } }),
      UI.kpi({ label: 'Segnalazioni', val: seg.aperte + seg.inGestione, sub: `${seg.abusive} abusive · ${seg.zona} zona`, colore: 'amber', azione: 'nav', params: { sezione: 'segnalazioni' } }),
      UI.kpi({ label: 'Visitatori',   val: vis.attivi, sub: 'pass attivi ora', colore: 'purple', azione: 'nav', params: { sezione: 'visitatori' } })
    ], 5);

    /* ---- segnalazioni aperte ---- */
    const cardSeg = UI.card({
      titolo: 'Segnalazioni Aperte',
      azioni: [UI.btn('Tutte →', { azione: 'nav', params: { sezione: 'segnalazioni' } })],
      body: attive.length
        ? attive.slice(0, 4).map(sg => {
            const urgente = sg.gravita === 'urgente';
            const def = D.TIPO_SEGNALAZIONE[sg.tipo];
            const segnalante = S.dipendente(sg.segnalanteId);
            return UI.segCard({
              variante: urgente ? 'alert' : 'warn',
              coloreIco: urgente ? 'red' : 'amber',
              icona: def.icona,
              titolo: UI.esc(sg.titolo),
              dettaglio: [
                segnalante ? 'Segnalato da ' + UI.esc(segnalante.nomeCompleto) : 'Rilevazione automatica',
                sg.targa ? UI.esc(sg.targa) : null,
                sg.policyOre ? 'policy max ' + sg.policyOre + 'h' : null,
                'aperta da ' + S.durataSegnalazione(sg)
              ].filter(Boolean).join(' · '),
              meta: [
                UI.badge(urgente ? 'Urgente' : sg.stato === 'in_gestione' ? 'In gestione' : 'Aperta', urgente ? 'red' : 'amber'),
                UI.btn('Gestisci', { azione: 'apri-seg', params: { segId: sg.id }, variante: urgente ? 'btn-danger' : 'btn-ghost' })
              ],
              azione: 'apri-seg', params: { segId: sg.id }
            });
          }).join('')
        : UI.vuoto('Nessuna segnalazione aperta. Tutto sotto controllo.')
    });

    /* La Dashboard è una vista LIVE: tutti i suoi KPI sono puntuali. Se è
       selezionato un periodo lungo va detto, altrimenti sembra che il
       selettore non funzioni. */
    const per = State.config.periodo;
    const avviso = per.tipo !== 'oggi'
      ? UI.alert(`📅 Periodo selezionato: <strong>${UI.esc(per.label)}</strong>. La Dashboard mostra sempre lo stato <strong>in tempo reale</strong>; il periodo si applica a <a data-act="nav" data-sezione="accessi" style="color:inherit;text-decoration:underline;cursor:pointer">Accessi</a>, <a data-act="nav" data-sezione="visitatori" style="color:inherit;text-decoration:underline;cursor:pointer">Visitatori</a> e <a data-act="nav" data-sezione="segnalazioni" style="color:inherit;text-decoration:underline;cursor:pointer">Segnalazioni</a>.`, 'info')
      : '';
    return avviso + miniMappa + kpi + cardSeg;
  }
};

/* ---- handler ---- */
UI.on('vai-zona', d => { State.ui.selezione.zonaId = d.zonaId; A.vaiA('mappa'); });
UI.on('apri-seg', d => Modals.open('seg', { segId: d.segId }));

})(window);
