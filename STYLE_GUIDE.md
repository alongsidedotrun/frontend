# Frontend style guide

Narrow, cross-cutting frontend decisions that don't belong in `project/architecture/HLD.md`/`LLD.md` (both explicitly scope frontend design out, see `LLD.md`'s Scope section) and aren't architectural enough to need an ADR. Moved here from `project/architecture/adr/0010-frontend-colour-palette.md` on 2026-08-20, once the project stopped writing new ADRs (that folder has since been folded into `HLD.md`/`LLD.md` and removed entirely); content unchanged from that ADR, just reframed as living reference documentation instead of a decision record.

## Colour palette

**Rule: every colour that appears more than once, or that represents a distinct semantic surface, is a named token in `tailwind.config.js`'s `theme.extend.colors`, used via Tailwind utility classes (`bg-porch-bg`, `text-porch-muted`) rather than raw hex in markup.** This exists because a light theme cannot be built against an undocumented, partially-tokenised palette: only named Tailwind classes can realistically be swapped per theme, not one-off `bg-[#131313]`-style literals scattered through markup. There was previously ambiguity between two separate border tokens (`porch-input-border` and `porch-border`) with no documented rule for which to use where; that was resolved by consolidating to the single `porch-border` token below before light values were added, rather than carrying the ambiguity into a second theme.

| Token | Dark | Light | Used for |
|---|---|---|---|
| `porch-bg` | `#20201F` | `#FAF9F5` | Page/app background; sidebar and main content area both sit on this. |
| `porch-card` | `#131313` | `#131313` (unchanged) | Panel-level surfaces only: the auth page's left panel, the Settings modal's own outer background. Deliberately stays dark in both themes rather than flipping with the page background. **No longer used for `.field-input`/`.plain-btn`** (see 2026-08-03 note below) — those are controls placed inside such panels, not panels themselves. |
| `porch-input` | `#262626` | `#F3F1ED` | The compose box (message input) background, human chat-message bubbles, and (as of 2026-08-03) `.field-input`/`.plain-btn` — anything interactive/conversational rather than a static panel. |
| `porch-border` | `#3A3A3A` | `#E4E4E7` | The one border/stroke colour, used everywhere a visible border or ring appears: the compose box, `+`/filter icon buttons, the sidebar's right edge, dropdown-panel borders, hovercards, the Settings modal, form fields (`.field-input`), `.plain-btn`. Previously split across two tokens (`porch-input-border` / `porch-border`); consolidated to one, see above. Dark value raised from the original `#27272A` after it read as almost invisible against `porch-input`'s `#262626` background (the compose box border specifically). Also now doubles as `.plain-btn`'s hover colour. Deliberately **not** used on chat-message bubbles: bubbles are background-only (see below) so borders stay reserved for elements that need to stand out more. |
| `porch-text` | `#F1EFE8` | `#20201F` | Primary text colour; also the avatar's fill (a filled circle). |
| `porch-muted` | `#A1A1AA` | `#73726C` | Secondary/muted text and icon colour: placeholder text, sidebar icons at rest, timestamps, disclaimer text. Nearly every icon in the app is `porch-muted` at rest and brightens to `porch-text` on hover. |
| `porch-btn` | `#333333` | `#333333` (unchanged) | The one solid accent-ish button fill in the app (e.g. the Settings modal's Save button). |
| `porch-btn-hover` | `#444444` | `#444444` (unchanged) | Hover state for `porch-btn`. |

**`porch-card`, `porch-btn`, and `porch-btn-hover` are theme-invariant by design**, not oversights: the same hex value is correct in both the Dark and Light columns above. Anyone extending this table should preserve that rather than assume every token must differ per theme. That said, the "theme-invariant by design" call is scoped to `porch-card` itself (still correct for panel-level surfaces like the Settings modal's own background); it does not extend to form controls placed inside those panels (see the `porch-card`/`porch-input` note above).

Not yet promoted to tokens, and out of scope for theming regardless:

- `#000AC2` — the old logo mark's brand colour; superseded by the new pixel-grid mark, which is fully self-contained (its own fixed `#323232`/`#41403E`/`#FAF9F5` fill colours baked into the SVG) rather than theming via this token system. The mark is now a single asset used for both themes (`frontend/logo.svg` and `frontend/logo-light.svg` are identical copies), deliberately a fixed badge like Slack's or Discord's icon, not a blend-with-the-sidebar mark, so it no longer needs separate Light/Dark variants at all. Master source files live in `frontend/assets/source/Porch {16,32,48,64,128,180,256,512,1024}px.svg`.
- Google's own "G" logo colours (`#FFC107`, `#FF3D00`, `#4CAF50`, `#1976D2`) — must never be re-themed, they belong to Google.

## Open items

- **Theme-switching mechanism is still undesigned.** Whether this becomes a `data-theme` attribute swapping CSS custom properties, a second compiled stylesheet, or something else, is open implementation work for whoever picks up the Settings toggle. This document only fixes the values each mechanism would need to swap between.
- **One hardcoded value still needs to be kept in sync by hand.** `.btn-shadcn-outline` (the auth page's "Continue with Google" button) uses `box-shadow: 0 0 0 1px #3A3A3A` instead of a real `border`, specifically so the ring renders outside the box-sizing border-box rather than shrinking the button's interior relative to its borderless "Continue with email" sibling. The value is meant to match `porch-border`'s dark value but is written as a raw hex literal, since Tailwind's `shadow-[...]` arbitrary syntax doesn't cleanly reference a theme colour by name; it already drifted out of sync once when `porch-border` was retuned from `#27272A` and had to be updated by hand to match. Should eventually be reconciled (e.g. via a CSS custom property) so this doesn't require remembering to update it every time `porch-border` changes.

## UI text / i18n (issue #307)

**Rule: no raw user-facing string literals in JSX going forward.** Every UI string (button labels, titles, descriptions, empty states, error messages) is a key in `src/i18n/translations.ts` — one row per key, one column per language (`en`, `pt-BR`, `es`, `fr`, `de`, `zh`, `ja`) — read via `useTranslation()`'s `t("the.key")`, not a hardcoded English string. `src/i18n/index.ts` transposes that table into `react-i18next`'s resources shape at init time; `src/lib/language.ts`'s `LanguageValue`/`uiLocaleFor` is the one shared setting (Settings → General → Language) that drives both this UI language and, separately, the AI's own reply language.

Every page and shared component in `frontend/src` is converted: Settings, sidebar, header, Home, Inbox, Library, Welcome, Auth, Provider usage, chat (messages, permission cards, tool rows, diffs), compose box and the right panel. Code that runs outside React render (relative times, effort labels, thrown load errors, OS notifications) uses the `i18n` singleton (`import i18n from "@/i18n"`, `i18n.t(...)`) instead of the hook.

Known, intentional gaps: the IANA timezone city names and the settings-search keyword index (`SETTINGS_SEARCH_ENTRIES`) stay English; provider-supplied text (usage window names, error details) is shown as received; the "Untitled chat" sentinel is a data value, not display copy; `login-form.tsx` is an unused scaffold.

When adding any user-facing string: add one row to `translations.ts` with all seven columns and read it via `t()`. Plurals use `_one`/`_other` suffixed rows called as `t("key", { count })`. Sentences containing links or styled fragments use `<Trans>` with `<0>...</0>` markers. Keep any trailing `(ALS-0xx)` tag verbatim in every language so `ErrorText` can link it.

## Component conventions

**Chat-message bubbles are background-only, no border.** Human messages use `porch-input` as a flat fill with no `porch-border` ring; agent messages have no background at all. Decided to read closer to familiar chat platforms (background-only bubbles), reserving `porch-border` for elements that specifically need to stand out (form fields, panels, dropdowns) rather than routine chat content.
