/**
 * A small CSV reader for batch input.
 *
 * People arrive with a spreadsheet exported from a CMS, so CSV is the
 * format that costs them nothing. Quoted fields and embedded commas,
 * quotes and newlines are handled, because a headline containing a comma
 * is the first row anyone will paste.
 */

export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  // Strip a byte-order mark, which spreadsheet exports routinely include.
  const text = input.replace(/^﻿/, "");

  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop rows that are entirely empty, which trailing newlines produce.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export interface CsvBatchRow {
  key?: string;
  params: Record<string, string>;
}

export type CsvParseResult =
  | { ok: true; rows: CsvBatchRow[]; columns: string[] }
  | { ok: false; error: string };

/**
 * Turns a CSV into batch rows. The header names the parameters; a `key`
 * column, if present, names each row instead of being passed to the
 * renderer.
 */
export function csvToRows(input: string): CsvParseResult {
  const table = parseCsv(input);
  if (table.length === 0) return { ok: false, error: "That CSV is empty." };
  const header = table[0].map((h) => h.trim());
  if (header.every((h) => h === "")) {
    return { ok: false, error: "The first row must name the columns." };
  }
  if (table.length === 1) {
    return { ok: false, error: "That CSV has a header but no rows." };
  }
  const seen = new Set<string>();
  for (const name of header) {
    if (name && seen.has(name)) {
      return { ok: false, error: `Column "${name}" appears twice.` };
    }
    seen.add(name);
  }

  const rows: CsvBatchRow[] = table.slice(1).map((cells) => {
    const params: Record<string, string> = {};
    let key: string | undefined;
    header.forEach((name, idx) => {
      const value = (cells[idx] ?? "").trim();
      if (!name || value === "") return;
      if (name === "key") key = value;
      else params[name] = value;
    });
    return { key, params };
  });

  return { ok: true, rows, columns: header.filter(Boolean) };
}
