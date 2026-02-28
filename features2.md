# Shire — Features & Requirements

> *Restaurants used to run on chaos. Now they run on data.*

---

## 1. Computer Vision Pipeline

### 1.1 Table Segmentation
- **Method**: Finetune DINOv3 on manually annotated CCTV frames
- **Input**: Raw video from existing restaurant cameras
- **Output**: Segmentation mesh coordinates (for calculating presence/occupancy) + Table ID
- No new hardware required — works with cameras already installed

### 1.2 People Segmentation
- **Method**: Off-the-shelf segmentation models
- **Output**: Bounding box mesh coordinates (low specificity acceptable)
- Cross-reference human mesh position vs table mesh position to count occupants per table

### 1.3 Table State Classification
- **Hybrid Approach**:
  - **Deterministic**: People mesh intersects table mesh → table is occupied
  - **ML**: CNN or DINOv3 with MLP head for clean vs dirty classification
- Runs inference every N frames
- **Output per table**: predicted state (`empty_clean` | `occupied` | `empty_dirty`), confidence score (0–1), last state change timestamp

### 1.4 Data Annotation Pipeline
- **Step 1 — Cropping**: Once table segmentation is complete, run cropping script to generate one video per table from raw footage (`raw_footage.mp4` → `table_01.mp4`, `table_02.mp4`, ... `table_n.mp4`)
- **Step 2 — Manual Labeling**: Watch per-table recordings and log states with timestamps:
  ```json
  {
    "table_03": [
      { "state": "empty_clean", "start": "0:00", "end": "2:33" },
      { "state": "occupied", "start": "2:33", "end": "45:12" },
      { "state": "empty_dirty", "start": "45:12", "end": "48:30" },
      { "state": "empty_clean", "start": "48:30", "end": "52:00" }
    ]
  }
  ```
- **Output**: Labeled clips organized into folders, ready for training

---

## 2. Routing Engine

### 2.1 Waiter Routing Algorithm
- **Score** = `(Avg Latency × Efficiency) × (1 / Tips Made)`
- Score is divided by 2 for every extra table a waiter currently manages
- Highest-scoring waiter gets routed — slightly prioritizes efficient workers, heavily biases toward fair tip distribution
- **Skill-Based Layer**:
  - Large party specialist designation
  - Wine/upsell skill rating
  - Language capabilities
  - Trainee status — trainees paired with experienced servers, limited table count
- **Table Value Weighting**: During peak hours, factors in table's historical revenue potential (party size × avg spend per person × table position value) to optimize high-value seating within sections

### 2.2 Host Routing
- Recommends an open table accommodating party size + preference (window / bar / booth / none)
- Selected within the routed waiter's section
- After table state changes to occupied, waiter gets routed

### 2.3 Cleaner / Busser Routing
- CV detects table state → `empty_dirty`
- Auto-assigns nearest available cleaner
- Push notification fires to busser's device immediately

### 2.4 Double-Seating Prevention
- Point/timer system that increases iteratively per server
- Tracks how recently each server was last sat
- Prevents any section from getting overwhelmed

### 2.5 Kitchen Pause Seating
- One-tap button in kitchen → host app immediately stops new seating
- Duration: auto-calculated from current ticket backlog, or manually set
- Auto-resumes when ticket queue clears below threshold

### 2.6 Routing Process
- Runs for every table, every N frames, for every new guest party
- Ingests positional data from table + people segmentation, staff info, and host input
- Spawns ML classification every N frames to update table states
- Routing decisions recalculated continuously

---

## 3. Data Structures

### 3.1 Stored Staff Data (JSON)
```json
{
  "waiters": [
    {
      "id": "waiter_id",
      "name": "display_name",
      "score": 7.4,
      "current_tip_total": 142.50,
      "live_tables": 3,
      "status": "available | busy | on_break | heading_to_table",
      "section": "section_id",
      "skills": {
        "large_party": true,
        "wine_upsell": false,
        "languages": ["en", "es"],
        "trainee": false,
        "paired_with": null
      }
    }
  ],
  "cleaners": [
    {
      "id": "cleaner_id",
      "name": "display_name",
      "status": "idle | cleaning | unavailable"
    }
  ],
  "hosts": [
    {
      "id": "host_id",
      "name": "display_name",
      "on_duty": true
    }
  ]
}
```

### 3.2 ML Input (JSON)
```json
{
  "camera_id": "cam_01",
  "frame_timestamp": "2025-01-15T19:32:00Z",
  "tables": [
    {
      "table_id": "table_07",
      "predicted_state": "clean | occupied | dirty",
      "state_confidence": 0.94,
      "last_state_change": "2025-01-15T19:15:00Z"
    }
  ]
}
```

### 3.3 UI Input (JSON)
```json
{
  "host": {
    "id": "host_id",
    "name": "display_name"
  },
  "request": {
    "group_id": "party_id",
    "party_size": 4,
    "is_reserved": false,
    "table_preference": "window | bar | booth | none",
    "requested_time": "2025-01-15T19:30:00Z"
  },
  "floor_map_version": "v2.1"
}
```

### 3.4 UI Output (JSON)
```json
{
  "route_id": "route_id",
  "routed_table": {
    "table_id": "table_07",
    "section": "section_a"
  },
  "routed_waiter": {
    "waiter_id": "waiter_03",
    "waiter_name": "display_name"
  },
  "routed_cleaner": {
    "cleaner_id": "cleaner_01"
  }
}
```

---

## 4. Host iPad App

### 4.1 Live Floor Plan
- Real-time table states from CV (color-coded: green = clean, red = occupied, yellow = dirty)
- Customizable digital floor plans with table types (regular, high-top, counter, bar, outdoor)
- Table merging/combining support
- Server section visualization and management
- Dining area management (open/close sections on the fly)
- Table blocking (remove specific tables from availability)

### 4.2 Seat Party Flow
- "Seat Party" button → input party size + seating preference
- System recommends optimal table + auto-assigns waiter based on routing algorithm
- One-tap confirm to seat

### 4.3 Waitlist Management
- Walk-in waitlist with real-time position tracking
- **Predictive wait times with per-table granularity**: CV sees table 7 is on dessert (~12 min), table 12 just got entrees (~40 min) — gives actual per-table availability estimates instead of generic "20-30 minutes"
- SMS notification to guest when table is ready
- Walk-in to waitlist conversion
- Party size limits and customization

### 4.4 Service Pacing Timeline
- Per-table visual timeline of the dining experience
- CV-detected checkpoints: party seated → POS order placed → food arrives at table → plates cleared → payment processed
- Automatic, no manual input required — camera handles the tracking
- Helps host and manager see where every table is in its journey

---

## 5. Server / Cleaner / Busser Views

### 5.1 Server View
- Task queue: next table to serve
- Personal stats: tables served, tips earned, performance score
- Push notifications for new table assignments
- Shift earnings tracker
- Section overview

### 5.2 Cleaner / Busser View
- Task queue: next table to clean (auto-populated from CV dirty detection)
- Push notifications the moment a table goes dirty
- Personal stats: tables cleared, avg clear time

*UI follows Toast-style patterns — no need to reinvent the wheel on these views.*

---

## 6. Manager Dashboard + Intelligence

### 6.1 Shift Overview
- Current shift status — how things are going, key metrics at a glance
- Shift score: aggregate health indicator combining service pace, kitchen flow, table turns, revenue trajectory
- Active info and suggestions when relevant ("Section B is filling up fast", "Kitchen ticket times climbing")
- Staff performance snapshot for the current shift

### 6.2 Operational Analytics
- Performance broken down by hour, day, daypart, season
- Busiest periods, understaffed periods, overstaffed periods
- Historical comparisons (this week vs previous weeks, trend lines)
- Server performance: throughput, latency, check averages, tip percentages
- "1 strong server + 2 weak ones" type staffing insights
- Table turn rate and actual dwell time (from CV, not just check open/close)
- Cover tracking and forecasting

## 6.3 perhaps auto triees to find [people and contact when no show and the data enabled can cut intelligenyl but idk probvide suggestion ultimately allow manager to decide]

### 6.4 Post-Shift Auto-Debrief
- Auto-generated after every shift:
  - Total covers, revenue
  - Avg turn time vs historical benchmark
  - Best and worst performing servers (with data)
  - Kitchen bottleneck moments (when and where)
  - Service delay incidents
  - Table utilization summary
- Actionable recommendations for next similar shift
- Manager reads in 30 seconds instead of pulling reports for 20 minutes

### 6.5 Historical Shift Simulator
- Pull up any past shift and run "what if" scenarios:
  - "What if I had one fewer server?"
  - "What if I closed Section C at 8 PM?"
  - "What if I changed the floor plan layout?"
- Replays actual data with the hypothetical change applied
- Shows projected impact on revenue, labor cost, wait times, service quality
not like replaying live but like replahys metric undersands flow simulates gives user rundown of it basedon the data we store

### 6.6 Real-Time Labor Cost Per Cover
- Live metric: current labor spend per cover vs target
- Updates continuously throughout the shift
- Pairs with historical simulator to show how changes would have affected past shifts

### 6.7 RevPASH (Embedded Intelligence)
- Revenue per available seat hour calculated and tracked internally
- Feeds into: routing algorithm (prioritize seating high liked tables), post-shift debrief, simulator, menu pricing intelligence
- Not a standalone dashboard — it's an internal metric the intelligence layer uses to make better decisions
idk abt this one something like it but like not entirely

---

## 7. AI Chatbot (Manager Assistant)

- Natural language interface: "Who's my top performer?" "What are customers complaining about?" "How did we do on labor last Tuesday?"
- Lives across all restaurant data: POS transactions, CV analytics, scheduling, reviews, inventory, supplier data
- Can execute actions directly: "86 the avocado toast", "Cut a server from Friday's dinner shift"
- Proactive "For You" feed — surfaces insights and recommendations before you think to ask
- Personalized prompts based on your own data: menu change opportunities, staffing optimizations, marketing ideas
- Turns mountains of data into instant answers

---

## 8. Scheduling + Labor Management

### 8.1 AI Schedule Generation
- Forecasts demand from historical data (covers, revenue, day/time patterns, seasonal trends)
- Respects staff availability and preferences
- Builds fair schedules automatically — balances strong with weak servers, pairs new with experienced
- Warns proactively: "Friday dinner is short 2 servers"
- Factors in how many people to schedule based on historical cover data + forecast
- Considers server skills and experience levels for optimal shift composition

### 8.2 Shift Management
- **Staff shift exchange platform**: employees can swap and pick up shifts within the app, system validates that swaps maintain skill coverage and labor compliance
- Clock-in/out tracking with auto-detection and alerts
- No-show detection: if a scheduled employee doesn't show, system:
  - Sends automated messages/calls
  - Attempts to find replacement from available staff
  - Alerts manager
- Overtime tracking and prevention warnings

### 8.3 Labor Intelligence
- Historical analysis: how many covers last week, server analytics, staffing efficiency
- Recommendations based on actual vs needed staffing levels
- Labor cost forecasting per draft schedule before publishing
- Scheduling alone can consume hours weekly — this brings it to seconds

---

## 9. Inventory + Supplier Automation

### 9.1 Inventory Tracking
- Ingredient-level understanding tied to every menu item
- Know what's in each dish + buffer quantities + expected usage
- Track consumption based on POS sales: dishes sold → ingredients depleted
- What dishes people order → what ingredients are needed → in what quantity

### 9.2 Supplier Management
- Supplier notification integration — prevent forgetting to order
- AI-powered ordering suggestions with conservative reorder estimates
- Easy ordering interface from within the platform
- Track supplier reliability and pricing trends

### 9.3 Menu-Linked Intelligence
- Cross-utilization analysis: which ingredients serve multiple dishes
- Usage-based estimates of when items will run out at current pace
- Ingredient cost tracking tied to menu item profitability

---

## 10. Menu Intelligence

### 10.1 Performance Analytics
- Which items sell and which don't — by daypart, day of week, season
- Margin analysis per item (ingredient cost vs price)
- Trend detection: "Shrimp and grits sales up 20% this month"
- Item-level insights surfaced to chatbot and manager dashboard

### 10.2 Menu Optimization
- AI-driven menu wording optimization for higher conversion
- Item positioning and pricing suggestions based on performance data
- Identify underperformers to cut and stars to promote
- Intelligent grouping insights: which items pair well, which compete

---

## 11. Review Analytics

- Aggregate reviews across platforms (Yelp, Google, etc.)
- Sentiment analysis: what customers are praising, what they're complaining about
- AI-assisted review response drafting
- Trend tracking over time: "Service complaints up 30% on Friday nights"
- Surfaces actionable insights connected to operational data (review complaints → specific shifts, servers, or menu items)

---

## 12. Kitchen Intelligence

### 12.1 Order Coordination
- Smart back-of-house order preparation sequencing for maximum kitchen efficiency
- Intelligent grouping of dishes that use the same ingredients — optimizes workflow, reduces errors, cuts waste
- Timing coordination across stations

### 12.2 Kitchen ↔ Front-of-House Communication
- Pause seating button (one-tap from kitchen, auto-resumes when caught up)
- Order status visibility for servers
- Notifications on iPads and server devices

---

## 13. Notifications + Automation

- **Busser**: push notifications the instant a table goes dirty
- **Server**: notifications on new table assignments and routing changes
- **Manager**: alerts on shift issues (employee no-show, understaffing, momentum shifts)
- **Waitlist guests**: SMS when table is ready
- **Scheduling**: "Friday short-staffed" warnings when building schedules
- **No-show employees**: automated messaging + replacement shift fill attempts

---

## Future Features

### With POS / POS Integration
- Payment processing, credit card holds, deposits
- Full CRM / guest profiles (visit history, spend patterns, preferences, allergies, VIP status, special occasions)
- Reservation system (online booking, widgets, SMS reminders, deposits, no-show tracking, cancellation policies)
- Waitlist "Notify Me" feature for sold-out times
- Guest direct messaging
- Loyalty programs and membership rewards
- Full email/SMS marketing suite (campaigns, segmentation, win-back, birthday/anniversary)
- Voice AI phone answering and ordering
- Automated POS-driven table state updates (check closes → table opens)
- Tip pooling automation and payroll integration
- Guest tagging (auto and manual)
- Pre-shift guest highlight reports (VIPs, special requests, occasions)

### Future Intelligence
- Ready-to-order detection: CV detects customer body language (looking around, menu closed) → server notification
- Ready-for-check detection: CV detects plates cleared, leaning back → server notification
- Kitchen window dwell time: track how long plated food sits at expo before runner grabs it
- Busser/cleaner performance scoring: auto-track time-from-dirty-to-clean per person
- Hazard detection: CV identifies spills, obstructions, safety risks → staff alert
- Interaction time analysis: measure actual server-to-table engagement for Michelin-level service quality insights
- Predictive 86 alerts: POS order velocity + inventory → "Salmon runs out in ~40 minutes"
- Food waste tracking via kitchen camera (Winnow-style passive capture)
- Plate return analysis: camera at dish pit tracks which dishes come back uneaten
- Auto-generate HR documentation from operational data (no-shows, late clock-ins, performance scores → paper trail for terminations)
- Competitive menu pricing intelligence (track competitor menus and pricing changes)
- Reservation no-show prediction scoring (score each reservation's no-show probability for overbooking strategy)

### Way Later
- Automated resume review for hiring
- Auto-send offboarding documentation when employees leave
- Diner-facing app (discovery, loyalty, reviews from consumer side)

### Future POS Strategy
- Deploy Shire intelligence layer in restaurants, observe how managers interact with their existing POS daily
- Document every POS failure mode, friction point, and workaround
- Talk to customers — understand what's actually broken vs what we assume
- Build a native POS or acquire a small POS company based on real operational data and customer need
- Integrate with existing POS systems (Toast, Square, Clover) via their APIs where available in the meantime
- The intelligence layer comes first. The POS comes from a position of strength.
