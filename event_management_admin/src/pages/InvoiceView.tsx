import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { InvoiceDocument } from "@/components/orders/InvoiceDocument";

export default function InvoiceView() {
  const { orderId } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["invoice", orderId],
    queryFn: () => fetchApi(`/api/v1/orders/${orderId}`),
    enabled: !!orderId,
  });

  const order = data?.data || data?.order || data;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
        {isLoading ? (
          <div className="text-center py-20 text-gray-500">Loading invoice…</div>
        ) : error || !order?.id ? (
          <div className="text-center py-20 text-gray-500">Invoice not found.</div>
        ) : (
          <InvoiceDocument order={order} />
        )}
      </div>
    </div>
  );
}
