import { MessageCircle, Copy } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/utils";

interface ContactRevealCardProps {
  dishName: string;
  quantity: number;
  pickupDate: string;
  sellerWhatsapp: string;
  sellerUpiId?: string | null;
  sellerName: string;
}

export function ContactRevealCard({
  dishName,
  quantity,
  pickupDate,
  sellerWhatsapp,
  sellerUpiId,
  sellerName,
}: ContactRevealCardProps) {
  const waUrl = buildWhatsAppUrl(sellerWhatsapp, dishName, quantity, pickupDate);

  return (
    <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-4">
      <p className="mb-3 text-sm font-semibold text-green-800">
        ✓ Accepted — contact {sellerName} to arrange payment
      </p>

      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
      >
        <MessageCircle className="h-4 w-4" />
        Message on WhatsApp
      </a>

      {sellerUpiId && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-green-200 bg-white px-3 py-2">
          <div>
            <p className="text-xs text-gray-500">UPI ID</p>
            <p className="text-sm font-mono font-medium text-gray-800">{sellerUpiId}</p>
          </div>
          <button
            onClick={() => navigator.clipboard?.writeText(sellerUpiId)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
            title="Copy UPI ID"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
