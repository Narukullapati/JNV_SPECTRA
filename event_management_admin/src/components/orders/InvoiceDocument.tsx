import { useState } from "react";
import QRCode from "react-qr-code";
import { Printer, Download, Loader2 } from "lucide-react";
import { fetchApi } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

const dstr = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "—";

export function InvoiceDocument({ order }: { order: any }) {
  const [downloading, setDownloading] = useState(false);
  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await fetchApi(`/api/v1/orders/${order.id}/invoice`);
      const url = res?.data?.pdf_url || res?.pdf_url;
      if (url) window.open(url, "_blank");
      else window.print();
    } catch {
      window.print();
    } finally {
      setDownloading(false);
    }
  };
  const invNo = "INV-" + String(order.id).slice(0, 8).toUpperCase();
  const applied =
    (order.deposit_paid_at ? order.deposit_amount || 0 : 0) +
    (order.balance_paid_at ? order.balance_amount || 0 : 0);
  const due = (order.total_amount || 0) - applied;
  const viewUrl = `${window.location.origin}/invoice/${order.id}`;
  const payLabel = order.payment_option === "online" ? "Online" : "Offline";
  const items = order.order_details?.items || [];

  return (
    <div className="bg-white text-gray-900 invoice-doc">
      <div className="flex justify-end gap-2 mb-4 print:hidden">
        <button
          onClick={downloadPdf}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded border border-[#4b1248] text-[#4b1248] hover:bg-[#4b1248] hover:text-white transition disabled:opacity-50"
        >
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Download PDF
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded bg-[#4b1248] text-white hover:bg-[#6c2e70] transition"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>
      </div>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="bg-[#4b1248] rounded-lg p-1.5">
            <img src="https://jnvspectra.com/jnvSpectraLogoBold.png" alt="JNV Spectra" className="h-14 w-14 object-contain" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#4b1248]">JNV Spectra</h2>
            <p className="text-xs text-gray-500">Event Management &amp; Rentals</p>
            <p className="text-xs text-gray-500">info@jnvspectra.com&nbsp;&nbsp;|&nbsp;&nbsp;+1 (941) 773-3879</p>
          </div>
        </div>
        <div className="text-right">
          <div className="border border-gray-300 p-1 inline-block bg-white">
            <QRCode value={viewUrl} size={72} />
          </div>
          <p className="text-[11px] tracking-[0.2em] mt-1">{invNo}</p>
          <p className="text-[10px] text-gray-400">Scan to view online</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mt-6 pt-4 border-t">
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Bill to</p>
          <p className="font-medium">{order.customer_name}</p>
          <p className="text-sm">{order.email}</p>
          <p className="text-sm">{order.contact_number || "N/A"}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <p className="text-gray-500">Invoice number</p><p>{invNo}</p>
          <p className="text-gray-500">Date</p><p>{dstr(order.created_at)}</p>
          <p className="text-gray-500">Payment terms</p><p>{payLabel}</p>
          <p className="text-gray-500">Due date</p><p>{dstr(order.event_date)}</p>
          <p className="text-gray-500">Service period</p><p>{dstr(order.event_date)}{order.event_time ? " " + order.event_time : ""}</p>
          <p className="text-gray-500">Status</p><p className="capitalize">{order.order_status}</p>
        </div>
      </div>

      <table className="w-full mt-6 text-sm border border-gray-300">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-50">
            <th className="text-left p-2 font-semibold">Item summary</th>
            <th className="p-2 font-semibold w-16">Qty</th>
            <th className="p-2 font-semibold w-24">Rate</th>
            <th className="p-2 font-semibold w-24">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, i: number) => (
            <tr key={i} className="border-b border-gray-200">
              <td className="p-2">{item.name}</td>
              <td className="p-2 text-center">{item.quantity || 1}</td>
              <td className="p-2 text-right">{fmt(item.price)}</td>
              <td className="p-2 text-right">{fmt(item.price * (item.quantity || 1))}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr className="border-b border-gray-200">
              <td className="p-2">{order.service_type}</td>
              <td className="p-2 text-center">1</td>
              <td className="p-2 text-right">{fmt(order.total_amount)}</td>
              <td className="p-2 text-right">{fmt(order.total_amount)}</td>
            </tr>
          )}
          <tr className="border-b border-gray-200">
            <td className="p-2 text-gray-500" colSpan={3}>Subtotal</td>
            <td className="p-2 text-right">{fmt(order.order_details?.subtotal ?? order.total_amount)}</td>
          </tr>
          <tr>
            <td className="p-2 text-gray-500" colSpan={3}>Tax</td>
            <td className="p-2 text-right">{fmt(order.order_details?.tax || 0)}</td>
          </tr>
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-6 mt-6 text-sm">
        <div>
          <p className="text-sm font-semibold text-gray-800">Payment Information</p>
          <div className="text-xs text-gray-600 mt-1 space-y-0.5">
            <p>Payment details will be provided separately</p>
            <p>Alternate payment option: <span className="font-medium">Zelle</span></p>
            <p>Email: jnvcommercials@gmail.com</p>
            <p>Valid until: 12/3/2026</p>
          </div>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-gray-600">Invoice total in USD</p>
          <p className="text-2xl font-bold">{fmt(order.total_amount)}</p>
          <p className="text-gray-600 pt-2">Amount applied in USD</p>
          <p className="text-lg">{fmt(applied)}</p>
          <p className="text-gray-600 pt-2">Total amount due in USD</p>
          <p className="text-2xl font-bold">{fmt(due)}</p>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-300">
        <p className="text-sm font-semibold text-gray-800">Terms and Conditions</p>
        <ul className="text-xs text-gray-600 mt-1 space-y-1 list-none">
          <li>• <span className="font-medium">Validity:</span> This invoice is valid for 30 days from the invoice date.</li>
          <li>• <span className="font-medium">Deposit:</span> Above mentioned amount is required to confirm booking. Balance due before the event.</li>
          <li>• <span className="font-medium">Cancellation:</span> 30 days prior notice is required for free cancellation. Beyond that, cancellation charges will be applied depending on the number of days before the event.</li>
          <li>• <span className="font-medium">Power Requirements:</span> Client is responsible for arranging Electricity for the equipment.</li>
          <li>• <span className="font-medium">Equipment Usage:</span>
            <ul className="ml-4 space-y-0.5 mt-0.5">
              <li>- Clients must use the above mentioned rental equipment solely for the agreed-upon purpose.</li>
              <li>- Any damage caused due to improper use, negligence, or mishandling will be the Client's responsibility.</li>
              <li>- Unauthorized modifications or tampering with the equipment is strictly prohibited.</li>
            </ul>
          </li>
          <li>• <span className="font-medium">Damage Liability:</span>
            <ul className="ml-4 space-y-0.5 mt-0.5">
              <li>- The Client assumes full responsibility for any damage, loss or theft of the rented equipment during the rental period.</li>
              <li>- In case of damage, repair costs or full replacement fees will be charged based on the severity of the damage.</li>
              <li>- JNV Spectra is not liable for any indirect or consequential damages.</li>
            </ul>
          </li>
        </ul>
      </div>

      <div className="mt-8 pt-4 border-t border-gray-300 text-center">
        <p className="text-xs text-gray-400">View this invoice online: <a href={viewUrl} className="text-[#4b1248] hover:underline">{viewUrl}</a></p>
        <p className="text-[10px] text-gray-400 mt-1">JNV Spectra · Event Management &amp; Rentals · info@jnvspectra.com · +1 (941) 773-3879</p>
      </div>
    </div>
  );
}
