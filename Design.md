# ICEM Connect — Design System & UX Specification

**Version:** 1.1  
**Status:** UI/UX source of truth  
**Project:** ICEM Connect  
**Audience:** Lovable AI, frontend developers, designers, future AI agents

**Changelog (1.1):** Updated for the Lovable-native stack; reconciled current decisions and document references.

---

# 0. Purpose

`Design.md` defines **how ICEM Connect should look, feel, and behave at the interface level**.

It complements:

- `PRD.md` — what the product does
- `Architecture.md` — how it is built
- `Rules.md` — how it must be built
- `Phases.md` — when features are built
- `Memory.md` — what has actually been completed

This document is implementation-oriented. Lovable AI should use it as the visual and interaction source of truth instead of inventing a new visual language for every screen.

# 1. Product Design Direction

ICEM Connect should feel:

```text
student-focused
+
modern
+
trustworthy
+
fast
+
practical
+
mobile-first
```

It should not feel like:

```text
corporate ERP
taxi booking app
government portal
generic social media
over-designed startup landing page
```

The interface should communicate:

> “This is a simple, trustworthy way for ICEM students to coordinate journeys with each other.”

# 2. Core UX Principles

## 2.1 Route first

Prioritize:

```text
where are you going?
when?
can I join?
where do I get picked up?
```

over secondary profile information.

## 2.2 Minimize typing

Prefer location search, autocomplete, saved places, map selection, chips, segmented controls, and date/time pickers. Avoid long forms.

## 2.3 Progressive disclosure

Do not show every advanced option immediately. Example:

```text
Offer Ride
    ↓
Origin
Destination
Date
Time
Seats
    ↓
Optional
Vehicle details
Note
Waypoints
```

## 2.4 One primary action per screen

Every important screen should have one visually obvious primary action, such as `Search Rides`, `Offer Ride`, `Request to Join`, `Start Ride`, or `Complete Ride`.

# 3. Visual Personality

The visual personality should be:

- Clean
- Friendly
- Trustworthy
- Map-oriented
- Dense where useful

Avoid excessive decoration, corporate ERP styling, taxi-app styling, and generic social-media patterns.

# 4. Color System

Use a restrained semantic color system.

## 4.1 Primary

Use an indigo / blue-violet family for primary buttons, active navigation, links, selected controls, and important interactive elements.

Suggested starting token:

```css
--primary: 239 84% 60%;
```

Use the project's Tailwind/shadcn token system rather than hard-coding shades across components.

## 4.2 Background and surfaces

Use a very light neutral/cool-gray application background and white or near-white surfaces with subtle borders. Avoid excessive shadows.

## 4.3 Semantic colors

```text
Success → green family
Warning → amber family
Error → red family
Info → blue family
Neutral → gray family
```

Never communicate status through color alone; use icon + label + color where appropriate.

# 5. Dark Mode

Dark mode may be supported later. If implemented, preserve semantic color meaning, map readability, contrast, and the existing design language. It is not an MVP blocker unless explicitly required.

# 6. Typography

Use a modern readable sans-serif, preferably **Inter** or an equivalent system sans-serif.

Suggested hierarchy:

```text
Page title       28–32px
Section heading  20–24px
Card title       16–18px
Body             14–16px
Secondary        13–14px
Caption          12px
```

Use a limited number of font sizes.

# 7. Spacing

Use a consistent scale:

```text
4px  8px  12px  16px  20px  24px  32px  40px  48px  64px
```

Most mobile screens should primarily use 16px page padding and 12–24px component spacing.

# 8. Border Radius

Suggested:

```text
Small controls     8px
Cards              12–16px
Large panels       16–20px
Pills              999px
```

Avoid excessive “bubble” styling.

# 9. Shadows and Borders

Prefer subtle borders over large shadows:

```text
1px subtle border
+
very light shadow if necessary
```

Avoid glowing shadows, neon effects, and large gradients.

# 10. Icons

Use one consistent icon library, preferably **Lucide**. Use icons for navigation, location, route, calendar, clock, seats, vehicle, notifications, rating, reports, and live location.

Do not mix icon styles. Icons support text; they should not replace critical labels.

# 11. Application Shell

Desktop:

```text
┌─────────────────────────────────────────┐
│ Logo      Search        Notifications   │
├───────────┬─────────────────────────────┤
│ Home      │                             │
│ Find Ride │       Main Content          │
│ Offer     │                             │
│ My Rides  │                             │
│ Profile   │                             │
└───────────┴─────────────────────────────┘
```

Mobile:

```text
┌─────────────────────┐
│ Header              │
├─────────────────────┤
│                     │
│ Main Content        │
│                     │
├─────────────────────┤
│ Home Find Rides     │
│ Offer My Rides      │
└─────────────────────┘
```

Use the same product capabilities on both layouts.

# 12. Mobile-First

Design mobile first. Minimum target width: **360px**.

Test at:

```text
360px
375px
390px
412px
768px
1024px+
```

No horizontal scrolling.

Interactive controls should generally provide approximately a 44px touch target.

# 13. Mobile Navigation

Suggested bottom navigation:

```text
Home
Find
Offer
Rides
Profile
```

The Offer action may be visually emphasized without obstructing content.

# 14. Desktop Navigation

A sidebar or top navigation may replace mobile bottom navigation at larger widths. Both must route to the same pages and product capabilities.

# 15. Home Dashboard

Recommended structure:

```text
Greeting
↓
Find a Ride
[Pickup] [Drop]
[Date] [Time]
[Search]

Offer a Ride
[Offer Ride]

Upcoming Ride
[Ride Card]

Recent / Suggested
[Ride Cards]
```

For a new student, show:

```text
Welcome to ICEM Connect

Find a ride with another ICEM student,
or offer a seat on a route you're already taking.

[Find a Ride]
[Offer a Ride]
```

Never show fake activity.

# 16. Find Ride Screen

Core form:

```text
Find a Ride

Pickup
[ Search location ]

Drop
[ Search location ]

Date
[ Date ]

Time
[ Time ]

Flexibility
[ ±15 min ]

[ Search Rides ]
```

Results should provide route context and useful ride cards.

# 17. Search Results

Each ride result should communicate:

```text
Host
Departure time
Route
Pickup
Drop
Available seats
Approximate duration/distance
Rating
```

Conceptual card:

```text
┌──────────────────────────────┐
│ 👤 Rahul        ★ 4.8        │
│                              │
│ ICEM → Bhosari               │
│                              │
│ Pickup: Main Road            │
│ Drop: Market                 │
│ 5:30 PM · 2 seats            │
│                              │
│ [View Ride]                  │
└──────────────────────────────┘
```

Do not dump every database field into the card.

# 18. Search Map

Desktop preference:

```text
results | map
```

Mobile can use:

```text
[List] [Map]
```

Do not force a full-screen map when the user is comparing rides.

# 19. Offer Ride

Recommended progression:

```text
Step 1 — Route
Step 2 — Timing
Step 3 — Capacity
Step 4 — Review
```

A single compact form is acceptable for MVP if it remains simple.

# 20. Route Creation UI

User chooses origin and destination. The system generates a route and then shows a map preview and meaningful waypoints.

Do not ask users to manually draw the entire route or enter technical route geometry.

# 21. Waypoint UI

Display meaningful waypoints as an ordered list:

```text
Route

1. ICEM
2. Main Road
3. Market
4. Pimpri
5. Bhosari
```

Do not expose raw latitude/longitude to ordinary users.

# 22. Ride Detail

Show:

```text
Host identity
Rating
Route map
Origin
Destination
Waypoints
Departure date/time
Seats
Vehicle type
Relevant note
Action
```

Passengers see `Request to Join`; hosts see management actions appropriate to the ride state.

# 23. Ride Status

Use readable badges:

```text
Published
Request Pending
Confirmed
Active
Completed
Cancelled
Expired
```

Never display raw enum names.

# 24. Join Request UX

Passenger selects pickup, drop, and seats, then reviews:

```text
Your trip

Pickup: Main Road
Drop: Bhosari
Departure: 5:30 PM
Seats: 1

[Send Request]
```

The request should be explicit before submission.

# 25. Pending Request

After submission:

```text
Request sent

Waiting for the host to accept your request.
```

Provide `Cancel Request` when permitted. Prevent accidental repeated submissions.

# 26. Host Request Management

Host sees:

```text
Passenger
Pickup
Drop
Seats
Requested time
Profile/rating
```

Actions:

```text
[Accept]
[Reject]
```

Acceptance should clearly communicate its effect on available seats.

# 27. Active Ride Screen

Recommended structure:

```text
┌───────────────────────────┐
│ Active Ride               │
│                           │
│        MAP                │
│                           │
│    ● Host                 │
│    ─ Route                │
│                           │
├───────────────────────────┤
│ Pickup: Main Road         │
│ Drop: Bhosari             │
│ ETA: approximate          │
│ Location: Live            │
├───────────────────────────┤
│ [Complete Ride]           │
└───────────────────────────┘
```

Host and passenger controls differ.

# 28. Live Location UX

Show explicit freshness:

```text
● Live
```

or:

```text
Location updated 12 sec ago
```

If stale:

```text
Location may be outdated
```

Never display stale GPS as current.

# 29. Start Ride UX

Before starting:

```text
Start Ride

Starting the ride will allow confirmed passengers
to see your temporary live location.

[Start Ride]
```

The privacy consequence must be understandable.

# 30. Complete Ride UX

Before completion:

```text
Complete this ride?

Live location sharing will stop for all passengers.

[Cancel]
[Complete Ride]
```

# 31. Map Design

Emphasize:

```text
route
pickup
drop
current host position
```

Do not clutter maps with irrelevant pins or decorative labels.

# 32. Map Marker Semantics

```text
Origin        → start marker
Destination   → end marker
Pickup        → passenger pickup marker
Drop          → passenger drop marker
Host          → live user/location marker
Waypoint      → smaller route marker
```

Keep marker semantics consistent.

# 33. Map Interaction

Users should be able to zoom, pan, and recenter where appropriate. Map interaction should not be mandatory for simple searches.

# 34. Profile

Show:

```text
Profile photo
Name
Department/year where appropriate
Rating
Completed rides
Basic trust information
```

Do not expose unnecessary private information.

# 35. Ratings

Use a clear five-star interaction with accessible text and optional written feedback. Prevent duplicate ratings.

# 36. Notifications

Distinguish unread/read notifications. Examples:

```text
Rahul requested to join your ride.
Your ride request was accepted.
Your ride starts soon.
A ride was cancelled.
```

Deep-link to relevant context where possible.

# 37. Toasts vs Persistent Messages

Use toasts for lightweight confirmations such as saved/copied/updated. Use persistent inline messages for validation errors, permission failures, important state, and live-location problems.

# 38. Confirmation Dialogs

Use application dialogs for high-impact actions:

```text
Cancel ride
Reject important request
Complete ride
Block user
```

Do not use browser-native `confirm()`.

# 39. Loading States

Use contextual messages:

```text
Searching rides...
Calculating route...
Sending request...
Starting ride...
```

Use skeletons for content-heavy sections such as ride cards and notifications.

# 40. Empty States

Examples:

```text
No matching rides yet.
Try another time or expand your search.
```

```text
You don't have an upcoming ride.
[Find a Ride]
[Offer a Ride]
```

```text
You're all caught up.
```

Never fabricate activity to avoid an empty state.

# 41. Error States

Errors should explain what happened and what the user can do.

Good:

```text
We couldn't find rides for that route.
Try adjusting your time or pickup point.
```

Do not expose raw `500 Internal Server Error` messages.

# 42. Authentication UX

Keep authentication minimal:

```text
Welcome
Sign In
Register
Verification
Recovery if applicable
```

Do not require unnecessary profile data during initial onboarding.

# 43. Trust Indicators

Allowed trust information:

```text
Verified ICEM Student
Rating
Completed rides
```

Do not invent misleading badges such as `Safe Driver` without explicitly defined criteria.

# 44. Copywriting Style

Use concise, direct labels:

```text
Find a Ride
Offer a Ride
Request to Join
Start Ride
Complete Ride
```

Avoid excessive marketing copy inside functional flows.

# 45. Safety Copy

When location is involved, be explicit:

> “Your live location is shared with confirmed passengers only while this ride is active.”

Avoid vague permission copy such as “Enable tracking.”

# 46. Responsive Layout Rules

## Mobile

Prefer:

```text
single column
full-width primary actions
bottom navigation
map toggle
compact cards
```

## Tablet

Use two-column layouts where useful.

## Desktop

Use content + map or sidebar + content when it improves productivity.

Never stretch narrow mobile cards across the desktop viewport without reason.

# 47. Breakpoints

Use standard Tailwind breakpoints rather than custom per-component breakpoints. Prefer consistent `sm`, `md`, `lg`, and `xl` behavior.

# 48. Component Library

Reusable primitives should include:

```text
Button
Input
Select
Combobox
DatePicker
TimePicker
Dialog
Sheet
Card
Badge
Avatar
Tabs
Toast
Alert
Skeleton
Dropdown
```

Product components should include:

```text
RideCard
RoutePreview
WaypointList
RideStatusBadge
ParticipantCard
LiveLocationMap
JoinRequestCard
```

# 49. Button Hierarchy

### Primary

```text
Search Rides
Offer Ride
Request to Join
Start Ride
```

### Secondary

```text
Edit
View Route
Cancel
```

### Destructive

```text
Cancel Ride
Block User
```

Destructive actions should not look identical to primary actions.

# 50. Cards

Each card should represent one logical object, such as a ride, notification, participant, or request. Avoid unnecessary nested cards.

# 51. Mobile Ride Card

Prioritize:

```text
route
time
pickup/drop
availability
host
primary action
```

Move low-value metadata to the detail page.

# 52. Desktop Ride Card

Desktop may expose:

```text
host
rating
route
time
duration
seats
vehicle
action
```

Still avoid database-field dumps.

# 53. Accessibility

Minimum requirements:

- semantic HTML
- keyboard navigation
- visible focus
- accessible labels
- screen-reader-friendly status
- sufficient contrast
- error association with inputs
- map alternatives where critical
- no color-only status communication

# 54. Reduced Motion

Avoid unnecessary animation and respect reduced-motion preferences. Motion should communicate state change, navigation, loading, or meaningful map movement.

# 55. Animation

Animations should be short, subtle, and functional. Avoid bouncing buttons, animated gradients, distracting map effects, and excessive page transitions.

# 56. Performance

Prefer route-based code splitting, lazy loading where useful, optimized images, and map loading only when needed. Avoid unnecessary API requests.

# 57. Image Rules

Profile images should be compressed, appropriately sized, and use modern formats where supported. Provide fallback avatars. Never upload huge original camera images unnecessarily.

# 58. Map Performance

Avoid initializing multiple map instances unnecessarily, recalculating routes on every keystroke, excessive marker rerenders, or rebuilding the whole map for each GPS update. Update the live marker independently where possible.

# 59. Location Search UX

Autocomplete should debounce input:

```text
typing
→ wait briefly
→ query
→ suggestions
```

Do not call the location API for every keystroke.

# 60. Route Creation UX

Users should think in terms of:

```text
places
routes
stops
```

Never expose technical concepts such as polyline, GeoJSON, or raw coordinates during ordinary route creation.

# 61. Privacy UX

When location permission is requested, explain why:

> “Allow location access so confirmed passengers can see your position during this active ride.”

# 62. Permission Timing

Ask for permissions close to when they are needed. Do not request GPS on initial login if the user has not created or joined an active ride.

# 63. State-Specific UI

UI must reflect actual backend state:

```text
PENDING   → Request Pending
ACCEPTED  → Confirmed
ACTIVE    → Ride Active
COMPLETED → Completed
```

Frontend state must not invent transitions.

# 64. Optimistic Updates

Use optimistic UI only when rollback is safe. Notification read-state is a good candidate; capacity-changing acceptance is not. Capacity-changing actions wait for authoritative server confirmation.

# 65. Search Flexibility

Allow explicit time flexibility such as:

```text
5:30 PM
±15 min
```

Do not silently widen the user's requested window.

# 66. Map + List Synchronization

When a ride is selected:

```text
selected card
↔
highlighted route/marker
```

On mobile, list and map may remain separate modes.

# 67. Active Ride Privacy Visualization

The host must clearly see:

```text
You are currently sharing live location.
```

A host should never be uncertain whether tracking is active.

# 68. Location Sharing Confirmation

At active-ride start:

```text
Live location sharing
Confirmed passengers can see your current location
while this ride is active.

[Start & Share Location]
```

# 69. Failure Recovery

If live location fails:

```text
Location unavailable
```

Show the last known update and retry guidance where possible. Do not block all ride functionality unless required by an explicit safety rule.

# 70. Design Anti-Patterns

Never build:

```text
❌ giant dashboard with dozens of widgets
❌ excessive gradients
❌ glassmorphism everywhere
❌ tiny mobile controls
❌ full-screen map for every action
❌ long registration form
❌ database-field-heavy cards
❌ hidden cancellation
❌ unclear location sharing
❌ fake social-feed behavior
❌ meaningless animations
```

# 71. Lovable AI Implementation Rules

When generating a screen:

1. Reuse existing design tokens.
2. Reuse existing components.
3. Reuse existing navigation.
4. Preserve responsive behavior.
5. Preserve accessibility.
6. Preserve semantic status colors.
7. Do not invent a new button style.
8. Do not introduce a second icon library.
9. Do not introduce arbitrary fonts.
10. Do not introduce arbitrary spacing scales.
11. Do not redesign unrelated screens.
12. Do not create fake data to make the interface appear populated.

# 72. Design Review Checklist

### Visual

- [ ] Correct typography
- [ ] Correct spacing
- [ ] Consistent radius
- [ ] Consistent buttons
- [ ] Consistent iconography
- [ ] Semantic colors

### UX

- [ ] One obvious primary action
- [ ] Clear hierarchy
- [ ] Minimal typing
- [ ] Loading state
- [ ] Empty state
- [ ] Error state
- [ ] Success state where applicable

### Responsive

- [ ] 360px works
- [ ] 390px works
- [ ] Tablet works
- [ ] Desktop works
- [ ] No horizontal overflow

### Accessibility

- [ ] Labels
- [ ] Keyboard access
- [ ] Focus state
- [ ] Contrast
- [ ] Color is not sole status indicator

### Product

- [ ] UI reflects backend state
- [ ] Location privacy is clear
- [ ] No unauthorized functionality exposed
- [ ] No scope creep

# 73. Join Request Route Note UX — V1 Addition

The join-request form should contain a clearly optional field:

**Specific area / pickup note (optional)**

Helper text:

> Add a landmark or small-area detail that helps the host understand your pickup location.

Examples shown in the UI can include:

```text
Near the HP petrol pump
Near the main college gate
I can walk 100 m from Main Road
```

Do not present this field as a replacement for the structured pickup selector.

## Host Request Card

The pending request card should make route context immediately visible:

```text
Rahul Sharma

Pickup       Main Road
Drop         Bhosari
Seats        1
Pickup note  Near the HP petrol pump; I can walk 100 m.

[ Message ]   [ Reject ]   [ Accept ]
```

The host should not need to open a second screen just to understand the request's pickup clarification.

If the note is absent, show a neutral state such as:

```text
Pickup note: None
```

Do not show an empty input-style block.

---

# 74. Ride Coordination Chat UX — V1 Addition

Ride chat is a contextual tool, not a social inbox.

## Entry Points

The Message action may appear on:

- ride detail,
- pending join request card,
- confirmed participant view,
- active ride view.

Do not add a global Messages tab to the primary navigation for V1.

## Chat Header

The header should identify the context:

```text
Ride Coordination
ICEM → Bhosari
Today · 5:30 PM
```

If useful, show the participant context below the header without exposing unnecessary student information.

## Message Composer

Keep it simple:

```text
[ Type a message...                    ] [Send]
```

Use clear disabled states when the user cannot send.

Examples of disabled states:

```text
Ride is full — new chat access is closed.
```

```text
Ride completed — chat is read-only.
```

## Capacity-full Behavior

When capacity becomes full:

- do not abruptly remove the chat from existing participants,
- close chat entry for newly eligible requesters,
- preserve existing authorized participant access,
- show a subtle state indicator where relevant.

## Completed Ride Behavior

Immediately after completion:

```text
Chat is now read-only.
Messages will be retained temporarily and removed after 3 hours.
```

The UI should not imply permanent history.

After expiry, the conversation should no longer be accessible through normal ride history.

## Message States

At minimum support:

- sending,
- sent,
- failed/retry,
- read history,
- expired/removed conversation state where appropriate.

Do not add elaborate social-chat features such as reactions, stickers, typing indicators, voice messages, or read receipts in V1 unless a later requirement justifies them.

## Mobile Behavior

The chat must work comfortably on the 360px minimum viewport.

Requirements:

- composer remains accessible above the mobile keyboard,
- messages are visually separated by sender,
- timestamps are compact,
- long messages wrap safely,
- no horizontal scrolling,
- back navigation returns to the ride context.

## Safety Copy

Use contextual copy such as:

> Use chat to clarify the route or pickup area. Ride acceptance and capacity are controlled separately.

This reinforces that chat does not constitute confirmation.

---

# 75. Design System Additions

Required reusable components:

```text
PickupNoteField
JoinRequestCard
RideChatPanel
RideChatMessage
RideChatComposer
ChatAccessBanner
```

The visual treatment should reuse existing card, button, typography, spacing, and semantic-status tokens from this document.

Avoid introducing a separate visual language for chat.

# 76. Design Definition of Done

The design system is successfully implemented when all major screens, forms, ride cards, maps, status indicators, notifications, and active-ride UI share a consistent visual language across mobile and desktop.

The user should feel that every part of ICEM Connect belongs to the same product.


# 77. Final Design Principle

ICEM Connect should not try to impress users with visual complexity.

It should make the core task extremely clear:

```text
Where are you going?
        ↓
When?
        ↓
Is there a compatible student ride?
        ↓
Can I join?
        ↓
Where do I meet?
        ↓
Is the ride active?
        ↓
Is location sharing active?
        ↓
Did the ride finish?
```

Therefore:

> **Simple enough to understand immediately, detailed enough to trust, and focused enough to make route coordination effortless.**

This document is the visual and UX source of truth for ICEM Connect.

