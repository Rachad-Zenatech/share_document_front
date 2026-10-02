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

## Directory Structure

```text
share_document_front/
├── public/                 # Static public assets and templates
├── src/
│   ├── components/         # Shared AppShell, navigation, and modal components
│   │   ├── ui/             # shadcn/ui primitives
│   │   └── AppShell/       # TopBar, dynamic breadcrumbs, sidebar
│   ├── hooks/              # Custom hooks (useSecFiling, useSpreadsheet, useSSE)
│   ├── pages/
│   │   ├── SecFilings/     # Core filings workspace, editor, and block components
│   │   │   ├── components/ # BlockBuilder, BlockInspector, InlineAddBlock, Modals
│   │   │   ├── SecFilingsPage.tsx
│   │   │   ├── CreateSecFilingPage.tsx
│   │   │   ├── SecFilingContributorPage.tsx
│   │   │   └── MobileSignerPage.tsx
│   │   ├── SpreadsheetHub/ # Spreadsheet upload and formula explorer
│   │   ├── Configurations/ # RBAC users, roles, and permissions
│   │   └── Log/            # Audit logs and system telemetry
│   ├── services/           # apiClient, secFilingService, spreadsheetService
│   ├── types/              # secFiling.ts, spreadsheet.ts, collaborator.ts
│   ├── App.tsx             # Routing matrix
│   └── main.tsx            # App bootstrap
├── package.json
└── vite.config.ts          # Vite configuration pinned to port 5176
```

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
