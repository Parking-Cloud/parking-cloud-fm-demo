/* ============================================================================
   FM · Analytics
   ----------------------------------------------------------------------------
   Zero fetch: ogni numero è calcolato da AppState.
   Il seed copre il mese corrente (settimane passate come prenotazioni chiuse),
   quindi Settimana e Mese leggono dati diversi e reali.
   Il periodo PRECEDENTE invece non esiste nei dati: è derivato con un PRNG a
   seed fisso — plausibile e, cosa che conta in una demo, identico ad ogni reload.
============================================================================ */
(function (global) {
'use strict';
const { UI, Selectors: S, Actions: A, State, Utils: U } = global.PC;

/* PRNG separato da quello del seed, così i confronti non si spostano
   quando cambiano i dati generati altrove. */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** fattore stabile fra 0.82 e 1.18 per la metrica i-esima */
function fattore(i) { return 0.82 + mulberry32(20260818 + i * 97)() * 0.36; }

/* ---- finestre temporali ------------------------------------------------ */
function giorniPeriodo(periodo, indietro) {
  const off = indietro ? -1 : 0;
  if (periodo === 'mese') {
    const base = new Date(U.OGGI.getFullYear(), U.OGGI.getMonth() + off, 1);
    const fine = new Date(U.OGGI.getFullYear(), U.OGGI.getMonth() + off + 1, 0);
    const out = [];
    for (let d = new Date(base); d <= fine; d = U.addDays(d, 1)) out.push(new Date(d));
    return out;
  }
  const lun = U.getMonday(U.addDays(U.OGGI, off * 7));
  return [0, 1, 2, 3, 4].map(i => U.addDays(lun, i));
}

/* ---- metriche del periodo corrente ------------------------------------- */
function metriche(periodo) {
  const giorni = giorniPeriodo(periodo, false).map(U.toISO);
  const inPeriodo = (iso) => giorni.includes(iso);
  const totStalli = State.stalli.length || 1;

  const ufficio = State.prenotazioni.filter(p => p.tipo === 'ufficio' && p.stato !== 'annullata' && inPeriodo(p.data));
  const sw      = State.prenotazioni.filter(p => p.tipo === 'sw' && p.stato !== 'annullata' && inPeriodo(p.data));

  /* occupazione media giornaliera sui giorni che hanno almeno una prenotazione */
  const perGiorno = giorni.map(iso =>
    State.prenotazioni.filter(p => p.data === iso && p.tipo === 'ufficio' && p.stato !== 'annullata').length / totStalli * 100);
  const attivi = perGiorno.filter(v => v > 0);
  const occupazione = attivi.length ? attivi.reduce((a, b) => a + b, 0) / attivi.length : 0;

  const inizio = giorni[0], fine = giorni[giorni.length - 1];
  const segnalazioni = State.segnalazioni.filter(s => {
    const iso = U.toISO(new Date(s.apertaIlTs));
    return iso >= inizio && iso <= fine && s.stato !== 'risolta';
  });
  const visitatori = State.visitatori.filter(v => v.data >= inizio && v.data <= fine);

  return {
    giorni,
    occupazione: +occupazione.toFixed(1),
    prenotazioni: ufficio.length,
    smartWorking: sw.length,
    segnalazioni: segnalazioni.length,
    visitatori: visitatori.length,
    perGiorno
  };
}

/** stesso set di metriche per il periodo precedente (derivato, deterministico) */
function metrichePrecedenti(m) {
  return {
    occupazione:  +(m.occupazione  * fattore(1)).toFixed(1),
    prenotazioni: Math.round(m.prenotazioni * fattore(2)),
    smartWorking: Math.round(m.smartWorking * fattore(3)),
    segnalazioni: Math.round(m.segnalazioni * fattore(4)),
    visitatori:   Math.round(m.visitatori   * fattore(5))
  };
}

/* ---- componenti -------------------------------------------------------- */
function delta(corrente, precedente, buonoSeSale) {
  if (!precedente) return { txt: '—', cls: '' };
  const d = (corrente - precedente) / precedente * 100;
  const su = d >= 0;
  const positivo = buonoSeSale ? su : !su;
  return {
    txt: (su ? '▲ ' : '▼ ') + Math.abs(d).toFixed(1) + '%',
    cls: Math.abs(d) < 0.05 ? '' : (positivo ? 'up' : 'down')
  };
}

function kpiDelta(label, val, prec, suffisso, buonoSeSale, colore) {
  const d = delta(parseFloat(val), parseFloat(prec), buonoSeSale);
  return UI.kpi({
    label, val: val + (suffisso || ''), colore,
    sub: `<span class="kpi-delta ${d.cls}">${d.txt}</span><span class="kpi-prec">vs ${prec}${suffisso || ''} periodo prec.</span>`
  });
}

const COLORE_ZONA_CSS = { gold: 'var(--blue)', blue: 'var(--blue)', sky: 'var(--cyan)', purple: 'var(--purple)' };

global.PC.Sezioni.analytics = {
  render() {
    const periodo = State.ui.analyticsPeriodo;
    const m = metriche(periodo);
    const prec = metrichePrecedenti(m);
    const etichetta = periodo === 'mese' ? 'mese' : 'settimana';

    /* ---- selettore periodo ---- */
    const toggle = `<div class="analytics-toggle">
      ${[['settimana', 'Settimana'], ['mese', 'Mese']].map(([v, l]) =>
        `<div class="tab-btn${periodo === v ? ' active' : ''}"${UI.act('analytics-periodo', { periodo: v })}>${l}</div>`).join('')}
    </div>`;

    /* ---- KPI con delta ---- */
    const kpi = UI.kpiGrid([
      kpiDelta('Occupazione media', m.occupazione, prec.occupazione, '%', true, 'blue'),
      kpiDelta('Prenotazioni', m.prenotazioni, prec.prenotazioni, '', true, 'green'),
      kpiDelta('Smart Working', m.smartWorking, prec.smartWorking, '', true, 'amber'),
      kpiDelta('Segnalazioni', m.segnalazioni, prec.segnalazioni, '', false, 'red'),
      kpiDelta('Visitatori', m.visitatori, prec.visitatori, '', true, 'cyan')
    ], 5);

    /* ---- grafico occupazione ---- */
    const maxBar = Math.max(...m.perGiorno, 1);
    const barre = periodo === 'mese' ? aggregaSettimane(m) : m.perGiorno.map((v, i) => ({
      label: U.DAYS_IT[U.fromISO(m.giorni[i]).getDay()], valore: v
    }));
    const maxAgg = Math.max(...barre.map(b => b.valore), 1);
    const grafico = UI.card({
      titolo: `📊 Occupazione per ${periodo === 'mese' ? 'settimana' : 'giorno'}`,
      sub: `Percentuale di stalli prenotati · ${etichetta} corrente`,
      stile: 'margin-bottom:14px',
      body: `<div class="chart-row">
        ${barre.map(b => `
          <div class="chart-bar-wrap">
            <div class="chart-val">${b.valore.toFixed(0)}%</div>
            <div class="chart-bar" style="height:${Math.max(4, b.valore / maxAgg * 100)}%" title="${b.label}: ${b.valore.toFixed(1)}%"></div>
          </div>`).join('')}
      </div>
      <div class="chart-labels">${barre.map(b => `<div class="chart-label">${UI.esc(b.label)}</div>`).join('')}</div>`
    });

    /* ---- distribuzione per zona ---- */
    const zone = S.occupazionePerZona();
    const cardZone = UI.card({
      titolo: '🗺 Distribuzione per zona',
      sub: 'Occupazione attuale',
      stile: 'margin-bottom:14px',
      body: zone.map(z => `
        <div class="hbar-row">
          <div class="hbar-lbl">${UI.esc(z.id === 'EV' ? 'EV ⚡' : z.id === 'H' ? '♿ H' : 'Zona ' + z.id)}</div>
          <div class="hbar-track"><div class="hbar-fill" style="width:${z.perc}%;background:${COLORE_ZONA_CSS[z.colore] || 'var(--blue)'}"></div></div>
          <div class="hbar-val">${z.occupati}/${z.totale}</div>
        </div>`).join('')
    });

    /* ---- top 5 stalli ---- */
    const conteggi = {};
    State.prenotazioni
      .filter(p => p.stalloId && p.stato !== 'annullata' && m.giorni.includes(p.data))
      .forEach(p => { conteggi[p.stalloId] = (conteggi[p.stalloId] || 0) + 1; });
    const top = Object.entries(conteggi).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxTop = top.length ? top[0][1] : 1;
    const cardTop = UI.card({
      titolo: '🏆 Top 5 stalli per utilizzo',
      sub: `Prenotazioni ${etichetta} corrente`,
      body: top.length ? top.map(([codice, n]) => {
        const st = S.stallo(codice);
        return `<div class="hbar-row">
          <div class="hbar-lbl mono">${UI.esc(codice)}</div>
          <div class="hbar-track"><div class="hbar-fill" style="width:${n / maxTop * 100}%"></div></div>
          <div class="hbar-val">${n}×</div>
          <div class="muted" style="font-size:11px;width:80px">${UI.esc(st ? st.piano : '')}</div>
        </div>`;
      }).join('') : UI.vuoto('Nessuna prenotazione nel periodo.')
    });

    /* ---- tabella confronto ---- */
    const righe = [
      ['Occupazione media', m.occupazione + '%', prec.occupazione + '%', delta(m.occupazione, prec.occupazione, true)],
      ['Prenotazioni', m.prenotazioni, prec.prenotazioni, delta(m.prenotazioni, prec.prenotazioni, true)],
      ['Smart Working', m.smartWorking, prec.smartWorking, delta(m.smartWorking, prec.smartWorking, true)],
      ['Segnalazioni', m.segnalazioni, prec.segnalazioni, delta(m.segnalazioni, prec.segnalazioni, false)],
      ['Visitatori', m.visitatori, prec.visitatori, delta(m.visitatori, prec.visitatori, true)]
    ];
    const cardConfronto = UI.card({
      titolo: '📈 Confronto con il periodo precedente',
      sub: periodo === 'mese' ? 'Mese corrente vs mese precedente' : 'Settimana corrente vs settimana precedente',
      stile: 'margin-top:14px',
      body: UI.tabella({
        head: ['Metrica', periodo === 'mese' ? 'Mese corrente' : 'Settimana corrente', 'Periodo precedente', 'Δ'],
        scroll: false,
        rows: righe.map(([nome, cur, pre, d]) =>
          `<tr><td><b>${nome}</b></td><td class="mono">${cur}</td><td class="mono muted">${pre}</td>
           <td><span class="kpi-delta ${d.cls}">${d.txt}</span></td></tr>`)
      })
    });

    return '<div class="sec-title">Analytics</div>' + toggle + kpi + grafico
      + `<div class="g2"><div>${cardZone}</div><div>${cardTop}</div></div>`
      + cardConfronto;
  }
};

/** in vista mese le barre diventano una per settimana */
function aggregaSettimane(m) {
  const perSett = {};
  m.giorni.forEach((iso) => {
    const d = U.fromISO(iso);
    const lun = U.toISO(U.getMonday(d));
    const n = State.prenotazioni.filter(p => p.data === iso && p.tipo === 'ufficio' && p.stato !== 'annullata').length;
    if (!perSett[lun]) perSett[lun] = { somma: 0, giorni: 0 };
    if (n > 0) { perSett[lun].somma += n / (State.stalli.length || 1) * 100; perSett[lun].giorni++; }
  });
  /* le settimane ancora senza prenotazioni non diventano barre vuote */
  return Object.keys(perSett).sort()
    .filter(lun => perSett[lun].giorni > 0)
    .map((lun, i) => ({
      label: 'Sett. ' + (i + 1),
      valore: perSett[lun].somma / perSett[lun].giorni
    }));
}

/* ---- handler ---------------------------------------------------------- */
UI.on('analytics-periodo', d => A.setAnalyticsPeriodo(d.periodo));

})(window);
