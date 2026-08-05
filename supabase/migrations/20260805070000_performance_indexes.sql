-- Performance indexes for frequently queried columns
-- These indexes eliminate full table scans on large datasets

-- Dashboard queries (invoice_date, payment_date filters)
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC);

-- Status-based filters (active products, routes, customers)
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_routes_active ON routes(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status) WHERE status = 'active';

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_invoices_customer_date ON invoices(customer_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_customer_date ON payments(customer_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

-- Foreign key indexes (speed up JOINs and CASCADE deletes)
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_invoice ON deliveries(invoice_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_route ON deliveries(route_id);

-- Product batch queries
CREATE INDEX IF NOT EXISTS idx_product_batches_product ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON product_batches(expiry_date) WHERE status = 'active';

-- Inventory movements for audit trail
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref ON inventory_movements(ref_type, ref_id);

-- Notification logs (for polling)
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status) WHERE status IN ('queued', 'failed');

-- Push subscriptions (for push notifications)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- App settings (singleton table, but good for lookup)
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
