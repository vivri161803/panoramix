-- Panoramix · tipo di medicinale (design/Presidi.dc.html): compressa, iniezione, cerotto, collirio.
-- La forma (shape) ora può essere anche quella di un presidio; deve appartenere al tipo.

alter table public.medications
  add column form text not null default 'compressa'
    check (form in ('compressa', 'iniezione', 'cerotto', 'collirio'));

alter table public.medications drop constraint medications_shape_check;
alter table public.medications add constraint medications_shape_check check (
  (form = 'compressa' and shape in ('tonda', 'ovale', 'capsula'))
  or (form = 'iniezione' and shape in ('siringa', 'penna', 'fiala'))
  or (form = 'cerotto' and shape in ('cerotto', 'cerotto-tondo', 'bustina'))
  or (form = 'collirio' and shape in ('flacone', 'monodose'))
);
