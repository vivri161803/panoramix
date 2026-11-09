import { describe, expect, it } from "vitest";
import { renderInviteEmail, renderOpsEmail, renderPrepReminderEmail, renderWeeklySummaryEmail, summaryHeadline, type SummaryMed } from "@/lib/email/templates";

const appUrl = "https://panoramix.example";

describe("email di invito", () => {
  it("spiega chi invita, il permesso e come accettare", () => {
    const e = renderInviteEmail({ inviterName: "Carlo Bianchi", inviterEmail: "carlo@example.it", patientName: "Nonna Anna", role: "viewer", inviteeEmail: "maria@example.it", appUrl });
    expect(e.subject).toBe("Carlo Bianchi ti invita a seguire le medicine di Nonna Anna");
    expect(e.text).toContain("«Sola lettura»");
    expect(e.text).toContain("maria@example.it");
    expect(e.html).toContain('href="https://panoramix.example/piani"');
    expect(e.html).toContain('src="https://panoramix.example/email-logo.png"');
  });

  it("protegge i nomi con caratteri HTML", () => {
    const e = renderInviteEmail({ inviterName: "<b>Io</b>", inviterEmail: "a@b.it", patientName: "Anna & Co", role: "editor", inviteeEmail: "x@y.it", appUrl });
    expect(e.html).not.toContain("<b>Io</b>");
    expect(e.html).toContain("&lt;b&gt;Io&lt;/b&gt;");
    expect(e.html).toContain("Anna &amp; Co");
  });
});

describe("promemoria del portapillole", () => {
  it("domani, con l'avviso per le compresse che mancano", () => {
    const e = renderPrepReminderEmail({
      patientName: "Nonna Anna",
      managerName: "Carlo",
      prepDate: "2026-11-15",
      today: "2026-11-14",
      items: [
        { name: "Ramipril", strength: "5 mg", color: "#FFC020", need: 7, missing: 3, phrase: "1 al mattino" },
        { name: "Cardioaspirina", strength: "100 mg", color: "#FF5E4D", need: 7, missing: 0, phrase: "1 a pranzo", changeNote: "Dal mer 18 nov: ½ a pranzo" },
      ],
      planUrl: `${appUrl}/piani/p1`,
      settingsUrl: `${appUrl}/piani/p1/modifica`,
      appUrl,
    });
    expect(e.subject).toBe("Panoramix · Nonna Anna: domani si prepara il portapillole");
    expect(e.text).toContain("Domenica 15 novembre è il giorno di preparazione.");
    expect(e.text).toContain("ATTENZIONE: mancano 3 Ramipril.");
    expect(e.text).toContain("• Cardioaspirina 100 mg: 7 compresse (1 a pranzo) · Dal mer 18 nov: ½ a pranzo");
    expect(e.html).toContain("Ne mancano 3");
  });
});

describe("riepilogo settimanale", () => {
  const base: SummaryMed = { name: "Ramipril", strength: "5 mg", color: "#FFC020", status: "ok", qty: 40, coverageDays: 40, runOutDate: "2026-12-26", asNeeded: false };

  it("tutto in ordine", () => {
    expect(summaryHeadline([base])).toEqual({ text: "Tutto in ordine: nessuna medicina da ordinare.", tone: "ok" });
    expect(summaryHeadline([{ ...base, status: "ordered" }]).text).toBe("Nessuna medicina da ordinare (1 già ordinata, in arrivo).");
  });

  it("conta esaurite e da ordinare", () => {
    expect(summaryHeadline([{ ...base, status: "out" }, { ...base, status: "order" }, { ...base, status: "order" }]).text).toBe("1 esaurita e 2 da ordinare: apri il piano per i dettagli.");
  });

  it("elenca ogni medicina con scorta e copertura", () => {
    const e = renderWeeklySummaryEmail({ patientName: "Nonna Anna", today: "2026-11-16", nextPrep: "2026-11-22", meds: [base, { ...base, name: "Paracetamolo", asNeeded: true, coverageDays: null, runOutDate: null, qty: 5 }], planUrl: `${appUrl}/piani/p1`, settingsUrl: `${appUrl}/piani/p1/modifica`, appUrl });
    expect(e.subject).toBe("Panoramix · Nonna Anna: riepilogo della settimana");
    expect(e.text).toContain("Prossima preparazione del portapillole: domenica 22 novembre.");
    expect(e.text).toContain("• Ramipril 5 mg — In ordine: 40 in casa, 40 giorni, finisce sabato 26 dicembre");
    expect(e.text).toContain("• Paracetamolo 5 mg — In ordine: 5 in casa, al bisogno");
  });
});

describe("avviso tecnico", () => {
  it("elenca i problemi", () => {
    const e = renderOpsEmail({ title: "Problema nel controllo", problems: ["Ieri non è partito", "SMTP giù"], appUrl, when: "9 novembre 2026" });
    expect(e.subject).toBe("[Panoramix] Problema nel controllo");
    expect(e.text).toContain("• Ieri non è partito\n• SMTP giù");
  });

  it("email tecnica con soli dati AIFA fermi: dice che avvisi e promemoria sono partiti", () => {
    const e = renderOpsEmail({ title: "Problema nel controllo", problems: ["Dati AIFA (farmaci carenti) non aggiornati da 9 giorni."], appUrl, when: "9 novembre 2026" });
    expect(e.text).toContain("Avvisi e promemoria sono partiti");
    expect(e.text).not.toContain("potrebbero non aver ricevuto");
    const mixed = renderOpsEmail({ title: "2 problemi", problems: ["Dati AIFA (atc) fermi.", "SMTP giù"], appUrl, when: "9 novembre 2026" });
    expect(mixed.text).toContain("potrebbero non aver ricevuto");
  });
});
