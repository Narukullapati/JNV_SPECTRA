import React, { useEffect, useState } from 'react';
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";
ModuleRegistry.registerModules([AllCommunityModule]);
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useOrders, useMarkOrderAsPaid, useGeneratePaymentLink, downloadInvoice, useDeleteOrder, useCreateOrder, useGenerateDepositPaymentLink, useGenerateBalancePaymentLink, useCancelOrder, useGenerateBalanceQuotation, fetchOrdersForExport } from "@/api/orders";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Plus, MoreHorizontal, EyeIcon, CreditCard, Download, Loader2, Trash2, ShoppingBag, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { OrderForm } from "@/components/orders/OrderForm";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchApi } from "@/lib/api";
import { DropdownMenuCheckboxItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

interface Order {
  id: string;
  customer_name: string;
  email: string;
  contact_number?: string;
  service_type: string;
  event_date: string;
  order_details: {
    tax?: number;
    items?: Array<{
      name: string;
      price: number;
      quantity?: number;
    }>;
    total: number;
    subtotal: number;
  };
  payment_option: 'paid_offline' | 'online';
  order_status: 'pending' | 'confirmed' | 'paid' | 'cancelled';
  quotation_template: any;
  invoice_template?: any;
  total_amount: number;
  deposit_amount: number;
  balance_amount: number;
  deposit_payment_link?: string;
  balance_payment_link?: string;
  deposit_paid_at?: string;
  balance_paid_at?: string;
  created_at: string;
  updated_at: string;
}

export default function Orders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [loadingAction, setLoadingAction] = useState<{id: string, action: string} | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [paymentType, setPaymentType] = useState<'deposit' | 'balance' | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, fromDate, toDate]);

  const orderStatusOptions = ["pending", "confirmed", "paid", "cancelled"] as const;
  const statusFilterLabel = statusFilter.length === 0
    ? "All statuses"
    : `${statusFilter.length} selected`;

  const toggleStatusFilter = (status: string) => {
    setStatusFilter((current) =>
      current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status],
    );
  };

  const { data, isLoading, error } = useOrders({
    limit: 500,
    search: searchQuery || undefined,
    order_status: statusFilter.length ? statusFilter : undefined,
    start_date: fromDate || undefined,
    end_date: toDate || undefined,
  });

  const markOrderAsPaid = useMarkOrderAsPaid();
  const generatePaymentLink = useGeneratePaymentLink();
  const createOrder = useCreateOrder();
  const deleteOrder = useDeleteOrder();
  const generateDepositPaymentLink = useGenerateDepositPaymentLink();
  const generateBalancePaymentLink = useGenerateBalancePaymentLink();
  const cancelOrder = useCancelOrder();
  const generateBalanceQuotation = useGenerateBalanceQuotation();

  const escapeXml = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  // Map internal payment_option values to user-friendly, capitalized labels
  const paymentOptionLabel = (opt: string | undefined) => {
    if (!opt) return "";
    if (opt === 'paid_offline') return 'Offline';
    if (opt === 'online') return 'Online';
    // Fallback: capitalize first letter of unknown values
    return opt.charAt(0).toUpperCase() + opt.slice(1);
  };

  const buildExcelXml = (ordersToExport: Order[]) => {
    const headers = [
      "Order ID",
      "Customer Name",
      "Email",
      "Contact Number",
      "Event Date",
      "Event Time",
      "Services",
      "Subtotal",
      "Tax",
      "Total Amount",
      "Deposit Amount",
      "Balance Amount",
      "Payment Option",
      "Order Status",
      "Created At",
    ];

    const headerRow = headers
      .map((header) => `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`)
      .join("");

    const rows = ordersToExport.map((order) => {
      const services = (order.order_details?.items || [])
        .map((item) => `${item.name}${item.quantity ? ` (x${item.quantity})` : ""}`)
        .join(", ");

      const cells = [
        order.id,
        order.customer_name,
        order.email,
        order.contact_number || "",
        order.event_date,
        order.event_time || "",
        services,
        order.order_details?.subtotal || 0,
        order.order_details?.tax || 0,
        order.total_amount,
        order.deposit_amount,
        order.balance_amount,
        // use friendly label in exports
        paymentOptionLabel(order.payment_option),
        order.order_status,
        order.created_at,
      ];

      return `<Row>${cells
        .map((cell, index) => {
          const isNumber = index >= 7 && index <= 10;
          const type = isNumber ? "Number" : "String";
          return `<Cell><Data ss:Type="${type}">${escapeXml(cell)}</Data></Cell>`;
        })
        .join("")}</Row>`;
    }).join("");

    return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Orders">
  <Table>
   <Row>${headerRow}</Row>
   ${rows}
  </Table>
 </Worksheet>
</Workbook>`;
  };

  const handleExportOrders = async () => {
    if (fromDate && toDate && fromDate > toDate) {
      toast({
        title: "Invalid date range",
        description: "From Date must be before or equal to To Date.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsExporting(true);
      const response = await fetchOrdersForExport({
        search: searchQuery || undefined,
        order_status: statusFilter.length ? statusFilter : undefined,
        start_date: fromDate || undefined,
        end_date: toDate || undefined,
        limit: 5000,
      });

      const ordersToExport = response?.data?.data || [];

      if (!ordersToExport.length) {
        toast({
          title: "No orders found",
          description: "There are no orders matching the selected filters.",
        });
        return;
      }

      const xml = buildExcelXml(ordersToExport);
      const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const suffix = `${fromDate || "all"}_to_${toDate || "all"}_${statusFilter.length ? statusFilter.join("-") : "all"}`;

      link.href = url;
      link.download = `orders_export_${suffix}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export ready",
        description: `${ordersToExport.length} orders exported successfully.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export orders.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleMarkAsPaid = async (orderId: string, type: 'deposit' | 'full') => {
    try {
      setIsPageLoading(true);
      setLoadingAction({ id: orderId, action: type === 'deposit' ? 'mark_deposit_paid' : 'mark_paid' });
      const endpoint = type === 'deposit' ? 'mark-deposit-paid' : 'mark-paid';
      await fetchApi(`/api/v1/orders/${orderId}/${endpoint}`, {
        method: 'PUT',
      });

      toast({
        title: "Success",
        description: type === 'deposit' 
          ? "Deposit marked as paid successfully" 
          : "Order marked as paid successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (error) {
      console.error("Error marking payment as paid:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mark payment as paid",
        variant: "destructive",
      });
    } finally {
      setLoadingAction(null);
      setIsPageLoading(false);
    }
  };

  const handlePaymentLinkGeneration = (order: Order, type: 'deposit' | 'balance') => {
    // Validate order status
    if (order.order_status === 'cancelled') {
      toast({
        title: 'Error',
        description: 'Cannot generate payment link for cancelled orders',
        variant: 'destructive',
      });
      return;
    }

    // Check if payment is already made
    if (type === 'deposit' && order.deposit_paid_at) {
      toast({
        title: 'Info',
        description: 'Deposit payment has already been made',
      });
      return;
    }

    if (type === 'balance' && order.balance_paid_at) {
      toast({
        title: 'Info',
        description: 'Balance payment has already been made',
      });
      return;
    }

    setSelectedOrder(order);
    setPaymentType(type);
    setIsPaymentModalVisible(true);
  };

  const handleConfirmPayment = () => {
    if (!selectedOrder || !paymentType) return;

    const generateLink = paymentType === 'deposit' ? generateDepositPaymentLink : generateBalancePaymentLink;
    
    generateLink.mutate(selectedOrder.id, {
      onSuccess: (data) => {
        toast({
          title: 'Success',
          description: 'Payment link generated successfully',
        });
        // Open payment link in new tab
        if (data.paymentUrl) {
          window.open(data.paymentUrl, '_blank');
        }
        setIsPaymentModalVisible(false);
        // Invalidate orders query to refresh the data
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      },
      onError: (error) => {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to generate payment link',
          variant: 'destructive',
        });
        console.error('Payment link generation error:', error);
      }
    });
  };

  const handleDownloadInvoice = async (orderId: string, orderStatus: string) => {
    try {
      setIsPageLoading(true);
      setLoadingAction({ id: orderId, action: 'download_invoice' });
      await downloadInvoice(orderId);
      toast({
        title: "Success",
        description: orderStatus === "paid" 
          ? "Receipt downloaded successfully" 
          : "Invoice downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: orderStatus === "paid"
          ? "Failed to download receipt"
          : "Failed to download invoice",
        variant: "destructive",
      });
    } finally {
      setLoadingAction(null);
      setIsPageLoading(false);
    }
  };

  const handleCreateOrder = async (values: any) => {
    try {
      await createOrder.mutateAsync(values);
      setIsFormOpen(false);
      toast({
        title: "Success",
        description: "Order created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create order",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    
    try {
      setIsPageLoading(true);
      setLoadingAction({ id: orderToDelete.id, action: 'delete' });
      await deleteOrder.mutateAsync(orderToDelete.id);
      setOrderToDelete(null);
      toast({
        title: "Success",
        description: "Order deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete order",
        variant: "destructive",
      });
    } finally {
      setLoadingAction(null);
      setIsPageLoading(false);
    }
  };

  const handleCancelOrder = (orderId: string) => {
    setIsPageLoading(true);
    setLoadingAction({ id: orderId, action: 'cancel' });
    cancelOrder.mutate(orderId, {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Order cancelled successfully',
        });
      },
      onError: (error) => {
        toast({
          title: 'Error',
          description: 'Failed to cancel order',
          variant: 'destructive',
        });
        console.error(error);
      },
      onSettled: () => {
        setLoadingAction(null);
        setIsPageLoading(false);
      }
    });
  };

  const handleGenerateBalanceQuotation = async (orderId: string) => {
    try {
      setIsPageLoading(true);
      setLoadingAction({ id: orderId, action: 'generate_quotation' });
      await generateBalanceQuotation.mutateAsync(orderId);
      toast({
        title: "Success",
        description: "Balance invoice generated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate balance invoice",
        variant: "destructive",
      });
    } finally {
      setLoadingAction(null);
      setIsPageLoading(false);
    }
  };

  // New: Generate balance pay link and show/copy it, and send email
  const handleGenerateBalancePayLink = (order: Order) => {
    setLoadingAction({ id: order.id, action: 'generate_balance_link' });
    generateBalancePaymentLink.mutate(order.id, {
      onSuccess: async (data) => {
        console.log('Balance Pay Link API response:', data);
        const link = data?.balance_checkout_link;
        if (!link) {
          toast({ title: 'Error', description: 'No balance checkout link returned.', variant: 'destructive' });
          return;
        }
        toast({
          title: 'Balance Pay Link Generated',
          description: (
            <span>
              <a href={link} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Open Link</a>
              <Button size="sm" variant="outline" className="ml-2 px-2 py-1 text-xs" onClick={() => navigator.clipboard.writeText(link)}>Copy</Button>
            </span>
          ),
          duration: 10000
        });
        // Send email to customer with the balance checkout link
        try {
          await fetchApi(`/api/v1/orders/${order.id}/send-balance-link-email`, {
            method: 'POST',
            body: JSON.stringify({ balance_checkout_link: link })
          });
        } catch (e) {
          toast({
            title: 'Warning',
            description: 'Failed to send balance pay link email.',
            variant: 'destructive',
          });
        }
      },
      onError: (error) => {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to generate balance pay link',
          variant: 'destructive',
        });
      },
      onSettled: () => setLoadingAction(null)
    });
  };

  const renderOrdersSkeleton = () => {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Service Type</TableHead>
              <TableHead>Event Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Payment Option</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array(5).fill(0).map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-8 w-8 rounded-full ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Orders</h1>
            <Button onClick={() => setIsFormOpen(true)} disabled={createOrder.isPending}>
              {createOrder.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  New Order
                </>
              )}
            </Button>
          </div>
          <div className="rounded-md border border-destructive/50 p-4 bg-destructive/10">
            <h2 className="text-xl font-semibold text-destructive">Error loading orders</h2>
            <p className="text-destructive/80 mt-2">
              {error instanceof Error ? error.message : "An error occurred while loading orders"}
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['orders'] })}
            >
              Retry
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const orders = data?.data?.data || [];
  const sortedOrders = [...orders].sort((a: any, b: any) => {
    if (!sortKey) return 0;
    const k = sortKey as keyof typeof a;
    let av: any = a[k], bv: any = b[k];
    if (k === 'total_amount') { av = Number(av) || 0; bv = Number(bv) || 0; }
    else { av = String(av ?? '').toLowerCase(); bv = String(bv ?? '').toLowerCase(); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sortMark = (key: string) => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '');

  const ActionsCell = (params: any) => {
    const order = params.data;
    return (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
                              <EyeIcon className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {order.payment_option === 'online' && (
                              <>
                                {order.order_status === 'pending' && !order.deposit_paid_at && (
                                  <>
                                    <DropdownMenuItem 
                                      onClick={() => handlePaymentLinkGeneration(order, 'deposit')}
                                      disabled={loadingAction?.id === order.id}
                                    >
                                      {loadingAction?.id === order.id && loadingAction?.action === 'generate_deposit_link' ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <CreditCard className="mr-2 h-4 w-4" />
                                      )}
                                      Pay Deposit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleMarkAsPaid(order.id, 'deposit')}
                                      disabled={loadingAction?.id === order.id}
                                    >
                                      {loadingAction?.id === order.id && loadingAction?.action === 'mark_deposit_paid' ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <CreditCard className="mr-2 h-4 w-4" />
                                      )}
                                      Mark as Deposit Paid
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {order.order_status === 'confirmed' && !order.balance_paid_at && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => handleMarkAsPaid(order.id, 'full')}
                                      disabled={loadingAction?.id === order.id}
                                    >
                                      {loadingAction?.id === order.id && loadingAction?.action === 'mark_paid' ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <CreditCard className="mr-2 h-4 w-4" />
                                      )}
                                      Mark as Paid
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleGenerateBalancePayLink(order)}
                                      disabled={loadingAction?.id === order.id}
                                    >
                                      {loadingAction?.id === order.id && loadingAction?.action === 'generate_balance_link' ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <CreditCard className="mr-2 h-4 w-4" />
                                      )}
                                      Generate Balance Pay Link
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </>
                            )}
                            {order.payment_option === 'paid_offline' && (
                              <>
                                {order.order_status === 'pending' && !order.deposit_paid_at && (
                                  <>
                                    {/* <DropdownMenuItem 
                                      onClick={() => handlePaymentLinkGeneration(order, 'deposit')}
                                      disabled={loadingAction?.id === order.id}
                                    >
                                      {loadingAction?.id === order.id && loadingAction?.action === 'generate_deposit_link' ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <CreditCard className="mr-2 h-4 w-4" />
                                      )}
                                      Pay Deposit
                                    </DropdownMenuItem> */}
                                    <DropdownMenuItem
                                      onClick={() => handleMarkAsPaid(order.id, 'deposit')}
                                      disabled={loadingAction?.id === order.id}
                                    >
                                      {loadingAction?.id === order.id && loadingAction?.action === 'mark_deposit_paid' ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <CreditCard className="mr-2 h-4 w-4" />
                                      )}
                                      Mark as Deposit Paid
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {order.order_status === 'confirmed' && !order.balance_paid_at && (
                                  <DropdownMenuItem
                                    onClick={() => handleMarkAsPaid(order.id, 'full')}
                                    disabled={loadingAction?.id === order.id}
                                  >
                                    {loadingAction?.id === order.id && loadingAction?.action === 'mark_paid' ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <CreditCard className="mr-2 h-4 w-4" />
                                    )}
                                    Mark as Paid
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                            {order.order_status === "paid" && (
                              <DropdownMenuItem 
                                onClick={() => handleDownloadInvoice(order.id, order.order_status)}
                                disabled={loadingAction?.id === order.id}
                              >
                                {loadingAction?.id === order.id && loadingAction?.action === 'download_invoice' ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="mr-2 h-4 w-4" />
                                )}
                                Download Receipt
                              </DropdownMenuItem>
                            )}
                            {order.order_status !== 'cancelled' && (
                              <DropdownMenuItem 
                                onClick={() => handleCancelOrder(order.id)}
                                disabled={loadingAction?.id === order.id}
                              >
                                {loadingAction?.id === order.id && loadingAction?.action === 'cancel' ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="mr-2 h-4 w-4" />
                                )}
                                Cancel Order
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => setOrderToDelete(order)}
                              disabled={loadingAction?.id === order.id}
                            >
                              {loadingAction?.id === order.id && loadingAction?.action === 'delete' ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                              )}
                              Delete Order
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
    );
  };

  const [gridRows, setGridRows] = useState<any[] | null>(null);
  const totRows = (gridRows ?? sortedOrders).filter((o: any) => (o.order_status || '').toLowerCase() !== 'cancelled');
  const numT = (v: any) => Number(v) || 0;
  const tBilled = totRows.reduce((a: number, o: any) => a + numT(o.total_amount), 0);
  const tOnline = totRows.filter((o: any) => o.payment_option === 'online').reduce((a: number, o: any) => a + numT(o.total_amount), 0);
  const tOffline = totRows.filter((o: any) => o.payment_option === 'paid_offline').reduce((a: number, o: any) => a + numT(o.total_amount), 0);
  const tPaid = totRows.filter((o: any) => o.order_status === 'paid' || o.order_status === 'completed').reduce((a: number, o: any) => a + numT(o.total_amount), 0);
  const tPending = Math.max(tBilled - tPaid, 0);

  const gridHeight = Math.max(320, window.innerHeight - 300);
  const gridPageSize = Math.max(5, Math.floor((gridHeight - 150) / 42));
  const gridColDefs: any[] = [
    { headerName: 'Customer', field: 'customer_name', autoHeight: true, cellRenderer: (p: any) => (
      <div><div className="font-medium">{p.value}</div><div className="text-sm text-gray-500">{p.data.email}</div></div>) },
    { headerName: 'Service Type', autoHeight: true, valueGetter: (p: any) =>
      (p.data.order_details?.items || []).map((it: any) => `${it.name}${it.quantity ? ` (x${it.quantity})` : ''}`).join(', ') },
    { headerName: 'Event Date', field: 'event_date', valueFormatter: (p: any) => formatDate(p.value), comparator: (a: any, b: any) => (new Date(a).getTime() || 0) - (new Date(b).getTime() || 0) },
    { headerName: 'Total', field: 'total_amount', filter: 'agNumberColumnFilter', valueFormatter: (p: any) => formatCurrency(p.value) },
    { headerName: 'Payment Option', field: 'payment_option', cellRenderer: (p: any) => (
      <Badge variant={p.value === 'online' ? 'default' : 'secondary'}>{paymentOptionLabel(p.value)}</Badge>) },
    { headerName: 'Status', field: 'order_status', cellRenderer: (p: any) => (
      <Badge variant={p.value === 'paid' ? 'default' : p.value === 'cancelled' ? 'destructive' : 'secondary'}>{p.value}</Badge>) },
    { headerName: 'Actions', field: 'id', sortable: false, filter: false, width: 90, cellRenderer: ActionsCell },
  ];
  const pagination = data?.data?.pagination;

  return (
    <DashboardLayout>
      <div className="space-y-4 relative">
        {isPageLoading && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {loadingAction?.action === 'mark_deposit_paid' && "Marking deposit as paid..."}
                {loadingAction?.action === 'mark_paid' && "Marking order as paid..."}
                {loadingAction?.action === 'download_invoice' && "Downloading receipt..."}
                {loadingAction?.action === 'cancel' && "Cancelling order..."}
                {loadingAction?.action === 'generate_quotation' && "Generating invoice..."}
                {loadingAction?.action === 'generate_deposit_link' && "Generating deposit payment link..."}
                {loadingAction?.action === 'generate_balance_link' && "Generating balance payment link..."}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Orders</h1>
          <div className="flex items-center space-x-3">
            <Button onClick={() => setIsFormOpen(true)} disabled={createOrder.isPending}>
              {createOrder.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  New Order
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64">
            <label className="mb-1 block text-sm text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search customer or email"
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-full sm:w-48">
            <label className="mb-1 block text-sm text-muted-foreground">Status</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  {statusFilterLabel}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuCheckboxItem
                  checked={statusFilter.length === 0}
                  onCheckedChange={() => setStatusFilter([])}
                >
                  All statuses
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {orderStatusOptions.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={statusFilter.includes(status)}
                    onCheckedChange={() => toggleStatusFilter(status)}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="w-full sm:w-40">
            <label className="mb-1 block text-sm text-muted-foreground">From Date</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>

          <div className="w-full sm:w-40">
            <label className="mb-1 block text-sm text-muted-foreground">To Date</label>
            <Input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter([]);
                setFromDate("");
                setToDate("");
              }}
              disabled={isLoading}
            >
              Clear Filters
            </Button>
            <Button
              variant="outline"
              onClick={handleExportOrders}
              disabled={isExporting || isLoading}
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export Excel
                </>
              )}
            </Button>
          </div>
        </div>

        {isLoading ? (
          renderOrdersSkeleton()
        ) : (
          <div className="rounded-md border">
            <div className="flex flex-wrap gap-3 mb-3 text-sm">
              <span className="rounded-lg border bg-card px-3 py-1.5">Total Billed: <b>{formatCurrency(tBilled)}</b></span>
              <span className="rounded-lg border bg-card px-3 py-1.5">Online: <b>{formatCurrency(tOnline)}</b></span>
              <span className="rounded-lg border bg-card px-3 py-1.5">Offline: <b>{formatCurrency(tOffline)}</b></span>
              <span className="rounded-lg border bg-card px-3 py-1.5 text-green-700">Paid: <b>{formatCurrency(tPaid)}</b></span>
              <span className="rounded-lg border bg-card px-3 py-1.5 text-[#e0a422]">Pending: <b>{formatCurrency(tPending)}</b></span>
            </div>
            <div className="ag-theme-quartz" style={{ height: gridHeight, width: '100%' }}>
              <AgGridReact
                theme={themeQuartz}
                rowData={sortedOrders}
                columnDefs={gridColDefs}
                defaultColDef={{ sortable: true, filter: true, floatingFilter: true, resizable: true }}
                pagination={true}
                paginationPageSize={gridPageSize}
                autoSizeStrategy={{ type: 'fitGridWidth' }}
                onModelUpdated={(e: any) => {
                  const r: any[] = [];
                  e.api.forEachNodeAfterFilterAndSort((n: any) => r.push(n.data));
                  setGridRows(r);
                }}
              />
            </div>
          </div>
        )}

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl">
            <OrderForm onSubmit={handleCreateOrder} />
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium">Customer Information</h3>
                    <p>Name: {selectedOrder.customer_name}</p>
                    <p>Email: {selectedOrder.email}</p>
                    <p>Contact: {selectedOrder.contact_number || "N/A"}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Order Information</h3>
                    <p>Service Type: {selectedOrder.service_type}</p>
                    <p>Event Date: {formatDate(selectedOrder.event_date)}</p>
                    <p>Status: {selectedOrder.order_status}</p>
                    <p>Payment Option: {paymentOptionLabel(selectedOrder.payment_option)}</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium">Order Details</h3>
                  <div className="mt-2">
                    <p>Subtotal: {formatCurrency(selectedOrder.order_details.subtotal)}</p>
                    <p>Tax: {formatCurrency(selectedOrder.order_details.tax || 0)}</p>
                    <p>Total: {formatCurrency(selectedOrder.total_amount)}</p>
                  </div>
                  {selectedOrder.order_details.items && selectedOrder.order_details.items.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium">Items</h4>
                      <div className="mt-2 space-y-2">
                        {selectedOrder.order_details.items.map((item, index) => (
                          <div key={index} className="flex justify-between">
                            <span>{item.name}</span>
                            <span>{formatCurrency(item.price * (item.quantity || 1))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the order for {orderToDelete?.customer_name}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteOrder}
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteOrder.isPending}
              >
                {deleteOrder.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isPaymentModalVisible} onOpenChange={setIsPaymentModalVisible}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Generate {paymentType === 'deposit' ? 'Deposit' : 'Balance'} Payment Link
              </DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <p>Order ID: {selectedOrder.id}</p>
                <p>Customer: {selectedOrder.customer_name}</p>
                <p>Amount: {formatCurrency(paymentType === 'deposit' ? selectedOrder.deposit_amount : selectedOrder.balance_amount)}</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPaymentModalVisible(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmPayment}>
                Generate Payment Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
