"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { scoreProducts } from "@/lib/matching/structured";
import type { ScheduleItem, Product, CrossReference, Project } from "@/types";

type ScheduleItemWithRefs = ScheduleItem & {
  cross_references: (CrossReference & { product: Product & { manufacturer: { name: string } } })[];
};

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<ScheduleItemWithRefs[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    loadProject();
  }, [id]);

  async function loadProject() {
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

    setItems((scheduleItems as ScheduleItemWithRefs[]) ?? []);
    setLoading(false);
  }

  async function runMatching() {
    setMatching(true);

    // Get agency line card
    const agencyId = localStorage.getItem("agency_id");
    if (!agencyId) {
      setMatching(false);
      return;
    }

    const { data: lineCards } = await supabase
      .from("line_cards")
      .select("manufacturer_id")
      .eq("agency_id", agencyId);
    const lineCardMfrIds = (lineCards ?? []).map((lc) => lc.manufacturer_id);

    if (lineCardMfrIds.length === 0) {
      alert("No manufacturers on your line card. Add some first.");
      setMatching(false);
      return;
    }

    // Get all products from line card manufacturers
    const { data: candidateProducts } = await supabase
      .from("products")
      .select("*, manufacturer:manufacturers(name)")
      .in("manufacturer_id", lineCardMfrIds)
      .eq("discontinued", false);

    if (!candidateProducts || candidateProducts.length === 0) {
      alert("No products found from your line card manufacturers. Import some first.");
      setMatching(false);
      return;
    }

    // For each unmatched item not on line card, find alternatives
    const unmatchedItems = items.filter(
      (item) => !item.on_line_card && item.match_status === "pending"
    );

    for (const item of unmatchedItems) {
      const scored = scoreProducts(item, candidateProducts as Product[]);
      const topMatches = scored.slice(0, 3);

      if (topMatches.length > 0) {
        const refs = topMatches.map((match) => ({
          schedule_item_id: item.id,
          product_id: match.id,
          match_score: match.match_score,
          match_reasoning: match.match_reasoning,
          status: "proposed" as const,
        }));

        await supabase.from("cross_references").insert(refs);
        await supabase
          .from("schedule_items")
          .update({ match_status: "matched" })
          .eq("id", item.id);
      } else {
        await supabase
          .from("schedule_items")
          .update({ match_status: "no_match" })
          .eq("id", item.id);
      }
    }

    // Mark on-line-card items
    const onCardItems = items.filter((item) => item.on_line_card && item.match_status === "pending");
    for (const item of onCardItems) {
      await supabase
        .from("schedule_items")
        .update({ match_status: "accepted" })
        .eq("id", item.id);
    }

    await loadProject();
    setMatching(false);
  }

  async function acceptMatch(scheduleItemId: string, crossRefId: string) {
    // Reject all other proposals for this item
    await supabase
      .from("cross_references")
      .update({ status: "rejected" })
      .eq("schedule_item_id", scheduleItemId)
      .neq("id", crossRefId);

    // Accept this one
    await supabase
      .from("cross_references")
      .update({ status: "accepted" })
      .eq("id", crossRefId);

    await supabase
      .from("schedule_items")
      .update({ match_status: "accepted" })
      .eq("id", scheduleItemId);

    await loadProject();
  }

  async function rejectMatch(crossRefId: string) {
    await supabase
      .from("cross_references")
      .update({ status: "rejected" })
      .eq("id", crossRefId);
    await loadProject();
  }

  if (loading) return <div className="py-8 text-gray-500">Loading...</div>;
  if (!project) return <div className="py-8 text-red-500">Project not found.</div>;

  const pendingCount = items.filter((i) => i.match_status === "pending").length;
  const matchedCount = items.filter((i) => i.match_status === "matched" || i.match_status === "accepted").length;
  const noMatchCount = items.filter((i) => i.match_status === "no_match").length;
  const onCardCount = items.filter((i) => i.on_line_card).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <div className="mt-1 flex gap-4 text-sm text-gray-500">
            <span>{items.length} items</span>
            <span className="text-green-600">{onCardCount} on card</span>
            <span className="text-blue-600">{matchedCount} matched</span>
            <span className="text-yellow-600">{pendingCount} pending</span>
            <span className="text-red-600">{noMatchCount} no match</span>
          </div>
        </div>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <button
              onClick={runMatching}
              disabled={matching}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {matching ? "Matching..." : "Find Alternatives"}
            </button>
          )}
          <a
            href={`/projects/${id}/submittal`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Generate Submittal
          </a>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-lg border bg-white p-4 ${
              item.on_line_card
                ? "border-green-200"
                : item.match_status === "no_match"
                  ? "border-red-200"
                  : item.match_status === "accepted"
                    ? "border-blue-200"
                    : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {item.type_designation && (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono font-bold">
                      {item.type_designation}
                    </span>
                  )}
                  <span className="font-medium">
                    {item.specified_manufacturer ?? "Unknown"} — {item.specified_model ?? "Unknown"}
                  </span>
                </div>
                {item.description && (
                  <div className="mt-0.5 text-xs text-gray-600">{item.description}</div>
                )}
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                  {item.lumens && <span>{item.lumens}lm</span>}
                  {item.cct && <span>{item.cct}K</span>}
                  {item.wattage && <span>{item.wattage}W</span>}
                  {item.voltage && <span>{item.voltage}</span>}
                  {item.lamp_type && <span>{item.lamp_type}</span>}
                  {item.application && <span>{item.application}</span>}
                  {item.mounting_type && <span>{item.mounting_type}</span>}
                  {item.cri && <span>CRI {item.cri}</span>}
                  {item.dimming_protocol && <span>{item.dimming_protocol}</span>}
                  {item.quantity > 1 && <span>Qty: {item.quantity}</span>}
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  item.on_line_card
                    ? "bg-green-100 text-green-800"
                    : item.match_status === "accepted"
                      ? "bg-blue-100 text-blue-800"
                      : item.match_status === "matched"
                        ? "bg-yellow-100 text-yellow-800"
                        : item.match_status === "no_match"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-600"
                }`}
              >
                {item.on_line_card
                  ? "On Line Card"
                  : item.match_status === "accepted"
                    ? "Accepted"
                    : item.match_status === "matched"
                      ? "Needs Review"
                      : item.match_status === "no_match"
                        ? "No Match"
                        : "Pending"}
              </span>
            </div>

            {/* Show proposed alternatives */}
            {item.cross_references.length > 0 && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-gray-500">Proposed alternatives:</p>
                {item.cross_references
                  .filter((cr) => cr.status !== "rejected")
                  .map((cr) => (
                    <div
                      key={cr.id}
                      className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                        cr.status === "accepted"
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200"
                      }`}
                    >
                      <div>
                        <span className="font-medium">
                          {cr.product?.manufacturer?.name} — {cr.product?.model_number}
                        </span>
                        <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                          Score: {cr.match_score}%
                        </span>
                        {cr.match_reasoning && (
                          <p className="mt-0.5 text-xs text-gray-400">{cr.match_reasoning}</p>
                        )}
                      </div>
                      {cr.status === "proposed" && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => acceptMatch(item.id, cr.id)}
                            className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => rejectMatch(cr.id)}
                            className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {cr.status === "accepted" && (
                        <span className="text-xs font-medium text-blue-700">Accepted</span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
