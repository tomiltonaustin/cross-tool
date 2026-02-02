"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseFile, autoDetectColumns, applyMapping } from "@/lib/parsers/csv";
import type { ColumnMapping, ParsedScheduleRow } from "@/types";

export default function NewProjectPage() {
  const router = useRouter();
  const supabase = createClient();

  const [projectName, setProjectName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<ParsedScheduleRow[]>([]);
  const [step, setStep] = useState<"upload" | "map" | "confirm">("upload");
  const [creating, setCreating] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProjectName(file.name.replace(/\.[^.]+$/, ""));
    parseFile(file, ({ headers: h, rows }) => {
      setHeaders(h);
      setRawRows(rows);
      const autoMapping = autoDetectColumns(h);
      setMapping(autoMapping);
      setStep("map");
    });
  }

  function updateMapping(field: keyof ColumnMapping, value: string) {
    setMapping((prev) => ({ ...prev, [field]: value || undefined }));
  }

  function confirmMapping() {
    const parsed = applyMapping(rawRows, mapping);
    setPreview(parsed);
    setStep("confirm");
  }

  async function createProject() {
    setCreating(true);

    // Get or create agency
    let agencyId = localStorage.getItem("agency_id");
    if (!agencyId) {
      const { data } = await supabase
        .from("agencies")
        .insert({ name: "My Agency" })
        .select()
        .single();
      if (data) {
        agencyId = data.id;
        localStorage.setItem("agency_id", data.id);
      }
    }
    if (!agencyId) return;

    // Get line card manufacturer names
    const { data: lineCards } = await supabase
      .from("line_cards")
      .select("manufacturer_id, manufacturers(name)")
      .eq("agency_id", agencyId);

    const lineCardMfrNames = new Set(
      (lineCards ?? []).map((lc) => {
        const mfr = lc.manufacturers as unknown as { name: string };
        return mfr?.name?.toLowerCase();
      }).filter(Boolean)
    );

    // Create project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        agency_id: agencyId,
        created_by: agencyId,
        name: projectName || "Untitled Project",
        status: "draft",
      })
      .select()
      .single();

    if (projectError || !project) {
      console.error("Failed to create project:", projectError);
      setCreating(false);
      return;
    }

    // Insert schedule items
    const parsed = applyMapping(rawRows, mapping);
    const items = parsed.map((row) => ({
      project_id: project.id,
      type_designation: row.type_designation,
      specified_manufacturer: row.specified_manufacturer,
      specified_model: row.specified_model,
      description: row.description,
      lumens: row.lumens,
      cct: row.cct,
      wattage: row.wattage,
      mounting_type: row.mounting_type,
      voltage: row.voltage,
      lamp_type: row.lamp_type,
      application: row.application,
      dimming_protocol: row.dimming_protocol,
      cri: row.cri,
      notes: row.notes,
      quantity: row.quantity,
      on_line_card: row.specified_manufacturer
        ? lineCardMfrNames.has(row.specified_manufacturer.toLowerCase())
        : false,
      match_status: "pending" as const,
    }));

    await supabase.from("schedule_items").insert(items);

    router.push(`/projects/${project.id}`);
  }

  const mappingFields: { key: keyof ColumnMapping; label: string }[] = [
    { key: "type_designation", label: "Type / Tag" },
    { key: "manufacturer", label: "Manufacturer" },
    { key: "model", label: "Model / Part Number" },
    { key: "description", label: "Description" },
    { key: "lumens", label: "Lumens" },
    { key: "cct", label: "CCT" },
    { key: "wattage", label: "Wattage" },
    { key: "voltage", label: "Voltage" },
    { key: "lamp_type", label: "Lamp Type" },
    { key: "mounting_type", label: "Mounting Type" },
    { key: "application", label: "Application" },
    { key: "dimming_protocol", label: "Dimming" },
    { key: "cri", label: "CRI" },
    { key: "notes", label: "Notes" },
    { key: "quantity", label: "Quantity" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Project</h1>

      {step === "upload" && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-600 mb-4">Upload a luminaire schedule (CSV or Excel)</p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFile}
            className="text-sm"
          />
        </div>
      )}

      {step === "map" && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm w-full max-w-md"
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold mb-4">Map Columns</h2>
            <p className="text-sm text-gray-500 mb-4">
              Auto-detected mappings shown below. Adjust if needed.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mappingFields.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500">{label}</label>
                  <select
                    value={mapping[key] ?? ""}
                    onChange={(e) => updateMapping(key, e.target.value)}
                    className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm w-full"
                  >
                    <option value="">— Not mapped —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {rawRows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <p className="px-4 pt-3 text-sm text-gray-500">
                Raw data preview ({rawRows.length} rows):
              </p>
              <table className="min-w-full text-xs">
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
                  {rawRows.slice(0, 5).map((row, i) => (
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
            onClick={confirmMapping}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Continue
          </button>
        </div>
      )}

      {step === "confirm" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold mb-2">Mapped Schedule Preview</h2>
            <p className="text-sm text-gray-500 mb-4">{preview.length} line items</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Manufacturer</th>
                    <th className="px-3 py-2 text-left font-medium">Model</th>
                    <th className="px-3 py-2 text-left font-medium">Description</th>
                    <th className="px-3 py-2 text-left font-medium">Lumens</th>
                    <th className="px-3 py-2 text-left font-medium">CCT</th>
                    <th className="px-3 py-2 text-left font-medium">Wattage</th>
                    <th className="px-3 py-2 text-left font-medium">Voltage</th>
                    <th className="px-3 py-2 text-left font-medium">Lamp</th>
                    <th className="px-3 py-2 text-left font-medium">Application</th>
                    <th className="px-3 py-2 text-left font-medium">CRI</th>
                    <th className="px-3 py-2 text-left font-medium">Dimming</th>
                    <th className="px-3 py-2 text-left font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      <td className="border-b px-3 py-1.5">{row.type_designation ?? "—"}</td>
                      <td className="border-b px-3 py-1.5">{row.specified_manufacturer ?? "—"}</td>
                      <td className="border-b px-3 py-1.5">{row.specified_model ?? "—"}</td>
                      <td className="border-b px-3 py-1.5">{row.description ?? "—"}</td>
                      <td className="border-b px-3 py-1.5">{row.lumens ?? "—"}</td>
                      <td className="border-b px-3 py-1.5">{row.cct ?? "—"}</td>
                      <td className="border-b px-3 py-1.5">{row.wattage ?? "—"}</td>
                      <td className="border-b px-3 py-1.5">{row.voltage ?? "—"}</td>
                      <td className="border-b px-3 py-1.5">{row.lamp_type ?? "—"}</td>
                      <td className="border-b px-3 py-1.5">{row.application ?? "—"}</td>
                      <td className="border-b px-3 py-1.5">{row.cri ?? "—"}</td>
                      <td className="border-b px-3 py-1.5">{row.dimming_protocol ?? "—"}</td>
                      <td className="border-b px-3 py-1.5">{row.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("map")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={createProject}
              disabled={creating}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Project & Find Matches"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
