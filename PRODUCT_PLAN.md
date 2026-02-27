# Dreamhouse: Product Plan and Implementation Outline

## Section 1: Product Definition

### 1.1 Positioning

Dreamhouse is an AI powered home discovery engine that lets buyer agents describe their client's dream home in natural language and instantly surfaces matching on market, recently sold, and off market properties with a likelihood to transact score.

### 1.2 Ideal Customer Profile and Primary User Story

**ICP:** Buyer agents and luxury brokers working $500K+ residential transactions in competitive markets where off market inventory is a differentiator. Teams of 1 to 10 agents at independent brokerages or boutique firms.

**Primary user story:** As a buyer agent, I open Dreamhouse, type or speak "My client wants a mid century modern 4 bed, pool, guest house, quiet street in Scottsdale under $2M, they love open floor plans with walls of glass" and get back a ranked list of 20 to 50 properties across on market, recently sold, and off market inventory, each with a match score and likelihood to transact score, so I can build a shortlist in 5 minutes instead of 5 hours.

### 1.3 Five Core Jobs to Be Done

1. **Source hidden inventory.** Find off market homes that match a buyer profile before other agents know about them.
2. **Match by style and vibe, not just filters.** Describe architectural style, feel, and lifestyle fit in natural language and get properties that actually match.
3. **Prioritize outreach.** Know which off market homeowners are most likely to sell in the next 6 to 12 months so the agent focuses time on high probability conversations.
4. **Build buyer presentations fast.** Generate a curated property shortlist with match reasoning to share with clients.
5. **Track new matches over time.** Get alerts when new inventory or off market signals match a saved buyer profile.

### 1.4 Key Product Constraints and Compliance Assumptions

1. **No scraping.** Zero data ingestion from Zillow, Redfin, or Google Maps UI pages. Only licensed APIs, public records, and MLS feeds.
2. **MLS compliance.** MLS data displayed only to licensed agents with proper IDX/RETS authorization. No consumer facing MLS data without broker consent.
3. **Privacy.** Homeowner contact data sourced only from public records or licensed providers. No CCPA/state privacy law violations. Opt out mechanisms required for any outreach features.
4. **Outreach compliance.** No automated cold calls or texts to numbers on Do Not Call lists. Any outreach features must comply with TCPA, CAN SPAM, and state level regulations.
5. **B2B only at MVP.** No consumer accounts. Agent must authenticate with a verified real estate license or brokerage affiliation.
6. **Market by market rollout.** Each market is a configuration, not a code change. Data completeness requirements must be met before a market goes live.

---

## Section 2: Multi Phase Roadmap

### Phase 0: Concierge MVP

**Goal:** Validate demand with a manual backend and AI powered frontend. Prove agents will pay for intent based matching before building full automation.

**Entry criteria:** Founding team assembled. One target market selected. Initial data agreements in progress.

**Exit criteria:** 10 paying pilot agents. 50+ buyer profiles processed. Qualitative signal that match quality exceeds what agents find on their own.

#### Primary user workflows
1. Agent signs up and verifies license.
2. Agent types a natural language buyer description into a chat style interface.
3. AI parses the description into structured intent (style, budget, location, features).
4. Backend team manually curates and ranks a property list using available data.
5. Agent receives results in app within 24 hours, gives feedback.
6. Agent can save buyer profiles and request refreshes.

#### Data required and sourcing
1. **County assessor and parcel data.** Source from county open data portals or ATTOM Data (licensed API).
2. **Recent sales history.** County recorder filings, available via public records bulk download or ATTOM.
3. **On market listings.** Manual MLS search by team (agents on founding team have MLS access) or Spark API / Bridge Interactive if available.
4. **Property photos.** Link out to Zillow/Redfin listing pages. Do not scrape or store their images.

#### Minimal UI surfaces
1. **Login / license verification page.**
2. **Buyer profile creation page.** Single large text input. AI assisted extraction of intent shown below as editable tags. No dropdown filters.
3. **Results feed.** Airbnb style card grid. Each card shows photo (from licensed source or street view via Google Street View API, which is a licensed API), address, key stats, match score, likelihood to transact badge. Cards link out to Zillow/Redfin for full listing detail.
4. **Saved searches / alerts settings.**

#### Core backend services
1. **Auth service.** Email/password plus license verification (manual for Phase 0).
2. **Intent parser.** Claude API call to extract structured buyer intent from natural language.
3. **Manual matching queue.** Internal tool for team to see parsed intents and curate property lists.
4. **Property data store.** Postgres with basic property records from county data.
5. **Notification service.** Email when results are ready.

#### Metrics to prove success
1. 10+ agents paying $99/mo or equivalent pilot fee.
2. Average match quality rating >= 4/5 from agent feedback.
3. Time to shortlist < 1 hour (vs agent self reported baseline of 3 to 8 hours).
4. 60%+ of agents return to create a second buyer profile within 30 days.

---

### Phase 1: Single Market App

**Goal:** Automate the matching pipeline end to end for one market. Remove manual curation. Ship the real product.

**Entry criteria:** Phase 0 exit criteria met. Licensed data agreements signed for target market. MLS data feed or API access secured.

**Exit criteria:** 50+ paying agents. Fully automated results in < 60 seconds. Match quality parity with manual curation.

#### Primary user workflows
1. Agent types buyer description. AI parses and confirms intent.
2. Automated search runs across on market, recently sold, and off market property databases.
3. Results appear in < 60 seconds as a ranked card grid with match scores and likelihood to transact scores.
4. Agent can refine by conversation: "more modern, less suburban" and results re rank live.
5. Agent saves profile. Automated alerts fire when new matches appear.
6. Agent clicks a property card to expand details or clicks "View on Zillow" / "View on Redfin" to see full listing.

#### Data required and sourcing
1. **County assessor/parcel/sales.** ATTOM Data API (licensed). Covers property characteristics, tax assessments, sale history, ownership.
2. **MLS feed.** Spark API (FBS Data) or Bridge Interactive RESO Web API for on market listings. Requires broker of record relationship.
3. **Property photos.** Licensed from MLS feed (for on market). Google Street View Static API (licensed, $7/1000 requests) for off market exterior shots.
4. **Permit data.** County building department open data portals. Indicates recent renovations (signal for style matching and likelihood to sell).
5. **Mortgage and lien records.** ATTOM or county recorder. Signals financial motivation to sell.

#### Minimal UI surfaces
1. **Home / search page.** Centered hero with large AI text input: "Describe your buyer's dream home." Below: recent searches, saved buyer profiles.
2. **Results page.** Split view: card grid on left (Airbnb style, 3 columns), optional map on right (Mapbox GL JS, licensed). Cards show: photo, address, price or estimated value, match score (0 to 100), likelihood to transact badge (Low / Medium / High), property type, key features matched.
3. **Property detail panel.** Slides in from right. Shows: all property data, match explanation ("Matched because: mid century modern, pool, 4 bed, 0.3 mi from buyer's target area"), comparable sales, ownership duration, links to Zillow/Redfin.
4. **Buyer profile manager.** List of saved profiles with alert toggle.
5. **Settings.** Account, subscription, market selection, notification preferences.

#### Core backend services
1. **Intent parsing service.** Claude API. Converts natural language to structured query: style, features, location polygon, budget range, lifestyle tags.
2. **Property search service.** Elasticsearch or Typesense index over property database. Supports geo queries, attribute filters, full text.
3. **Match scoring service.** Computes match score per property against parsed intent. Rule based v0.
4. **Likelihood to transact scoring service.** Computes sell probability from ownership duration, equity, life events, permit activity. Rule based v0.
5. **Data ingestion pipeline.** Scheduled jobs to pull ATTOM data, MLS feed, county records. Normalize into unified property schema.
6. **Alert service.** Cron job compares new/changed properties against saved profiles. Sends push notifications and emails.
7. **Subscription and billing service.** Stripe integration. Per seat monthly pricing.

#### Metrics to prove success
1. 50+ paying agents ($149/mo per seat).
2. Automated match quality >= 4/5 (matching Phase 0 manual quality).
3. P95 query response time < 5 seconds.
4. 2+ buyer profiles per agent per month average.
5. 30% of agents report sourcing a deal through Dreamhouse within 90 days.

---

### Phase 2: Multi Market Expansion

**Goal:** Prove the model works in 3 to 5 markets with different data characteristics. Build repeatable market launch playbook.

**Entry criteria:** Phase 1 exit criteria met. Market launch checklist documented. Data agreements templated.

**Exit criteria:** 5 markets live. 200+ paying agents. Market launch time < 4 weeks per new market.

#### Primary user workflows
1. All Phase 1 workflows, plus:
2. Agent selects market from dropdown or AI infers from description.
3. Agent can run cross market searches ("Find me something like this but in Austin").
4. Agent can compare properties across markets side by side.

#### Data required and sourcing
1. **National property dataset.** ATTOM Data national license or CoreLogic (evaluate cost/coverage tradeoff).
2. **Market specific MLS feeds.** One MLS agreement per market. Target markets with RESO Web API support.
3. **Pre foreclosure and distressed data.** ATTOM foreclosure module. Adds off market supply.
4. **Demographic and neighborhood data.** Census Bureau ACS (free). Walk Score API (licensed). School data from GreatSchools API (licensed).

#### Minimal UI surfaces
1. Phase 1 UI, plus:
2. **Market selector** in nav bar.
3. **Cross market comparison view.**
4. **Market health dashboard** showing data freshness and coverage per market.

#### Core backend services
1. Phase 1 services, plus:
2. **Market configuration service.** Per market settings: data sources, MLS feed config, geo boundaries, scoring weights.
3. **Data quality monitoring.** Alerts when a market's data falls below freshness or coverage thresholds.
4. **Multi tenant search.** Market partitioned Elasticsearch indices.

#### Metrics to prove success
1. 200+ paying agents across 5 markets.
2. New market launch in < 4 weeks.
3. Data coverage >= 90% of residential parcels in each market.
4. Agent retention > 70% at 6 months.

---

### Phase 3: Brokerage and Enterprise

**Goal:** Sell team and brokerage licenses. Add CRM integrations and team collaboration features.

**Entry criteria:** Phase 2 exit criteria met. Inbound demand from brokerages. Team workflow gaps identified from agent feedback.

**Exit criteria:** 5 brokerage contracts ($1K+/mo). Team features shipped. CRM integration with at least 1 major platform (Follow Up Boss, KVCore, or similar).

#### Primary user workflows
1. All Phase 2 workflows, plus:
2. Brokerage admin creates team, invites agents, manages billing.
3. Agents share buyer profiles and results within team.
4. "Push to CRM" button sends a property and buyer match to the agent's CRM.
5. Brokerage admin sees team activity dashboard.

#### Data required and sourcing
1. Phase 2 data, plus:
2. **CRM integration data.** API connections to Follow Up Boss, KVCore, Sierra Interactive.
3. **Agent transaction history.** Voluntary upload or MLS agent production data (where available) for personalizing recommendations.

#### Minimal UI surfaces
1. Phase 2 UI, plus:
2. **Team management page.** Invite, roles, permissions.
3. **Shared workspace.** Team feed of buyer profiles and matches.
4. **CRM integration settings.**
5. **Admin dashboard.** Usage, billing, team activity.

#### Core backend services
1. Phase 2 services, plus:
2. **Team and org management service.** Multi tenant with role based access.
3. **CRM integration service.** Outbound API connectors to CRM platforms.
4. **Activity audit log.** Every search, view, and export logged for compliance.

#### Metrics to prove success
1. 5+ brokerage contracts.
2. 500+ total paying agent seats.
3. ARR > $500K.
4. CRM integration adoption > 40% of team users.

---

### Phase 4: Data Moat and Model Improvement

**Goal:** Build proprietary data and ML models that compound over time. Transition from rule based scoring to trained models.

**Entry criteria:** Phase 3 exit criteria met. 1000+ buyer profiles with feedback data collected. Sufficient ground truth for model training.

**Exit criteria:** ML models outperform rule based scores by measurable margin. Proprietary data signals generating unique matches competitors cannot replicate.

#### Primary user workflows
1. All Phase 3 workflows, plus:
2. Agent marks outcomes: "client toured this," "client made offer," "deal closed."
3. System learns from outcomes to improve match and likelihood scores.
4. Agent sees "Similar to deals you've closed" personalized recommendations.
5. Predictive alerts: "3 homes in your client's target area likely to list in next 60 days."

#### Data required and sourcing
1. Phase 3 data, plus:
2. **Agent outcome data.** Collected through the app (tour, offer, close feedback).
3. **Proprietary style embeddings.** Trained on property photos and descriptions to match "vibe" beyond keywords.
4. **Owner behavior signals.** Permit pulls, refinance activity, estate/probate filings. All from licensed/public sources.

#### Minimal UI surfaces
1. Phase 3 UI, plus:
2. **Outcome feedback flow.** Quick buttons on each property card: toured, offered, closed, not interested.
3. **Agent performance insights page.**
4. **Predictive alerts feed.**

#### Core backend services
1. Phase 3 services, plus:
2. **ML training pipeline.** Feature store, model training, A/B test framework.
3. **Style embedding service.** Vision model that encodes property photos into style vectors for similarity search.
4. **Outcome tracking service.** Records agent feedback for model training ground truth.

#### Metrics to prove success
1. ML match score correlation with agent feedback > 0.7 (vs rule based baseline).
2. Likelihood to transact model AUC > 0.75.
3. 30% of matches sourced from proprietary signals not available in any competing product.
4. Agent reported time savings > 70% vs pre Dreamhouse workflow.

---

## Section 3: Data Strategy

### 3.1 Candidate Legal Data Sources

| Source | Provides | Licensing | Approx Cost |
|---|---|---|---|
| **ATTOM Data** | Parcel, assessor, sales, ownership, foreclosure, mortgage, AVM | Licensed API, per record or bulk | $500 to $5K/mo depending on volume |
| **CoreLogic** | Similar to ATTOM, larger coverage in some markets | Licensed API or bulk | Enterprise pricing, typically higher than ATTOM |
| **Spark API (FBS Data)** | MLS listings via RESO Web API | Requires broker of record, per MLS board | Varies by MLS, $50 to $500/mo per feed |
| **Bridge Interactive** | MLS listings via RESO Web API | Requires broker of record | Similar to Spark |
| **Trestle (CoreLogic)** | MLS listings via RESO Web API | Requires broker of record | Varies |
| **County open data portals** | Parcel, assessor, permits, recorded documents | Public, free | Free (engineering cost to normalize) |
| **Google Street View Static API** | Exterior property photos | Licensed API | $7 per 1,000 requests |
| **Mapbox** | Maps, geocoding, routing | Licensed API | Free tier, then usage based |
| **Census Bureau ACS** | Demographics, income, population | Public, free | Free |
| **Walk Score API** | Walkability, transit, bike scores | Licensed API | Free tier available, then $0.01/request |
| **GreatSchools API** | School ratings and boundaries | Licensed API | Free for qualified apps |
| **USPS NCOA** | National Change of Address (move signals) | Licensed | ~$0.01/record |

### 3.2 First Market Plan: Parcel, Assessor, and Sale History

**Recommended first market: Scottsdale / Phoenix metro.**

Reasoning: strong luxury market, relatively consolidated county data (Maricopa County), ATTOM has excellent coverage, and the MLS (Arizona Regional MLS, ARMLS) supports RESO Web API.

1. **Parcel and assessor data.** Maricopa County Assessor publishes bulk data downloads (free). Supplement with ATTOM API for standardized fields.
2. **Sale history.** Maricopa County Recorder filings (free bulk download). Cross reference with ATTOM for cleaned sale records.
3. **Initial data load.** Bulk download county data, normalize into property schema, enrich with ATTOM API for missing fields. Target: 100% parcel coverage in target ZIP codes.
4. **Ongoing refresh.** Nightly ATTOM API poll for new recordings. Weekly county data re download as backup.

### 3.3 MLS Access and Fallback

**Primary path:**
1. Establish broker of record relationship (founding team member or partner broker holds license).
2. Apply to ARMLS for IDX/RETS or RESO Web API data feed.
3. Ingest active, pending, and recently sold listings into property database.
4. Display to authenticated, licensed agents only (MLS compliance).

**Fallback if MLS is not available:**
1. Use ATTOM "For Sale" and "Recently Sold" data modules. Less real time than MLS but covers most markets.
2. Partner with agents who manually flag on market properties.
3. Focus MVP differentiation on off market and recently sold, where MLS is not required.
4. Continue pursuing MLS access in parallel.

### 3.4 Linking Out to Zillow and Redfin Safely

1. **Construct links from address.** Build Zillow URLs using `https://www.zillow.com/homes/{address}`. Build Redfin URLs using `https://www.redfin.com/search?q={address}`. These are standard search URLs, not API calls.
2. **"View on Zillow" / "View on Redfin" buttons.** Open in new tab. No iframe embedding. No data extraction from the destination page.
3. **No backfill.** Never use the content of those pages to populate Dreamhouse data fields.
4. **Attribution.** If displaying any data that could be confused with Zillow/Redfin data, clearly label the actual source (county records, MLS, ATTOM).

---

## Section 4: Scoring Models

### 4.1 Match Score (0 to 100)

How well a property fits the buyer's described intent.

#### Feature inputs
1. **Location match.** Distance from target area centroid or polygon overlap.
2. **Budget match.** Property value or list price vs buyer budget range.
3. **Bedroom/bathroom count match.** Exact or within tolerance.
4. **Square footage match.** Within buyer's range or inferred range.
5. **Lot size match.** If specified.
6. **Style match.** Architectural style keyword match (mid century, craftsman, contemporary, etc.).
7. **Feature match.** Pool, guest house, garage, view, etc. Binary or partial match.
8. **Neighborhood match.** School quality, walkability, proximity to amenities if specified.

#### Baseline rule based model (MVP)
```
match_score = (
    location_weight * location_score(distance) +
    budget_weight * budget_score(price, budget) +
    beds_weight * beds_score(actual, desired) +
    sqft_weight * sqft_score(actual, desired) +
    style_weight * style_score(property_style, desired_styles) +
    features_weight * features_score(property_features, desired_features)
)
```
Weights: location 25, budget 20, style 20, features 15, beds/baths 10, sqft 10.

Each sub score is 0 to 100. Location decays linearly from 100 at center to 0 at max radius. Budget is 100 if within range, linear decay if over. Style is 100 for exact match, 50 for related styles, 0 for no match. Features is percentage of desired features present.

#### v1 ML approach (Phase 4)
1. **Training data.** Agent feedback on match quality (thumbs up/down, star rating) plus outcome data (toured, offered, closed).
2. **Model.** Gradient boosted trees (XGBoost or LightGBM). Features: all rule based inputs plus property photo embeddings (CLIP), description embeddings, neighborhood features.
3. **Output.** Predicted probability of "good match" calibrated to 0 to 100 score.

#### Evaluation and improvement
1. Track agent feedback (explicit ratings on each result).
2. Track downstream actions (saved, shared with client, toured, offered).
3. Compute NDCG@10 for ranked results vs agent feedback.
4. A/B test new model versions against rule based baseline.

---

### 4.2 Likelihood to Transact Score (Low / Medium / High)

Probability that a homeowner would consider selling in the next 6 to 12 months.

#### Feature inputs
1. **Ownership duration.** Years since last sale. Longer = more likely to move (national median is ~8 years).
2. **Equity position.** Estimated equity = current AVM minus mortgage balance. High equity = more flexibility to sell.
3. **Life event signals.** Divorce filings (court records, public), probate/estate filings, pre foreclosure notices.
4. **Permit activity.** Recent permits could mean preparing to sell or could mean settling in. Nuanced signal.
5. **Tax delinquency.** Overdue property taxes signal financial stress.
6. **Absentee owner.** Owner mailing address differs from property address. Often indicates rental or second home, more likely to sell.
7. **Property age and condition.** Older homes without recent permits may be candidates for teardown/rebuild buyers.
8. **Market conditions.** Local inventory levels, price trends, days on market averages.

#### Baseline rule based model (MVP)
```
Points system (0 to 100):
  Ownership > 10 years: +20
  Ownership > 15 years: +10 (additional)
  Absentee owner: +15
  High equity (>50% LTV): +10
  Tax delinquent: +15
  Pre foreclosure filing: +25
  Probate/estate filing: +20
  Divorce filing: +15
  Recent permit (renovation): +5
  No recent permit + home > 30 years: +10

Thresholds:
  0 to 30: Low
  31 to 60: Medium
  61 to 100: High
```

#### v1 ML approach (Phase 4)
1. **Training data.** Properties that actually listed or sold (positive class) vs those that did not (negative class) within 12 month windows.
2. **Model.** Logistic regression or gradient boosted trees. Features: all rule based inputs plus seasonality, neighborhood turnover rate, comparable sale velocity.
3. **Output.** Calibrated probability. Threshold into Low/Medium/High.
4. **Challenge.** Class imbalance (most homes don't sell in any given year). Use appropriate sampling or weighting.

#### Evaluation and improvement
1. Track predictions vs actual outcomes (did the property list or sell within 12 months?).
2. Compute AUC ROC and precision/recall at each threshold.
3. Agent feedback: "I contacted this owner and they said X" provides qualitative ground truth.
4. Retrain quarterly as outcome data accumulates.

---

## Section 5: System Design

### 5.1 Frontend

**Stack:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, Mapbox GL JS.

**Design philosophy:** Airbnb inspired. Clean, image forward, minimal chrome. No filter dropdowns. The primary interaction is a large AI text input. Results are a visual card grid. Minimal clicks to value.

**Key pages:**
1. **Home.** Hero with centered AI input: "Describe your buyer's dream home..." Below: saved buyer profiles as cards. Recent searches.
2. **Results.** Split layout. Left: scrollable card grid (3 col desktop, 1 col mobile). Right: Mapbox map with property pins. Cards: hero photo, address, price/estimate, match score badge, likelihood to transact badge, 2 to 3 matched feature tags. Click card to expand.
3. **Property detail.** Slide over panel or full page. Photo gallery, all data fields, match explanation, comparable sales, "View on Zillow" / "View on Redfin" buttons, "Save" and "Share" actions.
4. **Buyer profiles.** List view of saved searches. Each shows parsed intent summary, alert status, last run date, result count.
5. **Settings.** Account, team (Phase 3), subscription, market selection.
6. **Auth.** Login, signup, license verification upload.

### 5.2 Backend

**Stack:** Node.js (Fastify or Express), TypeScript, PostgreSQL, Elasticsearch, Redis, Bull MQ for job queues.

**Services:**

1. **API Gateway.** Auth middleware (JWT), rate limiting, request validation.
2. **Auth service.** Signup, login, JWT issuance, license verification status.
3. **Intent parsing service.** Accepts natural language text, calls Claude API, returns structured intent JSON.
4. **Search service.** Accepts structured intent, queries Elasticsearch, applies match scoring, returns ranked properties.
5. **Scoring service.** Computes match score and likelihood to transact score. Called by search service per result.
6. **Property data service.** CRUD for property records. Serves property detail API.
7. **Alert service.** Manages saved search subscriptions. Runs matching on new data arrivals.
8. **Billing service.** Stripe integration for subscriptions.
9. **Notification service.** Email (SendGrid or Postmark), push notifications (future).
10. **Admin service.** Internal endpoints for market configuration, data quality monitoring.

**High level database schema (PostgreSQL):**

```
markets
  id, name, slug, state, geo_boundary (PostGIS), config (JSONB), active, created_at

properties
  id, market_id, parcel_id, address, city, state, zip, lat, lng,
  bedrooms, bathrooms, sqft, lot_sqft, year_built, property_type,
  architectural_style, features (JSONB), last_sale_date, last_sale_price,
  estimated_value, owner_name, owner_mailing_address, absentee_owner,
  ownership_years, equity_estimate, tax_status, permit_history (JSONB),
  listing_status (on_market | off_market | recently_sold),
  listing_price, mls_number, photo_urls (JSONB array),
  data_sources (JSONB), updated_at, created_at

buyer_profiles
  id, agent_id, raw_text, parsed_intent (JSONB), market_id,
  alert_enabled, last_run_at, created_at

search_results
  id, buyer_profile_id, property_id, match_score, transact_score,
  match_explanation (JSONB), created_at

agents
  id, email, name, brokerage, license_number, license_state,
  license_verified, subscription_status, stripe_customer_id,
  team_id, role, created_at

teams
  id, name, brokerage, admin_agent_id, created_at
```

### 5.3 Data Ingestion Pipeline

1. **Scheduled ingest jobs (Bull MQ).** Per market, per data source.
   - `ingest:attom:properties` runs nightly. Pulls new/updated records. Upserts into `properties` table.
   - `ingest:mls:listings` runs every 15 minutes. Pulls active/pending/sold listings. Upserts and updates `listing_status`.
   - `ingest:county:permits` runs weekly. Pulls new permits. Updates `permit_history`.
   - `ingest:county:recordings` runs daily. Pulls new deed/mortgage recordings. Updates ownership and equity fields.

2. **Normalization layer.** Each data source has a source specific adapter that maps raw fields to the unified property schema.

3. **Elasticsearch sync.** After each Postgres upsert, sync changed records to Elasticsearch index. Use a change data capture (CDC) approach or post commit hook.

4. **Data quality checks.** After each ingest run, log record counts, field fill rates, error counts. Alert if any metric drops below threshold.

### 5.4 Search and Ranking

1. **Intent parsing.** Natural language text goes to Claude API. Returns JSON: `{ styles: [], features: [], budget: { min, max }, locations: [{ name, lat, lng, radius_miles }], beds: { min, max }, baths: { min, max }, sqft: { min, max }, lifestyle_tags: [] }`.
2. **Elasticsearch query construction.** Geo distance filter on location. Range filters on budget, beds, baths, sqft. No hard filter on style or features (these influence scoring, not filtering, to avoid empty results).
3. **Candidate retrieval.** Pull top 200 candidates from Elasticsearch.
4. **Scoring.** Apply match score and likelihood to transact score to each candidate.
5. **Ranking.** Sort by weighted combination: `0.7 * match_score + 0.3 * transact_score`. Return top 50.
6. **Match explanation.** For each result, generate a short explanation of why it matched (which features aligned, which didn't).

### 5.5 Job Queues and Batch Processing

**Bull MQ on Redis.**

Queues:
1. `data-ingest` queue for scheduled data pulls.
2. `search` queue for async search jobs (if real time latency is insufficient).
3. `alerts` queue for processing saved search alerts. Runs hourly.
4. `scoring` queue for batch re scoring when model weights change.
5. `export` queue for generating buyer presentation PDFs (Phase 3).

Each job is idempotent with retry logic. Dead letter queue for failed jobs.

### 5.6 Observability and Audit Logging

1. **Application logging.** Structured JSON logs (pino). Ship to Datadog or similar.
2. **Audit log table.** Every agent action logged: search, view, save, share, export. Columns: `agent_id, action, resource_type, resource_id, metadata (JSONB), ip_address, timestamp`.
3. **Data access logging.** Track which agent viewed which property's owner information (compliance requirement).
4. **Metrics.** Prometheus style metrics: query latency, match score distribution, data freshness per market, ingest error rates.
5. **Alerting.** PagerDuty or Opsgenie for: ingest failures, search latency > 10s, error rate > 1%.

---

## Section 6: MVP Build Plan (6 Weeks)

This plan targets Phase 0/1 hybrid: automated intent parsing with semi automated matching, shipping to first pilot agents.

### Week 1: Foundation

**Engineering tasks:**
1. Initialize Next.js project with TypeScript, Tailwind, ESLint.
2. Set up PostgreSQL database with initial schema (agents, markets, properties, buyer_profiles).
3. Set up Fastify API server with JWT auth.
4. Implement signup/login endpoints and basic auth flow.
5. Set up CI/CD pipeline (GitHub Actions, deploy to Vercel for frontend, Railway or Render for backend).

**Data tasks:**
1. Sign up for ATTOM Data API trial/dev account.
2. Download Maricopa County assessor bulk data.
3. Write normalization script for county data to property schema.
4. Load initial property records for target ZIP codes (start with 10 to 20 ZIPs in Scottsdale/Paradise Valley).

**UI tasks:**
1. Design system setup: typography, colors, spacing tokens in Tailwind config.
2. Build auth pages (login, signup, license upload).
3. Build app shell: nav bar, layout, responsive grid.

**Testing and validation:**
1. Schema validation tests for property data.
2. Auth flow end to end test.
3. Verify county data load: record count, field fill rate.

### Week 2: AI Intent Parsing and Buyer Profiles

**Engineering tasks:**
1. Build intent parsing service. Claude API integration. Prompt engineering for extracting structured intent from natural language home descriptions.
2. Build buyer profile CRUD endpoints.
3. Store parsed intent as JSONB alongside raw text.
4. Build intent confirmation UI: show extracted intent as editable tags below text input.

**Data tasks:**
1. Enrich property records with ATTOM API data (ownership, tax, sale history).
2. Compute derived fields: ownership_years, absentee_owner, equity_estimate.
3. Begin MLS access application for ARMLS.

**UI tasks:**
1. Build home page with hero AI input.
2. Build buyer profile creation flow: text input, intent extraction animation, tag review.
3. Build saved buyer profiles list page.

**Testing and validation:**
1. Test intent parsing with 20+ diverse natural language descriptions.
2. Validate extraction accuracy: does it correctly identify style, budget, location, features?
3. Edge case testing: vague descriptions, multiple locations, contradictory requirements.

### Week 3: Property Search and Match Scoring

**Engineering tasks:**
1. Set up Elasticsearch. Index all property records.
2. Build search service: intent to ES query translation.
3. Implement match scoring service (rule based v0).
4. Build search API endpoint: accepts intent, returns scored/ranked properties.

**Data tasks:**
1. Validate Elasticsearch index completeness against Postgres.
2. Add Google Street View Static API integration for property photos.
3. Source additional property photos from MLS (if access granted) or licensed photo providers.

**UI tasks:**
1. Build results page: card grid with property cards.
2. Property card component: photo, address, price, match score badge, feature tags.
3. Mapbox integration: property pins on map, card/map interaction.
4. Loading state and empty state for search.

**Testing and validation:**
1. Run 10 test buyer profiles through the full pipeline. Evaluate result quality manually.
2. Match score sanity check: do high scored properties actually match the intent?
3. Search latency benchmarking. Target: < 3 seconds for full pipeline.

### Week 4: Likelihood to Transact Scoring and Property Detail

**Engineering tasks:**
1. Implement likelihood to transact scoring service (rule based v0).
2. Add transact score to search results.
3. Build property detail API endpoint.
4. Build match explanation generator (why this property matched).

**Data tasks:**
1. Ingest permit data for target ZIP codes.
2. Ingest mortgage/lien data from ATTOM.
3. Flag pre foreclosure and tax delinquent properties.
4. Build nightly data refresh job for ATTOM data.

**UI tasks:**
1. Build property detail slide over panel.
2. Show match explanation, transact score explanation.
3. "View on Zillow" / "View on Redfin" outbound link buttons.
4. Save property action on card and detail view.

**Testing and validation:**
1. Validate transact score on known recently sold properties (should score High).
2. Validate transact score on known long term residents with no signals (should score Low).
3. End to end test: description to results to detail view.

### Week 5: Alerts, Refinement, and Polish

**Engineering tasks:**
1. Build saved search alert system: cron job, matching engine, notification dispatch.
2. Build conversational refinement: agent says "more modern" and results re rank.
3. Implement Stripe subscription billing.
4. Build license verification workflow (manual review queue for Phase 0).

**Data tasks:**
1. Set up automated MLS ingest (if access granted) or ATTOM listing data refresh.
2. Data freshness monitoring dashboard.
3. Expand ZIP code coverage within Scottsdale/Phoenix market.

**UI tasks:**
1. Alert settings per buyer profile.
2. Conversational refinement UI: second text input below results for follow up.
3. Subscription/billing page.
4. Empty states, error states, loading skeletons.
5. Mobile responsive pass.

**Testing and validation:**
1. Alert delivery test: add new matching property, verify alert fires.
2. Refinement test: does "more modern" actually re rank results toward modern properties?
3. Billing flow end to end test.
4. Cross browser testing (Chrome, Safari, Firefox).

### Week 6: Pilot Launch

**Engineering tasks:**
1. Security audit: auth, input validation, rate limiting, SQL injection prevention.
2. Performance optimization: query caching, image lazy loading, API response compression.
3. Deploy production environment.
4. Set up monitoring, alerting, error tracking (Sentry).

**Data tasks:**
1. Full data quality audit for launch market.
2. Verify all data source attributions are correct.
3. Verify no scraped data has entered the pipeline.
4. Document data refresh schedules and coverage.

**UI tasks:**
1. Final design polish pass.
2. Onboarding flow for new agents (brief tooltip tour).
3. Feedback mechanism: thumbs up/down on results for quality tracking.
4. Landing page / marketing site.

**Testing and validation:**
1. Load testing: 50 concurrent searches.
2. End to end smoke test of all user flows.
3. Invite 10 pilot agents. Gather day 1 feedback.
4. Compliance review: data usage, privacy policy, terms of service.

---

## Section 7: Risk Register

| # | Risk | Impact | Probability | Mitigation |
|---|---|---|---|---|
| 1 | **Data licensing cost exceeds budget.** ATTOM or CoreLogic pricing too high for startup stage. | High | Medium | Start with county open data (free) plus ATTOM dev tier. Negotiate startup pricing. Budget $2K/mo for data in year 1. Evaluate Regrid as lower cost alternative for parcel data. |
| 2 | **MLS access denied or delayed.** MLS boards can take months to approve and may reject non traditional apps. | High | High | Design MVP to work without MLS. Use ATTOM listing data as fallback. Focus differentiation on off market inventory where MLS is irrelevant. Pursue MLS access in parallel but do not block launch on it. |
| 3 | **Privacy law violations.** Displaying homeowner names and mailing addresses could violate CCPA or state privacy laws. | High | Medium | Only display owner info to licensed agents. Implement opt out mechanism. Consult real estate specific privacy attorney before launch. Do not enable any direct outreach features until legal review is complete. |
| 4 | **Outreach compliance.** If agents use Dreamhouse data for cold outreach, it could create TCPA/CAN SPAM liability. | High | Medium | Phase 0 and 1: no outreach features. Clearly state in ToS that Dreamhouse does not provide outreach tools. Future outreach features will require Do Not Call list scrubbing and explicit opt in. |
| 5 | **Model quality insufficient.** Rule based match scoring may not capture "vibe" or style well enough. | Medium | Medium | Invest heavily in intent parsing prompt engineering. Use Claude's understanding of architectural styles. Collect agent feedback aggressively. Plan for ML upgrade in Phase 4. Concierge fallback: human review of low confidence matches. |
| 6 | **User adoption too slow.** Agents may not trust a new tool or may not want to pay for it. | High | Medium | Start with warm intros to agents in target market. Offer 30 day free trial. Track time saved metric to demonstrate ROI. Build trust through match quality, not feature count. |
| 7 | **Zillow/Redfin linking breaks.** URL structures change or platforms block referral traffic. | Low | Low | Links are a convenience, not core functionality. If link format changes, update URL template. All property data comes from licensed sources, not from these platforms. |
| 8 | **Data staleness.** Properties sell or list and the database is out of date. | Medium | Medium | Real time MLS feed (15 min refresh) for on market. Daily ATTOM refresh for off market signals. Show "data as of" timestamps on every record. Alert agents when a match property has a status change. |
| 9 | **Single point of failure on Claude API.** Intent parsing depends entirely on Claude. | Medium | Low | Cache common intents. Build fallback to structured form input if API is down. Monitor API latency and error rates. Evaluate redundancy options. |
| 10 | **Team bandwidth.** Small team overcommits across data, engineering, and BD simultaneously. | High | High | Ruthlessly scope each phase. Do not start Phase 1 until Phase 0 exit criteria are met. Automate data pipeline early to free up time. Hire data engineer as first additional hire. |

---

## Section 8: Out of Scope for MVP

1. **Direct to consumer access.** MVP is B2B only for licensed agents.
2. **Automated outreach.** No cold email, text, or call features. No dialer integration.
3. **CRM integrations.** Deferred to Phase 3.
4. **Mobile native app.** Responsive web only. Native iOS/Android deferred.
5. **International markets.** US only.
6. **Commercial real estate.** Residential only.
7. **Property valuation / AVM.** Use third party estimates (ATTOM). Do not build proprietary AVM.
8. **Document management.** No offer writing, contract storage, or transaction management.
9. **Lead generation for sellers.** No seller facing features.
10. **Social features.** No agent to agent networking or marketplace.
11. **Scraping any third party website.** Explicitly forbidden, including for photos, descriptions, or pricing.
12. **Zillow/Redfin API usage.** Neither platform offers a public API for this use case. Do not attempt unofficial API access.
13. **Owner phone number or email lookups.** Deferred until legal review is complete. Phase 0/1 show name and mailing address from public records only.
14. **Automated property condition assessment.** No computer vision on property photos for condition scoring in MVP.
15. **Multi language support.** English only for MVP.
