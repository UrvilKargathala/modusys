# Modusys Mobile: Claude Design prompts (v2, with Dribbble references)

How to use:
1. New Claude Design project. Paste **Prompt 0** first; it sets the brand, the visual style and the rules.
2. Then paste one screen prompt at a time (1 to 13) **in the same project**, so every screen shares one style.
3. With each prompt, attach a screenshot of the reference shot(s) listed above it. Claude Design may not open Dribbble links itself, so the screenshot is what it actually sees. The references are for **layout, spacing and feel only**: colours, fonts and data always come from Prompt 0.

Data rules behind these prompts (so the design matches what the app can really show):
- Fields come from the real database and API (`backend/prisma/schema.prisma`, `web/app/api/*`). A field the system doesn't have isn't in the design.
- Status names come from `shared/status.ts`, CRM stages from `shared/constants/pipelineStages.ts`, PO statuses from `shared/purchase-order.ts`, task priorities from `shared/constants/priority.ts`.
- Roles: staff see Home, Attendance, Customers, Tasks, More. Admin also sees Quotes and Purchase Orders; super admin also sees the Dashboard.

---

## Reference board

| Section | Reference | Take from it | Leave out |
|---|---|---|---|
| Sign in | [Jobsly Sign in/up](https://dribbble.com/shots/20031800-Jobsly-Sign-in-up-UI) | Coloured brand header with a white card rising over it, floating-label fields, full-width button | Social sign-in, sign-up (admin creates accounts) |
| Home, cards, KPI tiles | [B2B SaaS Mobile CRM](https://dribbble.com/shots/27470141-B2B-SaaS-Mobile-CRM) | 2×2 KPI tiles with trend arrows, pill period filter, list rows with "View more", floating pill tab bar | Orange brand, people avatars as photos |
| Dashboard | [CRM Dashboard B2B SaaS](https://dribbble.com/shots/27825094-CRM-Dashboard-B2B-SaaS-Mobile-App) | Big total + bar chart with one highlighted bar, team activity rows, overview rows | 3D illustration onboarding |
| Dashboard | [Survey Analytics Dashboard](https://dribbble.com/shots/27597261-Survey-Analytics-Dashboard-Mobile-App-UI-Design) | KPI tiles with a small ring % in the corner, one tile highlighted in the brand tint, quick-action row | Purple brand |
| Tasks | [Task Management App](https://dribbble.com/shots/24345324-Task-Management-App-Project-Management-App-Ui) | Soft coloured summary blocks (To do / In progress), task cards with priority pill, progress arc | Projects, avatars stacks, comments counts |
| Notifications | [Notification UI](https://dribbble.com/shots/25737679-Notification-UI-mobile-design) | All / Unread chips with counts, "Mark all as read", Today / Yesterday groups, round type icon, unread dot, read rows greyed, line-art empty state | Course/learning content |
| Attendance | [Clocky Employee Attendance](https://dribbble.com/shots/27055140-Clocky-Employee-Attendance-Mobile-App) | "Today's Summary" card, big round Clock In button, Clock in / Clock out / Work hours row, attendance log table, full-screen face camera with corner frame | Break time, request counts |
| Check in button | [Cotap Attendance](https://dribbble.com/shots/27161215-Smart-Attendance-Tracking-Mobile-App-UI-Cotap) | Concentric soft rings around the round Check In button | Emergency leave, chat tab |
| Customer detail | [Mortgage CRM Lead Details](https://dribbble.com/shots/26448484-Mortgage-CRM-Lead-Details-Mobile-App) | Contact header with round action icons (message, mail, call, more), Notes section with count and "+ Add note" | Reminders, assignment dropdowns |
| Customer profile | [CRM Mobile App Design](https://dribbble.com/shots/26011763-CRM-Mobile-App-Design) | Profile header layout, About block | Score gauge |
| Quotes / POs | [Solo Freelance App](https://dribbble.com/shots/27657637-Solo-Freelance-App-UI) | Invoice rows grouped by state ("Pending payment" / "Recently paid"), amount right-aligned with a small status pill under it | Freelance data |
| Quotes / POs | [Northline Agency CRM](https://dribbble.com/shots/27874910-Northline-Agency-CRM-and-Operations-App) | Compact business list and detail rhythm | — |

---

## Prompt 0: Design system and visual direction (paste first)

```
I'm designing a mobile app called "Modusys" for The Furn Enterprise, a modular kitchen and furniture business in Surat, India. It's the phone companion to our web app (modusys.co.in). Users are our own staff: field sales and site staff, plus admins and the owner. It will be built in React Native for iPhone and Android, so design native-feeling phone screens (iPhone 16 frame, 393×852; layouts must also work at 360 wide for Android), not a shrunk website.

BRAND (use exactly these, they match the live web app):
- Primary: #288AB8 (buttons, active tab, links, highlighted chart bar); pressed #2D9CCF
- Brand tints: #EAF7FC (field backgrounds, info strips), #D6EFFA (soft highlighted cards), #ADDEF5 (selected chips, section headers)
- Text: #262626 main, #5D6772 secondary, #AAB0B6 placeholder; borders/dividers #E2E4E8
- Dark surface (floating tab bar, dark buttons): #182634
- Screen background #F7F8F9; cards white
- Fonts: Raleway for headings and text; Manrope for every number (amounts, counts, dates, times, percentages)
- Icons: Lucide line icons, 1.5px stroke

VISUAL STYLE (modern B2B SaaS mobile, calm and airy):
- Soft grey canvas with white cards, 20px corner radius on cards, 12px on inputs and small tiles, very soft shadow (y 2, blur 12, 6% black). Generous padding: 20px screen sides, 16px inside cards, 24px between sections.
- Big, confident numbers: KPI values 28–32px Manrope semibold, with a small trend chip (↗ +12% green / ↘ -10% red) next to them.
- KPI tiles in a 2×2 grid; one tile may be highlighted with the #D6EFFA tint. A small circular progress ring (% inside) can sit in a tile's top-right corner.
- Period filters as pill segmented chips (Today · Week · Month · Year): selected = filled primary with white text, others = white with a thin border.
- Section headers: title left (17px Raleway semibold), "View all" link right in primary.
- List rows inside white cards: 44px initials avatar (tinted circle), name + one line of secondary text, value or status pill on the right.
- Bottom navigation: a floating pill tab bar in #182634, 16px above the bottom edge, 5 items. The active item is a filled primary circle with a white icon; inactive items are light grey icons. Show a small label under each icon so staff always know where they are.
- Headers: large title (28px Raleway bold) that scrolls away, with a round icon button (notifications bell with an unread dot) top-right.
- Bottom sheets for details and quick actions: white, 24px top radius, grab handle.
- Empty states: a simple line-art illustration in primary + grey, one short sentence, one action if useful.
- Loading: skeleton blocks in #E2E4E8, never spinners alone for lists.
- No gradients except the sign-in header (primary to #2D9CCF). No photos of people: initials avatars only.

STATUS BADGES (pill, soft tinted background + solid coloured text), the same everywhere:
Quote status:
- Draft: #45505C on #F4F4F4
- Confirmed: #27AE60 on #F4F8F7
- Requirement Order: #3538C0 on #EDEDF8
- In Purchase: #B8901F on #FEF3F5
- In Production: #E04F16 on #FDF8F3
- Dispatched: #06AED4 on #E9F8FB
- Completed: #0E9384 on #E9F5F4
- Cancelled: #EF1E1E on #FEF4F4
Attendance day: Full Day green #27AE60, Half Day orange #E04F16, In Progress cyan #06AED4, Late / Leave amber #B8901F, Absent / No check-out red #EF1E1E (same soft-tint style).

FORMATS: Indian rupees with Indian grouping (₹2,15,200; large values ₹12.5 L / ₹1.2 Cr), dates DD/MM/YYYY (short form "Fri, 14/11"), times 12-hour (09:42 AM). Sample data: Indian names (Rahul Patel, Priya Shah, Kiran Desai), Surat areas (Adajan, Vesu, Pal, Citylight, Piplod), kitchen and wardrobe projects, quote numbers like Q-2026-0142, PO numbers like PO-0318.

RULES: touch targets at least 44px; one primary button per screen; every list has loading, empty and error states; works with large system text (no text in fixed-height boxes); light mode only for now.

First, show me a one-page style sheet: colour swatches, type scale (Raleway + Manrope), buttons (primary, secondary outline, dark, text), text field (default, focused, error), period chips, status badges, list row, card, KPI tile (plain, highlighted, with ring), section header, bottom sheet, floating tab bar (each tab active once), empty state and skeleton row.
```

---

## Prompt 1: Sign In and Change Password
References: Jobsly Sign in/up.

```
Design the sign-in flow, using the style sheet above.

Screen A, Sign In: the top 35% is a brand header (primary → #2D9CCF gradient) with "Modusys" wordmark and "The Furn Enterprise" under it. A white card with 28px top radius rises over the header holding: title "Welcome back", subtitle "Sign in with your work email", email field and password field (floating labels, password has a show/hide eye), a full-width primary "Sign in" button. No sign-up link and no social logins (accounts are created by the admin); a small line at the bottom: "No account? Ask your admin."

States to show: empty, filled, the button loading, and the error "Incorrect email or password" shown above the button in a red soft-tint strip. Also an offline state: "Can't reach the server. Check your connection and try again."

Screen B, Set a new password (shown when the admin gave a temporary password): same header and card. Title "Set a new password", one-line explanation, current password, new password, confirm password, a live checklist with ticks (8+ characters, a letter, a number, passwords match), and "Save and continue".
```

## Prompt 2: Home (staff and admin versions)
References: B2B SaaS Mobile CRM (cards, KPI tiles, rows), Clocky ("Today's Summary").

```
Design the Home tab in two versions. Floating tab bar visible, Home active. Bell icon top-right with an unread dot.

Version A, staff:
- Greeting "Good morning, Rahul" and the date "Fri, 14/11/2026".
- Today's Summary card: three columns Check in · Check out · Hours (show "--" before check-in). A primary "Check in" button when not checked in; after check-in show "Checked in at 09:42 AM · Adajan, Surat", hours so far, and a dark "Check out" button. After check-out show the day badge (Full Day) and total hours.
- "Today's tasks" section (View all): 3 task rows with a tick circle, title, linked customer and a priority pill.
- "Recent customers" section (View all): 3 rows with initials avatar, name, city and a stage badge.

Version B, admin: the same greeting and Today's Summary card, then a 2×2 grid of KPI tiles: Quotes this month (number, trend), Revenue this month (₹ value), Confirmed (number), Overdue tasks (number, red when above 0). Then "Recent quotes" (3 rows: quote number, customer, amount, status badge).

Also show a loading skeleton of Version A.
```

## Prompt 3: My Attendance
References: Clocky (summary, log table), Cotap (ring button).

```
Design the Attendance tab.

Top: a large round "Check in" button (140px, primary, hand-tap icon) inside two soft concentric rings in the brand tints, with the time under it ("09:42 AM") and a hint "We'll take a selfie and your location". After check-in the button becomes "Check out" in #182634. After check-out the button area becomes a completed card with the day badge.

Below: a white card with four columns Check in · Check out · Hours · Status.

Month summary: four chips with counts, Present 18 · Late 2 · Leave 1 · Absent 0, and a month switcher (‹ November 2026 ›), limited to the last 3 months.

Attendance log: rows per day (Fri 14/11, in 09:42 AM, out 06:30 PM, 8h 48m, a small badge for Late / Half Day / Leave). Leave days show as a row with the Leave badge and the leave type.

Tapping a day opens a bottom sheet: the check-in and check-out selfies side by side, each with its time and place name ("Adajan Hajira Road, Surat"), and any note.

Also show: the empty state for a new month ("No attendance yet this month"), and the state when the login isn't linked to an employee: "Your login isn't linked to an employee record yet. Ask an admin to link it."
```

## Prompt 4: Check-in flow (full screen, 3 steps)
References: Clocky (face camera with corner frame).

```
Design the check-in flow as full-screen steps with a "Step 1 of 3" indicator and a back arrow.

Step 1, Location: "Finding your location…" with a pulsing pin, then the found place ("Adajan Hajira Road, Surat") in a card with a "Continue" button. Permission denied state: short explanation, "Open Settings" and a text button "Continue without location" (the server accepts a check-in without GPS).

Step 2, Selfie: full-screen front camera, a white corner-bracket frame around the face area, hint "Keep your face inside the frame", a round capture button, flip-camera icon. After capture: the photo with "Retake" (text) and "Use photo" (primary).

Step 3, Confirm: selfie thumbnail, time (09:42 AM), place, an optional note field ("Working at site, Vesu"), and the primary "Check in" button with a sending state.

Success: a big tick in a soft green circle, "Checked in at 09:42 AM", the place, and "Done". Also show the same flow worded for Check out.
```

## Prompt 5: Customers list
References: B2B SaaS Mobile CRM (rows), Solo (grouped list rhythm).

```
Design the Customers tab (our CRM).

Large title "Customers", a search field ("Search name, mobile, code"), then a horizontally scrolling row of stage chips with counts, using our real CRM stages in this order: All, Upcoming Inquiry, Inquiry In Process, Design, Quotation, Onsite Measurements, Onsite Marking, Production, Material Requirement Slip, Ready To Dispatch, Installation, Services, Site Completed, Cancel Order.

Stage badge colours (soft tinted background, solid text): Upcoming Inquiry grey #45505C, Inquiry In Process blue #2F80ED, Design purple #800080, Quotation #288AB8, Onsite Measurements cyan #06AED4, Onsite Marking teal #0E9384, Production orange #E04F16, Material Requirement Slip indigo #3538C0, Ready To Dispatch blue #3F88FE, Installation pink #DD2590, Services amber #B8901F, Site Completed green #27AE60, Cancel Order red #EF1E1E.

Each row (inside white cards, 8px apart): initials avatar, customer name, "C-0142 · Adajan" (customer code and city), the stage badge on the right, and under it "3 days in stage" or last activity "2 days ago". If the customer has a final offer, show it right-aligned in Manrope ("₹12.5 L").

No "add customer" button on the phone (customers are added on the web).

Show: the list, a search with no results ("No customers match 'patel'"), and the loading skeleton.
```

## Prompt 6: Customer detail
References: Mortgage CRM Lead Details (header actions, notes), CRM Mobile App Design (profile header).

```
Design the Customer detail screen (pushed from the list, back arrow).

Header card: large initials avatar, name, customer code, stage badge, city. A row of four round icon buttons with labels: Call, WhatsApp, Directions (opens maps from the address), Email.

Then three segmented tabs: Overview · Notes · Photos.

Overview: a card of label/value rows: Mobile, Email, Address (city, state, postcode), Architect, Site manager, Assigned to, Days in stage, Final offer (₹12.5 L), GST. Then "Quotes" with 2 rows (quote number, date, amount, status badge).

Notes: a timeline of notes, newest at the bottom like a chat: author initials, name, DD/MM time, the text. A note with a photo shows a thumbnail. A composer pinned at the bottom: "Add a note…" field, attach-photo icon and a send button.

Photos: a 3-column grid of site photos with the date under each, a first tile "Add photo" (camera or gallery), and a full-screen viewer with the date, who added it, and swipe between photos.

Also show the empty states for Notes ("No notes yet. Add the first one.") and Photos.
```

## Prompt 7: Tasks
References: Task Management App (summary blocks, task cards).

```
Design the Tasks tab.

Top: large title "Tasks" and two soft summary blocks side by side: "To do" (count, tint #EAF7FC) and "Overdue" (count, red soft tint). Under them a segmented control: Today · Upcoming · Done.

Task rows (white cards): a tick circle on the left, title ("Site measurement – Patel residence"), the linked customer name under it, the due date on the right ("Due 14/11"; overdue dates in red with "Overdue"), and a priority pill: Low grey, Normal blue #2F80ED, High amber #B8901F, Urgent red #EF1E1E. Due dates have no time.

Interactions: tapping the tick circle (or swiping right) marks the task done with a short check animation and an "Undo" snackbar. Tapping the row opens a bottom sheet: title, priority, due date, description, the linked customer as a tappable row (opens Customer detail), who created it, and a primary "Mark as done" button (or "Mark as not done" for completed tasks).

Done tab: completed rows greyed with a filled green tick and "Done 13/11".

Empty states: "No tasks for today" and "Nothing upcoming".
```

## Prompt 8: Notifications
References: Notification UI.

```
Design the Notifications screen (pushed from the bell icon, back arrow).

Header: title "Notifications" and a "Mark all as read" text button. Under it two chips with counts: All (24) · Unread (5).

Rows grouped under Today, Yesterday, Earlier: a round soft-tinted icon, a bold title for unread rows, one line of text, the time on the right ("10 min ago", "1 day ago") and a primary unread dot. Read rows use regular weight and secondary text.

Our notifications are about tasks today, so use these two types:
- Task assigned: clipboard icon on #EAF7FC, "New task: Site measurement – Patel residence", "Assigned by Priya Shah".
- Task completed: check icon on #F4F8F7, "Task completed: Send quote to Mehta", "Done by Kiran Desai".
Tapping a row opens that task's bottom sheet.

Empty state: a line-art illustration and "You're all caught up".
```

## Prompt 9: Owner Dashboard (super admin, read-only)
References: CRM Dashboard B2B SaaS (bar chart, team rows), Survey Analytics (KPI tiles with rings).

```
Design the Dashboard (pushed from More, read-only, super admin only).

- Period chips: Today · Week · Month · Year.
- 2×2 KPI tiles: Total quotes, Total revenue (₹1.2 Cr), Conversion rate (with a ring %), Overdue tasks. Highlight the revenue tile with the #D6EFFA tint.
- "Revenue by month" card: big total in Manrope with a trend chip, a bar chart of the last 6 months with the current month bar in primary and the others in #D6EFFA, a small value label above the selected bar.
- "Quote status" card: a horizontal stacked bar or donut using the quote status colours, with a legend (Draft, Confirmed, Requirement Order, In Purchase, In Production, Dispatched, Completed, Cancelled) and counts.
- "Stale quotes" list: 3 rows of quotes with no movement (quote number, customer, days idle in amber).
- "Team performance": rows with initials avatar and name, then two right-aligned figures: Quotes (count) and Revenue (₹), the same columns as the web dashboard.

No buttons that change data. Also show the loading skeleton.
```

## Prompt 10: Quotes list and quote summary (admin, read-only)
References: Solo (grouped invoice rows), Northline.

```
Design Quotes (pushed from More, admin and above, read-only).

List: search ("Quote no. or customer"), status chips with counts (All, Draft, Confirmed, Requirement Order, In Purchase, In Production, Dispatched, Completed, Cancelled). Rows grouped by month ("November 2026"): quote number in Manrope (Q-2026-0142, "Rev 2" small tag when revised), customer name, date, amount right-aligned in Manrope (₹2,15,200) with the status badge under it.

Quote summary (tap a row, bottom sheet or pushed screen): quote number, revision, status badge, date, customer (tappable), architect, sales executive; a card listing the units (e.g. "Kitchen – Base unit 600 mm", qty, amount); then the totals block, in the same order as our quote PDF: Total, Installation & Freight ("Included" or an amount), Discount (8%) and Amount After Discount (only when there is a discount), and Final Offer Price in large Manrope. A secondary button "View PDF" (opens the same PDF the web makes). No edit actions.

Empty and loading states.
```

## Prompt 11: Purchase Orders list and detail (admin, read-only)
References: Solo (grouped rows).

```
Design Purchase Orders (pushed from More, admin and above, read-only).

List: search ("PO no., vendor or customer"), status chips: All, Pending (amber), Confirmed (indigo #3538C0), In Production (amber), Dispatched (teal #0E9384). Our team can add their own status names, so also show one row with a custom status in a grey pill ("Waiting for Vendor").

Rows: PO number in Manrope (PO-0318), vendor name, linked customer or quote, date, total right-aligned (₹84,500) with the status pill under it.

PO detail: header with PO number, status, vendor, date and customer; items grouped under our four groups: A Cabinet Components, B Shutter, C Other Panel, D Hardware (each group collapsible with item count). Item rows: description, qty with unit, rate, amount. Totals block: subtotal, GST (CGST+SGST or IGST), grand total. A secondary "View PDF" button. No edit actions.

Empty and loading states.
```

## Prompt 12: More / Profile

```
Design the More tab.

Top: a profile card with initials avatar, name, email and a role pill (Super Admin / Admin / Staff).

Group "Business" (only for admins; Dashboard only for super admin): Dashboard, Quotes, Purchase Orders, each a row with an icon in a soft primary circle and a chevron.

Group "Account": Notifications (with unread count badge), Change password, Sign out (red, no chevron, with a confirm sheet "Sign out of Modusys?").

Footer: app version "Modusys 1.0 (build 12)".

Show two versions: staff (no Business group) and super admin.
```

## Prompt 13: States and edge cases (one sheet)

```
Make one board of the shared states, in our style, so every screen handles them the same way:
- Offline banner at the top of a screen: "You're offline. Showing what was loaded last." with a retry icon.
- Full-screen error with "Try again".
- "No access" screen (an admin-only screen opened by staff): lock illustration, "You don't have access to this."
- Session ended: the sign-in screen with an info strip "Your session ended. Please sign in again."
- Toast/snackbar: success ("Note added"), error ("Couldn't upload photo. Try again."), with Undo variant.
- Pull-to-refresh on a list.
- Large text: the Customers list row and the Today's Summary card at the largest accessibility text size.
```
