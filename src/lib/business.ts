// Business profile persisted to localStorage. Used by invoice header, QR, terms, bank block.
// Replace later with a `company_settings` DB table if the user wants multi-device sync.
// ✅ Test push from Arena agent — 2026-07-24

export type BusinessProfile = {
  name: string;
  legal_name?: string;
  gstin: string;
  fssai?: string;
  pan?: string;
  state?: string;
  state_code?: string; // 2-digit GST state code
  mobile: string;
  email: string;
  address: string;
  // Payment
  upi_vpa?: string; // e.g. dairyflow@okhdfcbank
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  bank_holder?: string;
  // Invoice
  terms?: string;
  invoice_prefix?: string;
};

const KEY = "dairyflow.business";

export const DEFAULT_BUSINESS: BusinessProfile = {
  name: "DairyFlow Distributors",
  legal_name: "DairyFlow Distributors Pvt Ltd",
  gstin: "07AAAAA0000A1Z5",
  fssai: "10012345000123",
  pan: "AAAAA0000A",
  state: "Delhi",
  state_code: "07",
  mobile: "+91 98100 00000",
  email: "hello@dairyflow.example",
  address: "Shop 12, Wholesale Dairy Market, New Delhi 110001",
  upi_vpa: "",
  bank_name: "HDFC Bank",
  bank_account: "50100XXXXXXXX",
  bank_ifsc: "HDFC0000000",
  bank_branch: "New Delhi",
  bank_holder: "DairyFlow Distributors",
  terms:
    "1. Payment due on delivery. Interest @18% p.a. on overdue.\n2. Goods once sold will not be taken back.\n3. Subject to Delhi jurisdiction.",
  invoice_prefix: "INV",
};

export function getBusiness(): BusinessProfile {
  if (typeof window === "undefined") return DEFAULT_BUSINESS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_BUSINESS;
    return { ...DEFAULT_BUSINESS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_BUSINESS;
  }
}

export function saveBusiness(b: BusinessProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(b));
}

// UPI intent string. Empty when no VPA configured.
export function upiIntent(opts: { payee: string; vpa?: string; amount: number; note: string }) {
  if (!opts.vpa) return "";
  const params = new URLSearchParams({
    pa: opts.vpa,
    pn: opts.payee,
    am: opts.amount.toFixed(2),
    cu: "INR",
    tn: opts.note,
  });
  return `upi://pay?${params.toString()}`;
}

// Google Chart-style QR image via public qrserver.com (no dependency).
export function qrImage(data: string, size = 160) {
  const encoded = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encoded}`;
}
