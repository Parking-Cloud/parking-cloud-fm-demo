# TEST_FLOWS.md — mappa dei flussi critici

Da leggere prima di ogni modifica, per capire **cosa si rompe se tocchi cosa**.

---

## Regola che spiega metà dei flussi

`Selectors.statoStallo()` deriva lo stato di uno stallo da **tre** collezioni:

```
accessi (uscita === null)  →  prenotazioni (attive)  →  visitatori (dentro/atteso)
```

Chi modifica una di queste senza allineare le altre lascia lo stallo in uno
stato incoerente. È l'origine di CODE-03.

---

## Indice rapido — cosa tocca cosa

| Se modifichi… | Rileggi obbligatoriamente |
|---------------|---------------------------|
| `prenotazioni` | `statoStallo`, `kpiStalli`, `kpiPrenotazioni`, `occupazionePerZona`, `righeSettimanaFM`, F01–F03, F11 |
| `accessi` | `statoStallo`, `kpiAccessi`, `accessiFiltrati`, `badges`, F02, F04 |
| `stalli` | `statoStallo`, `kpiStalli`, `occupazionePerZona`, `assegnaStalloConMotivo`, F05–F07 |
| `segnalazioni` | `kpiSegnalazioni`, `segnalazioniAttive`, `badges`, F04 |
| `dipendenti` | `kpiDipendenti`, `dipendentiFiltrati`, `trovaAccountPerEmail`, F10 |
| `config.prenotazioni` | `finestraPrenotazione`, `ultimaDataPrenotabile`, `dataPrenotabile`, `settimanaHaGiorniPrenotabili`, `giorniAnticipo`, F11, F17 |
| `puoRichiederePass` | topbar `employee/index.js`, colonna Pass vis. in `fm/dipendenti.js`, toggle in `dip-det`, F18 |
| `richiestePass` (struttura) | `emp-richiedi-pass`, `req-pass`, `creaRichiestaPass`, `approvaRichiestaPass`, `rifiutaRichiestaPass`, sezione "Le mie richieste", F20 |
| `visitatori.dataFine` | `statoStallo` (range), `creaPassVisitatore` (scelta stallo), F20 |
| `config.modalitaPrenotazione` / `config.turni` | `turnoCorrente`, `turnoCompatibile`, `statoStallo`, `kpiPerTurno`, `cambioTurnoInCorso`, `prenotaTurno`, e le sezioni Mappa / Dashboard / Prenotazioni / Config / `emp-book`. **Ogni ramo nuovo va scritto sotto `if (modalitaPrenotazione === 'turni')`: la modalita' giornaliera non deve cambiare mai** — F22, F23 |
| `ui.demoScenario` | `attivaDemoOspedale`, `ripristinaDemoUffici`, toggle in Amministrazione. Sostituisce l'intero dataset in place — F24 |
| `prenotazioni.turnoId` | quattro punti di creazione: `buildPrenotazioni` (x3), `applicaPatternEvidenza`, `prenota()`. Chi aggiunge un campo alla prenotazione deve toccarli tutti |
| stato di un dipendente (`sospendiDipendente`) | `annullaPrenotazione`, `statoStallo`, `righeSettimanaFM`, `kpiDipendenti`, F19 |
| `utentiPiattaforma` | `trovaAccountPerEmail`, `utenteCorrente`, `facilityManager`, F12 |
| `PERMISSIONS` | sidebar e tab in `index.html`, `Sezioni.*`, F12 |
| identita' sessione | `dipendenteCorrente()` in tutte le viste `emp-*` — mai `utenteDemo()`, F15, F16 |
| `config.periodo` | `kpiAccessi`, `kpiVisitatori`, `kpiPrenotazioni`, `kpiSegnalazioni`, `accessiFiltrati`, `badges` (deve restare su OGGI), F14 |

---

## F01 — Prenotazione stallo (dipendente)

- **Sorgente:** `employee/index.js` → `emp-conferma`
- **Actions:** `prenota()`
- **Selectors:** `assegnaStalloConMotivo()`, `motivoPerStallo()`, `stalloPrenotabile()`, `prenotazione()`, `motivoAssegnazione()`
- **Attenzione:** il motivo mostrato nel modale va sempre **dedotto dallo stallo
  effettivo** con `motivoPerStallo()`, mai dato per scontato. Le regole di
  priorita' vivono solo in `state.js`: duplicarle nel modale le fa divergere.
- **Sezioni FM impattate:** Prenotazioni, Mappa, Dashboard (KPI), Analytics
- **Modali:** `emp-book`
- **Da sapere:** `prenota()` annulla in silenzio un'eventuale prenotazione
  preesistente dello stesso giorno. Se non trova stalli restituisce
  `{errore}` — il chiamante deve gestirlo.
- **Verifica:** giorno diventa blu · cella FM mostra il codice · toast con email

## F02 — Cancellazione prenotazione (dipendente) ⚠️ flusso più fragile

- **Sorgente:** `employee/index.js` → `emp-cancella`
- **Actions:** `annullaPrenotazione()`
- **Selectors:** `prenotazione()`, `statoStallo()`, `kpiStalli()`
- **Sezioni FM impattate:** Mappa, Prenotazioni, Accessi, Dashboard
- **Modali:** `emp-cancel`
- **Da sapere:** deve chiudere **anche l'accesso aperto**, altrimenti lo stallo
  resta rosso in mappa (bug CODE-03). Il match è in OR fra `prenotazioneId` e
  `stallo + persona`; gli accessi `abusivo` non vanno chiusi.
- **Verifica:** stallo `Libero` · accesso con `uscita` valorizzata · tile
  `ms-free` in mappa FM · giorno verde nel calendario

## F03 — Smart Working (dipendente)

- **Sorgente:** `employee/index.js` → `emp-conferma` con `tipo='sw'`
- **Actions:** `dichiaraSmartWorking()` → `prenota()` → `annullaPrenotazione()`
- **Selectors:** `prenotazione()`, `statoStallo()`
- **Sezioni FM impattate:** Prenotazioni (cella `SW`), Mappa, Analytics
- **Modali:** `emp-book`
- **Da sapere:** passa da `annullaPrenotazione()`, quindi eredita la logica di
  chiusura accesso di F02.
- **Verifica:** giorno ambra · stallo libero in mappa FM

## F04 — Gestione segnalazione (FM)

- **Sorgente:** `fm/segnalazioni.js`, `fm/dashboard.js` → `conferma-seg`
- **Actions:** `gestisciSegnalazione()`
- **Selectors:** `segnalazione()`, `segnalazioniAttive()`, `kpiSegnalazioni()`, `badges()`, `assegnaStalloAutomatico()`
- **Sezioni FM impattate:** Segnalazioni, Dashboard, sidebar (badge), Accessi, Mappa
- **Modali:** `seg`
- **Da sapere:** `blocca_veicolo` chiude l'accesso abusivo → lo stallo cambia da
  `violazione` a `prenotato`. `assegna_alternativo` sposta la prenotazione del
  segnalante su un altro stallo.
- **Verifica:** sparisce dalle attive · badge sidebar decrementato · KPI Dashboard

## F05 — Modifica stallo singolo (FM)

- **Sorgente:** `fm/mappa.js` → `salva-stallo`
- **Actions:** `aggiornaStallo()`
- **Selectors:** `stallo()`, `statoStallo()`, `kpiStalli()`, `zona()`
- **Sezioni FM impattate:** Mappa, Dashboard, Analytics, Config (tipologie)
- **Modali:** `stallo-det`
- **Da sapere:** mettere in manutenzione o bloccare riassegna le prenotazioni
  future; cambiare titolare aggiorna la relazione bidirezionale con il dipendente.
- **Verifica:** tile cambia classe · KPI ricalcolati

## F06 — Modifica batch stalli (FM)

- **Sorgente:** `fm/mappa.js` → `applica-bulk`
- **Actions:** `aggiornaStalliMultipli()`, `toggleSelezioneStallo()`, `pulisciSelezioneStalli()`
- **Selectors:** `statoStallo()`, `kpiStalli()`
- **Sezioni FM impattate:** Mappa, Dashboard
- **Modali:** nessuno (barra inline)
- **Da sapere:** itera su `aggiornaStallo()`, quindi eredita tutti i suoi effetti
  collaterali su ciascuno stallo.
- **Verifica:** tutti gli stalli selezionati aggiornati · selezione azzerata

## F07 — Aggiunta stallo (FM)

- **Sorgente:** `fm/mappa.js` → `crea-stallo`
- **Actions:** `aggiungiStallo()`
- **Selectors:** `prossimoCodiceStallo()`, `zona()`, `kpiStalli()`
- **Sezioni FM impattate:** Mappa, Dashboard, Config (conteggio zone), Amministrazione
- **Modali:** `add-stallo`
- **Verifica:** codice auto-generato · tile presente in mappa · totale +1

## F08 — Creazione pass visitatore (FM)

- **Sorgente:** `fm/visitatori.js` → `crea-visitatore`
- **Actions:** `creaPassVisitatore()`, `revocaPass()`, `estendiPass()`, `mutaVisitatore()`
- **Selectors:** `visitatore()`, `kpiVisitatori()`, `statoStallo()`, `facilityManager()`
- **Sezioni FM impattate:** Visitatori, Mappa (zona V), Dashboard
- **Modali:** `add-vis`, `vis-det`
- **Da sapere:** assegna automaticamente il primo stallo libero di zona V; un
  visitatore `atteso` **occupa già** lo stallo in `statoStallo()`.
- **Verifica:** pass in lista · stallo V riservato · codice My2N nel toast

## F09 — Richiesta pass da dipendente → approvazione FM

- **Sorgente:** `fm/config.js` → `approva-req` / `rifiuta-req`
- **Actions:** `approvaRichiestaPass()` → `creaPassVisitatore()`, `rifiutaRichiestaPass()`
- **Selectors:** `badges()` (badge Dipendenti), `nomePersona()`
- **Sezioni FM impattate:** Dipendenti (banner), Visitatori, sidebar
- **Modali:** `req-pass`
- **Verifica:** richiesta evasa · pass in Visitatori · badge Dipendenti a zero

## F10 — Aggiunta dipendente → attivazione account

- **Sorgente:** `fm/dipendenti.js` → `crea-dip`, `simula-attivazione-dip`, `conferma-import`
- **Actions:** `aggiungiDipendente()`, `importaDipendenti()`, `avviaAttivazione()`, `completaAttivazione()`, `reinviaInvito()`
- **Selectors:** `kpiDipendenti()`, `dipendentiFiltrati()`, `trovaAccountPerEmail()`
- **Sezioni FM impattate:** Dipendenti, Amministrazione (nessuna: i dipendenti non sono utenti di piattaforma)
- **Modali:** `add-user`, `dip-creato`, `import-dipendenti`
- **Da sapere:** i dipendenti hanno **due** campi di stato: `stato`
  (attivo/bloccato = accesso al parcheggio) e `statoAccount`
  (attivo/invito_inviato/invito_da_inviare = accesso all'app). Non confonderli:
  i KPI "Bloccati" leggono `stato`, la colonna Stato mostra prima `statoAccount`.
- **Verifica:** dipendente in lista · "Simula attivazione" → `view-activate` →
  vista Dipendente

## F11 — Modifica policy config → effetto su vista dipendente

- **Sorgente:** `fm/config.js` → `slider-settimane`, `salva-policy`
- **Actions:** `setPolicy()`
- **Selectors:** `finestraPrenotazione()`, `ultimaDataPrenotabile()`, `dataPrenotabile()`, `settimanaEmp()`, `settimanaHaGiorniPrenotabili()`
- **Sezioni FM impattate:** Config, Prenotazioni (alert finestra), Vista Dipendente
- **Modali:** `policy`
- **Da sapere:**
  - Il campo e' `finestraGiorniLavorativi` (5–20, default 10), **non**
    `maxBookingWeeks`: quello non esiste piu'.
  - Restringere la finestra **annulla** le prenotazioni fuori finestra e
    riporta `empWeekOffset` sull'ultima settimana ancora utile.
  - Il nodo dello slider diventa orfano dopo `setPolicy()`: in un test va
    ri-cercato a ogni passo (N04a).
- **Verifica:** chip dipendente aggiornato · "Succ ›" abilitato/disabilitato di
  conseguenza · nessuna prenotazione attiva oltre il limite

## F17 — Finestra di prenotazione a giorni lavorativi (CODE-15)

- **Sorgente:** `state.js` (`giorniLavorativi`, `isLavorativo`), `employee/index.js`
- **Selectors:** `finestraPrenotazione()`, `dataPrenotabile()`, `ultimaDataPrenotabile()`, `giorniAnticipo()`, `settimanaHaGiorniPrenotabili()`
- **Sezioni FM impattate:** Prenotazioni (disclaimer), Config (slider)
- **Da sapere:**
  - `ultimaDataPrenotabile()` e' **inclusiva**. Il confronto giusto e' `<=`.
    Chi scrive `<` (o `>=` sul limite, come faceva `setPolicy`) taglia fuori
    l'ultimo giorno utile.
  - `giorniLavorativi(da, n)` prende la data di partenza come parametro: e'
    l'unico modo di testare "oggi = lunedi'" senza toccare l'orologio.
  - Un giorno **passato** mostra "Passato"; un giorno **futuro fuori finestra**
    mostra "Non prenotabile". Sono due stati diversi con la stessa classe
    `day-past`.
  - Le card non prenotabili non hanno `data-giorno-iso`: non sono cliccabili.
    In un test vanno allineate per indice a `settimanaEmp()`.
- **Verifica:** partenza lunedi' → ultimo utile venerdi' della settimana
  successiva · nessun sabato/domenica in finestra · "Succ ›" si disabilita
  sulla prima settimana senza giorni prenotabili

## F18 — Richiesta pass visitatore inoltrata dal dipendente (CODE-15)

- **Sorgente:** `employee/index.js` → `emp-invia-richiesta-pass`
- **Actions:** `creaRichiestaPass()`, `togglePuoRichiederePass()`
- **Selectors:** `dipendenteCorrente()`, `badges()` (badge Dipendenti)
- **Sezioni FM impattate:** Dipendenti (banner + colonna Pass vis.), Visitatori
- **Modali:** `emp-richiedi-pass`, `dip-det`, `req-pass`
- **Da sapere:**
  - Il pulsante in topbar e' reso **solo** se `puoRichiederePass === true`, ma
    l'handler ricontrolla il flag: l'azione resta raggiungibile da console.
  - Nel seed sono abilitati **3** dipendenti: Matteo Bruni (l'account demo,
    senza il quale la feature non si vedrebbe entrando come dipendente), Laura
    Conti (ha gia' una richiesta pendente nel seed) e Sara Bellotti.
  - Il toggle in tabella e' agganciato con `UI.onChange` e non `UI.on`: il
    `data-act` sta sulla `<label>`, e intercettando il `click` partirebbe anche
    l'apertura del modale della riga.
  - La richiesta nasce sempre `in_attesa`: sbocca in F09 per l'approvazione.
- **Verifica:** pulsante assente per un non abilitato · nome ed email
  obbligatori · richiesta nel banner FM e in `req-pass` · badge Dipendenti +1

## F19 — Sospensione dipendente (CODE-15)

- **Sorgente:** `fm/dipendenti.js` → `sospendi-dip`
- **Actions:** `sospendiDipendente()` → `annullaPrenotazione()`
- **Selectors:** `statoStallo()`, `righeSettimanaFM()`, `kpiDipendenti()`
- **Sezioni FM impattate:** Dipendenti, Prenotazioni, Mappa, Dashboard
- **Modali:** `dip-det`
- **Da sapere:**
  - Ritorna `{ dipendente, annullate }`, non il dipendente: il conteggio serve
    al toast e non ha senso conservarlo sull'anagrafica.
  - Le prenotazioni future passano da `annullaPrenotazione()`, che chiude anche
    l'accesso rimasto aperto. Con un assegnamento diretto `p.stato =
    'annullata'` lo stallo di oggi resterebbe rosso in mappa (bug CODE-03).
  - Annulla **solo** `data >= oggi`: le celle dei giorni passati restano piene,
    ed e' corretto — lo storico non si riscrive.
- **Verifica:** toast con il conteggio esatto (o "nessuna prenotazione futura")
  · celle vuote da oggi in poi nella griglia FM · stalli `ms-free` in mappa ·
  zero accessi aperti residui

## F20 — Richiesta pass dipendente → approvazione FM → notifica e codice (CODE-16)

- **Sorgente:** `employee/index.js` (`emp-invia-richiesta-pass`, `sezioneRichieste`), `fm/config.js` (`approva-req` / `rifiuta-req`)
- **Actions:** `creaRichiestaPass()`, `approvaRichiestaPass()` → `creaPassVisitatore()`, `rifiutaRichiestaPass()`, `segnaRichiestePassLette()`, `setEmpRichiesteTab()`
- **Selectors:** `richiestePassDipendente()`, `segnalazioniDipendente()`, `notifichePassNonLette()`, `badges()`
- **Sezioni FM impattate:** Dipendenti (banner + badge), Visitatori
- **Modali:** `emp-richiedi-pass`, `req-pass`
- **Da sapere:**
  - La richiesta ha **`dataInizio` / `dataFine`, non orari**: il pass approvato
    vale H24 su tutto il range. Chi cerca `r.oraInizio` non trova piu' nulla.
  - L'esito va scritto **sulla richiesta**, non solo sul visitatore: il
    dipendente vede la richiesta, non l'anagrafica visitatori. `codiceMy2N`
    esiste quindi in due posti e deve coincidere.
  - **`visto: false`** alla decisione del FM, `true` quando il dipendente apre
    la tab Pass. E' l'unico stato che governa il badge nell'hero. Il campo si
    chiamava `letta` fino a CODE-16 rev.
  - L'approvazione riscrive `dataInizio`/`dataFine` **dal pass creato**: la
    richiesta deve dire cio' che e' stato concesso, non cio' che era stato
    chiesto.
  - La sezione "Le mie richieste" ha **3 tab in modalita' turni** e **2 in
    giornaliera**: la Lista Attesa (F25) non esiste senza turni.
  - `rifiuta-req` **deve** chiamare `Modals._collect()` prima di leggere
    `Modals.form.note`, altrimenti la motivazione si perde in silenzio.
  - Su un pass multi-giorno lo stallo V va scelto libero su **tutti** i giorni,
    e la sovrapposizione fra pass va controllata a mano: `statoStallo()` valuta
    i visitatori solo per oggi e sulle date future non vedrebbe l'altro pass.
- **Verifica:** invio → banner FM e badge Dipendenti · approvazione → codice
  identico su richiesta e visitatore, pass `00:00–23:59`, badge verde in hero,
  codice visibile in "Le mie richieste" · rifiuto → nessun pass, badge rosso,
  motivo visibile · apertura tab → badge azzerato

## F21 — Altezza dei modali (CODE-16)

- **Sorgente:** `styles.css` (`.modal`, `.modal-body`, `.modal-hd`, `.modal-footer`)
- **Da sapere:**
  - `.modal` e' una **colonna flex** con `overflow:hidden`; scorre solo
    `.modal-body`. Header e footer sono `flex:0 0 auto` e restano sempre
    visibili. Rimettere `overflow-y:auto` sull'intero `.modal` fa sparire il
    pulsante di conferma sotto il bordo schermo su finestre basse.
  - Vale per tutti i modali: aggiungere campi a un modale gia' lungo non lo
    rende piu' irraggiungibile, lo rende solo piu' scorrevole.
  - **Nei test:** verifica `innerHeight > 0` prima di misurare. Nel pannello di
    anteprima puo' essere 0, e allora `max-height:90vh` vale `0px` e ogni
    misura e' priva di senso.
- **Verifica:** con viewport basso, header e footer dentro lo schermo, corpo
  scrollabile, e un modale corto (es. `emp-profile`) che NON scrolla

## F22 — Modalita' a turni: mappa, KPI, capacita' (CODE-17B)

- **Sorgente:** `fm/mappa.js`, `fm/dashboard.js`, `fm/prenotazioni.js`, `fm/config.js`
- **Selectors:** `turnoAttivoMappa()`, `kpiPerTurno()`, `statoStallo(id, data, turnoId)`, `cambioTurnoInCorso()`
- **Actions:** `setModalitaPrenotazione()`, `setMappaTurno()`, `aggiungiTurno()`, `rimuoviTurno()`, `aggiornaTurno()`, `setTolleranzaCambioTurno()`
- **Da sapere:**
  - `statoStallo()` ha un **terzo parametro** `turnoId`. In giornaliera resta
    `undefined` e il comportamento e' quello storico. Chi aggiunge una chiamata
    in una vista per-turno deve passarlo, altrimenti legge il turno corrente.
  - Una prenotazione con `turnoId: null` e' **giornaliera** e occupa lo stallo
    in ogni turno. E' cio' che rende sicuro attivare i turni su dati vecchi.
  - Anche il ramo **accessi** di `statoStallo()` filtra per turno: un ingresso
    del mattino non deve tenere occupato lo stallo nella vista della notte.
  - `kpiStalli(data, turnoId)` e `occupazionePerZona(data, turnoId)` accettano
    il turno. **Chi disegna una vista per-turno deve passarlo**: senza, leggono
    il turno in corso e i numeri contraddicono le tile (era il caso del
    contatore di zona in Mappa, corretto in CODE-17 rev.).
  - `maxTurniPerStallo()` divide le 24h per il turno **piu' lungo**, non per la
    media: la capacita' e' limitata dal turno che occupa lo stallo piu' a lungo.
  - Il **giallo** (`ms-cambio`) non e' "siamo vicini a un confine": serve anche
    che lo stallo sia prenotato in entrambi i turni a cavallo. Senza quella
    condizione mezza mappa diventerebbe gialla due volte al giorno.
- **Verifica:** selettore turni presente solo in modalita' turni · KPI
  "Liberi turno X" · tabella capacita' coerente con `kpiPerTurno()` · legenda
  con "Cambio turno" · in giornaliera nessuno di questi elementi esiste

## F23 — Prenotazione per turno (dipendente) (CODE-17B)

- **Sorgente:** `modals.js → emp-book`, `employee/index.js` (`emp-sel-turno`, `emp-conferma`)
- **Selectors:** `stalliDisponibiliPer(dip, data, turnoId)`, `assegnaStalloConMotivo(dip, data, turnoId)`
- **Da sapere:**
  - L'ordine e' **turno prima, stallo dopo**: la disponibilita' dipende dal
    turno, quindi mostrare uno stallo prima della scelta sarebbe una bugia.
  - La conferma resta disabilitata finche' non c'e' un turno con almeno uno
    stallo libero; l'handler ricontrolla comunque il turno.
  - Il turno va propagato fino a `prenota()`: se si ferma prima, la
    prenotazione nasce con `turnoId: null` e occupa la giornata intera.
- **Verifica:** card con posti e stato Disponibile/Esaurito · stallo assegnato
  col motivo · nota tolleranza · calendario e griglia FM con `[stallo] · [turno]`

## F24 — Scenario demo Uffici / Ospedale (CODE-17B)

- **Sorgente:** `fm/amministrazione.js` → `set-scenario`
- **Actions:** `attivaDemoOspedale()`, `ripristinaDemoUffici()`, `_caricaScenario()`
- **Da sapere:**
  - I due scenari **coesistono in memoria** (`SCENARI.uffici` /
    `SCENARI.ospedale`): il toggle non rigenera, congela lo stato vivo nel
    proprio slot e carica l'altro. Il lavoro fatto in uno scenario si ritrova
    tornandoci.
  - Sostituisce **tutto** il dataset in place (stessa regola di
    `ripristinaDemo()`): `AppState` non va rimpiazzato.
  - `buildSeedOspedale()` **non deve** chiamare `resetGeneratori()`: con i due
    dataset compresenti azzerare i contatori genera id duplicati fra scenari.
  - `utentiPiattaforma` e' **condiviso per riferimento**: duplicarlo fa cadere
    la sessione allo switch, perche' `S.utenteCorrente()` non trova piu' l'id.
  - `buildAccessiOspedale()` gira al **load del modulo**: non puo' usare `S.*`,
    che a quel punto non e' ancora inizializzato.
  - Lo scenario ospedale porta con se' `modalitaPrenotazione: 'turni'`: e' il
    modo piu' rapido di mostrare i turni senza configurare nulla a mano.
  - `buildAccessi()` **non** e' riusabile: genera tutti gli ingressi in fascia
    mattutina e le tre persone dello stallo vetrina risulterebbero dentro
    insieme. Serve `buildAccessiOspedale()`.
  - Il ritorno a "Uffici" deve lasciare **zero residui**: nessun dipendente con
    `ruolo` sanitario, nessuna prenotazione con `turnoId`.
- **Verifica:** sede, 20 vs 312 dipendenti, A-07 occupato nei 3 turni da 3
  persone diverse, e al ritorno 156/25/129 come da baseline

## F25 — Lista d'attesa su turno esaurito (CODE-17C)

- **Sorgente:** `modals.js → emp-book` e `lista-attesa`, `employee/index.js`, `fm/dashboard.js`
- **Actions:** `entraInListaAttesa()`, `assegnaStalloDaListaAttesa()` → `prenotaTurno()`
- **Selectors:** `listaAttesaPerTurno()`, `listaAttesaAperta()`, `listaAttesaDipendente()`
- **Da sapere:**
  - Esiste **solo in modalita' turni**. In giornaliera non deve comparire da
    nessuna parte: ne' card FM, ne' terza tab del dipendente.
  - **La card di un turno pieno deve restare cliccabile.** Renderla inerte
    (com'era in CODE-17B) rende la coda irraggiungibile: per arrivare alla
    proposta bisogna poter selezionare proprio il turno esaurito.
  - `assegnaStalloDaListaAttesa()` non duplica la logica di assegnazione: passa
    da `prenotaTurno()`. Se non c'e' nulla di libero la voce resta `in_attesa`.
  - Una sola voce per persona/turno/giorno.
  - `listaAttesa` fa parte del dataset di scenario: va salvata in
    `_salvaScenarioCorrente()` e ricaricata in `_caricaScenario()`, altrimenti
    lo switch la perde.
- **Verifica:** proposta con due pulsanti · "No grazie" non crea voci ·
  posizione in coda nella TAB 3 · badge FM "Lista attesa: N" · assegnazione che
  crea la prenotazione col turno giusto e aggiorna la voce a `assegnato`

## F26 — Metodo di accesso ereditato dalla zona (CODE-18)

- **Sorgente:** `state.js` (`ZONE_SEED`, `metodoAccessoPerStallo`), `fm/config.js`, `modals.js -> dip-det`, `fm/dipendenti.js`
- **Selectors:** `metodoAccessoPerStallo()`, `metodoAccessoPerDipendente()`, `origineMetodoAccesso()`
- **Actions:** `setMetodoZona(zonaId, metodo)`
- **Da sapere:**
  - Il dipendente **non ha piu'** il campo `metodoAccesso`. Chi lo cerca su
    `d.metodoAccesso` trova `undefined`: si passa dai selectors.
  - Pool rotante -> `app`: senza stallo fisso non c'e' una zona da cui ereditare.
  - Nel seed serve l'helper locale `metodoZona()`: i builder girano prima che
    `Selectors` esista (stessa trappola di `buildAccessiOspedale`).
  - Nella tabella dipendenti lo stato `bloccato` vince sul metodo: mostrare
    "PIN Keypad" a chi non puo' entrare sarebbe fuorviante.
  - Il "Metodo" nel log accessi e negli export e' **derivato dalla zona**, non
    quello storicamente registrato: cambiando il varco cambia la lettura dello
    storico. E' voluto, ma va saputo.
- **Verifica:** cambio metodo di una zona -> log accessi, dip-det e tabella
  dipendenti seguono tutti; ripristino -> tutto torna

## F27 — Export multi-formato (CODE-18)

- **Sorgente:** `modals.js -> export`, `fm/config.js -> genera-export`, `ui.js -> toXLSX`
- **Selectors:** `esportaAccessi()`, `esportaDipendenti()`, `esportaSegnalazioni()`, `esportaVisitatori()`, `esportaCompleto()`
- **Da sapere:**
  - Nel dropdown ci sono **solo** i formati che producono un file: CSV, Excel,
    JSON. Il PDF richiede un backend e non va rimesso senza.
  - **SheetJS e' remoto**: offline `UI.toXLSX()` ritorna `null` e il chiamante
    deve avvisare, non fallire in silenzio.
  - Il CSV e' un file solo: piu' sezioni si concatenano con `### Nome`,
    altrimenti colonne diverse si sovrapporrebbero.
  - `build.py` ignora le URL assolute nel controllo dei riferimenti esterni.
- **Verifica:** tutte e 12 le combinazioni tipo x formato scaricano; Excel del
  Report Completo con 4 fogli; CSV con `;` e BOM

## F28 — Paginazione e filtro condiviso in Prenotazioni (CODE-18)

- **Sorgente:** `fm/prenotazioni.js`, `state.js` (`righeSettimanaFM`, `setFiltroDipendenti`, `setPaginaPrenotazioni`)
- **Da sapere:**
  - `righeSettimanaFM()` **non restituisce piu' un array** ma
    `{ righe, pagina, pagine, totale, da, a }`. Chi lo usa come array rompe.
  - Il filtro dipendente e' **uno solo** (`ui.filtri.dipendenti.q`), condiviso
    fra Dipendenti e Prenotazioni: `setFiltroDipendenti()` emette entrambe le
    sezioni.
  - Cambiare filtro **azzera la pagina**: senza, si resta su una pagina che
    dopo il filtro non esiste piu'.
  - Pagina e settimana sono indipendenti: nessuna delle due azzera l'altra, e
    la pagina sopravvive al cambio sezione.
- **Verifica:** 20 righe/pagina su 312; pagina 2 dopo cambio settimana; filtro
  in una sezione visibile nell'altra; chip di reset

## F12 — Login Admin → accesso Amministrazione

- **Sorgente:** `index.html` (router), `fm/amministrazione.js`
- **Actions:** `loginConEmail()`, `entraCome()`, `creaUtentePiattaforma()`, `cambiaRuoloUtente()`, `toggleAttivoUtente()`, `avviaAttivazione()`
- **Selectors:** `trovaAccountPerEmail()`, `utenteCorrente()`, `puo()`, `permessi()`, `etichettaRuolo()`
- **Sezioni FM impattate:** tutte (la sidebar è filtrata dai permessi), Amministrazione, Config tab Utenti
- **Modali:** `add-platform-user`, `platform-user-det`
- **Da sapere:** gli id degli utenti di piattaforma passano da `nextId('USR')`
  **anche nel seed**. Assegnarli a mano farebbe ripartire il contatore da
  `USR-0001` e il primo utente creato collideva con l'Admin (bug già occorso).
- **Verifica:** badge Admin · voce Amministrazione presente solo per Admin ·
  nuovo FM con "Invito inviato" · attivazione → accede come FM

## F15 — Identita' della sessione nella Vista Dipendente (CODE-13)

- **Sorgente:** `employee/index.js`, `modals.js` (tutti i modali `emp-*`)
- **Selectors:** `dipendenteCorrente()` — **mai** `utenteDemo()`
- **Actions:** `prenota()`, `annullaPrenotazione()`, `creaSegnalazione()`
- **Sezioni FM impattate:** Prenotazioni, Segnalazioni, Mappa (i dati scritti
  dal dipendente compaiono li')
- **Modali:** `emp-book`, `emp-cancel`, `emp-segnala`, `emp-profile`, `emp-history`
- **Da sapere:** `utenteDemo()` e' il dipendente del **seed**, non l'utente
  autenticato. Usarlo nelle viste fa scrivere prenotazioni e segnalazioni a
  nome di DIP-0001. Il difetto e' invisibile se si prova solo con
  `dipendente@demo.parkingcloud.eu`, perche' li' i due coincidono.
- **Verifica:** attivare un nuovo dipendente e controllare che hero, avatar,
  dipartimento, `prenotazione.dipendenteId` e `segnalazione.segnalanteId`
  siano **suoi**. Un test che usa il login demo non e' discriminante.

## F16 — Vista Dipendente e utenti di piattaforma (CODE-13)

- **Sorgente:** `index.html` (router), `employee/index.js` → `vistaNonDisponibile()`
- **Selectors:** `dipendenteCorrente()` (null per Admin/FM), `utenteCorrente()`
- **Da sapere:**
  - `entraCome()` imposta `vista='dipendente'` solo se il ruolo e' `dipendente`:
    un Admin non raggiunge la vista per costruzione.
  - `PERMISSIONS.admin.vistaDipendente` e' `false`.
  - I selectors del dipendente **non lanciano eccezioni** con un id di
    piattaforma, ma restituiscono valori privi di senso
    (`stalliDisponibiliPer('USR-0001')` → 7 stalli). Non fidarsi del fatto che
    "non crasha": serve la guardia esplicita.
- **Verifica:** forzare `ui.vista='dipendente'` con un FM loggato → nessuna
  eccezione, schermata neutra, zero `.emp-day`, via di uscita presente

## F14 — Selettore periodo (aggiunto in CODE-10)

- **Sorgente:** `index.html` (topbar), `modals.js` → `daterange`
- **Actions:** `setPeriodo()`, `setPeriodoManuale()`
- **Selectors:** `normalizzaPeriodo()`, `giorniConDati()`, `media()`,
  `kpiAccessi()`, `kpiVisitatori()`, `kpiPrenotazioni()`, `kpiSegnalazioni()`,
  `accessiFiltrati()`
- **Sezioni FM impattate:** Accessi, Visitatori, Segnalazioni, Dashboard (avviso)
- **Modali:** `daterange`, `export`
- **Da sapere:**
  - `badges()` chiama i KPI passando **esplicitamente `OGGI_ISO`**. Se qualcuno
    lo togliesse, cambiare periodo altererebbe i badge in sidebar.
  - Grandezze puntuali che NON devono mai seguire il periodo: `presenti`,
    `liberi`, `attivi`, `anomalie` (badge), dispositivi online.
  - Mappa, Prenotazioni e Analytics ignorano di proposito il periodo topbar.
  - Il divisore delle medie è *giorni con dati*: contare i giorni di calendario
    darebbe medie falsate da weekend e giorni futuri.
- **Verifica:** Oggi → Settimana → Mese cambia ingressi/visitatori/log; badge,
  Presenti Ora e Stalli liberi restano fissi; tornando a "Oggi" i valori
  coincidono con quelli di partenza

## F13 — Analytics (aggiunto in CODE-09)

- **Sorgente:** `fm/analytics.js`
- **Actions:** `setAnalyticsPeriodo()`
- **Selectors:** `occupazionePerZona()`, `stallo()`; il resto è calcolato in loco
- **Sezioni FM impattate:** nessuna (sola lettura)
- **Modali:** nessuno
- **Da sapere:** conta `stato !== 'annullata'`, non `=== 'attiva'`, per includere
  lo storico `completata`. Il periodo precedente è derivato da un PRNG separato
  (seed `20260818`).
- **Verifica:** Settimana ≠ Mese su KPI, numero barre ed etichette
