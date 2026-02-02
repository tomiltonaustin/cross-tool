import type { Product, ScheduleItem } from "@/types";

type ScoredProduct = Product & { match_score: number; match_reasoning: string };

export function scoreProducts(
  item: ScheduleItem,
  candidates: Product[]
): ScoredProduct[] {
  return candidates
    .map((product) => {
      let score = 0;
      const reasons: string[] = [];

      // Form factor / mounting type match (25%)
      if (item.mounting_type && product.mounting_type) {
        if (normalize(item.mounting_type) === normalize(product.mounting_type)) {
          score += 25;
          reasons.push("Mounting type matches");
        }
      }

      // CCT exact match (20%)
      if (item.cct && product.cct) {
        if (item.cct === product.cct) {
          score += 20;
          reasons.push(`CCT matches (${product.cct}K)`);
        }
      }

      // Lumens within 10% tolerance (30%)
      if (item.lumens && product.lumens) {
        const ratio = product.lumens / item.lumens;
        if (ratio >= 0.9 && ratio <= 1.1) {
          // Scale: exact match = 30, edge of tolerance = 20
          const proximity = 1 - Math.abs(1 - ratio) / 0.1;
          const lumenScore = 20 + proximity * 10;
          score += lumenScore;
          reasons.push(
            `Lumens: ${product.lumens} vs ${item.lumens} specified (${Math.round(ratio * 100)}%)`
          );
        }
      }

      // CRI (15%)
      if (product.cri && product.cri >= 80) {
        score += 15;
        reasons.push(`CRI ${product.cri}`);
      }

      // Voltage match (5%)
      if (item.voltage && product.voltage) {
        if (normalize(item.voltage) === normalize(product.voltage)) {
          score += 5;
          reasons.push("Voltage matches");
        }
      }

      // Wattage similarity (5%)
      if (item.wattage && product.wattage) {
        const ratio = product.wattage / item.wattage;
        if (ratio >= 0.7 && ratio <= 1.3) {
          score += 5;
          reasons.push(`Wattage: ${product.wattage}W`);
        }
      }

      return {
        ...product,
        match_score: Math.round(score),
        match_reasoning: reasons.join(". "),
      };
    })
    .filter((p) => p.match_score > 0)
    .sort((a, b) => b.match_score - a.match_score);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
