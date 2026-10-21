# ICEM Connect — Implementation Phases

**Version:** 1.1  
**Status:** Execution roadmap / build sequence  
**Project:** ICEM Connect  
**Depends on:** `PRD.md`, `Architecture.md`, `Rules.md`

**Changelog (1.1):** Updated for the Lovable-native stack; reconciled current decisions and document references.

---

# 0. Purpose

`Phases.md` defines **the order in which ICEM Connect should be built**.

This is not another feature list.

It answers:

- What should be built first?
- What depends on what?
- What must be stable before moving forward?
- What should be tested at each stage?
- When is a phase actually finished?
- Which features belong in MVP, V1.5, pilot, or later?
- How should Lovable AI avoid jumping ahead and producing disconnected features?

The core rule is:

> **Do not advance because the UI looks complete. Advance when the underlying behavior, data, security, and tests for that phase are stable.**

---

# 1. Phase Strategy

ICEM Connect should be built as a sequence of increasing complexity:

```text
PHASE 0
Project Foundation
        ↓
PHASE 1
Authentication + Student Identity
        ↓
PHASE 2
Locations + Core Data Model
        ↓
PHASE 3
Ride Creation + Lifecycle
        ↓
PHASE 4
Routes + Waypoints
        ↓
PHASE 5
Find Ride + Deterministic Matching
        ↓
PHASE 6
Join Requests + Capacity + Notifications
        ↓
PHASE 7
Ratings + Reporting + Blocking + Admin
        ↓
PHASE 8
Realtime + Active Ride Sessions
        ↓
PHASE 9
Live Location
        ↓
PHASE 10
MVP Integration + Hardening
        ↓
PHASE 11
Deployment + Pilot
        ↓
PHASE 12
V1.5 Assistance / Bring-Something
        ↓
PHASE 13
Future AI + Optimization
```

The sequence deliberately delays realtime and AI until the core domain is stable.

---

# 2. Global Progression Rules

## 2.1 Never skip foundational dependencies

Do not implement:

```text
live location
```

before:

```text
authentication
+
ride membership
+
ride lifecycle
+
active session
```

Do not implement:

```text
AI route recommendations
```

before:

```text
deterministic route matching
```

Do not implement:

```text
complex analytics
```

before:

```text
correct underlying event/state data
```

---

## 2.2 A phase can overlap technically, but not conceptually

Development may happen in parallel for small tasks, but the conceptual dependency order remains mandatory.

For example:

```text
UI polish for ride cards
```

can happen while backend work continues.

But:

```text
live location
```

should not be considered the next product milestone simply because its map UI is visually complete.

---

# 3. Phase Status Model

Each phase should have one of these statuses:

```text
NOT STARTED
IN PROGRESS
BLOCKED
READY FOR REVIEW
COMPLETED
DEFERRED
```

`Memory.md` should track the current phase.

---

# 4. Phase 0 — Project Foundation

## Objective

Connect and validate the Lovable Cloud/Supabase backend, establish frontend tokens and the authentication shell, and verify a health check without implementing substantial ride behavior.

## Deliverables

- Lovable React + Vite + TypeScript + Tailwind frontend with the established design tokens.
- Connected Lovable Cloud/Supabase backend.
- `supabase/migrations` baseline and generated/typed client integration as appropriate.
- Supabase Auth email/password verification shell with server-side configured institutional-domain validation.
- A minimal health/status check for the connected backend.
- RLS baseline for every created application table; separate `user_roles`; no public PRN/phone access.

## Phase 0 Testing and checkpoint

Verify the Lovable app runs, backend connection succeeds, configured auth shell renders, health/status check responds, migrations apply in the configured environment, and no secrets are exposed.

## Definition of Done

The frontend, backend connection, auth shell, and health check are evidenced in the Lovable environment. This phase does not claim ride features are implemented.

# 5. Phase 1 — Authentication + Student Identity

## Objective

Establish the verified identity layer before creating rides or private data.

## Deliverables

### Authentication

Implement the chosen student verification/authentication flow.

Possible MVP flow:

```text
Register
→ verify
→ authenticate
→ session
→ authenticated application
```

### Student profile

Implement:

- name
- email
- PRN/internal verification identifier
- department where applicable
- year where applicable
- profile image where appropriate

### Roles

At minimum:

```text
STUDENT
ADMIN
```

### Protected routes

Implement:

- authenticated API middleware
- frontend protected-route behavior
- admin authorization middleware

---

## Phase 1 Security Requirements

Verify:

- password/session secrets are protected
- authentication state cannot be forged from the browser
- PRN is not publicly exposed
- a student cannot access another student's private data
- admin endpoints reject ordinary students

---

## Phase 1 Testing

### Unit

- validation schemas
- auth helpers
- authorization policies

### Integration

- registration
- verification
- login
- logout
- protected endpoint
- unauthorized access
- admin rejection

---

## Phase 1 Checkpoint

Do not build ride functionality until:

- [ ] verified user identity exists
- [ ] protected API works
- [ ] student role works
- [ ] admin role works
- [ ] session/authentication behavior is understood
- [ ] unauthorized access is rejected
- [ ] privacy boundaries are enforced

---

## Definition of Done

A verified student can securely enter the application and the server can reliably determine who they are and what role they have.

---

# 6. Phase 2 — Locations + Core Data Model

## Objective

Establish the reusable location and relational database foundation.

## Deliverables

Implement baseline models for:

```text
students
locations
rides
ride_routes
ride_waypoints
ride_join_requests
ride_participants
ride_sessions
ratings
notifications
reports
```

Some modules may initially contain only schema/service foundations.

---

## Locations

Create:

- configured ICEM location
- main road/common access point
- useful nearby landmarks/stops
- location search endpoint

The exact seed dataset should be documented separately from code.

---

## Database Requirements

Add:

- foreign keys
- unique constraints
- indexes
- enum/status definitions
- timestamps
- ownership relationships

---

## Phase 2 Testing

Verify:

- migrations
- seed data
- foreign-key behavior
- uniqueness
- expected relation loading
- basic CRUD service tests

---

## Phase 2 Checkpoint

- [ ] SQL migrations / Postgres RPC schema reflects Architecture.md
- [ ] migration is reproducible
- [ ] seed works
- [ ] locations can be searched
- [ ] student/ride ownership relations exist
- [ ] no model duplicates the same concept

---

## Definition of Done

The database can represent the core ICEM Connect domain without relying on frontend-only state.

---

# 7. Phase 3 — Ride Creation + Ride Lifecycle

## Objective

Allow a verified student to create and manage a real ride record.

## Deliverables

### Offer Ride flow

Host enters:

- origin
- destination
- date
- departure time
- seats
- vehicle type
- optional note

### Ride statuses

Implement:

```text
DRAFT
→ PUBLISHED
→ CONFIRMED
→ ACTIVE
→ COMPLETED
```

and:

```text
CANCELLED
EXPIRED
```

as applicable.

---

## Backend Requirements

Create:

- ride service
- ride repository/data access
- validation schemas
- state-transition rules
- ownership checks

---

## Frontend Requirements

Create:

- Offer Ride page
- ride form
- ride detail
- "My Rides"
- publish action
- edit action where allowed
- cancel action

---

## Phase 3 Testing

Test:

### Valid creation

Student creates a valid ride.

### Invalid creation

Reject:

- missing destination
- invalid date
- zero/invalid seats
- unauthorized host

### Lifecycle

Verify valid and invalid transitions.

---

## Phase 3 Checkpoint

A host should be able to:

```text
log in
→ create ride
→ save draft
→ publish
→ view ride
→ cancel
```

without maps, matching, or realtime.

---

## Definition of Done

The application has a trustworthy ride entity and lifecycle before passenger matching is introduced.

---

# 8. Phase 4 — Routes + Waypoints

## Objective

Connect a ride to a real route without forcing the host to manually construct road geometry.

## Deliverables

### Route provider integration

Implement:

```text
origin
+
destination
→ routing provider
→ normalized route
```

### Route storage

Store:

- route provider metadata
- route geometry/polyline
- distance
- duration

### Waypoint system

Allow meaningful ordered waypoints.

Example:

```text
ICEM
→ Main Road
→ Market
→ Pimpri
→ Bhosari
```

---

## Important Phase Rule

Do not confuse:

```text
route geometry
```

with:

```text
passenger stops
```

The geometry is the physical path.

Waypoints are semantic locations.

---

## UX

Host should:

1. choose origin,
2. choose destination,
3. see generated route,
4. review useful waypoints,
5. confirm route.

Do not ask the host to click hundreds of coordinates.

---

## Phase 4 Testing

Test:

- route calculation success,
- provider failure,
- invalid origin/destination,
- waypoint order,
- destination remains final point,
- route persistence.

---

## Phase 4 Checkpoint

At this stage, a published ride can display:

```text
route on map
+
ordered meaningful waypoints
```

without passenger matching yet.

---

## Definition of Done

The product can represent and render a directed route that later matching logic can reason about.

---

# 9. Phase 5 — Find Ride + Deterministic Matching

## Objective

Implement the central value proposition:

> Find an existing student ride that contains the passenger's requested journey segment.

---

## Search Inputs

Passenger enters:

- pickup
- drop
- date
- approximate departure time
- time flexibility
- requested seats

---

## Matching Pipeline

```text
search input
↓
candidate rides
↓
date filter
↓
status filter
↓
capacity filter
↓
pickup proximity
↓
drop proximity
↓
pickup-before-drop
↓
time compatibility
↓
deterministic ranking
↓
results
```

---

## Core Route Rule

For host route:

```text
ICEM → Main Road → Market → Pimpri → Bhosari
```

Passenger:

```text
ICEM → Main Road
```

must match.

Passenger:

```text
Market → Bhosari
```

must match.

Passenger:

```text
Bhosari → Market
```

must not match.

---

## Matching Tolerance

Use configurable route proximity:

```text
ROUTE_MATCH_TOLERANCE_METERS
```

Do not hard-code random values into the frontend.

Initial values must be tuned using actual ICEM route scenarios.

---

## Ranking

Use deterministic ranking based on documented factors such as:

```text
route compatibility
pickup/drop proximity
departure time difference
available capacity
host reputation
```

Do not introduce AI ranking.

---

## Phase 5 Tests

This phase requires extensive algorithm testing.

Examples:

```text
same origin / same destination
partial route
middle segment
reverse route
nearby pickup
nearby drop
too far from route
wrong date
wrong time
full ride
cancelled ride
active ride
```

---

## Phase 5 Checkpoint

At least these scenarios must work:

```text
ICEM → Main Road
Main Road → Bhosari
Market → Bhosari
```

for a suitable host route.

And these must be rejected:

```text
Bhosari → Market
far-away pickup
far-away drop
full ride
wrong date
```

---

## Definition of Done

A passenger can search for a route segment and receive valid existing rides without exact origin/destination matching.

This is one of the most important technical milestones of ICEM Connect.

---

# 10. Phase 6 — Join Requests + Capacity + Notifications

## Objective

Turn search results into actual ride participation.

---

## Deliverables

### Join request

Passenger selects:

```text
pickup
drop
seat count
```

and submits request.

### Host request management

Host can:

```text
view
accept
reject
```

requests.

### Participant creation

Accepted request becomes a confirmed participant.

---

## Capacity Transaction

The acceptance operation must:

```text
validate request
+
verify available seats
+
create participant
+
decrement capacity
+
update request
+
create notification
```

inside a safe transactional flow.

---

## Notifications

Implement:

```text
join request received
request accepted
request rejected
ride cancelled
```

and other essential lifecycle notifications.

---

## Phase 6 Testing

### Core workflow

```text
Passenger searches
→ requests
→ Host sees request
→ Host accepts
→ Passenger becomes participant
```

### Concurrency

Two requests compete for the last seat.

Expected:

```text
no overbooking
```

### Duplicate request

Same student attempts another request.

Expected:

```text
prevent according to defined policy
```

---

## Phase 6 Checkpoint

A real two-user workflow works end to end without live location.

---

## Definition of Done

ICEM Connect can coordinate an actual confirmed passenger-host relationship.

---

# 11. Phase 7 — Ratings + Reporting + Blocking + Admin

## Objective

Add trust, moderation, and basic operational controls.

---

## Deliverables

### Ratings

After completed ride:

```text
rate participant/host
+
optional comment
```

### Reporting

Student can submit a report associated with relevant user/ride.

### Blocking

Student can block another user according to defined interaction rules.

### Admin

Admin can:

- view reports,
- update report status,
- suspend/deactivate users,
- review rides,
- review basic platform metrics.

---

## Security

Admin operations must be server-authorized.

Reports must remain private.

---

## Phase 7 Testing

Test:

- only eligible participants can rate,
- duplicate rating blocked,
- reports are private,
- blocked users cannot perform restricted interactions,
- ordinary students cannot access admin APIs.

---

## Phase 7 Checkpoint

The core non-realtime product has basic trust and moderation mechanisms.

---

## Definition of Done

A completed ride can produce a useful reputation/moderation record and the platform has minimum operational controls.

---

# 12. Phase 8 — Realtime Foundation + Active Ride Sessions

## Objective

Build the realtime infrastructure **before adding GPS**.

This separation is important.

---

## Deliverables

### Ride session

Implement:

```text
ride session created
ride becomes ACTIVE
ride session ended
ride becomes COMPLETED
```

### Supabase Realtime

Implement:

- authenticated private Realtime channel subscription,
- ride rooms,
- authorization,
- reconnect handling,
- session events.

---

## Supabase Realtime channel Room

Use:

```text
ride:{rideId}
```

Only authorized participants may join.

---

## Phase 8 Testing

Test:

```text
host connects
passenger connects
authorized passenger enters room
unrelated user is rejected
session starts
session ends
room access is revoked
reconnect re-authorizes
```

---

## Phase 8 Checkpoint

Realtime infrastructure can safely communicate:

```text
ride started
ride status changed
ride completed
```

without transmitting live GPS yet.

---

## Definition of Done

The application has a tested realtime authorization boundary.

---

# 13. Phase 9 — Live Location

## Objective

Add temporary realtime host location during an active ride.

---

## Deliverables

### Host

- browser location permission,
- Start Ride,
- location watcher,
- location update throttling,
- Stop/Complete Ride.

### Passenger

- active ride map,
- host marker,
- last-update time,
- stale indicator.

### Server

- location authorization,
- throttling,
- active-session validation,
- room broadcasting.

---

## Required Authorization

Only:

```text
host → publish own location
confirmed passengers → receive location
```

during:

```text
ACTIVE
+
location sharing enabled
```

---

## Do Not Implement

At this phase, do not automatically add:

- permanent GPS history,
- user tracking timelines,
- background movement storage,
- complex navigation,
- AI prediction.

---

## Phase 9 Testing

### Permission

Host denies GPS.

Expected:

```text
ride can continue where allowed
live map reports unavailable
```

### Unauthorized subscription

Expected:

```text
denied
```

### Inactive ride

Expected:

```text
no live location
```

### Completed ride

Expected:

```text
stream ends
```

### Stale connection

Expected:

```text
stale indicator
```

### Reconnect

Expected:

```text
Realtime channel reconnect
→ authorization
→ room restored
```

---

## Definition of Done

A confirmed passenger can see the host's temporary location only during an authorized active ride session.

---

# 14. Phase 10 — MVP Integration + Hardening

## Objective

Bring all V1 functionality together and remove prototype weaknesses.

---

## Deliverables

### Core flows

Verify:

```text
Register
→ Verify
→ Login
→ Offer Ride
→ Publish
→ Find Ride
→ Request
→ Accept
→ Start
→ Live Location
→ Complete
→ Rate
```

### Error handling

Audit:

- network failures,
- invalid state,
- duplicate submissions,
- expired rides,
- insufficient capacity,
- missing location,
- map provider failure,
- Realtime channel disconnect.

### Security audit

Check:

- authentication,
- authorization,
- object-level access,
- admin access,
- location privacy,
- secrets,
- rate limiting,
- validation.

### UX audit

Check:

- mobile responsiveness,
- empty states,
- loading states,
- error states,
- accessibility,
- navigation consistency.

---

## Phase 10 Required Tests

At minimum:

```text
full host journey
full passenger journey
capacity race
route matching
live-location permissions
ride cancellation
rating eligibility
admin authorization
```

---

## Phase 10 Checkpoint

No critical MVP workflow should depend on:

```text
mock data
localStorage
manual database editing
frontend-only permissions
```

---

## Definition of Done

The system is internally coherent enough to be considered an MVP candidate.

---

# 15. Phase 11 — Deployment + Pilot Preparation

## Objective

Publish through Lovable and prepare a controlled real-campus pilot, preserving the `TC-DEP-*` release gates, browser/environment checks, and migration recovery evidence.

## Deployment

- Publish the app through Lovable.
- Confirm Lovable Cloud/Supabase configuration, auth email/domain enforcement, RLS, Edge Functions, private Realtime channel authorization, secrets, SQL migrations, scheduled jobs, and health/status checks.
- Keep host/domain values configurable across test and hosting environments.
- Preserve HTTPS, least-privilege map-key handling, backups, and tested recovery/rollback procedures.

## Pilot strategy and measures

Start with a controlled ICEM student group. Measure ride offers, searches, requests, acceptances, completions, cancellations, repeat usage, route concentration, notifications, safety/trust concerns, map behavior, and live-location reliability.

## Phase 11 Definition of Done

Lovable publication and a controlled pilot pass the documented release gates with recorded browser, auth, RLS, migration/recovery, and product-flow evidence. Publishing alone is not production-readiness evidence.

# 16. Phase 12 — V1.5: Bring Something / Assistance

## Objective

Extend the route-sharing concept beyond passengers while reusing existing infrastructure.

---

## Concept

A student can request:

```text
"Please bring this from A to B"
```

Examples:

- tiffin
- stationery
- document
- parcel
- small campus item

---

## Architecture

Do not overload `rides`.

Create a separate assistance/request domain.

Concept:

```text
assistance_requests
├── requester
├── pickup
├── destination
├── requested_time
├── item_description
├── status
└── matched_ride / participant
```

---

## Matching Reuse

Use existing:

```text
route compatibility
+
route direction
+
time compatibility
```

Do not reinvent route matching.

---

## Safety Boundaries

Initially prohibit:

- high-value items,
- prohibited goods,
- dangerous materials,
- unknown commercial shipments.

The exact policy should be explicitly documented before public launch.

---

## Phase 12 Definition of Done

A student can create a legitimate assistance request and the system can match it to a compatible student route without disrupting core ride functionality.

---

# 17. Phase 13 — Future AI + Optimization

## Objective

Add AI only after real usage has established where it provides actual value.

---

## Candidate AI features

### 13.1 Natural-language ride creation

User writes:

> "I'm leaving ICEM around 5 and going toward Bhosari via Main Road."

AI can extract:

```text
origin
destination
approximate time
possible route intent
```

Then the deterministic backend validates the result.

---

## 13.2 Search normalization

Examples:

```text
"bhosri" → Bhosari
"main rd" → Main Road
```

AI can assist with interpretation, but final location resolution remains deterministic.

---

## 13.3 Translation

Potential support for:

```text
English
Marathi
Hinglish
```

especially for descriptions and search.

---

## 13.4 Demand insights

After sufficient real usage:

```text
high-demand routes
peak request times
underserved segments
```

can be analyzed.

This should be analytics-driven, not invented from small sample sizes.

---

## 13.5 Recommendation assistance

AI may suggest:

```text
"These rides appear compatible with your requested route."
```

but deterministic route compatibility remains the authority.

---

## Phase 13 Rule

Do not implement AI merely to claim that the project is "AI-powered."

The feature must solve a demonstrated problem.

---

# 18. Phase Dependencies

The essential dependency graph is:

```text
Foundation
    ↓
Identity
    ↓
Database
    ↓
Ride lifecycle
    ↓
Routes
    ↓
Matching
    ↓
Requests + capacity
    ↓
Trust/moderation
    ↓
Realtime sessions
    ↓
Live location
    ↓
MVP hardening
    ↓
Pilot
```

Separately:

```text
Completed MVP
    ↓
Real usage data
    ↓
V1.5 assistance
    ↓
AI/optimization where justified
```

---

# 19. MVP Boundary

The MVP should contain:

```text
✅ verified student identity
✅ Offer Ride
✅ Find Ride
✅ routes
✅ meaningful waypoints
✅ route-segment matching
✅ join requests
✅ host acceptance
✅ capacity management
✅ notifications
✅ ratings
✅ reports/blocking
✅ admin moderation
✅ active ride sessions
✅ temporary live location
✅ mobile-first UI
```

The MVP should NOT contain:

```text
❌ payment
❌ wallet
❌ commercial driver behavior
❌ public social feed
❌ multi-college marketplace
❌ AI chatbot
❌ AI-controlled matching
❌ full navigation
❌ permanent GPS history
❌ Uber-level tracking
❌ complex recommendation engine
```

---

# 20. Phase Review Protocol

At the end of every phase, review five categories.

## 20.1 Product

Does the feature satisfy the PRD?

## 20.2 Architecture

Does it still follow Architecture.md?

## 20.3 Security

Could an unauthorized user bypass the intended behavior?

## 20.4 Data

Could concurrent or invalid actions corrupt the database?

## 20.5 UX

Can an actual student understand what to do without developer guidance?

If any category fails materially, the phase is not complete.

---

# 21. Phase Exit Checklist

Before marking any phase `COMPLETED`:

- [ ] Deliverables implemented
- [ ] Backend behavior tested
- [ ] Frontend behavior tested
- [ ] Important negative cases tested
- [ ] Authorization checked
- [ ] Mobile layout checked
- [ ] Errors handled
- [ ] Existing workflows still work
- [ ] No unauthorized scope added
- [ ] Documentation updated where necessary
- [ ] Memory.md updated with actual current state

---

# 22. What Lovable AI Must Not Do Between Phases

Lovable must not interpret a phase transition as permission to build future phases automatically.

For example:

### Completing Phase 5 does not authorize:

```text
Supabase Realtime
live tracking
GPS
ratings
AI
```

### Completing Phase 8 does not authorize:

```text
AI recommendations
```

### Completing Phase 11 does not imply:

```text
multi-college expansion
```

Future functionality remains intentionally gated.

---

# 23. Suggested Development Rhythm

For each phase:

```text
1. Read relevant specification
2. Inspect existing implementation
3. Identify exact phase scope
4. Implement backend/domain foundation
5. Implement frontend
6. Add negative/error cases
7. Add tests
8. Perform manual workflow test
9. Review security
10. Update Memory.md
11. Mark phase complete
```

---

# 24. Technical Debt Rule

Do not chase zero technical debt during early development.

However, distinguish:

### Acceptable temporary debt

```text
simple deployment
single backend instance
basic Cloud function/database logs
manual seed data
limited geospatial optimization
```

### Unacceptable debt

```text
frontend-only authorization
fake capacity handling
insecure live location
uncontrolled database schema
duplicated core business rules
hard-coded critical permissions
```

Temporary simplicity is acceptable.

Security and data-integrity shortcuts are not.

---

# 25. Pilot Feedback Loop

After deployment:

```text
observe
↓
collect actual feedback
↓
identify repeated problem
↓
prioritize
↓
change product/architecture if justified
↓
test
↓
release
```

Do not redesign the product based on one isolated request unless it reveals a real structural issue.

---

# 26. Milestone Definitions

## Milestone A — Technical Foundation

Completed when:

```text
Phase 0 + Phase 1 + Phase 2
```

are complete.

## Milestone B — Functional Ride System

Completed when:

```text
Phase 3 + Phase 4 + Phase 5
```

are complete.

At this point, the system can:

```text
create rides
+
represent routes
+
find compatible segments
```

## Milestone C — Functional Coordination System

Completed when:

```text
Phase 6 + Phase 7
```

are complete.

At this point:

```text
students
↔
rides
↔
requests
↔
participants
```

work together.

## Milestone D — Realtime Mobility System

Completed when:

```text
Phase 8 + Phase 9
```

are complete.

## Milestone E — MVP Candidate

Completed when:

```text
Phase 10
```

is complete.

## Milestone F — Real Pilot

Completed when:

```text
Phase 11
```

is complete.

---

# 27. Final Architecture-to-Phase Mapping

```text
Architecture area                 Primary phase
-----------------------------------------------------------
Vite/React foundation             Phase 0
Supabase Edge Functions foundation                Phase 0
Supabase PostgreSQL / SQL migrations / Postgres RPC                 Phase 0–2
Authentication                    Phase 1
Student identity                  Phase 1
Locations                         Phase 2
Ride lifecycle                    Phase 3
Routes                            Phase 4
Waypoints                         Phase 4
Matching                          Phase 5
Capacity transactions             Phase 6
Join requests                     Phase 6
Notifications                     Phase 6
Ratings                           Phase 7
Reports                           Phase 7
Admin                             Phase 7
Supabase Realtime                         Phase 8
Ride sessions                     Phase 8
Live location                     Phase 9
Security hardening                Phase 10
Deployment                        Phase 11
Assistance requests               Phase 12
AI                                Phase 13
```

---

# 28. Phase 6 Additions — Join Request Note + Capacity-Aware Coordination Chat

Phase 6 must now implement the first version of ride coordination messaging together with join-request details.

## Required Join Request Fields

Add:

```text
specific_area_note (optional)
```

The host request-management UI must display this note before accepting/rejecting.

## Required Chat Behavior

Implement:

- ride-scoped chat,
- authenticated access,
- server-side authorization,
- realtime delivery through Supabase Realtime,
- capacity-aware access,
- host/requester coordination,
- message validation,
- rate limiting,
- persisted temporary message history.

## Phase 6 Tests

Verify:

```text
request contains optional note
host sees note
note does not alter route matching
eligible user can access chat
unauthorized user cannot access chat
full ride blocks new requester chat
existing participants retain chat
chat cannot accept a ride
```

---

# 29. Phase 8 Additions — Realtime Chat Integration

Phase 8 already introduces Supabase Realtime for active-ride realtime behavior. Ride chat should reuse the same infrastructure rather than introducing a second realtime stack.

Required:

```text
ride:{rideId}
```

room authorization must be enforced before subscription.

Events should cover message send and message broadcast.

The live-location and chat channels must remain logically separate even if they share the same Supabase Realtime server.

---

# 30. Phase 10 Additions — Retention and Hardening

Before MVP candidate status, verify:

- completed rides reject new messages,
- completed ride chat becomes read-only,
- `expires_at` is calculated correctly,
- messages disappear from normal reads after 3 hours,
- cleanup is server/database controlled,
- expired messages cannot be retrieved by direct API manipulation,
- message bodies are not written to ordinary application logs,
- rate limits work,
- unauthorized Realtime channel subscriptions fail.

The end-to-end test should now include:

```text
Passenger submits join request
→ includes optional pickup note
→ Host sees note
→ Host and authorized requester coordinate via chat
→ Host accepts
→ Ride reaches capacity
→ New requester chat access closes
→ Existing participant chat remains
→ Ride completes
→ Chat becomes read-only
→ 3-hour retention expires
→ messages are removed/inaccessible
```

This feature does not change the MVP boundary into a general messaging platform.

# 31. Final Rule

The project is not successful because all phases were completed.

It is successful when the current phase is **actually stable enough to support the next one**.

Therefore:

> **Build sequentially. Validate aggressively. Keep scope controlled. Do not confuse visual progress with engineering progress.**

The final intended progression is:

```text
FOUNDATION
    ↓
IDENTITY
    ↓
DATA
    ↓
RIDES
    ↓
ROUTES
    ↓
MATCHING
    ↓
REQUESTS
    ↓
TRUST
    ↓
REALTIME
    ↓
LIVE LOCATION
    ↓
HARDENING
    ↓
PILOT
    ↓
V1.5
    ↓
AI / OPTIMIZATION
```

**This document defines the execution order for ICEM Connect and is the primary build roadmap for Lovable AI and future developers.**

