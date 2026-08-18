/* ============================================================================
   FM · Hardware
   Il parco dispositivi non è più solo 2N: tastierino, QR, Bluetooth (1Control),
   ANPR (Infoproget), sbarra e pilomat. I metodi di accesso mostrati sono
   DERIVATI dai dispositivi installati, non scritti a mano. [fix DV11]
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

/** azione contestuale al tipo e allo stato del dispositivo */
function azioneHw(h) {
  if (h.stato === 'in_configurazione') return UI.tag('In integrazione', 'cyan');
  if (h.stato === 'anomalia') {
    return UI.btn('Verifica', { azione: 'apri-hw', params: { hardwareId: h.id }, variante: 'btn-danger' });
  }
  if (h.tipo === 'tastierino2n' || h.tipo === 'qrreader') {
    return UI.btn('Aggiorna firmware', { azione: 'aggiorna-fw', params: { hardwareId: h.id } });
  }
  return '<span class="muted">›</span>';
}

global.PC.Sezioni.hardware = {
  render() {
    const k = S.kpiHardware();
    const cfg = State.config.hardware2n;
    const principale = State.hardware.find(h => h.ruolo === 'principale') || State.hardware[0];

    const kpi = UI.kpiGrid([
      UI.kpi({ label: 'Dispositivi Online', val: `${k.online}/${k.totale}`, colore: k.anomalie ? 'amber' : 'green' }),
      UI.kpi({ label: 'In configurazione',  val: k.configurazione, sub: k.configurazione ? 'integrazioni in corso' : 'nessuna', colore: 'cyan' }),
      UI.kpi({ label: 'Anomalie',           val: k.anomalie, sub: k.anomalie ? UI.esc(k.anomaliaNome) : 'nessuna', colore: k.anomalie ? 'red' : 'green' }),
      UI.kpi({ label: 'Cicli Oggi (2N)',    val: k.cicli2n, colore: 'blue' })
    ], 4);

    /* ---- tabella dispositivi ---- */
    const cardDisp = UI.card({
      titolo: 'Dispositivi installati',
      sub: `${k.totale} dispositivi · ${k.online} operativi · ${k.configurazione} in attivazione`,
      body: UI.tabella({
        head: ['Dispositivo', 'Tipo', 'Metodo accesso', 'Cicli', 'Stato', ''],
        scroll: false,
        rows: State.hardware.map(h => {
          const tipo = D.TIPI_HW[h.tipo] || { label: h.tipo, icona: '', metodoAccesso: null };
          const st = STATO_HW[h.stato] || STATO_HW.offline;
          const metodo = tipo.metodoAccesso
            ? UI.tag(D.METODO_ACCESSO[tipo.metodoAccesso], h.stato === 'online' ? 'blue' : 'cyan')
            : '<span class="muted">—</span>';
          const nota = h.tipo === 'anpr' ? 'Integrazione Infoproget'
                     : h.tipo === 'bluetooth' ? 'Integrazione 1Control' : '';
          return UI.riga([
            `<b>${UI.esc(h.nome)}</b> ${UI.tag(h.ruolo === 'principale' ? 'Principale' : 'Ausiliario', h.ruolo === 'principale' ? 'blue' : 'gray')}`
              + (nota ? `<div class="muted" style="font-size:11px">${nota}</div>` : ''),
            `${tipo.icona} ${UI.esc(tipo.label)}`,
            metodo,
            `<span class="mono">${h.cicli}</span>`,
            UI.badge(st.label, st.colore, st.dot),
            azioneHw(h)
          ], { azione: 'apri-hw', params: { hardwareId: h.id }, classe: h.stato === 'anomalia' ? 'row-alert' : '' });
        })
      })
    });

    /* ---- metodi di accesso: derivati dall'hardware installato ---- */
    const metodi = S.metodiAccesso();
    const cardMetodi = UI.card({
      titolo: '🔑 Metodi di accesso disponibili',
      sub: 'Generati automaticamente dai dispositivi installati',
      stile: 'margin-bottom:14px',
      body: `<div class="metodi-grid">
        ${metodi.map(m => `
          <div class="metodo-card ${m.stato === 'online' ? 'metodo-attivo' : 'metodo-config'}">
            <div class="metodo-ico">${m.icona}</div>
            <div class="metodo-nome">${UI.esc(m.label)}</div>
            <div class="metodo-dev">${UI.esc(m.dispositivo)}</div>
            ${m.stato === 'online' ? UI.badge('Attivo', 'green', true) : UI.badge('In configurazione 🔄', 'cyan')}
          </div>`).join('')}
      </div>`
    });

    /* ---- configurazione ---- */
    const cardCfg = UI.card({
      titolo: '⚙ Configurazione',
      body: [
        UI.setting('Firmware ' + UI.esc(principale.nome), `${UI.esc(principale.firmware)} · ${UI.esc(principale.ultimoEvento)}`,
          UI.btn('Aggiorna', { azione: 'aggiorna-fw', params: { hardwareId: principale.id } })),
        UI.setting('Codice accesso temporaneo visitatori', 'PIN My2N generato automaticamente dal pass',
          UI.toggle('toggle-hw', cfg.codiceTemporaneoVisitatori, { chiave: 'codiceTemporaneoVisitatori' })),
        UI.setting('Log accessi su Parking Cloud', 'Sincronizzazione real-time da tutti i dispositivi',
          UI.toggle('toggle-hw', cfg.logAccessiCloud, { chiave: 'logAccessiCloud' })),
        UI.setting('Integrazione HR aziendale', 'SSO / HR Feed — in valutazione tecnica',
          UI.badge('In valutazione', 'amber'))
      ].join('')
    });

    return kpi
      + UI.alert('Questa installazione supporta accesso via <strong>PIN</strong>, <strong>QR Code</strong>, <strong>Bluetooth</strong> e <strong>riconoscimento targa (ANPR)</strong>. Bluetooth e ANPR sono in fase di attivazione.', 'info')
      + cardDisp
      + '<div style="height:14px"></div>'
      + `<div class="g2"><div>${cardMetodi}</div><div>${cardCfg}</div></div>`;
  }
};

/* ---- handler ---------------------------------------------------------- */
UI.on('apri-hw', d => { A.seleziona('hardwareId', d.hardwareId); Modals.open('hw', { hardwareId: d.hardwareId }); });

UI.on('aggiorna-fw', d => {
  const h = A.aggiornaFirmware(d.hardwareId);
  UI.toast(`✓ ${h.nome}: firmware aggiornato a ${h.firmware}`);
});

UI.on('apri-ticket', d => {
  const h = A.apriTicketHardware(d.hardwareId);
  UI.toast(`🎫 Ticket ${h.ticket} aperto per ${h.nome}`);
});

UI.onChange('toggle-hw', (d, ev) => {
  A.setHardwareToggle(d.chiave, ev.target.checked);
  UI.toast(ev.target.checked ? '✓ Opzione attivata' : 'Opzione disattivata');
});

})(window);
