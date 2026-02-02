import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ColumnMapping, ParsedScheduleRow } from "@/types";

export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
  };
}

export function parseExcel(buffer: ArrayBuffer): { headers: string[]; rows: Record<string, string>[] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Get raw data as array of arrays to handle headers ourselves
  const raw = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: "" });
  if (raw.length === 0) return { headers: [], rows: [] };

  const headers = raw[0].map((h) => String(h).trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < raw.length; i++) {
    const row: Record<string, string> = {};
    let hasData = false;
    for (let j = 0; j < headers.length; j++) {
      const val = String(raw[i][j] ?? "").trim();
      row[headers[j]] = val;
      if (val) hasData = true;
    }
    if (hasData) rows.push(row);
  }

  return { headers, rows };
}

export function parseFile(
  file: File,
  callback: (result: { headers: string[]; rows: Record<string, string>[] }) => void
) {
  const isExcel = /\.xlsx?$/i.test(file.name);

  if (isExcel) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      callback(parseExcel(buffer));
    };
    reader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      callback(parseCSV(text));
    };
    reader.readAsText(file);
  }
}

const HEADER_PATTERNS: Record<keyof ColumnMapping, RegExp[]> = {
  type_designation: [/^type$/i, /type\s*(mark|designation|id)/i, /^tag$/i, /^mark$/i, /fixture\s*type/i],
  manufacturer: [/^mfr$/i, /^manufacturer$/i, /^mfg$/i, /^brand$/i, /manuf/i],
  model: [/^model$/i, /catalog\s*(#|num|no)/i, /^cat\s*#?$/i, /part\s*(#|num|no)/i, /model\s*(#|num|no)/i, /^product$/i, /^part number$/i],
  description: [/^desc(ription)?$/i, /^fixture\s*desc/i],
  lumens: [/^lumens$/i, /^lm$/i, /lumen/i, /^output$/i],
  cct: [/^cct$/i, /color\s*temp/i, /kelvin/i],
  wattage: [/^watt(s|age)?$/i, /^w$/i, /^power$/i],
  mounting_type: [/^mount(ing)?$/i, /mount\s*type/i, /installation/i],
  voltage: [/^volt(s|age)?$/i, /^v$/i],
  lamp_type: [/^lamp\s*type$/i, /^lamp$/i, /^source$/i, /^light\s*source$/i],
  application: [/^application$/i, /^app$/i, /^use$/i, /^fixture\s*category/i],
  dimming_protocol: [/^dimm(ing|er)?$/i, /dim\s*(type|protocol|method)/i, /^control$/i],
  cri: [/^cri$/i, /color\s*render/i],
  notes: [/^notes?$/i, /^remarks?$/i, /^comment/i],
  quantity: [/^qty$/i, /^quantity$/i, /^count$/i, /^#$/i],
};

export function autoDetectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
    for (const header of headers) {
      if (patterns.some((p) => p.test(header))) {
        (mapping as Record<string, string>)[field] = header;
        break;
      }
    }
  }

  return mapping;
}

export function applyMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping
): ParsedScheduleRow[] {
  return rows.map((row) => ({
    type_designation: getStr(row, mapping.type_designation),
    specified_manufacturer: getStr(row, mapping.manufacturer),
    specified_model: getStr(row, mapping.model),
    description: getStr(row, mapping.description),
    lumens: parseNumeric(row[mapping.lumens ?? ""]),
    cct: parseCCT(row[mapping.cct ?? ""]),
    wattage: parseNumeric(row[mapping.wattage ?? ""]),
    mounting_type: getStr(row, mapping.mounting_type),
    voltage: getStr(row, mapping.voltage),
    lamp_type: getStr(row, mapping.lamp_type),
    application: getStr(row, mapping.application),
    dimming_protocol: getStr(row, mapping.dimming_protocol),
    cri: parseNumeric(row[mapping.cri ?? ""]),
    notes: getStr(row, mapping.notes),
    quantity: parseNumeric(row[mapping.quantity ?? ""]) ?? 1,
  }));
}

function getStr(row: Record<string, string>, key: string | undefined): string | null {
  if (!key) return null;
  const val = row[key]?.trim();
  if (!val || val === "-" || val === "—") return null;
  return val;
}

function parseNumeric(val: string | undefined): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseCCT(val: string | undefined): number | null {
  if (!val) return null;
  // Handle "SELECTABLE", "TUNABLE", etc.
  if (/select|tunable|adjustable/i.test(val)) return null;
  return parseNumeric(val);
}
