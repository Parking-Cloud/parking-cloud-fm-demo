/* ============================================================================
   FM · Visitatori — pass temporanei
   Un pass creato compare subito in lista, occupa uno stallo di Zona V e si
   vede nella mappa: nessun dato duplicato. [copre anche DV10]
============================================================================ */
(function (global) {
'use strict';
const { UI, Selectors: S, Actions: A, State, Modals, Utils: U } = global.PC;

const STATO = {
  atteso:   ['Atteso',   'amber'],
  dentro:   ['Dentro',   'cyan'],
  uscito:   ['Uscito',   'gray'],
  revocato: ['Revocato', 'red']
};

global.PC.Sezioni.visitatori = {
  render() {
    const k = S.kpiVisitatori();
    const per = State.config.periodo;
    const oggi = State.visitatori.filter(v => v.data >= per.dal && v.data <= per.al)
      .sort((a, b) => b.data.localeCompare(a.data)).slice(0, 120);
    const futuri = State.visitatori.filter(v => v.data > per.al);

    const kpi = UI.kpiGrid([
      /* puntuale: sempre "adesso" */
      UI.kpi({ label: 'Attivi Ora', val: k.attivi, sub: 'dentro adesso', colore: 'purple' }),
      UI.kpiPeriodo({ label: 'Previsti' + (k.multi ? '' : ' Oggi'), tot: k.previsti, media: k.medie.previsti,
        multi: k.multi, colore: 'blue' }),
      UI.kpiPeriodo({ label: 'Check-in', tot: k.checkIn, media: k.medie.checkIn, multi: k.multi, colore: 'green' }),
      UI.kpiPeriodo({ label: 'Pass scaduti', tot: k.scaduti, media: 0, multi: k.multi, primario: 'totale',
        sub: k.scaduti ? 'senza check-out' : 'nessuno', colore: 'amber' })
    ], 4);

    const riga = v => {
      const [lbl, col] = STATO[v.stato];
      const badge = v.zonaErrata && v.stato === 'dentro' ? UI.badge('Zona errata', 'red') : UI.badge(lbl, col);
      return UI.riga([
        `<b>${UI.esc(v.nome)}</b>${v.scaduto ? ' <span class="tag tag-amber" style="font-size:9.5px">scaduto</span>' : ''}`,
        UI.esc(v.azienda),
        `<span class="mono" style="font-size:11px">${UI.esc(v.passId)}</span>`,
        UI.esc(v.stalloId || '–'),
        `<span class="mono" style="font-size:11px">${UI.esc(v.oraInizio.slice(0, 2))}–${UI.esc(v.oraFine.slice(0, 2))}</span>`,
        badge,
        '<span class="muted">›</span>'
      ], { azione: 'apri-vis', params: { visitatoreId: v.id }, classe: v.zonaErrata && v.stato === 'dentro' ? 'row-alert' : (v.stato === 'revocato' ? 'row-dim' : '') });
    };

    const cardOggi = UI.card({
      titolo: 'Visitatori — ' + UI.esc(per.label),
      sub: `${oggi.length} pass nel periodo`,
      azioni: [
        UI.btn('⤓', { azione: 'apri-modale', params: { modale: 'export' } }),
        UI.btn('+ Nuovo Pass', { azione: 'apri-modale', params: { modale: 'add-vis' }, variante: 'btn-primary' })
      ],
      body: UI.tabella({
        head: ['Visitatore', 'Azienda', 'Pass', 'Stallo', 'Orario', 'Stato', ''],
        rows: oggi.map(riga),
        vuoto: 'Nessun visitatore previsto oggi.'
      })
    });

    const cardFuturi = futuri.length ? UI.card({
      titolo: 'Pass programmati',
      stile: 'margin-top:14px',
      body: UI.tabella({
        head: ['Visitatore', 'Azienda', 'Pass', 'Stallo', 'Data', 'Stato', ''],
        scroll: false,
        rows: futuri.map(v => UI.riga([
          `<b>${UI.esc(v.nome)}</b>`, UI.esc(v.azienda),
          `<span class="mono" style="font-size:11px">${UI.esc(v.passId)}</span>`,
          UI.esc(v.stalloId || '–'),
          `<span class="mono" style="font-size:11px">${UI.esc(U.fmtDM(U.fromISO(v.data)))}</span>`,
          UI.badge('Programmato', 'blue'), '<span class="muted">›</span>'
        ], { azione: 'apri-vis', params: { visitatoreId: v.id } }))
      })
    }) : '';

    return kpi + cardOggi + cardFuturi;
  }
};

/* ---- handler ---------------------------------------------------------- */
UI.on('apri-vis', d => { A.seleziona('visitatoreId', d.visitatoreId); Modals.open('vis-det', { visitatoreId: d.visitatoreId }); });

UI.on('crea-visitatore', () => {
  Modals._collect();
  const fm = Modals.form;
  if (!fm.email) { UI.toast("L'email del visitatore è obbligatoria"); return; }
  const v = A.creaPassVisitatore({
    nome: (fm.nome || 'Visitatore').trim(), azienda: fm.azienda, email: fm.email.trim(),
    dataISO: fm.data, oraInizio: fm.da, oraFine: fm.a, referenteId: fm.referente
  });
  /* Il codice digitato a mano vale solo se il pass e' davvero "a codice":
     scriverlo su una ricevuta creerebbe un numero che nessun varco legge. */
  const pv = S.passVisitatore(v);
  if (pv.tipo === 'codice' && fm.codice) v.codiceAccesso = fm.codice;
  Modals.close();
  A.vaiA('visitatori');
  UI.toast(pv.tipo === 'codice' ? `✓ Pass ${v.passId} creato · codice ${v.codiceAccesso} inviato a ${v.email}`
    : pv.tipo === 'qr' ? `✓ Pass ${v.passId} creato · QR ${v.codiceQR} inviato a ${v.email}`
    : `✓ Pass ${v.passId} creato · ricevuta inviata a ${v.email} · ${pv.metodoLabel}`);
});

UI.on('vis-arrivato', d => {
  const v = A.segnaVisitatoreArrivato(d.visitatoreId);
  UI.toast(`\u2713 ${v.nome} segnalato come arrivato`);
});
UI.on('vis-uscito', d => {
  const v = A.segnaVisitatoreUscito(d.visitatoreId);
  UI.toast(`\u23f9 ${v.nome} segnalato come uscito`);
});

UI.on('aggiorna-periodo-pass', d => {
  Modals._collect();
  const fm = Modals.form;
  const r = A.aggiornaPeriodoPass(d.visitatoreId, {
    dataInizio: fm.dataInizio, dataFine: fm.dataFine,
    oraInizio: fm.oraInizio, oraFine: fm.oraFine
  });
  if (r && r.errore) { UI.toast('\u26a0 ' + r.errore); return; }
  const gg = Math.round((U.fromISO(r.dataFine || r.data) - U.fromISO(r.data)) / 86400000) + 1;
  UI.toast(`\u{1F553} ${r.nome}: periodo aggiornato \u00b7 ${U.fmtDM(U.fromISO(r.data))}` +
    (gg > 1 ? ` \u2013 ${U.fmtDM(U.fromISO(r.dataFine))}` : '') + ` \u00b7 ${r.oraInizio}\u2013${r.oraFine}`);
});

UI.on('revoca-pass', d => {
  const v = A.revocaPass(d.visitatoreId);
  Modals.close();
  UI.toast(`Pass ${v.passId} revocato · stallo ${v.stalloId || ''} liberato`.trim());
});

UI.on('estendi-pass', d => {
  const v = S.visitatore(d.visitatoreId);
  const [h, m] = v.oraFine.split(':').map(Number);
  const nuova = String(Math.min(23, h + 2)).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  A.estendiPass(d.visitatoreId, nuova);
  Modals.close();
  UI.toast(`✓ Pass ${v.passId} esteso fino alle ${nuova}`);
});

/* Zona errata: il flusso mancante nell'AS-IS (DV10) */
UI.on('risolvi-zona-errata', d => {
  Modals._collect();
  const azione = Modals.form.azione || 'notifica';
  const v = S.visitatore(d.visitatoreId);
  const seg = State.segnalazioni.find(s => s.tipo === 'zona' && s.stalloId === v.stalloId && s.stato !== 'risolta');

  if (azione === 'revoca') {
    A.revocaPass(d.visitatoreId);
    if (seg) A.gestisciSegnalazione(seg.id, 'risolvi', 'Pass revocato dal FM.');
    UI.toast(`Pass ${v.passId} revocato`);
  } else if (azione === 'riassegna') {
    const libero = State.stalli.find(s => s.zonaId === 'V' && S.statoStallo(s.id).stato === 'libero');
    A.mutaVisitatore(d.visitatoreId, { stalloId: libero ? libero.id : v.stalloId, zonaErrata: false });
    if (seg) A.gestisciSegnalazione(seg.id, 'risolvi', 'Visitatore riassegnato a ' + (libero ? libero.id : v.stalloId) + '.');
    UI.toast(`✓ ${v.nome} riassegnato allo stallo ${libero ? libero.id : v.stalloId}`);
  } else {
    if (seg) A.gestisciSegnalazione(seg.id, 'rinvia_notifica', 'Referente notificato.');
    UI.toast(`📢 Referente ${S.nomePersona(v.referenteId)} notificato`);
  }
  Modals.close();
});

})(window);
