import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { canEdit, isOwner, uniqueEmails } from "@/lib/roles";
import { planAudience } from "@/lib/cron-data";
import type { ProfileRow } from "@/lib/db-types";

describe("ruoli", () => {
  it("chi può modificare e chi può gestire il piano", () => {
    expect([canEdit("owner"), canEdit("editor"), canEdit("viewer"), canEdit(null)]).toEqual([true, true, false, false]);
    expect([isOwner("owner"), isOwner("editor"), isOwner("viewer")]).toEqual([true, false, false]);
  });

  it("indirizzi senza doppioni né maiuscole", () => {
    expect(uniqueEmails(["A@x.it", "a@x.it ", null, "", "b@x.it"])).toEqual(["a@x.it", "b@x.it"]);
  });

  it("le email del piano vanno a proprietario, destinatari e persone con accesso", () => {
    const profiles = new Map<string, ProfileRow>([
      ["owner", { id: "owner", email: "carlo@x.it", first_name: "Carlo", last_name: "B" }],
      ["m1", { id: "m1", email: "maria@x.it", first_name: "Maria", last_name: "T" }],
      ["m2", { id: "m2", email: "luca@x.it", first_name: "Luca", last_name: "V" }],
    ]);
    const to = planAudience(
      {
        profiles,
        recipients: [
          { plan_id: "p1", email: "badante@x.it" },
          { plan_id: "p1", email: "MARIA@x.it" },
          { plan_id: "p2", email: "altro@x.it" },
        ],
        members: [
          { plan_id: "p1", user_id: "m1", role: "viewer" },
          { plan_id: "p2", user_id: "m2", role: "editor" },
        ],
      },
      { id: "p1", owner_id: "owner" },
    );
    expect(to).toEqual(["carlo@x.it", "badante@x.it", "maria@x.it"]);
  });
});
