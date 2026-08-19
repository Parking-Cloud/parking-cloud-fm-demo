/* ============================================================================
   FM · Hardware
   Due blocchi distinti, ed è la differenza che conta: le BARRIERE sono
   l'ostacolo fisico (cancello, sbarra, pilomat…), il METODO DI ACCESSO è come
   lo si supera ed è una proprietà della ZONA. Prima erano la stessa entità, e
   non si poteva descrivere un cancello superabile in due modi diversi né una
   zona senza barriere ma con controllo accessi. [CODE-20]
============================================================================ */
(function (global) {
'use strict';
const { UI, Selectors: S, Actions: A, State, Modals, Domini: D } = global.PC;

const STATO_HW = {
  online:            { label: 'Online',               colore: 'green', dot: true  },
  in_configurazione: { label: 'In configurazione 🔄', colore: 'cyan',  dot: false },
  anomalia:          { label: '⚠ Anomalia',           colore: 'red',   dot: false },
  offline:           { label: 'Offline',              colore: 'gray',  dot: false }
};

/** azione contestuale allo stato della barriera */
function azioneBarriera(b) {
  if (b.stato === 'in_configurazione') return UI.tag('In integrazione', 'cyan');
  if (b.stato === 'anomalia') {
    return UI.btn('Verifica', { azione: 'apri-hw', params: { hardwareId: b.id }, variante: 'btn-danger' });
  }
  return UI.btn('Aggiorna firmware', { azione: 'aggiorna-fw', params: { hardwareId: b.id } });
}

global.PC.Sezioni.hardware = {
  render() {
    const k = S.kpiHardware();
    const cfg = State.config.hardware;
    const barriere = S.barriere();
    const principale = barriere[0] || null;

    const kpi = UI.kpiGrid([
      UI.kpi({ label: 'Barriere Online',   val: `${k.online}/${k.totale}`, colore: k.anomalie ? 'amber' : 'green' }),
      UI.kpi({ label: 'In configurazione', val: k.configurazione, sub: k.configurazione ? 'integrazioni in corso' : 'nessuna', colore: 'cyan' }),
      UI.kpi({ label: 'Anomalie',          val: k.anomalie, sub: k.anomalie ? UI.esc(k.anomaliaNome) : 'nessuna', colore: k.anomalie ? 'red' : 'green' }),
      UI.kpi({ label: 'Cicli Oggi',        val: k.cicli, colore: 'blue' })
    ], 4);

    /* ---- CARD 1 — barriere di accesso ---- */
    const cardBarriere = UI.card({
      titolo: '🚧 Barriere di accesso',
      sub: `${k.totale} barriere · ${k.online} operative · ${k.anomalie} in anomalia`,
      azioni: [UI.btn('+ Aggiungi barriera', { azione: 'apri-modale', params: { modale: 'add-barriera' }, variante: 'btn-primary' })],
      body: UI.tabella({
        head: ['Tipo', 'Zona', 'Stato', 'Note', ''],
        scroll: false,
        rows: barriere.map(b => {
          const st = STATO_HW[b.stato] || STATO_HW.offline;
          return UI.riga([
            `<b>${UI.esc(b.label)}</b><div class="muted" style="font-size:11px"><span class="mono">${UI.esc(b.id)}</span> · firmware ${UI.esc(b.firmware || '—')}</div>`,
            UI.esc(b.zonaNome),
            UI.badge(st.label, st.colore, st.dot),
            b.note ? UI.esc(b.note) : '<span class="muted">—</span>',
            azioneBarriera(b)
          ], { azione: 'apri-hw', params: { hardwareId: b.id }, classe: b.stato === 'anomalia' ? 'row-alert' : '' });
        }),
        vuoto: 'Nessuna barriera configurata: le zone sono ad accesso libero.'
      })
    });

    /* ---- CARD 2 — modalità di accesso per zona ---- */
    const modalita = S.modalitaAccessoPerZona();
    const cardModalita = UI.card({
      titolo: '🔑 Modalità di accesso per zona',
      sub: 'Il metodo si configura in Config › Parcheggio, zona per zona',
      body: UI.tabella({
        head: ['Zona', 'Metodo', 'Livello intervento', 'Check-in', 'Check-out'],
        scroll: false,
        rows: modalita.map(m => UI.riga([
          `<b>${UI.esc(m.zonaNome)}</b>`,
          `${UI.tag(m.label, 'blue')}<div class="muted" style="font-size:11px;margin-top:3px">${UI.esc(m.desc)}</div>`,
          UI.badge(m.badge, m.colore),
          UI.esc(m.checkIn),
          `<span class="muted">${UI.esc(m.checkOut)}</span>`
        ]))
      }) + `<div class="muted" style="font-size:11.5px;padding:10px 14px;line-height:1.6">
        Il check-out automatico verrà attivato con l'integrazione hardware completa.
        Fino ad allora il check-out manuale dall'app resta disponibile per tutti i metodi,
        anche quelli con check-in automatico.
      </div>`
    });

    /* ---- configurazione ---- */
    const cardCfg = UI.card({
      titolo: '⚙ Configurazione',
      stile: 'margin-top:14px',
      body: [
        principale ? UI.setting('Firmware ' + UI.esc(principale.label), `${UI.esc(principale.firmware)} · ${UI.esc(principale.ultimoEvento)}`,
          UI.btn('Aggiorna', { azione: 'aggiorna-fw', params: { hardwareId: principale.id } })) : '',
        UI.setting('Codice accesso temporaneo visitatori', 'PIN generato automaticamente dal pass',
          UI.toggle('toggle-hw', cfg.codiceTemporaneoVisitatori, { chiave: 'codiceTemporaneoVisitatori' })),
        UI.setting('Log accessi su Parking Cloud', 'Sincronizzazione real-time da tutte le barriere',
          UI.toggle('toggle-hw', cfg.logAccessiCloud, { chiave: 'logAccessiCloud' })),
        UI.setting('Integrazione HR aziendale', 'SSO / HR Feed — in valutazione tecnica',
          UI.badge('In valutazione', 'amber'))
      ].join('')
    });

    return kpi
      + cardBarriere
      + '<div style="height:14px"></div>'
      + cardModalita
      + cardCfg;
  }
};

/* ---- handler ---------------------------------------------------------- */
UI.on('apri-hw', d => { A.seleziona('hardwareId', d.hardwareId); Modals.open('hw', { hardwareId: d.hardwareId }); });

UI.on('aggiorna-fw', d => {
  const h = A.aggiornaFirmware(d.hardwareId);
  if (h) UI.toast(`✓ ${h.label}: firmware aggiornato a ${h.firmware}`);
});

UI.on('apri-ticket', d => {
  const h = A.apriTicketHardware(d.hardwareId);
  if (h) UI.toast(`🎫 Ticket ${h.ticket} aperto per ${h.label}`);
});

UI.on('crea-barriera', () => {
  Modals._collect();
  const b = A.aggiungiBarriera({
    tipo: Modals.form.tipo, zona: Modals.form.zona, note: Modals.form.note
  });
  Modals.close();
  UI.toast(`🚧 ${b.label} aggiunta · ${(S.zona(b.zona) || {}).nome || 'nessuna zona'}`);
});

UI.on('rimuovi-barriera', d => {
  const b = S.dispositivo(d.hardwareId);
  if (!b) return;
  A.rimuoviBarriera(d.hardwareId);
  Modals.close();
  UI.toast(`${b.label} rimossa`);
});

UI.onChange('toggle-hw', (d, ev) => {
  A.setHardwareToggle(d.chiave, ev.target.checked);
  UI.toast(ev.target.checked ? '✓ Opzione attivata' : 'Opzione disattivata');
});

})(window);
