
# Pending Build Tracks

Below is everything you've asked for so far, split into **Done** (already shipped in earlier turns) and **Pending** (still to build). I'll keep this list as the working backlog and tick items off as we complete them.

## Already done (for reference)
- Core schema: customers, products, inventory, orders, invoices, payments, purchases, deliveries
- RBAC: admin, manager, salesperson, driver, helper — with route guards, role-based landing, filtered nav
- Mobile + desktop responsive shell (sidebar, drawer, bottom tabs)
- Orders module + Add Sale flow
- Daily Demand: Pickup Summary (Sudha totals) + Per-Shop view for drivers/helpers
- Professional GST invoice: A4 PDF, thermal 80mm, WhatsApp share, UPI QR, amount-in-words
- Business identity + bank/UPI in Settings, Team role management
- Auto ledger: DB triggers recompute invoice totals and customer outstanding on create/edit/void
- Delivery "Collect Cash" (cash/UPI/bank) with auto-ledger update
- Customer ledger bar + dues filter + WhatsApp/SMS/Email/Call reminders
- Dashboard "Add Sale" + "New Invoice" quick toggles
- Dev quick-login panel for all 5 roles
- Challan OCR upload → AI extract → review → create purchase + stock movement

## Pending tracks

### 1. Retailer customer portal (separate login)
- Separate signup/login surface for retailers
- Retailer sees: their orders, invoices (view + download PDF), payment history, current outstanding, statement
- "Place order" form so retailers can self-submit orders (goes into your orders queue for approval)
- WhatsApp/email invite flow so you can onboard existing retailers

### 2. Deep reports + ledgers
- Sales register, purchase register
- Customer ledger (statement of account, date range, PDF/Excel export)
- Supplier ledger
- GSTR-1 style output (B2B, B2C, HSN summary)
- P&L summary and expense tracking
- Daily collection report (cash/UPI/bank split, per delivery staff)
- Best-selling products, top customers, aging report (0–30, 30–60, 60–90, 90+)
- Export to PDF and Excel across all reports

### 3. Supplier management (Sudha + others)
- Suppliers CRUD with GSTIN, contact, opening balance
- Supplier ledger + outstanding
- Record payments to supplier (against challan/purchase)
- Link challan OCR purchases to supplier ledger automatically

### 4. Route planning & delivery sheets
- Assign retailers to routes and a route to a vehicle/driver-helper pair for a given day
- Ordered delivery sheet per route (printable), with per-shop items, amount, and outstanding
- Driver marks delivered / partially delivered / not delivered per stop
- Partial delivery auto-edits the invoice (line-item adjustment) and re-syncs the ledger

### 5. Payments enhancements
- Payment allocation across multiple invoices (FIFO or manual pick)
- Receipt voucher (printable/WhatsApp) on every payment
- UPI intent deep-link + "mark as paid" webhook-free flow

### 6. Dashboard depth (deferred earlier — pick up later)
- Sales & collection trend charts
- Today's snapshot: orders, dispatched, collected, pending
- Top 10 customers by dues, top 10 SKUs by volume
- Low-stock and expiry alerts

### 7. Notifications & reminders (scheduled)
- Nightly cron: dues reminder to shops crossing due date via WhatsApp/SMS/Email
- Invoice send-on-create toggle (auto WhatsApp the PDF link)
- Delivery ETA ping to retailer when driver marks "out for delivery"

### 8. Inventory hygiene
- Batch / expiry tracking (dairy is perishable — FIFO by expiry)
- Stock adjustment voucher (damage, return-to-supplier, sample)
- Retailer product return flow (credit note + ledger reversal)
- Low-stock threshold + reorder suggestion into the pickup summary

### 9. Data hygiene & ops
- Audit log (who edited which invoice / voided / changed role)
- Soft delete + restore for invoices, orders, customers
- Bulk import (customers, products, opening balances) via CSV
- Daily automatic backup export (JSON/CSV to storage)

### 10. Retailer/portal comms polish
- Branded invoice PDF (logo, signature image, seal)
- Configurable invoice number series per financial year
- e-Invoice / IRN placeholder fields (for future GSTN integration)

---

## How I'd like to proceed
There's a lot here, so I'd rather do 1–2 tracks per round, deeply, than sprinkle everything shallowly. My suggested next order (based on your business flow):

1. **Retailer customer portal** (unblocks self-service + reduces your calls)
2. **Supplier management + link to Challan OCR** (closes the purchase side)
3. **Route planning & delivery sheets** (biggest daily pain point)
4. **Deep reports + ledgers** (needed for GST filing and dues control)
5. Everything else after

Tell me which track to build next (or reorder), and I'll come back with a focused plan just for that track.
