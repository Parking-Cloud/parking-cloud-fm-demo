# CHANGELOG — Parking Cloud Demo

Stato del progetto al **18/08/2026**.

---

## STATO ATTUALE

### Sezioni FM implementate e funzionanti

| Sezione | File | Stato |
|---------|------|-------|
| Dashboard Live | `fm/dashboard.js` | ✅ mini-mappa per zona, 5 KPI navigabili, segnalazioni aperte |
| Mappa Stalli | `fm/mappa.js` | ✅ 156 stalli derivati, click/Ctrl+Click, bulk edit, aggiunta stallo |
| Accessi | `fm/accessi.js` | ✅ log per periodo, pannello filtri (persona/tipo/stato/stallo/anomalie) |
| Prenotazioni | `fm/prenotazioni.js` | ✅ griglia settimanale, navigazione settimane reale |
| Analytics | `fm/analytics.js` | ✅ KPI con delta, grafici CSS, top-5 stalli, confronto periodi |
| Segnalazioni | `fm/segnalazioni.js` | ✅ attive/risolte, utenti bloccati, sblocco |
| Dipendenti | `fm/dipendenti.js` | ✅ 312 anagrafiche, ricerca reale, import CSV simulato |
| Visitatori | `fm/visitatori.js` | ✅ pass My2N, revoca, estensione, zona errata |
| Hardware | `fm/hardware.js` | ✅ 6 dispositivi, 6 tipi, metodi accesso derivati |
| Policy & Config | `fm/config.js` | ✅ 4 tab interne |
| Amministrazione | `fm/amministrazione.js` | ✅ solo Admin — utenti piattaforma + parcheggi |
| Vista Dipendente | `employee/index.js` | ✅ calendario, mappa read-only, prenotazioni |

### Modali registrati — 25 su 25

`stallo-det` · `acc-det` · `dip-det` · `add-user` · `sblocco` · `dip-pass` ·
`req-pass` · `add-vis` · `vis-det` · `seg` · `hw` · `add-stallo` · `add-bk` ·
`policy` · `export` · `daterange` · `emp-book` · `emp-cancel` · `emp-segnala` ·
`emp-profile` · `emp-history` · `add-platform-user` · `platform-user-det` ·
`import-dipendenti` · `dip-creato`

Tutti ricevono il contesto dall'elemento cliccato e leggono da `AppState`
all'apertura: nessun contenuto statico.

### Ruoli e permessi

Tre ruoli in un solo prodotto: Admin > Facility Manager > Dipendente.
Matrice in `state.js → PERMISSIONS`, consultabile a runtime in
Config → Utenti & Accessi.

| Email | Ruolo | Vista |
|-------|-------|-------|
| `admin@parkingcloud.eu` | Admin | Console FM + ⚙ Amministrazione |
| `manager@demo.parkingcloud.eu` | Facility Manager | Console FM |
| `dipendente@demo.parkingcloud.eu` | Dipendente | Vista Dipendente |

Il ruolo si deduce dall'account: nessuna selezione al login.
Accesso **invite-only**, nessuna registrazione pubblica; l'attivazione avviene
da `view-activate` (simulata dai pulsanti "Simula attivazione").

L'unica differenza visibile fra Admin e FM è il badge nel footer sidebar e la
voce "Amministrazione" (10 voci sidebar vs 9).

### Dati demo

Generati da PRNG con seed fisso `20260817`: **stabili a ogni reload**.

- 156 stalli su 6 zone (A 42 · B 48 · C 36 · V 16 · EV 6 · H 8)
- 312 dipendenti · 2 bloccati · 287 con app attiva
- 2.071 prenotazioni su 15 giorni (mese corrente, settimane passate chiuse)
- 1.400 accessi su 12 giorni (154 oggi) · 127 pass visitatore · 22 segnalazioni
- 6 dispositivi hardware · 2 utenti di piattaforma

---

## STORICO MODIFICHE

## [18/08/2026] — CODE-13 · Vista Dipendente agganciata all'utente autenticato
### Fix (difetto grave: scrittura dati a nome sbagliato)
- La Vista Dipendente usava `S.utenteDemo()` — il dipendente del **seed** —
  invece dell'utente autenticato. Dopo l'attivazione di un nuovo dipendente:
  hero, avatar, stallo e dipartimento mostravano DIP-0001 Matteo Bruni, e
  soprattutto **prenotazioni e segnalazioni venivano scritte a nome suo**.
- Il difetto sopravviveva alla checklist perche' il login demo
  (`dipendente@demo.parkingcloud.eu`) coincide con l'utente del seed: i due
  selectors restituiscono lo stesso oggetto e ogni test passava.
### Modificato
- `state.js`: nuovo selector `dipendenteCorrente()` — l'utente di sessione se
  e' un dipendente, `null` se e' Admin/FM o non esiste
- `employee/index.js`: 5 call site + guardia `vistaNonDisponibile()`
- `modals.js`: 7 call site (`emp-book` initForm/body/footer, `emp-cancel`,
  `emp-segnala`, `emp-profile`, `emp-history`), ognuna con guardia sul null
### Scope
Il difetto segnalato citava 5 occorrenze in un file; erano **12 su due file**.
Correggendo solo `employee/index.js` l'attribuzione dei dati sarebbe rientrata,
ma i modali avrebbero continuato a mostrare stallo, profilo e storico di Matteo.
### utenteDemo()
Non e' piu' chiamato da nessuna vista. Resta come unico modo per raggiungere il
dipendente del seed (usato dai test); il flag `utenteDemo: true` nel seed
continua a definire quale account risponde a `dipendente@demo.parkingcloud.eu`.
### MODIFICA A — CSV con punto e virgola
- `toCSV()`: delimitatore da `,` a `;`, come si aspetta Excel in locale
  italiano (con la virgola l'intero record finiva in una colonna sola).
  BOM invariato. L'escaping ora quota i campi che contengono `;`.
### Flussi verificati
- **TEST A**: FM crea "Ivan Ferro" → attivazione → hero "Ciao, Ivan", meta
  "pool rotante · Legal", avatar IF; prenotazione A-06 intestata a DIP-0313;
  `segnalanteId = DIP-0313`; modali Profilo e Storico su Ivan; riga di Ivan
  visibile in FM Prenotazioni
- **TEST B**: con FM loggato `dipendenteCorrente()` → `null`; forzando
  `vista='dipendente'` nessuna eccezione, schermata "Vista non disponibile",
  zero `.emp-day` renderizzati, pulsante di uscita presente
- **TEST C**: login demo → tutti i flussi identici (cancella, prenota, SW,
  segnala, profilo, storico) con attribuzione corretta


## [18/08/2026] — CODE-12 · Export reale CSV e JSON
### Aggiunto
- `state.js`: `Utils.toCSV()` (RFC 4180 — virgola, CRLF, quote raddoppiate);
  selectors `esportaAccessi(periodo)` e `esportaDipendenti()`
- `ui.js`: `UI.scarica(nomeFile, contenuto, mime)` — Blob + `<a download>`,
  con `revokeObjectURL()` differito. Nessuna libreria esterna.
- `fm/config.js`: l'handler `genera-export` produce un file vero su due
  combinazioni; tutte le altre restano toast simulato
### Comportamento
| Tipo report | Formato | Esito |
|---|---|---|
| Log Accessi | CSV | `parkingcloud_accessi_AAAA-MM-GG.csv` — dati del periodo selezionato |
| Report Dipendenti | JSON | `parkingcloud_dipendenti_AAAA-MM-GG.json` — 312 record |
| tutte le altre | qualsiasi | toast "in generazione" invariato |
### Scelte
- La costruzione dei dati sta nei **selectors**, non nella UI: il contenuto e'
  cosi' verificabile in Node, senza browser (fatto: 154 record oggi, 1.400 sul
  mese, escaping di virgole e virgolette).
- Il CSV segue il **periodo selezionato in topbar**, non i filtri della sezione
  Accessi: e' l'unica interpretazione che rende l'export prevedibile da un
  modale che il periodo lo mostra gia'.
- BOM `﻿` in testa al CSV: senza, Excel sbaglia gli accenti.
  Separatore virgola (standard). In Excel italiano puo' servire `;` — se serve
  e' un carattere da cambiare in `toCSV()`.
### Flussi verificati
- Download intercettato a runtime: nome file, tipo MIME, dimensione del blob,
  `href` `blob:`, anchor presente nel DOM al click e rimosso subito dopo
- CSV 10.559 byte su "oggi" → 100.712 byte su "questo mese"
- 5 combinazioni di controllo (Completo+PDF, Accessi+PDF, Dipendenti+CSV,
  Segnalazioni+JSON, Accessi+Excel) restano toast: nessun download partito


## [18/08/2026] — CODE-11 · Allineamento CODE-05 e CODE-08 alla specifica
### Fix
- **Il motivo di assegnazione poteva mentire.** In `modals.js → emp-book
  initForm` il motivo era forzato a `'fisso'` per ogni prenotazione esistente,
  senza verificare che lo stallo fosse davvero quello fisso. Con A-07 occupato
  da un collega, Matteo riceveva A-06 e il modale dichiarava comunque
  “il tuo stallo fisso” — esattamente ciò che CODE-08 doveva evitare.
### Modificato
- `state.js`: nuovo selector `motivoPerStallo(dipendenteId, stalloId)` — deduce
  il motivo da uno stallo GIA' assegnato, con la stessa priorita' di
  `assegnaStalloConMotivo()`
- `modals.js`: `initForm` usa `motivoPerStallo()` sullo stallo effettivo
- `employee/index.js`: l'handler `emp-cambia-stallo` ricalcola il motivo
  (cambiando stallo cambia anche il perche')
- `state.js`: rimosso il controllo `lista.length >= 5` da
  `addEmailDestinatario()` — ramo mai eseguito, il tetto e' imposto dalla UI
  che disabilita il bottone
- `employee/index.js`: box priorita' portato da 3 a 4 voci, nell'ordine
  realmente eseguito dall'algoritmo
### Scelte
- Il motivo si calcola in **un solo posto** (`state.js`): duplicare le regole
  di priorita' nel modale sarebbe stata la causa del prossimo disallineamento,
  ed e' esattamente l'origine del delta 3.
- L'algoritmo di assegnazione **non e' stato toccato**: era corretto, era il
  testo a descriverlo male.
### Testo priorita': prima → dopo
```
prima (3 voci)                          dopo (4 voci)
1. stallo fisso, se disponibile         1. Il tuo stallo fisso, se disponibile
2. stesso piano — con la tua            2. Stallo con la tua caratteristica (EV / ♿)
   caratteristica                       3. Stesso piano — stallo libero più vicino
3. primo stallo libero compatibile      4. Primo stallo libero disponibile
```
### Flussi verificati
- F01/F03: caso costruito — A-07 occupato da Laura Conti, Matteo prenota e
  riceve A-06 → modale mostra “stallo libero sul tuo stesso piano” (motivo
  `piano`, non `fisso`)
- Controprova: giorno con A-07 libero → motivo `fisso` ✅
- “Cambia ↻”: A-06/piano → A-28/piano, motivo ricalcolato
- Destinatari email: bottone disabilitato a 5, sesto rifiutato, rimozione
  riabilita il bottone


## [18/08/2026] — CODE-04 (revisione) · Testo email di conferma
### Modificato
- `employee/index.js` → handler `emp-conferma`: il messaggio passa da
  `· conferma inviata a {email}` a `· Email di conferma inviata a {email}`,
  allineandolo alla specifica. Vale per prenotazione ufficio e Smart Working.
### Nota di metodo
- CODE-04 era gia' implementato il 17/08; questa revisione allinea solo il
  testo. Verificato che nessun altro toast del file sia stato toccato
  (cancellazione e segnalazione invariati).
### Trappola incontrata
- Il primo giro di checklist ha dato 2 ❌ sul messaggio nuovo: il file su
  disco era corretto ma **il server locale serviva la versione in cache**
  (`fetch(..., {cache:'no-store'})` restituiva il testo nuovo, `fetch()` quello
  vecchio). Diagnosticato e verificato sul bundle rigenerato. Aggiunto a N04.
### Flussi verificati
- F01 prenotazione ufficio e F03 Smart Working: toast con il testo nuovo
- F02 cancellazione: A-07 Occupato → Libero, tile `ms-free`, giorno `day-todo`


## [18/08/2026] — CODE-10 · Selettore periodo funzionante (fix N06)
### Fix
- Il selettore periodo in topbar scriveva `config.periodo` ma **nessun KPI lo
  leggeva**: cambiare periodo aggiornava solo l'etichetta del pulsante.
### Modificato
- `state.js`: `normalizzaPeriodo()` accetta `undefined` (= periodo in topbar),
  una data ISO (retrocompatibile) o `{dal, al}`; `giorniConDati()` e `media()`
- `state.js`: `kpiAccessi` / `kpiPrenotazioni` / `kpiVisitatori` /
  `kpiSegnalazioni` sensibili al periodo, con `medie` e `giorni`
- `state.js`: `accessiFiltrati()` rispetta il periodo selezionato
- `ui.js`: nuovo componente `kpiPeriodo()`
- `fm/accessi.js`, `fm/visitatori.js`, `fm/segnalazioni.js`: KPI media/totale
- `fm/dashboard.js`: avviso quando è attivo un periodo multi-giorno
- `styles.css`: `.kpi-periodo`
### Aggiunto
- Seed accessi e visitatori esteso ai giorni feriali già trascorsi del mese
  (`GIORNI_TRASCORSI`): 1.400 accessi su 12 giorni, 127 visitatori.
  Senza questi dati il periodo avrebbe mostrato numeri falsi.
### Scelte
- **Numero grande = media giornaliera, sottotitolo = totale del periodo.**
  La media è comparabile fra periodi (154 → 149 → 117 racconta un trend),
  il totale no (154 → 297 → 1.400 cresce solo perché crescono i giorni).
- **Invertito per Anomalie, Pass scaduti e Risolte**: contatori a basso volume,
  dove "22 nel mese" informa più di "media 2 al giorno". Se la media arrotonda
  a zero il sottotitolo torna al testo originale.
- **Grandezze puntuali mai filtrate per periodo**: Presenti Ora, Stalli liberi,
  Attivi ora, Dispositivi online e **tutti i badge in sidebar**. Un badge che
  contasse anomalie chiuse settimane fa mentirebbe.
- **Mappa, Prenotazioni e Analytics non seguono il periodo topbar**: le prime
  due sono puntuali o hanno già la loro navigazione, Analytics ha il proprio
  toggle. Due controlli sulla stessa vista sarebbero in conflitto.
- Il divisore delle medie è *giorni con dati*, non giorni di calendario:
  altrimenti weekend e giorni futuri falserebbero la media.
- Log accessi limitato a 150 righe **solo sui periodi multi-giorno**, con il
  totale dichiarato nel sottotitolo. Su un singolo giorno resta completo.
### Difetti trovati e corretti durante il blocco
- Gli accessi generati dai visitatori storici usavano `OGGI_ISO` invece della
  data del visitatore: 112 accessi finivano tutti su oggi.
- `GIORNI_PASSATI` si ferma alla settimana precedente, quindi il lunedì della
  settimana corrente restava senza accessi e "questa settimana" coincideva con
  "oggi". Introdotto `GIORNI_TRASCORSI` (tutti i feriali del mese prima di oggi).
### Flussi verificati
- Periodo Oggi → Settimana → Mese: ingressi 154 → 297 → 1.400
  (medie 154 → 149 → 117); Presenti Ora fisso a 125; badge invariati
- Ritorno a "Oggi" ripristina esattamente i valori di partenza


## [17/08/2026] — CODE-09 · Analytics
### Aggiunto
- `fm/analytics.js`: nuova sezione. Toggle Settimana/Mese, 5 KPI con delta vs
  periodo precedente, grafico occupazione (barre CSS), distribuzione per zona,
  top-5 stalli, tabella confronto
- `state.js`: `PERMISSIONS.analytics` (true per admin/fm, false per dipendente),
  `ui.analyticsPeriodo`, action `setAnalyticsPeriodo()`
- `state.js`: `GIORNI_PASSATI` — il seed copre ora tutto il mese corrente, con
  le settimane trascorse come prenotazioni `completata`
- `index.html`: voce NAV + tab + script
- `styles.css`: `.analytics-toggle`, `.chart-*`, `.hbar-*`, `.kpi-delta`
### Note
- I valori del periodo precedente non esistono nei dati: sono derivati con un
  PRNG separato (seed `20260818`), fattore 0.82–1.18. Plausibili e stabili.
- Le metriche contano `stato !== 'annullata'` e non `=== 'attiva'`: le
  prenotazioni passate sono `completata` e con il filtro letterale il mese
  avrebbe contato zero storico.
### Flussi verificati
- F13 Analytics: Settimana 81,9% / 655 prenotazioni (5 barre) vs Mese 68,9% /
  1.653 (3 barre) — i dati cambiano davvero

## [17/08/2026] — CODE-08 · Comunicazione stallo dipendente
### Modificato
- `state.js`: nuovo selector `assegnaStalloConMotivo()` → `{stalloId, motivo}`
  con priorità fisso → caratteristica → piano → primo libero;
  `motivoAssegnazione()` per l'etichetta leggibile
- `employee/index.js`: hero "Stallo assegnato dal FM: A-07"; box priorità nella
  sezione mappa
- `modals.js`: `emp-book` mostra il motivo sotto il codice stallo
### Note
- `assegnaStalloAutomatico()` **non ha cambiato firma**: restituisce ancora la
  stringa, così le 5 chiamate esistenti non si toccano
- Il motivo ha 4 valori invece dei 3 previsti: aggiunto `caratteristica`, perché
  la priorità EV/disabili precede quella per piano

## [17/08/2026] — CODE-07 · Config sede modificabile
### Aggiunto
- `state.js`: `aggiornaSede()`, `impostaPostiTotali()`, `toggleEditSede()`
- `fm/amministrazione.js`: form inline con nome, indirizzo, numero posti
### Note
- Il numero posti crea/rimuove stalli **reali** nella prima zona standard;
  abbassandolo, le prenotazioni sugli stalli rimossi vengono annullate
- Topbar, sidebar e login si aggiornano da soli: leggono `State.config.sede`

## [17/08/2026] — CODE-06 · Hardware generalizzato
### Aggiunto
- `state.js`: `TIPI_HW` (tastierino2n, bluetooth, anpr, qrreader, sbarra,
  pilomat); seed a 6 dispositivi; stato `in_configurazione`;
  `METODO_ACCESSO` esteso a 9 voci; selector `metodiAccesso()`
- `fm/hardware.js`: colonne Tipo + Metodo accesso, azioni contestuali per tipo,
  card "Metodi di accesso disponibili" derivate dall'hardware
- `styles.css`: `.metodi-grid`, `.metodo-card`
### Modificato
- `buildAccessi()`: metodi variati (zona B → PIN, altri → app/QR alternati,
  visitatori → PIN perché il codice My2N è un PIN)

## [17/08/2026] — CODE-05 · Email FM multi-destinatario
### Aggiunto
- `state.js`: `config.notifiche.emailDestinatari`, `addEmailDestinatario()` con
  validazione regex e limite 5, `removeEmailDestinatario()`
- `fm/config.js` tab Notifiche: chip destinatari + input di aggiunta
- `employee/index.js`: il toast di segnalazione elenca i destinatari

## [17/08/2026] — CODE-04 · Email simulata prenotazione
### Modificato
- `employee/index.js`: il toast di conferma include
  `· conferma inviata a {email}` sia per ufficio che per Smart Working

## [17/08/2026] — CODE-03 · FIX cancella prenotazione → stallo occupato
### Fix
- `state.js → annullaPrenotazione()`: chiude anche l'accesso ancora aperto.
  `statoStallo()` deriva lo stato dagli accessi con `uscita === null`, quindi
  senza questa chiusura lo stallo restava rosso in mappa dopo la cancellazione.
### Note
- La condizione va oltre la patch proposta: cerca in OR su `prenotazioneId`
  **e** su `stallo + persona`. Motivo: una prenotazione creata dopo il seed non
  ha un accesso collegato, mentre l'accesso del seed sullo stesso stallo resta
  aperto. Le occupazioni abusive restano escluse: le gestisce il FM.
### Flussi verificati
- F02: prima `A-07 Occupato` con accesso aperto → dopo `A-07 Libero`, accesso
  chiuso, tile `ms-free` nella mappa FM, giorno tornato verde nel calendario

---

## VERIFICA DI REGRESSIONE — 18/08/2026 (dopo CODE-13)

**48 ✅ · 0 ❌ · 0 ⚠️** sulla checklist completa, piu' 17 controlli specifici
dei TEST A e B. Eseguita sul bundle rigenerato, come previsto da CLAUDE.md.

---

## VERIFICA DI REGRESSIONE — 18/08/2026 (dopo CODE-12)

Checklist completa **56 ✅** + 17 controlli specifici sull'export.
Due ❌ iniziali (box priorita' e toast email) erano **cache del server locale**,
non regressioni: `fetch(...,{cache:'no-store'})` restituiva 4 voci e il testo
nuovo, `fetch()` la versione vecchia. Riverificati sul bundle: **entrambi ✅**.

> Da qui in avanti la checklist finale si esegue **sul bundle rigenerato**,
> non sul server sorgente. Vedi N04.

---

## VERIFICA DI REGRESSIONE — 18/08/2026 (dopo CODE-11)

Checklist completa: **79 ✅ · 0 ❌ · 0 ⚠️**, più 11 controlli specifici del
blocco. Nessun downgrade su aree non toccate.

---

## VERIFICA DI REGRESSIONE — 18/08/2026 (dopo CODE-04 rev.)

Checklist completa eseguita sul bundle rigenerato: **49 ✅ · 0 ❌**.
L'unico ⚠️ (cancellazione prenotazione di oggi) era dovuto alla sequenza del
test, che aveva gia' convertito la prenotazione in Smart Working: riverificato
in isolamento su pagina fresca, **✅ PASS**.

---

## VERIFICA DI REGRESSIONE — 18/08/2026 (dopo CODE-10)

Checklist completa: **86 ✅ · 0 ❌**. Un ❌ iniziale su *"FM modifica stallo"*
si è rivelato un assert sbagliato del test (dava per libero uno stallo oggi
occupato): per design il colore dello stato vince sul tipo. Comportamento
confermato corretto su uno stallo libero.

Aggiunto il gruppo **NON-REGRESSIONE PERIODO**: badge, Presenti Ora, Stalli
liberi e Attivi ora restano invariati al variare del periodo.

---

## VERIFICA DI REGRESSIONE — 17/08/2026

Checklist completa di `CLAUDE.md` eseguita nel browser: **75 ✅ · 0 ❌ · 0 ⚠️**.
Zero errori in console.

| Gruppo | Esito |
|--------|-------|
| Login e navigazione | 6/6 ✅ |
| Dashboard | 6/6 ✅ |
| Mappa Stalli | 6/6 ✅ |
| Accessi | 5/5 ✅ |
| Prenotazioni | 6/6 ✅ |
| Segnalazioni | 6/6 ✅ |
| Dipendenti | 8/8 ✅ |
| Visitatori | 5/5 ✅ |
| Hardware | 4/4 ✅ |
| Policy & Config | 5/5 ✅ |
| Amministrazione | 6/6 ✅ |
| Vista Dipendente | 8/8 ✅ |
| Coerenza inter-sezione | 5/5 ✅ |

---

## BUG NOTI

Nessun bug funzionale aperto (N06 risolto in CODE-10). Elementi da tenere presenti:

| # | Tipo | Descrizione |
|---|------|-------------|
| N01 | Debito lessicale | In `state.js` le zone A/B/C hanno `colore: 'gold'`, residuo della palette precedente. È mappato a `var(--blue)` e **non produce alcun oro a schermo**. Rinominarlo richiede di toccare `dashboard.js → coloreBarra()`, dove il valore fa cadere la mini-mappa sul colore a semaforo. |
| N02 | Limite noto | La demo è in-memory: ogni reload riparte dal seed. Nessuna persistenza (voluto). |
| N03 | Limite noto | `dist/parking_cloud_demo.html` dipende da Google Fonts per Nunito. Offline usa il fallback Trebuchet MS. |
| N04 | Trappola nei test | (a) I nodi DOM raccolti prima di una mutazione diventano orfani: ri-cerca l'elemento a ogni iterazione. (b) Il server locale puo' servire JS **in cache** dopo una modifica: verifica con `fetch(url,{cache:'no-store'})` o rigenera il bundle. (c) `location.reload()` non ricarica lo snapshot `data:` del bundle: lo stato JS sopravvive fra i test. |
| N05 | Da decidere | "Numero posti" in Modifica sede crea/rimuove stalli reali. Se dovesse essere solo dichiarativo, va cambiato. |
