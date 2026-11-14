-- Panoramix · flacone di collirio: non si conta a gocce. Chi lo inserisce sceglie dopo quanti giorni
-- ricevere il promemoria di riordino; i giorni contano dall'ultimo conteggio o arrivo (stock_as_of).

alter table public.medications
  add column reorder_days integer check (reorder_days between 1 and 365);

-- flaconi già inseriti: promemoria dopo 30 giorni
update public.medications set reorder_days = 30 where shape = 'flacone';

alter table public.medications add constraint medications_reorder_days_flacone
  check ((shape = 'flacone') = (reorder_days is not null));
