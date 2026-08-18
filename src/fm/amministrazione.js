/* ============================================================================
   ADMIN · Amministrazione   (visibile solo se PERMISSIONS[ruolo].amministrazione)
   ----------------------------------------------------------------------------
   Due sottosezioni: Utenti & Ruoli (Admin e FM di piattaforma) e Parcheggi.
   I DIPENDENTI non stanno qui: sono utenti del parcheggio e restano nella
   sezione Dipendenti, gestiti dal FM.
============================================================================ */
(function (global) {
'use strict';
const { UI, Selectors: S, Actions: A, State, Modals, Utils: U, Domini: D } = global.PC;

function dataBreve(iso) {
  if (!iso) return '—';
  if (iso === U.OGGI_ISO) return 'oggi';
  if (iso === U.toISO(U.addDays(U.OGGI, -1))) return 'ieri';
  return U.fmtDM(U.fromISO(iso));
}

global.PC.Sezioni.amministrazione = {
  render() {
    const tab = State.ui.adminTab;
    const utenti = State.utentiPiattaforma;

    const kpi = UI.kpiGrid([
      UI.kpi({ label: 'Utenti piattaforma', val: utenti.length, colore: 'blue' }),
      UI.kpi({ label: 'Admin',              val: utenti.filter(u => u.ruolo === 'admin').length, colore: 'cyan' }),
      UI.kpi({ label: 'Facility Manager',   val: utenti.filter(u => u.ruolo === 'fm').length, colore: 'blue' }),
      UI.kpi({ label: 'Inviti in attesa',   val: utenti.filter(u => u.statoAccount === 'invito_inviato').length, colore: 'amber' })
    ], 4);

    const subtab = `
      <div class="tabbar" style="margin-bottom:16px">
        <div class="tab-btn${tab === 'utenti' ? ' active' : ''}"${UI.act('admin-tab', { tab: 'utenti' })}>👥 Utenti &amp; Ruoli</div>
        <div class="tab-btn${tab === 'parcheggi' ? ' active' : ''}"${UI.act('admin-tab', { tab: 'parcheggi' })}>🅿 Parcheggi</div>
      </div>`;

    return '<div class="sec-title">Amministrazione piattaforma</div>' + kpi + subtab
      + (tab === 'parcheggi' ? cardParcheggi() : cardUtenti());
  }
};

/* ---- 5.1 Utenti & Ruoli ---------------------------------------------- */
function cardUtenti() {
  const sede = State.config.sede;
  const rows = State.utentiPiattaforma.map(u => {
    const st = D.STATO_ACCOUNT[u.statoAccount] || D.STATO_ACCOUNT.attivo;
    const azioni = [
      UI.btn('Dettaglio', { azione: 'apri-utente-piattaforma', params: { utenteId: u.id }, titolo: 'Visualizza dettaglio' }),
      UI.btn(u.statoAccount === 'disattivato' ? 'Attiva' : 'Disattiva',
        { azione: 'toggle-utente', params: { utenteId: u.id },
          variante: u.statoAccount === 'disattivato' ? 'btn-success' : 'btn-ghost' }),
      u.statoAccount === 'invito_inviato'
        ? UI.btn('▶ Simula attivazione', { azione: 'simula-attivazione-utente', params: { utenteId: u.id }, variante: 'btn-cyan' })
        : UI.btn('Reinvia invito', { azione: 'reinvia-invito', params: { utenteId: u.id } })
    ].join(' ');

    return UI.riga([
      `<b>${UI.esc(u.nomeCompleto)}</b>`,
      `<span class="mono" style="font-size:11.5px">${UI.esc(u.email)}</span>`,
      /* il cambio ruolo è riservato all'Admin (gestioneRuoli) */
      S.puo('gestioneRuoli')
        ? UI.select([{ v: 'admin', l: 'Admin' }, { v: 'fm', l: 'Facility Manager' }], u.ruolo,
            { azione: 'cambia-ruolo', params: { utenteId: u.id }, stile: 'width:150px;padding:5px 8px;font-size:12px' })
        : UI.tag(S.etichettaRuolo(u.ruolo), u.ruolo === 'admin' ? 'cyan' : 'blue'),
      u.sedeId ? UI.esc(sede.nomeBreve) : '<span class="muted">tutte le sedi</span>',
      UI.badge(st.label, st.colore, u.statoAccount === 'attivo'),
      `<span class="muted" style="font-size:11.5px">${dataBreve(u.ultimoAccesso)}</span>`,
      `<div style="display:flex;gap:5px;flex-wrap:wrap">${azioni}</div>`
    ], { azione: null });
  });

  return UI.card({
    titolo: 'Utenti di piattaforma',
    sub: 'Admin e Facility Manager. I dipendenti si gestiscono nella sezione Dipendenti.',
    azioni: [UI.btn('+ Aggiungi', { azione: 'apri-modale', params: { modale: 'add-platform-user' }, variante: 'btn-primary' })],
    body: UI.tabella({
      head: ['Nome', 'Email', 'Ruolo', 'Parcheggio / Sede', 'Stato', 'Ultimo accesso', 'Azioni'],
      rows, scroll: false, vuoto: 'Nessun utente di piattaforma.'
    })
  });
}

/* ---- 5.2 Parcheggi (placeholder non interattivo) --------------------- */
function cardParcheggi() {
  const sede = State.config.sede;
  const kpi = S.kpiStalli();
  const fm = S.facilityManager();
  return UI.card({
    titolo: 'Parcheggi gestiti',
    sub: 'La gestione multi-parcheggio sarà attiva in una fase successiva.',
    body: `
      <div class="parcheggio-card">
        <div class="parcheggio-hd">
          <div style="flex:1">
            <div class="parcheggio-nome">${UI.esc(sede.nome)}</div>
            <div class="parcheggio-addr">${UI.esc(sede.indirizzo)}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            ${UI.badge('Attivo', 'green', true)}
            ${UI.btn(State.ui.editSede ? '✕ Annulla' : '✏️ Modifica', { azione: 'toggle-edit-sede' })}
          </div>
        </div>
        ${State.ui.editSede ? formSede(sede, kpi) : ''}
        ${UI.infoGrid([
          UI.infoBox('Facility Manager assegnato', fm ? UI.esc(fm.nomeCompleto) : '<span class="muted">non assegnato</span>'),
          UI.infoBox('Posti totali', kpi.totale),
          UI.infoBox('Zone configurate', State.zone.length),
          UI.infoBox('Dipendenti autorizzati', S.kpiDipendenti().autorizzati)
        ])}
      </div>
      <div class="ripristino-box">
        ${UI.btn('🔄 Ripristina dati demo', { azione: 'apri-modale', params: { modale: 'conferma-ripristino' }, sm: false })}
        <div class="ripristino-nota">Riporta tutti i dati allo stato iniziale senza ricaricare la pagina e senza perdere la sessione.</div>
      </div>
      <div class="disabled-wrap" style="margin-top:14px">
        <div class="disabled-over">
          <div class="dis-lock">🔒</div>
          <div class="dis-tag">Fase successiva</div>
          <div class="dis-msg">Aggiunta di nuovi parcheggi, assegnazione FM multipli e reportistica aggregata.</div>
        </div>
        <div class="card" style="filter:blur(2px);pointer-events:none;user-select:none">
          <div class="card-hd"><div class="card-title">🏢 Altri parcheggi</div></div>
          <div style="height:70px;background:var(--bg-raised);border-radius:var(--r-sm)"></div>
        </div>
      </div>`
  });
}

/** form inline di personalizzazione sede (demo multi-cliente) */
function formSede(sede, kpi) {
  return `<div class="sede-form">
    <div class="form-grid2">
      ${UI.campo('Nome sede', UI.input({ id: 'sede-nome', valore: sede.nome, focusKey: 'sede-nome' }))}
      ${UI.campo('Indirizzo', UI.input({ id: 'sede-indirizzo', valore: sede.indirizzo, focusKey: 'sede-indirizzo' }))}
    </div>
    ${UI.campo('Numero posti totali', UI.input({ id: 'sede-posti', tipo: 'number', valore: kpi.totale, min: 1, focusKey: 'sede-posti' }))}
    ${UI.alert('Cambiando il numero di posti vengono creati o rimossi stalli reali nella prima zona standard.', 'info')}
    <div style="display:flex;gap:8px;justify-content:flex-end">
      ${UI.btn('Annulla', { azione: 'toggle-edit-sede', sm: false })}
      ${UI.btn('Salva', { azione: 'salva-sede', variante: 'btn-primary', sm: false })}
    </div>
  </div>`;
}

/* ---- handler --------------------------------------------------------- */
UI.on('admin-tab', d => A.setAdminTab(d.tab));

UI.on('toggle-edit-sede', () => A.toggleEditSede());
UI.on('salva-sede', () => {
  const v = (id) => { const e = document.getElementById(id); return e ? e.value : null; };
  const nome = (v('sede-nome') || '').trim();
  if (!nome) { UI.toast('Il nome sede non può essere vuoto'); return; }
  const posti = parseInt(v('sede-posti'), 10);
  if (!posti || posti < 1) { UI.toast('Il numero di posti deve essere almeno 1'); return; }
  const indirizzo = (v('sede-indirizzo') || '').trim();
  /* Ridurre i posti elimina stalli e annulla prenotazioni: va confermato.
     Se il numero sale o resta uguale si applica direttamente, come prima. */
  const ant = S.anteprimaPosti(posti);
  if (ant.rimossi.length) {
    Modals.open('conferma-riduzione', { nome, indirizzo, posti });
    return;
  }
  A.aggiornaSede({ nome, indirizzo, postiTotali: posti });
  UI.toast(`✓ Sede aggiornata: ${nome} · ${S.kpiStalli().totale} posti`);
});

UI.on('conferma-riduzione-posti', d => {
  const ant = S.anteprimaPosti(d.posti);
  A.aggiornaSede({ nome: d.nome, indirizzo: d.indirizzo, postiTotali: parseInt(d.posti, 10) });
  Modals.close();
  UI.toast(`✓ Sede aggiornata · ${ant.rimossi.length} stalli rimossi · ${ant.prenotazioni} prenotazioni annullate`);
});

UI.on('conferma-ripristino-demo', () => {
  Modals.close();
  const r = A.ripristinaDemo();
  UI.toast(r.sessioneChiusa
    ? '🔄 Dati ripristinati · il tuo account non esisteva nel seed: sessione chiusa'
    : '🔄 Dati demo ripristinati allo stato iniziale');
});

UI.onChange('cambia-ruolo', (d, ev) => {
  if (!S.puo('gestioneRuoli')) { UI.toast('Permesso negato: solo un Admin può cambiare i ruoli'); return; }
  const u = A.cambiaRuoloUtente(d.utenteId, ev.target.value);
  UI.toast(`✓ ${u.nomeCompleto} ora è ${S.etichettaRuolo(u.ruolo)}`);
});

UI.on('toggle-utente', d => {
  const u = A.toggleAttivoUtente(d.utenteId);
  UI.toast(u.statoAccount === 'disattivato'
    ? `🚫 ${u.nomeCompleto} disattivato`
    : `✓ ${u.nomeCompleto} riattivato`);
});

UI.on('reinvia-invito', d => {
  const u = A.reinviaInvito(d.utenteId);
  UI.toast(`📧 Invito reinviato a ${u.email}`);
});

UI.on('apri-utente-piattaforma', d => Modals.open('platform-user-det', { utenteId: d.utenteId }));

UI.on('simula-attivazione-utente', d => {
  Modals.close();
  A.avviaAttivazione(d.utenteId, 'piattaforma');
});

UI.on('crea-utente-piattaforma', () => {
  Modals._collect();
  const fm = Modals.form;
  const r = A.creaUtentePiattaforma({
    nome: fm.nome, cognome: fm.cognome, email: fm.email,
    ruolo: fm.ruolo || 'fm', sedeId: fm.ruolo === 'admin' ? null : (fm.sede || 'SEDE-DEMO')
  });
  if (r.errore) { UI.toast('⚠ ' + r.errore); return; }
  Modals.close();
  A.vaiA('amministrazione');
  A.setAdminTab('utenti');
  UI.toast(`📧 Invito inviato a ${r.email}`);
});

})(window);
