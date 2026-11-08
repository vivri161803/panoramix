-- Panoramix · indici sulle chiavi esterne "created_by"
-- Servono quando si elimina un profilo (on delete set null) senza scorrere tutta la tabella.
create index stock_events_created_by_idx on public.stock_events (created_by);
create index prep_runs_created_by_idx on public.prep_runs (created_by);
