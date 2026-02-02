"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Project, ScheduleItem, CrossReference, Product } from "@/types";

type ItemWithMatch = ScheduleItem & {
  accepted_product: (Product & { manufacturer: { name: string } }) | null;
};

export default function SubmittalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<ItemWithMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    const { data: proj } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();
    setProject(proj);

    const { data: scheduleItems } = await supabase
      .from("schedule_items")
      .select(`
        *,
        cross_references(
          *,
          product:products(
            *,
            manufacturer:manufacturers(name)
          )
        )
      `)
      .eq("project_id", id)
      .order("type_designation");

    const mapped: ItemWithMatch[] = ((scheduleItems as ScheduleItem[]) ?? []).map((item) => {
      const refs = (item as unknown as { cross_references: (CrossReference & { product: Product & { manufacturer: { name: string } } })[] }).cross_references ?? [];
      const accepted = refs.find((cr) => cr.status === "accepted");
      return {
        ...item,
        accepted_product: accepted?.product ?? null,
      };
    });

    setItems(mapped);
    setLoading(false);
  }

  if (loading) return <div className="py-8 text-gray-500">Loading...</div>;
  if (!project) return <div className="py-8 text-red-500">Project not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Submittal: {project.name}</h1>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 print:hidden"
        >
          Print / Save PDF
        </button>
      </div>

      {/* Printable submittal */}
      <div className="rounded-lg border border-gray-200 bg-white p-8 print:border-0 print:p-0">
        <div className="mb-8 border-b pb-4">
          <h2 className="text-xl font-bold">Lighting Submittal</h2>
          <p className="text-gray-600">{project.name}</p>
          <p className="text-sm text-gray-400">
            Generated {new Date().toLocaleDateString()}
          </p>
        </div>

        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b-2 text-left text-xs font-semibold uppercase text-gray-500">
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Specified</th>
              <th className="pb-2 pr-4">Proposed Alternative</th>
              <th className="pb-2 pr-4">Lumens</th>
              <th className="pb-2 pr-4">CCT</th>
              <th className="pb-2 pr-4">Wattage</th>
              <th className="pb-2 pr-4">Mounting</th>
              <th className="pb-2">Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="py-2 pr-4 font-mono font-bold text-xs">
                  {item.type_designation ?? "—"}
                </td>
                <td className="py-2 pr-4">
                  <div className="font-medium">{item.specified_manufacturer}</div>
                  <div className="text-xs text-gray-500">{item.specified_model}</div>
                </td>
                <td className="py-2 pr-4">
                  {item.on_line_card ? (
                    <span className="text-green-700 text-xs">On line card - as specified</span>
                  ) : item.accepted_product ? (
                    <div>
                      <div className="font-medium text-blue-700">
                        {item.accepted_product.manufacturer?.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.accepted_product.model_number}
                      </div>
                    </div>
                  ) : (
                    <span className="text-red-500 text-xs">No alternative selected</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-xs">
                  {item.accepted_product?.lumens ?? item.lumens ?? "—"}
                </td>
                <td className="py-2 pr-4 text-xs">
                  {(item.accepted_product?.cct ?? item.cct) ? `${item.accepted_product?.cct ?? item.cct}K` : "—"}
                </td>
                <td className="py-2 pr-4 text-xs">
                  {(item.accepted_product?.wattage ?? item.wattage) ? `${item.accepted_product?.wattage ?? item.wattage}W` : "—"}
                </td>
                <td className="py-2 pr-4 text-xs">
                  {item.accepted_product?.mounting_type ?? item.mounting_type ?? "—"}
                </td>
                <td className="py-2 text-xs">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
