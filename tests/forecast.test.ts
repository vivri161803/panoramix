import { describe, expect, it } from "vitest";
import { addDays, diffDays, isoWeekday, todayInRome } from "@/lib/dates";
import {
  applyPrep,
  buildWeek,
  calendarWeekStart,
  computePrep,
  currentStock,
  dosesOn,
  evaluateAlerts,
  forecastMedication,
  forecastPlan,
  formatQty,
  isScheduledOn,
  nextPrepDue,
  prepWeekStart,
  recountClearsOrdered,
  scheduleSummary,
  statusReason,
  undoPrep,
  weeklyNeed,
  type AlertType,
  type MedicationData,
  type OpenEpisode,
  type PlanSettings,
  type PrepRunData,
} from "@/lib/forecast";

// Domenica 8 novembre 2026
const SUN = "2026-11-08";
const MON = "2026-11-09";

function med(over: Partial<MedicationData> = {}): MedicationData {
  return {
    id: "m1",
    doseMorning: 1,
    doseNoon: 0,
    doseEvening: 0,
    frequencyType: "daily",
    weekdays: [],
    intervalDays: null,
    cycleOn: null,
    cycleOff: null,
    startDate: "2026-11-01",
    endDate: null,
    pillsPerPack: 30,
    stockQty: 0,
    stockAsOf: SUN,
    orderedAt: null,
    ...over,
  };
}

function plan(over: Partial<PlanSettings> = {}): PlanSettings {
  return {
    stockMode: "daily",
    prepWeekday: 7,
    modeSince: "2026-11-02",
    alertUnder14: true,
    alertUnder7: false,
    alertLastPack: true,
    ...over,
  };
}

const daily = (today = SUN, p: Partial<PlanSettings> = {}) => ({ plan: plan(p), today });

describe("dosi e frequenze", () => {
  it("somma le fasce del giorno, con mezze compresse", () => {
    const m = med({ doseMorning: 0.5, doseNoon: 0, doseEvening: 1 });
    expect(dosesOn(m, SUN)).toBe(1.5);
    expect(formatQty(1.5)).toBe("1½");
    expect(formatQty(0.5)).toBe("½");
    expect(formatQty(7)).toBe("7");
    expect(formatQty(2.4999)).toBe("2½");
  });

  it("riepilogo settimanale calcolato dallo schema", () => {
    expect(scheduleSummary(med())).toBe("1 al mattino, tutti i giorni → 7 a settimana");
    expect(scheduleSummary(med({ doseMorning: 0.5 }))).toBe("½ al mattino, tutti i giorni → 3½ a settimana");
    expect(scheduleSummary(med({ frequencyType: "weekdays", weekdays: [1, 3, 5], doseEvening: 1 }))).toBe(
      "1 al mattino e 1 alla sera, lun, mer e ven → 6 a settimana",
    );
    expect(weeklyNeed(med({ frequencyType: "every_n_days", intervalDays: 2 }))).toEqual({ perWeek: 3.5, approx: true });
  });

  it("giorni specifici della settimana", () => {
    const m = med({ frequencyType: "weekdays", weekdays: [1, 3, 5] }); // lun, mer, ven
    expect(isoWeekday(MON)).toBe(1);
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => isScheduledOn(m, addDays(MON, i)))).toEqual([true, false, true, false, true, false, false]);
  });

  it("ogni N giorni a partire da una data", () => {
    const m = med({ frequencyType: "every_n_days", intervalDays: 3, startDate: "2026-11-01" });
    const days = Array.from({ length: 10 }, (_, i) => addDays("2026-11-01", i)).filter((d) => isScheduledOn(m, d));
    expect(days).toEqual(["2026-11-01", "2026-11-04", "2026-11-07", "2026-11-10"]);
    expect(isScheduledOn(m, "2026-10-29")).toBe(false); // prima dell'inizio
  });

  it("ciclo: X giorni sì e Y giorni no", () => {
    const m = med({ frequencyType: "cycle", cycleOn: 2, cycleOff: 1, startDate: SUN });
    const pattern = Array.from({ length: 7 }, (_, i) => isScheduledOn(m, addDays(SUN, i)));
    expect(pattern).toEqual([true, true, false, true, true, false, true]);
  });

  it("dopo la data di fine la medicina esce dal calendario", () => {
    const m = med({ endDate: "2026-11-10" });
    expect(isScheduledOn(m, "2026-11-10")).toBe(true);
    expect(isScheduledOn(m, "2026-11-11")).toBe(false);
    const week = buildWeek([m], MON);
    expect(week.map((d) => d.slots.morning.length)).toEqual([1, 1, 0, 0, 0, 0, 0]);
  });

  it("al bisogno: niente calendario né consumo", () => {
    const m = med({ frequencyType: "as_needed", stockQty: 10, stockAsOf: "2026-11-01" });
    expect(dosesOn(m, SUN)).toBe(0);
    expect(buildWeek([m], MON).every((d) => d.slots.morning.length === 0)).toBe(true);
    expect(currentStock(m, "daily", SUN)).toBe(10);
  });
});

describe("scorte giorno per giorno", () => {
  it("scorta di oggi = riferimento − dosi dal riferimento a ieri compreso", () => {
    const m = med({ stockQty: 10, stockAsOf: "2026-11-05" });
    expect(currentStock(m, "daily", "2026-11-05")).toBe(10);
    expect(currentStock(m, "daily", SUN)).toBe(7); // 5, 6, 7 novembre
  });

  it("criterio 2: 5 compresse, 1 al giorno → copertura 5 giorni e avviso dei 7 giorni", () => {
    const m = med({ stockQty: 5 });
    const f = forecastMedication(m, daily(SUN, { alertUnder7: true }));
    expect(f.coverageDays).toBe(5);
    expect(f.runOutDate).toBe("2026-11-13");
    expect(f.triggered).toContain("under_7");
    expect(f.status).toBe("order");
    const d = evaluateAlerts(f.triggered, false, []);
    expect(d.send).toContain("under_7");
  });

  it("mezze compresse: 3 compresse da ½ al giorno coprono 6 giorni", () => {
    const f = forecastMedication(med({ doseMorning: 0.5, stockQty: 3 }), daily());
    expect(f.coverageDays).toBe(6);
  });

  it("giorni specifici: i giorni senza dose contano come coperti", () => {
    const m = med({ frequencyType: "weekdays", weekdays: [1, 3, 5], stockQty: 2, stockAsOf: MON });
    const f = forecastMedication(m, daily(MON));
    expect(f.coverageDays).toBe(4); // lun–gio, venerdì non coperto
    expect(f.runOutDate).toBe("2026-11-13");
  });

  it("ogni N giorni: copertura corretta", () => {
    const m = med({ frequencyType: "every_n_days", intervalDays: 3, startDate: "2026-11-01", stockQty: 2 });
    // dosi il 10 e il 13; il 16 non è coperto
    expect(forecastMedication(m, daily()).coverageDays).toBe(8);
  });

  it("ciclo: copertura corretta", () => {
    const m = med({ frequencyType: "cycle", cycleOn: 2, cycleOff: 1, startDate: SUN, stockQty: 3 });
    expect(forecastMedication(m, daily()).coverageDays).toBe(4);
  });

  it("data di fine coperta: nessun esaurimento e nessun avviso", () => {
    const m = med({ endDate: "2026-11-12", stockQty: 10 });
    const f = forecastMedication(m, daily());
    expect(f.coverageDays).toBeNull();
    expect(f.triggered).toEqual([]);
    expect(f.status).toBe("ok");
    const short = forecastMedication(med({ endDate: "2026-11-12", stockQty: 2 }), daily());
    expect(short.coverageDays).toBe(2);
  });

  it("terapia conclusa: fuori dalle previsioni", () => {
    const f = forecastMedication(med({ endDate: "2026-11-01", stockQty: 1 }), daily());
    expect(f.ended).toBe(true);
    expect(f.triggered).toEqual([]);
  });

  it("al bisogno: solo l'avviso dell'ultima confezione", () => {
    const m = med({ frequencyType: "as_needed", stockQty: 20, pillsPerPack: 20 });
    const f = forecastMedication(m, daily(SUN, { alertUnder7: true }));
    expect(f.coverageDays).toBeNull();
    expect(f.triggered).toEqual(["last_pack"]);
    expect(forecastMedication({ ...m, stockQty: 21 }, daily()).triggered).toEqual([]);
  });

  it("stati: esaurita, ordinata, ok", () => {
    expect(forecastMedication(med({ stockQty: 0 }), daily()).status).toBe("out");
    expect(forecastMedication(med({ stockQty: 10, orderedAt: "2026-11-07T10:00:00Z" }), daily()).status).toBe("ordered");
    expect(forecastMedication(med({ stockQty: 100 }), daily()).status).toBe("ok");
    // ultima confezione con soglia attiva
    expect(forecastMedication(med({ stockQty: 30 }), daily()).triggered).toEqual(["last_pack"]);
  });

  it("nuovo conteggio sopra soglia toglie lo stato Ordinata", () => {
    const f = forecastMedication(med({ stockQty: 100, orderedAt: "2026-11-07T10:00:00Z" }), daily());
    expect(recountClearsOrdered(f)).toBe(true);
    const low = forecastMedication(med({ stockQty: 5, orderedAt: "2026-11-07T10:00:00Z" }), daily());
    expect(recountClearsOrdered(low)).toBe(false);
  });
});

describe("portapillole settimanale", () => {
  const weekly = plan({ stockMode: "weekly", prepWeekday: 7, modeSince: "2026-11-02" });

  it("prima preparazione: il primo giorno di preparazione dalla modalità", () => {
    expect(nextPrepDue(weekly, [])).toBe(SUN);
    expect(prepWeekStart(weekly, [], "2026-11-07")).toBe(SUN); // in anticipo di un giorno
  });

  it("criterio 4: scala esattamente 7 giorni di dosi e l'annullamento le restituisce", () => {
    const meds = [
      med({ id: "a", stockQty: 20 }),
      med({ id: "b", doseMorning: 0.5, doseEvening: 1, stockQty: 30 }),
      med({ id: "c", frequencyType: "weekdays", weekdays: [7], stockQty: 4 }),
      med({ id: "d", frequencyType: "as_needed", stockQty: 10 }),
    ];
    const items = computePrep(meds, SUN);
    expect(items.map((i) => [i.medicationId, i.take])).toEqual([
      ["a", 7],
      ["b", 10.5],
      ["c", 1],
    ]);
    const before = { a: 20, b: 30, c: 4, d: 10 };
    const after = applyPrep(before, items);
    expect(after).toEqual({ a: 13, b: 19.5, c: 3, d: 10 });
    const deductions = Object.fromEntries(items.map((i) => [i.medicationId, i.take]));
    expect(undoPrep(after, deductions)).toEqual(before);
  });

  it("se le scorte non bastano toglie quello che c'è e segna cosa manca", () => {
    const [item] = computePrep([med({ stockQty: 5 })], SUN);
    expect(item).toMatchObject({ need: 7, take: 5, missing: 2 });
  });

  it("copertura = giorni nel portapillole + giorni coperti dalle scorte in casa", () => {
    const runs: PrepRunData[] = [{ id: "r1", weekStart: SUN, deductions: { m1: 7 }, undoneAt: null }];
    expect(nextPrepDue(weekly, runs)).toBe("2026-11-15");
    const m = med({ stockQty: 13 });
    const pf = forecastPlan(weekly, [m], runs, "2026-11-10");
    const f = pf.items[0].forecast;
    expect(f.homeDays).toBe(13);
    expect(f.coverageDays).toBe(5 + 13); // 10–14 nel portapillole, poi 13 giorni
    expect(f.status).toBe("order"); // ultima confezione
    expect(statusReason(f, "weekly", null)).toBe("È rimasta l’ultima confezione");
  });

  it("esaurita se non basta per la prossima preparazione", () => {
    const pf = forecastPlan(weekly, [med({ stockQty: 5 })], [], "2026-11-06");
    expect(pf.items[0].forecast.coverageDays).toBe(2 + 5);
    expect(pf.items[0].forecast.status).toBe("out");
    expect(statusReason(pf.items[0].forecast, "weekly", null)).toBe("Ne mancano 2 per la prossima preparazione");
  });

  it("preparazione passata senza conferma: la segnala senza scalare nulla", () => {
    const m = med({ stockQty: 20 });
    const pf = forecastPlan(weekly, [m], [], "2026-11-10");
    expect(pf.prepOverdue).toBe(true);
    expect(pf.items[0].forecast.stock).toBe(20);
    expect(pf.prepWeek).toBe(SUN);
    // più settimane saltate: si prepara l'ultima iniziata
    expect(prepWeekStart(weekly, [], "2026-11-25")).toBe("2026-11-22");
  });

  it("annullata l'ultima preparazione, torna dovuta la stessa settimana", () => {
    const runs: PrepRunData[] = [{ id: "r1", weekStart: SUN, deductions: {}, undoneAt: "2026-11-08T11:00:00Z" }];
    expect(nextPrepDue(weekly, runs)).toBe(SUN);
  });

  it("le preparazioni precedenti a un cambio di modalità non contano", () => {
    const runs: PrepRunData[] = [{ id: "r0", weekStart: "2026-10-04", deductions: {}, undoneAt: null }];
    expect(nextPrepDue(weekly, runs)).toBe(SUN);
  });
});

describe("episodi di avviso", () => {
  type Ep = OpenEpisode & { closed: boolean };
  // Simula il controllo giornaliero con le sole funzioni pure.
  function run(triggered: AlertType[], ordered: boolean, log: Ep[]) {
    const open = log.filter((e) => !e.closed);
    const d = evaluateAlerts(triggered, ordered, open);
    for (const t of d.close) open.find((e) => e.alertType === t)!.closed = true;
    for (const t of d.open) log.push({ alertType: t, sentAt: null, closed: false });
    for (const t of d.send) log.find((e) => e.alertType === t && !e.closed)!.sentAt = "inviato";
    return d.send;
  }

  it("criterio 3: nessuna seconda email finché non arriva una confezione", () => {
    const log: Ep[] = [];
    expect(run(["under_7"], false, log)).toEqual(["under_7"]);
    expect(run(["under_7"], false, log)).toEqual([]); // giorno dopo
    expect(run(["under_7"], false, log)).toEqual([]);
    // arriva una confezione: la scorta torna sopra soglia, episodio chiuso
    expect(run([], false, log)).toEqual([]);
    // la volta successiva l'avviso può ripartire
    expect(run(["under_7"], false, log)).toEqual(["under_7"]);
  });

  it("criterio 3: segnata come ordinata non genera avvisi fino all'arrivo", () => {
    const log: Ep[] = [];
    expect(run(["under_14"], true, log)).toEqual([]);
    expect(run(["under_14", "under_7"], true, log)).toEqual([]);
    expect(run([], false, log)).toEqual([]); // arrivo
    expect(log.every((e) => e.closed)).toBe(true);
  });

  it("ordine annullato prima dell'arrivo: l'avviso in sospeso parte", () => {
    const log: Ep[] = [];
    run(["under_14"], true, log);
    expect(run(["under_14"], false, log)).toEqual(["under_14"]);
  });

  it("ogni soglia ha il suo episodio", () => {
    const log: Ep[] = [];
    expect(run(["under_14"], false, log)).toEqual(["under_14"]);
    expect(run(["under_14", "under_7"], false, log)).toEqual(["under_7"]);
  });
});

describe("calendario", () => {
  it("criterio 5: mezze compresse, ogni N giorni e cicli nella settimana", () => {
    const meds = [
      { ...med({ id: "half", doseMorning: 0.5 }) },
      { ...med({ id: "n", doseMorning: 0, doseEvening: 1, frequencyType: "every_n_days", intervalDays: 2, startDate: MON }) },
      { ...med({ id: "cyc", doseMorning: 0, doseNoon: 1, frequencyType: "cycle", cycleOn: 3, cycleOff: 2, startDate: MON }) },
    ];
    const week = buildWeek(meds, MON);
    expect(week.map((d) => d.slots.morning.map((i) => i.qty))).toEqual(Array(7).fill([0.5]));
    expect(week.map((d) => d.slots.evening.length)).toEqual([1, 0, 1, 0, 1, 0, 1]);
    expect(week.map((d) => d.slots.noon.length)).toEqual([1, 1, 1, 0, 0, 1, 1]);
  });

  it("la settimana parte dal lunedì, o dal giorno di preparazione in modalità settimanale", () => {
    expect(calendarWeekStart("2026-11-11", { stockMode: "daily", prepWeekday: 7 })).toBe(MON);
    expect(calendarWeekStart("2026-11-11", { stockMode: "weekly", prepWeekday: 7 })).toBe(SUN);
  });
});

describe("ora legale e fuso Europe/Rome", () => {
  it("oggi a Roma attorno al passaggio all'ora legale (29 marzo 2026)", () => {
    expect(todayInRome(new Date("2026-03-28T22:59:00Z"))).toBe("2026-03-28"); // 23:59 CET
    expect(todayInRome(new Date("2026-03-28T23:30:00Z"))).toBe("2026-03-29"); // 00:30 CET
    expect(todayInRome(new Date("2026-03-29T07:00:00Z"))).toBe("2026-03-29"); // cron: 09:00 CEST
  });

  it("oggi a Roma attorno al ritorno all'ora solare (25 ottobre 2026)", () => {
    expect(todayInRome(new Date("2026-10-24T22:30:00Z"))).toBe("2026-10-25"); // 00:30 CEST
    expect(todayInRome(new Date("2026-10-25T22:30:00Z"))).toBe("2026-10-25"); // 23:30 CET
    expect(todayInRome(new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-26");
  });

  it("i giorni non si allungano né si accorciano col cambio d'ora", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(diffDays("2026-10-24", "2026-10-26")).toBe(2);
    const m = med({ stockQty: 10, stockAsOf: "2026-03-26", startDate: "2026-03-01" });
    expect(currentStock(m, "daily", "2026-03-31")).toBe(5);
    expect(forecastMedication(m, daily("2026-03-26")).runOutDate).toBe("2026-04-05");
  });
});
