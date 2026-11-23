# Sheehan Load Monitor: UI/UX design

How the app looks and behaves, and the rules to follow when changing it. Everything here is taken from the
current code (`src/index.css`, `src/components/`, `src/views/`). When the code and this file disagree, the code
wins, so update this file in the same change.

---

## 1. Product and users

| | |
| --- | --- |
| **What it is** | An internal tool for recording the GOMO data balance, availed load and promo expiry of every driver phone, with 2 screenshots from the GOMO app per phone per check. |
| **Who uses it** | Office staff recording load checks, on a computer or on the phone itself. HR answers load requests in a Telegram group, outside the app. |
| **Main job** | See which phones need load right now, record a new check quickly, and get HR to load the low ones. |
| **Where it runs** | Vercel (behind an app password) or inside Google Apps Script as a single HTML file. Data lives in Google Sheets, screenshots in Google Drive. |

### Design principles

1. **Neutral by default, color only for status.** The interface is grayscale. Red, amber, green and blue appear only
   when they mean something: low data, a promo ending, loaded, a sync notice.
2. **Status is never color alone.** Every status has a color, an icon *and* words ("Low", "Ends tomorrow",
   "Requested · 2h ago").
3. **One primary action per screen.** The dark filled button is the next step (New load check, Add driver,
   Save load check). Everything else is outline, ghost or link.
4. **Works on the phone being checked.** The load check form has camera and gallery buttons on touch devices, and
   screenshots move under the driver's name instead of hiding in a far-right column.
5. **Nothing is lost by accident.** Nothing uploads until Save. Leaving with unsaved changes asks first. Deletes
   ask first. If two people edit the same check, the second one is asked before anything is overwritten.
6. **Plain words.** Labels and messages say what happened and what to do next, in the office's own terms
   (Updated by, Availed load, GOMO SIM).

---

## 2. Visual foundation

The look is shadcn/ui's "neutral" theme. The primitives are written by hand in `src/components/ui.jsx`
(no Radix, so the Apps Script single-file build stays small). Styling is Tailwind CSS v4 with design tokens as
CSS variables.

### 2.1 Color tokens

Defined in OKLCH in `src/index.css`. Hex values are the sRGB equivalents, for reference only. Always use the
token (`bg-card`, `text-muted-foreground`, …), never the hex.

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `page` | `#fafafa` | `#0a0a0a` | Page background behind cards |
| `background` | `#ffffff` | `#0a0a0a` | Inputs, dialogs, outline buttons |
| `card` | `#ffffff` | `#131313` | Cards, stat tiles, table containers |
| `foreground` | `#0a0a0a` | `#fafafa` | Body text |
| `muted` | `#f5f5f5` | `#262626` | Table header tint, segmented control track, skeletons |
| `muted-foreground` | `#696969` | `#a4a4a4` | Hints, descriptions, secondary cells |
| `primary` / `primary-foreground` | `#171717` / `#fafafa` | `#e5e5e5` / `#171717` | Primary buttons, filled step circles, "New" tag |
| `secondary`, `accent` | `#f5f5f5` | `#262626` | Secondary buttons, hover backgrounds |
| `border`, `input` | `#e5e5e5` | white at 11% / 15% | Card, table and input borders |
| `ring` | `#a1a1a1` | `#737373` | Focus ring (used at 50% opacity) |
| `destructive` | `#e7000b` | `#ff6467` | Delete buttons, required asterisk, field errors |
| `brand` | `#c90d23` | `#ed4a49` | Sheehan red. **Defined but not used yet** (see section 9). |

**Sidebar tokens.** The sidebar is dark in both themes.

| Token | Light theme | Dark theme |
| --- | --- | --- |
| `sidebar` | `#141416` | `#0e0e10` |
| `sidebar-foreground` | `#fafafa` | `#fafafa` |
| `sidebar-muted` | `#b7b7ba` | `#b7b7ba` |
| `sidebar-accent` (active / hover item) | `#28282c` | `#242427` |

**Measured contrast (WCAG 2.x)**

| Pair | Light | Dark |
| --- | --- | --- |
| Body text on background | 19.8 : 1 | 19.0 : 1 |
| Muted text on background / page / muted | 5.5 / 5.3 / 5.1 : 1 | 8.0 / 7.5 (card) / 6.1 : 1 |
| Primary button text | 17.2 : 1 | 14.2 : 1 |
| Destructive text on background | 4.8 : 1 | 6.8 : 1 |
| **White text on destructive button** | 4.8 : 1 | **2.9 : 1, fails AA** |
| Sidebar text / muted text | 17.7 / 9.2 : 1 | 17.7 / 9.6 : 1 |
| Input / card border on background | **1.26 : 1** | n/a (alpha) |

### 2.2 Status colors

Status colors use Tailwind's palette directly (not yet tokens). Each one pairs a tinted background, a darker
border and text, and an icon.

| Meaning | Light | Dark | Example |
| --- | --- | --- | --- |
| **Danger**: under 5 GB, promo expired, errors | `red-50` bg, `red-200` border, `red-700` text (5.9 : 1) | `red-950/50` bg, `red-900` border, `red-300` text | "Low", "Expired 2d ago", "3 low data" |
| **Warning**: promo ends within 2 days, waiting for HR, remarks | `amber-50` / `amber-200` / `amber-800` (6.8 : 1) | `amber-950/50` / `amber-900` / `amber-300` | "Ends tomorrow", "Requested · 2h ago" |
| **Success**: active promo, loaded, included, new | `emerald-50` / `emerald-200` / `emerald-800` (7.3 : 1) | `emerald-950/50` / `emerald-900` / `emerald-300` | "Active · ends in 5d", "Loaded · Ana" |
| **Info**: someone changed the sheet | `sky-50` / `sky-200` / `sky-900` (8.9 : 1) | `sky-950/40` / `sky-900` / `sky-200` | Sync notice in the check editor |
| **Demo**: not connected to Sheets | `amber-400` at 10% bg, `amber-300` text | same | "Demo data" badge in the sidebar |

Remarks text is `amber-700` / `amber-400` (5.0 : 1 on white). The data bar is `red-500` when low and
`foreground/70` otherwise.

### 2.3 Typography

| | |
| --- | --- |
| **Sans** | Geist (400, 500, 600, 700) with `cv11` and `ss01` features, falling back to `system-ui` / Segoe UI |
| **Mono** | Geist Mono (400, 500) for GB values, SIM numbers, serials, `kbd` |
| **Loading** | Google Fonts with `display=swap` and `preconnect` |
| **Numbers** | `tabular-nums` on every number that sits in a column or changes (stats, GB, counts) |

| Size | Where |
| --- | --- |
| 30 px `text-3xl` semibold | Stat card values |
| 24 px `text-2xl` semibold, tight, `text-balance` | Page titles (`h1`) |
| 20 px `text-xl` semibold | Import preview stats |
| 18 px `text-lg` semibold | Password screen title |
| 16 px `text-base` semibold | Card and dialog titles |
| 15 px semibold | "Sheehan" in the sidebar |
| 14 px `text-sm` | Body, tables, inputs, buttons, descriptions |
| 13 px | Small buttons, field labels, secondary table cells, segmented control |
| 12 px `text-xs` | Hints, badges, table headers, sub-lines under names, footer |
| 11 px | Chart labels, "Click, drop or paste", `kbd` keys |

Weights: 400 body, 500 labels / buttons / table names, 600 titles. Headings use `tracking-tight`. Fieldset
legends are 12 px uppercase with wide tracking.

### 2.4 Spacing, radius, elevation

- **Spacing** follows Tailwind's 4 px grid. Page padding `px-4` (16 px), `sm:px-6` (24 px), `py-8`. Sections
  are `gap-6` (24 px). Card padding is 20 px (16 px on phones in the editor). Table cells are `px-4 py-3`.
  Dialog body is `px-5 py-4`.
- **Radius**: base `--radius` is 10 px. `rounded-md` 8 px for buttons, inputs and badges. `rounded-lg` 10 px for
  nav items, notes and thumbnails. `rounded-xl` 14 px for cards, dialogs and the empty state.
- **Elevation** is kept flat. `shadow-xs` on cards, inputs and buttons. `shadow-lg` only on things that float:
  dialogs and toasts. Dialog backdrop is black at 50%.
- **Layers**: sticky save bar `z-30`, sidebar and mobile top bar `z-40`, toasts and skip link `z-50`. Dialogs
  use the browser's top layer (`<dialog>.showModal()`), so they are always above everything.

### 2.5 Icons

- **Lucide** (`lucide-react`) only, outline style, default 2 px stroke.
- Sizes: 16 px in buttons (set by the Button primitive), 12 px in badges, 18 px in the sidebar, 20 px in empty
  states and the mobile menu.
- Icons next to text get `aria-hidden="true"`. Icon-only buttons always get an `aria-label` (for example
  "Delete load check for Nov 18, 2026", "History for Driver One") and a `title` tooltip.
- No emoji in the interface. (The ✅ on the Telegram "Done loading" button is Telegram's, not the app's.)
- The Sheehan logo sits on a white tile in both themes, because the mark contains black.

### 2.6 Motion

| What | How |
| --- | --- |
| Dialog open | 160 ms, fade + 6 px rise + scale from 0.98, `cubic-bezier(0.16, 1, 0.3, 1)` |
| Mobile drawer open | 220 ms slide in from the left, same easing |
| Buttons, nav items, rows | 150 ms color / background transitions |
| Check card chevron | 200 ms rotate |
| Loading | `animate-pulse` skeletons and thumbnails, `animate-spin` spinners |
| Reduced motion | `prefers-reduced-motion: reduce` cuts every animation and transition to 0.01 ms |

Only transforms and opacity are animated. Closing is instant.

### 2.7 Theme

- Light and dark. The first visit follows the OS setting. The toggle in the sidebar saves the choice in
  `localStorage` (`slm-theme`).
- A small inline script in `index.html` applies the theme before first paint, so the page never flashes white.
- `color-scheme` is set per theme so native date pickers and scrollbars match.
- `theme-color` is `#1b1b1f`, matching the sidebar, for the mobile browser bar and the installed app.

---

## 3. Layout and navigation

### 3.1 App shell

```
Desktop (768 px and up)                          Phone / small tablet (under 768 px)
┌────────────┬──────────────────────────────┐    ┌──────────────────────────────┐
│ [logo]     │                              │    │ ☰  [logo] Sheehan     Demo   │ 56 px sticky top bar
│ Sheehan    │  Page header      [Action]   │    ├──────────────────────────────┤
│ Load Mon.  │                              │    │ Page header                  │
│            │  ┌──────────────────────┐    │    │ [Action]                     │
│ ▣ Overview │  │ Cards / tables        │    │    │ ┌──────────────────────────┐ │
│ ▢ Load ch. │  │ (max width 1152 px)   │    │    │ │ Cards / tables            │ │
│ ▢ Drivers  │  └──────────────────────┘    │    │ │ (tables scroll sideways   │ │
│            │                              │    │ │  inside their card)       │ │
│ Demo data  │                              │    │ └──────────────────────────┘ │
│ ⟳  ☾       │  footer                      │    │ footer                       │
└────────────┴──────────────────────────────┘    └──────────────────────────────┘
  256 px fixed                                     ☰ opens the same sidebar as a
                                                   288 px drawer (max 85% width)
```

- **Sidebar** (`Sidebar.jsx`): logo and name (goes to Overview), the 3 main sections, then the Demo badge, Reload
  and Theme pinned to the bottom. Items are 44 px tall, with icon and label. The current page has the accent
  background and `aria-current="page"`.
- **Mobile drawer** is a native `<dialog>`: Esc and a backdrop tap close it, and it has a close button. Choosing an
  item closes it.
- **Main content** is centered, at most 1152 px wide (`max-w-6xl`).
- **Footer**: what stores the data, plus "Reset demo data" (demo) or "Sign out on this device" (Vercel). It is
  hidden in the check editor, where the sticky save bar takes its place.

### 3.2 Breakpoints

Tailwind defaults, mobile first.

| Breakpoint | Width | What changes |
| --- | --- | --- |
| base | under 640 px | 2 stat cards per row, page actions under the title, dialog footer buttons stacked (primary on top) |
| `sm` | 640 px | Page actions beside the title, dialog buttons in a row on the right, wider paddings |
| `md` | 768 px | Fixed sidebar instead of the top bar and drawer |
| `lg` | 1024 px | 4 stat cards per row, Screenshots column shows in tables (below this they sit under the driver's name), editor screenshots beside the fields |

Device type is detected separately with `(pointer: coarse)`: touch devices get Camera / Gallery buttons in
screenshot slots.

### 3.3 Sections and routes

| Nav item | View | Primary action |
| --- | --- | --- |
| Overview | `views/Overview.jsx` | New load check |
| Load checks | `views/Checks.jsx`, editor in `views/CheckEditor.jsx` | New load check |
| Drivers | `views/Drivers.jsx` | Add driver |

Routing is in-memory state in `App.jsx`. The editor keeps "Load checks" highlighted in the nav. Each page change
scrolls to the top and moves focus to `<main>`.

---

## 4. Screens

### 4.1 Overview: "what needs load right now"

1. **Header**: "Overview", today's date with weekday, **New load check**.
2. **Stat cards**: Phones tracked · Low data (turns red when above 0) · Expiring / expired (turns amber when
   above 0) · Last check (date, "2 days ago · by GAB").
3. **Current status card**: segmented control *All (n)* / *Needs attention (n)*, then one row per tracked phone:
   - Driver: account name, driver name (truncated, full text on hover), and on phones the 2 screenshot thumbnails.
   - Current data: value in mono, a thin bar (scaled to 60 GB) and a **Low** badge under 5 GB. Under it the load
     request state and buttons (see section 5.3).
   - Availed load (2 lines max), remarks in amber.
   - Expires: date · time, then a status badge.
   - Checked date, Screenshots (desktop), **History**.
4. **Empty states**: "Nothing needs attention" for the filter, or "No phones tracked" with **Import old sheet**
   and **Go to Drivers**.

A phone needs attention when it is under 5 GB, its promo has ended or ends within 2 days, or it has no reading.

### 4.2 Load checks: "every check, newest first"

- Header with **Import** (outline) and **New load check** (primary).
- One collapsible card per check date. Only the newest is open at first. The header shows the date with weekday,
  "Updated by · n phones · n screenshots", a red "n low data" badge, a "Today" badge, **Edit**, and a trash
  icon button.
- The open card shows a table: Driver, Current data, Availed load, Expires (judged against the check date, not
  today), Remarks, Screenshots.
- Delete asks first: "Delete this load check?" with a red **Delete check**.

### 4.3 Load check editor: "record every phone in one pass"

- **Back** link above the title (asks before discarding changes).
- **Top card**: Check date (locked when editing), Updated by (remembered on this device), and a how-to note that
  shows the `Ctrl`+`V` keys. Conditional notices span the card:
  - blue: someone changed the sheet since this page opened;
  - amber: a check already exists for this date, with **Open that check**.
- **"Phones · n of m filled"**, then one card per phone:
  - A numbered circle that becomes a filled check mark once the row has a reading.
  - Live badges as you type: "Under 5 GB", "Expired before check", "Ends within 2 days".
  - Fields: Current data (GB, decimal keypad, mono), Availed load (with suggestions from past checks),
    Exp. date, Exp. time, a **Loaded today · ends Nov 25** shortcut (sets expiry to 7 days at the current time
    and fills the default load), Remarks.
  - 2 screenshot slots in a 9:16 phone shape (see section 5.4).
- **Sticky save bar** at the bottom: status text ("Unsaved changes", "Uploading 2 of 6…"), **Cancel**,
  **Save load check**. The Save button shows the progress text and a spinner while working.
- After saving, phones under 5 GB are requested from HR automatically, and toasts say which were sent, skipped
  or failed.

### 4.4 Drivers & phones

- Header with **Import** and **Add driver**.
- Search field (name, email, SIM, serial) and a count, "8 in load checks · 9 total".
- Table: Account, Assigned driver, Driver email, Phone (brand, model, color), Serial #, GOMO SIM #, Load checks
  (Included / Not tracked), and History / Edit icon buttons. Phones not tracked show in muted text.
- A note under the table explains why passwords and PINs aren't stored in the app.
- **Driver dialog** (wide, `max-w-2xl`): fieldsets *Driver*, *Login*, *Phone*, plus an "Include in load checks"
  switch. New drivers are pre-filled from the existing phones (next "Driver Nine", Samsung Galaxy A07, Black), so
  only the unique details need typing.

### 4.5 Dialogs

| Dialog | Purpose | Notes |
| --- | --- | --- |
| Request load / Send to Telegram | Send a phone's reading and screenshots to HR | Summary list, the screenshots that will be sent, "Ask HR to load this phone" switch, Your name (remembered), Note for HR. A notice appears if Telegram isn't set up. |
| History | Every check for one phone | Bar chart of GB per check with a dashed 5 GB line and values on the bars, then a table. |
| Screenshot viewer | Full-size screenshots | One shared dialog for the whole app. Shows both shots side by side on larger screens, with "Open in Drive". |
| Import from the old spreadsheet | Bring in old data | Step 1: drop or choose a .csv, or paste cells. Step 2: preview with counts, New / Already in app badges, warnings. The button names what it will do ("Import 12 load checks"). |
| Delete / Discard / Conflict | Confirm risky actions | The destructive choice is red and on the right. The safe choice is outline. |

All dialogs share `Dialog` in `ui.jsx`: title and description wired to `aria-labelledby` / `aria-describedby`,
close (X) button, Esc and backdrop close, a scrolling body, and a tinted footer. While saving (`busy`) they can't
be closed.

### 4.6 System states

| State | Look |
| --- | --- |
| First load | Skeletons in the shape of the Overview (title, 4 stat tiles, table) |
| Sheet unreachable | Centered card, warning icon, "Couldn't load the sheet", the reason, **Try again** |
| Password needed (Vercel) | Centered card with a lock icon, one password field, **Open load monitor** |
| Background sync | Checks every 45 s and when the tab comes back. Outside the editor it reloads quietly and shows a toast. In the editor it only shows the blue notice. |

---

## 5. Components and patterns

### 5.1 Primitives (`src/components/ui.jsx`, `Layout.jsx`)

| Component | Variants / sizes | Rules |
| --- | --- | --- |
| `Button` | `default` (primary), `outline`, `secondary`, `ghost`, `destructive`, `link` · `sm` 32 px, `default` 36 px, `lg` 40 px, `icon` 36 px, `icon-sm` 32 px | `loading` shows a spinner, disables the button and sets `aria-busy`. One `default` per screen. |
| `Card` (+ Header, Title, Description, Content) | | 14 px radius, border, `shadow-xs` |
| `Input`, `Textarea` | | 36 px tall. `aria-invalid` turns the border red. |
| `Field` | | Renders label, control, then hint *or* error. Wires `id`, `aria-describedby`, `aria-invalid`, `required`. A red `*` marks required fields. Always use it for form fields. |
| `Badge` | `success`, `warning`, `danger`, `muted`, `secondary`, `outline`, `default` | 12 px, 12 px icon. Status badges always include words. |
| `Switch` | | `role="switch"` + `aria-checked`. Always paired with a visible label and a one-line explanation. |
| `Dialog` | width via `className` (`max-w-lg` default, `2xl`, `3xl`) | See section 4.5 |
| `Toast` (`useToast()`) | `success` (default), `error` | Bottom-center on phones, bottom-right on desktop. 4 s by default, longer for long or important messages. Errors use `role="alert"`. |
| `PageHeader` | | `h1` + description + actions, optional slot above the title (Back link) |
| `StatCard` | tone `default`, `warning`, `danger` | Icon tile changes tone only when the value needs attention |
| `EmptyState` | | Dashed border, icon tile, title, description, up to 2 actions |
| `Table`, `th`, `td` | | Scrolls sideways inside its card only, never the page. Header row tinted `muted/40`, row hover tint. |
| `Skeleton` | | Pulse on `muted` |

### 5.2 Status display (`Status.jsx`)

Thresholds live in `src/lib/format.js`: `LOW_DATA_GB = 5`, `EXPIRING_DAYS = 2`, `PROMO_DAYS = 7`.

| Status | Rule | Display |
| --- | --- | --- |
| Low data | under 5 GB | Red mono value, red bar, red **Low** badge with alert icon |
| OK data | 5 GB or more | Mono value "38.13 GB", dark bar |
| Expired | expiry date passed | Red badge, triangle icon, "Expired 2d ago" |
| Ending soon | 0 to 2 days left | Amber badge, clock icon, "Ends today / tomorrow / in 2d" |
| Active | more than 2 days | Green badge, "Active · ends in 5d" |
| No record | no reading yet | Muted "No record" badge |
| Missing value | | Em dash "—" in muted text |

### 5.3 Load requests (`LoadRequest.jsx`)

```
No request        →  [Request load]  [Send to Telegram]
Waiting for HR    →  (Requested · 2h ago)  [Send to Telegram]          amber, hourglass
HR pressed Done   →  (Loaded · Ana)  [Request load]  [Send to Telegram]  green, check
                     (shown until a newer load check is recorded)
```

- **Request load** is a normal outline button when the phone needs load, and a smaller muted one when it
  doesn't. It is still available, just quieter.
- Badge tooltips give the full story: who asked, when, who finished it.
- A second request can't be made while one is waiting. The switch in the dialog is locked and says why.

### 5.4 Screenshots (`Screenshots.jsx`)

| | Empty slot | Filled slot |
| --- | --- | --- |
| **Mouse** | Dashed 9:16 box: "Add image · Click, drop or paste". Highlights while dragging. Focus it and paste with `Ctrl`+`V`. | Preview (top-aligned), "New" tag until uploaded, Replace / View / Remove buttons |
| **Touch** | 2 large buttons, **Camera** (opens the back camera) and **Gallery** | Preview, Camera / Gallery / Remove |

- Images are shrunk to at most 1800 px and saved as JPEG before upload. "Preparing…" shows while that runs.
- Thumbnails in lists are 9:16 (72 × 128 px, or 90 × 160 px on phones), load only when near the screen, pulse
  while loading, and open the shared viewer.
- Broken or missing images show an "image off" icon with the reason, never an empty box.

### 5.5 Forms

- Every field has a visible label. Placeholders only show an example ("e.g. 38.13", "09XXXXXXXXX").
- Hints sit under the field and say what happens ("Saved in capital letters.", "Remembered on this device.").
- Validate on blur and on submit, not while typing. On a failed submit, focus moves to the first invalid field.
- Errors say how to fix it: "Use the 11-digit number, e.g. 09761500060.", "A load check already exists for this
  date. Open it to edit instead."
- Use the right input types: `date`, `time`, `email`, `search`, `password`, `inputMode="decimal"` / `"tel"`, and
  `autoComplete` where it helps.
- Names typed once ("Updated by", "Your name") are remembered per device in `localStorage` (`slm-updated-by`).
- Related fields are grouped in `<fieldset>` with a small uppercase legend.

### 5.6 Feedback and safety

| Situation | Pattern |
| --- | --- |
| Saving | Button spinner plus step text in the button and the save bar ("Uploading 2 of 6…", "Saving…") |
| Success | Toast that names the thing: "Load check for Nov 18, 2026 saved · 8 phones." |
| Failure | Error toast, or an inline red note in dialogs, with the reason and the next step |
| Leaving with changes | "Discard unsaved changes?" dialog, plus the browser's own warning on reload or close |
| Delete | Confirm dialog that says what is removed and what is kept ("Screenshot files stay in the Drive folder.") |
| Edit conflict | "Someone else saved this check first": **Discard mine, load theirs** or **Save mine anyway** |
| Rate limit | "Telegram is busy · continuing in 12s…" countdown |

---

## 6. Accessibility

What the app already does:

- **Skip link** "Skip to content" as the first focusable element.
- **Focus moves to `<main>`** on every page change, for keyboard and screen reader users.
- **Visible focus**: a 3 px ring on every control (`focus-visible`), white-tinted in the sidebar.
- **Landmarks and headings**: `nav aria-label="Main"`, `main`, `footer`. One `h1` per page, `h2` for cards,
  `h3` for editor phone cards.
- **States are announced**: `aria-current` (nav), `aria-pressed` (filter), `aria-expanded` + `aria-controls`
  (check cards, menu), `aria-checked` (switches), `aria-busy` (buttons, loading).
- **Live regions**: the toast stack is `aria-live="polite"`, errors are `role="alert"`, the save bar status is
  `aria-live="polite"`.
- **Labels**: every icon button has an `aria-label` that names its target. Table action headers have `sr-only`
  text. Screenshot slots describe all 3 input methods.
- **Chart**: the history chart has a text summary in `aria-label` ("Nov 10 38.1 GB, Nov 18 4.2 GB…"), values on
  the bars, a legend for the 5 GB line, and a full table under it.
- **Native `<dialog>`**: focus is trapped inside, Esc closes it, and focus returns to the opener.
- **Color + icon + text** for every status. Contrast passes AA for all text except the dark-mode destructive
  button (section 9).
- **Reduced motion** is respected everywhere.
- **Pointer cursor** on all enabled buttons and clickable labels.

---

## 7. Writing style

| Rule | Example |
| --- | --- |
| Sentence case for buttons, titles and labels | "New load check", "Drivers & phones" |
| Buttons start with a verb and name the result | "Send load request", "Import 12 load checks", "Save mine anyway" |
| Middle dot `·` joins short facts | "Updated by GAB · 8 phones · 16 screenshots" |
| Em dash `—` for an empty value | |
| Dates: `en-US` short | "Nov 18, 2026", with weekday in headers: "Wed, Nov 18, 2026". Year dropped in tight spots: "Nov 18" |
| Relative time where it helps | "Today", "2 days ago", "in 3d", "2h ago" |
| Data | Always 2 decimals with unit: "38.13 GB". Times in 12 h: "7:06 AM" (the sheet's format) |
| Typographic punctuation | Curly apostrophes and quotes (’ “ ”), ellipsis character (…) |
| Say why, not just what | "Ask the IT team if you don’t have it. It’s remembered on this device." |
| Office vocabulary | Updated by, Availed load, GOMO SIM, Load check, Done loading |

---

## 8. Rules for new UI

1. Build from the primitives in `ui.jsx` / `Layout.jsx`. Add a new primitive there rather than one-off styles.
2. Use tokens (`bg-card`, `text-muted-foreground`, `border`), never hex values. Status colors follow the table in
   section 2.2 until they become tokens.
3. One primary button per screen. Destructive actions are red, need a confirm dialog, and sit on the right of the
   footer.
4. Every status needs words and an icon, not only a color.
5. New tables go inside a `Card` with `Table`, and must work at 375 px: hide low-value columns below `lg`, or
   move them under the first column as the Screenshots column does.
6. Wrap each form field in `Field`. Validate on blur and submit, and focus the first error.
7. Every async action shows progress on the button that started it and ends with a toast or an inline message.
8. Any change that loses data asks first and says what will be lost.
9. Test light and dark, 375 px and desktop, keyboard only, and with reduced motion on.
10. Keep the single-file Apps Script build light: no new UI libraries for things a few lines of Tailwind can do.

---

## 9. Known gaps and recommendations

Found by checking the code against WCAG 2.2 and the ui-ux-pro-max checklist. Highest priority first.

| # | Issue | Where | Suggested fix |
| --- | --- | --- | --- |
| 1 | **White text on the red button is 2.9 : 1 in dark mode** (AA needs 4.5 : 1). Affects Delete check, Discard and Save mine anyway. | `buttonVariants.destructive` in `ui.jsx`, `--destructive` in `.dark` | Add a `--destructive-foreground` token and use dark text on the light red in dark mode, or keep a darker red background for the button in dark mode (the light-mode red gives 4.8 : 1 with white). |
| 2 | **The editor's save bar is centered on the whole window, not the content column.** On desktop, the left part (the "Unsaved changes" / "Uploading…" text) is hidden behind the sidebar, and the buttons don't line up with the content. | sticky bar in `CheckEditor.jsx` (`fixed inset-x-0`) | Add `md:left-64` to the bar so it starts after the sidebar. |
| 3 | **Inputs are 14 px**, so iOS Safari zooms the page when a field is focused. The form is used on phones. | `inputBase` in `ui.jsx` | Use `text-base sm:text-sm` (16 px on small screens), as shadcn's own Input does. |
| 4 | **Small touch targets on phones.** Small buttons and icon buttons are 32 px. The filter toggle, "Send to Telegram" and the quiet "Request load" are 28 px. They pass WCAG 2.2 AA (24 px) but are below the 44 px finger guideline. | `buttonSizes.sm`, `icon-sm`, the filter in `Overview.jsx`, `RequestStatus` | Bump to 40 to 44 px on touch devices only, e.g. `pointer-coarse:h-10`. Desktop density stays the same. |
| 5 | **No URLs per screen.** Browser Back leaves the app, refresh always returns to Overview, and a check can't be linked. | route state in `App.jsx` | Hash routes (`#/checks`, `#/checks/2026-11-18`, `#/drivers`) on Vercel. In Apps Script, use `google.script.history` / `google.script.url`, because the page runs in an iframe there. |
| 6 | **Faint field borders and focus ring.** Input borders are 1.26 : 1 against the background, and the focus ring is `ring` at 50% opacity: 1.5 : 1 in light, 1.9 : 1 in dark. WCAG 1.4.11 asks for 3 : 1 on component boundaries. | `--input`, `--ring`, `focusRing` | Darken `--input` for inputs only (cards can keep the light border) and use the ring at full opacity. |
| 7 | **Status colors are hard-coded Tailwind classes** repeated in `Badge`, `StatCard`, the editor notices, `ImportDialog` and `LoadRequest`. | several files | Add `--success`, `--warning`, `--danger`, `--info` (each with `-bg`, `-border`, `-fg`) to `index.css` and use them everywhere. A small `Alert` primitive would replace the 5 hand-made notice boxes. |
| 8 | **The `--brand` token (Sheehan red) is never used**, so the app has no brand color apart from the logo. | `index.css` | Either use it sparingly (active nav indicator, focus ring in the sidebar, the password screen) or remove it. Don't use it for status, because red already means "low data". |
| 9 | **Error toasts disappear on their own** (7 to 10 s), even when they list phones that still need action. | `ToastProvider`, `CheckEditor.autoRequest` | Keep error toasts until dismissed, or also show the result inline on Overview. |
| 10 | **Wide tables on phones.** Overview has 7 columns and Drivers has 8. They scroll sideways inside the card, which works, but the key values aren't all visible at once. | `Overview.jsx`, `Drivers.jsx` | On phones, show each row as a stacked card (name, data, expiry badge, actions) and hide secondary columns. |
| 11 | **11 px text** for chart labels, slot hints and `kbd`. | `DriverHistory.jsx`, `Screenshots.jsx` | Raise to 12 px minimum. |

---

## 10. File map

| File | What it holds |
| --- | --- |
| `src/index.css` | Tokens (light, dark, sidebar), base styles, dialog and drawer motion, reduced motion |
| `index.html` | Fonts, theme-before-paint script, meta and link-preview tags |
| `src/components/ui.jsx` | Button, Card, Input, Textarea, Label, Field, Badge, Switch, Skeleton, Separator, Dialog, Toasts |
| `src/components/Layout.jsx` | PageHeader, StatCard, EmptyState, Table |
| `src/components/Sidebar.jsx` | Desktop sidebar, mobile top bar and drawer, logo |
| `src/components/Status.jsx` | DataCell, ExpiryCell, ExpiryBadge |
| `src/components/LoadRequest.jsx` | RequestStatus, RequestLoadDialog |
| `src/components/Screenshots.jsx` | Screenshot viewer, thumbnails, upload slot |
| `src/components/DriverHistory.jsx` | History dialog and chart |
| `src/components/ImportDialog.jsx` | Import flow |
| `src/views/*.jsx` | Overview, Checks, CheckEditor, Drivers |
| `src/lib/format.js` | Thresholds, date, time and GB formatting, status rules |
