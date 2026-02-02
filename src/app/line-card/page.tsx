"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Manufacturer } from "@/types";

export default function LineCardPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [lineCardIds, setLineCardIds] = useState<Set<string>>(new Set());
  const [newMfr, setNewMfr] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: mfrs } = await supabase
      .from("manufacturers")
      .select("*")
      .order("name");
    setManufacturers(mfrs ?? []);

    const { data: lc } = await supabase
      .from("line_cards")
      .select("manufacturer_id");
    setLineCardIds(new Set((lc ?? []).map((l) => l.manufacturer_id)));
    setLoading(false);
  }

  async function addManufacturer() {
    if (!newMfr.trim()) return;
    const { data } = await supabase
      .from("manufacturers")
      .insert({ name: newMfr.trim() })
      .select()
      .single();
    if (data) {
      setManufacturers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewMfr("");
    }
  }

  async function toggleLineCard(mfrId: string) {
    const isOn = lineCardIds.has(mfrId);
    if (isOn) {
      await supabase
        .from("line_cards")
        .delete()
        .eq("manufacturer_id", mfrId);
      setLineCardIds((prev) => {
        const next = new Set(prev);
        next.delete(mfrId);
        return next;
      });
    } else {
      // For MVP, we hardcode an agency_id. In production this comes from the user's session.
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
      await supabase
        .from("line_cards")
        .insert({ agency_id: agencyId, manufacturer_id: mfrId });
      setLineCardIds((prev) => new Set(prev).add(mfrId));
    }
  }

  if (loading) return <div className="py-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Line Card</h1>
        <p className="mt-1 text-gray-600">
          Toggle manufacturers you represent. Products from these manufacturers will be used as alternatives.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newMfr}
          onChange={(e) => setNewMfr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addManufacturer()}
          placeholder="Add manufacturer..."
          className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1 max-w-sm"
        />
        <button
          onClick={addManufacturer}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        {manufacturers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No manufacturers yet. Add one above.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {manufacturers.map((mfr) => (
              <li key={mfr.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium">{mfr.name}</span>
                <button
                  onClick={() => toggleLineCard(mfr.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    lineCardIds.has(mfr.id)
                      ? "bg-green-100 text-green-800 hover:bg-green-200"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {lineCardIds.has(mfr.id) ? "On Line Card" : "Not Represented"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
