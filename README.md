# CrossTool — Lighting Product Cross-Reference Tool

A web app for commercial lighting sales agencies to cross-reference luminaire schedules from construction documents against their line card, find equivalent alternatives, and generate submittal packages.

## Live App

**Production:** Deployed on Vercel (auto-deploys on push to `main`)
**Repository:** https://github.com/tomiltonaustin/cross-tool
**Database:** Supabase project `jwpvpkjlxougpgqcnkra` (us-east-1)

## Tech Stack

- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind CSS v4
- **Backend:** Supabase (PostgreSQL + pgvector extension enabled)
- **File Parsing:** PapaParse (CSV) + SheetJS (Excel .xlsx/.xls)
- **Deployment:** Vercel (auto-deploy from GitHub)
- **Matching:** Structured weighted scoring algorithm (no AI/embeddings yet)

## Current State (MVP)

### What Works

- **Product catalog import** — Upload a CSV with manufacturer name, model number, and specs. Manufacturers are auto-created if they don't exist. Batch insert in groups of 500.
- **Line card management** — Add manufacturers, toggle which ones your agency represents.
- **Luminaire schedule upload** — Upload CSV or Excel (.xlsx) files. Auto-detects common column headers (Type, Manufacturer, Part Number, Description, Lumens, CCT, Wattage, Voltage, Lamp Type, Application, Dimming, CRI, Notes). Manual column mapping as fallback.
- **Line card identification** — Automatically flags which schedule items are from manufacturers on your line card vs. not.
- **Structured matching** — Finds alternative products from line card manufacturers using weighted scoring: mounting type (25%), lumens ±10% (30%), CCT exact match (20%), CRI (15%), voltage (5%), wattage (5%).
- **Review interface** — Accept, reject, or review proposed alternatives per line item. Shows match score and reasoning.
- **Submittal generation** — Printable submittal page showing specified vs. proposed products. Uses browser print/save-as-PDF.
- **Dashboard** — Quick-start links to all features.
- **Project persistence** — Projects, schedule items, and cross-references are saved in Supabase.

### What's Not Built Yet

- **Authentication** — No login/signup. Single agency, no multi-tenant. RLS is disabled.
- **AI/embedding matching** — pgvector extension is enabled but not used yet. Matching is structured-only.
- **PDF generation** — Uses browser print instead of @react-pdf/renderer.
- **Excel export** — No export of results beyond print-to-PDF.
- **Product search** — No manual product search on the review page when no match is found.
- **Multi-user/team** — No roles, no shared access.

### Known Limitations

- Agency ID is stored in localStorage (no auth session).
- The `projects.created_by` foreign key was relaxed for MVP (no auth.users reference).
- RLS policies exist but are disabled for testing.
- No duplicate detection on product import — importing the same CSV twice creates duplicate products.
- CCT values like "SELECTABLE" or "TUNABLE" are stored as null.
- Schedule items with empty/dash manufacturer fields are stored with null manufacturer.

## Database Schema

| Table | Purpose |
|-------|---------|
| `agencies` | Lighting rep firms |
| `users` | Agency members (unused in MVP) |
| `manufacturers` | All known manufacturers |
| `line_cards` | Which manufacturers an agency represents (agency ↔ manufacturer) |
| `products` | Product catalog with specs and manufacturer FK |
| `projects` | One per uploaded luminaire schedule |
| `schedule_items` | Parsed line items from uploaded schedule |
| `cross_references` | Proposed alternative products for each schedule item |

Key fields on `products`: manufacturer_id, model_number, category, form_factor, lumens, cct, wattage, voltage, mounting_type, cri, dimming_protocol, description, lamp_type, application, discontinued.

Key fields on `schedule_items`: type_designation, specified_manufacturer, specified_model, description, lumens, cct, wattage, voltage, mounting_type, lamp_type, application, dimming_protocol, cri, notes, on_line_card, match_status.

## Project Structure

```
cross-tool/
├── src/
│   ├── app/
│   │   ├── page.tsx                         # Dashboard
│   │   ├── layout.tsx                       # Nav + shell
│   │   ├── line-card/page.tsx               # Line card management
│   │   ├── products/
│   │   │   ├── page.tsx                     # Product catalog browser
│   │   │   └── import/page.tsx              # Bulk product CSV import
│   │   └── projects/
│   │       ├── page.tsx                     # Project list
│   │       ├── new/page.tsx                 # Upload schedule + map columns
│   │       └── [id]/
│   │           ├── page.tsx                 # Cross-reference review
│   │           └── submittal/page.tsx       # Printable submittal
│   ├── lib/
│   │   ├── parsers/csv.ts                   # CSV + Excel parsing, column auto-detect
│   │   ├── matching/structured.ts           # Weighted scoring algorithm
│   │   └── supabase/{client,server,middleware}.ts
│   ├── types/index.ts                       # Shared TypeScript types
│   └── middleware.ts                        # Supabase session refresh
├── templates/
│   ├── product-import-template.csv          # Template for product catalog import
│   └── luminaire-schedule-*.xlsx            # Sample luminaire schedule
├── plans/
│   └── feat-lighting-cross-reference-tool.md
└── .env.local                               # Supabase URL + anon key (gitignored)
```

## Testing Procedure

### Prerequisites

The product catalog must be populated before matching can work. The app ships with two template files in `templates/`.

### Step 1: Import Products

1. Go to **Products → Import Products**
2. Upload `templates/product-import-template.csv`
3. Verify: "Imported 8 products across 6 manufacturers"
4. Go to **Products** and confirm 8 products appear with correct specs

### Step 2: Configure Line Card

1. Go to **Line Card**
2. You should see 6 manufacturers (auto-created from the product import)
3. Toggle ON 2-3 manufacturers you want to represent (e.g., Cooper Lighting, Cree Lighting, RAB Lighting)
4. Leave others OFF — these will be the ones the app needs to find alternatives for

### Step 3: Upload a Luminaire Schedule

1. Go to **New Project**
2. Upload `templates/luminaire-schedule-MxEcWS-UI4mQ6NbM7_be4.xlsx` (or any CSV/Excel luminaire schedule)
3. Verify column auto-detection on the Map Columns screen:
   - Type → Type
   - Manufacturer → Manufacturer
   - Model / Part Number → Part Number
   - Description → Description
   - Wattage, Voltage, Lamp Type, Lumens, CCT, CRI, Application, Dimming, Notes all mapped
4. Click **Continue** → verify 6 line items in mapped preview
5. Click **Create Project & Find Matches**

### Step 4: Run Matching

1. On the project detail page, items from line card manufacturers show green ("On Line Card")
2. Items from other manufacturers show "Pending"
3. Click **Find Alternatives**
4. Review results:
   - Items with matches show proposed alternatives with score and reasoning
   - Items with no matches show "No Match" in red
5. Accept or reject each proposed alternative

### Step 5: Generate Submittal

1. Click **Generate Submittal**
2. Review the submittal table (specified vs. proposed products)
3. Click **Print / Save PDF** → Ctrl+P → Save as PDF

### What to Look For During Testing

- Column auto-detection accuracy — do the right columns get mapped?
- Data parsing — are lumens, CCT, wattage parsed as numbers? Are dashes and "SELECTABLE" handled as null?
- Line card identification — are manufacturers correctly identified as on/off the line card?
- Match quality — do proposed alternatives make sense (similar specs)?
- Match scoring — do higher-scored alternatives actually have better spec matches?
- Edge cases — items with missing manufacturer, missing specs, "SELECTABLE" CCT

## Next Steps

### Priority 1: Core Functionality Gaps

- **Authentication** — Add Supabase Auth (email/password or magic link). Re-enable RLS policies. Replace localStorage agency_id with session-based user → agency lookup.
- **Product search on review page** — When no match is found, let users search the product catalog manually and assign an alternative.
- **Duplicate detection on product import** — Check for existing model_number + manufacturer_id before inserting.
- **Excel support for product import** — Currently CSV-only for product catalog import (schedule upload already supports Excel).

### Priority 2: Better Matching

- **AI/embedding matching** — Generate embeddings for products using OpenAI text-embedding-3-small, store in pgvector, add semantic similarity as a matching step between structured filter and weighted scoring.
- **Application-aware matching** — Use the application field (Downlight, Troffer, Exit Sign, etc.) as a hard filter before scoring. Currently only mounting_type is used for form factor matching.
- **Description-based matching** — When structured specs are sparse, use product descriptions for fuzzy matching.

### Priority 3: Better Output

- **PDF generation with @react-pdf/renderer** — Professional submittal document with cover sheet, comparison tables, and per-fixture detail pages.
- **Export to Excel** — Export the cross-reference results as a spreadsheet.
- **Include product data sheets** — Link to or embed manufacturer cut sheets in the submittal.

### Priority 4: Scale & Polish

- **Multi-tenant** — Multiple agencies, team members, role-based access.
- **Saved column mappings** — Remember column mappings per agency so repeat uploads auto-map correctly.
- **Product catalog management UI** — Edit, delete, mark discontinued from the web UI (currently import-only).
- **Batch operations on review page** — Accept all high-confidence matches with one click.
- **Project status workflow** — Draft → In Review → Submitted → Approved.

## Development

```bash
npm install
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
```

Environment variables (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=https://jwpvpkjlxougpgqcnkra.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```
