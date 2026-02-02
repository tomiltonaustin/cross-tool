"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseCSV, autoDetectColumns, applyMapping } from "@/lib/parsers/csv";
import type { Manufacturer } from "@/types";

export default function ProductImportPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [selectedMfr, setSelectedMfr] = useState("");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("manufacturers")
      .select("*")
      .order("name")
      .then(({ data }) => setManufacturers(data ?? []));
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      const { headers: h, rows } = parseCSV(text);
      setHeaders(h);
      setPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!selectedMfr || !csvText) return;
    setImporting(true);
    setResult(null);

    const { rows } = parseCSV(csvText);
    const mapping = autoDetectColumns(headers);
    const parsed = applyMapping(rows, mapping);

    const products = parsed.map((row) => ({
      manufacturer_id: selectedMfr,
      model_number: row.specified_model ?? "Unknown",
      form_factor: row.mounting_type,
      lumens: row.lumens,
      cct: row.cct,
      wattage: row.wattage,
      mounting_type: row.mounting_type,
      voltage: row.voltage,
      description: [row.mounting_type, row.lumens ? `${row.lumens}lm` : null, row.cct ? `${row.cct}K` : null]
        .filter(Boolean)
        .join(", "),
    }));

    const { error, data } = await supabase.from("products").insert(products).select();
    setImporting(false);
    if (error) {
      setResult(`Error: ${error.message}`);
    } else {
      setResult(`Imported ${data.length} products.`);
      setCsvText("");
      setPreview(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Products</h1>
        <p className="mt-1 text-gray-600">
          Upload a CSV with product data to populate your catalog.
        </p>
        <p className="mt-1 text-sm text-gray-400">
          Expected columns: Model, Lumens, CCT, Wattage, Mounting, Voltage
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Manufacturer</label>
          <select
            value={selectedMfr}
            onChange={(e) => setSelectedMfr(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm w-full max-w-sm"
          >
            <option value="">Select manufacturer...</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
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
              Preview (first 5 rows):
            </p>
            <table className="min-w-full text-xs border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="border-b px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {headers.map((h) => (
                      <td key={h} className="border-b px-3 py-1.5">
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
          disabled={!selectedMfr || !csvText || importing}
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
