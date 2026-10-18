# Frontend style guide

Narrow, cross-cutting frontend decisions that don't belong in `project/architecture/HLD.md`/`LLD.md` (both explicitly scope frontend design out, see `LLD.md`'s Scope section) and aren't architectural enough to need an ADR. It started as `project/architecture/adr/0010-frontend-colour-palette.md` (moved here on 2026-08-20); the colour palette was rewritten on 2026-10-18 to match the redesign's tokens in `src/index.css`.

## Colour palette

**Rule: colours are CSS custom properties in `src/index.css`, used through Tailwind utilities, not raw hex in markup.** Light values sit on `:root`, dark values on `.dark` (a class on `<html>`, set by `src/hooks/use-theme.tsx` from Settings → Appearance or the system). `@theme inline` in the same file maps them to utilities: `bg-background`, `text-muted-foreground`, `border-border`, `text-ink-2` and so on. The only literal colours in components are the brand, palette and third-party values listed at the end of this section. Values written as `oklch(...)` in the CSS are shown here as their hex equivalents.

### Base

| Token | Utility | Light | Dark | Used for |
|---|---|---|---|---|
| `--background` | `bg-background` | `#FFFFFF` | `#1A1A1A` | Main content and chat; the page itself. |
| `--foreground` (`ink`) | `text-foreground`, `text-ink` | `#3D3D3D` | `#FCFCFC` | Primary text; icons when hovered or active. |
| `--muted-foreground` | `text-muted-foreground` | `#8A8A8A` | `#818181` | Secondary text: descriptions, labels, timestamps, icons at rest. |
| `ink-2` | `text-ink-2` | muted 80% into background | same mix | Menu and composer rows at rest. |
| `ink-3` | `text-ink-3` | muted 50% into background | same mix | Placeholders, hints, row descriptions. |
| `--border` | `border-border` | `#EBEBEB` | `rgb(252 252 252 / 7%)` | Every border and divider: fields, cards, dropdowns, the composer. |
| `--card` | `bg-card` | `#FFFFFF` | `#1A1A1A` | Cards on a page (Archived rows, skill cards). |
| `--accent` / `--muted` | `bg-accent`, `bg-muted` | `rgb(0 0 0 / 4%)` | `rgb(255 255 255 / 4%)` | Quiet fills: the active sidebar row, chips, the open chat. |
| `--hover` | `bg-hover` | `rgb(0 0 0 / 4%)` | `rgb(255 255 255 / 6%)` | Hover fill on buttons and rows. |
| `--active` | `bg-active` | `rgb(0 0 0 / 7%)` | `rgb(255 255 255 / 10%)` | Pressed fill. |
| `--selected` | `bg-selected` | `#D4D4D4` | `#525252` | A selected item that must read as chosen, not hovered. |
| `--input` | `bg-input` | `#E5E5E5` | `#1B1B1B` | Base input fill (shadcn inputs). |

### Surfaces

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--sidebar`, `--redesign-sidebar-surface` | `#FAFAFA` | `#1A1A1A` (background) | The sidebar, and Settings' sidebar. |
| `--redesign-sidebar-border` | `#EBEBEB` | `#232323` | The sidebar's edge and the top bar's divider. |
| `--redesign-overlay-border` | `#EBEBEB` | `#282828` | Borders of things floating over the sidebar. |
| `--redesign-sidebar-overlay-surface` | `#F8F8F8` | `#212121` | Menus and popovers opened from the sidebar. |
| `--redesign-quick-actions-surface` | `#FFFFFF` | `#1A1A1A` (sidebar) | Quick actions in the sidebar. |
| `--redesign-getting-started-surface` | `#FFFFFF` | `#212121` | The Getting started card. |
| `--redesign-compose-extension-surface` | `#FFFFFF` | `#212121` | Strips attached to the composer: Work from folder, queued messages. |
| Shell dialog surface | `#FAFAFA` | `#1A1A1A` (background) | Invite members, Sign in, New workspace and project, Add and Browse skills (`ShellDialog`). |
| Shell fields and cards (`SHELL_SURFACE`) | `#FFFFFF` + `--redesign-sidebar-border` | `#1A1A1A` + same border | Fields, role lists and result lists inside a shell dialog. |
| `--surface-1` … `--surface-8` | `#FAFAFA`, `#FCFCFC`, then `#FFFFFF` | `#171717` up to `#484848` (+7 per step) | Elevation ladder for nested surfaces (menus inside menus). |

### Actions

| Role | Light | Dark | Where |
|---|---|---|---|
| **Primary** | `#000000` fill, white text; hover `#262626`, press `#404040` | `#FFFFFF` fill, black text; hover `#E5E5E5`, press `#D4D4D4` | The main action in a shell dialog (Invite, Create, Add skill), `ShellDialogActions`. The `primary` button variant uses the foreground colour the same way (Browse skills). |
| **Secondary** | transparent, 1px `--border` ring; hover `--hover`, press `--active` | same with the dark tokens | `tertiary` button variant: Add skill, Restore, Filter, Sort. In shell dialogs, Cancel is the same on a white fill. |
| **Accent (send)** | `--send-button-bg` = `--focus-accent` `#0169CC`; hover 25% black, press 40% black | same | The send button, the Ask for approval permission, the Getting started ring, focused composer and search borders (`border-focus-accent`). |
| Focus ring | `--focus-ring` `#6B97FF` | same | Keyboard focus outlines. |
| **Destructive** | `--destructive` `#E7000B`; hover 12% black, press 25% black | `#FF6467` | Delete permanently, Delete workspace, errors. A red button is the accent button with its `--send-button-bg*` variables set to destructive (`DESTRUCTIVE_BUTTON` in settings, `primary.destructive` in `ShellDialogActions`); the `destructive` button variant is an alias for primary, not red. |
| Destructive background | `--destructive-light` `#FEF2F2` | `#450A0A` | Error banners and danger fills. |
| Full access | Tailwind `orange-500` `#F97316` | same | The Full access permission's label and icon. |
| Success | `--redesign-success` `#3E9B6A` | same | Getting started, all done. |

### Brand

- **Alongside mark:** three overlapping circles, `#CFCFCF`, `#E8E8E8` and `#FFFFFF`, on a top-to-bottom gradient from `#2B83FF` to `#056DFF`.
- **`public/favicon.svg`** is the finished app icon: the mark on a rounded tile with a `#005BD8` outline and a `#69A7FF` highlight along the top. It's the browser tab icon and the Alongside workspace's stored logo.
- **Inside the app** the mark is drawn flat (`public/alongside-mark.svg`, and inline in `WorkspaceBrandIcon`), because the workspace tile rounds a logo itself. Only default tiles (a letter, or the default mark) get the tile's hairline edge; logos don't.

### Workspace tiles

A workspace without a logo shows its first letter on a palette colour (`WORKSPACE_PALETTE` in `src/lib/identity-palette.ts`), picked in New/Manage workspace or derived from its name:

| Name | Tile | Letter |
|---|---|---|
| Grey | `#E9E9EB` | `#5F6168` |
| Red | `#FADDDB` | `#C2413B` |
| Orange | `#FDE3CF` | `#C8601A` |
| Yellow | `#FCEACB` | `#AD7A16` |
| Green | `#DCEEE1` | `#3E8B67` |
| Blue | `#DAE8FB` | `#3D6FB4` |
| Purple | `#E7DEF5` | `#7C5CB8` |
| Pink | `#FBE0E6` | `#BF5170` |
| White | `#FFFFFF` | `#1F1F1F` |
| Black | `#141414` | `#FFFFFF` |

People's avatars use the first six of the same family (`IDENTITY_PALETTE`).

### Not ours

Provider and app logos (Claude, OpenAI, Gemini, GitHub, Google, Mistral, Perplexity and others under `public/icons/`) and Google's own "G" colours keep their makers' colours and are never re-themed; the only change allowed is inverting a black mark in dark mode (`invertInDark`).

## UI text / i18n (issue #307)

**Rule: no raw user-facing string literals in JSX going forward.** Every UI string (button labels, titles, descriptions, empty states, error messages) is a key in `src/i18n/translations.ts` — one row per key, one column per language (`en`, `pt-BR`, `es`, `fr`, `de`, `zh`, `ja`) — read via `useTranslation()`'s `t("the.key")`, not a hardcoded English string. `src/i18n/index.ts` transposes that table into `react-i18next`'s resources shape at init time; `src/lib/language.ts`'s `LanguageValue`/`uiLocaleFor` is the one shared setting (Settings → General → Language) that drives both this UI language and, separately, the AI's own reply language.

Every page and shared component in `frontend/src` is converted: Settings, sidebar, header, Home, Inbox, Library, Welcome, Auth, Provider usage, chat (messages, permission cards, tool rows, diffs), compose box and the right panel. Code that runs outside React render (relative times, effort labels, thrown load errors, OS notifications) uses the `i18n` singleton (`import i18n from "@/i18n"`, `i18n.t(...)`) instead of the hook.

Known, intentional gaps: the IANA timezone city names and the settings-search keyword index (`SETTINGS_SEARCH_ENTRIES`) stay English; provider-supplied text (usage window names, error details) is shown as received; the "Untitled chat" sentinel is a data value, not display copy; `login-form.tsx` is an unused scaffold.

When adding any user-facing string: add one row to `translations.ts` with all seven columns and read it via `t()`. Plurals use `_one`/`_other` suffixed rows called as `t("key", { count })`. Sentences containing links or styled fragments use `<Trans>` with `<0>...</0>` markers. Keep any trailing `(ALS-0xx)` tag verbatim in every language so `ErrorText` can link it.

## Component conventions

**Chat-message bubbles are background-only, no border.** Human messages use `porch-input` as a flat fill with no `porch-border` ring; agent messages have no background at all. Decided to read closer to familiar chat platforms (background-only bubbles), reserving `porch-border` for elements that specifically need to stand out (form fields, panels, dropdowns) rather than routine chat content.

**Corner radius looks like the controls' 8px.** Controls are 27px tall with an 8px radius. A rounded surface bigger than a control doesn't reuse `--radius`; it gets radius ≈ its one-line (base) height × 8/27, so its corners look the same as a control's. Measure against the base height, not the wrapped height, so the radius doesn't grow as content wraps. Prefer a CSS token that tracks the size, e.g. `--redesign-chat-bubble-radius` in `src/index.css` (about 12px on a 40px bubble).

## Text size

Chat text, compose text and sidebar/menu rows share one size, `--redesign-chat-text` in `src/index.css`: `clamp(0.75rem, calc(0.625rem + 0.25vw), 0.8125rem)`. It scales with the window from 12px up to a 13px cap. New text in those surfaces reads that token instead of a fixed size.

## Motion

- **Page transitions preload the incoming page.** `SidebarSurfaceTransition` (`src/components/design-system/sidebar-surface-transition.tsx`) mounts the incoming page invisibly as soon as the outgoing one starts fading out, so its data and settling effects are done before it fades in.
- **Changing trigger labels use transitions.dev's "Text states swap".** The compose box's trigger labels (model, effort, permission) swap through `src/lib/use-text-swap.ts` and the matching section in `src/index.css`. Use the same recipe for any other label that changes in place.
- **Two-pane dialogs use `motion="gentle"`** on `DialogContent` (`spring.gentle`, 0.98 scale), as the create- and manage-workspace dialogs do. The sign-in dialog still uses the default motion.
