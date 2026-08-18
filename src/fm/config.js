/* ============================================================================
   FM · Policy & Config — organizzata in tab interne
   ----------------------------------------------------------------------------
   Tab 1 Parcheggio · Tab 2 Policy · Tab 3 Notifiche · Tab 4 Utenti & Accessi
   Nessun contenuto è stato rimosso: è solo riorganizzato.

   Lo slider della finestra prenotazione scrive in AppState.config: il chip
   della Vista Dipendente e la griglia FM si adeguano subito. [RF02]
   Zone: "Salva Zone" crea/rimuove davvero gli stalli. [DV16]
============================================================================ */
(function (global) {
'use strict';
const { UI, Selectors: S, Actions: A, State, Modals, Domini: D, Utils: U } = global.PC;

const COLORE_ZONA = { gold: 'var(--blue)', sky: 'var(--cyan)', purple: 'var(--purple)', blue: 'var(--blue)' };

const TAB_CONFIG = [
  ['parcheggio', '🅿 Parcheggio'],
  ['policy',     '⏰ Policy'],
  ['notifiche',  '🔔 Notifiche'],
  ['utenti',     '👥 Utenti & Accessi']
];

global.PC.Sezioni.config = {
  render() {
    const tab = State.ui.configTab;
    const barra = `<div class="tabbar" style="margin-bottom:16px">
      ${TAB_CONFIG.map(([id, l]) =>
        `<div class="tab-btn${tab === id ? ' active' : ''}"${UI.act('config-tab', { tab: id })}>${l}</div>`).join('')}
    </div>`;

    const corpo = tab === 'policy'    ? tabPolicy()
                : tab === 'notifiche' ? tabNotifiche()
                : tab === 'utenti'    ? tabUtenti()
                : tabParcheggio();

    return '<div class="sec-title">Policy &amp; Configurazione</div>' + barra + corpo;
  }
};

/* ── TAB 1 · PARCHEGGIO ─────────────────────────────────────────────────── */
function tabParcheggio() {
  const kpi = S.kpiStalli();

  const cardZone = UI.card({
    titolo: '🏗 Zone & Posti',
    azioni: [UI.btn('+ Aggiungi', { azione: 'aggiungi-zona', variante: 'btn-primary' })],
    stile: 'margin-bottom:14px',
    body: `<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">Definisci le zone — usate in mappa, prenotazioni e pass. Il numero di posti crea o rimuove stalli reali.</div>`
      + State.zone.map(z => {
          const reali = State.stalli.filter(s => s.zonaId === z.id).length;
          return `<div class="zone-row">
            <span class="zcode" style="color:${COLORE_ZONA[z.colore] || 'var(--blue)'}">${UI.esc(z.id)}</span>
            <input class="form-input" style="flex:1;padding:5px 8px;font-size:12px" value="${UI.esc(z.nome)}" data-act="zona-nome" data-zona-id="${UI.esc(z.id)}" data-focus-key="zn-${UI.esc(z.id)}">
            <input class="form-input" type="number" style="width:58px;padding:5px 7px;font-size:12px;text-align:center" value="${z.posti}" min="0" max="200" data-act="zona-posti" data-zona-id="${UI.esc(z.id)}" data-focus-key="zp-${UI.esc(z.id)}" title="Posti">
            <span class="muted mono" style="font-size:10px;min-width:34px" title="stalli attualmente in mappa">(${reali})</span>
            ${UI.btn('✕', { azione: 'rimuovi-zona', params: { zonaId: z.id }, stile: 'color:var(--red);font-size:11px' })}
          </div>`;
        }).join('')
      + UI.btn('Salva Zone e Aggiorna Mappa', { azione: 'salva-zone', variante: 'btn-primary', full: true, stile: 'margin-top:10px' })
      + `<div style="font-size:11px;color:var(--text-muted);margin-top:8px;text-align:center">Totale attuale in mappa: <strong style="color:var(--blue)">${kpi.totale} stalli</strong></div>`
  });

  /* Tipologie e caratteristiche: quante ce ne sono e con che regole */
  const cardTipologie = UI.card({
    titolo: '🚗 Tipologie e caratteristiche',
    sub: 'Regole applicate automaticamente in prenotazione e assegnazione stallo',
    stile: 'margin-bottom:14px',
    body: UI.tabella({
      head: ['Tipologia', 'Stalli', 'Durata max', 'Chi può prenotarlo'],
      scroll: false,
      rows: Object.keys(D.TIPO_STALLO).map(k => {
        const def = D.TIPO_STALLO[k];
        const n = State.stalli.filter(s => s.tipo === k).length;
        const durata = k === 'ev' ? State.config.prenotazioni.durataMaxEvOre + 'h'
                     : k === 'visitatori' ? '8h'
                     : k === 'manutenzione' ? '—'
                     : State.config.prenotazioni.durataMaxDipendenteOre + 'h';
        const chi = k === 'ev' ? 'Dipendenti con caratteristica EV'
                  : k === 'disabili' ? 'Dipendenti con caratteristica ♿'
                  : k === 'visitatori' ? 'Solo pass visitatore'
                  : k === 'manutenzione' ? 'Nessuno — fuori servizio'
                  : 'Tutti i dipendenti';
        return `<tr>
          <td><span class="mspot ${def.cls}" style="display:inline-flex;width:auto;height:auto;padding:3px 9px;font-size:10px;pointer-events:none">${def.icona}${UI.esc(def.label)}</span></td>
          <td class="mono">${n}</td><td class="mono">${durata}</td>
          <td class="muted">${chi}</td>
        </tr>`;
      })
    })
  });

  const cardBloccata = `
    <div class="disabled-wrap">
      <div class="disabled-over">
        <div class="dis-lock">🔒</div>
        <div class="dis-tag">Fase successiva</div>
        <div class="dis-msg">Accessi esterni, revenue e abbonamenti non sono attivi in questa configurazione demo.</div>
      </div>
      <div class="card" style="filter:blur(2px);pointer-events:none;user-select:none">
        <div class="card-hd"><div class="card-title">💰 Revenue &amp; Esterni</div></div>
        <div style="height:80px;background:var(--bg-raised);border-radius:var(--r-sm)"></div>
      </div>
    </div>`;

  return `<div class="g2"><div>${cardZone}</div><div>${cardTipologie}${cardBloccata}</div></div>`;
}

/* ── TAB 2 · POLICY ─────────────────────────────────────────────────────── */
function tabPolicy() {
  const p = State.config.prenotazioni;

  const cardPrenotazioni = UI.card({
    titolo: '⏰ Prenotazioni',
    azioni: [UI.btn('Modifica', { azione: 'apri-modale', params: { modale: 'policy' }, variante: 'btn-primary' })],
    stile: 'margin-bottom:14px',
    body: [
      UI.setting('Finestra massima prenotazione',
        `I dipendenti possono prenotare fino a <strong style="color:var(--blue)">${p.maxBookingWeeks} settiman${p.maxBookingWeeks === 1 ? 'a' : 'e'}</strong> in anticipo`,
        `<div style="display:flex;align-items:center;gap:8px">
          <input type="range" min="1" max="4" value="${p.maxBookingWeeks}" style="width:80px" data-act="slider-settimane">
          <span class="mono" style="font-size:11px;color:var(--blue);min-width:22px">${p.maxBookingWeeks}w</span>
        </div>`),
      UI.setting('No-show: libera stallo dopo', `${p.noShowMinuti} minuti dal check-in previsto`,
        `<input type="number" class="num-input" value="${p.noShowMinuti}" min="5" max="180" data-act="cfg-noshow">`),
      UI.setting('Durata max sosta dipendenti', `${p.durataMaxDipendenteOre} ore · notifica a ${p.notificaDurataOre}h`,
        `<input type="number" class="num-input" value="${p.durataMaxDipendenteOre}" min="1" max="24" data-act="cfg-durata">`)
    ].join('')
  });

  const cardEv = UI.card({
    titolo: '⚡ EV — ricarica',
    body: [
      UI.setting('Durata max sosta EV', `${p.durataMaxEvOre} ore di ricarica`,
        `<input type="number" class="num-input" value="${p.durataMaxEvOre}" min="1" max="24" data-act="cfg-durata-ev">`),
      UI.setting('Stalli EV configurati', `${State.stalli.filter(s => s.tipo === 'ev').length} stalli con colonnina`,
        UI.btn('Vedi in mappa', { azione: 'nav', params: { sezione: 'mappa' } }))
    ].join('')
  });

  const cardSw = UI.card({
    titolo: '🏠 Smart Working',
    stile: 'margin-bottom:14px',
    body: [
      UI.setting('Dichiarazione Smart Working', 'Il dipendente può liberare il proprio stallo per la giornata',
        UI.toggle('toggle-sw', p.smartWorkingAbilitato)),
      UI.setting('Preavviso minimo', `${p.swPreavvisoOre} ore prima dell'inizio giornata`,
        `<input type="number" class="num-input" value="${p.swPreavvisoOre}" min="0" max="72" data-act="cfg-sw-preavviso">`),
      UI.setting('Smart Working questa settimana',
        `${State.prenotazioni.filter(x => x.tipo === 'sw' && x.stato === 'attiva').length} giornate dichiarate`,
        UI.btn('Vedi prenotazioni', { azione: 'nav', params: { sezione: 'prenotazioni' } }))
    ].join('')
  });

  const cardViolazioni = UI.card({
    titolo: '🚫 Violazioni e blocchi',
    body: [
      UI.setting('Blocco dopo violazioni', `${p.sogliaViolazioni} segnalazioni peer-to-peer → accesso sospeso`,
        UI.toggle('toggle-blocco', p.bloccoDopoViolazioni)),
      UI.setting('Soglia segnalazioni', 'Violazioni verificate prima del blocco automatico',
        `<input type="number" class="num-input" value="${p.sogliaViolazioni}" min="1" max="10" data-act="cfg-soglia">`),
      UI.setting('Utenti attualmente bloccati', `${S.kpiSegnalazioni().bloccati} dipendenti`,
        UI.btn('Gestisci', { azione: 'nav', params: { sezione: 'segnalazioni' } }))
    ].join('')
  });

  return `<div class="g2"><div>${cardPrenotazioni}${cardEv}</div><div>${cardSw}${cardViolazioni}</div></div>`;
}

/* ── TAB 3 · NOTIFICHE ──────────────────────────────────────────────────── */
function tabNotifiche() {
  const n = State.config.notifiche;
  const cardN = UI.card({
    titolo: '🔔 Notifiche',
    sub: 'Destinatario: il Facility Manager assegnato al parcheggio',
    body: [
      UI.setting('Alert segnalazione peer-to-peer', 'Notifica immediata a ogni segnalazione da dipendente',
        UI.toggle('toggle-notifica', n.peerToPeer, { chiave: 'peerToPeer' })),
      UI.setting('Alert anomalia hardware', 'Cancello 2N, sbarra e Pilomat',
        UI.toggle('toggle-notifica', n.anomaliaHardware, { chiave: 'anomaliaHardware' })),
      UI.setting('Sosta prolungata — notifica dipendente', `Inviata al superamento di ${State.config.prenotazioni.notificaDurataOre}h`,
        UI.toggle('toggle-notifica', n.sostaProlungata, { chiave: 'sostaProlungata' })),
      UI.setting('Report settimanale automatico', 'Riepilogo occupazione e segnalazioni ogni lunedì',
        UI.toggle('toggle-notifica', n.reportSettimanale, { chiave: 'reportSettimanale' }))
    ].join('')
  });
  const dest = State.config.notifiche.emailDestinatari;
  const cardDest = UI.card({
    titolo: '📧 Destinatari notifiche segnalazioni',
    sub: 'Le segnalazioni aperte e gli alert vengono notificati a questi indirizzi.',
    stile: 'margin-bottom:14px',
    body: `<div class="email-chips">
        ${dest.map(e => `<span class="email-chip"><span class="mono">${UI.esc(e)}</span>`
          + UI.btn('✕', { azione: 'rimuovi-email-notifica', params: { email: e }, stile: 'padding:0 4px;border:none;background:none;color:var(--text-muted)' })
          + '</span>').join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <input class="form-input" type="email" placeholder="nuovo.destinatario@azienda.com"
               data-act="input-email-notifica" data-focus-key="new-email" style="flex:1">
        ${UI.btn('+ Aggiungi email', { azione: 'aggiungi-email-notifica', variante: 'btn-primary', sm: false, disabled: dest.length >= 5 })}
      </div>
      <div class="muted" style="font-size:11px;margin-top:8px">${dest.length}/5 destinatari configurati</div>`
  });

  const cardR = UI.card({
    titolo: '📄 Report',
    body: UI.setting('Esporta report manuale', 'Accessi, prenotazioni, segnalazioni, hardware',
      UI.btn('⤓ Esporta ora', { azione: 'apri-modale', params: { modale: 'export' }, variante: 'btn-primary' }))
  });
  return `<div class="g2"><div>${cardN}</div><div>${cardDest}${cardR}</div></div>`;
}

/* ── TAB 4 · UTENTI & ACCESSI ───────────────────────────────────────────── */
function tabUtenti() {
  const isAdmin = S.puo('gestioneRuoli');

  const cardFm = UI.card({
    titolo: '👥 Utenti di piattaforma',
    sub: isAdmin ? 'Gestibili da Amministrazione' : 'Sola lettura — la gestione è riservata agli Admin',
    azioni: isAdmin ? [UI.btn('Vai ad Amministrazione →', { azione: 'nav', params: { sezione: 'amministrazione' }, variante: 'btn-primary' })] : [],
    stile: 'margin-bottom:14px',
    body: UI.tabella({
      head: ['Nome', 'Ruolo', 'Stato'],
      scroll: false,
      rows: State.utentiPiattaforma.map(u => {
        const st = D.STATO_ACCOUNT[u.statoAccount] || D.STATO_ACCOUNT.attivo;
        return `<tr>
          <td><b>${UI.esc(u.nomeCompleto)}</b><div class="muted mono" style="font-size:11px">${UI.esc(u.email)}</div></td>
          <td>${UI.tag(S.etichettaRuolo(u.ruolo), u.ruolo === 'admin' ? 'cyan' : 'blue')}</td>
          <td>${UI.badge(st.label, st.colore)}</td>
        </tr>`;
      })
    })
  });

  const cardReferenti = UI.card({
    titolo: '🏢 Referenti interni',
    sub: 'Contatti aziendali senza accesso alla piattaforma',
    body: State.config.referentiInterni.map(a =>
      UI.setting(UI.esc(a.nome), UI.esc(a.ruolo), UI.badge(a.badge, 'gray'))).join('')
  });

  /* matrice permessi — rende esplicito cosa può fare ciascun ruolo */
  const ruolo = State.ui.ruolo;
  const cardPermessi = UI.card({
    titolo: '🔐 Ruoli e permessi attivi',
    sub: `Stai operando come <strong>${UI.esc(S.etichettaRuolo(ruolo))}</strong>`,
    body: UI.tabella({
      head: ['Funzionalità', 'Admin', 'Facility Manager', 'Dipendente'],
      scroll: false,
      rows: Object.keys(D.PERMISSIONS.admin).map(k => {
        const si = '<span style="color:var(--green);font-weight:800">✓</span>';
        const no = '<span class="muted">—</span>';
        return `<tr>
          <td>${UI.esc(k)}</td>
          <td>${D.PERMISSIONS.admin[k] ? si : no}</td>
          <td>${D.PERMISSIONS.fm[k] ? si : no}</td>
          <td>${D.PERMISSIONS.dipendente[k] ? si : no}</td>
        </tr>`;
      })
    }) + (S.puo('amministrazione')
      ? UI.alert('Come <strong>Admin</strong> puoi creare utenti di piattaforma e cambiare i ruoli.', 'info')
      : UI.alert('Come <strong>Facility Manager</strong> gestisci parcheggio e dipendenti, ma non i ruoli di piattaforma.', 'info'))
  });

  return `<div class="g2"><div>${cardFm}${cardReferenti}</div><div>${cardPermessi}</div></div>`;
}

/* ---- handler ---------------------------------------------------------- */
UI.on('config-tab', d => A.setConfigTab(d.tab));

/* ---- destinatari notifiche ---- */
UI.on('aggiungi-email-notifica', () => {
  const inp = document.querySelector('[data-act="input-email-notifica"]');
  const r = A.addEmailDestinatario(inp ? inp.value : '');
  if (r && r.errore) { UI.toast('⚠ ' + r.errore); return; }
  UI.toast(`✓ ${r.email} aggiunto ai destinatari`);
});
UI.on('rimuovi-email-notifica', d => {
  A.removeEmailDestinatario(d.email);
  UI.toast(`${d.email} rimosso dai destinatari`);
});

UI.onInput('slider-settimane', (d, ev) => A.setPolicy({ maxBookingWeeks: parseInt(ev.target.value, 10) }));
UI.onChange('cfg-noshow',       (d, ev) => A.setPolicy({ noShowMinuti: parseInt(ev.target.value, 10) || 30 }));
UI.onChange('cfg-durata',       (d, ev) => A.setPolicy({ durataMaxDipendenteOre: parseInt(ev.target.value, 10) || 10 }));
UI.onChange('cfg-durata-ev',    (d, ev) => A.setPolicy({ durataMaxEvOre: parseInt(ev.target.value, 10) || 4 }));
UI.onChange('cfg-soglia',       (d, ev) => A.setPolicy({ sogliaViolazioni: parseInt(ev.target.value, 10) || 3 }));
UI.onChange('cfg-sw-preavviso', (d, ev) => A.setPolicy({ swPreavvisoOre: parseInt(ev.target.value, 10) || 0 }));
UI.onChange('toggle-blocco',    (d, ev) => A.setPolicy({ bloccoDopoViolazioni: ev.target.checked }));
UI.onChange('toggle-sw',        (d, ev) => {
  A.setPolicy({ smartWorkingAbilitato: ev.target.checked });
  UI.toast(ev.target.checked ? '✓ Smart Working abilitato' : 'Smart Working disabilitato');
});
UI.onChange('toggle-notifica', (d, ev) => {
  A.setNotifica(d.chiave, ev.target.checked);
  UI.toast(ev.target.checked ? '✓ Notifica attivata' : 'Notifica disattivata');
});

UI.onInput('zona-nome',   (d, ev) => A.aggiornaZona(d.zonaId, { nome: ev.target.value }));
UI.onChange('zona-posti', (d, ev) => A.aggiornaZona(d.zonaId, { posti: parseInt(ev.target.value, 10) || 0 }));

UI.on('aggiungi-zona', () => { const id = A.aggiungiZona(); UI.toast(`Zona ${id} aggiunta · imposta i posti e salva`); });
UI.on('rimuovi-zona', d => {
  const n = State.stalli.filter(s => s.zonaId === d.zonaId).length;
  A.rimuoviZona(d.zonaId);
  UI.toast(`Zona ${d.zonaId} rimossa · ${n} stalli eliminati dalla mappa`);
});
UI.on('salva-zone', () => {
  const tot = A.salvaZone();
  UI.toast(`✓ Zone salvate · mappa aggiornata a ${tot} stalli`);
});

UI.on('salva-policy', () => {
  Modals._collect();
  const fm = Modals.form;
  A.setPolicy({
    maxBookingWeeks: Math.min(4, Math.max(1, parseInt(fm.maxBookingWeeks, 10) || 1)),
    noShowMinuti: parseInt(fm.noShowMinuti, 10) || 30,
    durataMaxDipendenteOre: parseInt(fm.durataMaxDipendenteOre, 10) || 10,
    notificaDurataOre: parseInt(fm.notificaDurataOre, 10) || 8,
    durataMaxEvOre: parseInt(fm.durataMaxEvOre, 10) || 4,
    sogliaViolazioni: parseInt(fm.sogliaViolazioni, 10) || 3
  });
  Modals.close();
  UI.toast('✓ Policy salvata e applicata a tutti i dipendenti');
});

/* ---- export / periodo ---- */
UI.on('sel-report', d => { Modals._collect(); Modals.form.report = d.valore; Modals._render(); });
UI.on('genera-export', () => {
  Modals._collect();
  const { report, formato, email } = Modals.form;
  const nomi = { completo: 'Report Completo', accessi: 'Log Accessi', segnalazioni: 'Segnalazioni & Violazioni', dipendenti: 'Report Dipendenti' };
  const oggi = U.OGGI_ISO;
  Modals.close();

  /* Due combinazioni producono un file vero; le altre restano simulate. */
  if (report === 'accessi' && formato === 'CSV') {
    const righe = S.esportaAccessi();
    /* BOM: senza, Excel interpreta male gli accenti */
    const esito = UI.scarica('parkingcloud_accessi_' + oggi + '.csv',
      '﻿' + U.toCSV(righe), 'text/csv');
    UI.toast(`⬇ ${esito.nomeFile} scaricato · ${righe.length} record · ${State.config.periodo.label.toLowerCase()}`);
    return;
  }

  if (report === 'dipendenti' && formato === 'JSON') {
    const dati = S.esportaDipendenti();
    const esito = UI.scarica('parkingcloud_dipendenti_' + oggi + '.json',
      JSON.stringify(dati, null, 2), 'application/json');
    UI.toast(`⬇ ${esito.nomeFile} scaricato · ${dati.length} dipendenti`);
    return;
  }

  UI.toast(`📊 ${nomi[report] || 'Report'} (${formato}) in generazione · invio a ${email}`);
});
UI.on('set-periodo', d => { A.setPeriodo(d.valore); Modals.close(); UI.toast('Periodo: ' + State.config.periodo.label); });
UI.on('applica-periodo', () => {
  Modals._collect();
  A.setPeriodoManuale(Modals.form.dal, Modals.form.al);
  Modals.close();
  UI.toast('Periodo aggiornato: ' + State.config.periodo.label);
});

/* ---- richieste pass ---- */
UI.on('approva-req', d => {
  Modals._collect();
  const v = A.approvaRichiestaPass(d.richiestaId, Modals.form.note);
  Modals.close();
  UI.toast(`✓ Approvato · codice My2N ${v.codiceMy2N} inviato a ${v.email}`);
});
UI.on('rifiuta-req', d => {
  const r = A.rifiutaRichiestaPass(d.richiestaId, Modals.form.note);
  Modals.close();
  UI.toast(`Richiesta rifiutata · ${S.nomePersona(r.dipendenteId)} notificato`);
});

})(window);
