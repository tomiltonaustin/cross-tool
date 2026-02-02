import Papa from "papaparse";
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

const HEADER_PATTERNS: Record<keyof ColumnMapping, RegExp[]> = {
  type_designation: [/^type$/i, /type\s*(mark|designation|id)/i, /^tag$/i, /^mark$/i, /fixture\s*type/i],
  manufacturer: [/^mfr$/i, /^manufacturer$/i, /^mfg$/i, /^brand$/i, /manuf/i],
  model: [/^model$/i, /catalog\s*(#|num|no)/i, /^cat\s*#?$/i, /part\s*(#|num|no)/i, /model\s*(#|num|no)/i, /^product$/i],
  lumens: [/^lumens$/i, /^lm$/i, /lumen/i, /^output$/i],
  cct: [/^cct$/i, /color\s*temp/i, /kelvin/i, /^k$/i],
  wattage: [/^watt(s|age)?$/i, /^w$/i, /^power$/i],
  mounting_type: [/^mount(ing)?$/i, /mount\s*type/i, /installation/i],
  voltage: [/^volt(s|age)?$/i, /^v$/i],
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
    type_designation: mapping.type_designation ? row[mapping.type_designation] || null : null,
    specified_manufacturer: mapping.manufacturer ? row[mapping.manufacturer] || null : null,
    specified_model: mapping.model ? row[mapping.model] || null : null,
    lumens: mapping.lumens ? parseNumeric(row[mapping.lumens]) : null,
    cct: mapping.cct ? parseNumeric(row[mapping.cct]) : null,
    wattage: mapping.wattage ? parseNumeric(row[mapping.wattage]) : null,
    mounting_type: mapping.mounting_type ? row[mapping.mounting_type] || null : null,
    voltage: mapping.voltage ? row[mapping.voltage] || null : null,
    quantity: mapping.quantity ? parseNumeric(row[mapping.quantity]) ?? 1 : 1,
  }));
}

function parseNumeric(val: string | undefined): number | null {
  if (!val) return null;
  const n = parseInt(val.replace(/[^0-9.-]/g, ""), 10);
  return isNaN(n) ? null : n;
}
