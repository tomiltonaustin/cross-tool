"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseCSV } from "@/lib/parsers/csv";

const TEMPLATE_COLUMNS = [
  "manufacturer",
  "model_number",
  "category",
  "form_factor",
  "lumens",
  "cct",
  "wattage",
  "voltage",
  "mounting_type",
  "cri",
  "dimming_protocol",
  "description",
  "discontinued",
];

export default function ProductImportPage() {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const supabase = createClient();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      const { headers: h, rows } = parseCSV(text);
      setHeaders(h);
      setRowCount(rows.length);
      setPreview(rows.slice(0, 5));
      setResult(null);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!csvText) return;
    setImporting(true);
    setResult(null);

    const { rows } = parseCSV(csvText);

    // Collect unique manufacturer names from CSV
    const mfrNames = [...new Set(
      rows.map((r) => (r.manufacturer ?? "").trim()).filter(Boolean)
    )];

    if (mfrNames.length === 0) {
      setResult("Error: No manufacturer names found. Ensure your CSV has a 'manufacturer' column.");
      setImporting(false);
      return;
    }

    // Fetch existing manufacturers
    const { data: existingMfrs } = await supabase
      .from("manufacturers")
      .select("id, name");
    const mfrMap = new Map(
      (existingMfrs ?? []).map((m) => [m.name.toLowerCase(), m.id])
    );

    // Auto-create missing manufacturers
    const newMfrNames = mfrNames.filter((n) => !mfrMap.has(n.toLowerCase()));
    if (newMfrNames.length > 0) {
      const { data: created } = await supabase
        .from("manufacturers")
        .insert(newMfrNames.map((name) => ({ name })))
        .select();
      for (const m of created ?? []) {
        mfrMap.set(m.name.toLowerCase(), m.id);
      }
    }

    // Build product rows
    const products = rows
      .filter((r) => r.manufacturer && r.model_number)
      .map((r) => ({
        manufacturer_id: mfrMap.get((r.manufacturer ?? "").trim().toLowerCase()) ?? "",
        model_number: (r.model_number ?? "").trim(),
        category: r.category?.trim() || null,
        form_factor: r.form_factor?.trim() || null,
        lumens: parseNum(r.lumens),
        cct: parseNum(r.cct),
        wattage: parseNum(r.wattage),
        voltage: r.voltage?.trim() || null,
        mounting_type: r.mounting_type?.trim() || null,
        cri: parseFloat(r.cri) || null,
        dimming_protocol: r.dimming_protocol?.trim() || null,
        description: r.description?.trim() || null,
        discontinued: r.discontinued?.trim().toLowerCase() === "true",
      }))
      .filter((p) => p.manufacturer_id);

    if (products.length === 0) {
      setResult("Error: No valid product rows found. Check that 'manufacturer' and 'model_number' columns have data.");
      setImporting(false);
      return;
    }

    // Insert in batches of 500
    let imported = 0;
    for (let i = 0; i < products.length; i += 500) {
      const batch = products.slice(i, i + 500);
      const { data, error } = await supabase.from("products").insert(batch).select("id");
      if (error) {
        setResult(`Error at row ${i}: ${error.message}`);
        setImporting(false);
        return;
      }
      imported += (data?.length ?? 0);
    }

    const mfrCount = newMfrNames.length;
    setResult(
      `Imported ${imported} products across ${mfrNames.length} manufacturers` +
      (mfrCount > 0 ? ` (${mfrCount} new manufacturers created).` : ".")
    );
    setImporting(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Products</h1>
        <p className="mt-1 text-gray-600">
          Upload a CSV matching the template format. Manufacturers are auto-created if they don't exist.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Expected columns:</p>
          <p className="text-xs text-gray-500 font-mono">
            {TEMPLATE_COLUMNS.join(", ")}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">CSV File</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="mt-1 text-sm"
          />
        </div>

        {preview && (
          <div className="overflow-x-auto">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Preview (first 5 of {rowCount} rows):
            </p>
            <table className="min-w-full text-xs border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="border-b px-3 py-2 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {headers.map((h) => (
                      <td key={h} className="border-b px-3 py-1.5 whitespace-nowrap">
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={!csvText || importing}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {importing ? "Importing..." : "Import Products"}
        </button>

        {result && (
          <p className={`text-sm ${result.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
            {result}
          </p>
        )}
      </div>
    </div>
  );
}

function parseNum(val: string | undefined): number | null {
  if (!val) return null;
  const n = parseInt(val.replace(/[^0-9.-]/g, ""), 10);
  return isNaN(n) ? null : n;
}
