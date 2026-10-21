# ICEM Connect — Architecture Specification

**Version:** 1.1  
**Status:** Technical source of truth  
**Project:** ICEM Connect  
**Product source:** `PRD.md`  
**Primary platform:** Responsive mobile-first web application  
**Primary users:** Verified ICEM students

**Changelog (1.1):** Updated for the Lovable-native stack; reconciled current decisions and document references.

---

## 0. Purpose of This Document

This document defines **how ICEM Connect should be implemented**.

`PRD.md` defines what the product must do.  
`Architecture.md` defines the technical structure used to implement it.

Lovable AI and future developers must treat this document as the technical implementation baseline.

### Non-negotiable architectural principles

1. The backend is authoritative for authorization, business rules, ride matching, capacity, and live-location access.
2. A ride, route, meaningful waypoint, passenger segment, and active ride session are separate concepts.
3. Do not expose PRNs or sensitive student data publicly.
4. Do not expose live location before all authorization conditions are satisfied.
5. Use PostgreSQL as the system of record.
6. Use PostgreSQL through Lovable Cloud / Supabase SQL migrations and Postgres RPC functions; 
7. Use React + TypeScript + Vite for the frontend.
8. Use Supabase Edge Functions (TypeScript) and Postgres RPC functions for server-side logic.
9. Use Supabase Realtime private channels authorized by RLS for ride events, notifications, live location, and chat.
10. Use a maps/routing provider behind an internal provider abstraction so the application is not tightly coupled to one vendor.
11. Prefer deterministic business logic over opaque AI logic for safety- and state-critical operations.
12. Do not add payment, commercial taxi behavior, public social feeds, or complex AI to the MVP.
13. Keep the application modular. Avoid giant React components and oversized Edge Functions or SQL RPCs.
14. Build mobile-first, but maintain desktop usability.
15. Every security rule must be enforced server-side; frontend visibility rules are only UX.

---

# 1. High-Level System Architecture

```text
Browser / mobile web
  Lovable React + Vite + TypeScript + Tailwind
  TanStack Query + React Hook Form + Zod + react-leaflet
        │ HTTPS / Supabase client             │ Supabase Realtime private channels
        ▼                                     ▼
Lovable Cloud / Supabase
  Supabase Auth | Edge Functions (TypeScript) | Realtime
  PostgreSQL + RLS | SQL migrations | Postgres RPC | pg_cron
        │
        └── Edge Function → maps/routing provider (server-side secret)
```

All application tables use RLS. Roles are stored in a separate `user_roles` table, never on profiles. PRN and phone are never publicly readable.

## 1.1 Architectural layers

### Presentation layer

Responsible for:

- rendering screens,
- collecting user input,
- displaying loading/error/success states,
- map interaction,
- optimistic UX only where safe,
- subscribing to authorized realtime events.

It must not become the source of truth for:

- seat availability,
- permission checks,
- ride state transitions,
- request acceptance,
- live-location authorization.

### Server and data layers

Supabase Auth, Edge Functions, Postgres RPC, constraints, RLS policies, and SQL migrations enforce authorization and domain rules. Capacity acceptance, cancellation, and conflict resolution execute as atomic Postgres transactions through RPC.

### Realtime layer

Supabase Realtime private channels authorized by RLS carry ride events, notifications, live-location broadcasts, and ride-scoped coordination chat. High-frequency GPS is broadcast-only; no GPS history table is permitted.

# 2. Technology Stack

## 2.1 Frontend

- Lovable React + Vite + TypeScript + Tailwind CSS.
- Keep React Router, TanStack Query, React Hook Form, Zod, and react-leaflet as specified.

## 2.2 Backend and database

- Backend: Lovable Cloud, based on Supabase.
- Database: PostgreSQL, with versioned SQL in `supabase/migrations`; 
- Server logic: Supabase Edge Functions (TypeScript) plus Postgres RPC functions.
- Enforce Row Level Security (RLS) on every application table. Keep roles in a separate `user_roles` table, never on the profile. PRN and phone are never publicly readable.
- Capacity acceptance, cancellation, and conflict resolution must execute as single atomic Postgres transactions through RPC.

## 2.3 Authentication and authorization

- Supabase Auth email + password with email verification.
- Enforce the configured `@indiraicem.ac.in` email domain server-side.
- Account suspension/deactivation must be enforced in RLS policies and trusted functions, not only in the UI.

## 2.4 Realtime and scheduled work

- Use Supabase Realtime private channels with RLS authorization for ride rooms, notifications, live-location broadcasts, and ride-scoped chat.
- Do not create a GPS history table. GPS updates are broadcast only.
- Use `pg_cron` for ride expiration and 3-hour chat deletion; retain the read-time `expires_at` filter.

## 2.5 Routing

Keep the existing maps/routing provider abstraction. Call providers from an Edge Function, and keep provider keys server-side. Matching remains a two-stage pipeline; Turf.js runs in the Edge Function and ranking remains the ratified deterministic V2 100-point formula.

## 2.6 Lovable publishing

Publish the application through Lovable. Do not specify external frontend/backend hosting providers as the deployment target. Use configurable environment/domain settings for testing and hosting changes.

# 3. Frontend Architecture

Use feature-oriented modules under `src/`, keeping components, hooks, schemas, data access, and UX state separated by domain. Retain React Router, TanStack Query, React Hook Form, Zod, and react-leaflet. Client-side checks improve UX but are never authoritative for permissions, capacity, or state transitions.

# 4. Server and Data Architecture

Use `supabase/functions/` for TypeScript Edge Functions and `supabase/migrations/` for versioned SQL. Use Postgres RPC for atomic domain transactions and RLS for table-level access. Keep business-critical invariants enforced in trusted server/database paths, not solely in the frontend.


# 5. Authentication and Authorization Architecture

Use Supabase Auth email/password with email verification. Enforce the configured `@indiraicem.ac.in` email domain server-side. Use Supabase Auth sessions, with RLS and trusted Edge Functions checking account status and roles. Store roles in a separate `user_roles` table, never in the profile. RLS and functions must deny access for suspended or deactivated accounts. Use the Supabase Auth session model; do not introduce a parallel custom session architecture.

Authorization remains least-privilege and resource-specific: verify authenticated identity, ownership, participant membership, ride state, and role at the trusted boundary. PRN and phone are never publicly readable.

# 6. Core Database Architecture

The following model is the recommended MVP structure.

## 6.1 `students` / profiles

Stores verified student identity and profile.

Suggested fields:

```text
id                  UUID / primary key
name                string
email               string / unique
prn                 string / unique / private
department          string / nullable
year                integer / nullable
profile_image_url   string / nullable
status              enum(ACTIVE, SUSPENDED, DEACTIVATED)
rating_average      decimal / derived or cached
rating_count        integer
created_at          timestamp
updated_at          timestamp
```

### Rules

- Store authorization roles separately in `user_roles`, never in this profile table.
- PRN is never returned in public profile payloads.
- Email visibility must follow privacy rules.
- Public profile should expose only the minimum required identity.
- Do not allow a normal student to change verification identity arbitrarily.

---

## 6.2 `locations`

Represents reusable named locations/place references.

```text
id              UUID
name            string
type            enum(ICEM, MAIN_ROAD, BUS_STOP, LANDMARK, AREA, CUSTOM)
latitude        decimal
longitude       decimal
address         string / nullable
is_active       boolean
created_at      timestamp
updated_at      timestamp
```

Use this table for configured campus/common locations.

Do not hard-code:

```text
"ICEM"
"Bhosari"
"Main Road"
```

throughout React components.

---

## 6.3 `rides`

Represents the host's planned trip.

```text
id                  UUID
host_id             UUID → students.id
origin_location_id  UUID / nullable
destination_location_id UUID / nullable
departure_date      date
departure_time      time / timestamp strategy must be consistent
total_seats         integer
available_seats     integer
vehicle_type        enum(BIKE, SCOOTER, OTHER)
note                text / nullable
status              enum(
                      DRAFT,
                      PUBLISHED,
                      CONFIRMED,
                      ACTIVE,
                      COMPLETED,
                      CANCELLED,
                      EXPIRED
                    )
created_at          timestamp
updated_at          timestamp
published_at        timestamp / nullable
```

### Important

`available_seats` is application-maintained state and must be updated transactionally.

The backend must never trust a client-supplied remaining-seat number.

---

# 7. Route Architecture

A route has two different forms:

1. **Geometry** — the physical path used for map rendering and geometric matching.
2. **Meaningful waypoints** — ordered places passengers can use as pickup/drop references.

These must not be confused.

## 7.1 `ride_routes`

Recommended one-to-one relation with `rides`.

```text
id                    UUID
ride_id               UUID / unique → rides.id
provider               string
provider_route_id      string / nullable
encoded_polyline       text / nullable
geometry_json          JSONB / nullable
distance_meters        integer / nullable
duration_seconds       integer / nullable
created_at             timestamp
updated_at             timestamp
```

### Provider abstraction

The application should not call a mapping vendor directly from arbitrary React components.

Use:

```text
MapProvider
├── geocode()
├── searchPlaces()
├── calculateRoute()
└── calculateDistance/ETA if supported
```

Then implement the chosen vendor behind the interface.

This allows a future provider change without rewriting the ride domain.

---

## 7.2 `ride_waypoints`

This table stores meaningful ordered points associated with a ride.

```text
id                  UUID
ride_id             UUID
sequence            integer
label               string
type                enum(
                      ORIGIN,
                      WAYPOINT,
                      DESTINATION
                    )
latitude            decimal
longitude           decimal
location_id         UUID / nullable
distance_from_start_meters integer / nullable
created_at          timestamp
```

### Ordering

Example:

```text
sequence 1 = ICEM
sequence 2 = Main Road
sequence 3 = Market
sequence 4 = Pimpri
sequence 5 = Bhosari
```

The sequence is authoritative for passenger segment direction.

### Host UX

The host must **not** manually draw a road route.

Instead:

1. host selects origin,
2. host selects destination,
3. application requests a route,
4. map displays generated route,
5. application presents useful candidate waypoints,
6. host may choose meaningful pickup/drop points,
7. system stores only semantic waypoints needed for the product.

---

# 8. Passenger Segment Architecture

A participant uses only a segment of the ride.

## 8.1 `ride_participants`

Recommended structure:

```text
id                    UUID
ride_id               UUID
student_id            UUID
pickup_waypoint_id    UUID
drop_waypoint_id      UUID
seat_count            integer
status                enum(
                        CONFIRMED,
                        CANCELLED,
                        COMPLETED,
                        NO_SHOW
                      )
joined_at             timestamp
confirmed_at          timestamp / nullable
cancelled_at          timestamp / nullable
```

A separate request table is recommended for lifecycle clarity.

## 8.2 `ride_join_requests`

```text
id                    UUID
ride_id               UUID
student_id            UUID
pickup_waypoint_id    UUID
drop_waypoint_id      UUID
seat_count            integer
status                enum(
                        PENDING,
                        ACCEPTED,
                        REJECTED,
                        CANCELLED,
                        EXPIRED
                      )
created_at             timestamp
updated_at             timestamp
```

### Why separate request and participant?

A request is an attempted action.

A participant is an accepted membership.

This prevents confusing:

```text
"asked to join"
```

with:

```text
"confirmed passenger"
```

---

# 9. Route-Matching Architecture

The matching engine should be deterministic.

## 9.1 Search input

```text
pickup
drop
date
approximate_departure_time
time_flexibility
requested_seats
```

## 9.2 Candidate filtering

First remove impossible rides:

```text
ride.status ∈ {PUBLISHED, CONFIRMED}
AND same date
AND sufficient available seats
AND host is eligible
```

Then validate route compatibility.

## 9.3 Route compatibility

A passenger request is valid when:

```text
pickup is on/near host route
AND
drop is on/near host route
AND
pickup occurs before drop
```

### Route order

If pickup and drop map to:

```text
pickup_route_position = 0.35
drop_route_position   = 0.72
```

the direction is valid.

If:

```text
pickup_route_position = 0.72
drop_route_position   = 0.35
```

the request is invalid for that ride.

---

## 9.4 Geometric matching

For MVP, use a bounded route-proximity calculation.

Conceptually:

```text
candidate pickup
      ↓
nearest point on host route
      ↓
distance <= pickup tolerance

candidate drop
      ↓
nearest point on host route
      ↓
distance <= drop tolerance
```

Store the calculated route positions for the request when useful:

```text
pickup_route_position
drop_route_position
```

These can be represented as normalized progress values from `0.0` to `1.0` or as distance-from-route-start in meters.

### Tolerance

Do not assume an exact coordinate match.

GPS and place search coordinates vary.

Use a configurable matching tolerance rather than hard-coding it into UI logic.

Example configuration:

```text
ROUTE_MATCH_TOLERANCE_METERS=300
```

The initial value should be tested with actual ICEM routes rather than treated as a universal truth.

---

## 9.5 Time matching

Example:

```text
Host departure = 17:30
Passenger requested = 17:40
Flexibility = ±20 min
```

Accept candidate rides whose departure falls inside the agreed search window.

Do not make users enter exact seconds or over-precise schedules.

---

## 9.6 Deterministic ranking

After hard filtering, calculate a transparent internal score.

Suggested ranking priorities:

```text
1. route compatibility
2. pickup/drop proximity
3. departure-time difference
4. available seats
5. host reputation
```

Do not use generative AI to decide whether a ride is safe or valid.

---

## 9.7 Matching service pseudocode

```text
findCompatibleRides(search):
    validate search

    candidates =
        get eligible rides by date/status/capacity

    results = []

    for ride in candidates:
        pickupMatch = mapPointToRoute(search.pickup, ride.route)
        dropMatch   = mapPointToRoute(search.drop, ride.route)

        if pickupMatch.distance > tolerance:
            continue

        if dropMatch.distance > tolerance:
            continue

        if pickupMatch.position >= dropMatch.position:
            continue

        if not departureWithinWindow(ride, search):
            continue

        score = calculateDeterministicScore(
            pickupMatch,
            dropMatch,
            ride.departure,
            ride.availableSeats,
            hostRating
        )

        results.push({ ride, score })

    return sortByScore(results)
```

The exact scoring formula should live in the matching service, not the UI.

---

# 10. Capacity and Concurrency

Capacity changes are a concurrency problem.

Bad approach:

```text
GET availableSeats
if availableSeats > 0
  UPDATE availableSeats = availableSeats - 1
```

Two users can read the same old value and overbook.

## Required approach

Accepting a request must use a transaction with a safe condition.

Conceptually:

```text
BEGIN

lock/validate ride capacity

if available_seats < requested:
    reject

create participant
decrement available_seats

update request status = ACCEPTED

create notification

COMMIT
```

The exact SQL migrations / Postgres RPC implementation may use a transaction plus guarded update / appropriate isolation.

### Additional rules

- Host cannot join own ride as passenger.
- Rejected request must not consume capacity.
- Cancelled pending request must not consume capacity.
- Cancelling an already accepted participant may restore capacity only according to the defined cancellation policy.
- Never trust frontend seat calculations.

---

# 11. Ride State Machine

The ride lifecycle should be implemented as explicit server-side transitions.

## 11.1 Ride

```text
DRAFT
  │
  └── publish ──► PUBLISHED
                       │
                       ├── first confirmed participant ──► CONFIRMED
                       │
                       ├── start ──► ACTIVE
                       │               │
                       │               └── complete ──► COMPLETED
                       │
                       ├── cancel ──► CANCELLED
                       │
                       └── past scheduled time ──► EXPIRED
```

The implementation may simplify `CONFIRMED` if product usage proves it unnecessary, but state meaning must remain explicit.

## 11.2 Join request

```text
PENDING
 ├── ACCEPTED
 ├── REJECTED
 ├── CANCELLED
 └── EXPIRED
```

## 11.3 Participant

```text
CONFIRMED
 ├── COMPLETED
 ├── CANCELLED
 └── NO_SHOW
```

## 11.4 Forbidden transitions

Examples:

```text
COMPLETED → ACTIVE
CANCELLED → PUBLISHED
REJECTED request → ACCEPTED
```

unless an explicit administrator workflow permits it.

The backend should return a structured business error for invalid transitions.

---

# 12. Active Ride Session Architecture

The published ride and actual active journey are separate.

## 12.1 `ride_sessions`

```text
id                UUID
ride_id           UUID / unique
started_at        timestamp
ended_at          timestamp / nullable
status            enum(ACTIVE, ENDED)
location_enabled  boolean
last_location_at  timestamp / nullable
created_at        timestamp
```

A ride should have at most one active session.

## 12.2 Why a session exists

Without a session, it becomes too easy to accidentally expose location simply because a ride exists.

The session is the explicit authorization context for live tracking.

---

# 13. Live Location Architecture

## 13.1 Lifecycle

```text
Host
  ↓
Start Ride
  ↓
Backend creates active ride_session
  ↓
Host client starts GPS watcher
  ↓
Supabase Realtime connection / ride room
  ↓
Host emits location updates
  ↓
Server authenticates + authorizes
  ↓
Server validates ride/session/user
  ↓
Server broadcasts current location
  ↓
Confirmed passengers receive updates
  ↓
Host completes ride
  ↓
Backend ends session
  ↓
Location sharing stops
```

## 13.2 Authorization for subscribing

A user may receive ride location only when:

```text
authenticated
AND
confirmed participant
AND
ride exists
AND
ride session is ACTIVE
AND
location sharing is enabled
```

The host is allowed to publish their own live location when:

```text
authenticated
AND
host of ride
AND
ride session is ACTIVE
AND
location sharing is enabled
```

## 13.3 Supabase Realtime private channels

Use one private, RLS-authorized ride channel per active ride, conceptually named `ride:{rideId}`. Policies and trusted database/function state verify the authenticated user, host/confirmed participant relationship, active session, and location-sharing status. Client-supplied channel names never authorize access.

# 14. Realtime Events

Recommended events:

```text
ride:session_started
ride:session_ended

ride:join_request_created
ride:join_request_accepted
ride:join_request_rejected

ride:participant_joined
ride:participant_left

location:started
location:update
location:stopped

notification:new

ride:status_changed
```

## 14.1 Location update payload

Conceptually:

```json
{
  "rideId": "uuid",
  "latitude": 18.XXXX,
  "longitude": 73.XXXX,
  "accuracyMeters": 12,
  "heading": 180,
  "speed": 8.2,
  "timestamp": "2026-09-27T04:30:00.000Z"
}
```

Do not include unnecessary personal information in every location event.

---

# 15. Live Location Frequency and Storage

## 15.1 Client update frequency

Start with approximately:

```text
5–10 seconds
```

or use movement-aware throttling.

The goal is useful movement visibility, not Uber-scale telemetry.

## 15.2 Do not write every GPS point to PostgreSQL

A high-frequency GPS stream should primarily remain transient.

Recommended:

```text
GPS update
    ↓
Supabase Realtime
    ↓
server validation
    ↓
broadcast
```

Do not persist GPS coordinates or create a GPS history table. **Join hydration uses the ratified Option C: client broadcast push on join.** When an authorized participant joins the active ride channel, the client already publishing the host's current location pushes its current live fix to that newly joined participant. This is a live broadcast, not a database write or history record. It must still obey all authorization, freshness, accuracy, throttling, and privacy rules.

Exact event acknowledgment, timeout/retry, and no-fresh-fix behavior remain pending implementation-level specification; do not introduce a persisted last-known-position row or Realtime Presence fallback without an explicit decision.

## 15.3 Future persistent telemetry

Persistent location history should be a separate future decision because it introduces:

- privacy concerns,
- data retention requirements,
- larger storage cost,
- additional security requirements.

---

# 16. Reconnect, Hydration, and Stale Location Rules

The client distinguishes active/recent, delayed, and stale locations using the ratified freshness thresholds. On reconnect, it re-authenticates through Supabase Auth, re-subscribes to the private ride channel, and rechecks ride/session authorization.

Initial location hydration uses Option C: after an authorized participant joins an active ride channel, the host client broadcasts its current live fix. This is broadcast-only; no REST hydration endpoint, database position row, GPS history, or Realtime Presence fallback is authorized. If no fresh fix exists, show the existing stale/no-fix state and wait for the next valid broadcast.

# 17. Edge Function and Database Operation Contracts

Use Supabase client operations under RLS for ordinary authenticated data access. Use TypeScript Edge Functions for trusted server-side workflows, routing-provider calls, and operations requiring server-held secrets. Use Postgres RPC for capacity acceptance, cancellation, and conflict resolution as single atomic transactions. Preserve the existing logical request/response contracts and authorization semantics when exposing workflows; do not require a custom Supabase Edge Functions/REST server.

The operations in this contract cover authentication/profile, locations, ride creation/search/lifecycle, join requests, participants, ratings, notifications, reports, and admin workflows. Every operation must enforce ownership, participation, state, role, input validation, and privacy at the trusted boundary.

# 18. API Response Contract

Use a consistent response envelope.

## Success

```json
{
  "success": true,
  "data": {}
}
```

## Error

```json
{
  "success": false,
  "error": {
    "code": "RIDE_CAPACITY_FULL",
    "message": "No requested seats are available.",
    "details": null
  }
}
```

### Suggested business error codes

```text
AUTH_REQUIRED
FORBIDDEN
VALIDATION_ERROR
RESOURCE_NOT_FOUND
RIDE_NOT_FOUND
RIDE_NOT_PUBLISHED
RIDE_NOT_ACTIVE
RIDE_INVALID_STATE
RIDE_CAPACITY_FULL
REQUEST_ALREADY_EXISTS
REQUEST_NOT_FOUND
REQUEST_INVALID_STATE
INVALID_ROUTE_SEGMENT
LOCATION_ACCESS_DENIED
LOCATION_SESSION_INACTIVE
RATE_LIMITED
```

Frontend code should branch on stable error codes where behavior differs.

Do not make the frontend parse arbitrary human-readable error strings.

---

# 19. Validation Architecture

Use Zod for request validation.

Example conceptual schema:

```text
CreateRideSchema
├── origin
├── destination
├── date
├── departureTime
├── totalSeats
├── vehicleType
└── note
```

Validate:

1. shape,
2. required fields,
3. numeric ranges,
4. date/time format,
5. domain rules.

Zod validation is not a replacement for service-level authorization.

Example:

```text
Zod says:
totalSeats is an integer.

Domain service additionally checks:
host is eligible,
ride is editable,
capacity is within policy.
```

---

# 20. Transaction Boundaries

Transactions are required when one user action changes multiple related records.

## 20.1 Accept join request

Transaction:

```text
request lookup
→ permission check
→ capacity check
→ create participant
→ decrement available seats
→ mark request accepted
→ create notification
```

## 20.2 Cancel participant

Transaction if cancellation changes:

```text
participant status
+
available seats
+
notifications
```

## 20.3 Start ride

Transaction:

```text
validate host
→ validate ride status
→ create ride session
→ set ride status ACTIVE
```

## 20.4 Complete ride

Transaction:

```text
validate active session
→ close ride session
→ set ride status COMPLETED
→ finalize participants
→ stop location authorization
```

---

# 21. Data Integrity and Constraints

Use database constraints whenever a rule can be expressed at the database level.

Examples:

```text
students.email UNIQUE
students.prn UNIQUE

rides.available_seats >= 0
rides.total_seats > 0

ride_routes.ride_id UNIQUE

ride_waypoints:
    UNIQUE(ride_id, sequence)

ratings:
    UNIQUE(ride_id, from_student_id, to_student_id)
```

Where possible, foreign keys must use explicit relationships.

Do not rely entirely on frontend assumptions such as:

```text
"I know this participant exists."
```

---

# 22. Indexing Strategy

Recommended indexes:

```text
students:
    email
    prn
    status

rides:
    host_id
    departure_date
    status
    departure_date + status

ride_waypoints:
    ride_id + sequence

ride_join_requests:
    ride_id + status
    student_id + status

ride_participants:
    ride_id + status
    student_id

notifications:
    student_id + read + created_at

reports:
    status + created_at
```

Indexes should be added based on actual query patterns and verified with database query plans later.

---

# 23. Notification Architecture

Notifications are persisted records.

Example:

```text
notifications
├── id
├── student_id
├── type
├── title
├── message
├── entity_type
├── entity_id
├── read
└── created_at
```

Examples:

```text
JOIN_REQUEST_RECEIVED
REQUEST_ACCEPTED
REQUEST_REJECTED
RIDE_STARTED
RIDE_CANCELLED
RIDE_COMPLETED
NEW_MESSAGE_OR_SYSTEM_EVENT
REPORT_UPDATE
```

Do not create arbitrary notification strings in random components.

Use a centralized notification service.

---

# 24. Ratings Architecture

Ratings belong to completed ride participation.

Rules:

- only eligible participants can rate,
- ratings are associated with a ride,
- duplicate rating creation is prevented,
- average rating is recalculated or safely updated,
- comments are optional,
- moderation/reporting remains possible.

Do not let users rate strangers with whom they have no relevant ride relationship.

---

# 25. Privacy Architecture

Sensitive data includes:

- PRN,
- email where not needed,
- realtime coordinates,
- verification information,
- reports,
- administrative data.

## 25.1 API privacy

Create separate DTOs/view models for:

```text
self profile
public profile
host view of participant
passenger view of host
admin view
```

Do not return the full `students` database row by default.

## 25.2 Live location

Never return live coordinates from a generic profile endpoint.

Live location is available only through the ride-session/realtime workflow.

## 25.3 PRN

PRN is an internal verification identifier.

It should never appear in:

- public profile,
- ride cards,
- map popups,
- notification text,
- URLs,
- publicly visible search results.

---

# 26. Security Architecture

Required baseline protections:

- HTTPS in production,
- Supabase Auth session handling and RLS/function authorization,
- password hashing when passwords are used,
- RLS and Edge Function access controls restricted to required callers,
- Zod validation,
- rate limiting on sensitive endpoints,
- authorization middleware,
- ownership checks,
- admin RBAC,
- SQL migrations / Postgres RPC parameterized queries,
- environment-based secrets,
- no secrets in source code,
- no sensitive data in client bundles,
- no raw GPS logging,
- structured error handling that avoids leaking internals.

## 26.1 Rate limiting

Prioritize:

```text
auth login/register
verification endpoints
ride creation
join requests
report submission
```

Realtime location traffic should use separate throttling logic rather than a generic HTTP limiter.

---

# 27. Frontend Data-Fetching Strategy

Use TanStack Query for server state.

Examples:

```text
useCurrentUser()
useRideSearch()
useRide(rideId)
useRideRequests(rideId)
useParticipants(rideId)
useNotifications()
```

Mutations:

```text
useCreateRide()
usePublishRide()
useRequestToJoin()
useAcceptRequest()
useRejectRequest()
useStartRide()
useCompleteRide()
```

### Cache policy

Prefer short/stale-aware caching for:

- locations,
- profile summaries,
- ride search,
- notifications.

Invalidate or refetch when:

- ride status changes,
- participant count changes,
- request is accepted/rejected,
- ride is cancelled,
- session starts/ends.

Do not assume the browser's cached seat count remains authoritative.

---

# 28. Maps Frontend Architecture

Maps should be a reusable feature module.

```text
features/maps/
├── components/
│   ├── RouteMap.tsx
│   ├── RideMarker.tsx
│   ├── PickupMarker.tsx
│   ├── DropMarker.tsx
│   └── LiveRiderMarker.tsx
├── hooks/
│   ├── useRouteMap.ts
│   └── useLiveRideLocation.ts
├── api/
└── types.ts
```

## 28.1 Route creation flow

```text
Origin selected
      ↓
Destination selected
      ↓
API request to backend
      ↓
Backend → map provider
      ↓
Route returned
      ↓
Backend normalizes route
      ↓
Frontend renders route
      ↓
Meaningful waypoints selected
```

Do not expose provider-specific API behavior throughout the entire React application.

---

# 29. Supabase Realtime Architecture

Use Supabase Realtime private channels with RLS authorization for ride events, notifications, location broadcasts, and ride-scoped temporary coordination chat. The authenticated Supabase session establishes identity. Channel policies and trusted functions/database rules enforce ride membership, active state, host-only location publishing, and chat access.

Live location is broadcast only; do not persist GPS coordinates or create a history table. For Option C join hydration, the authorized host client broadcasts its current fix after an authorized participant joins. A missing fresh fix produces the existing stale/no-fix UI state until a valid broadcast arrives.

# 30. Realtime Event Authorization

RLS and trusted database/function policies must bind each private channel subscription or broadcast to the authenticated user, ride, participant/host relationship, ride-session state, and applicable sharing/chat state.

- Confirmed participants may subscribe to authorized active-ride events.
- Only the ride host may publish host live-location updates during an active session with sharing enabled.
- Eligible ride-scoped chat users may send messages only under the approved chat lifecycle rules.
- Unrelated, suspended, or deactivated users are denied.
- Channel names and client-supplied IDs are never sufficient authorization.

# 31. Route and Place Search Abstraction

Use an internal interface:

```ts
interface MapsProvider {
  geocode(query: string): Promise<GeocodedLocation[]>;
  searchPlaces(query: string): Promise<PlaceResult[]>;
  calculateRoute(input: RouteRequest): Promise<RouteResult>;
}
```

The application should depend on this interface.

The concrete implementation can be:

```text
GoogleMapsProvider
```

or another provider.

This is important because the product domain should not know vendor-specific response formats.

Normalize provider responses before saving them.

---

# 32. Folder/File Structure — Final Baseline

```text
src/
  app/
  components/
  features/
  hooks/
  lib/
  integrations/supabase/
supabase/
  functions/
  migrations/
```

Frontend modules belong in `src/`; server-side TypeScript belongs in `supabase/functions/`; schema changes belong in `supabase/migrations/`.

# 33. Environment Configuration

Use Lovable Cloud/Supabase project configuration and secrets. Only the public Supabase project URL and anon/publishable key may be exposed to the frontend as designed; service-role keys and maps-provider keys remain server-side secrets. Do not define custom authentication secrets.

# 34. Deployment Architecture

Publish through Lovable. Configure the required Lovable Cloud/Supabase backend, auth settings, secrets, migrations, and domain values in the supported project environment. Domain names must remain configurable across testing and hosting. Preserve the `TC-DEP-*` deployment/pilot acceptance evidence; do not treat publication alone as proof of readiness.

# 35. Realtime Deployment Considerations

Use Supabase Realtime private channels and RLS authorization. Use Supabase Realtime; do not add a separate realtime or application server. Validate authorization and reconnect behavior against the configured Lovable Cloud/Supabase environment.

# 36. Observability and Logging

Use structured server logs.

Log:

- request ID,
- route,
- status code,
- duration,
- internal error code,
- important state transition.

Do not log:

- passwords,
- authentication secrets,
- PRNs unnecessarily,
- raw live GPS coordinates,
- report contents in ordinary request logs.

Example:

```text
INFO ride.request.accepted
rideId=...
requestId=...
actorId=...
```

For errors, use an error-monitoring provider later if needed.

---

# 37. Testing Architecture

The highest-risk logic should receive the highest test coverage.

## 37.1 Unit tests

Test:

- route-order calculations,
- route proximity,
- time-window filtering,
- matching ranking,
- capacity rules,
- ride state transitions,
- request state transitions,
- rating eligibility.

Example:

```text
pickup sequence 2
drop sequence 5
→ valid

pickup sequence 5
drop sequence 2
→ invalid
```

## 37.2 Integration tests

Test:

- authentication,
- ride creation,
- request submission,
- acceptance,
- transactional seat decrement,
- cancellation,
- completion,
- notification creation.

## 37.3 Realtime tests

Test:

- unauthorized room subscription,
- confirmed passenger subscription,
- host location publishing,
- inactive-session rejection,
- completed-session location rejection.

## 37.4 End-to-end test

At least one complete workflow:

```text
Register
→ Verify
→ Host creates ride
→ Passenger searches
→ Passenger requests join
→ Host accepts
→ Host starts ride
→ Passenger receives live location
→ Host completes ride
→ Passenger rates host
```

---

# 38. Error Handling

Use a central error model.

Recommended classes/categories:

```text
ValidationError
AuthenticationError
AuthorizationError
NotFoundError
ConflictError
BusinessRuleError
InternalServerError
```

Supabase Edge Functions should route all unhandled errors through one error handler.

Never return stack traces in production.

---

# 39. Performance Rules

## Frontend

- lazy-load large pages where useful,
- avoid rerendering the entire app on every Realtime event,
- keep live location updates isolated to the active ride UI,
- debounce search fields,
- cache reusable locations.

## Database / Edge Functions

- paginate notifications/reports,
- index frequent queries,
- avoid excessive query round-trips,
- do not calculate huge route datasets synchronously,
- do not persist GPS points.

## Maps

- avoid repeated route API calls for identical inputs,
- cache normalized route results where appropriate,
- never call a routing provider on every component render.

---

# 40. Scalability Plan

## MVP

```text
Lovable-published frontend
Lovable Cloud / Supabase
PostgreSQL + RLS
Supabase Realtime
no separate application server
```

## Later

When real usage justifies it:

```text
CDN
+
multiple Edge Function instances
+
custom Realtime adapter
+
background workers
+
PostGIS
+
dedicated monitoring
```

The architecture should allow these additions, but MVP should not carry their complexity prematurely.

---

# 41. AI Integration Boundary

AI is a later enhancement.

Potential future AI features:

- natural-language ride creation,
- user-entered route interpretation,
- smart search suggestions,
- route explanation,
- demand insights,
- suspicious-behavior assistance,
- personalized suggestions.

AI must **not** own:

- authentication,
- authorization,
- seat counting,
- ride-state transitions,
- live-location access control,
- report enforcement,
- final safety permissions.

Use deterministic code for all critical rules.

---

# 42. Future "Bring Something" Architecture

The future assistance feature should reuse route infrastructure.

Conceptually:

```text
Assistance Request
├── requester
├── pickup
├── destination
├── desired time
├── item description
└── status
```

Matching can reuse:

```text
route compatibility
+
route order
+
time
```

Do not build this feature into the ride table as a set of special-case fields.

Create a separate module when it is actually implemented.

---

# 43. Admin Architecture

Admin functionality must be separated from normal student features.

Admin can eventually:

- review reports,
- suspend users,
- deactivate rides,
- review platform metrics,
- manage configured locations,
- review moderation events.

Admin APIs require:

```text
authenticated
AND role = ADMIN
```

Never hide an admin route only in the frontend.

---

# 44. Data Retention Principles

Define retention deliberately.

Suggested MVP principle:

```text
persistent:
    student profile
    rides
    requests
    participants
    ratings
    reports
    notifications

temporary/minimal:
    active location
    live Realtime state
```

Do not preserve historical live location by default.

Future retention requirements should be documented before introducing persistent GPS history.

---

# 45. Architectural Anti-Patterns

Do not build any of the following:

### 45.1 One giant `rides` table containing everything

Bad:

```text
rides
+ route geometry
+ all passenger data
+ live coordinates
+ ratings
+ notifications
+ requests
+ admin state
```

This makes authorization and lifecycle logic fragile.

### 45.2 Frontend-controlled capacity

Never:

```text
client says seatsRemaining = 1
server trusts it
```

### 45.3 Frontend-controlled location privacy

Never rely on:

```text
if (isParticipant) showMarker
```

alone.

Server must control the data stream.

### 45.4 Client-controlled user identity

Never accept:

```text
studentId
hostId
admin = true
```

as authoritative identity fields from an untrusted client.

### 45.5 Hard-coded locations

Avoid:

```ts
const ICEM = { lat: ..., lng: ... };
```

spread across multiple files.

### 45.6 AI-controlled business rules

Do not ask an LLM:

```text
"Should this passenger be allowed to join?"
```

That decision must be deterministic.

---

# 46. Implementation Order Implied by This Architecture

The architecture suggests this technical sequence:

```text
1. Repository + Vite React client
2. Supabase Edge Functions TypeScript server
3. PostgreSQL + SQL migrations / Postgres RPC
4. Auth + student profile
5. Locations
6. Ride CRUD + lifecycle
7. Route provider abstraction
8. Waypoints + route representation
9. Deterministic matching
10. Join requests
11. Transactional capacity
12. Notifications
13. Ratings/reports
14. Supabase Realtime
15. Active ride sessions
16. Live location
17. Admin moderation
18. E2E testing
19. Deployment
```

The implementation order is intentionally aligned with domain dependencies.

Do not begin with realtime maps before authentication, rides, participants, and state transitions are stable.

---

# 47. Ride Coordination Messaging Architecture — V1 Addition

## 47.1 Domain Placement

Ride coordination messages belong to the `rides` domain because they exist only in the context of a specific ride.

Recommended module structure:

```text
src/features/rides/
├── ride.controller.ts
├── ride.service.ts
├── ride.routes.ts
├── ride.schema.ts
├── ride.repository.ts
├── ride-message.controller.ts
├── ride-message.service.ts
├── ride-message.schema.ts
├── ride-message.repository.ts
└── ride-message.gateway.ts
```

The frontend should keep ride messaging under the ride feature rather than creating a global messaging module.

## 47.2 Join Request Data

Extend the join-request model with:

```text
specific_area_note nullable string
```

The field is optional, length-limited, and treated as informational clarification only.

It must not become part of the authoritative route geometry or route-order calculation.

Example validation:

```text
specificAreaNote:
  optional
  nullable
  string
  max length defined by product policy
```

## 47.3 Ride Message Data Model

Conceptual SQL migrations / Postgres RPC model:

```text
RideMessage
├── id
├── rideId
├── senderId
├── message
├── createdAt
└── expiresAt
```

Relationships:

```text
Ride 1 ─── N RideMessage
Student 1 ─── N RideMessage
```

Recommended indexes:

```text
ride_id + created_at
expires_at
sender_id + created_at
```

The `expires_at` field is mandatory so retention is explicit at the data layer.

## 47.4 Authorization Model

Every message read/send request must be authorized on the backend.

A user may access ride chat only when the ride-state and participant/request policy allows it.

At minimum, authorization must distinguish:

```text
Host
Confirmed participant
Eligible/pending requester
Unaffiliated student
```

Unaffiliated students must receive `FORBIDDEN` even if they know the ride ID.

When capacity becomes full:

- new requester chat access must be denied,
- existing authorized participants retain access,
- backend authorization must enforce the distinction.

Do not use frontend button visibility as the security boundary.

## 47.5 Supabase Interaction Boundary

Recommended endpoints:

```text
POST   /rides/:rideId/messages
GET    /rides/:rideId/messages
```

Optional future endpoint:

```text
DELETE /rides/:rideId/messages/:messageId
```

A normal student should not be able to delete another student's message unless a separate moderation policy explicitly permits it.

Message creation must validate:

- authentication,
- ride existence,
- ride state,
- sender authorization,
- message length/content constraints,
- expiration policy.

Message reads must:

- enforce authorization,
- return only non-expired messages,
- paginate history if necessary,
- never return expired messages.

## 47.6 Supabase Realtime Events

Use the existing Supabase Realtime infrastructure.

Suggested room:

```text
ride:{rideId}
```

Suggested events:

```text
ride:message:send
ride:message:new
ride:message:read
```

The server must authorize room subscription before joining the room.

Do not allow arbitrary client-supplied ride IDs to create unrestricted Realtime subscriptions.

Persist the message before broadcasting it as authoritative application data, or use a clearly defined transactional/outbox strategy if the implementation later requires stronger delivery guarantees.

## 47.7 Retention / Cleanup

The database is the source of truth for message retention.

Every message receives:

```text
expires_at
```

For a completed ride:

```text
expires_at = ride.completed_at + 3 hours
```

For a cancelled/otherwise terminal ride, the same principle applies using the terminal timestamp.

Cleanup options for MVP:

- scheduled backend cleanup job, or
- database-supported scheduled cleanup if the deployment platform reliably supports it.

Do not depend on a user's browser being open to delete messages.

Cleanup must be idempotent.

## 47.8 Completion Transition

When a ride moves to `COMPLETED`:

```text
close ride session
→ revoke live location
→ mark ride completed
→ calculate message expiry timestamp
→ chat becomes read-only
→ retain messages until expiry
```

No new message should be accepted after completion.

The same terminal principle applies to cancelled rides.

## 47.9 Transaction Boundaries

Accepting a join request remains transactional:

```text
request lookup
→ capacity check
→ create participant
→ decrement available seats
→ mark request accepted
→ notify requester
```

Messaging is intentionally separate from capacity mutation.

A message must never create a participant or reserve a seat.

## 47.10 Security and Logging

Do not log message bodies in ordinary request logs.

Log metadata only when required, for example:

```text
ride.message.sent
rideId=...
senderId=...
messageId=...
```

Apply rate limiting to message creation to prevent spam/flooding.

## 47.11 Testing Requirements

Unit tests:

- message validation,
- expiry calculation,
- chat-access policy,
- capacity-full policy,
- terminal ride policy.

Integration tests:

- authorized send,
- unauthorized send,
- authorized history read,
- expired-message filtering,
- completed-ride read-only behavior,
- cleanup.

Realtime tests:

- authorized room subscription,
- unauthorized room subscription,
- message broadcast,
- no broadcast to unauthorized users.

# 48. Definition of Architecture Done

Architecture is considered implemented correctly when:

### Foundation

- [ ] React + TypeScript + Vite client exists.
- [ ] Supabase Edge Functions + TypeScript server exists.
- [ ] PostgreSQL is connected through SQL migrations / Postgres RPC.
- [ ] Environment configuration is separated from source code.

### Domain

- [ ] Students are separate from rides.
- [ ] Routes are separate from rides.
- [ ] Waypoints are ordered.
- [ ] Join requests are separate from confirmed participants.
- [ ] Ride sessions are separate from published rides.
- [ ] Notifications, ratings, and reports are separate modules.

### Matching

- [ ] Date filtering exists.
- [ ] Time-window filtering exists.
- [ ] Route proximity exists.
- [ ] Pickup-before-drop is enforced.
- [ ] Capacity is enforced.
- [ ] Ranking is deterministic.
- [ ] Matching rules are tested.

### Realtime

- [ ] Private Realtime channel authorization exists.
- [ ] Ride-room authorization exists.
- [ ] Only confirmed participants receive active ride location.
- [ ] Only the host can publish host location.
- [ ] Location stops after ride completion.
- [ ] Stale/reconnect behavior is handled.

### Security

- [ ] Server-side authorization exists.
- [ ] Admin RBAC exists.
- [ ] Validation exists.
- [ ] Rate limiting exists for sensitive actions.
- [ ] PRN is not exposed publicly.
- [ ] Secrets are not committed.
- [ ] Sensitive GPS data is not unnecessarily persisted/logged.

### Quality

- [ ] Unit tests cover matching and state transitions.
- [ ] Integration tests cover capacity and ride workflows.
- [ ] Realtime authorization is tested.
- [ ] Critical end-to-end journey works.

---

# 49. Final Architectural Contract for Lovable AI

When generating or modifying ICEM Connect:

1. Read `PRD.md` and this file before making structural changes.
2. Do not replace the architecture with a simpler but semantically incorrect design.
3. Preserve separation of ride, route, waypoint, participant segment, and live session.
4. Keep business logic server-side.
5. Keep database constraints strong.
6. Use transactions for capacity-sensitive operations.
7. Treat realtime location as temporary and authorization-sensitive.
8. Use a map-provider abstraction.
9. Keep AI outside critical authorization logic.
10. Keep the MVP small enough to deploy and test.
11. Prefer clear, boring, maintainable architecture over premature microservices.
12. Before adding a new feature, identify its correct domain module rather than modifying unrelated modules.
13. Any architectural change that affects the product behavior defined in `PRD.md` must also update `PRD.md`, not silently diverge from it.
14. Any completed implementation change that affects the current project state must eventually be recorded in `Memory.md`.

**This document defines the implementation baseline for ICEM Connect.**


