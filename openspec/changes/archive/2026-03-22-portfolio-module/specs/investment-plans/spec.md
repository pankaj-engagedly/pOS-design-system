## ADDED Requirements

### Requirement: Investment plan CRUD
The system SHALL allow users to create, read, update, and archive investment plans. Each plan SHALL have: name, total_corpus (Numeric), start_date, end_date (optional), status (enum: active, completed, archived), and notes. A user can have multiple active plans simultaneously.

#### Scenario: Create investment plan
- **WHEN** user creates a plan with name "Q2 2026 Deployment", corpus ₹1,00,000, start_date 2026-04-01
- **THEN** system stores the plan with status "active" and returns it

#### Scenario: List active plans
- **WHEN** user requests investment plans
- **THEN** system returns all plans with summary stats: total_corpus, total_allocated, total_deployed, remaining, and allocation count

#### Scenario: Archive plan
- **WHEN** user archives a completed plan
- **THEN** system sets status to "archived" and the plan remains queryable but moves out of active views

### Requirement: Plan allocations
The system SHALL allow users to allocate portions of a plan's corpus to specific assets. Each allocation SHALL have: plan_id (FK), asset_identifier (ISIN or ticker), asset_name, asset_type (stock, mutual_fund, etf, gold, etc.), target_amount (Numeric), target_price (Numeric, optional — the buy-below trigger price), and priority (integer for ordering).

#### Scenario: Add allocation to plan
- **WHEN** user adds an allocation for "TCS" (ISIN INE467B01029) with target ₹20,000 and buy-below price ₹3,200
- **THEN** system stores the allocation linked to the plan

#### Scenario: Total allocation exceeds corpus
- **WHEN** sum of allocation target_amounts exceeds the plan's total_corpus
- **THEN** system allows it (over-allocation is a planning choice) but flags it in the response with an over_allocated field

#### Scenario: Allocation without target price
- **WHEN** user creates an allocation for a SIP MF with target ₹30,000 but no target_price
- **THEN** system stores it — target_price is optional (SIPs deploy at market NAV regardless)

#### Scenario: List allocations for plan
- **WHEN** user requests allocations for a plan
- **THEN** system returns all allocations with computed fields: deployed_amount (from deployment events), remaining_amount, deployment_count, and current_price (if available from watchlist/NAV cache)

### Requirement: Deployment events (ledger)
The system SHALL record every capital deployment as an immutable event. Each deployment event SHALL have: allocation_id (FK), event_date, amount (Numeric), units (Numeric, optional), price_per_unit (Numeric, optional), and notes. Deployment events SHALL NOT be editable or deletable — corrections are recorded as new events with negative amounts or notes.

#### Scenario: Record deployment
- **WHEN** user records deploying ₹10,000 into TCS allocation (bought 30 units @ ₹3,150)
- **THEN** system creates an immutable deployment event and updates the allocation's computed deployed_amount

#### Scenario: View deployment history for allocation
- **WHEN** user views deployment history for the TCS allocation
- **THEN** system returns all deployment events in chronological order, showing the running total of deployed amount

#### Scenario: Correct a deployment error
- **WHEN** user needs to correct a wrong deployment entry of ₹10,000 (should have been ₹5,000)
- **THEN** user records a new event with amount -₹5,000 and note "Correction: original entry was ₹10,000, actual was ₹5,000" — the original event remains unchanged

### Requirement: Plan revision events
The system SHALL record every plan modification as an immutable event. Revision events SHALL capture: plan_id, event_type (corpus_change, allocation_change, plan_note), previous_value, new_value, event_date, and notes. The current plan state is derived from the initial values plus all revision events.

#### Scenario: Increase plan corpus
- **WHEN** user increases plan corpus from ₹1,00,000 to ₹1,50,000 (adding fresh funds)
- **THEN** system records a revision event (corpus_change, previous=100000, new=150000), updates the plan's total_corpus, and the additional ₹50,000 is available for allocation

#### Scenario: Revise allocation target
- **WHEN** user increases TCS allocation from ₹20,000 to ₹30,000
- **THEN** system records a revision event (allocation_change) with previous and new values, and updates the allocation's target_amount

#### Scenario: View plan history
- **WHEN** user views the full history of a plan
- **THEN** system returns all revision events and deployment events in chronological order, showing how the plan evolved over time

### Requirement: Plan summary and progress
The system SHALL compute plan progress metrics: total_corpus, total_allocated (sum of allocation targets), total_deployed (sum of all deployment events), remaining (corpus - deployed), deployment_percentage, and per-asset-class breakdown.

#### Scenario: Plan dashboard
- **WHEN** user views a plan's summary
- **THEN** system returns: corpus, allocated vs unallocated, deployed vs remaining, per-allocation progress (deployed/target), and per-asset-class totals

#### Scenario: All plans summary
- **WHEN** user requests summary across all active plans
- **THEN** system returns aggregate: total corpus across plans, total deployed, total remaining, and per-asset-class allocation breakdown

### Requirement: Plan-to-portfolio linking
The system SHALL allow optional linking of deployment events to actual portfolio transactions. When a deployment is linked to a portfolio transaction_id, the system can verify planned vs actual amounts.

#### Scenario: Link deployment to transaction
- **WHEN** user records a deployment and links it to a portfolio transaction (from CAS import)
- **THEN** system stores the transaction_id reference on the deployment event

#### Scenario: Unlinked deployment
- **WHEN** user records a deployment without linking to a portfolio transaction (e.g., for stocks not yet in portfolio)
- **THEN** system stores the deployment event without a transaction link — this is valid for assets tracked only in the plan
