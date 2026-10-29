# Collaborative Document & SEC Filings Frontend (`share_document_front`)

Enterprise web application for collaborative authoring of **SEC regulatory filings (10-K, 10-Q, 8-K)**, modular block-based document composition, live spreadsheet linking, contributor proposals, version diffing, and mobile QR code digital signature approvals.

Built with **React 19**, **TypeScript**, **Vite 8**, **Tailwind CSS v4**, and **shadcn/ui**.

---

## System Architecture Diagram

```mermaid
flowchart TD
    subgraph BrowserApp [Desktop Web Application :5176]
        AppRoot[React 19 App Shell]
        Router[React Router v7 Route Engine]
        SecFilingPage[Filing Workspace & Outline Navigator]
        BlockBuilder[Modular Block Builder & Inspector]
        SpreadsheetHub[Live Spreadsheet Linker & Hub]
        MergeReview[Collaborator Proposal & Diff Reviewer]
        MobileModal[QR Code Signing Modal]
    end

    subgraph MobileDevice [Mobile Signer Web View :5176/sign/:token]
        MobileSignerPage[Mobile Signature Canvas & Biometrics]
        SignaturePad[HTML5 Touch/Stylus Canvas Capture]
        MobileSubmit[Cryptographic Seal & Verification]
    end

    subgraph StateAndCache [Client State Layer]
        AuthContext[Auth & Session Context]
        TanStackQuery[TanStack React Query v5 State Cache]
        SSEListener[useNotifications & Live Block Broadcaster]
    end

    subgraph BackendAPI [FastAPI Backend Engine :8006]
        FilingsEndpoint[/api/sec-filings/*]
        SpreadsheetsEndpoint[/api/spreadsheets/*]
        SignEndpoint[/api/sec-filings/sign/*]
        SSEEndpoint[/api/notifications/stream]
    end

    AppRoot --> Router
    Router --> SecFilingPage
    Router --> MobileSignerPage

    SecFilingPage --> BlockBuilder
    SecFilingPage --> SpreadsheetHub
    SecFilingPage --> MergeReview
    SecFilingPage --> MobileModal

    MobileSignerPage --> SignaturePad
    SignaturePad --> MobileSubmit

    BlockBuilder <--> TanStackQuery
    SpreadsheetHub <--> TanStackQuery
    TanStackQuery --> FilingsEndpoint
    TanStackQuery --> SpreadsheetsEndpoint
    MobileSubmit --> SignEndpoint

    SSEListener <--> SSEEndpoint
    SSEListener -->|Live Updates| BlockBuilder
```

---

## Technologies & System Specifications

| Category | Technology | Description |
| :--- | :--- | :--- |
| **Framework & Build** | [React 19](https://react.dev/), [Vite 8](https://vitejs.dev/) | Sub-millisecond HMR, ES module bundling, port `5176` |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | Strict type definitions across block models, proposals, and schemas |
| **Styling & Theme** | [Tailwind CSS v4](https://tailwindcss.com/), `@shadcn/react`, `next-themes` | Modern utility CSS with dark/light themes and custom typography |
| **Data Fetching & Cache**| [TanStack React Query v5](https://tanstack.com/query) | Automatic query caching, optimistic block edits, background syncing |
| **Data Grids & Tables** | [TanStack React Table v8](https://tanstack.com/table), `exceljs`, `xlsx` | In-memory spreadsheet parsing, dynamic grid tables, Excel export/import |
| **Document Block Engine**| Custom React Block Hierarchy | Headings, dynamic tables, variable tags, formulas, callouts, and callout blocks |
| **Mobile Signature & QR**| `qrcode`, HTML5 Canvas Touch API | Desktop QR generation for mobile handoff and digital signature capture |
| **Routing & Guards** | [React Router v7](https://reactrouter.com/) | Protected routes with PBAC permission codes and lazy loading |
| **Animations & UI Primitives** | [Framer Motion](https://www.framer.com/motion/), `vaul`, `sonner`, Radix UI | Bottom sheet drawers, toast alerts, and modal dialogs |

---

## Key Modules & Workflows

1. **Document Block Builder (`/sec-filings/:id/edit`)**:
   - Visual outline tree with drag reordering, inline block insertion (`InlineAddBlock`), and property inspector (`BlockInspector`).
   - Supports variables (`DocumentVariableRenderer`) that dynamically interpolate company name, period end date, and fiscal figures.
2. **Spreadsheet Hub (`/spreadsheet-hub`)**:
   - Upload and manage financial worksheets.
   - Reference specific sheet cells (e.g. `Sheet1!B14`) directly in document blocks with automatic recalculation.
3. **Collaboration & Proposals (`MergeReviewModal`)**:
   - Multi-user editing with draft proposal submissions and side-by-side diff review before merging into the master draft.
4. **Mobile Signing Flow (`/sec-filings/sign/:token`)**:
   - Opens on smartphones via QR code scan.
   - Captures high-resolution stylus or touch signature and transmits cryptographic confirmation to the backend.
5. **Regulatory Export**:
   - Produces formatted Word (.docx) and PDF export packages.

---

<!-- project-structure:start -->
## Project Structure

```text
src/
  assets/                   # Images and icons
  components/               # Reusable UI, one folder per feature
    AppShell/               # Layout chrome: sidebar, top bar, navigation, notifications
    SecFilings/             # SEC filing data gate (loads filing data before routes render)
    common/                 # Shared by several pages: error boundary, loading screen, route guards
    ui/                     # shadcn/ui primitives (button, dialog, ...); don't put feature code here
  data/                     # Static data / catalogs
  hooks/                    # Custom React hooks
  lib/                      # App-wide helpers: auth context, env, storage, utils
  pages/                    # One folder per feature/route group
    Auth/                   # Login and pending-access screens
    Configurations/         # Users, roles and permission settings
    Dashboard/              # Home dashboard
    Logs/                   # Audit and system logs
    SecFilings/             # SEC filings: list, create, contributor and signer flows, spreadsheet hub, workflow assignments (page-only parts in SecFilings/components/)
  services/                 # API calls: apiClient + one <feature>Service.ts per backend area
  types/                    # TypeScript types, one file per feature
  utils/                    # Pure helper functions
  App.tsx                   # Web routes (lazy-loaded pages)
  main.tsx                  # Web entry: providers and router
```

### Where new code goes

* **New page:** `src/pages/<Feature>/`. Pages that belong together share a folder; a `.native.tsx` variant sits next to its web file.
* **Components:** used by one feature go in `src/components/<Feature>/`; used by several go in `src/components/common/`. `src/components/ui/` is only for shadcn primitives.
* **New API calls** go in `src/services/<feature>Service.ts` through `apiClient`, not `fetch` inside components (some older pages still do this; move those calls when you touch them). Types go in `src/types/<feature>.ts`.
* **Don't add loose files** to `src/pages/` or `src/components/`.
* **When you move a file,** update every import to it (and the imports inside it), then run `npm run build` (`tsc -b && vite build`).
<!-- project-structure:end -->

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables (.env)
```env
# Backend API Base URL (FastAPI running on port 8006)
VITE_API_BASE_URL=http://localhost:8006
```

### 3. Run Development Server
```bash
npm run dev
```
Open application at `http://localhost:5176`.

### 4. Build for Production
```bash
npm run build
```

### 5. Lint
```bash
npm run lint
```
