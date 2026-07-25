// Universal share menu for invoices. Uses Web Share API (with PDF file when
// supported), and always offers WhatsApp / Email / SMS / Telegram / Copy link
// fallbacks so the user can send an invoice anywhere.
// Every action is recorded to `share_activity_logs` for compliance.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Share2,
  MessageCircle,
  Mail,
  MessageSquare,
  Send,
  Link as LinkIcon,
  Share,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { getBusiness } from "@/lib/business";
import { inr, shortDate } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

type Channel =
  | "whatsapp"
  | "email"
  | "sms"
  | "telegram"
  | "native"
  | "copy_link"
  | "copy_summary"
  | "download_pdf";

type Props = {
  invoice: any;
  items?: any[];
  itemsLoader?: () => Promise<any[]>;
  customer?: any;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
  label?: string;
  align?: "start" | "end";
};

export function InvoiceShareMenu({
  invoice,
  items,
  itemsLoader,
  customer,
  size = "sm",
  variant = "outline",
  label = "Share",
  align = "end",
}: Props) {
  const [busy, setBusy] = useState(false);
  const biz = getBusiness();
  const c = customer ?? invoice.customer;

  const url = typeof window !== "undefined" ? window.location.origin + `/invoices/${invoice.id}` : "";
  const summary =
    `*${biz.name}* — Tax Invoice\n` +
    `Invoice #: ${invoice.invoice_no}\n` +
    `Date: ${shortDate(invoice.invoice_date)}\n` +
    (c?.name ? `Bill to: ${c.name}${c.shop_name ? " · " + c.shop_name : ""}\n` : "") +
    `Amount: ${inr(invoice.total)}\n` +
    (Number(invoice.balance) > 0 ? `Balance due: ${inr(invoice.balance)}\n` : `Paid in full ✓\n`) +
    (biz.upi_vpa ? `\nPay via UPI: ${biz.upi_vpa}\n` : "") +
    `\nView: ${url}`;

  const logShare = async (channel: Channel, recipient?: string | null) => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const u = userRes?.user;
      await supabase.from("share_activity_logs").insert({
        invoice_id: invoice.id ?? null,
        invoice_no: invoice.invoice_no ?? null,
        customer_id: c?.id ?? invoice.customer_id ?? null,
        channel,
        recipient: recipient || null,
        user_id: u?.id ?? null,
        user_email: u?.email ?? null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      });
    } catch {
      // Non-blocking: never break sharing because logging failed
    }
  };

  const buildPdfFile = async (): Promise<File> => {
    const rows = items ?? (itemsLoader ? await itemsLoader() : []);
    const blob = buildInvoicePdf(invoice, rows);
    return new File([blob], `Invoice-${invoice.invoice_no}.pdf`, { type: "application/pdf" });
  };

  const nativeShare = async () => {
    setBusy(true);
    try {
      const file = await buildPdfFile();
      const nav = navigator as any;
      const data: any = {
        title: `Invoice ${invoice.invoice_no}`,
        text: summary,
        url,
      };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        data.files = [file];
      }
      if (nav.share) {
        await nav.share(data);
        await logShare("native");
      } else {
        await navigator.clipboard.writeText(summary);
        toast.success("Invoice details copied to clipboard");
        await logShare("copy_summary");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(e?.message ?? "Share failed");
    } finally {
      setBusy(false);
    }
  };

  const whatsapp = () => {
    const phone = (c?.mobile ?? "").replace(/[^\d]/g, "");
    const link = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(summary)}`
      : `https://wa.me/?text=${encodeURIComponent(summary)}`;
    window.open(link, "_blank", "noopener,noreferrer");
    void logShare("whatsapp", phone || null);
  };

  const email = () => {
    const to = c?.email ?? "";
    const subject = `Invoice ${invoice.invoice_no} from ${biz.name}`;
    const href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary)}`;
    window.location.href = href;
    void logShare("email", to || null);
  };

  const sms = () => {
    const phone = (c?.mobile ?? "").replace(/[^\d+]/g, "");
    const href = `sms:${phone}?&body=${encodeURIComponent(summary)}`;
    window.location.href = href;
    void logShare("sms", phone || null);
  };

  const telegram = () => {
    const link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(summary)}`;
    window.open(link, "_blank", "noopener,noreferrer");
    void logShare("telegram");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invoice link copied");
      await logShare("copy_link");
    } catch {
      toast.error("Copy failed");
    }
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Invoice summary copied");
      await logShare("copy_summary");
    } catch {
      toast.error("Copy failed");
    }
  };

  const downloadPdf = async () => {
    try {
      const rows = items ?? (itemsLoader ? await itemsLoader() : []);
      const blob = buildInvoicePdf(invoice, rows);
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `Invoice-${invoice.invoice_no}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
      await logShare("download_pdf");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate PDF");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} className="gap-1.5" disabled={busy}>
          <Share2 className="size-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel>Share invoice</DropdownMenuLabel>
        <DropdownMenuItem onClick={nativeShare}>
          <Share className="size-4 mr-2" /> Share via device…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={whatsapp}>
          <MessageCircle className="size-4 mr-2 text-green-600" /> WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={email}>
          <Mail className="size-4 mr-2 text-blue-600" /> Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={sms}>
          <MessageSquare className="size-4 mr-2" /> SMS
        </DropdownMenuItem>
        <DropdownMenuItem onClick={telegram}>
          <Send className="size-4 mr-2 text-sky-500" /> Telegram
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyLink}>
          <LinkIcon className="size-4 mr-2" /> Copy link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copySummary}>
          <LinkIcon className="size-4 mr-2" /> Copy summary
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadPdf}>
          <Download className="size-4 mr-2" /> Download PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
