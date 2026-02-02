export type Agency = {
  id: string;
  name: string;
  territory: string | null;
  created_at: string;
};

export type Manufacturer = {
  id: string;
  name: string;
  website: string | null;
  active: boolean;
  created_at: string;
};

export type LineCard = {
  id: string;
  agency_id: string;
  manufacturer_id: string;
  added_at: string;
  manufacturer?: Manufacturer;
};

export type Product = {
  id: string;
  manufacturer_id: string;
  model_number: string;
  category: string | null;
  form_factor: string | null;
  lumens: number | null;
  cct: number | null;
  wattage: number | null;
  voltage: string | null;
  mounting_type: string | null;
  cri: number | null;
  dimming_protocol: string | null;
  description: string | null;
  discontinued: boolean;
  created_at: string;
  updated_at: string;
  manufacturer?: Manufacturer;
};

export type Project = {
  id: string;
  agency_id: string;
  created_by: string;
  name: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ScheduleItem = {
  id: string;
  project_id: string;
  type_designation: string | null;
  specified_manufacturer: string | null;
  specified_model: string | null;
  lumens: number | null;
  cct: number | null;
  wattage: number | null;
  mounting_type: string | null;
  voltage: string | null;
  quantity: number;
  on_line_card: boolean;
  match_status: "pending" | "matched" | "no_match" | "accepted" | "manual";
  created_at: string;
};

export type CrossReference = {
  id: string;
  schedule_item_id: string;
  product_id: string;
  match_score: number;
  match_reasoning: string | null;
  status: "proposed" | "accepted" | "rejected";
  created_at: string;
  product?: Product;
};

// Column mapping for CSV parsing
export type ColumnMapping = {
  type_designation?: string;
  manufacturer?: string;
  model?: string;
  lumens?: string;
  cct?: string;
  wattage?: string;
  mounting_type?: string;
  voltage?: string;
  quantity?: string;
};

export type ParsedScheduleRow = {
  type_designation: string | null;
  specified_manufacturer: string | null;
  specified_model: string | null;
  lumens: number | null;
  cct: number | null;
  wattage: number | null;
  mounting_type: string | null;
  voltage: string | null;
  quantity: number;
};
