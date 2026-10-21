# ICEM Connect — Development, Product & AI Rules

**Version:** 1.1  
**Status:** Mandatory project rules  
**Applies to:** Lovable AI, developers, contributors, generated code, database changes, UI changes, and future AI agents

**Changelog (1.1):** Updated for the Lovable-native stack; reconciled current decisions and document references.

---

# 0. Purpose

This document defines the **rules for building and modifying ICEM Connect**.

`PRD.md` defines **what the product should do**.  
`Architecture.md` defines **how the product is technically structured**.  
`Rules.md` defines **how changes must be made without damaging the product, architecture, security, UX, data integrity, or scope**.

These rules are intentionally strict.

Lovable AI must not optimize for:

> "make the requested screen work as quickly as possible"

It must optimize for:

> "make the requested feature work correctly while preserving the product, architecture, security, data integrity, UX, and existing functionality."

---

# 1. Source-of-Truth Hierarchy

When documents or implementation details conflict, use this priority order exactly:

1. explicit current user decision
2. PRD.md
3. Architecture.md
4. Rules.md
5. Phases.md
6. Design.md
7. Memory.md
8. existing implementation
9. AI assumptions

`Memory.md` records project state; it does not override intended product or architecture requirements.
---

# 2. Core Product Rules

## 2.1 Product identity

ICEM Connect is:

> A verified student route-sharing and assistance network for ICEM students.

It is not:

- Uber
- Ola
- a commercial taxi platform
- a generic delivery marketplace
- a public social network
- a college management ERP
- a vehicle rental platform

Avoid language and UX that imply professional transportation service.

## 2.2 Core operating principle

The system coordinates trips students are already making.

Conceptually:

```text
existing student journey
+
available passenger capacity
+
compatible passenger segment
```

The product should not encourage unnecessary detours or imply that hosts are commercial drivers.

## 2.3 Student-only identity

The primary V1 user base is verified ICEM students.

Do not design core V1 flows around arbitrary public users.

Future multi-college expansion requires an explicit product decision.

---

# 3. Scope-Control Rules

## Rule 3.1 — No automatic feature expansion

Do not add a feature merely because it sounds useful.

Do not insert these into MVP without explicit approval:

- payment gateway
- wallet
- subscriptions
- public marketplace
- any chat beyond ride-scoped coordination
- AI chatbot
- AI route prediction
- public follower system
- multi-college discovery
- commercial driver profiles
- full navigation
- automatic driver verification

A feature belongs in the product only when it is explicitly approved and assigned to a phase.

## Rule 3.2 — One change should solve one problem

When implementing a request, do not casually refactor unrelated modules.

For example, fixing join-request UI must not become an excuse to rewrite authentication, database structure, navigation, and routing.

## Rule 3.3 — Preserve working functionality

Before modifying an existing component or service:

1. identify its current responsibility,
2. identify its dependents,
3. understand its data contract,
4. change the smallest reasonable surface,
5. verify existing workflows afterward.

Never assume generated code is isolated.

## Rule 3.4 — No silent architectural decisions

Major architectural choices must be documented.

Examples:

- changing authentication strategy,
- replacing database model,
- changing route representation,
- adding unsupported infrastructure,
- introducing PostGIS,
- introducing a queue,
- replacing the maps provider,
- changing realtime transport.

Do not silently introduce infrastructure because a tutorial used it.

---

# 4. Lovable AI Development Rules

## 4.1 Inspect before modifying

For an existing project:

```text
inspect
→ understand
→ identify impacted modules
→ plan change
→ implement
→ test
```

Do not blindly overwrite files.

## 4.2 Respect existing architecture

If the project already contains:

```text
features/rides/
src/features/rides/
```

reuse that structure. Do not create arbitrary parallel systems such as:

```text
rideStuff/
rideLogic2/
newRideSystem/
```

## 4.3 Do not duplicate business logic

A rule should have one authoritative implementation.

Bad:

```text
seat calculation in:
- React component
- Edge Function or Postgres RPC
- notification code
- database trigger
```

Preferred:

```text
domain/service logic
+
database constraints
```

The frontend can display state but cannot become authoritative.

## 4.4 No giant components

Avoid components containing all of:

- API requests
- routing
- database assumptions
- map calculations
- Realtime channel subscriptions
- form validation
- state-machine logic
- UI rendering

Separate responsibilities into components, hooks, services, schemas, and domain services.

## 4.5 No fake backend behavior in production

Do not implement core production behavior using:

```text
setTimeout()
mock arrays
localStorage
sessionStorage
fake Realtime broadcasts
```

Mocks are acceptable only when explicitly marked as mocks/test scaffolding.

---

# 5. Product Domain Rules

## 5.1 Ride is not a route

A ride represents:

```text
a student's planned trip
```

A route represents:

```text
the path taken by that trip
```

Keep them separate.

## 5.2 Route is not every road coordinate

Do not require the host to manually enter hundreds of route points.

The map/routing provider calculates geometry. The application stores meaningful waypoints needed by the product.

## 5.3 Waypoints are ordered

Every meaningful waypoint must have sequence.

Example:

```text
1 ICEM
2 Main Road
3 Market
4 Pimpri
5 Bhosari
```

Route order is essential for determining whether a passenger segment is valid.

## 5.4 Passenger journeys are segments

Example host route:

```text
ICEM → Main Road → Market → Pimpri → Bhosari
```

Valid segments include:

```text
ICEM → Main Road
Market → Bhosari
```

Invalid for this directed route:

```text
Bhosari → Market
```

---

# 6. Ride Creation Rules

A host must specify at least:

- origin
- destination
- departure date
- departure time
- available seats
- vehicle type

The system should calculate or normalize the route.

The client must not be allowed to submit arbitrary route geometry as authoritative without backend validation.

---

# 7. Ride Editing Rules

A ride can only be edited in states that allow editing, normally:

```text
DRAFT
PUBLISHED
```

`ACTIVE` and `COMPLETED` rides are not ordinary editable records.

Once accepted passengers exist, changes to:

- departure time,
- route,
- pickup/drop structure,
- capacity

may affect confirmed passengers and therefore require explicit business handling.

Never silently mutate a passenger's confirmed trip.

---

# 8. Ride Publication Rules

Publishing must validate on the backend:

- host eligibility,
- origin/destination,
- date/time,
- capacity,
- route validity,
- allowed state transition.

Frontend button disabling is only UX, not security.

---

# 9. Ride Cancellation Rules

Cancellation must:

1. verify requester permission,
2. verify ride state,
3. change the ride to a cancelled state,
4. preserve relevant history,
5. notify affected participants,
6. end any active ride session if necessary,
7. revoke live-location access.

Do not delete a cancelled ride merely to hide it.

---

# 10. Join Request Rules

A passenger request contains:

```text
ride
pickup
drop
seat count
```

The backend must verify:

- authentication,
- student eligibility,
- ride existence,
- ride joinability,
- requester is not the host,
- segment compatibility,
- valid seat count,
- duplicate/conflicting request policy.

---

# 11. Join Request State Rules

Valid lifecycle:

```text
PENDING
   ├── ACCEPTED
   ├── REJECTED
   ├── CANCELLED
   └── EXPIRED
```

Do not allow arbitrary state jumps.

For example:

```text
REJECTED → ACCEPTED
```

must not happen through a normal student action.

---

# 12. Capacity Rules

Capacity is a backend concern.

The browser may display:

```text
2 seats available
```

but the backend decides whether acceptance is actually possible.

Mandatory:

- `available_seats` cannot become negative.
- Host cannot exceed declared capacity.
- Acceptance is transactional.
- Concurrent requests cannot overbook a ride.
- Seat restoration follows one consistent cancellation policy.
- Frontend seat values are never trusted.

---

# 13. Conflicting Passenger Trips

The system should detect obvious schedule conflicts when a student attempts to confirm overlapping rides that cannot coexist.

This is a deterministic rule.

Do not use AI to decide schedule conflicts.

---

# 14. Live Location Rules

Live location is a sensitive feature.

## 14.1 Before acceptance

Passengers must not receive the host's live location.

Allowed:

```text
route
pickup
drop
departure information
```

Not allowed:

```text
live GPS marker
```

## 14.2 Before ride start

Even after acceptance, continuously updating host location should not be exposed until the active ride session begins.

## 14.3 During active ride

Live location is permitted only when:

```text
authenticated
+
confirmed participant
+
correct ride
+
active ride session
+
location sharing enabled
```

## 14.4 After completion

Live location access must end.

## 14.5 Server authorization

Never rely only on frontend logic such as:

```ts
if (isPassenger) showLocation();
```

The server controls whether the location data can be delivered.

## 14.6 Location history

Do not persist every GPS update by default.

Prefer transient realtime state.

---

# 15. GPS Update Rules

Initial target:

```text
5–10 seconds
```

or movement-aware throttling.

Do not intentionally stream GPS every few hundred milliseconds without an explicit future engineering decision.

---

# 16. Location Accuracy Rules

Location is approximate.

Payloads may include:

```text
latitude
longitude
accuracy
timestamp
heading
speed
```

Never present GPS as exact.

---

# 17. Stale Location Rules

The client should distinguish:

```text
live
delayed
stale
```

using update age.

Do not show an old marker as though it were current.

---

# 18. Maps Rules

## 18.1 Provider abstraction

The domain should work with normalized concepts:

```text
Route
Waypoint
Coordinate
Distance
Duration
```

not provider-specific response objects.

## 18.2 API key security

Never expose a server-only map credential. Browser keys must be restricted to approved origins and minimum required APIs.

## 18.3 Route calculation

Do not recalculate a route on every React render.

Calculate only after meaningful origin/destination/waypoint changes.

---

# 19. Search and Matching Rules

Matching is deterministic and explainable.

Hard filters:

```text
date
ride status
seat capacity
route proximity
pickup before drop
time compatibility
```

Soft ranking may consider:

```text
pickup/drop proximity
time difference
available capacity
host reputation
```

Do not make a core match decision dependent on an LLM.

---

# 20. Time Rules

Use real date/time values in business logic.

Recommended:

- timestamps stored consistently in UTC,
- date/time displayed in the user's relevant timezone,
- explicit date/time handling in the domain.

Do not compare strings such as:

```text
"5:30 PM"
```

inside business logic.

---

# 21. Notification Rules

Important state transitions should create notifications.

Examples:

```text
new join request
request accepted
request rejected
ride cancelled
ride started
ride completed
report status changed
```

Notifications must be:

- recipient-scoped,
- persisted when appropriate,
- read/unread tracked,
- generated through a central notification service.

Do not scatter notification logic randomly across UI components.

---

# 22. Ratings Rules

Ratings are tied to legitimate ride participation.

A user may rate another participant only when the relationship is eligible under product rules.

Prevent duplicate ratings.

Ratings must not control safety-critical permissions.

---

# 23. Reporting and Blocking Rules

Students must have a way to report inappropriate behavior.

Reports are private moderation records.

Do not expose report details to unrelated students.

Blocking may prevent future interactions according to product rules, but should not silently erase historical ride records.

---

# 24. Admin Rules

Admin endpoints require server-side admin authorization.

Never treat:

```text
/admin
```

as secure merely because a frontend route is hidden.

An API caller without admin privileges must still be denied.

Material administrative actions should be auditable.

---

# 25. Privacy Rules

Collect only information required for the product.

Do not unnecessarily collect:

- contacts,
- unrelated device information,
- permanent GPS history,
- unrelated personal data.

Never expose:

- PRN publicly,
- private email unnecessarily,
- report details publicly,
- authentication secrets,
- internal moderation notes,
- raw session credentials.

---

# 26. API Rules

## 26.1 Validate every input

Validate applicable:

```text
body
path parameters
query parameters
```

for mutating and sensitive endpoints.

## 26.2 Never trust client identity

Do not use a submitted `userId` as proof of identity.

Derive identity from authenticated server-side context.

## 26.3 Never trust client permissions

Never accept:

```json
{ "role": "ADMIN" }
```

as authoritative.

## 26.4 Never trust client state for business rules

Examples:

```text
availableSeats
rideStatus
isHost
isConfirmed
locationEnabled
```

must be derived or validated server-side.

---

# 27. Database Rules

## 27.1 Use migrations

Schema changes use versioned SQL migrations under `supabase/migrations`.

Do not manually delete tables/columns in production to solve a migration problem.

## 27.2 Preserve data

Before destructive changes:

```text
understand dependencies
→ plan migration
→ migrate data
→ verify
→ remove obsolete structure
```

## 27.3 Use database constraints

Examples:

```text
unique email
unique PRN
foreign keys
unique route per ride
unique waypoint sequence
```

where appropriate.

---

# 28. Database Naming Rules

Recommended database naming:

```text
snake_case
```

Examples:

```text
created_at
updated_at
host_id
available_seats
```

Use consistent SQL naming and typed application boundaries; no ORM mapping layer is assumed.

Avoid inconsistent naming inside the same layer.

---

# 29. Frontend UX Rules

## 29.1 Async states

Important async operations need appropriate:

```text
loading
success
error
empty
```

states.

## 29.2 Prevent duplicate actions

Mutation buttons must prevent accidental repeated submission.

## 29.3 Show meaningful failures

Prefer:

```text
This ride no longer has enough available seats.
```

over:

```text
Something went wrong.
```

Do not leak technical details.

---

# 30. Mobile-First Rules

The primary usage environment is a phone.

Therefore:

- primary actions must be thumb-accessible,
- maps must remain usable on small screens,
- forms should minimize typing,
- touch targets should be appropriate,
- live ride UI must prioritize essential information,
- navigation must remain simple.

Do not simply shrink a desktop layout.

---

# 31. Accessibility Rules

Minimum expectations:

- semantic HTML,
- keyboard accessibility,
- visible focus states,
- meaningful labels,
- accessible errors,
- adequate contrast,
- icons are not the only source of meaning,
- reasonable non-map alternatives for important information.

Do not make critical actions hover-only.

---

# 32. Form Rules

Forms should:

- validate clearly,
- show field-level errors,
- preserve input when safe,
- minimize unnecessary questions,
- identify optional fields,
- disable submit only for understandable reasons,
- derive information instead of asking users to retype it when safe.

---

# 33. Error Message Rules

Errors should be:

- understandable,
- actionable,
- non-sensitive.

Never show raw database/function/stack-trace errors to users.

---

# 34. Code Quality Rules

## 34.1 TypeScript

Prefer strong types.

Avoid unnecessary:

```ts
any
as any
```

Do not silence type errors just to make the build pass.

## 34.2 Naming

Prefer purpose-driven names:

```text
acceptJoinRequest
calculateRouteCompatibility
startRideSession
```

Avoid ambiguous names such as:

```text
doThing
handleData
processStuff
```

## 34.3 Comments

Document **why**, not obvious **what**.

Good:

```ts
// Use a transaction because multiple passengers can be accepted concurrently.
```

Bad:

```ts
// Decrease seats by one.
```

## 34.4 Dead code

Remove obsolete code deliberately after checking dependencies.

Do not accumulate duplicate services, components, routes, schemas, or old feature flags.

---

# 35. Component Rules

UI components should primarily handle:

```text
presentation
+
small local interaction
```

Complex workflows belong in hooks/services/domain logic.

Avoid huge components unless the complexity is genuinely localized and justified.

---

# 36. API Client Rules

Do not scatter raw `fetch()` calls across components.

Prefer:

```text
feature data access
→ shared typed Supabase client / Edge Function boundary
```

Examples:

```text
ridesApi.search()
ridesApi.create()
ridesApi.acceptRequest()
```

Centralize Supabase Auth session handling and database/Edge Function error handling.

---

# 37. State Management Rules

Separate:

```text
server state
local UI state
form state
realtime state
```

Do not place everything into one global store.

Recommended:

```text
TanStack Query → server state
React Hook Form → form state
React state → local UI state
Supabase Realtime subscriptions → realtime state
```

---

# 38. Realtime Rules

Every ride-scoped realtime event must verify:

```text
authenticated user
+
ride
+
relationship to ride
+
current ride/session state
```

before sensitive data is delivered.

---

# 39. Realtime rate Rules

The server must protect against a client flooding:

```text
location:update
```

with excessive traffic.

Use:

- throttling,
- payload size limits,
- session validation,
- stale-session rejection.

---

# 40. Common Web-Security Rules

Account for:

- XSS,
- Supabase Auth session protections and server-side authorization,
- SQL injection,
- broken access control,
- brute-force auth attempts,
- rate abuse,
- insecure direct object references,
- secret leakage.

Important:

> Authentication proves who a user is. It does not prove they are authorized to access every resource.

---

# 41. Environment and Secret Rules

Never commit:

```text
.env
production secrets
API secrets
Supabase service-role and third-party provider secrets
database credentials
```

Maintain:

```text
.env.example
```

with placeholders.

---

# 42. Git Rules

Keep `main` deployable.

Suggested feature branches:

```text
feature/ride-matching
feature/live-location
fix/request-capacity
```

Use focused commits such as:

```text
feat: add transactional ride request acceptance
```

Avoid meaningless commits like:

```text
update stuff
```

Do not commit build artifacts, secrets, caches, or temporary local files.

---

# 43. Testing Rules

A feature is not complete simply because its screen renders.

Test behavior.

## Unit tests

Use for:

- matching,
- validation,
- state transitions,
- route calculations,
- capacity rules.

## Integration tests

Use for:

- Edge Function/RPC + database,
- authorization,
- transactional workflows,
- notifications.

## End-to-end tests

Use for:

- critical student journeys.

---

# 44. Mandatory High-Risk Tests

## Capacity race

Two passengers request the final available seat simultaneously.

Expected:

```text
no overbooking
```

## Route direction

Host:

```text
ICEM → Market → Bhosari
```

Passenger:

```text
Bhosari → Market
```

Expected:

```text
reject as incompatible
```

## Unauthorized live location

Unrelated student tries to subscribe.

Expected:

```text
denied
```

## Completed ride location

Passenger tries to receive location after completion.

Expected:

```text
denied / stream ended
```

## Host joins own ride

Expected:

```text
reject
```

## Duplicate request

Same student repeats a join request where policy prohibits duplicates.

Expected:

```text
prevent duplicate
```

---

# 45. AI Usage Rules

AI should improve usability, not replace deterministic system logic.

## Allowed future uses

- natural-language ride creation,
- route/place interpretation,
- search normalization,
- translation,
- typo correction,
- recommendations,
- demand insights,
- user-facing explanations.

## Never authoritative for

- authentication,
- authorization,
- seat capacity,
- ride state,
- live-location access,
- report enforcement,
- account suspension,
- database integrity.

---

# 46. AI Output Validation

Any future AI output must follow:

```text
AI output
   ↓
schema validation
   ↓
business-rule validation
   ↓
safe normalized result
```

Never write raw LLM output directly into sensitive database state.

---

# 47. AI Privacy Rules

Do not send sensitive data to an AI provider unless an explicit product requirement justifies it.

Minimize or exclude:

- PRN,
- authentication data,
- precise live location,
- private reports,
- moderation records.

---

# 48. No "Vibe Coding" Rule for Critical Logic

Generated code may accelerate implementation, but critical logic must be understandable and testable.

Before accepting generated code for:

- authentication,
- authorization,
- transactions,
- route matching,
- realtime permissions,
- database migrations,

the developer should be able to explain:

```text
what it does
why it works
what can fail
how it is tested
```

---

# 49. Data Migration Rules

When changing schema:

```text
inspect current schema
→ identify affected code
→ plan migration
→ migrate
→ update generated Supabase/database types when evidence supports it
→ update services
→ update API contracts
→ update frontend
→ test
```

Do not delete data merely to resolve a schema mismatch.

---

# 50. Backward Compatibility Rules

When possible, evolve APIs without breaking every client.

For major breaking changes:

- document the change,
- update all callers,
- test the workflow,
- update Architecture.md where architecture changed.

Do not leave two competing implementations indefinitely.

---

# 51. No Hidden Magic Numbers

Do not scatter business thresholds like:

```ts
if (distance < 300)
```

Prefer:

```ts
if (distance < ROUTE_MATCH_TOLERANCE_METERS)
```

Centralized configuration makes testing and tuning safer.

---

# 52. Logging Rules

Logs must help diagnose failures without exposing private data.

Do not routinely log:

- passwords,
- tokens,
- PRNs,
- raw GPS payloads,
- private report contents.

Prefer structured events:

```text
ride.created
ride.request.accepted
ride.session.started
ride.session.completed
```

---

# 53. Analytics Rules

Measure real product outcomes, not vanity numbers.

Useful:

```text
ride offers
searches
join requests
accepted requests
completed rides
repeat usage
cancellations
route density
```

Do not define success using registration count alone.

---

# 54. Product Integrity Rules

Never use dark patterns.

Do not:

- hide cancellation,
- create fake urgency,
- manipulate ratings,
- misrepresent availability,
- request unnecessary permissions,
- silently enable location sharing.

Location sharing must be explicit and understandable.

---

# 55. Permission Rules

Request browser location permission only when it is actually needed.

A reasonable flow is:

```text
accepted ride
+
host starts ride
→ request/use location
```

subject to browser permission behavior.

---

# 56. Browser Permission Failure

If location access is denied:

- do not crash the ride,
- clearly explain the limitation,
- continue non-location ride behavior where product rules permit,
- stop promising live tracking.

Do not repeatedly harass users for permission.

---

# 57. Offline / Poor Connectivity Rules

The application must handle:

- slow networks,
- temporary Supabase Realtime channel disconnects,
- API timeouts,
- stale data.

Never silently display stale information as authoritative current state.

Live tracking:

```text
connection lost
→ show stale/offline state
→ reconnect
→ re-authorize
```

---

# 58. UX Consistency Rules

Use shared components for:

- buttons,
- cards,
- forms,
- dialogs,
- alerts,
- badges,
- loaders,
- empty states.

Visual system details belong primarily in `Design.md`.

---

# Lovable-Native Stack Contract

- Frontend: Lovable React + Vite + TypeScript + Tailwind; retain TanStack Query, React Hook Form, Zod, and react-leaflet.
- Backend: Lovable Cloud/Supabase; PostgreSQL SQL migrations in `supabase/migrations`; TypeScript Edge Functions and Postgres RPC.
- Every application table has RLS. Roles live in `user_roles`, never on profiles. PRN/phone are never publicly readable.
- Supabase Auth email/password with verified email; enforce the configured `@indiraicem.ac.in` domain server-side. RLS/functions enforce suspended/deactivated account status.
- Capacity acceptance, cancellation, and conflict resolution are atomic Postgres RPC transactions. Matching uses the two-stage pipeline and V2 100-point formula; Turf.js runs in Edge Functions.
- Supabase Realtime private channels are RLS-authorized for ride rooms, notifications, live location, and ride-scoped chat. GPS is broadcast-only; no GPS history table.
- `pg_cron` handles ride expiration and 3-hour chat deletion; reads also filter by `expires_at`. Maps provider calls run in Edge Functions; keys stay server-side.
- Publish through Lovable; keep domain configuration environment-specific.

# 59. Documentation Update Rules

Update the correct document instead of mixing concerns.

### Update `PRD.md` when:

the intended product behavior changes.

### Update `Architecture.md` when:

the technical architecture changes.

### Update `Rules.md` when:

a new project-wide development/product rule is established.

### Update `Phases.md` when:

implementation order or phase scope changes.

### Update `Design.md` when:

visual system or UX design rules change.

### Update `Memory.md` when:

something has actually been completed, decided, discovered, or is now pending.

Do not use one document as a dumping ground.

---

# 60. Change Classification

Before making a change, classify it:

```text
A — Cosmetic
B — UI behavior
C — Product behavior
D — Domain/data model
E — Security/auth
F — Infrastructure/architecture
```

Examples:

```text
button radius change      → A
join-request behavior     → C
ride schema change        → D
location authorization    → E
add unsupported infrastructure → F
```

The higher the category, the more verification is required.

---

# 61. Definition of Done for a Feature

A feature is complete only after:

```text
requirements understood
↓
correct domain identified
↓
backend rules implemented
↓
frontend implemented
↓
validation added
↓
error/loading/empty states handled
↓
authorization verified
↓
appropriate tests added
↓
existing workflows checked
↓
documentation/state updated
```

---

# 62. Pre-Commit Checklist

For a substantial change:

- [ ] Does this satisfy PRD.md?
- [ ] Does it preserve Architecture.md?
- [ ] Is business logic server-side?
- [ ] Is authorization server-side?
- [ ] Are inputs validated?
- [ ] Could concurrent requests corrupt data?
- [ ] Are loading/error/empty states handled?
- [ ] Is sensitive information protected?
- [ ] Did the change add unnecessary scope?
- [ ] Are tests required and present?
- [ ] Does Memory.md need updating?
- [ ] Does another specification document need updating?

---

# 63. Explicit Do-Not-Do List

Never:

1. overwrite the whole application to implement one feature,
2. replace PostgreSQL with localStorage for production behavior,
3. bypass authentication because it is inconvenient,
4. trust client-supplied permissions,
5. trust client seat counts,
6. expose host live location before authorization,
7. persist every GPS coordinate by default,
8. let AI control security-critical decisions,
9. add payment to MVP,
10. turn the product into a commercial taxi system,
11. create multiple competing ride models,
12. hard-code business rules throughout the frontend,
13. store secrets in source code,
14. use `any` everywhere to bypass TypeScript,
15. hide backend failures behind fake success messages,
16. delete data to "fix" migration problems,
17. introduce infrastructure without a concrete requirement,
18. break existing functionality without checking dependents,
19. rely on UI-only permission controls,
20. silently change product scope.

---

# 64. Join Request Route Note Rules — V1 Addition

A join request may contain an optional specific-area/pickup note.

Example:

```text
Pickup: Main Road
Note: Near the HP petrol pump; I can walk 100 m.
```

Rules:

1. The note is optional.
2. The note is displayed to the host before accept/reject.
3. The note does not override structured pickup/drop values.
4. The note does not alter route geometry.
5. The note does not bypass deterministic route matching.
6. The note must be length-limited and validated server-side.
7. A materially different pickup must be represented by the structured pickup field, not hidden in the note.
8. The host may reject a request when the practical pickup described by the note does not fit the host's route or preferences.

---

# 65. Ride Coordination Message Rules — V1 Addition

ICEM Connect must not become a generic messaging/social platform.

Messages are strictly **ride-scoped coordination messages**.

## 65.1 Authorization

Only users authorized for the specific ride may access its chat.

At minimum, authorization must be checked server-side for:

- host,
- confirmed participant,
- eligible requester while chat access is open.

Knowing a ride ID is never sufficient authorization.

## 65.2 Capacity-full Rule

When the ride reaches capacity:

```text
NEW requester chat access → CLOSED
EXISTING authorized participants → RETAIN ACCESS
```

Never remove existing participant communication merely because the ride became full.

The frontend may hide/disable the Message action, but the backend must enforce the same policy.

## 65.3 Chat Does Not Confirm a Ride

Chat cannot:

- accept a join request,
- reject a join request,
- reserve a seat,
- change capacity,
- change structured pickup/drop,
- grant live-location access.

Those operations require their proper domain APIs and authorization.

## 65.4 Active Ride

Confirmed participants may continue ride chat while the ride is active.

The host may use it for practical coordination such as pickup clarification or ride-status communication.

## 65.5 Terminal Ride

When a ride becomes `COMPLETED` or `CANCELLED`:

- chat becomes read-only,
- no new messages are accepted,
- messages remain temporarily available,
- retention countdown begins from the terminal timestamp.

## 65.6 Three-Hour Retention

Messages must be retained for no longer than 3 hours after ride completion/terminal closure, according to the documented retention implementation.

The server/database must enforce expiry.

Never rely solely on:

```text
setTimeout()
localStorage
frontend cleanup
```

for data retention.

## 65.7 Message Safety

Required controls:

- authentication,
- authorization,
- server-side validation,
- message length limit,
- rate limiting,
- no public/global chat,
- no sensitive message-body logging.

## 65.8 Do Not Add

Do not add:

- direct messages between arbitrary students,
- permanent chat history,
- public group chat,
- follower/friend messaging,
- chat as a replacement for ride requests.

# 66. Final Rule

The most important rule is:

> **Do not optimize for generated code volume. Optimize for correct, understandable, testable product behavior.**

ICEM Connect should remain:

```text
small enough to build
+
real enough to pilot
+
safe enough to trust
+
structured enough to maintain
```

Every future AI agent and developer should preserve that balance.

**This file is the mandatory behavioral and engineering guardrail for ICEM Connect.**

