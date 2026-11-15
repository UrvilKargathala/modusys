# Modusys Mobile: Claude Design prompts

How to use: paste **Prompt 0** first in a new Claude Design project. It sets the brand and the rules. Then paste one screen prompt at a time (1 to 11) in the same project, so every screen uses the same style.
Colours and fonts come from the live web app (`app/globals.css`, `lib/status.ts`, `app/fonts/`), so the app will look like modusys.co.in.

---

## Prompt 0: Design system and context (paste first)

```
I'm designing a mobile app called "Modusys" for The Furn Enterprise, a modular kitchen and furniture business in Surat, India. It's the phone companion to our existing web app (modusys.co.in). Users are our own staff: field sales and site staff, plus the owner/admin. It will be built in React Native for iPhone and Android, so design native-feeling mobile screens (iPhone 16 frame, 393×852), not a shrunk website.

Brand and style, use exactly these:
- Primary (buttons, active tab, links): Cyan 700 #288AB8; pressed/hover #2D9CCF
- Brand tints: #EAF7FC (field backgrounds, info strips), #D6EFFA (soft cards), #ADDEF5 (table/section headers, selected chips)
- Text: #262626 main, #5D6772 secondary, #AAB0B6 placeholder; borders #E2E4E8
- Screen background #F7F8F9, cards white with 12px radius and a very soft shadow
- Fonts: Raleway for headings and text, Manrope for all numbers (amounts, counts, dates, times)
- Icons: Lucide-style line icons, 1.5px stroke

Status badges (soft tinted background + solid coloured text, pill shape), the same everywhere:
- Draft: grey #45505C on #F4F4F4
- Confirmed: green #27AE60 on #F4F8F7
- Requirement Order: indigo #3538C0 on #EDEDF8
- In Purchase: amber #B8901F on #FEF3F5
- In Production: orange #E04F16 on #FDF8F3
- Dispatched: cyan #06AED4 on #E9F8FB
- Completed: teal #0E9384 on #E9F5F4
- Cancelled: red #EF1E1E on #FEF4F4

Formats: Indian rupees with Indian grouping (₹2,15,200; large values as ₹12.5 L / ₹1.2 Cr), dates DD/MM/YYYY, times 12-hour (09:42 AM). Use realistic Indian names, Surat areas (Adajan, Vesu, Pal, Citylight) and kitchen/wardrobe project names as sample data.

Navigation: bottom tab bar with 4–5 tabs. Staff see: Home, Attendance, Customers, Tasks, More. Owner/admin also get Dashboard, Quotes and Purchase Orders (inside the tabs or under More).

Rules: big touch targets (min 44px), one primary button per screen, clear empty/loading/error states, works with large system text. Light mode only for now.

Start by showing me a one-page style sheet: colours, type scale, buttons (primary, secondary outline, text), inputs, status badges, list row, card, KPI tile, bottom tab bar, and an empty state.
```

---

## Prompt 1: Sign In and Change Password

```
Design the Sign In flow for Modusys, using the style sheet above.

Screen A, Sign In: The Furn logo at the top, title "Welcome back", subtitle "Sign in to Modusys". Email field, password field with show/hide eye, "Sign in" primary button (full width). A small error state under the form: "Incorrect email or password". No sign-up link (accounts are created by the admin). Small footer "The Furn Enterprise".

Screen B, Change Password (shown on first login when the admin set a temporary password): title "Set a new password", short explanation, new password + confirm password fields, a live checklist (8+ characters, one number, one letter, passwords match) with ticks, "Save and continue" button.

Also show the loading state of the Sign In button.
```

## Prompt 2: Home (two versions)

```
Design the Home screen in two versions.

Version A, staff: greeting "Good morning, Rahul" with date (Fri, 14/11/2026). A large attendance card at the top: if not checked in, a big "Check in" button with current location text ("Adajan, Surat"); if checked in, show "Checked in at 09:42 AM", hours so far, and a "Check out" button. Below: "Today's tasks" (3 rows with due time and a tick circle), "Recent customers" (3 rows with name, area, stage badge), and a notifications preview with an unread count.

Version B, owner/admin: same greeting and attendance card, then a row of 4 KPI tiles (Open quotes, Confirmed this month ₹ value, Purchase orders pending, Staff present today 18/22), then "Quotes needing attention" (3 rows with quote number, customer, amount, status badge) and "Recent purchase orders".

Bottom tab bar visible, Home active.
```

## Prompt 3: My Attendance

```
Design My Attendance.

Top: today card with status (Not checked in / Checked in / Checked out), check-in time, check-out time, total hours, location name, and the selfie thumbnail taken at check-in. Primary button changes between "Check in" and "Check out".

Middle: this month summary chips: Present 18, Late 2, Leave 1, Absent 0.

Bottom: history list by day (date, check-in and check-out time, hours, small Late or Leave badge). Tapping a day opens a detail sheet with both selfies, both locations on a small map preview, and notes.

Also show the empty state for a new employee with no history.
```

## Prompt 4: Check-in camera flow

```
Design the check-in flow (3 steps, full screen).

Step 1, Location: "Getting your location…" then the found place ("Adajan Hajira Road, Surat") with accuracy, a small map preview, and "Continue". Include the permission-denied state: explanation plus "Open Settings".

Step 2, Selfie: front camera view with an oval face guide, capture button, flip camera, and a hint "Make sure your face is clearly visible". After capture: preview with "Retake" and "Use photo".

Step 3, Confirm: selfie, time (09:42 AM), location, optional note field ("Working at site, Vesu"), and a "Check in" primary button. Then a success screen: a big tick, "Checked in at 09:42 AM", and "Back to Home".
```

## Prompt 5: Customers list

```
Design the Customers list (CRM).

Search bar at the top ("Search name, phone, area"), filter chips under it (horizontally scrollable), using our real CRM stages: All, Upcoming Inquiry, Inquiry In Process, Design, Quotation, Onsite Measurements, Onsite Marking, Production, Material Requirement Slip, Ready To Dispatch, Installation, Services, Site Completed, Cancel Order. Stage badge colours: Upcoming Inquiry grey, Inquiry In Process info blue #2F80ED, Design purple #800080, Quotation primary #288AB8, Onsite Measurements cyan #06AED4, Onsite Marking teal #0E9384, Production orange #E04F16, Material Requirement Slip indigo #3538C0, Ready To Dispatch blue #3F88FE, Installation pink #DD2590, Services amber #B8901F, Site Completed green #27AE60, Cancel Order red #EF1E1E (soft tinted background, solid text). List rows: avatar initials, customer name, area + phone, project type ("Modular kitchen", "Wardrobe"), stage badge on the right, last activity ("2 days ago"). A floating "+" button to add a lead.

Show the list state, a no-results state for a search, and the loading skeleton.
```

## Prompt 6: Customer detail

```
Design the Customer detail screen.

Header: name, stage badge, area, and quick action buttons Call, WhatsApp, Directions (opens maps). Tabs: Overview, Notes, Photos.
- Overview: contact details, address, architect (if any), assigned salesperson, project type, budget (₹ Indian format), linked quotes list with status badges.
- Notes: timeline of notes with author and date, and an input at the bottom "Add a note…" with a send button.
- Photos: grid of site photos with dates, an "Add photo" tile (camera or gallery), and a full-screen photo viewer.
```

## Prompt 7: Tasks

```
Design the Tasks screen.

Segmented control: Today, Upcoming, Done. Task rows: tick circle, title ("Site measurement – Patel residence"), linked customer, due date/time, priority dot (high = red, normal = grey). Overdue tasks show the due time in red. Swipe right to mark done. Tap opens a task detail sheet with description, customer link and a "Mark as done" button. Include the empty state "No tasks for today".
```

## Prompt 8: Notifications

```
Design the Notifications screen.

Grouped by Today, Yesterday, Earlier. Each row: icon by type (quote, purchase order, task, attendance, customer message), title, one-line description, time, and an unread dot. "Mark all as read" in the header. Tapping opens the related item. Include the empty state "You're all caught up".
```

## Prompt 9: Owner Dashboard (read-only)

```
Design the owner Dashboard (super admin only, read-only).

Period switcher: This month / Last month / This year. KPI tiles in a 2×2 grid: Total quotes, Confirmed value (₹ L/Cr), Conversion rate %, Purchase orders value. A donut chart of quotes by status, using exactly the status colours from the style sheet, with a legend. A simple bar chart of confirmed value per month (last 6 months). A "Top salespeople" list with counts and values. Everything tappable leads to a list, but nothing is editable.
```

## Prompt 10: Quotes list and quote summary (read-only)

```
Design Quotes for admin/owner (read-only).

List: search, status filter chips (All, Draft, Confirmed, Requirement Order, In Purchase, In Production, Dispatched, Completed, Cancelled), rows with quote number (Q-2026-0142), customer name, project type, amount (₹2,15,200), date, status badge.

Quote summary screen: header with quote number, status badge, customer and date; amount breakdown card (Carcass, Shutter, Other Panel, Hardware, Discount, GST, Grand total in bold); a status timeline (Draft → Confirmed → Requirement Order → In Purchase → In Production → Dispatched → Completed) with dates for the steps reached; and a "View PDF" secondary button. No edit buttons.
```

## Prompt 11: Purchase Orders list and detail (read-only)

```
Design Purchase Orders for admin/owner (read-only).

List: search, filter chips with our real PO statuses (All, Pending, Confirmed, In Production, Dispatched), rows with PO number (PO-2026-0087), vendor name, linked quote/customer, amount, date, status badge.

PO detail: vendor card (name, city, phone with Call button), linked quote, line items list (item, size/spec, qty, rate, amount), totals with GST, transport details, and a status timeline. No edit buttons.
```

## Prompt 12: More / Profile

```
Design the More tab.

Top: profile card (photo/initials, name, role "Sales" or "Admin", email). Menu list: My Leaves, Change password, Notifications settings, Help, About (app version 0.1.0), and "Sign out" in red at the bottom with a confirm dialog. For owner/admin, also show shortcuts to Dashboard, Quotes and Purchase Orders here.
```
