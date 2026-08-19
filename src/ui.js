/* ============================================================================
   PARKING CLOUD · ui.js
   ----------------------------------------------------------------------------
   Componenti riutilizzabili + event delegation.

   PERCHÉ LA DELEGATION
   Le sezioni si ridisegnano ad ogni mutazione dello stato. Con gli onclick
   inline gli handler andrebbero riagganciati ogni volta e i parametri
   dinamici (quale stallo? quale riga?) finirebbero concatenati nell'HTML.
   Qui invece ogni elemento cliccabile dichiara `data-act` + i suoi parametri
   in `data-*`, e un unico listener sul document instrada l'azione.
   È così che i modali sanno SEMPRE su cosa hai cliccato.
============================================================================ */
(function (global) {
'use strict';

const PC = global.PC;

/* ==========================================================================
   ESCAPING
========================================================================== */
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** attributi data-* da un oggetto: {stalloId:'A-07'} → data-stallo-id="A-07" */
function dataAttrs(o) {
  if (!o) return '';
  return Object.keys(o).filter(k => o[k] !== null && o[k] !== undefined)
    .map(k => ' data-' + k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()) + '="' + esc(o[k]) + '"').join('');
}
/** shorthand: attributo azione + parametri */
function act(name, params) { return ' data-act="' + esc(name) + '"' + dataAttrs(params); }

/* ==========================================================================
   EVENT DELEGATION
========================================================================== */
const handlers = { click: {}, change: {}, input: {}, submit: {} };

const UI = {
  esc, act, dataAttrs,

  /** UI.on('apri-stallo', (d, ev, el) => {...})  — d = dataset dell'elemento */
  on(nome, fn, tipo)      { handlers[tipo || 'click'][nome] = fn; },
  onChange(nome, fn)      { handlers.change[nome] = fn; },
  onInput(nome, fn)       { handlers.input[nome] = fn; },

  /** scrive HTML in un contenitore preservando il focus dei campi di input */
  mount(target, html) {
    const node = typeof target === 'string' ? document.querySelector(target) : target;
    if (!node) return;
    const memo = UI._memoFocus();
    node.innerHTML = html;
    UI._restoreFocus(memo);
  },

  _memoFocus() {
    const a = document.activeElement;
    if (!a || !a.dataset || !a.dataset.focusKey) return null;
    return { key: a.dataset.focusKey, start: a.selectionStart, end: a.selectionEnd };
  },
  _restoreFocus(memo) {
    if (!memo) return;
    const el = document.querySelector('[data-focus-key="' + memo.key + '"]');
    if (!el) return;
    el.focus();
    if (memo.start !== null && memo.start !== undefined && el.setSelectionRange) {
      try { el.setSelectionRange(memo.start, memo.end); } catch (e) { /* input type non selezionabile */ }
    }
  },

  /** Scarica un file generato in memoria. Nessuna libreria: Blob + <a download>.
      L'URL oggetto va revocato, altrimenti resta allocato per tutta la sessione. */
  scarica(nomeFile, contenuto, mime) {
    const blob = new Blob([contenuto], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeFile;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { nomeFile, byte: blob.size };
  },

  /** Scrive un .xlsx vero con SheetJS. `fogli` = [{ nome, righe[] }] dove
      righe e' un array di oggetti: la prima riga del foglio sono le chiavi.
      Ritorna null se la libreria non e' disponibile (offline): il chiamante
      deve dirlo all'utente invece di fallire in silenzio. */
  toXLSX(nomeFile, fogli) {
    if (typeof XLSX === 'undefined') return null;
    const wb = XLSX.utils.book_new();
    fogli.forEach(f => {
      const righe = f.righe || [];
      const cols = righe.length ? Object.keys(righe[0]) : ['(nessun dato)'];
      const aoa = [cols].concat(righe.map(r => cols.map(c => r[c])));
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      /* larghezze indicative: senza, ogni colonna esce a 8 caratteri */
      ws['!cols'] = cols.map(c => ({ wch: Math.min(34, Math.max(10, String(c).length + 4)) }));
      XLSX.utils.book_append_sheet(wb, ws, f.nome.slice(0, 31));
    });
    XLSX.writeFile(wb, nomeFile);
    return { nomeFile, fogli: fogli.length };
  },

  /** Barra di paginazione condivisa da Prenotazioni, Dipendenti e Accessi.
      `pag` e' l'oggetto di Selectors.paginaDi(); `azione` il data-act che
      riceve { pagina }. Max 7 numeri con ellissi: su 16 pagine una riga di
      pulsanti sarebbe illeggibile. */
  paginazione(pag, azione, etichetta) {
    const lbl = etichetta || 'Righe';
    const info = `<span class="pg-info">${lbl} ${pag.da}–${pag.a} di ${pag.totale}</span>`;
    if (pag.pagine <= 1) return `<div class="pg-bar">${info}</div>`;
    const out = [];
    const push = (i) => out.push(`<span class="pg-num${i === pag.pagina ? ' active' : ''}"${act(azione, { pagina: i })}>${i + 1}</span>`);
    const n = pag.pagine, c = pag.pagina;
    if (n <= 7) { for (let i = 0; i < n; i++) push(i); }
    else {
      push(0);
      if (c > 3) out.push('<span class="pg-gap">…</span>');
      for (let i = Math.max(1, c - 1); i <= Math.min(n - 2, c + 1); i++) push(i);
      if (c < n - 4) out.push('<span class="pg-gap">…</span>');
      push(n - 1);
    }
    return `<div class="pg-bar">${info}
      <div class="pg-nums">
        ${UI.btn('‹', { azione, params: { pagina: c - 1 }, disabled: c === 0 })}
        ${out.join('')}
        ${UI.btn('›', { azione, params: { pagina: c + 1 }, disabled: c >= n - 1 })}
      </div>
    </div>`;
  },

  /* ---- TOAST ---- */
  toast(msg) {
    const t = document.getElementById('toast-el');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 3400);
  },

  /* ========================================================================
     COMPONENTI
  ======================================================================== */

  /** KPI card cliccabile.  {label, val, sub, colore, azione, params} */
  kpi(o) {
    return `<div class="kpi c-${o.colore || 'blue'}"${o.azione ? act(o.azione, o.params) : ''}${o.titolo ? ` title="${esc(o.titolo)}"` : ''}>
      <div class="kpi-label">${esc(o.label)}</div>
      <div class="kpi-val">${esc(o.val)}</div>
      ${o.sub ? `<div class="kpi-sub">${o.sub}</div>` : ''}
    </div>`;
  },

  /** KPI sensibile al periodo.
      Numero grande = media giornaliera (comparabile fra periodi),
      sottotitolo = totale del periodo. Con `primario:'totale'` si inverte:
      serve per i contatori a basso volume (segnalazioni, anomalie), dove
      "22 nel mese" dice più di "media 2 al giorno". */
  kpiPeriodo(o) {
    if (!o.multi) return UI.kpi({ label: o.label, val: o.tot, sub: o.sub, colore: o.colore, azione: o.azione, params: o.params });
    if (o.primario === 'totale') {
      /* una media che arrotonda a zero non informa: si tiene il sottotitolo originale */
      const sub = o.media >= 1 ? '<span class="kpi-periodo">media ' + o.media + '/giorno</span>' : o.sub;
      return UI.kpi({ label: o.label, val: o.tot, sub, colore: o.colore, azione: o.azione, params: o.params });
    }
    return UI.kpi({
      label: o.label, val: o.media,
      sub: '<span class="kpi-periodo">' + o.tot + ' nel periodo</span>',
      colore: o.colore, azione: o.azione, params: o.params
    });
  },

  kpiGrid(cards, cols) { return `<div class="kpi-grid g${cols || cards.length}">${cards.join('')}</div>`; },

  /** Card con header e azioni.  {titolo, sub, azioni:[html], body, stile} */
  card(o) {
    return `<div class="card"${o.stile ? ` style="${o.stile}"` : ''}>
      ${o.titolo || o.azioni ? `<div class="card-hd">
        <div><div class="card-title">${o.titolo || ''}</div>${o.sub ? `<div class="card-sub">${o.sub}</div>` : ''}</div>
        ${o.azioni ? `<div class="card-actions">${o.azioni.join('')}</div>` : ''}
      </div>` : ''}
      ${o.body}
    </div>`;
  },

  btn(label, o) {
    o = o || {};
    return `<button class="btn ${o.variante || 'btn-ghost'}${o.sm === false ? '' : ' btn-sm'}${o.full ? ' btn-full' : ''}"${o.azione ? act(o.azione, o.params) : ''}${o.disabled ? ' disabled' : ''}${o.stile ? ` style="${o.stile}"` : ''}${o.titolo ? ` title="${esc(o.titolo)}"` : ''}>${label}</button>`;
  },

  badge(testo, colore, conDot) { return `<span class="b b-${colore || 'gray'}">${conDot ? '<span class="dot"></span>' : ''}${esc(testo)}</span>`; },
  tag(testo, colore)           { return `<span class="tag tag-${colore || 'gray'}">${esc(testo)}</span>`; },
  alert(html, variante)        { return `<div class="alert alert-${variante || 'info'}">${html}</div>`; },
  avatar(iniziali, stile)      { return `<div class="sb-av"${stile ? ` style="${stile}"` : ''}>${esc(iniziali)}</div>`; },

  /** Tabella.  {head:[...], rows:[html], vuoto:'testo', scroll:true} */
  tabella(o) {
    if (!o.rows.length) return `<div class="tbl-empty">${esc(o.vuoto || 'Nessun risultato')}</div>`;
    const t = `<table class="tbl">
      <thead><tr>${o.head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${o.rows.join('')}</tbody></table>`;
    return o.scroll === false ? t : `<div class="tbl-scroll">${t}</div>`;
  },

  /** Riga cliccabile di tabella */
  riga(celle, o) {
    o = o || {};
    return `<tr class="row-click${o.classe ? ' ' + o.classe : ''}"${o.azione ? act(o.azione, o.params) : ''}>${celle.map(c => `<td>${c}</td>`).join('')}</tr>`;
  },

  /** Riga impostazione con controllo a destra */
  setting(nome, desc, controllo) {
    return `<div class="setting-row">
      <div><div class="setting-name">${nome}</div>${desc ? `<div class="setting-desc">${desc}</div>` : ''}</div>
      ${controllo || ''}
    </div>`;
  },

  /* data-act sta sulla LABEL, non sull'input: il click sullo slider colpisce
     lo <span>, e da lì closest() deve trovare comunque il gestore. */
  toggle(azione, attivo, params) {
    return `<label class="toggle"${act(azione, params)}><input type="checkbox"${attivo ? ' checked' : ''}><span class="tsl"></span></label>`;
  },

  select(opzioni, valore, o) {
    o = o || {};
    return `<select class="form-select"${o.azione ? act(o.azione, o.params) : ''}${o.id ? ` id="${o.id}"` : ''}${o.stile ? ` style="${o.stile}"` : ''}>
      ${opzioni.map(op => {
        const v = typeof op === 'string' ? op : op.v;
        const l = typeof op === 'string' ? op : op.l;
        return `<option value="${esc(v)}"${String(v) === String(valore) ? ' selected' : ''}>${esc(l)}</option>`;
      }).join('')}
    </select>`;
  },

  input(o) {
    o = o || {};
    return `<input class="form-input" type="${o.tipo || 'text'}"${o.id ? ` id="${o.id}"` : ''}${o.valore !== undefined ? ` value="${esc(o.valore)}"` : ''}${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}${o.azione ? act(o.azione, o.params) : ''}${o.focusKey ? ` data-focus-key="${esc(o.focusKey)}"` : ''}${o.min !== undefined ? ` min="${o.min}"` : ''}${o.max !== undefined ? ` max="${o.max}"` : ''}${o.stile ? ` style="${o.stile}"` : ''}>`;
  },

  campo(label, controllo, stile) {
    return `<div class="form-group"${stile ? ` style="${stile}"` : ''}><div class="form-label">${label}</div>${controllo}</div>`;
  },

  infoBox(label, valore, mono) {
    return `<div class="info-box"><div class="form-label">${esc(label)}</div><div class="info-val${mono ? ' mono' : ''}">${valore}</div></div>`;
  },
  infoGrid(boxes) { return `<div class="info-grid">${boxes.join('')}</div>`; },

  /** Card segnalazione */
  segCard(o) {
    const c = o.coloreIco || 'amber';
    return `<div class="seg-card seg-${o.variante || 'warn'}"${act(o.azione, o.params)}>
      <div class="seg-ico seg-ico-${c}">${o.icona}</div>
      <div class="seg-info-wrap">
        <div class="seg-title seg-title-${c}">${o.titolo}</div>
        <div class="seg-detail">${o.dettaglio}</div>
        <div class="seg-meta">${o.meta.join('')}</div>
      </div>
    </div>`;
  },

  vuoto(testo) { return `<div class="empty-box">${esc(testo)}</div>`; },

  /** opzione selezionabile stile radio (export, azioni segnalazione) */
  opt(o) {
    return `<div class="export-opt${o.sel ? ' sel' : ''}"${act(o.azione, o.params)}>
      <div class="export-ico">${o.icona}</div>
      <div><div style="font-weight:700${o.coloreTitolo ? ';color:var(--' + o.coloreTitolo + ')' : ''}">${o.titolo}</div>
      ${o.sub ? `<div style="font-size:11px;color:var(--text-muted)">${o.sub}</div>` : ''}</div>
    </div>`;
  }
};

/* ==========================================================================
   LISTENER GLOBALI
========================================================================== */
function dispatch(tipo, ev) {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const nome = el.dataset.act;
  const fn = handlers[tipo][nome];
  if (!fn) return;
  if (tipo === 'click') ev.preventDefault();
  ev.stopPropagation();
  fn(el.dataset, ev, el);
}

document.addEventListener('click',  e => dispatch('click', e));
document.addEventListener('change', e => dispatch('change', e));
document.addEventListener('input',  e => {
  /* l'input a ogni tasto serve solo dove è dichiarato esplicitamente */
  const el = e.target.closest('[data-act]');
  if (el && handlers.input[el.dataset.act]) dispatch('input', e);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && PC.Modals) PC.Modals.close(); });

global.PC.UI = UI;
/** registro delle sezioni: ogni file fm/*.js si registra qui */
global.PC.Sezioni = global.PC.Sezioni || {};

})(window);
