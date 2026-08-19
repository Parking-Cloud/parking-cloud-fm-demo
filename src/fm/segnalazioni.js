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
            /* Il rimando all'originale sta sotto il titolo: se una segnalazione
               e' il seguito di un'altra, e' la prima cosa da sapere leggendola. */
            + (sg.collegataA ? `<div class="seg-link"${S.segnalazione(sg.collegataA) ? UI.act('apri-seg', { segId: sg.collegataA }) : ''}>\u2197 Collegata a #${UI.esc(sg.collegataA)}</div>` : '')
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

    /* Storico: TUTTE le risolte, non solo le ultime sei. Ogni riga e'
       cliccabile — senza, il dettaglio di una segnalazione chiusa (motivazione
       dello sblocco, collegamenti) non sarebbe raggiungibile dalla UI. */
    const risolte = State.segnalazioni.filter(s => s.stato === 'risolta')
      .sort((a, b) => (b.risoltaIlTs || 0) - (a.risoltaIlTs || 0));
    const cardStorico = UI.card({
      titolo: 'Storico risolte',
      sub: `${risolte.length} chiuse`,
      stile: 'margin-top:14px',
      body: UI.tabella({
        head: ['Segnalazione', 'Stallo', 'Esito', 'Chiusa'],
        scroll: true,
        rows: risolte.map(s => {
          const sbloccata = s.azione === 'sblocco_utente' || !!s.risoltoConMotivo;
          const collegate = S.segnalazioniCollegate(s.id);
          const sotto = []
            .concat(s.risoltoConMotivo ? [`<div class="seg-sub">Motivazione: ${UI.esc(s.risoltoConMotivo)}</div>`] : [])
            .concat(s.risoltoConDurata ? [`<div class="seg-sub">Ripristino: ${UI.esc(s.risoltoConDurata)}</div>`] : [])
            .concat(s.collegataA ? [`<div class="seg-sub"><span class="seg-link"${S.segnalazione(s.collegataA) ? UI.act('apri-seg', { segId: s.collegataA }) : ''}>\u2197 Collegata a #${UI.esc(s.collegataA)}</span></div>`] : [])
            .concat(collegate.length ? [`<div class="seg-sub">Segnalazioni collegate: `
              + collegate.map(c => `<span class="seg-link"${UI.act('apri-seg', { segId: c.id })}>#${UI.esc(c.id)}</span> \u00b7 ${UI.esc(c.stato)}`).join(' \u2014 ')
              + '</div>'] : []);
          return UI.riga([
            `<div>${D.TIPO_SEGNALAZIONE[s.tipo].icona} ${UI.esc(D.TIPO_SEGNALAZIONE[s.tipo].label)}</div>${sotto.join('')}`,
            `<span class="mono">${UI.esc(s.stalloId || '\u2014')}</span>`,
            sbloccata ? UI.badge('Utente sbloccato', 'green') : UI.badge('Risolta', 'gray'),
            `<span class="muted" style="font-size:11.5px">${s.risoltaIlTs ? UI.esc(new Date(s.risoltaIlTs).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })) : '\u2014'}</span>`
          ], { azione: 'apri-seg', params: { segId: s.id } });
        }),
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

UI.on('apri-collegata', d => Modals.open('seg-collegata', { segId: d.segId }));

UI.on('crea-seg-collegata', d => {
  Modals._collect();
  const orig = S.segnalazione(d.segId);
  if (!orig) return;
  const nuova = A.creaSegnalazione({
    tipo: Modals.form.tipo || orig.tipo,
    stalloId: orig.stalloId,
    segnalanteId: orig.segnalanteId,
    descrizione: (Modals.form.note || '').trim() || `Collegata a segnalazione #${orig.id}`,
    targa: orig.targa,
    collegataA: orig.id
  });
  Modals.close();
  UI.toast(`\u{1F6A8} ${nuova.id} creata \u00b7 collegata a ${orig.id}`);
});

UI.on('conferma-sblocco', d => {
  Modals._collect();
  const dip = A.sbloccaDipendente(d.dipendenteId, { motivazione: Modals.form.motivazione, durata: Modals.form.durata });
  Modals.close();
  UI.toast(`✓ Accesso ripristinato per ${dip.nomeCompleto}`);
});

})(window);
