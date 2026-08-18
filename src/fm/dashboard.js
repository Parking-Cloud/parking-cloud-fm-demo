/* ============================================================================
   FM · Dashboard Live
   Ogni numero è derivato: nessun valore è scritto nell'HTML.
============================================================================ */
(function (global) {
'use strict';
const { UI, Selectors: S, Actions: A, State, Modals, Utils: U, Domini: D } = global.PC;

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
            ${State.config.modalitaPrenotazione === 'turni' && S.turnoCorrente()
              ? `<div class="turno-attivo-lbl">Turno attivo: <strong>${UI.esc(S.turnoCorrente().label)}</strong> · ${UI.esc(S.turnoCorrente().inizio)}–${UI.esc(S.turnoCorrente().fine)}</div>`
              : ''}
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
    /* Lista d'attesa: esiste solo in modalita' turni, e solo se qualcuno e'
       davvero in coda. Una card vuota sarebbe rumore. */
    const inAttesa = State.config.modalitaPrenotazione === 'turni' ? S.listaAttesaAperta() : [];
    const cardAttesa = inAttesa.length ? UI.card({
      titolo: '⏳ Lista attesa: ' + inAttesa.length,
      sub: 'Dipendenti in coda per un turno esaurito',
      stile: 'margin-top:14px',
      azioni: [UI.btn('Gestisci coda', { azione: 'apri-modale', params: { modale: 'lista-attesa' }, variante: 'btn-primary' })],
      body: UI.tabella({
        head: ['Dipendente', 'Turno richiesto', 'Data richiesta', ''],
        rows: inAttesa.slice(0, 5).map(v => {
          const dip = S.dipendente(v.dipendenteId);
          const t = S.turno(v.turnoId);
          return `<tr>
            <td><b>${UI.esc(dip ? dip.nomeCompleto : '—')}</b></td>
            <td>${UI.esc(t ? t.label : v.turnoId)} <span class="muted mono" style="font-size:11px">${UI.esc(t ? t.inizio + '–' + t.fine : '')}</span></td>
            <td class="mono">${UI.esc(U.fmtDM(U.fromISO(v.giornoIso)))} · ${UI.esc(U.hhmm(new Date(v.dataRichiesta)))}</td>
            <td>${UI.btn('Assegna stallo', { azione: 'assegna-attesa', params: { vociId: v.id } })}</td>
          </tr>`;
        }),
        vuoto: 'Nessuno in coda.'
      })
    }) : '';

    return avviso + miniMappa + kpi + cardSeg + cardAttesa;
  }
};

/* ---- handler ---- */
UI.on('vai-zona', d => { State.ui.selezione.zonaId = d.zonaId; A.vaiA('mappa'); });
UI.on('apri-seg', d => Modals.open('seg', { segId: d.segId }));

UI.on('assegna-attesa', d => {
  const v = State.listaAttesa.find(x => x.id === d.vociId);
  const dip = v ? S.dipendente(v.dipendenteId) : null;
  const r = A.assegnaStalloDaListaAttesa(d.vociId);
  if (r.errore) { UI.toast('⚠ ' + r.errore); return; }
  if (Modals.corrente === 'lista-attesa') Modals.refresh();
  UI.toast(`✓ ${dip ? dip.nomeCompleto : 'Dipendente'} · stallo ${r.prenotazione.stalloId} assegnato dalla lista d'attesa`);
});

})(window);
