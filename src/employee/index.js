/* ============================================================================
   VISTA DIPENDENTE
   Legge e scrive sullo STESSO AppState del FM. Una prenotazione fatta qui
   compare nella vista settimanale FM; uno Smart Working libera lo stallo
   nella Mappa FM. Nessuna sincronizzazione esplicita: è lo stesso dato.
============================================================================ */
(function (global) {
'use strict';
const { UI, Selectors: S, Actions: A, State, Modals, Utils: U, Domini: D } = global.PC;

/* zone mostrate al dipendente: la sua planimetria di orientamento */
const ZONE_VISIBILI = ['A', 'B', 'C', 'EV'];

global.PC.Sezioni.dipendenteView = {
  render() {
    const dip = S.dipendenteCorrente();
    /* Guardia: qui puo' arrivare solo un dipendente. Se la sessione appartiene
       a un utente di piattaforma (o e' incoerente) non si prosegue: meglio un
       messaggio neutro che una vista popolata con dati di un altro. */
    if (!dip) { vistaNonDisponibile(); return; }
    const anticipo = S.giorniAnticipo();
    const giorni = S.settimanaEmp();
    const oggi = new Date();

    /* ---- TOPBAR ---- */
    UI.mount('#emp-topbar', `
      <div class="emp-logo-wrap">
        <div class="pc-logo">
          <div class="pc-logo-icon">🅿</div>
          <div class="pc-logo-text"><span class="pc-parking">parking</span><span class="pc-cloud">CLOUD</span></div>
        </div>
        <small>${UI.esc(State.config.sede.descrizione)}</small>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        ${dip.puoRichiederePass ? UI.btn('🪪 Richiedi Pass', { azione: 'apri-modale', params: { modale: 'emp-richiedi-pass' } }) : ''}
        ${UI.btn('🚨 Segnala', { azione: 'apri-modale', params: { modale: 'emp-segnala' } })}
        <div class="emp-av" data-act="apri-modale" data-modale="emp-profile" title="Profilo">${UI.esc(dip.iniziali)}</div>
        ${UI.btn('⏻', { azione: 'logout', sm: false, stile: 'padding:7px 10px;font-size:14px', titolo: 'Esci' })}
      </div>`);

    /* ---- HERO ---- */
    const segnalazioniMie = State.segnalazioni.filter(s => s.segnalanteId === dip.id && s.stato !== 'risolta');
    const hero = `
      <div class="emp-hero">
        <div>
          <div class="emp-greeting">Ciao, <span>${UI.esc(dip.nome)}</span> 👋</div>
          <div class="emp-meta">${dip.stalloId
            ? `Stallo assegnato dal FM: <strong>${UI.esc(dip.stalloId)}</strong> · ${UI.esc((S.stallo(dip.stalloId) || {}).piano || '')}`
            : 'Nessuno stallo fisso · <strong>pool rotante</strong>'} · ${UI.esc(dip.dipartimento)}</div>
          <div class="emp-status-wrap">
            ${segnalazioniMie.length
              ? UI.badge(segnalazioniMie.length + ' segnalazione' + (segnalazioniMie.length > 1 ? 'i' : '') + ' in corso', 'amber')
              : UI.badge('Nessuna segnalazione attiva', 'green', true)}
            ${S.notifichePassNonLette(dip.id).map(r => UI.badge(
                (r.stato === 'approvata' ? '✓ Pass approvato · ' : '✗ Pass rifiutato · ') + r.visitatoreNome,
                r.stato === 'approvata' ? 'green' : 'red')).join('')}
            <div class="booking-window-chip">📅 Prenota fino a <strong>${anticipo} giorn${anticipo === 1 ? 'o' : 'i'} lavorativ${anticipo === 1 ? 'o' : 'i'}</strong> in anticipo</div>
          </div>
        </div>
        <div style="text-align:right">
          <div class="emp-today-lbl">Oggi</div>
          <div class="emp-today-date">${oggi.getDate()} ${U.MONTHS_SHORT[oggi.getMonth()]} ${oggi.getFullYear()}</div>
          <div class="emp-today-dow">${U.DAYS_FULL_IT[oggi.getDay()]}</div>
        </div>
      </div>`;

    /* ---- NAVIGAZIONE SETTIMANE ---- */
    const off = State.ui.empWeekOffset;
    const titoloSett = off === 0 ? 'Questa settimana' : `Settimana del ${U.fmtDM(giorni[0])}`;
    const nav = `
      <div class="week-nav">
        <div class="week-nav-title">${titoloSett}
          <span>${U.fmtDM(giorni[0])} – ${U.fmtDM(giorni[4])}</span>
        </div>
        ${UI.btn('‹ Prec', { azione: 'week-emp', params: { delta: -1 }, disabled: off <= 0 })}
        ${UI.btn('Succ ›', { azione: 'week-emp', params: { delta: 1 }, disabled: !S.settimanaHaGiorniPrenotabili(off + 1) })}
      </div>`;

    /* ---- GRIGLIA GIORNI ---- */
    const griglia = `<div class="emp-days-grid">${giorni.map(g => cardGiorno(g, dip)).join('')}</div>`;

    /* ---- MAPPA (sola lettura, riflette lo stato reale) ---- */
    const isoSel = State.ui.selezione.giornoISO && giorni.some(g => U.toISO(g) === State.ui.selezione.giornoISO)
      ? State.ui.selezione.giornoISO : U.OGGI_ISO;
    const mieDelGiorno = S.prenotazione(dip.id, isoSel);
    const mappa = `
      <div class="emp-map-section">
        <div class="emp-map-title">Mappa Parcheggio <span style="font-size:11px;font-weight:400;color:var(--text-muted);margin-left:6px">· lo stallo viene assegnato automaticamente</span></div>
        <div class="emp-map-sub">Disponibilità del <strong>${UI.esc(U.fmtMedium(U.fromISO(isoSel)))}</strong>. Clicca su un giorno del calendario per prenotare.</div>
        <div class="priorita-box">
          <div class="priorita-tit">Il sistema assegna lo stallo seguendo questa priorità:</div>
          <ol class="priorita-list">
            <li>Il tuo stallo fisso, se disponibile</li>
            <li>Stallo con la tua caratteristica (EV / ♿)</li>
            <li>Stesso piano — stallo libero più vicino</li>
            <li>Primo stallo libero disponibile</li>
          </ol>
        </div>
        <div class="emp-map-legend">
          <div class="leg-item"><div class="leg-dot leg-free"></div>Disponibile</div>
          <div class="leg-item"><div class="leg-dot leg-occ"></div>Occupato</div>
          <div class="leg-item"><div class="leg-dot leg-mine"></div>Il tuo stallo</div>
          <div class="leg-item"><div class="leg-dot leg-ev"></div>EV ⚡</div>
          <div class="leg-item"><div class="leg-dot leg-maint"></div>Manutenzione</div>
        </div>
        <div class="emp-zones">${ZONE_VISIBILI.map(zid => {
          const z = S.zona(zid);
          const stalli = State.stalli.filter(s => s.zonaId === zid);
          if (!z || !stalli.length) return '';
          const liberi = stalli.filter(s => S.statoStallo(s.id, isoSel).stato === 'libero').length;
          return `<div class="emp-zone">
            <div class="emp-zone-lbl">${UI.esc(z.nome)} <span class="mono" style="letter-spacing:0">${liberi} liberi</span></div>
            <div class="emp-spots-row">${stalli.map(s => {
              const stato = S.statoStallo(s.id, isoSel);
              const mio = mieDelGiorno && mieDelGiorno.stalloId === s.id;
              const cls = mio ? 'espot-mine'
                : stato.stato === 'manutenzione' || stato.stato === 'bloccato' ? 'espot-maint'
                : stato.stato !== 'libero' ? 'espot-occ'
                : s.tipo === 'ev' ? 'espot-ev'
                : s.tipo === 'disabili' ? 'espot-dis'
                : 'espot-free';
              const ico = D.TIPO_STALLO[s.tipo].icona;
              const titolo = mio ? s.codice + ' — il tuo stallo' : s.codice + ' — ' + stato.label;
              return `<div class="espot ${cls}" title="${UI.esc(titolo)}">${ico ? `<span class="espot-icon">${ico}</span>` : ''}${UI.esc(s.codice)}</div>`;
            }).join('')}</div>
          </div>`;
        }).join('')}</div>
      </div>`;

    /* ---- LE MIE PRENOTAZIONI ---- */
    const future = S.prenotazioniDipendente(dip.id, U.OGGI_ISO);
    const lista = `
      <div style="margin-top:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div class="emp-section-title">Le mie prenotazioni</div>
          ${UI.btn('Storico →', { azione: 'apri-modale', params: { modale: 'emp-history' } })}
        </div>
        ${future.length ? future.map(p => {
          const d = U.fromISO(p.data);
          return `<div class="my-booking-card"${UI.act('emp-apri-giorno', { giornoIso: p.data })}>
            <div><div class="mbc-date">${d.getDate()}</div><div class="mbc-month">${U.MONTHS_SHORT[d.getMonth()]}</div></div>
            <div class="mbc-info">
              <div class="mbc-spot">${p.tipo === 'ufficio'
                ? 'Stallo ' + UI.esc(p.stalloId) + (p.turnoId && S.turno(p.turnoId) ? ' · ' + UI.esc(S.turno(p.turnoId).label) : '')
                : 'Smart Working 🏠'}</div>
              <div class="mbc-meta">${U.DAYS_FULL_IT[d.getDay()]} · ${p.tipo === 'ufficio' ? UI.esc((S.stallo(p.stalloId) || {}).piano || '') + ' · check-in via app' : 'nessuno stallo necessario'}</div>
            </div>
            <div class="mbc-actions">
              ${p.tipo === 'ufficio' ? UI.badge('Prenotato', 'blue') : UI.badge('Smart W.', 'amber')}
              ${UI.btn('Cancella', { azione: 'emp-apri-cancella', params: { giornoIso: p.data } })}
            </div>
          </div>`;
        }).join('') : UI.vuoto('Nessuna prenotazione futura. Clicca su un giorno del calendario per prenotare.')}
      </div>`;

    UI.mount('#emp-content', hero + nav + griglia + mappa + lista + sezioneRichieste(dip));
  }
};

/** "Le mie richieste": due tab, pass visitatore e segnalazioni inviate.
    Aprire la tab Pass segna come letti gli esiti — il badge nell'hero sparisce. */
function sezioneRichieste(dip) {
  const tab = State.ui.empRichiesteTab || 'pass';
  const richieste = S.richiestePassDipendente(dip.id);
  const segnalazioni = S.segnalazioniDipendente(dip.id);
  const nonLette = S.notifichePassNonLette(dip.id).length;

  const tabs = `<div class="emp-req-tabs">
    <div class="tab-btn${tab === 'pass' ? ' active' : ''}"${UI.act('emp-richieste-tab', { tab: 'pass' })}>🪪 Pass Visitatori${richieste.length ? ` <span class="emp-req-count">${richieste.length}</span>` : ''}${nonLette ? '<span class="emp-req-dot"></span>' : ''}</div>
    <div class="tab-btn${tab === 'segnalazioni' ? ' active' : ''}"${UI.act('emp-richieste-tab', { tab: 'segnalazioni' })}>🚨 Segnalazioni${segnalazioni.length ? ` <span class="emp-req-count">${segnalazioni.length}</span>` : ''}</div>
  </div>`;

  const STATO_PASS = {
    in_attesa:  ['In attesa', 'amber'],
    approvata:  ['Approvato', 'green'],
    rifiutata:  ['Rifiutato', 'red']
  };
  const STATO_SEG = {
    aperta:      ['Aperta', 'red'],
    in_gestione: ['In gestione', 'amber'],
    risolta:     ['Risolta', 'green']
  };

  const corpo = tab === 'pass'
    ? (richieste.length
        ? richieste.map(r => {
            const [lbl, col] = STATO_PASS[r.stato] || ['—', 'gray'];
            const unGiorno = r.dataInizio === r.dataFine;
            return `<div class="emp-req-card">
              <div class="emp-req-hd">
                <div>
                  <div class="emp-req-nome">${UI.esc(r.visitatoreNome)}</div>
                  <div class="emp-req-meta">${UI.esc(r.azienda)} · ${UI.esc(r.visitatoreEmail)}</div>
                </div>
                ${UI.badge(lbl, col)}
              </div>
              <div class="emp-req-date">📅 ${UI.esc(U.fmtMedium(U.fromISO(r.dataInizio)))}${unGiorno ? '' : ' → ' + UI.esc(U.fmtMedium(U.fromISO(r.dataFine)))}</div>
              ${r.stato === 'approvata' && r.codiceMy2N
                ? `<div class="emp-code-box">
                     <span class="emp-code-lbl">Codice accesso</span>
                     <span class="emp-code-val">${UI.esc(r.codiceMy2N)}</span>
                     <span class="emp-code-note">valido H24 dal ${UI.esc(U.fmtDM(U.fromISO(r.dataInizio)))} al ${UI.esc(U.fmtDM(U.fromISO(r.dataFine)))}</span>
                   </div>`
                : ''}
              ${r.stato === 'rifiutata' && r.note
                ? `<div class="emp-req-nota">Motivo: ${UI.esc(r.note)}</div>` : ''}
            </div>`;
          }).join('')
        : UI.vuoto('Nessuna richiesta inviata'))
    : (segnalazioni.length
        ? segnalazioni.map(s => {
            const [lbl, col] = STATO_SEG[s.stato] || ['—', 'gray'];
            const t = D.TIPO_SEGNALAZIONE[s.tipo] || D.TIPO_SEGNALAZIONE.altro;
            return `<div class="emp-req-card">
              <div class="emp-req-hd">
                <div>
                  <div class="emp-req-nome">${t.icona} ${UI.esc(t.label)}</div>
                  <div class="emp-req-meta">${s.stalloId ? 'Stallo <strong>' + UI.esc(s.stalloId) + '</strong>' : 'Nessuno stallo indicato'}</div>
                </div>
                ${UI.badge(lbl, col)}
              </div>
              <div class="emp-req-date">📅 Inviata il ${UI.esc(U.fmtMedium(new Date(s.apertaIlTs)))} · ${UI.esc(U.hhmm(new Date(s.apertaIlTs)))}</div>
            </div>`;
          }).join('')
        : UI.vuoto('Nessuna richiesta inviata'));

  return `<div style="margin-top:24px">
    <div class="emp-section-title" style="margin-bottom:14px">Le mie richieste</div>
    ${tabs}
    <div class="emp-req-body">${corpo}</div>
  </div>`;
}

/** Schermata neutra quando la sessione non appartiene a un dipendente. */
function vistaNonDisponibile() {
  UI.mount('#emp-topbar', `
    <div class="emp-logo-wrap">
      <div class="pc-logo">
        <div class="pc-logo-icon">🅿</div>
        <div class="pc-logo-text"><span class="pc-parking">parking</span><span class="pc-cloud">CLOUD</span></div>
      </div>
    </div>
    ${UI.btn('⏻ Esci', { azione: 'logout', sm: false })}`);
  UI.mount('#emp-content', UI.card({
    titolo: 'Vista non disponibile',
    body: UI.alert('Questa sezione e\' riservata agli utenti con ruolo <strong>Dipendente</strong>. '
      + 'La sessione corrente non corrisponde a un dipendente del parcheggio.', 'warn')
      + UI.btn('Torna al login', { azione: 'logout', variante: 'btn-primary', sm: false })
  }));
}

/** card di un giorno nel calendario dipendente */
function cardGiorno(g, dip) {
  const iso = U.toISO(g);
  const oggi = U.OGGI;
  const passato = g < oggi;
  const fuoriFinestra = !S.dataPrenotabile(g);
  const isOggi = iso === U.OGGI_ISO;
  const pre = S.prenotazione(dip.id, iso);

  let cls = 'emp-day', stato = '', statoCls = '', spot = '';
  if (passato)                    { cls += ' day-past'; stato = 'Passato'; statoCls = 'past'; }
  else if (pre && pre.tipo === 'ufficio') {
    cls += ' day-booked'; stato = '✓ Prenotato'; statoCls = 'ok';
    const t = pre.turnoId ? S.turno(pre.turnoId) : null;
    spot = pre.stalloId + (t ? ' · ' + t.label : '');
  }
  else if (pre && pre.tipo === 'sw')      { cls += ' day-sw'; stato = '🏠 Smart W.'; statoCls = 'sw'; }
  else if (fuoriFinestra)         { cls += ' day-past'; stato = 'Non prenotabile'; statoCls = 'past'; }
  else                            { cls += ' day-todo'; stato = '+ Prenota'; statoCls = 'free'; }
  if (isOggi) cls += ' day-today';

  const cliccabile = !passato && !fuoriFinestra;
  return `<div class="${cls}"${cliccabile ? UI.act('emp-apri-giorno', { giornoIso: iso }) : ''}>
    ${isOggi ? '<div class="day-today-dot"></div>' : ''}
    <div class="day-dow">${U.DAYS_IT[g.getDay()]}</div>
    <div class="day-num">${g.getDate()}</div>
    <div class="day-status ${statoCls}">${stato}</div>
    ${spot ? `<div class="day-spot">${UI.esc(spot)}</div>` : ''}
  </div>`;
}

/* ---- handler ---------------------------------------------------------- */
UI.on('week-emp', d => A.empWeek(parseInt(d.delta, 10)));

UI.on('emp-richieste-tab', d => A.setEmpRichiesteTab(d.tab));

UI.on('emp-invia-richiesta-pass', () => {
  Modals._collect();
  const dip = S.dipendenteCorrente();
  if (!dip) { UI.toast('Sessione non valida'); return; }
  /* Doppia guardia: il pulsante non c'e' per chi non e' abilitato, ma
     l'azione e' comunque raggiungibile da console. */
  if (!dip.puoRichiederePass) { UI.toast('Non sei abilitato a richiedere pass visitatore'); return; }
  const fm = Modals.form;
  if (!(fm.visitatoreNome || '').trim())  { UI.toast('Il nome del visitatore è obbligatorio'); return; }
  if (!(fm.visitatoreEmail || '').trim()) { UI.toast('L\'email del visitatore è obbligatoria'); return; }
  if (!fm.dataInizio || !fm.dataFine)     { UI.toast('Indica data inizio e data fine'); return; }
  if (fm.dataFine < fm.dataInizio)        { UI.toast('La data fine non può precedere la data inizio'); return; }
  const r = A.creaRichiestaPass({
    dipendenteId: dip.id,
    visitatoreNome: fm.visitatoreNome, visitatoreEmail: fm.visitatoreEmail,
    azienda: fm.azienda,
    dataInizio: fm.dataInizio, dataFine: fm.dataFine, note: fm.note
  });
  Modals.close();
  const gg = Math.round((U.fromISO(r.dataFine) - U.fromISO(r.dataInizio)) / 86400000) + 1;
  UI.toast(`📨 Richiesta inviata al Facility Manager · ${gg} giorn${gg === 1 ? 'o' : 'i'} H24`);
});

UI.on('emp-apri-giorno', d => {
  State.ui.selezione.giornoISO = d.giornoIso;
  Modals.open('emp-book', { giornoISO: d.giornoIso });
});
UI.on('emp-apri-cancella', d => Modals.open('emp-cancel', { giornoISO: d.giornoIso }));
UI.on('emp-sel-tipo', d => { Modals._collect(); Modals.form.tipo = d.valore; Modals._render(); });

/* selezione del turno: stesso schema di emp-sel-tipo, il re-render ricalcola
   lo stallo assegnato perche' la disponibilita' dipende dal turno */
UI.on('emp-sel-turno', d => { Modals._collect(); Modals.form.turnoId = d.turnoId; Modals._render(); });

UI.on('emp-cambia-stallo', d => {
  const dip = S.dipendenteCorrente();
  if (!dip) return;
  const disponibili = S.stalliDisponibiliPer(dip.id, d.giornoIso);
  if (disponibili.length < 2) { UI.toast('Nessun altro stallo disponibile per questo giorno'); return; }
  Modals._collect();
  const attuale = Modals.form.stallo;
  const i = disponibili.indexOf(attuale);
  Modals.form.stallo = disponibili[(i + 1) % disponibili.length];
  /* cambiando stallo cambia anche il perche': va ricalcolato */
  Modals.form.motivoAssegnazione = S.motivoPerStallo(dip.id, Modals.form.stallo);
  Modals._render();
});

UI.on('emp-conferma', d => {
  Modals._collect();
  const dip = S.dipendenteCorrente();
  if (!dip) { UI.toast('Sessione non valida'); return; }
  const tipo = Modals.form.tipo || 'ufficio';
  const stallo = Modals.form.stallo;
  const perTurni = State.config.modalitaPrenotazione === 'turni';
  const turnoId = perTurni && tipo === 'ufficio' ? (Modals.form.turnoId || null) : null;
  if (perTurni && tipo === 'ufficio' && !turnoId) { UI.toast('Seleziona il turno'); return; }
  const r = A.prenota({ dipendenteId: dip.id, dataISO: d.giornoIso, tipo,
    stalloId: tipo === 'ufficio' ? stallo : null, turnoId });
  if (r.errore) { UI.toast('⚠ ' + r.errore); return; }
  Modals.close();
  const quando = U.fmtShort(U.fromISO(d.giornoIso));
  const emailMsg = `· Email di conferma inviata a ${dip.email}`;
  const t = turnoId ? S.turno(turnoId) : null;
  UI.toast(tipo === 'sw'
    ? `🏠 Smart Working dichiarato per ${quando} · stallo liberato ${emailMsg}`
    : `✓ Stallo ${r.stalloId}${t ? ' · ' + t.label : ''} prenotato per ${quando} ${emailMsg}`);
});

UI.on('emp-cancella', d => {
  const dip = S.dipendenteCorrente();
  if (!dip) { UI.toast('Sessione non valida'); return; }
  const pre = S.prenotazione(dip.id, d.giornoIso);
  if (!pre) { Modals.close(); return; }
  const stallo = pre.stalloId;
  A.annullaPrenotazione(pre.id);
  Modals.close();
  UI.toast(stallo
    ? `Prenotazione cancellata · stallo ${stallo} di nuovo disponibile`
    : 'Prenotazione cancellata');
});

UI.on('emp-invia-segnalazione', () => {
  Modals._collect();
  const dip = S.dipendenteCorrente();
  if (!dip) { UI.toast('Sessione non valida'); return; }
  const pre = S.prenotazione(dip.id, U.OGGI_ISO);
  const seg = A.creaSegnalazione({
    tipo: Modals.form.tipo || 'altro',
    stalloId: pre ? pre.stalloId : dip.stalloId,
    segnalanteId: dip.id,
    descrizione: Modals.form.note || 'Segnalazione inviata dal dipendente via app.'
  });
  Modals.close();
  const dest = State.config.notifiche.emailDestinatari.join(', ');
  UI.toast(`🚨 Segnalazione ${seg.id} inviata · notifica a ${dest}`);
});

})(window);
