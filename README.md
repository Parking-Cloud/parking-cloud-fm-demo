# Parking Cloud — Demo SaaS

Riscrittura multi-file della demo `parking_cloud_v4A_con_log_accessi.html`, con
correzione delle incoerenze documentate in `parking_cloud_asis_v4A.docx`.

## Avvio

Doppio click su **`avvia-demo.cmd`** (avvia un server locale e apre il browser).
Chiudi la finestra nera per spegnere il server.

In alternativa, da terminale:

```bash
python -m http.server 8777 --directory src
```

poi apri `http://localhost:8777/index.html`.

## Ruoli e accesso

Tre ruoli, **un solo prodotto**: Admin e Facility Manager usano la stessa
interfaccia, cambia solo ciò che i permessi abilitano. Nessuna console separata.

| Email                             | Ruolo             | Vista                          |
|-----------------------------------|-------------------|--------------------------------|
| `admin@parkingcloud.eu`           | Admin             | Console FM + ⚙ Amministrazione |
| `manager@demo.parkingcloud.eu`    | Facility Manager  | Console FM                     |
| `dipendente@demo.parkingcloud.eu` | Dipendente        | Vista Dipendente               |

Il login chiede solo email e password: **il ruolo si deduce dall'account**, non
si sceglie. Password libera (non validata nella demo).

L'accesso è **invite-only**: non esiste registrazione pubblica. Ogni nuovo
utente riceve un invito e attiva l'account da `view-activate`, raggiungibile
nella demo dai pulsanti "Simula attivazione".

La matrice dei permessi vive in `state.js` (`PERMISSIONS`) ed è l'unica fonte
che decide cosa compare in sidebar, nelle tab e nelle sezioni. È consultabile
a runtime in Config → Utenti & Accessi.

## Design system

Palette da Brand Guideline ufficiale, definita in `styles.css` come CSS custom
properties: Palatinate Blue `#1546D4` (primario) · Snow `#FCF8F9` (sfondo) ·
Night `#0F0F0F` (testo, sidebar) · Timberwolf `#D6D6D6` (bordi) ·
Deep Sky `#30C5FF` (accento). Tipografia Futura con fallback web **Nunito**;
`DM Mono` per codici, ID e orari.

Verde / rosso / ambra sono usati solo per gli stati semantici (online, anomalia,
warning), sempre su superficie chiara.

I componenti leggono esclusivamente i token: per ricolorare la demo basta
cambiare il blocco `:root`.

## Struttura

```
src/
  index.html        shell, routing, layout
  state.js          AppState — unica fonte di verità + Selectors + Actions + Store
  ui.js             componenti riutilizzabili + event delegation
  modals.js         registro dei modali (contenuto sempre dinamico)
  styles.css        design system Parking Cloud (dark gold)
  fm/               dashboard · mappa · accessi · prenotazioni · segnalazioni
                    dipendenti · visitatori · hardware · config
  employee/index.js Vista Dipendente
```

## Come funziona

**Lo stato di uno stallo non è memorizzato: è derivato.** Sullo stallo si
salvano solo gli attributi (tipo, disponibilità, titolare, durata max, note);
se sia libero, occupato o prenotato lo calcola `Selectors.statoStallo()`
leggendo prenotazioni, accessi e visitatori.

È questo che rende automatica la coerenza fra sezioni: quando il dipendente
dichiara Smart Working, la prenotazione sparisce e la mappa FM ricalcola da sé.
Non esiste codice di sincronizzazione da tenere allineato.

Il flusso è sempre lo stesso:

```
click → data-act → Actions.*  →  Store.emit()  →  render() della vista attiva
```

Le `Actions` sono le uniche funzioni che scrivono, e mantengono gli invarianti
(mettere uno stallo in manutenzione riassegna le prenotazioni future;
annullare una prenotazione di oggi chiude anche il record di accesso).

## Dati demo

Generati a ogni avvio da un PRNG con seed fisso: **i numeri non cambiano a ogni
reload**. 156 stalli · 312 dipendenti · ~800 prenotazioni settimanali ·
143 accessi giornalieri · 14 pass visitatore · 22 segnalazioni.

Nessun riferimento a clienti specifici: sede `Sede Demo — Centro Direzionale A`,
FM `Alex Martini`, dominio `@aziendademo.it`.
