import { describe, expect, it } from "vitest";
import { renderAlertEmail, type AlertEmailData, type AlertEmailMed } from "@/lib/email/alert-template";
import { CATEGORIES, containerWord, isLevel, levelPhrase, type Category } from "@/lib/categories";

const med: AlertEmailMed = {
  name: "Ramipril",
  strength: "5 mg",
  color: "#FF5E4D",
  status: "order",
  qty: 13,
  coverageDays: 20,
  runOutDate: "2026-11-28",
  requiresPrescription: false,
  pillsPerPack: 28,
  dosesPhrase: "1 compressa al mattino",
  asNeeded: false,
  category: "pillola",
  daysPerPack: null,
  frequencyType: "daily",
  levelText: "",
};

/** Un medicinale della categoria data, a pezzi o a livello come la categoria. */
function medOf(category: Category, over: Partial<AlertEmailMed> = {}): AlertEmailMed {
  const daysPerPack = CATEGORIES.find((c) => c.id === category)!.mode === "livello" ? 30 : null;
  const m = { ...med, name: `Med ${category}`, category, daysPerPack, pillsPerPack: daysPerPack ? 1 : 10, qty: daysPerPack ? 1.5 : 7, ...over };
  return { ...m, unit: containerWord(m, m.pillsPerPack), levelText: isLevel(m) ? levelPhrase(m.qty, m.coverageDays, m) : "" };
}

const base: AlertEmailData = {
  patientName: "Nonna Anna",
  managerFirstName: "Carlo",
  managerFullName: "Carlo Bianchi",
  planUrl: "https://panoramix.example/piani/abc",
  settingsUrl: "https://panoramix.example/piani/abc/modifica",
  today: "2026-11-08",
  meds: [med],
};

describe("email di avviso", () => {
  it("usa il logo dell'app dallo stesso dominio dei link", () => {
    const { html } = renderAlertEmail(base);
    expect(html).toContain('src="https://panoramix.example/email-logo.png"');
  });

  it("singolare: ordinarla, con la minuscola dopo la virgola", () => {
    const { text } = renderAlertEmail(base);
    expect(text).toContain("Ciao Carlo, questa medicina è sotto soglia: è il momento di ordinarla.");
  });

  it("plurale: ordinarle, senza la prossima preparazione del portapillole", () => {
    const { text } = renderAlertEmail({ ...base, meds: [med, { ...med, name: "Metformina" }] });
    expect(text).toContain("Ciao Carlo, queste medicine sono sotto soglia: è il momento di ordinarle.");
    expect(text).not.toContain("preparazione");
  });

  it("un medicinale per categoria: etichetta e parola del contenitore", () => {
    const meds = CATEGORIES.map((c) => medOf(c.id));
    const { text, html } = renderAlertEmail({ ...base, meds });
    for (const c of CATEGORIES) {
      expect(text).toContain(`Med ${c.id} 5 mg (${c.label})`);
      expect(html).toContain(c.label);
    }
    expect(text).toContain("Compresse rimaste: 7");
    expect(text).toContain("Siringhe rimaste: 7");
    expect(text).toContain("Flaconi rimasti: circa 20 giorni · 1 flacone e mezzo");
    expect(text).toContain("Tubi rimasti: circa 20 giorni · 1 tubo e mezzo");
  });

  it("un flacone con 0,967 flaconi mostra «meno di un flacone», non «1»", () => {
    const { text } = renderAlertEmail({ ...base, meds: [medOf("gocce", { qty: 29 / 30, coverageDays: 29 })] });
    expect(text).toContain("Flaconi rimasti: circa 29 giorni · meno di un flacone");
  });

  it("un collirio in flacone al bisogno dice «flacone», non «monodose»", () => {
    const m = medOf("gocce", { daysPerPack: null, frequencyType: "as_needed", asNeeded: true, pillsPerPack: 1, qty: 2, requiresPrescription: true });
    const { text } = renderAlertEmail({ ...base, meds: [m] });
    expect(text).toContain("Flaconi rimasti: 2");
    expect(text).toContain("1 confezione da 1 flacone");
    expect(text).not.toContain("monodose");
  });
});
