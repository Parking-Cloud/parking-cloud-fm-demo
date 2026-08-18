/* ============================================================================
   FM · Segnalazioni
   Gestire una segnalazione aggiorna badge sidebar, KPI Dashboard, mappa e
   log accessi nello stesso istante: sono tutti derivati dallo stesso stato.
============================================================================ */
(function (global) {
'use strict';
const { UI, Selectors: S, Actions: A, State, Modals, Domini: D } = global.PC;

global.PC.Sezioni.segnalazioni = {
  render() {
    const k = S.kpiSegnalazioni();
    const attive = S.segnalazioniAttive();
    const bloccati = State.dipendenti.filter(d => d.stato === 'bloccato');

    const kpi = UI.kpiGrid([
      UI.kpi({ label: 'Aperte',          val: k.aperte,      colore: 'red' }),
      UI.kpi({ label: 'In gestione',     val: k.inGestione,  colore: 'amber' }),
      UI.kpiPeriodo({ label: k.multi ? 'Risolte nel periodo' : 'Risolte (mese)',
        tot: k.multi ? k.risoltePeriodo : k.risolteMese, media: 0, multi: k.multi,
        primario: 'totale', colore: 'green' }),
      UI.kpi({ label: 'Utenti bloccati', val: k.bloccati,    colore: 'blue' })
    ], 4);

    const cardAttive = UI.card({
      titolo: 'Segnalazioni Attive',
      sub: attive.length ? `${attive.length} da gestire` : '',
      body: attive.length ? attive.map(sg => {
        const urgente = sg.gravita === 'urgente';
        const def = D.TIPO_SEGNALAZIONE[sg.tipo];
        const segnalante = S.dipendente(sg.segnalanteId);
        const inGestione = sg.stato === 'in_gestione';
        return UI.segCard({
          variante: urgente ? 'alert' : inGestione ? 'warn' : 'info',
          coloreIco: urgente ? 'red' : inGestione ? 'amber' : 'blue',
          icona: def.icona,
          titolo: UI.esc(sg.titolo),
          dettaglio: [
            UI.esc(sg.descrizione),
            segnalante ? 'Segnalato da ' + UI.esc(segnalante.nomeCompleto) : null,
            sg.targa ? '<span class="mono">' + UI.esc(sg.targa) + '</span>' : null
          ].filter(Boolean).join(' · ')
            + `<div style="font-size:10px;opacity:.7;margin-top:3px">aperta da ${S.durataSegnalazione(sg)}${sg.note.length ? ' · ' + sg.note.length + ' aggiornament' + (sg.note.length === 1 ? 'o' : 'i') : ''}</div>`,
          meta: [
            UI.badge(urgente ? 'Urgente' : inGestione ? 'In gestione' : 'Aperta', urgente ? 'red' : inGestione ? 'amber' : 'blue'),
            sg.stalloId ? UI.btn('🗺 ' + sg.stalloId, { azione: 'vai-stallo', params: { stalloId: sg.stalloId } }) : '',
            UI.btn('Gestisci', { azione: 'apri-seg', params: { segId: sg.id }, variante: urgente ? 'btn-danger' : 'btn-ghost' })
          ],
          azione: 'apri-seg', params: { segId: sg.id }
        });
      }).join('') : UI.vuoto('Nessuna segnalazione attiva.')
    });

    const cardBloccati = UI.card({
      titolo: 'Utenti Bloccati',
      body: UI.tabella({
        head: ['Dipendente', 'Motivo', 'Dal', ''],
        scroll: false,
        rows: bloccati.map(d => `<tr>
          <td><b>${UI.esc(d.nomeCompleto)}</b><div class="muted" style="font-size:11px">${UI.esc(d.dipartimento)}</div></td>
          <td>${UI.tag(d.bloccoMotivo, d.bloccoTipo === 'abusivo' ? 'red' : 'amber')}</td>
          <td class="mono" style="font-size:11px">${UI.esc(d.bloccoDal ? d.bloccoDal.slice(8) + '/' + d.bloccoDal.slice(5, 7) : '—')}</td>
          <td>${UI.btn('Sblocca', { azione: 'apri-sblocco', params: { dipendenteId: d.id } })}</td>
        </tr>`),
        vuoto: 'Nessun utente bloccato.'
      })
    });

    /* storico risolte */
    const risolte = State.segnalazioni.filter(s => s.stato === 'risolta')
      .sort((a, b) => b.risoltaIlTs - a.risoltaIlTs).slice(0, 6);
    const cardStorico = UI.card({
      titolo: 'Risolte di recente',
      stile: 'margin-top:14px',
      body: UI.tabella({
        head: ['Segnalazione', 'Stallo', 'Chiusa'],
        scroll: false,
        rows: risolte.map(s => `<tr>
          <td>${D.TIPO_SEGNALAZIONE[s.tipo].icona} ${UI.esc(D.TIPO_SEGNALAZIONE[s.tipo].label)}</td>
          <td class="mono">${UI.esc(s.stalloId || '—')}</td>
          <td class="muted" style="font-size:11.5px">${UI.esc(new Date(s.risoltaIlTs).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }))}</td>
        </tr>`),
        vuoto: 'Nessuna segnalazione risolta.'
      })
    });

    return kpi + `<div class="g2">${cardAttive}<div>${cardBloccati}${cardStorico}</div></div>`;
  }
};

/* ---- handler ---------------------------------------------------------- */
UI.on('sel-azione-seg', d => { Modals._collect(); Modals.form.azione = d.valore; Modals._render(); });

UI.on('conferma-seg', d => {
  Modals._collect();
  const azione = Modals.form.azione || 'risolvi';
  const seg = S.segnalazione(d.segId);
  A.gestisciSegnalazione(d.segId, azione);
  Modals.close();
  const msg = {
    assegna_alternativo: '✓ Stallo alternativo assegnato · dipendente notificato',
    blocca_veicolo: '🚫 Veicolo segnalato come non autorizzato · stallo liberato',
    rinvia_notifica: '📢 Seconda notifica inviata al conducente',
    risolvi: '✓ Segnalazione chiusa'
  }[azione];
  UI.toast(msg + (seg && seg.stalloId ? ' (' + seg.stalloId + ')' : ''));
});

UI.on('apri-sblocco', d => Modals.open('sblocco', { dipendenteId: d.dipendenteId }));

UI.on('conferma-sblocco', d => {
  Modals._collect();
  const dip = A.sbloccaDipendente(d.dipendenteId, { motivazione: Modals.form.motivazione, durata: Modals.form.durata });
  Modals.close();
  UI.toast(`✓ Accesso ripristinato per ${dip.nomeCompleto}`);
});

})(window);
