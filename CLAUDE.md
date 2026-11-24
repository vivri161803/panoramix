<!-- gr-workflow:start -->
## Workflow feature

EGM artifact directory: .egm

Flusso: `egm-brainstorm` → `egm-draft` → `egm-fastreview` → `to-tickets` → `implement`.
Ogni feature ha uno slug in kebab-case (es. `avvisi-riordino`), identico nei nomi dei file e nel branch.

File permanenti (versionati):
- `docs/designs/<slug>.md`: design doc, l'unico documento vivo della feature. Quando `egm-draft` chiede dove salvare, usa `docs/designs/` e lo slug come nome del file.
- `docs/designs/SITEMAP.md`: indice dei design doc.
- `docs/tickets/<slug>.md`: ticket e stato dell'implementazione (scritto da `to-tickets`, aggiornato da `implement`).
- `.claude/agents/gr-*.md`: agenti usati da `implement`. Li installa e aggiorna `/gr-workflow-init`: non modificarli a mano.

File di lavoro (in `.egm/`, escluso da git, cancellabili in qualsiasi momento):
- `.egm/concepts_brief.md`, `.egm/design_draft.md`: brainstorm e draft in corso.
- `.egm/<slug>/review_log.md`, `.egm/<slug>/review_digest.md`: report e digest di `egm-fastreview`.
- `.egm/drift/`: report di `egm-drift-report`.

Regole:
- Non creare altri file markdown fuori da queste posizioni. Report, note e file temporanei vanno in `.egm/`.
- Un branch per feature: `feat/<slug>`, usato da `egm-fastreview` e da `implement`.
- Le decisioni prese in review finiscono nel design doc; le deviazioni emerse in implementazione nel file dei ticket.
<!-- gr-workflow:end -->
