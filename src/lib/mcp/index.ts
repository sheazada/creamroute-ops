import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCustomers from "./tools/list-customers";
import listProducts from "./tools/list-products";
import recentInvoices from "./tools/recent-invoices";
import dailyDemand from "./tools/daily-demand";
import pendingDeliveries from "./tools/pending-deliveries";
import markDeliveryCollected from "./tools/mark-delivery-collected";
import uploadPodProof from "./tools/upload-pod-proof";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "dairy-erp-mcp",
  title: "Dairy Distribution ERP",
  version: "0.1.0",
  instructions:
    "Read-only tools for the dairy distribution ERP. Every call runs as the signed-in user and is filtered by role: admin & manager can use all tools; salesperson can list customers, products, invoices, and daily demand; driver & helper can list customers, products, daily demand, and pending deliveries. Tools called by a role that isn't permitted return a friendly error explaining which roles are allowed.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCustomers, listProducts, recentInvoices, dailyDemand, pendingDeliveries],
});
