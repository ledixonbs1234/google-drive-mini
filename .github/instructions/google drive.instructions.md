## Purpose

Short, focused instructions to help AI coding agents make productive, repository-specific edits.

## Quick facts

- Framework: Next.js (App Router) — top-level code lives in `app/` (`layout.tsx`, `page.tsx`).
- Language: TypeScript. Linting via `next lint` and ESLint config from `eslint-config-next`.
- Styling: Tailwind CSS (see `tailwind.config.js` and `app/globals.css`).
- State: global state uses Zustand (`store/useAppStore.ts`).
- Storage & backend: Firebase client SDK in `lib/firebase.ts` (uses NEXT_PUBLIC_* env vars).

## Recommended local commands

- Start dev server (with Turbopack): `npm run dev` (see `package.json`).
- Build: `npm run build`.
- Lint: `npm run lint`.

If changes touch runtime secrets or Firebase config, expect local `.env.local` to provide:

- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- NEXT_PUBLIC_FIREBASE_APP_ID
- NEXT_PUBLIC_FIREBASE_DATABASE_URL

Do NOT hard-code secrets in source files; prefer environment variables.

## Architecture & important patterns (what to know)

- App router: `app/` contains route components — modify `app/page.tsx` and `app/layout.tsx` for global UX changes.
- UI is componentized in `components/` (examples: `FileUploader.tsx`, `FileList.tsx`, `PreviewModal.tsx`, `CreateFolderModal.tsx`). Inspect these for event flows.
- File uploads use `lib/firebase.ts` -> Firebase Storage and Realtime Database. Note `createFolder` implementation: creating a hidden `.keep` file marks a folder.
- Global UI state (theme, modals, preview) is managed in `store/useAppStore.ts` (Zustand); update here when adding cross-component state.
- Preview & editor flows: components open modals via `useAppStore` actions (see `openPreviewModal`, `openEditorModal`). Search for `openPreviewModal` to find usage sites.
- Monaco editor is used via `@monaco-editor/react` (see `components/CodeEditorModal.tsx`) for code-editing features.

## Code style & conventions

- Use TypeScript types where present. Follow existing typing patterns (see `store/useAppStore.ts` for interface examples).
- Tailwind utilities are used across components; prefer utility classes over custom CSS unless necessary.
- Dark mode is implemented by toggling a `dark` class on `document.documentElement` (see `useAppStore.toggleTheme` and code that manipulates `root.classList`). Keep DOM class updates consistent with that pattern.

## Integration and cross-component communication

- Firebase calls are direct from components or helper modules (`lib/firebase.ts`). When touching uploads, ensure environment variables are handled and initialization guards (`getApps().length`) are preserved.
- Global state (Zustand) is the main cross-component communication channel. Avoid introducing new global singletons; prefer adding fields/actions to `useAppStore`.

## Testing & verification tips

- There are no automated tests in the repo; verify changes by running `npm run dev` and exercising the UI at `http://localhost:3000`.
- For upload/Storage-related changes, test with a local `.env.local` that points to a Firebase project. Watch console logs (code contains informative console messages).

## When editing PRs

- Run `npm run lint` and `npm run build` locally when modifying build/TypeScript or global configs.
- Keep changes minimal and component-scoped. For UI behavior changes, include manual reproduction steps in PR description (which pages, which component, expected vs actual).

## Useful files to inspect (examples)

- `app/page.tsx` — entry page and primary layout usage
- `app/layout.tsx` — global layout, font and CSS imports
- `components/FileUploader.tsx`, `components/DragDropUploader.tsx` — upload flows
- `components/FileList.tsx` — list and item rendering; reference for Storage item shape
- `components/PreviewModal.tsx`, `PreviewModal_new.tsx` — preview patterns
- `lib/firebase.ts` — firebase init, storage helpers, `.keep` folder pattern
- `store/useAppStore.ts` — global state, theme toggling, modal actions
- `tailwind.config.js` — Tailwind content globs and config

## Edit rules for AI agents

1. Prefer small, testable changes. Change one component or helper per PR.
2. Preserve environment-guard checks (e.g., `getApps().length === 0`) in `lib/firebase.ts` to avoid double-init issues.
3. When adding UI state, extend `useAppStore.ts` rather than introducing ad-hoc window globals.
4. Don’t commit secrets. If you need Firebase keys for verification, ask the author or use a throwaway test project and document it in the PR notes.

If any of this is unclear or you want the file to include additional rules (formatting, commit message templates, CI checks), tell me which areas to expand and I’ll iterate.
