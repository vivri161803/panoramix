import { describe, expect, it } from "vitest";
import { renderAlertEmail, type AlertEmailData, type AlertEmailMed } from "@/lib/email/alert-template";

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
  dosesPhrase: "1 al mattino",
  asNeeded: false,
};

const base: AlertEmailData = {
  patientName: "Nonna Anna",
  managerFirstName: "Carlo",
  managerFullName: "Carlo Bianchi",
  planUrl: "https://panoramix.example/piani/abc",
  settingsUrl: "https://panoramix.example/piani/abc/modifica",
  nextPrep: null,
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

  it("plurale e portapillole: ordinarle, preparazione in minuscolo", () => {
    const { text } = renderAlertEmail({ ...base, nextPrep: "2026-11-15", meds: [med, { ...med, name: "Metformina" }] });
    expect(text).toContain("Ciao Carlo, la prossima preparazione del portapillole è");
    expect(text).toContain("Queste medicine sono sotto soglia: è il momento di ordinarle.");
  });
});
