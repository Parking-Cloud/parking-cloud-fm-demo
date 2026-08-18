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
| `config.prenotazioni` | `ultimaDataPrenotabile`, `dataPrenotabile`, F11 |
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
- **Selectors:** `ultimaDataPrenotabile()`, `dataPrenotabile()`, `settimanaEmp()`
- **Sezioni FM impattate:** Config, Prenotazioni (alert finestra), Vista Dipendente
- **Modali:** `policy`
- **Da sapere:** restringere la finestra **annulla** le prenotazioni fuori
  finestra e ricalcola `empWeekOffset`.
- **Verifica:** chip dipendente aggiornato · "Succ ›" abilitato/disabilitato di
  conseguenza

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
