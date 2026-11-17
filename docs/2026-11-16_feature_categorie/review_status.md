# Stato della revisione EGM di categorie.md

*Aggiornato il 2026-11-16: revisione EGM conclusa.*

## Impostazioni

- **Documento:** `docs/2026-11-16_feature_categorie/categorie.md` (1911 righe)
- **Modalità:** revisione interattiva con tutte le rubriche: fasi 5 → 6 → 7 → 8 → 9, con una domanda di controllo dopo ogni fase.
- **Contesto per i revisori:** solo `concepts_brief.md`, aggiunto da solo perché il documento lo cita. L'autore non ha voluto altri file.
- **Divisione del documento:** FeatureRange 1–950, DetailedRange 951–1911 (`## Detailed Implementation Plan` è alla riga 951). Va ricontrollata se il documento cambia.
- **Dove vanno i rapporti:** in questa stessa cartella.

## Fasi

| Fase | Stato | Rapporto | Esito |
|---|---|---|---|
| 5 Zoom Out iniziale | ✅ fatta | `zoom_out_report.md` | 0 bloccanti, 5 maggiori, 8 minori. Tutti corretti nel documento (tabella «Resolution» in fondo al rapporto). |
| 6 Test di comprensione | ✅ fatta | `comprehension_report.md` | 0 bloccanti, 5 maggiori, 8 minori. Tutti corretti nel documento (tabella «Resolution» in fondo al rapporto). |
| 7 Revisione critica | ✅ fatta | `critic_report.md`, `goldfish_review_report.md` | 0 bloccanti, 15 maggiori, 14 minori. Tutti corretti tranne 2 minori rifiutati (tabella «Resolution» in fondo a `critic_report.md`). |
| 8 Zoom Out intermedio | ✅ fatta | `intermediate_zoom_out_report.md` | 0 bloccanti, 2 maggiori, 5 minori. Tutti corretti (i minori con le correzioni della fase 9). |
| 9 Pronto per l'implementazione | ✅ fatta | `implementation_readiness_report.md`, `goldfish_review_report_stage9.md` | 7 bloccanti, 13 maggiori, 12 minori. Tutti corretti; il piano dettagliato è stato riscritto (tabella «Resolution» in fondo al rapporto). |
| 9 bis Secondo controllo | ✅ fatta | `implementation_readiness_report_round2.md` | 1 bloccante, 11 maggiori, 15 minori. Tutti corretti (tabella «Resolution» in fondo al rapporto). Era l'unico ricontrollo previsto dal flusso. |

La fase 9 è stata ricontrollata una volta, come permette il flusso, e i problemi del secondo giro sono corretti. Le correzioni del secondo giro non sono state riviste da revisori nuovi.

## Decisioni nuove prese durante le correzioni (da confermare)

1. **Elenco delle parole chiave AIFA (R2.5, righe k1–k9).** ✅ Risolto in fase 9: ora è l'elenco del progetto grafico (pagina Presidi, sezione 10), confermato dall'autore.
2. **Avviso a chi usava il portapillole settimanale.** Ho scritto che è un'email scritta a mano dall'autore.
3. **Fase 7, scelte confermate dall'autore:** si tengono i giorni di uso (E1); `categoryFromAifa(forma, descrizione)` suggerisce il modo da PENNA, MULTIDOSE e MONODOSE (E2, cambia una regola del brief); i piani con tutti gli avvisi spenti e un flacone ricevono un'email a mano dopo R2 (E3).
4. **Fase 9, scelte confermate dall'autore:** migrazioni verificate solo a mano sul dump (E1); azioni alla data `max(oggi, stock_as_of)` (E2); scorta in `numeric` senza scala, senza `roundStock` (E3); parole chiave AIFA dal progetto grafico, (E4). «Altro» resta «pezzo / pezzi», come nel brief: la parola «unità» del design è stata tolta nel secondo giro.
5. **Design aggiornato:** `design/Presidi.dc.html` e `design/Presidio.dc.html` sono stati sostituiti con l'export del progetto «Interfaccia Panoramix confermata» indicato dall'autore. Il cambio non è ancora in un commit.

## Come ripartire

La revisione EGM è conclusa. Il passo successivo è implementare R1 seguendo il piano dettagliato (punti 1–33). Prima conviene mettere in un commit il documento, i rapporti e i due file di `design/` aggiornati.
