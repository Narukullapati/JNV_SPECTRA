import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ShoppingBag } from "lucide-react";

interface Order {
  id: string;
  customer: string;
  order_details: {
    items: Array<{
      name: string;
      price: number;
      quantity?: number;
    }>;
    subtotal: number;
    tax?: number;
  };
  date: string;
  status: 'completed' | 'cancelled' | 'pending';
  total: number;
}

interface RecentOrdersProps {
  orders: Order[];
}

export function RecentOrders({ orders }: RecentOrdersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-bold text-[#3d093d]">Recent Orders</CardTitle>
      </CardHeader>
      <CardContent>
        {orders && orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">{order.customer}</p>
                  <div className="text-sm text-muted-foreground">
                    {order.order_details?.items?.map((item, index) => (
                      <p key={`${order.id}-${index}`}>
                        {item.name} {item.quantity ? `(x${item.quantity})` : ''}
                      </p>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(order.date)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-medium">{formatCurrency(order.total)}</p>
                  <Badge
                    variant={
                      order.status === "completed"
                        ? "default"
                        : order.status === "cancelled"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
            <ShoppingBag className="h-10 w-10 mb-2" />
            <p>No recent orders found</p>
            <p className="text-sm">New orders will appear here</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
