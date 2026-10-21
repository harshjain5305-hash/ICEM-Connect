# ICEM Connect — Product Requirements Document (PRD)

**Version:** 1.1  
**Status:** Product source of truth  
**Project:** ICEM Connect  
**Institution:** Indira College of Engineering & Management (ICEM), Pune  
**Primary users:** Verified ICEM students  
**Primary platform:** Responsive web application, mobile-first  
**Purpose:** Semester 1 MCA capstone + controlled real-world campus pilot

**Changelog (1.1):** Updated for the Lovable-native stack; reconciled current decisions and document references.

---

## 0. Instructions for Lovable AI

This document defines **what ICEM Connect must be**, not merely a collection of ideas.

When implementing the product:

- Treat this PRD as the product-level source of truth.
- Preserve all P0 requirements unless an explicit later decision changes them.
- Do not invent major features that are outside this PRD.
- Do not remove core requirements merely because a simpler implementation is easier.
- When implementation details are unspecified, choose the simplest production-sensible solution that preserves the requirements.
- Keep authentication, student identity, routes, rides, matching, realtime location, notifications, ratings, reports, and administration as separate product concerns.
- Do not expose PRNs publicly.
- Do not expose live student location before the required authorization conditions are satisfied.
- Do not implement payment, commercial taxi functionality, public social feeds, or complex AI in the MVP.
- Build mobile-first.
- Use reusable components and domain-oriented code.
- Do not hard-code ICEM locations throughout the frontend; locations should be data/configuration.
- Preserve the distinction between:
  1. a ride,
  2. its route,
  3. meaningful waypoints/stops,
  4. a passenger's requested pickup/drop segment,
  5. an active realtime ride session.
- Backend authorization and validation are authoritative. Frontend checks are not security boundaries.

---

# 1. Product Definition

## 1.1 What is ICEM Connect?

ICEM Connect is a **verified student route-sharing and assistance platform** for ICEM students.

It connects:

- students who are already travelling somewhere and have available capacity,
- with students who need to travel along a compatible portion of that route.

The system may later extend the same route infrastructure to small student assistance requests such as carrying a tiffin, document, stationery item, or small parcel along an existing route.

## 1.2 What ICEM Connect is NOT

ICEM Connect is not:

- Uber/Ola for students,
- a commercial taxi company,
- a driver marketplace,
- a public ride-hailing platform,
- a public location-tracking system,
- a general courier company,
- a social-media application,
- a payment/wallet application,
- an AI chatbot whose primary purpose is conversation.

The product's core value is **coordination of existing student movement**.

---

# 2. Problem Statement

Students travelling to and from ICEM may face a recurring last-mile mobility problem.

A student may need to travel between ICEM and the main road or another nearby destination. Students without a two-wheeler may have to:

- walk,
- wait for another transport option,
- pay repeatedly for short trips,
- depend on friends informally,
- or change plans because transport is inconvenient.

At the same time, many students already travel along those same roads using bikes or scooters, sometimes with unused passenger capacity.

Therefore the problem is partly a **coordination problem**:

> A student needs a route segment while another verified student is already travelling through that segment.

ICEM Connect should make those compatible movements discoverable and manageable.

---

# 3. Product Vision

Create a trusted, campus-bounded student network where existing trips can be shared efficiently.

Traditional ride models think:

`Origin → Destination`

ICEM Connect thinks:

`Origin → Route → Intermediate Points → Destination`

This allows one host ride to potentially serve different passengers on different portions of the same route.

Example:

```text
ICEM
  ↓
Main Road
  ↓
Market
  ↓
Pimpri
  ↓
Bhosari
```

Possible passenger segments:

```text
ICEM → Main Road
ICEM → Market
Main Road → Pimpri
Main Road → Bhosari
Market → Bhosari
Pimpri → Bhosari
```

The system must understand route order rather than requiring exact origin/destination equality.

---

# 4. Target Users

## 4.1 Passenger

A verified student who needs transportation.

Typical characteristics:

- no personal two-wheeler,
- temporarily without a vehicle,
- wants a short route,
- wants a convenient route,
- wants to travel with another verified student.

Example:

> A student needs to travel from ICEM to the main road at approximately 5:30 PM.

The student searches for compatible rides and submits a join request.

## 4.2 Ride Host

A verified student who is already travelling and has available capacity.

Example:

> A student is travelling from ICEM to Bhosari at 5:30 PM and has one available passenger seat.

The student publishes the trip.

## 4.3 Dual-role student

One account can be both:

- passenger on one ride,
- host on another ride.

There must not be separate "driver" and "passenger" accounts.

The role is determined by the action being performed.

## 4.4 Future assistance requester

A student who wants another student to bring a small item along an existing route.

This is explicitly a later-phase feature.

---

# 5. Core Use Cases

## UC-01 — Register and verify

1. Student opens ICEM Connect.
2. Student creates an account.
3. Student completes the configured student-verification process.
4. System verifies eligibility.
5. Student creates/finishes their profile.
6. Student enters the authenticated application.

The verification identifier, including PRN if used, is internal data and must not be displayed publicly.

---

## UC-02 — Offer a ride

1. Host opens **Offer a Ride**.
2. Host chooses origin.
3. Host chooses destination.
4. System generates/displays the route.
5. Host can review meaningful intermediate route points.
6. Host chooses date.
7. Host chooses departure time.
8. Host enters available seats.
9. Host chooses vehicle type.
10. Host optionally adds a note.
11. Host reviews the ride.
12. Host publishes it.
13. Ride becomes discoverable to compatible students.

---

## UC-03 — Find a ride

1. Passenger opens **Find a Ride**.
2. Passenger enters pickup.
3. Passenger enters destination.
4. Passenger chooses date.
5. Passenger chooses approximate departure time.
6. System searches published rides.
7. Backend validates route compatibility.
8. Compatible rides are returned.
9. Passenger opens a ride.
10. Passenger selects/confirm pickup and drop points.
11. Passenger sends a join request.

---

## UC-04 — Join a route segment

Host route:

```text
ICEM → Main Road → Market → Pimpri → Bhosari
```

Passenger:

```text
Pickup = Main Road
Drop = Bhosari
```

This is valid because pickup occurs before drop along the host's route.

Reverse request:

```text
Pickup = Bhosari
Drop = Market
```

is invalid for this ride because it travels against the host route direction.

The matching system must validate this server-side.

---

## UC-05 — Host accepts a request

1. Host receives a notification.
2. Host opens ride requests.
3. Host sees passenger identity/profile information allowed by product privacy rules.
4. Host reviews requested pickup/drop.
5. Host accepts or rejects.
6. Backend updates the request state.
7. Passenger receives a notification.
8. If accepted, the passenger becomes a confirmed participant.
9. Seat availability is updated transactionally.

---

## UC-06 — Active ride and live location

Before acceptance:

```text
Passenger → NO live host location
```

After acceptance but before the ride starts:

```text
Passenger → NO live host location
```

When the ride is active and location sharing is enabled:

```text
Confirmed passenger → CAN receive host live location
```

After completion/cancellation:

```text
Passenger → live location access ends
```

Live location is temporary and authorization-controlled.

---

## UC-07 — Complete a ride

1. Host starts/activates the ride.
2. Authorized realtime location becomes available.
3. Participants travel.
4. Host completes the ride.
5. Backend changes ride/session state.
6. Realtime location sharing stops.
7. Participants can rate/report the relevant participant.

---

## UC-08 — Rate participant

After a completed ride:

- participant can provide a rating,
- optional short comment,
- rating is associated with the completed ride.

Ratings should contribute to a reputation summary.

---

## UC-09 — Report/block

A student can report another participant or ride.

The report can include:

- category,
- description,
- relevant ride,
- reported user.

A user can block another user where supported.

Admin can review and act on reports.

---

# 6. Core Domain Model

ICEM Connect must model a trip as a route, not only as two locations.

## 6.1 Ride

A ride represents a host's planned trip.

Conceptually:

```text
Ride
├── Host
├── Origin
├── Destination
├── Route
├── Waypoints
├── Departure date/time
├── Capacity
├── Vehicle type
└── Status
```

## 6.2 Route

A route represents the ordered path between origin and destination.

It may contain:

- route geometry,
- ordered coordinates,
- meaningful waypoints,
- routing metadata.

## 6.3 Passenger segment

A participant does not necessarily travel the whole route.

They have:

```text
Pickup
+
Drop
+
Seat count
```

The passenger segment must fit inside the host's route.

## 6.4 Ride session

A ride session represents the actual active journey.

It controls:

- start time,
- end time,
- active state,
- live location authorization/context.

This is separate from the published ride itself.

---

# 7. Route and Waypoint Requirements

## 7.1 Do not require manual road-by-road entry

The host should not have to enter:

```text
Road 1
Road 2
Road 3
Road 4
...
```

The routing service should generate route geometry.

## 7.2 Meaningful points

The application may expose meaningful points such as:

- ICEM,
- main road,
- bus stop,
- market,
- recognized landmark,
- destination.

These points may be selected as pickup/drop locations.

## 7.3 Pass-through versus stop

The system should conceptually distinguish:

- a point the vehicle passes through,
- a point where a passenger is expected to board/leave.

A route can pass through a location without requiring it to become a formal stop.

## 7.4 Route order

Every usable pickup/drop point must have an order relative to the route.

For example:

```text
ICEM       = 1
Main Road  = 2
Market     = 3
Pimpri     = 4
Bhosari    = 5
```

A passenger request is valid only when:

```text
pickup_order < drop_order
```

plus all other matching constraints.

---

# 8. Ride Matching

Matching is a core product feature.

## 8.1 Inputs

Passenger:

- pickup
- destination
- date
- approximate departure time
- optional time flexibility
- requested seats

Host ride:

- route
- route points/geometry
- departure date/time
- available seats
- ride status

## 8.2 Hard compatibility conditions

A ride should be considered compatible only if:

1. ride is published/eligible,
2. date matches,
3. sufficient seats exist,
4. passenger pickup lies on/near the usable route,
5. passenger drop lies on/near the usable route,
6. pickup occurs before drop along the host route,
7. time falls within accepted matching tolerance,
8. host ride is not cancelled/expired,
9. passenger is eligible to join.

## 8.3 Ranking

Initial ranking should be deterministic.

Suggested order:

1. route compatibility quality,
2. pickup/drop proximity to route,
3. departure-time proximity,
4. available seats,
5. host reputation/reliability.

Do not introduce an opaque AI recommendation engine into the MVP.

---

# 9. Capacity

Capacity must be enforced by the backend.

Example:

```text
Total seats = 2

Passenger A accepted = 1
Passenger B accepted = 1

Remaining = 0
```

The system must prevent race-condition overbooking.

Two simultaneous join requests must not both succeed if only one seat remains.

Use a transactional backend operation or equivalent concurrency-safe mechanism.

---

# 10. Ride Lifecycle

Recommended state model:

```text
DRAFT
  ↓
PUBLISHED
  ↓
CONFIRMED
  ↓
ACTIVE
  ↓
COMPLETED
```

Terminal/alternative states:

```text
CANCELLED
EXPIRED
```

Request state:

```text
PENDING
 ├── ACCEPTED
 └── REJECTED
```

Participant state may additionally support:

```text
CONFIRMED
CANCELLED
COMPLETED
NO_SHOW
```

The exact implementation can evolve, but state transitions must be explicit and backend-controlled.

---

# 11. Live Location Requirements

Live location is one of the product's most sensitive features.

## 11.1 Visibility

No public live location.

No location visibility before accepted participation.

No location visibility after the ride ends.

## 11.2 Authorization

A realtime location subscription must require:

- authenticated user,
- confirmed participation,
- correct ride,
- active ride session,
- location sharing enabled,
- valid session.

The backend must enforce this.

## 11.3 Realtime behaviour

Initial implementation target:

- Supabase Realtime private channels authorized by RLS,
- GPS update approximately every 5–10 seconds while active,
- only relevant ride participants receive updates.

The exact interval may be tuned after testing.

## 11.4 Persistence

Do not write every GPS update into PostgreSQL.

High-frequency location should primarily be transient realtime state.

Persist only data that has a legitimate product/operational purpose.

## 11.5 Start/stop

Recommended flow:

```text
Confirmed
   ↓
Host presses "Start Ride"
   ↓
Ride becomes ACTIVE
   ↓
Location sharing starts
   ↓
Participants receive updates
   ↓
Host presses "Complete Ride"
   ↓
Ride becomes COMPLETED
   ↓
Location sharing stops
```

---

# 12. Notifications

Minimum in-app notification events:

- new join request,
- request accepted,
- request rejected,
- ride cancelled,
- ride updated,
- ride becoming active,
- ride completed,
- rating reminder,
- report/admin action where appropriate.

Push notifications can be added later.

Notifications must not reveal unnecessary sensitive information.

---

# 13. Profile

Minimum profile data:

- name,
- avatar/profile image,
- course/program,
- year,
- department where applicable,
- rating summary,
- completed ride count,
- account status.

Never expose:

- password,
- PRN,
- private authentication data,
- unnecessary personal identifiers,
- continuous location history.

Phone number should not be publicly displayed by default.

---

# 14. Ratings and Reputation

After a completed ride, participants may rate relevant participants.

Suggested:

```text
1–5 stars
+
optional short comment
```

Reputation can display:

```text
4.8 ★
32 completed rides
```

The product should avoid turning ratings into a public social popularity system.

Abusive or fraudulent rating behaviour should be reportable/admin-moderatable.

---

# 15. Safety and Moderation

Minimum safety controls:

- report user,
- report ride,
- block user,
- cancel ride,
- admin review,
- account suspension/deactivation.

Report categories:

- unsafe driving,
- harassment,
- inappropriate behaviour,
- no-show,
- misrepresentation,
- route/pickup abuse,
- suspicious activity,
- other.

The product must not claim that student verification guarantees personal safety.

Verification establishes eligibility/account identity; it does not eliminate real-world risk.

---

# 16. Admin

Admin capabilities should include:

## User management

- view users,
- verify/deactivate where applicable,
- suspend accounts,
- inspect account status.

## Report management

- list reports,
- inspect report context,
- update report status,
- take moderation action.

## Ride management

- inspect rides,
- cancel problematic rides where authorized,
- investigate reports.

## Location management

- manage known/structured locations,
- manage commonly used destinations.

## Basic metrics

- users,
- rides,
- requests,
- completed rides,
- reports,
- route activity.

Admin interfaces must be protected separately from normal student access.

---

# 17. Core Screens

## Public

1. Landing page
2. Login
3. Registration
4. Student verification

## Student

5. Home/dashboard
6. Find a Ride
7. Search Results
8. Ride Details
9. Offer a Ride
10. Route Selection/Preview
11. Join Request
12. My Rides
13. Ride Requests
14. Active Ride
15. Live Map
16. Notifications
17. Profile
18. Rating
19. Report/Block

## Admin

20. Admin Dashboard
21. User Management
22. Reports
23. Ride Management
24. Location Management

Screens may be combined where UX is better, but every core journey must remain possible.

---

# 18. Home Dashboard

The authenticated home page should prioritize the two main actions:

```text
[ Find a Ride ]

[ Offer a Ride ]
```

Secondary sections may include:

- upcoming ride,
- recent ride,
- nearby/common routes,
- notifications,
- profile/reputation.

Do not overload the dashboard with unrelated features.

---

# 19. Find Ride UX

Recommended flow:

```text
Find a Ride
   ↓
Pickup
   ↓
Destination
   ↓
Date
   ↓
Time
   ↓
Search
   ↓
Compatible Ride Cards
   ↓
Ride Details
   ↓
Choose Pickup/Drop
   ↓
Request to Join
```

Ride cards should make important information immediately visible:

- host,
- departure time,
- route,
- available seats,
- approximate pickup,
- approximate drop,
- rating/reputation.

---

# 20. Offer Ride UX

Recommended flow:

```text
Offer a Ride
   ↓
From
   ↓
To
   ↓
Route Preview
   ↓
Date
   ↓
Departure Time
   ↓
Available Seats
   ↓
Vehicle Type
   ↓
Optional Note
   ↓
Review
   ↓
Publish
```

The host should see the route before publishing.

---

# 21. Active Ride UX

During an active confirmed ride:

Host sees:

- route,
- passengers,
- pickup/drop segments,
- ride status,
- Start Ride/Complete Ride controls,
- location-sharing state.

Passenger sees:

- route,
- own pickup/drop,
- host's live position,
- ride status,
- relevant participant information,
- cancellation/report controls.

The passenger must not see unrelated students' live locations.

---

# 22. Mobile-First Requirements

The majority of use is expected to occur on smartphones.

Therefore:

- touch targets must be comfortable,
- primary actions must be prominent,
- forms should minimize typing,
- locations should support search/autocomplete,
- maps should work in constrained screen space,
- route cards should be scannable,
- important actions should remain accessible,
- loading states must be clear,
- network errors must be recoverable.

Desktop support remains required.

---

# 23. Accessibility

Minimum expectations:

- semantic HTML,
- accessible form labels,
- keyboard navigation where relevant,
- visible focus states,
- adequate contrast,
- meaningful error messages,
- accessible buttons,
- status not communicated through color alone.

---

# 24. Security Requirements

The backend must:

- authenticate protected requests,
- authorize every protected resource,
- validate all incoming data,
- protect admin operations,
- prevent unauthorized ride access,
- prevent unauthorized location subscriptions,
- protect sensitive identifiers,
- prevent capacity race conditions,
- rate-limit abuse-prone endpoints where appropriate,
- log important security events without logging unnecessary sensitive data.

The frontend must never be treated as a security boundary.

---

# 25. Privacy Requirements

Hard rules:

- PRN is internal verification data only.
- No public student directory containing sensitive information.
- No public live-location map.
- No persistent high-frequency GPS history by default.
- Location access is temporary and contextual.
- Only required user information should be collected.
- Users should be informed when live location is active.
- Live location must stop when the active ride ends.
- Reports should be visible only to authorized administrators/reviewers.

---

# 26. V1 Scope

## Must have

- student authentication,
- student verification,
- profile,
- offer ride,
- route/map,
- meaningful waypoints,
- find ride,
- route-segment matching,
- join request,
- host acceptance/rejection,
- capacity management,
- ride lifecycle,
- realtime active ride,
- authorized temporary live location,
- notifications,
- ratings,
- reporting/blocking,
- basic admin moderation,
- ride-scoped temporary coordination chat.

---

# 27. V1.5 Scope

After the core ride system works:

- improved notifications,
- richer route search,
- improved matching,
- better pickup/drop selection,
- ride history improvements,
- reliability indicators,
- bring-something requests,
- small route-compatible assistance.

---

# 28. Future Scope

Potential future features:

- AI natural-language ride creation,
- AI-assisted route interpretation,
- AI-assisted matching,
- demand analysis,
- route popularity analytics,
- advanced recommendations,
- push notifications,
- broader ICEM coverage,
- PG/hostel integration,
- additional colleges,
- college administration integration,
- route-compatible student task exchange.

These are not MVP requirements.

---

# 29. AI Product Policy

AI should support the product, not become the product.

Good future AI use:

```text
User:
"Leaving ICEM for Bhosari at 5:30, one seat available."

AI extracts structured ride data.
```

Then deterministic backend validation handles:

- location validity,
- time,
- capacity,
- permissions,
- ride state.

AI must NOT independently decide:

- who can see live location,
- who is authorized to join,
- whether a user is verified,
- whether capacity exists,
- whether an admin action is allowed.

Those decisions must remain deterministic and server-controlled.

---

# 30. No Payment in MVP

The MVP will not include:

- payment gateway,
- wallet,
- fare calculation,
- in-app money transfer,
- commission,
- commercial pricing.

This keeps the first release focused on route coordination and avoids prematurely turning the product into a commercial transportation marketplace.

If cost-sharing is considered later, it requires a separate product, legal, safety, and operational review.

---

# 31. Bring-Something Feature — Future Definition

Later, a student may create:

```text
Pickup: Market
Drop: ICEM
Item: Tiffin
Preferred time: 6:00 PM
```

The system searches existing student routes for compatible movement.

A student already travelling that route can accept the request.

Before implementation, define:

- item size limits,
- prohibited items,
- liability,
- cancellation rules,
- dispute handling,
- proof of pickup/delivery,
- privacy,
- compensation/cost-sharing if any.

Do not build this into the MVP.

---

# 32. Success Criteria

## Technical success

The MVP is technically successful when:

- verified students can register/login,
- profiles work,
- hosts can publish rides,
- routes are generated/displayed,
- passengers can search rides,
- route segments can be matched,
- passengers can request to join,
- hosts can accept/reject,
- capacity remains correct under concurrent requests,
- confirmed participants can access authorized live location during active rides,
- live location stops after completion,
- notifications work,
- completed rides support ratings,
- reports can be submitted,
- admins can moderate,
- application is deployed,
- application works well on mobile.

## Real-world success

Measure separately:

- verified users,
- active ride hosts,
- ride offers,
- join requests,
- successful matches,
- completed rides,
- repeat usage,
- cancellations,
- no-shows,
- frequently requested routes,
- time-to-match,
- active participants.

Registrations alone are not a meaningful success metric.

---

# 33. Capstone Objective

ICEM Connect should demonstrate practical full-stack engineering.

The project should visibly involve:

- React,
- TypeScript,
- Vite,


- PostgreSQL,

- authentication,
- route/map APIs,
- Edge Functions and Postgres RPC,
- realtime communication,
- geolocation,
- server-side authorization,
- deployment,
- testing.

The project should be structured as a real software product rather than a collection of disconnected CRUD screens.

---

# 34. Real-World Pilot Objective

The product should be deployed first to a controlled ICEM student audience.

The pilot should answer:

> Do students actually use a verified route-sharing system when compatible rides are available?

The product should not assume that technical functionality automatically creates a successful network.

The biggest real-world risk is **network liquidity**:

- without enough hosts, passengers find nothing;
- without enough passengers, hosts have little reason to publish.

Therefore pilot measurement is part of the product plan.

---

# 35. Hard MVP Boundaries

Do NOT add these during MVP unless the project specification is explicitly revised:

- payment gateway,
- wallet,
- fare marketplace,
- public user directory,
- public live map,
- continuous background tracking,
- Uber-style driver dispatch,
- navigation replacement,
- social feed,
- general chat platform, direct messages, or chat outside a ride,
- multi-college network,
- nationwide expansion,
- complex AI recommendation engine,
- generic courier marketplace,
- gamification/merit system.

---

# 36. Product Architecture Implications

This PRD intentionally creates several boundaries that the technical architecture must respect:

```text
Authentication
      ↓
Student identity
      ↓
Locations
      ↓
Routes
      ↓
Rides
      ↓
Join Requests
      ↓
Participants
      ↓
Ride Session
      ↓
Realtime Location
      ↓
Completion
      ↓
Rating / Reporting
```

Each domain must have clear ownership.

For example:

- Authentication decides whether a user is authenticated.
- Verification decides whether the account is eligible.
- Rides decide what trip exists.
- Matching decides whether a passenger's requested segment fits.
- Participants decide who is confirmed.
- Ride session decides whether the trip is active.
- Realtime authorization decides who may receive live location.
- Admin/reporting handles moderation.

---

# 37. Product Definition Summary

ICEM Connect is:

> **A verified, route-aware student network that helps ICEM students share compatible journeys and, later, small route-compatible assistance.**

The central mechanism is:

```text
Student trip
      ↓
Route
      ↓
Ordered route points
      ↓
Passenger requested segment
      ↓
Compatibility validation
      ↓
Join request
      ↓
Host acceptance
      ↓
Confirmed participant
      ↓
Active ride
      ↓
Temporary authorized live location
      ↓
Ride completion
      ↓
Rating / reporting
```

The product should make existing student movement more useful without becoming a commercial taxi service or a public location-tracking system.

---

# 38. Ride Coordination Messages — V1 Addition

ICEM Connect includes a **ride-specific temporary coordination message feature**. This is not a general social chat system. Its purpose is to let a passenger clarify route, pickup-area, timing, and ride-status questions with the host and other authorized participants.

## 38.1 Join Request — Optional Specific Area / Pickup Note

A join request must contain the structured trip information:

- pickup point,
- drop point,
- requested seats.

It may additionally contain an optional **specific area / pickup note** entered by the requester.

Examples:

```text
Pickup: Main Road
Specific area / pickup note: Near the HP petrol pump; I can walk about 100 m.
```

```text
Pickup: ICEM
Specific area / pickup note: Near the main gate.
```

The host must see this note directly in the pending join-request card before accepting or rejecting the request.

### Critical rule

The optional note is human clarification. It does **not** replace or override the structured pickup/drop points used by deterministic route matching.

A note such as:

```text
Pickup: Main Road
Note: Actually pick me up 3 km away
```

must not silently make the request valid. If the actual requested pickup changes materially, the passenger must change the structured pickup or discuss it with the host before confirmation.

## 38.2 Host Decision

The host request-management view must show, at minimum:

- requester identity,
- requested pickup,
- requested drop,
- seats requested,
- optional specific-area/pickup note,
- route compatibility/status,
- Accept,
- Reject,
- Message.

The host remains responsible for accepting or rejecting the request according to the published route, capacity, and practical pickup feasibility. The backend remains authoritative for route validity and capacity.

## 38.3 Ride Chat / Coordination Messages

Each ride may have a temporary, ride-scoped conversation.

Typical questions:

- "Are you going through Main Road?"
- "Can you pick me up near the college gate?"
- "Will you pass through Bhosari?"
- "Is the ride still happening?"

The chat must be available only to authorized users associated with the ride according to the ride's current state and participant/request policy.

### Chat is not the authorization mechanism

Chat must never bypass:

- student verification,
- route matching,
- join-request approval,
- capacity limits,
- ride-state rules,
- live-location authorization.

The authoritative flow remains:

```text
Find Ride
  ↓
Join Request
  ↓
Host Accept / Reject
  ↓
Confirmed Participant
```

## 38.4 Chat Availability and Capacity

Recommended lifecycle:

```text
Ride published + capacity available
        ↓
Eligible requesters may communicate for coordination
        ↓
Capacity full
        ↓
No new requester chat access
Existing authorized participants retain chat
        ↓
Ride active
        ↓
Confirmed participants retain chat
        ↓
Ride completed/cancelled
        ↓
Chat becomes read-only
        ↓
3-hour retention window
        ↓
Messages permanently deleted/anonymized per retention implementation
```

Capacity-full must not remove existing confirmed participants' ability to coordinate.

The exact authorization rule must be enforced server-side, not merely by hiding the Message button.

## 38.5 Message Retention

Messages are temporary operational data.

- Messages must have an explicit expiration timestamp.
- Retention begins from **ride completion** for completed rides.
- Messages remain available for up to **3 hours after ride completion**.
- After the retention period, messages must be deleted or irreversibly anonymized according to the implemented retention policy.
- Cancelled rides should follow the same temporary-retention principle, with the retention clock beginning when the ride becomes terminal.
- Expired messages must not remain accessible through normal APIs, UI history, caches, or realtime replay.

The implementation must include a reliable cleanup mechanism; expiry must not depend only on the frontend.

## 38.6 Message Safety

Ride messages must support the existing safety model:

- authenticated sender,
- ride-scoped authorization,
- message length limit,
- rate limiting/anti-spam controls,
- report/block pathways where applicable,
- server-side validation,
- no public/global chat.

The system should not log message bodies in ordinary application logs.

## 38.7 V1 Data Addition

Conceptual entity:

```text
ride_messages
├── id
├── ride_id
├── sender_id
├── message
├── created_at
└── expires_at
```

A separate chat-membership table is not required initially if authorization can be derived securely from the ride host, pending requests, and confirmed participants. Add a dedicated membership table only if future requirements justify it.

## 38.8 V1 Scope Update

The following are now V1 requirements:

- optional specific-area/pickup note on join requests,
- host visibility of that note before accept/reject,
- ride-scoped temporary coordination messages,
- capacity-aware chat access,
- realtime message delivery,
- 3-hour post-completion retention,
- server-side authorization and cleanup.

The product still does **not** include a general student-to-student messaging system.


---

# 39. Definition of Done for the PRD

This PRD is considered implemented correctly at the product level when the final application can demonstrate the complete primary journey:

```text
Verified Student
      ↓
Find Ride
      ↓
Enter Pickup + Drop + Time
      ↓
Receive Compatible Route
      ↓
Open Ride
      ↓
Request Segment
      ↓
Host Accepts
      ↓
Ride Confirmed
      ↓
Host Starts Ride
      ↓
Passenger Gets Authorized Live Location
      ↓
Ride Completes
      ↓
Location Stops
      ↓
Rating / Report
```

The secondary journey:

```text
Verified Student
      ↓
Offer Ride
      ↓
Generate Route
      ↓
Publish
      ↓
Receive Request
      ↓
Accept
      ↓
Complete Ride
```

must also work reliably.

The future assistance journey is intentionally outside MVP.


## End of PRD
