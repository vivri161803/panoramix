-- Appoteca · un medicinale al bisogno non ha dosi programmate (mattina, pranzo, sera a zero)
alter table public.medications drop constraint medications_dose_positive;
alter table public.medications add constraint medications_dose_positive check (
  frequency_type = 'as_needed' or dose_morning + dose_noon + dose_evening > 0
);
