# Enterprise Portal Starter Template Rules

Lean rules for this enterprise template project.

## Stack

- React 19, TypeScript, Vite, Tailwind CSS v4, shadcn UI, React Query v5.
- API calls go through `src/services/apiClient.ts`; no hardcoded base URLs elsewhere.
- Shared API/domain types live in `src/types/*`; services and hooks do not export them.

## Frontend Architecture

- Put reusable backend shapes in `src/types`; use `import type`.
- Keep one-off prop types beside their component.
- Prefer shadcn components from `src/components/ui`.
- Services are API wrappers only, grouped by domain: `apiClient.ts`, `queryKeys.ts`, `errorReporting.ts`.
- Hooks handle React Query orchestration; keep components thin.
- Use theme tokens and shadcn variants for dark mode.
- Use `<ProtectedRoute>` with `navigationCode` or `permissionCode` to enforce RBAC.

## Backend Alignment

- Keep explicit request/response schemas aligned with frontend `src/types`.
- Uploads accept multipart form data and return stable IDs/metadata.

## Checks

- Run `npm run build` after TypeScript or component changes.
- Run `npm run lint` after broad/shared changes.

### Server-Sent Events (SSE) & Real-Time Event Streaming
* **"Wait for Event" Model Only (Mandatory):**
  * **NEVER** use polling loops (`check -> sleep -> check`) or database polling heartbeats inside SSE streaming endpoints.
  * **NEVER** query the database repeatedly inside SSE stream generators.
  * **Always** use `await event_queue.get()` (or `asyncio.wait_for(q.get(), timeout=30.0)` for lightweight ping) to suspend the coroutine at the event loop level with zero CPU/DB overhead until a published event arrives.

---

## 4. Architecture Notice: Web SPA vs Universal App (Expo + Vite)

> **CRITICAL PRE-SETUP DECISION**: This choice must be made **BEFORE** using the template to write application features.
> - **Option 1 (Default)**: Pure Web SPA (React 19 + Vite + Tailwind CSS v4) matching Admin & Finance portals.
> - **Option 2**: Universal Web + Mobile App (Expo 57 + React Native Web + Vite) matching CEO Dashboard.
>
> If the project requires mobile support (iOS/Android), convert the frontend immediately upon initial project setup before writing UI components to avoid refactoring later.

### Prompt Instructions to Convert Frontend into Universal Web + App:
When the user asks to convert this frontend (`Template_Automation_Front`) into a Universal Web + Mobile App like CEO Dashboard, execute the following:
1. **Dependencies**: In `package.json`, add Expo (v57+), React Native (0.86+), React Native Web (0.21+), `@react-navigation/native`, `@react-navigation/native-stack`, `expo-linking`, `expo-web-browser`, `react-native-safe-area-context`, `react-native-screens`, `react-native-svg`, and `concurrently`.
2. **Dual-Runner Scripts**: Configure concurrent Expo Metro bundler on port `:8090` and Vite web server on port `:6000`:
   ```json
   "start": "concurrently -n \"EXPO,WEB\" -c \"cyan,magenta\" \"expo start --host lan --port 8090\" \"vite\"",
   "dev": "vite",
   "ios": "expo start --ios --host lan --port 8090",
   "android": "node scripts/start-android.js"
   ```
3. **Vite Bundler Aliases**: Update `vite.config.ts` with `react-native-web` aliases and `codegenShim`.
4. **Navigation Container**: Wrap native mobile entrypoints with React Navigation `<NavigationContainer>` while maintaining the web React Router hierarchy.
