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
| Amministrazione | `fm/amministrazione.js` | ✅ solo Admin — utenti piattaforma + parcheggi, modifica sede con conferma sulle riduzioni, ripristino dati demo |
| Vista Dipendente | `employee/index.js` | ✅ calendario, mappa read-only, prenotazioni |

### Modali registrati — 28 su 28

`stallo-det` · `acc-det` · `dip-det` · `add-user` · `sblocco` · `dip-pass` ·
`req-pass` · `add-vis` · `vis-det` · `seg` · `hw` · `add-stallo` · `add-bk` ·
`policy` · `export` · `daterange` · `emp-book` · `emp-cancel` · `emp-segnala` ·
`emp-profile` · `emp-history` · `add-platform-user` · `platform-user-det` ·
`import-dipendenti` · `dip-creato` · `conferma-riduzione` · `conferma-ripristino` ·
`emp-richiedi-pass`

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
voce "Amministrazione" (11 voci sidebar vs 10).

### Dati demo

Generati da PRNG con seed fisso `20260817`: **stabili a ogni reload**.

- 156 stalli su 6 zone (A 42 · B 48 · C 36 · V 16 · EV 6 · H 8)
- 312 dipendenti · 2 bloccati · 287 con app attiva
- 2.071 prenotazioni su 15 giorni (mese corrente, settimane passate chiuse)
- 1.400 accessi su 12 giorni (154 oggi) · 127 pass visitatore · 22 segnalazioni
- 6 dispositivi hardware · 2 utenti di piattaforma

---

## STORICO MODIFICHE

## [18/08/2026] — CODE-17C · Lista d'attesa (solo modalità turni)
> In `giornaliera` la lista d'attesa non esiste da nessuna parte: senza turni
> non c'è una coda per cui mettersi in fila.

### Aggiunto
- `state.js`: `AppState.listaAttesa` — voci
  `{ id, dipendenteId, turnoId, giornoIso, dataRichiesta, stato }`.
  Presente in entrambi gli scenari, salvata e ripristinata dallo switch.
- `state.js` Actions: `entraInListaAttesa({dipendenteId, turnoId, giornoIso})` e
  `assegnaStalloDaListaAttesa(id)`.
- `state.js` Selectors: `listaAttesaPerTurno(turnoId, giornoIso)` (ordinata per
  anzianità di richiesta), `listaAttesaAperta()`, `listaAttesaDipendente(id)`.
- `modals.js → emp-book`: turno esaurito → *"Turno [label] esaurito. Vuoi
  entrare in lista d'attesa?"* con "No grazie" / "Sì, mettimi in lista".
- `modals.js`: modale `lista-attesa` per il FM, con "Assegna stallo" per riga.
- `employee/index.js`: handler `emp-entra-attesa` / `emp-rifiuta-attesa` e
  **TAB 3 — Lista Attesa** in "Le mie richieste", con stato, orario del turno e
  **posizione in coda**; quando assegnata mostra lo stallo in evidenza.
- `fm/dashboard.js`: card **"⏳ Lista attesa: N"** con dipendente, turno e data
  richiesta, "Assegna stallo" per riga e "Gestisci coda" per il modale.
### Fix
- **Un turno esaurito non era selezionabile.** In CODE-17B le card piene erano
  rese inerti (`pieno ? '' : UI.act(...)`) con `cursor:not-allowed`: la
  proposta di lista d'attesa era quindi **irraggiungibile**, perché per vederla
  bisogna poter scegliere proprio il turno pieno. Ora la card resta attenuata
  ma cliccabile, e da selezionata si colora d'ambra.
### Note di progetto
- `assegnaStalloDaListaAttesa()` passa da `prenotaTurno()`: nessuna logica di
  assegnazione duplicata. **Se non c'è nulla di libero la voce resta
  `in_attesa`** e il toast lo dice — non si finge un successo.
- Una sola voce per persona/turno/giorno: cliccare due volte non crea due
  posizioni in coda, e il modale avverte che si è già in lista.
- La card in Dashboard compare **solo se qualcuno è davvero in coda**: una card
  vuota sarebbe rumore in una vista che deve dire cosa succede adesso.
### Flussi verificati
- **TEST A 31/31 ✅** — checklist completa in giornaliera. Precondizioni: zero
  occorrenze di "lista attesa" in tutte e 10 le sezioni FM, e la vista
  dipendente resta a **2 tab**.
- **TEST B 19/19 ✅** — turno saturo → proposta → "No grazie" non crea nulla →
  "Sì" crea la voce con toast → doppio click non duplica → TAB 3 mostra
  *"posizione 1 in coda"* → FM vede **"Lista attesa: 1"** → senza stalli liberi
  l'assegnazione fallisce onestamente → liberato uno stallo, "Assegna stallo"
  crea la prenotazione (*"✓ Alice Negri · stallo A-20 assegnato dalla lista
  d'attesa"*) → dipendente vede **"Assegnato"** con lo stallo e il calendario
  mostra *"A-20 · Mattino"*.
- Isolamento: in uffici la lista sparisce ovunque; tornando in ospedale la voce
  persiste; `ripristinaDemo()` azzera entrambi gli scenari.

## [18/08/2026] — CODE-17B rev. · Due scenari coesistenti in memoria
> Revisione di CODE-17B dopo le risposte alle 5 domande. Punti 1, 2, 4 e 5 erano
> già conformi; il punto 3 no.

### Modificato
- **Il toggle Uffici/Ospedale non rigenera più: scambia.** Prima
  `attivaDemoOspedale()` ricostruiva il dataset a ogni click e
  `ripristinaDemoUffici()` idem. Funzionava per una demo lineare, ma **il
  lavoro fatto in uno scenario andava perso passando all'altro e tornando**.
- `costruisciDati()` → `buildSeedUfficio(utenti)`, `costruisciDatiOspedale()` →
  `buildSeedOspedale(utenti)`. Nuova `costruisciScenari()` che li costruisce
  **entrambi una volta sola**, in ordine fisso, e li tiene in `SCENARI`.
- Nuove actions `cambiaScenario(nome)` e `_salvaScenarioCorrente()`: prima di
  passare all'altro scenario lo stato vivo viene congelato nel proprio slot.
- `ripristinaDemo()` ricostruisce **entrambi** gli scenari: è l'unico punto in
  cui i generatori vengono riavvolti.
### Fix
- **`buildSeedOspedale()` non chiama più `resetGeneratori()`.** Con i due
  dataset compresenti, azzerare i contatori faceva nascere un `DIP-0001`
  ospedaliero identico a quello degli uffici: la prima anagrafica creata dopo
  uno switch sarebbe collisa con una esistente — la stessa classe di bug della
  collisione `USR-0001` documentata in F12.
- **`utentiPiattaforma` è condiviso per riferimento** fra gli scenari. Admin e
  FM sono account di piattaforma, non del singolo parcheggio: duplicandoli,
  `S.utenteCorrente()` falliva dopo lo switch e **la sessione cadeva**.
- **`buildAccessiOspedale()` non dipende più da `Selectors`.** Spostando la
  costruzione al load del modulo è emerso un `ReferenceError: Cannot access 'S'
  before initialization`: la funzione girava prima che `Selectors` esistesse.
  Ora usa helper locali. Il difetto era invisibile finché il dataset ospedale
  nasceva solo al click.
### Flussi verificati
- **TEST A 33/33 ✅** — checklist completa in giornaliera, nessun downgrade
- **TEST B 8/8 · TEST C 6/6 · TEST D 5/5 · TEST E 5/5**
- **Persistenza 5/5**: prenotazione creata in ospedale → passo a uffici (non
  c'è) → aggiungo uno stallo agli uffici (156→157) → torno in ospedale: **la
  prenotazione è ancora lì e gli stalli sono 156**, non contaminati → torno
  agli uffici: **i 157 stalli ci sono ancora**
- Id `DIP` distinti fra i due scenari, sessione Admin conservata allo switch,
  determinismo su ricostruzioni ripetute

## [18/08/2026] — CODE-17B · UI modalità a turni + scenario ospedale
> `giornaliera` resta il default e il comportamento invariato: la modalità a
> turni è **addizione pura**, visibile solo quando è attiva.

### Aggiunto
- `fm/config.js` tab Policy: sezione **Modalità Prenotazione** in cima, toggle
  Giornaliera / Per turni. Con "Per turni" compaiono i turni configurabili
  (label, ora inizio, ora fine, rimozione, "+ Aggiungi turno") e lo slider di
  tolleranza 0–60 min. In giornaliera si vede **solo il toggle**.
- `fm/mappa.js`: selettore orizzontale dei turni sopra la legenda, KPI
  "Liberi turno X: n/156", tile colorate per il turno selezionato e classe
  `ms-cambio` (gialla) durante il passaggio di consegne. Legenda estesa.
- `fm/dashboard.js`: riga "Turno attivo: Mattino · 07:00–15:00" sotto il
  timestamp; la mini-mappa segue il turno corrente.
- `fm/prenotazioni.js`: celle con `[stallo] · [turno]` e colore per turno
  (blu / verde / viola), più la tabella **"Capacità per turno — oggi"**
  (Turno · Orario · Prenotati · Liberi · % Occupazione).
- `modals.js → emp-book`: in modalità turni la scelta del turno viene **prima**
  dello stallo — card con orario, posti disponibili e stato
  Disponibile/Esaurito; poi lo stallo assegnato col motivo e la nota sui
  ±30 min di tolleranza. La conferma resta disabilitata finché non c'è un turno.
- `employee/index.js`: handler `emp-sel-turno`, turno propagato a `prenota()`,
  ed etichetta `[stallo] · [turno]` nel calendario e in "Le mie prenotazioni".
- `state.js`: `buildDipendentiOspedale()`, `buildPrenotazioniOspedale()`,
  `buildAccessiOspedale()`, `costruisciDatiOspedale()`, actions
  `attivaDemoOspedale()` / `ripristinaDemoUffici()` / `_caricaScenario()`,
  selectors `kpiPerTurno()`, `turnoAttivoMappa()`, `cambioTurnoInCorso()`,
  `minutiDa()`, `distanzaCircolare()`, actions `setMappaTurno()`,
  `aggiornaTurno()`, `aggiungiTurno()`, `rimuoviTurno()`.
- `fm/amministrazione.js`: toggle **Modalità demo: Uffici / Ospedale**.
- `styles.css`: stili turni, card di scelta, celle colorate, box scenario.
### Modificato
- `turnoCompatibile(p, turnoId)`: da stub a filtro reale. **Una prenotazione
  con `turnoId: null` è giornaliera e occupa lo stallo in ogni turno** — è ciò
  che rende non distruttivo attivare i turni su dati creati in giornaliera.
- `statoStallo(stalloId, dataISO, turnoId)`: terzo parametro. In giornaliera
  resta `undefined` e nulla cambia. Anche il ramo **accessi** è ora filtrato per
  turno: un ingresso del mattino non tiene più rosso lo stallo nella vista del
  turno di notte, che altrimenti annullerebbe la capacità 3x.
- `stalloPrenotabile()`, `assegnaStalloConMotivo()`, `assegnaStalloAutomatico()`,
  `stalliDisponibiliPer()`, `prenota()`: propagano il turno.
### Note di progetto
- **Il giallo non è "siamo vicini a un confine".** `cambioTurnoInCorso()`
  richiede anche che lo stallo sia prenotato in **entrambi** i turni a cavallo:
  senza quella condizione ogni stallo diventerebbe giallo due volte al giorno,
  anche senza alcun passaggio di consegne.
- Lo scenario ospedale **sostituisce** il dataset in place, con la stessa
  regola di `ripristinaDemo()`: `AppState` non va rimpiazzato, ogni modulo ne
  tiene un riferimento preso al load.
- Nel seed ospedale i nomi sono forzati univoci: su soli 20 dipendenti una
  collisione è probabile, e due omonimi sullo stallo vetrina renderebbero
  illeggibile la dimostrazione della capacità 3x.
- `buildAccessi()` non è riusabile per l'ospedale: genera tutti gli ingressi in
  fascia mattutina, e le tre persone dello stallo vetrina risulterebbero dentro
  contemporaneamente. `buildAccessiOspedale()` fa entrare ognuno nel proprio
  turno e lascia aperto solo l'accesso del turno in corso.
### Flussi verificati
- **TEST A (31/31)**: checklist completa in giornaliera + precondizioni —
  nessun elemento dei turni in nessuna delle 10 sezioni, Policy col solo
  toggle, `emp-book` senza scelta turno, prenotazioni con `turnoId: null`
- **TEST B (10/10)**: toggle Ospedale → sede, 20 dipendenti (5/10/5), selettore
  turni, KPI per turno, Dashboard con turno attivo, celle e tabella capacità.
  **A-07 occupato in tutti e tre i turni da tre persone diverse**
- **TEST C (9/9)**: card turni con posti e stato, conferma disabilitata senza
  turno, stallo assegnato col motivo, nota tolleranza, calendario
  "A-01 · Mattino", cella FM `t-mattino`
- **TEST D (10/10)**: 14:45 e 15:15 in tolleranza; 10:00 e 20:00 no; bordi
  esatti 14:30/15:30 dentro e 14:29/15:31 fuori; uno stallo prenotato in un solo
  turno non diventa mai giallo; tolleranza 0 disattiva il giallo
- **TEST E (8/8)**: ritorno a Uffici — sede, 312 dipendenti, 2.071 prenotazioni,
  **zero residui ospedale** (0 ruoli, 0 reparti, 0 prenotazioni con turno),
  nessuna UI dei turni, KPI 156/25/129 come da baseline
### Limiti noti
- La griglia FM Prenotazioni mostra al massimo 14 dipendenti: con 20 in
  evidenza, gli ultimi in ordine alfabetico si raggiungono dalla ricerca.
  Comportamento preesistente, non introdotto qui.

## [18/08/2026] — CODE-17A · Modalità a turni: sola infrastruttura
> **Blocco di sola infrastruttura: zero modifiche alla UI.** La modalità
> `giornaliera` resta il default e il comportamento esistente non cambia in
> nessun punto. La modalità `turni` è dichiarata ma **non attiva**: UI e seed
> ospedale arrivano con CODE-17B, la lista d'attesa con CODE-17C.

### Aggiunto
- `state.js → buildConfig()`: `modalitaPrenotazione: 'giornaliera'`,
  `turni` (mattino 07:00–15:00 · pomeriggio 15:00–23:00 · notte 23:00–07:00),
  `tolleranzaCambioTurnoMin: 30`
- `state.js`: campo `turnoId: null` su **tutte** le prenotazioni — le 2.071 del
  seed e quelle create a runtime. `null` significa "giornaliera".
- `state.js → Selectors.turnoCorrente(quando)`: il turno attivo secondo
  l'orario. Gestisce il turno di notte a cavallo della mezzanotte leggendo
  23:00–07:00 come "dalle 23 in poi **oppure** prima delle 7".
  `quando` è opzionale ed esiste solo per i test: senza argomento usa
  `new Date()`, come da specifica.
- `state.js → Selectors.turno(id)` e `Selectors.turnoCompatibile(p)`
- `state.js → Actions`: `setModalitaPrenotazione()`, `setTurni()`,
  `setTolleranzaCambioTurno()`, `prenotaTurno({ dipendenteId, stalloId,
  giornoIso, turnoId })`
### Modificato
- `statoStallo()`: la ricerca della prenotazione attiva passa dal predicato
  `S.turnoCompatibile(p)`. In `giornaliera` accetta tutto — comportamento
  identico a prima. In `turni` **oggi accetta comunque tutto**: è uno stub
  voluto, il seggio dove CODE-17B innesterà il filtro per `turnoId`.
### Fix
- **Quarta sorgente di prenotazioni non intercettata.** `applicaPatternEvidenza()`
  crea 45 prenotazioni proprie (i pattern dei dipendenti in evidenza) e non era
  fra i tre punti di creazione noti: 45 record su 2.071 restavano senza
  `turnoId`. Trovato dalla verifica del PUNTO 2, corretto.
### Note tecniche
- `prenotaTurno()` **non duplica** `prenota()`: la chiama e aggiunge il turno.
  Assegnazione dello stallo, sostituzione di una prenotazione esistente e
  chiusura degli accessi restano in un posto solo.
- Perché lo stub deve restare inerte: tutte le prenotazioni esistenti hanno
  `turnoId === null`. Attivare il filtro per turno prima che la UI permetta di
  sceglierne uno le farebbe sparire in blocco dalla mappa.
### Flussi verificati
- PUNTO 1: config senza eccezioni, `modalitaPrenotazione === 'giornaliera'`,
  3 turni con id/label/inizio/fine esatti, tolleranza 30
- PUNTO 2: 0 prenotazioni senza il campo, 0 con valore diverso da `null`,
  incluse quelle create a runtime
- PUNTO 3: `statoStallo()` confrontato con la baseline presa **prima** della
  modifica — 5 stalli campione e poi **tutti i 156 stalli × 3 giorni
  (468 combinazioni): 0 differenze**. Forzando `modalitaPrenotazione='turni'`
  l'output resta identico, come deve essere per uno stub.
- PUNTO 4: le 4 actions esistono, scrivono e ripristinano; `prenotaTurno`
  propaga il turno sia con stallo automatico sia con stallo esplicito
- PUNTO 5: 10:00 → mattino · 18:00 → pomeriggio · 02:00 → notte. Bordi
  verificati (07:00, 14:59, 15:00, 22:59, 23:00, 00:00, 06:59) e copertura
  completa: **tutti i 1.440 minuti del giorno hanno un turno, 480 ciascuno**
- `ripristinaDemo()` riporta modalità, turni, tolleranza e `turnoId`

## [18/08/2026] — CODE-16 · Pass a range di date, notifiche e "Le mie richieste"
### Aggiunto
- `employee/index.js`: sezione **"Le mie richieste"** con due tab —
  *Pass Visitatori* (nome, range, stato, e per gli approvati il codice My2N in
  evidenza) e *Segnalazioni* (tipo, stallo, data di invio, stato).
  Stato vuoto: "Nessuna richiesta inviata".
- `employee/index.js`: badge di notifica nell'hero, verde per un pass approvato
  e rosso per uno rifiutato, con il nome del visitatore. Si azzera aprendo la
  tab Pass.
- `state.js`: selectors `richiestePassDipendente()`, `segnalazioniDipendente()`,
  `notifichePassNonLette()`; actions `segnaRichiestePassLette()` e
  `setEmpRichiesteTab()`; stato UI `empRichiesteTab`.
- `styles.css`: `.emp-req-tabs`, `.emp-req-card`, `.emp-code-box`, `.form-hint`
### Modificato
- **Richiesta pass: da giorno+orari a intervallo di date.** In
  `richiestePass` i campi `data` / `oraInizio` / `oraFine` sono sostituiti da
  `dataInizio` / `dataFine`; il pass approvato vale **H24** su tutti i giorni
  del range. Il codice My2N resta invariato.
- `modals.js → emp-richiedi-pass`: rimossi "Ora inizio" e "Ora fine",
  "Data" diventa **Data inizio / Data fine** affiancate, con `min` sulla
  seconda e validazione `dataFine >= dataInizio` sia nel modale sia
  nell'handler.
- `modals.js → req-pass`: il FM vede "Dal / Al · H24" invece dell'orario.
- `state.js → approvaRichiestaPass()`: scrive l'esito **sulla richiesta**
  (`codiceMy2N`, `visitatoreId`, `esitoIlTs`, `letta: false`), non solo sul
  visitatore. `rifiutaRichiestaPass()` fa lo stesso senza creare il pass.
- `state.js → creaPassVisitatore()`: accetta `dataFineISO`, salva `dataFine` e
  sceglie uno stallo di zona V libero su **tutti** i giorni del range.
- `state.js → statoStallo()`: il pass multi-giorno occupa lo stallo per l'intero
  intervallo (`v.data <= data && (v.dataFine || v.data) >= data`), non solo il
  primo giorno.
### Fix
- **`rifiuta-req` perdeva la motivazione.** L'handler leggeva `Modals.form.note`
  **senza chiamare prima `Modals._collect()`**: il testo scritto dal FM non
  arrivava mai alla richiesta. Invisibile finché nessuno mostrava quel campo;
  con la nuova vista dipendente il rifiuto sarebbe arrivato sempre senza motivo.
- **Modali troppo alti: pulsante di conferma fuori schermo.** `.modal` aveva
  `overflow-y:auto` sull'intero riquadro, quindi su finestre basse titolo e
  pulsanti scorrevano via insieme al contenuto: il form sembrava "bloccato"
  perché il pulsante di invio non era raggiungibile. Ora `.modal` è una colonna
  flex con `overflow:hidden`, header e footer `flex:0 0 auto` e **solo
  `.modal-body` scorrevole**. Vale per tutti i 28 modali.
### Nota sulla diagnosi di "campi non cliccabili"
Non esisteva alcun blocco sui campi: nessun `disabled`, nessun `readOnly`,
`pointer-events` regolare, focus e scrittura funzionanti. Misurando la
geometria, "Ora inizio", "Ora fine", "Note" **e il pulsante Invia** cadevano
fuori dal viewport su una finestra bassa. La causa era l'altezza del modale, non
i campi — ed è per questo che il fix è strutturale e non cosmetico.
### Flussi verificati
- TEST A (9/9): modale con 6 campi, orari assenti, date affiancate con default
  oggi, tutti i campi con focus e scrittura, footer e titolo sempre nel
  viewport, `dataFine < dataInizio` bloccata, invio → richiesta in FM
- TEST B (8/8): `req-pass` mostra Dal/Al H24 · approvazione → My2N identico su
  richiesta e visitatore · pass `00:00–23:59` su stallo V dedicato · badge verde
  in hero · tab Pass con codice evidenziato · apertura tab → badge azzerato
- TEST C (6/6): rifiuto con motivazione salvata, nessun pass creato, badge
  rosso, card "Rifiutato" senza codice e con il motivo, tab Segnalazioni
  popolata, stato vuoto corretto
- Pass sovrapposti ricevono stalli V diversi; un pass a cavallo di oggi occupa
  lo stallo anche oggi
### Flussi NON verificabili in demo
- L'invio reale del codice My2N al visitatore via email.
- Su date **future** i pass visitatore non colorano la mappa FM: `statoStallo()`
  valuta i visitatori solo per oggi (limite preesistente). Il doppio
  assegnamento è comunque impedito da un controllo esplicito sulle
  sovrapposizioni in `creaPassVisitatore()`.

## [18/08/2026] — CODE-15 · Finestra a giorni lavorativi, pass da dipendente, sospensione
### Aggiunto
- `state.js`: `isLavorativo(d)` e `giorniLavorativi(da, n)` (esportati in `Utils`).
  La data di partenza e' un **parametro** e non `OGGI`: e' l'unico modo di
  verificare il caso "oggi = lunedi'" senza spostare l'orologio del browser.
- `state.js`: `Selectors.finestraPrenotazione()`, `giorniAnticipo()`,
  `settimanaEmpOffset(off)`, `settimanaHaGiorniPrenotabili(off)`
- `state.js`: campo `puoRichiederePass` su ogni dipendente + azioni
  `togglePuoRichiederePass(id)` e `creaRichiestaPass({...})`
- `modals.js`: modale `emp-richiedi-pass` (nome, email, azienda, data, ora
  inizio 09:00, ora fine 18:00, note); toggle "Puo' richiedere pass visitatore"
  in `dip-det`
- `fm/dipendenti.js`: colonna **Pass vis.** con toggle per riga
- `employee/index.js`: pulsante "🪪 Richiedi Pass" in topbar, reso **solo** se
  `dipendenteCorrente().puoRichiederePass === true`, + handler
  `emp-invia-richiesta-pass` con validazione di nome ed email
- `index.html` + `styles.css`: avviso `.login-warn` sotto gli account demo sul
  limite delle due tab del browser
### Modificato
- **Finestra di prenotazione: da settimane a 10 giorni lavorativi**, oggi
  incluso. `config.prenotazioni.maxBookingWeeks` e' sostituito da
  `finestraGiorniLavorativi` (default 10). Sabato e domenica non contano.
- `ultimaDataPrenotabile()` ora e' **inclusiva**: prima era il limite esclusivo
  `OGGI + N*7`. Chi la confronta deve usare `<=` e non `<` — `setPolicy()` e'
  stato corretto di conseguenza (`p.data > limite`, non `>=`).
- `empWeek(delta)`: il limite non e' piu' un contatore di settimane, ma
  "la settimana di destinazione contiene almeno un giorno prenotabile".
  Stessa condizione sul `disabled` del pulsante "Succ ›".
- Chip dipendente: "📅 Prenota fino a **9 giorni lavorativi** in anticipo"
- Disclaimer FM Prenotazioni: "Finestra di prenotazione: **10 giorni
  lavorativi** (oggi incluso)"
- Slider Config → Policy: da 1–4 settimane a **5–20 giorni lavorativi**
  (step 5). Vedi la nota di scopo qui sotto.
- `sospendiDipendente()` ritorna `{ dipendente, annullate }` e le prenotazioni
  future passano da `annullaPrenotazione()` invece di un assegnamento diretto.
  Toast: "Accesso sospeso per [nome] · N prenotazioni future annullate", oppure
  "· nessuna prenotazione futura" quando N = 0.
### Rimosso
- `modals.js → emp-profile`: campo "No-show". Resta in `dip-det` (vista FM) e
  nella policy: e' un dato di controllo del FM, non del dipendente.
### Nota di scopo — lo slider di Config → Policy
La specifica elencava `state.js` ed `employee/index.js`, ma la finestra non
dipende piu' da `maxBookingWeeks` e quello slider *pilotava* `maxBookingWeeks`.
Lasciarlo invariato avrebbe prodotto un controllo che non fa nulla, cioe' un
downgrade del flusso F11 gia' verificato. E' stato quindi riagganciato al nuovo
campo. I numeri richiesti dalla specifica restano esatti al valore di default.
### Nota tecnica — perche' `annullaPrenotazione()` e non `p.stato = 'annullata'`
`statoStallo()` deriva l'occupazione **anche dagli accessi**. Annullando la
prenotazione di oggi senza chiudere l'accesso ancora aperto, lo stallo sarebbe
rimasto rosso in mappa: e' esattamente il bug corretto in CODE-03. Passare per
`annullaPrenotazione()` eredita quella chiusura invece di riscriverla.
### Flussi verificati
- Caso obbligatorio A: partenza lunedi' 24/08 → ultimo giorno utile venerdi'
  04/09; il lunedi' 07/09 resta fuori finestra; nessun weekend nella finestra
- Finestra reale (oggi martedi' 18/08): 18–21/08 + 24–28/08 + 31/08 = 10 giorni
- Passato → "Passato"; futuro fuori finestra → "Non prenotabile", entrambi grigi
- "Succ ›" arriva all'offset 2 (che contiene il 31/08) e li' si disabilita
- Restringendo la finestra a 5 giorni, le prenotazioni oltre il nuovo limite
  vengono annullate e nessuna resta oltre il limite inclusivo
- Toggle Pass vis. da tabella: cambia lo stato e **non** apre il modale di riga
- "Richiedi Pass" presente per Matteo Bruni (flag true) e assente per Elena
  Ricci (flag false); richiesta creata `in_attesa`, visibile nel banner FM e in
  `req-pass`, approvabile fino alla creazione del pass in Visitatori
- Caso obbligatorio D: sospensione di Matteo Bruni → toast "3 prenotazioni
  future annullate", celle della griglia FM vuote da oggi in poi, stallo A-07
  `ms-free` in mappa, zero accessi aperti residui; caso N = 0 → "nessuna
  prenotazione futura"
### Flussi NON verificabili in demo
- L'invio reale dell'email di richiesta pass al FM: la demo mostra il toast e
  crea la richiesta in stato `in_attesa`, non esce nulla dal browser.

## [18/08/2026] — CODE-14 · Conferma riduzione posti + Ripristina dati demo
### Aggiunto
- `state.js`: `Selectors.anteprimaPosti(target)` — calcolo **puro** di cosa
  verrebbe rimosso portando i posti a `target`: id degli stalli, numero di
  prenotazioni coinvolte, zona interessata. Non muta nulla, quindi la stessa
  funzione serve l'anteprima nel modale e il testo del toast dopo la conferma:
  i due numeri non possono divergere.
- `state.js`: `resetGeneratori()` e `costruisciDati()` — la generazione del seed
  era inline, ora è una funzione richiamabile. `rnd` è passato da `const` a
  `let`: il ripristino deve poter riavvolgere il PRNG, altrimenti i dati
  "ripristinati" sarebbero diversi da quelli di partenza.
- `state.js`: `Actions.ripristinaDemo()` — riporta i dati allo stato iniziale
  **senza ricaricare la pagina**.
- `modals.js`: `conferma-riduzione` (anteprima + elenco stalli + alert danger) e
  `conferma-ripristino` (avviso + riepilogo + nota sulla sessione)
- `fm/amministrazione.js` tab Parcheggi: box "Ripristina dati demo" + handler
  `conferma-riduzione-posti` e `conferma-ripristino-demo`
- `styles.css`: `.ripristino-box`, `.ripristino-nota`
### Modificato
- `fm/amministrazione.js → salva-sede`: se `anteprimaPosti()` restituisce stalli
  da rimuovere apre il modale di conferma **e ritorna senza scrivere**; se il
  numero sale o resta uguale si applica direttamente, come prima. Nessun percorso
  distruttivo resta senza conferma, nessun percorso innocuo guadagna un click.
### Fix
- **N05 risolto.** Ridurre "Numero posti" in Modifica sede elimina stalli reali e
  annulla le prenotazioni che ci insistevano. Prima accadeva al primo click, in
  silenzio: davanti al cliente si perdevano dati senza preavviso e senza modo di
  tornare indietro. Ora il costo è dichiarato prima ed è annullabile; e se si
  sbaglia comunque, "Ripristina dati demo" rimette tutto a posto in un click.
### Note tecniche
- `ripristinaDemo()` **non sostituisce `AppState`**: lo svuota e lo riempie di
  nuovo in place. Ogni modulo ne tiene un riferimento preso al load, quindi
  rimpiazzare l'oggetto lascerebbe le sezioni agganciate a dati morti — il
  sintomo sarebbe una UI che continua a mostrare i vecchi numeri.
- La sessione sopravvive al ripristino, **tranne** quando l'utente loggato è
  stato creato durante la sessione: dopo il reset quell'account non esiste più,
  e restare "dentro" con un'identità inesistente è peggio che essere rimandati
  al login. In quel caso `ripristinaDemo()` restituisce `sessioneChiusa: true` e
  il toast lo spiega.
### Flussi verificati
- Aumento posti → applicato senza conferma (nessuna regressione sul percorso
  non distruttivo)
- Riduzione 158 → 150: conferma con 8 stalli e 87 prenotazioni; Annulla non
  tocca nulla; Conferma rimuove esattamente gli stalli previsti, toast coerente,
  zero prenotazioni orfane, mappa e KPI a 150
- Ripristino: fingerprint identico al seed, sessione Admin conservata, utenti
  creati in sessione rimossi, UI ridisegnata senza reload
- Ripristino da account creato in sessione → sessione chiusa, rilogin OK

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

## VERIFICA DI REGRESSIONE — 18/08/2026 (dopo CODE-17B)

**TEST A 31 ✅ · TEST B 10 ✅ · TEST C 9 ✅ · TEST D 10 ✅ · TEST E 8 ✅**
— 68 controlli, 0 ❌, 0 errori in console.

Un ⚠️ intermedio (cella del dipendente non trovata nella griglia FM) era il
limite delle 14 righe della vista settimanale, non un difetto: ritrovata via
ricerca, la cella ha la classe `t-mattino` e il testo "A-01 · Mattino".

Nota sul test di CODE-17A "stub inerte": ora **fallisce di proposito**. Quel
check verificava che il ramo `turni` non filtrasse nulla, ed è esattamente ciò
che 17B rimuove. Il controllo che conta — baseline di `statoStallo()` in
modalità giornaliera, 468 combinazioni — resta a **0 differenze**.

---

## VERIFICA DI REGRESSIONE — 18/08/2026 (dopo CODE-17A)

Checklist completa in modalità `giornaliera` sul bundle rigenerato:
**52 ✅ · 0 ❌ · 0 ⚠️**, più 33 verifiche dei cinque punti.

Aggiunto un gruppo **PRECONDIZIONE**: modalità di default `giornaliera`,
3 turni presenti in config, e **nessuna occorrenza della parola "turno/turni"
in nessuna delle 10 sezioni FM né nelle 4 tab di Config** — la prova che il
blocco è davvero sola infrastruttura.

Un ❌ era un artefatto del test: avevo attivato l'account con la password
`Demo1!` (6 caratteri) mentre la schermata richiede **almeno 8**. Con
`Demo12345!` l'attivazione riesce. La validazione funzionava, l'input era
sbagliato.

> Lezione di metodo, aggiunta a N04: **la baseline di un confronto "prima/dopo"
> va presa prima di qualunque test che muti lo stato**. Al primo giro avevo
> messo il confronto di `statoStallo()` dopo una verifica che creava e
> annullava una prenotazione: `prenota()` sostituisce quella esistente per lo
> stesso giorno, quindi il confronto trovava differenze causate dal test stesso.

---

## VERIFICA DI REGRESSIONE — 18/08/2026 (dopo CODE-16)

Checklist completa sul bundle rigenerato: **49 ✅ · 0 ❌ · 0 ⚠️**, più i 23
controlli dei TEST A/B/C. Zero errori in console.

Tre ❌ intermedi, tutti risolti prima di chiudere il blocco:

| ❌ | Natura | Esito |
|----|--------|-------|
| Motivazione del rifiuto assente nella card dipendente | **difetto reale** (`_collect()` mancante in `rifiuta-req`) | corretto |
| "Modale più corto" falso | **difetto reale mio**: avevo tolto 2 campi ma aggiunto 2 alert, quindi l'altezza non era scesa | ridotto a un alert + hint inline, e pinnati header/footer |
| Pulsante fuori viewport non misurabile | **ambiente**: il pannello di anteprima riportava `innerHeight = 0`, quindi `max-height:90vh` valeva `0px` | rimisurato a 1100×560: card 504px ≤ viewport, footer sempre visibile |

> Nota di metodo aggiunta a N04: **le misure geometriche vanno prese solo dopo
> aver verificato che `innerHeight > 0`**. Con viewport 0 ogni valore in `vh`
> collassa e i test riportano numeri privi di senso.

---

## VERIFICA DI REGRESSIONE — 18/08/2026 (dopo CODE-15)

Checklist completa sul bundle rigenerato: **60 ✅ · 0 ❌ · 0 ⚠️**, piu' 26
controlli specifici delle modifiche A–D e della nota di login.

Sette ❌ iniziali erano **artefatti dei test**, non regressioni. Riverificati in
isolamento: tutti ✅.

| ❌ apparente | Causa reale |
|-------------|-------------|
| Giorni fuori finestra senza `data-giorno-iso` | le card non prenotabili non espongono l'attributo perche' **non sono cliccabili**: corretto per design |
| "Non prenotabile" atteso su ieri | un giorno passato mostra "Passato"; "Non prenotabile" e' il futuro oltre la finestra |
| Slider Policy senza effetto | nodo **orfano** dopo il re-render: il secondo `value` veniva scritto su un input staccato (N04a) |
| Prenotazione sul giorno-limite "non sopravvive" | nel seed non esistono prenotazioni oltre la settimana corrente: assert impossibile, riscritto creandone una |
| "Richiedi Pass" visibile a un non abilitato | la sessione sta in `ui.utenteCorrenteId`, non `ui.utenteId` |
| Riga del sospeso assente in FM Prenotazioni | la griglia non e' una `<table>`: le righe sono `.bk-row`, non `tbody tr` |
| Cella ancora occupata dopo la sospensione | e' **lunedi' 17/08, ieri**: la specifica annulla solo `data >= oggi`, lo storico non si riscrive |
| Stallo del dipendente non evidenziato in mappa | la classe e' `.espot-mine` (non `.mspot`) e si accende solo con una prenotazione per il giorno selezionato: il test aveva appena cancellato quella di oggi |

---

## VERIFICA DI REGRESSIONE — 18/08/2026 (dopo CODE-14)

Checklist completa sul bundle rigenerato: **46 ✅ · 0 ❌ · 0 ⚠️**, più 11
controlli specifici del blocco (riduzione posti e ripristino) e 5 sul flusso
Amministrazione.

Quattro ❌ iniziali erano tutti **artefatti del test**, non regressioni:

| ❌ apparente | Causa reale |
|-------------|-------------|
| Tabella utenti piattaforma vuota | un check precedente aveva lasciato la tab Amministrazione su *Parcheggi*, che non ha tabella |
| "+ Aggiungi" non trovato | stessa causa: il pulsante vive nella tab *Utenti* |
| "Simula attivazione" non trovato | `data-act` reale `simula-attivazione-utente`, non `simula-attivazione` |
| Fingerprint dopo ripristino diverso | il baseline era stato preso a checklist **già eseguita** (157/315/…): il valore finale `156/312/2071/1400/127/22/2` è esattamente il seed |

Riverificati in isolamento: **tutti ✅**.

> Lezione aggiunta a N04: il form Modifica sede è dietro `toggle-edit-sede` e i
> suoi campi sono `#sede-nome` / `#sede-indirizzo` / `#sede-posti`, non
> `data-field`. E lo stato UI (tab attiva, sessione) **persiste fra i check**:
> un test che non lo reimposta misura la coda del test precedente.

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

Nessun bug funzionale aperto (N05 risolto in CODE-14, N06 in CODE-10). Elementi da tenere presenti:

| # | Tipo | Descrizione |
|---|------|-------------|
| N01 | Debito lessicale | In `state.js` le zone A/B/C hanno `colore: 'gold'`, residuo della palette precedente. È mappato a `var(--blue)` e **non produce alcun oro a schermo**. Rinominarlo richiede di toccare `dashboard.js → coloreBarra()`, dove il valore fa cadere la mini-mappa sul colore a semaforo. |
| N02 | Limite noto | La demo è in-memory: ogni reload riparte dal seed. Nessuna persistenza (voluto). |
| N03 | Limite noto | `dist/parking_cloud_demo.html` dipende da Google Fonts per Nunito. Offline usa il fallback Trebuchet MS. |
| N04 | Trappola nei test | (a) I nodi DOM raccolti prima di una mutazione diventano orfani: ri-cerca l'elemento a ogni iterazione. (b) Il server locale puo' servire JS **in cache** dopo una modifica: verifica con `fetch(url,{cache:'no-store'})` o rigenera il bundle. (c) `location.reload()` non ricarica lo snapshot `data:` del bundle: lo stato JS sopravvive fra i test. (d) Lo stato UI (tab attiva, sessione, filtri) **persiste fra un check e il successivo**: reimpostalo, o misuri la coda del test precedente. Non tutti i form usano `data-field` — Modifica sede usa id (`#sede-posti`) ed è dietro `toggle-edit-sede`. (e) Prima di misurare geometrie o hit-testing verifica `innerHeight > 0`: nel pannello di anteprima puo' essere 0, e allora ogni `vh` collassa. (f) La baseline di un confronto prima/dopo va presa PRIMA di ogni test che muti lo stato: un test che crea e annulla una prenotazione altera cio' che il confronto successivo misura. (g) Non tutto cio' che sembra una tabella lo e': la griglia FM Prenotazioni usa `.bk-row`, la mappa dipendente `.espot` (non `.mspot`), e le card giorno non prenotabili non hanno `data-giorno-iso` perche' non sono cliccabili. |
| ~~N05~~ | ✅ Risolto in CODE-14 | "Numero posti" in Modifica sede crea/rimuove stalli reali. Ora la riduzione passa da un modale di conferma con l'anteprima esatta di stalli e prenotazioni impattati, ed è reversibile con "Ripristina dati demo". |
