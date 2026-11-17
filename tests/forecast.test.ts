import { describe, expect, it } from "vitest";
import { addDays, diffDays, isoWeekday, todayInRome } from "@/lib/dates";
import {
  buildWeek,
  calendarWeekStart,
  consumptionBetween,
  consumptionOn,
  currentStock,
  dosesPhrase,
  dosesOn,
  evaluateAlerts,
  forecastMedication,
  forecastPlan,
  formatQty,
  isScheduledOn,
  recountClearsOrdered,
  scheduleSummary,
  statusReason,
  weeklyNeed,
  type AlertType,
  type MedicationData,
  type OpenEpisode,
  type PlanSettings,
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
    category: "pillola",
    ...over,
  };
}

function plan(over: Partial<PlanSettings> = {}): PlanSettings {
  return {
    prepWeekday: 7,
    prepReminder: false,
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
    expect(currentStock(m, SUN)).toBe(10);
  });
});

describe("scorte giorno per giorno", () => {
  it("scorta di oggi = riferimento − dosi dal riferimento a ieri compreso", () => {
    const m = med({ stockQty: 10, stockAsOf: "2026-11-05" });
    expect(currentStock(m, "2026-11-05")).toBe(10);
    expect(currentStock(m, SUN)).toBe(7); // 5, 6, 7 novembre
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

describe("scorte giorno per giorno in tutti i piani", () => {
  it("la scorta scende ogni giorno anche con il promemoria del portapillole acceso", () => {
    const m = med({ stockQty: 20, stockAsOf: SUN });
    const today = "2026-11-12";
    const off = forecastMedication(m, daily(today));
    const on = forecastMedication(m, daily(today, { prepReminder: true }));
    expect(currentStock(m, today)).toBe(16); // 8, 9, 10, 11 novembre
    expect(on).toEqual(off);
    expect(off.coverageDays).toBe(16);
    expect(off.runOutDate).toBe("2026-11-28");
  });

  it("stock_as_of nel futuro: i giorni fino a quella data sono già nel portapillole e contano come coperti", () => {
    const now = forecastMedication(med({ stockQty: 10, stockAsOf: SUN }), daily(SUN));
    const later = forecastMedication(med({ stockQty: 10, stockAsOf: addDays(SUN, 3) }), daily(SUN));
    expect(later.stock).toBe(10);
    expect(later.coverageDays).toBe(now.coverageDays! + 3);
    expect(later.runOutDate).toBe(addDays(now.runOutDate!, 3));
  });

  it("stock_as_of nel futuro e scorta in casa finita: coperto solo fino a stock_as_of", () => {
    const f = forecastMedication(med({ stockQty: 0, stockAsOf: addDays(SUN, 4) }), daily(SUN));
    expect(f.coverageDays).toBe(4);
    expect(f.status).not.toBe("out");
    expect(statusReason(f, null)).toBe("Restano 4 giorni: è ora di ordinare");
  });

  it("forecastPlan non dipende più dalle preparazioni", () => {
    const pf = forecastPlan(plan({ prepReminder: true }), [med({ stockQty: 13 })], "2026-11-10");
    expect(pf.items[0].forecast.coverageDays).toBe(11);
    expect(Object.keys(pf).sort()).toEqual(["items", "toOrder", "today", "worst"]);
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

  it("la settimana parte dal lunedì, o dal giorno di preparazione con il promemoria acceso", () => {
    expect(calendarWeekStart("2026-11-11", { prepReminder: false, prepWeekday: 7 })).toBe(MON);
    expect(calendarWeekStart("2026-11-11", { prepReminder: true, prepWeekday: 7 })).toBe(SUN);
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
    expect(currentStock(m, "2026-03-31")).toBe(5);
    expect(forecastMedication(m, daily("2026-03-26")).runOutDate).toBe("2026-04-05");
  });
});

describe("consumo nei due modi di conteggio", () => {
  const syrup = (over: Partial<MedicationData> = {}) => med({ category: "liquido", doseMorning: 5, pillsPerPack: 1, stockQty: 1, stockAsOf: SUN, daysPerPack: 30, ...over });

  it("a pezzi consuma le dosi, a livello 1 / daysPerPack per giorno di uso", () => {
    expect(consumptionOn(med({ doseMorning: 1, doseEvening: 1 }), MON)).toBe(2);
    expect(consumptionOn(syrup({ doseMorning: 15 }), MON)).toBeCloseTo(1 / 30);
    expect(consumptionBetween(syrup(), SUN, addDays(SUN, 29))).toBeCloseTo(1);
  });

  it("fuori dalle date di terapia non consuma", () => {
    expect(consumptionOn(syrup({ startDate: MON }), SUN)).toBe(0);
    expect(consumptionOn(syrup({ endDate: SUN }), MON)).toBe(0);
    expect(consumptionOn(med({ startDate: MON }), SUN)).toBe(0);
  });

  it("a livello niente consumo nei giorni esclusi, nella pausa di un ciclo e con dose 0", () => {
    const weekdays = syrup({ frequencyType: "weekdays", weekdays: [1] });
    expect(consumptionOn(weekdays, MON)).toBeCloseTo(1 / 30);
    expect(consumptionOn(weekdays, addDays(MON, 1))).toBe(0);
    const cycle = syrup({ frequencyType: "cycle", cycleOn: 2, cycleOff: 1, startDate: SUN });
    expect([0, 1, 2].map((i) => consumptionOn(cycle, addDays(SUN, i)) > 0)).toEqual([true, true, false]);
    const suspended = syrup({ doseChanges: [{ from: MON, doseMorning: 0, doseNoon: 0, doseEvening: 0 }] });
    expect(consumptionOn(suspended, MON)).toBe(0);
  });

  it("flacone migrato: stessa data di esaurimento di stock_as_of + giorni del vecchio promemoria", () => {
    const today = addDays(SUN, 10);
    const f = forecastMedication(syrup({ category: "gocce", doseMorning: 2, doseEvening: 2 }), daily(today));
    expect(currentStock(syrup(), today)).toBeCloseTo(20 / 30);
    expect(f.coverageDays).toBe(20);
    expect(f.runOutDate).toBe(addDays(SUN, 30));
    expect(f.lastPack).toBe(true);
    expect(f.triggered).toEqual(["last_pack"]);
  });

  it("1/3 di flacone da 30 giorni copre 10 giorni, con gli avvisi di soglia delle compresse", () => {
    const f = forecastMedication(syrup({ stockQty: 1 / 3 }), daily(SUN, { alertUnder7: true }));
    expect(f.coverageDays).toBe(10);
    expect(f.triggered).toEqual(["under_14", "last_pack"]);
    expect(f.status).toBe("order");
    expect(statusReason(f, null)).toBe("Restano 10 giorni: è ora di ordinare");
  });

  it("frasi delle dosi con la parola della categoria", () => {
    expect(dosesPhrase({ doseMorning: 5, doseNoon: 0, doseEvening: 0 }, (n) => (n === 1 ? "goccia" : "ml"))).toBe("5 ml al mattino");
    expect(dosesPhrase({ doseMorning: 0, doseNoon: 0, doseEvening: 1 }, (n) => (n === 1 ? "goccia" : "gocce"))).toBe("1 goccia alla sera");
    expect(dosesPhrase({ doseMorning: 1, doseNoon: 0, doseEvening: 0 })).toBe("1 al mattino");
  });
});
