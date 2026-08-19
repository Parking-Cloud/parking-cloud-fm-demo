/* ============================================================================
   FM · Dipendenti
   Il pulsante 🔍 è una ricerca reale su nome / email / dipartimento / stallo,
   e ogni riga apre il profilo di QUEL dipendente. [fix DV17 · DV18]
============================================================================ */
(function (global) {
'use strict';
const { UI, Selectors: S, Actions: A, State, Modals, Domini: D } = global.PC;

/* Il cap fisso non esiste piu': la tabella e' paginata (S.PER_PAGINA). */

/** Stato mostrato in tabella: prima l'account (invito), poi l'accesso. */
function statoBadge(d) {
  if (d.statoAccount === 'invito_da_inviare') return UI.badge('Invito da inviare', 'gray');
  if (d.statoAccount === 'invito_inviato')    return UI.badge('Invito inviato', 'amber');
  return d.stato === 'attivo' ? UI.badge('Attivo', 'green', true) : UI.badge('Bloccato', 'red');
}

global.PC.Sezioni.dipendenti = {
  render() {
    const k = S.kpiDipendenti();
    const q = State.ui.filtri.dipendenti.q;
    const tutti = S.dipendentiFiltrati();
    /* Il filtro agisce PRIMA della paginazione: si pagina il risultato della
       ricerca, non l'anagrafica intera. */
    const pag = S.paginaDi(tutti, State.ui.dipendentiPagina);
    const righe = pag.righe;
    const richieste = State.richiestePass.filter(r => r.stato === 'in_attesa');

    const kpi = UI.kpiGrid([
      UI.kpi({ label: 'Autorizzati',  val: k.autorizzati, colore: 'blue' }),
      UI.kpi({ label: 'App attiva',   val: k.appAttiva, sub: k.percApp + '%', colore: 'green' }),
      UI.kpi({ label: 'Bloccati',     val: k.bloccati, colore: 'red', azione: 'nav', params: { sezione: 'segnalazioni' } }),
      UI.kpi({ label: 'Pool rotante', val: k.poolRotante, sub: 'senza stallo fisso', colore: 'amber' })
    ], 4);

    const banner = richieste.length
      ? UI.alert(`🔔 <strong>${richieste.length} richiest${richieste.length === 1 ? 'a' : 'e'} pass visitatore</strong> da dipendente in attesa. `
          + UI.btn('Approva', { azione: 'apri-modale', params: { modale: 'req-pass', richiestaId: richieste[0].id }, variante: 'btn-primary', stile: 'margin-left:8px' }), 'info')
      : '';

    const ricerca = `<input class="form-input" style="width:220px;padding:6px 11px;font-size:12px"
        placeholder="🔍 Cerca nome, stallo, dipartimento…" value="${UI.esc(q)}"
        data-act="cerca-dip" data-focus-key="dip-q">`;

    const rows = righe.map(d => {
      const car = d.caratteristica === 'ev' ? UI.tag('EV ⚡', 'cyan')
        : d.caratteristica === 'disabili' ? UI.tag('♿', 'purple') : '–';
      return UI.riga([
        `<b>${UI.esc(d.nomeCompleto)}</b>`,
        `<span class="muted">${UI.esc(d.dipartimento)}</span>`,
        d.stalloId ? UI.tag(d.stalloId, 'blue') : '<span class="muted">pool</span>',
        /* Lo stato "bloccato" resta l'informazione dominante: dire "PIN Keypad"
           di chi non puo' entrare sarebbe fuorviante. */
        d.stato === 'bloccato' ? '<span class="muted">Sospeso</span>'
          : UI.esc(D.METODO_ACCESSO[S.metodoAccessoPerDipendente(d.id)] || '—'),
        car,
        UI.toggle('toggle-pass-dip', d.puoRichiederePass, { dipendenteId: d.id }),
        statoBadge(d),
        d.statoAccount === 'invito_da_inviare'
          ? UI.btn('📧 Invia invito', { azione: 'invita-dip', params: { dipendenteId: d.id } })
          : d.statoAccount === 'invito_inviato'
            ? UI.btn('▶ Simula attivazione', { azione: 'simula-attivazione-dip', params: { dipendenteId: d.id }, variante: 'btn-cyan' })
            : d.stato === 'bloccato'
              ? UI.btn('Sblocca', { azione: 'apri-sblocco', params: { dipendenteId: d.id } })
              : '<span class="muted">›</span>'
      ], { azione: 'apri-dip', params: { dipendenteId: d.id }, classe: d.stato === 'bloccato' ? 'row-dim' : '' });
    });

    return kpi + banner + UI.card({
      titolo: 'Registro Dipendenti',
      sub: q ? `${tutti.length} risultat${tutti.length === 1 ? 'o' : 'i'} per "${UI.esc(q)}"`
             : `${tutti.length} autorizzati`,
      azioni: [
        ricerca,
        q ? UI.btn('✕', { azione: 'azzera-cerca-dip', titolo: 'Azzera ricerca' }) : '',
        UI.btn('⤓', { azione: 'apri-modale', params: { modale: 'export' }, titolo: 'Esporta' }),
        UI.btn('⤓ Importa Dipendenti', { azione: 'apri-modale', params: { modale: 'import-dipendenti' } }),
        UI.btn('+ Aggiungi Dipendente', { azione: 'apri-modale', params: { modale: 'add-user' }, variante: 'btn-primary' })
      ],
      body: UI.tabella({
        head: ['Nome', 'Dip.', 'Stallo', 'Accesso', 'Caratt.', 'Pass vis.', 'Stato', ''],
        rows,
        vuoto: `Nessun dipendente trovato per "${UI.esc(q)}".`
      }) + UI.paginazione(pag, 'pagina-dip', 'Dipendenti')
    });
  }
};

/* ---- handler ---------------------------------------------------------- */
UI.onInput('cerca-dip', (d, ev) => A.setFiltroDipendenti({ q: ev.target.value }));
UI.on('azzera-cerca-dip', () => A.resetFiltri('dipendenti'));
UI.on('pagina-dip', d => A.setPaginaDipendenti(parseInt(d.pagina, 10)));

UI.on('apri-dip', d => { A.seleziona('dipendenteId', d.dipendenteId); Modals.open('dip-det', { dipendenteId: d.dipendenteId }); });
UI.on('apri-dip-pass', d => Modals.open('dip-pass', { dipendenteId: d.dipendenteId }));

/* onChange e non on(): il data-act sta sulla <label>, quindi il click non ha
   handler registrato e non ferma la propagazione — se lo intercettassimo su
   'click' partirebbe anche l'apertura del modale della riga. */
UI.onChange('toggle-pass-dip', d => {
  const dip = A.togglePuoRichiederePass(d.dipendenteId);
  if (Modals.corrente) Modals.refresh();
  UI.toast(dip.puoRichiederePass
    ? `✓ ${dip.nomeCompleto} può richiedere pass visitatore`
    : `– ${dip.nomeCompleto} non può più richiedere pass visitatore`);
});

UI.on('salva-dip', d => {
  Modals._collect();
  const dip = A.aggiornaDipendente(d.dipendenteId, {
    caratteristica: Modals.form.caratteristica
  });
  Modals.close();
  UI.toast(`✓ Profilo di ${dip.nomeCompleto} aggiornato`);
});

UI.on('sospendi-dip', d => {
  const r = A.sospendiDipendente(d.dipendenteId, 'Sospensione manuale del Facility Manager');
  Modals.close();
  UI.toast(`🚫 Accesso sospeso per ${r.dipendente.nomeCompleto} · `
    + (r.annullate
        ? `${r.annullate} prenotazion${r.annullate === 1 ? 'e' : 'i'} futur${r.annullate === 1 ? 'a' : 'e'} annullat${r.annullate === 1 ? 'a' : 'e'}`
        : 'nessuna prenotazione futura'));
});

UI.on('crea-dip', () => {
  Modals._collect();
  const fm = Modals.form;
  if (!fm.nome || !fm.cognome) { UI.toast('Nome e cognome sono obbligatori'); return; }
  const d = A.aggiungiDipendente({
    nome: fm.nome.trim(), cognome: fm.cognome.trim(), email: (fm.email || '').trim(),
    dipartimento: fm.dipartimento, stalloId: fm.stallo || null, caratteristica: fm.caratteristica
  });
  A.vaiA('dipendenti');
  A.setFiltroDipendenti({ q: d.cognome });
  Modals.open('dip-creato', { dipendenteId: d.id });
  UI.toast(`✓ ${d.nomeCompleto} aggiunto · invito inviato a ${d.email}`);
});

/* ---- import massivo ---- */
UI.on('scegli-file', () => {
  Modals._collect();
  Modals.form.file = 'dipendenti_sede_demo.csv';
  Modals._render();
  UI.toast('File selezionato · 3 righe rilevate');
});
UI.on('scarica-template', () => UI.toast('⤓ Template CSV scaricato'));
UI.on('conferma-import', () => {
  Modals._collect();
  if (!Modals.form.file) { UI.toast('Seleziona prima un file da importare'); return; }
  const creati = A.importaDipendenti();
  Modals.close();
  A.vaiA('dipendenti');
  A.setFiltroDipendenti({ q: '' });
  UI.toast(`✓ ${creati.length} dipendenti importati con successo`);
});

/* ---- attivazione account dipendente (invite-only simulato) ---- */
UI.on('simula-attivazione-dip', d => {
  Modals.close();
  A.avviaAttivazione(d.dipendenteId, 'dipendente');
});
UI.on('invita-dip', d => {
  const dip = A.reinviaInvito(d.dipendenteId);
  UI.toast(`📧 Invito inviato a ${dip.email}`);
});

UI.on('invia-dip-pass', d => {
  Modals._collect();
  const codice = Modals.form.codice;          // va letto PRIMA della close(), che azzera il form
  const dip = S.dipendente(d.dipendenteId);
  Modals.close();
  UI.toast(`🔑 Codice accesso ${codice} inviato a ${dip.nomeCompleto}`);
});

})(window);
