# Share Document (Frontend)

A modern, production-grade enterprise portal frontend built with **React 19**, **TypeScript**, **Vite**, **Tailwind CSS v4**, and **shadcn/ui**. It features built-in **Role-Based Access Control (RBAC)**, SSO/Token authentication, real-time Server-Sent Events (SSE) notification streaming, comprehensive audit & system logging, and themeable UI.

> [!IMPORTANT]
> **Architecture Decision Required Before Using Template (Web SPA vs Universal App)**
> **Make this choice BEFORE building your application features:**
> 1. **Pure Web Application (Default)**: Keep as React 19 + Vite + Tailwind CSS v4 SPA (matching Admin & Finance portals).
> 2. **Universal Web + Mobile App**: Convert to Expo 57 + React Native Web + Vite (matching CEO Dashboard) *prior to writing any UI code* to avoid component refactoring.
>
> *To convert the frontend into a Universal Web + Mobile App, run the conversion prompt provided in the [Conversion Guide](#-converting-to-universal-web--app-expo--vite) or AGENTS.md immediately upon project setup.*

---

## ?? Features

### 1. Fine-Grained Role-Based Access Control (RBAC)
- **User Management (`/configurations/users`)**: Search, filter, edit user statuses, manage departments, and assign direct roles.
- **Role Hierarchy & Matrix (`/configurations/roles`)**: Visual hierarchical role tree with drag-and-drop parent-child nesting, metadata, and status toggles.
- **User-Role Assignment (`/configurations/user-role-assignment`)**: Batch mapping and assignment of roles to users across departments.
- **Group & Module Permissions (`/configurations/role-group-permissions`)**: Granular action-level permissions per role (View, Create, Edit, Delete, Export).
- **API Endpoint Permissions (`/configurations/role-api-permissions`)**: Method & path-level backend route access rules mapped to roles.
- **MCP Tool Permissions (`/configurations/role-mcp-tool-permissions`)**: AI and MCP tool execution access policies per role.

### 2. Authentication & Authorization Guards
- **SSO & Token Auth**: Support for Microsoft SSO integration and Bearer token lifecycle.
- **Access Pending Interceptor**: Automated redirects to `/pending-access` for newly registered users pending role provisioning.
- **Declarative Route Guards**: `<ProtectedRoute navigationCode="..." permissionCode="..." />` checking both navigation permissions and granular operation actions.

### 3. Enterprise AppShell Layout
- **Dynamic Sidebar**: Collapsible, searchable, and dynamically filtered based on current user permissions.
- **TopBar & Header**:
  - Live system clock
  - Dark / Light mode toggle (`next-themes`)
  - Real-time SSE connection health indicator & status badge
  - Dropdown notification inbox with unread counts & toast alerts
  - User profile modal with active roles and department metadata
- **Dynamic Breadcrumbs**: Automatic pathname parsing and hierarchical navigation trails.

### 4. Real-Time Event Streaming (SSE)
- Built-in zero-CPU "Wait for Event" SSE client with automated reconnection and keepalive ping handling.
- Event-driven desktop and in-app toast notifications.

### 5. Observability, Auditing & Error Handling
- **Audit Log Viewer (`/log/audit`)**: Detailed request/action timeline with user tracking, IP address, timestamp, and diff viewer.
- **System Logs Viewer (`/log/system-logs`)**: Live application logs with level filtering (INFO, WARN, ERROR, DEBUG) and virtualized scrolling.
- **Global Error Handling**: Global error boundary, window error reporters, and unhandled promise rejection telemetry.

---

## ??? Tech Stack

| Category | Technology |
| :--- | :--- |
| **Framework & Build** | [React 19](https://react.dev/), [Vite](https://vitejs.dev/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [Lucide Icons](https://lucide.dev/) |
| **State & Server Cache**| [TanStack React Query v5](https://tanstack.com/query/latest) |
| **Tables & Virtualization** | [TanStack React Table v8](https://tanstack.com/table/latest), [TanStack Virtual](https://tanstack.com/virtual/latest) |
| **Routing** | [React Router v7](https://reactrouter.com/) |
| **Animation & UX** | [Framer Motion](https://www.framer.com/motion/), [Sonner](https://sonner.emilkowal.ski/), [Vaul](https://vaul.emilkowal.ski/) |
| **Utilities** | `date-fns`, `exceljs`, `clsx`, `tailwind-merge` |

---

## ?? Project Structure

```text
template-front/
+-- public/                # Static public assets
+-- src/
¦   +-- assets/            # App images, SVGs, and brand assets
¦   +-- components/
¦   ¦   +-- AppShell/      # Layout components (Sidebar, TopBar, Breadcrumbs, etc.)
¦   ¦   +-- Configurations/# RBAC dialogs and management components
¦   ¦   +-- ui/            # shadcn/ui primitive components
¦   ¦   +-- ErrorBoundary.tsx
¦   ¦   +-- GlobalLoadingScreen.tsx
¦   ¦   +-- ProtectedRoute.tsx
¦   +-- hooks/             # Custom React hooks (useNotifications, useHeartbeat, etc.)
¦   +-- lib/               # Context providers (AuthContext) and utilities
¦   +-- pages/
¦   ¦   +-- Configurations/# Users, Roles, Permissions pages
¦   ¦   +-- Log/           # Audit logs page
¦   ¦   +-- Logs/          # System logs page
¦   ¦   +-- Dashboard.tsx  # Main KPI and metrics overview
¦   ¦   +-- Login.tsx      # Login page
¦   ¦   +-- PendingAccess.tsx
¦   +-- services/          # API layer (apiClient, queryKeys, errorReporting)
¦   +-- types/             # Shared TypeScript schemas and interfaces
¦   +-- App.tsx            # Route registry and top-level routing
¦   +-- main.tsx           # React root bootstrap & QueryClient config
¦   +-- index.css          # Tailwind CSS tokens and themes
+-- .env                   # Local environment configuration
+-- package.json
+-- vite.config.ts
```

---

## ? Getting Started

### Prerequisites
- Node.js `20.x` or higher
- npm `10.x` or higher (or pnpm / yarn)

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd Template_Automation_Front
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory (or update the existing one):
```env
# Backend API Base URL (FastAPI Port 8900)
VITE_API_BASE_URL=http://localhost:8900
```

### 3. Running Locally
Start the Vite local development server:
```bash
npm run dev
```
Open your browser at `http://localhost:6000`.

### 4. Build for Production
Type-check and build the optimized production assets:
```bash
npm run build
```
Preview the production build locally:
```bash
npm run preview
```

### 5. Linting
Run ESLint to check for code quality and hook compliance:
```bash
npm run lint
```

---

## ?? Converting to Universal Web + App (Expo + Vite)

If you want an AI agent to convert this frontend into a cross-platform **Universal Web & Mobile App (iOS / Android / Web)** matching the **CEO Dashboard** architecture (`C:\dev\ceo-dashboard\front\internal_portal_ceo_dashboard_front`), provide this prompt to the AI:

```text
Please convert this frontend project into a Universal Web + Mobile App (Expo + Vite) matching the CEO Dashboard architecture (C:\dev\ceo-dashboard\front\internal_portal_ceo_dashboard_front):

1. Dependencies: Install Expo (v57+), React Native (0.86+), React Native Web (0.21+), @react-navigation/native, @react-navigation/native-stack, expo-linking, expo-web-browser, react-native-safe-area-context, react-native-screens, react-native-svg, and concurrently.
2. Dual-Runner Scripts: In package.json, configure concurrent execution:
   - "start": "concurrently -n \"EXPO,WEB\" -c \"cyan,magenta\" \"expo start --host lan --port 8090\" \"vite\""
   - "restart": "concurrently -n \"EXPO,WEB\" -c \"cyan,magenta\" \"expo start --clear --host lan --port 8090\" \"vite --force\""
   - "dev": "vite"
   - "ios": "expo start --ios --host lan --port 8090"
   - "android": "node scripts/start-android.js"
3. Bundler & Aliases: Update vite.config.ts with react-native-web aliases, codegenShim, and proxy configuration.
4. Entrypoints: Set up index.js and native app entrypoints with NavigationContainer for native mobile alongside the existing web React Router tree.
```

---

## ??? Architecture & Best Practices

### API Client & Services
- All backend communication passes through [src/services/apiClient.ts](file:///c:/dev/template/front/Template_Automation_Front/src/services/apiClient.ts).
- Base URLs are centralized; avoid hardcoding URLs across components.
- Shared domain types live in `src/types/*` and should be imported using `import type`.

### Route Protection (RBAC)
Wrap protected views with `<ProtectedRoute>` inside [src/App.tsx](file:///c:/dev/template/front/Template_Automation_Front/src/App.tsx):
```tsx
<Route
  path="/configurations/users"
  element={
    <ProtectedRoute navigationCode="CONFIG_USERS">
      <Users />
    </ProtectedRoute>
  }
/>
```

### Real-Time SSE Guidelines
- **Event-Driven Streaming**: Real-time endpoints use an event-driven queue model with lightweight 30s heartbeat pings rather than polling loops.
- Reconnection logic and connection health states are displayed via the TopBar connection indicator.

---

## ?? License
This project is proprietary and intended for internal enterprise use.
