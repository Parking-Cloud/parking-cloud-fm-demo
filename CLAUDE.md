# CLAUDE.md — metodo di lavoro obbligatorio

Ogni sessione futura inizia leggendo questo file, poi `CHANGELOG.md` e `TEST_FLOWS.md`.

---

## METODO DI LAVORO OBBLIGATORIO

Ogni modifica segue sempre questa sequenza. Non deviare mai.

### FASE 1 — LEGGI PRIMA DI TOCCARE

Prima di scrivere codice:

- Leggi i file coinvolti dalla modifica
- Leggi `CHANGELOG.md` (ultime modifiche)
- Leggi `TEST_FLOWS.md` (flussi impattati)
- Elenca in chat: cosa modifichi, quali flussi impatti, quale rischio di
  regressione vedi
- **Aspetta la conferma prima di procedere**

### FASE 2 — UN BLOCCO ALLA VOLTA

- Implementa UNA feature o UN fix per volta
- Dopo ogni blocco scrivi:
  `Blocco completato. File modificati: [lista]. Pronto per la verifica.`
- Non procedere finché non ricevi conferma

### FASE 3 — CHECKLIST REGRESSIONE

Dopo ogni blocco, esegui e riporta i risultati con ✅ ❌ ⚠️.

> **Come eseguirla.** La demo si serve con
> `python -m http.server 8777 --directory src`. La checklist si esegue nel
> browser: ogni elemento interattivo espone `data-act`, quindi è pilotabile via
> `document.querySelector('[data-act="..."]').click()`. Lo stato è ispezionabile
> da `window.PC` (`PC.State`, `PC.Selectors`, `PC.Actions`, `PC.Modals`).
>
> ⚠️ **Esegui la checklist FINALE sul bundle**, non sul server sorgente:
> `python build.py` e apri `dist/parking_cloud_demo.html`. Il server locale
> serve JS dalla cache e produce ❌ fantasma su codice gia' corretto (successo
> due volte: CODE-04 e CODE-12). Per un controllo rapido durante lo sviluppo il
> server va bene, ma il verdetto si da' sul bundle.
>
> ⚠️ **Trappola nota nei test automatici:** ogni mutazione ridisegna la vista, e
> i nodi DOM raccolti prima diventano orfani. Ri-cerca l'elemento a ogni
> iterazione, altrimenti ottieni falsi ❌.

#### LOGIN E NAVIGAZIONE
- [ ] Login `admin@parkingcloud.eu` → console FM con badge Admin
- [ ] Login `manager@demo.parkingcloud.eu` → console FM senza Amministrazione
- [ ] Login `dipendente@demo.parkingcloud.eu` → vista Dipendente
- [ ] Tutte le voci sidebar cliccabili e caricano la sezione corretta
- [ ] Tab orizzontali sincronizzate con sidebar
- [ ] Logout → torna al login

#### DASHBOARD
- [ ] Mini-mappa per zona si carica con dati reali da AppState
- [ ] Click zona mini-mappa → naviga a Mappa Stalli
- [ ] KPI "Posti Totali" → naviga a Mappa
- [ ] KPI "Segnalazioni" → naviga a Segnalazioni
- [ ] Card segnalazioni aperte: btn "Gestisci" per ogni riga
- [ ] Click "Gestisci" → apre modal segnalazione corretto

#### MAPPA STALLI
- [ ] Tutti gli stalli colorati correttamente
- [ ] Click stallo → modal con dati di QUELLO stallo (non hardcoded)
- [ ] Salva modifica → mappa si aggiorna immediatamente
- [ ] Ctrl+Click → selezione multipla + barra bulk editing
- [ ] Applica bulk → aggiorna tutti gli stalli selezionati
- [ ] "+ Aggiungi Stallo" → modal, codice auto-generato, stallo in mappa

#### ACCESSI
- [ ] Tabella si carica
- [ ] "Filtra" apre pannello filtri
- [ ] Filtro tipo "Vis." → solo visitatori
- [ ] Azzera filtri → tutti i record
- [ ] Click riga → modal con dati di QUELLA riga

#### PRENOTAZIONI
- [ ] Griglia settimanale con settimana corrente
- [ ] "›" → settimana successiva, date aggiornate
- [ ] "‹" → settimana precedente
- [ ] "Oggi" → torna settimana corrente
- [ ] Click cella libera → modal con giorno preselezionato
- [ ] Crea prenotazione → appare nella griglia

#### SEGNALAZIONI
- [ ] KPI corretti
- [ ] Click "Gestisci" → modal
- [ ] Risolvi → segnalazione sparisce dalle attive
- [ ] Badge sidebar aggiornato dopo risoluzione
- [ ] Utenti bloccati in tabella, "Sblocca" funziona

#### DIPENDENTI
- [ ] Tabella si carica (max 40 righe)
- [ ] Ricerca per nome filtra davvero
- [ ] Azzera ricerca ripristina tutti
- [ ] Click riga → modal con dati di QUEL dipendente
- [ ] "+ Aggiungi Dipendente" → modal, crea, appare in lista
- [ ] "Importa Dipendenti" → modal, simula, 3 righe appaiono
- [ ] "Simula attivazione" → view-activate funzionante

#### VISITATORI
- [ ] Tabella oggi si carica
- [ ] Click riga → modal con dati di QUEL visitatore
- [ ] Revoca → visitatore aggiornato in lista
- [ ] Estendi → orario aggiornato
- [ ] "+ Nuovo Pass" → modal, crea, appare in lista

#### HARDWARE
- [ ] Tabella dispositivi si carica
- [ ] Click riga → modal con dati di QUEL dispositivo
- [ ] "Aggiorna firmware" → versione cambia nel dispositivo
- [ ] Toggle → stato aggiornato

#### POLICY & CONFIG
- [ ] Tutte le 4 tab (Parcheggio/Policy/Notifiche/Utenti) si caricano
- [ ] Slider finestra prenotazione → chip dipendente aggiornato
- [ ] Toggle notifica → stato aggiornato
- [ ] Zone: aggiungi → appare; rimuovi → sparisce e si aggiorna in mappa

#### AMMINISTRAZIONE (solo Admin)
- [ ] Visibile solo con login Admin
- [ ] Tabella utenti piattaforma si carica
- [ ] "+ Aggiungi" → modal, crea FM, appare con "Invito inviato"
- [ ] "Simula attivazione" → view-activate, accede come FM

#### VISTA DIPENDENTE
- [ ] Hero con stallo fisso e dipartimento corretti
- [ ] Chip finestra prenotazione riflette config FM
- [ ] Click giorno libero → prenota → giorno blu
- [ ] Smart Working → giorno ambra
- [ ] Cancella prenotazione → giorno verde E stallo libero in mappa FM
- [ ] "Succ ›" funziona se entro finestra; "Prec" disabilitato su settimana corrente
- [ ] "🚨 Segnala" → modal, invia, appare in FM Segnalazioni
- [ ] Logout → torna al login

#### COERENZA INTER-SEZIONE
- [ ] Dipendente prenota → visibile in FM Prenotazioni
- [ ] Dipendente SW → stallo libero in mappa FM
- [ ] FM gestisce segnalazione → badge sidebar aggiornato
- [ ] FM modifica stallo → mappa e KPI aggiornati
- [ ] Config `maxBookingWeeks=2` → dipendente vede 2 settimane

### FASE 4 — DOCUMENTA

Dopo ogni blocco verificato, aggiorna `CHANGELOG.md`:

```
## [data] — [nome blocco]
### Modificato
- file.js: descrizione
### Fix
- Descrizione bug risolto
### Flussi verificati
- [lista]
```

**DEPLOY: dopo ogni bundle rigenerato, eseguire
`git add . && git commit -m '[blocco]' && git push origin main`.
Netlify rideploya automaticamente.**

Da eseguire **sempre e senza attendere istruzioni esplicite**, come ultimo
passo di ogni blocco. Il messaggio di commit è il nome e numero del blocco
(es. `CODE-16: ...`).

> Perché funziona: `netlify.toml` pubblica la cartella `dist/`, che è
> versionata. Non c'è un build command remoto — Netlify serve il file che
> trova nel repo. **Se dimentichi `python build.py` prima del commit, il push
> va a buon fine ma online resta la versione precedente.** Rigenera sempre il
> bundle prima di committare.

---

## REGOLE INVIOLABILI

1. Mai implementare due blocchi senza verifica intermedia
2. Se trovi un ❌ su qualcosa che NON hai toccato: fermati, segnala il
   downgrade, risolvilo prima di procedere
3. Mai modificare le Actions di `state.js` senza rileggere i Selectors che
   dipendono dai dati modificati
4. Se non riesci a verificare un flusso, marcalo come **"non verificabile"** —
   non fingere che funzioni

---

## ARCHITETTURA — quello che serve sapere prima di toccare il codice

### Il principio che regge tutto

**Lo stato di uno stallo non è memorizzato: è derivato.** Sullo stallo si
salvano solo gli attributi (tipo, disponibilità, titolare, durata max, note).
Se sia libero, occupato o prenotato lo calcola `Selectors.statoStallo()`
leggendo prenotazioni + accessi + visitatori.

È questo che rende automatica la coerenza fra sezioni. Ed è anche la causa
della classe di bug più insidiosa del progetto: **se una action modifica le
prenotazioni ma dimentica gli accessi, la mappa continua a mostrare lo stallo
occupato** (è esattamente il bug corretto in CODE-03).

> Corollario operativo: ogni volta che tocchi `prenotazioni`, chiediti se devi
> toccare anche `accessi`. E viceversa.

### Flusso di ogni interazione

```
click → data-act → Actions.*  →  Store.emit()  →  render() della vista attiva
```

- Le **Actions** sono le uniche funzioni che scrivono e mantengono gli invarianti
- Nessuna sezione tocca il DOM di un'altra sezione
- I modali sono definizioni che ricevono l'id di ciò che hai cliccato e leggono
  da `AppState` all'apertura: è strutturalmente impossibile che mostrino
  l'entità sbagliata

### File e responsabilità

| File | Responsabilità |
|------|----------------|
| `src/state.js` | AppState, Selectors, Actions, Store. **Unica fonte di verità** |
| `src/ui.js` | Componenti riutilizzabili + event delegation |
| `src/modals.js` | Registro dei 25 modali |
| `src/index.html` | Shell, routing, sidebar/topbar, view-activate |
| `src/fm/*.js` | Una sezione FM per file |
| `src/employee/index.js` | Vista Dipendente |
| `src/styles.css` | Design system (brand ufficiale) |

### Vincoli da non violare

- **Determinismo del seed.** I dati demo nascono da un PRNG con seed fisso
  (`20260817`). Non usare `Math.random()` nella generazione: i numeri
  cambierebbero a ogni reload, davanti al cliente.
- **Nessun riferimento cliente.** Sede, nomi e domini sono generici.
- **Palette solo da token.** I colori vivono in `:root` di `styles.css`.
  Nessun colore hardcoded nei template JS.
- **Build.** `python build.py` rigenera `dist/parking_cloud_demo.html`.
  `dist/` è generato: modifica sempre `src/`.
