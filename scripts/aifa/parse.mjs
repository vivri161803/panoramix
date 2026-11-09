// Lettura e normalizzazione dei file AIFA: funzioni pure, senza rete né database.
// Formati verificati: scripts/aifa/README.md. Test: tests/aifa-parse.test.ts.

/** Lettore CSV con virgolette ("" = virgoletta), a capo dentro i campi e righe \r\n, \r o \n. */
export function* parseCsv(text, delimiter = ";") {
  let row = [];
  let field = "";
  let quoted = false;
  let i = 0;
  const n = text.length;
  if (text.charCodeAt(0) === 0xfeff) i = 1; // BOM
  while (i < n) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"' && field === "") {
      quoted = true;
      i++;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
      i++;
    } else if (c === "\r" || c === "\n") {
      row.push(field);
      yield row;
      row = [];
      field = "";
      i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
    } else {
      field += c;
      i++;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    yield row;
  }
}

/** AIC a 9 cifre (la lista di trasparenza toglie gli zeri iniziali); null se non è un AIC. */
export function aic9(s) {
  const t = String(s ?? "").trim().replace(/^A/i, "");
  if (!/^\d{1,9}$/.test(t)) return null;
  return t.padStart(9, "0");
}

const ND = new Set(["", "N.D.", "ND", "N.D", "Q.TA E UM NON PRESENTI SU ET"]);

/** Testo ripulito; null per vuoti e "N.D.". */
export function text(s) {
  const t = String(s ?? "").trim();
  return ND.has(t.toUpperCase()) ? null : t;
}

/** Numero con virgola o punto decimale, euro e spazi ammessi: "5,63 €" → 5.63, " 0.0" → 0. */
export function num(s) {
  let t = String(s ?? "").replace(/€/g, "").replace(/\s/g, "");
  if (t === "" || ND.has(t.toUpperCase())) return null;
  // 1.234,56 → 1234.56; 0.0 resta 0.0
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** "05/11/2026" → "2026-11-05"; null se vuota o non valida. */
export function itDate(s) {
  const m = String(s ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return isoOrNull(+m[3], +m[2], +m[1]);
}

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** Data in parole: "15 ottobre 2026" (anche dentro un testo più lungo) → "2026-10-15". */
export function itWordsDate(s) {
  const m = String(s ?? "").toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2]) + 1;
  return month ? isoOrNull(+m[3], month, +m[1]) : null;
}

function isoOrNull(y, mo, d) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// numero + (eventuale "(2X14)") + compresse/capsule/…: si prende l'ultimo della descrizione
const UNITS_RE = /(\d+)\s*(?:\(\s*\d+\s*X\s*\d+\s*\)\s*)?(?:COMPRESS[EA]|CAPSUL[EA]|CPR|CPS|PERL[EA]|CONFETT[IO]|PASTIGLI[EA]|GOMM[EA]|OVUL[IO]|BUSTIN[EA])\b/gi;

/** Compresse (o capsule, bustine…) per confezione lette dalla descrizione; null se non si capisce. */
export function doseUnitsFromDescription(desc) {
  let last = null;
  for (const m of String(desc ?? "").matchAll(UNITS_RE)) {
    // "500 MG COMPRESSE" non conta: il numero è seguito dall'unità di misura, non dalla parola
    last = Number(m[1]);
  }
  return last && last >= 1 && last <= 1000 ? last : null;
}

/** Il regime di fornitura richiede la ricetta? null se il dato manca. */
export function requiresPrescription(regime) {
  const t = String(regime ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t.startsWith("medicinali non soggetti")) return false;
  if (t.startsWith("medicinali soggetti")) return true;
  return null;
}

// ——— Sorgenti ———

/**
 * Ogni sorgente: dove si scarica, codifica, righe di preambolo, intestazioni attese
 * (stringa esatta o { prefix }), tabella e conversione di una riga.
 */
export const SOURCES = {
  confezioni: {
    url: "https://drive.aifa.gov.it/farmaci/confezioni_fornitura.csv",
    encoding: "utf-8",
    preamble: 0,
    headers: ["CODICE_AIC", "COD_FARMACO", "COD_CONFEZIONE", "DENOMINAZIONE", "DESCRIZIONE", "CODICE_DITTA", "RAGIONE_SOCIALE", "STATO_AMMINISTRATIVO", "TIPO_PROCEDURA", "FORMA", "CODICE_ATC", "PA_ASSOCIATI", "FORNITURA", "LINK_FI", "LINK_RCP"],
    table: "aifa_packs",
    key: ["aic"],
    map(r) {
      const aic = aic9(r[0]);
      if (!aic) return null;
      return {
        aic,
        name: r[3].trim(),
        pack_description: r[4].trim(),
        form: r[9].trim(),
        atc_code: text(r[10])?.toUpperCase() ?? null,
        dose_units: doseUnitsFromDescription(r[4]),
        rx_regime: text(r[12]),
      };
    },
  },
  principi_attivi: {
    url: "https://drive.aifa.gov.it/farmaci/PA_confezioni.csv",
    encoding: "utf-8",
    preamble: 0,
    headers: ["CODICE_AIC", "PRINCIPIO_ATTIVO", "QUANTITA", "UNITA_MISURA"],
    table: "aifa_pack_ingredients",
    key: ["aic", "position"],
    map(r) {
      const aic = aic9(r[0]);
      const ingredient = text(r[1]);
      if (!aic || !ingredient) return null;
      const unit = text(r[3]);
      let qty = num(r[2]);
      if (qty === 0 || unit === null) qty = null;
      // position la assegna parseSource, nell'ordine del file
      return { aic, ingredient, qty, unit: qty === null ? null : unit };
    },
  },
  atc: {
    url: "https://drive.aifa.gov.it/farmaci/atc.csv",
    encoding: "utf-8",
    preamble: 0,
    headers: ["CODICE_ATC", "DESCRIZIONE"],
    table: "aifa_atc",
    key: ["code"],
    map(r) {
      const code = text(r[0])?.toUpperCase();
      if (!code) return null;
      return { code, description: (r[1] ?? "").trim() };
    },
  },
  carenze: {
    url: "https://www.aifa.gov.it/documents/20142/847339/elenco_medicinali_carenti.csv",
    encoding: "windows-1252",
    preamble: 2,
    headers: ["Nome medicinale", "Codice AIC", "Principio attivo", "Forma farmaceutica e dosaggio", "Titolare AIC", "Data inizio", "Fine presunta", "Equivalente", "Motivazioni", "Suggerimenti/Indicazioni AIFA", "Nota AIFA", "Classe di rimborsabilità", "Codice ATC"],
    table: "aifa_shortages",
    key: null, // lo stesso AIC può comparire due volte: si inserisce e basta
    sourceDate(preamble) {
      for (const row of preamble) {
        const m = row.join(" ").match(/aggiornato al\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
        if (m) return itDate(m[1]);
      }
      return null;
    },
    map(r) {
      const aic = aic9(r[1]);
      if (!aic) return null;
      const t = (i) => (r[i] ?? "").trim();
      return {
        aic,
        name: t(0),
        ingredient: t(2),
        form_strength: t(3),
        started_on: itDate(r[5]),
        expected_end: itDate(r[6]),
        equivalent: t(7),
        reasons: t(8),
        aifa_suggestions: t(9),
        aifa_note: t(10),
        atc_code: text(r[12])?.toUpperCase() ?? null,
      };
    },
  },
  trasparenza: {
    url: "https://www.aifa.gov.it/documents/20142/825643/Lista_farmaci_equivalenti.csv",
    encoding: "windows-1252",
    preamble: 0,
    headers: ["Principio attivo", "Confezione di riferimento", "ATC", "AIC", "Farmaco", "Confezione", "Ditta", "Prezzo riferimento SSN", { prefix: "Prezzo Pubblico" }, "Differenza", "Nota", "Codice gruppo equivalenza"],
    table: "aifa_transparency",
    key: ["aic"],
    sourceDate(_preamble, header) {
      return itWordsDate(header[8]);
    },
    map(r, ctx) {
      const aic = aic9(r[3]);
      const group = text(r[11]);
      if (!aic || !group) return null;
      const t = (i) => (r[i] ?? "").trim();
      return {
        aic,
        ingredient: t(0),
        reference_pack: t(1),
        atc_code: text(r[2])?.toUpperCase() ?? null,
        name: t(4),
        pack_description: t(5),
        reference_price: num(r[7]),
        public_price: num(r[8]),
        price_difference: num(r[9]),
        note: t(10),
        group_code: group,
        prices_as_of: ctx.sourceDate,
      };
    },
  },
};

export class HeaderMismatchError extends Error {}

function headerMatches(expected, got) {
  if (got.length < expected.length) return false;
  return expected.every((e, i) => {
    const g = String(got[i] ?? "").trim();
    return typeof e === "string" ? g === e : g.startsWith(e.prefix);
  });
}

/** Decodifica i byte con la codifica della sorgente. */
export function decode(bytes, encoding) {
  return new TextDecoder(encoding).decode(bytes);
}

/** Massima quota di righe scartate (AIC non valido, riga vuota) prima di considerare il file rotto. */
const MAX_SKIPPED_SHARE = 0.02;

/**
 * Legge il testo di una sorgente: controlla le intestazioni, converte le righe, toglie i doppioni
 * di chiave (vale l'ultima) e numera i principi attivi. Lancia un errore leggibile se il file
 * non è come previsto: in quel caso non si importa nulla.
 */
export function parseSource(name, content) {
  const spec = SOURCES[name];
  if (!spec) throw new Error(`Sorgente sconosciuta: ${name}`);
  const it = parseCsv(content);
  const preamble = [];
  for (let i = 0; i < spec.preamble; i++) {
    const r = it.next();
    if (r.done) throw new HeaderMismatchError(`Il file di ${name} è vuoto.`);
    preamble.push(r.value);
  }
  const head = it.next();
  if (head.done || !headerMatches(spec.headers, head.value)) {
    const got = head.done ? "(nessuna)" : head.value.map((h) => h.trim()).join(";");
    throw new HeaderMismatchError(`AIFA ha cambiato le colonne di ${name}: attese ${spec.headers.map((h) => (typeof h === "string" ? h : `${h.prefix}…`)).join(";")}, trovate ${got}.`);
  }
  const sourceDate = spec.sourceDate ? spec.sourceDate(preamble, head.value) : null;
  const ctx = { sourceDate };
  const byKey = new Map();
  const rows = [];
  const positions = new Map();
  let total = 0;
  let skipped = 0;
  for (const r of it) {
    if (r.every((v) => v.trim() === "")) continue;
    total++;
    const rec = spec.map(r, ctx);
    if (!rec) {
      skipped++;
      continue;
    }
    if (name === "principi_attivi") {
      const p = (positions.get(rec.aic) ?? 0) + 1;
      positions.set(rec.aic, p);
      rec.position = p;
    }
    if (spec.key) byKey.set(spec.key.map((k) => rec[k]).join("|"), rec);
    else rows.push(rec);
  }
  if (total === 0) throw new HeaderMismatchError(`Il file di ${name} non ha righe.`);
  // principi attivi: molte righe sono solo "N.D." (confezioni senza dati), non vanno contate
  if (name !== "principi_attivi" && skipped / total > MAX_SKIPPED_SHARE) {
    throw new HeaderMismatchError(`Il file di ${name} ha ${skipped} righe su ${total} senza codice valido: controlla il formato.`);
  }
  return { rows: spec.key ? [...byKey.values()] : rows, sourceDate, total, skipped };
}

/** Sotto questa quota delle righe dell'ultimo import riuscito il file nuovo si rifiuta. */
export const MIN_ROWS_SHARE = 0.5;

/** Lancia un errore se il file nuovo ha meno della metà delle righe dell'ultimo import riuscito. */
export function checkShrink(name, rows, previousRows) {
  if (!previousRows || previousRows < 20) return;
  if (rows < previousRows * MIN_ROWS_SHARE) {
    throw new Error(`Il file di ${name} ha ${rows} righe contro le ${previousRows} dell'ultimo import: sembra incompleto, restano i dati di prima (usa --force per importarlo comunque).`);
  }
}
