import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { retry, debounce } from "@/lib/utils";
import { useCallback, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";

export interface Order {
  id: string;
  customer_name: string;
  email: string;
  contact_number?: string;
  event_date: string;
  event_time: string;
  service_type: string;
  order_details: {
    tax?: number;
    items?: Array<{
      name: string;
      price: number;
      quantity: number;
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

export interface OrderResponse {
  data: {
    data: Order[];
    pagination: {
      total: number;
      totalPages: number;
      currentPage: number;
      limit: number;
    };
  };
}

export interface OrderFormValues {
  customer_name: string;
  email: string;
  contact_number?: string;
  event_date: string | Date;
  event_time: string;
  service_type: string;
  order_details: {
    tax?: number;
    items?: Array<{
      name: string;
      price: number;
      quantity: number;
    }>;
    total: number;
    subtotal: number;
  };
  payment_option: 'paid_offline' | 'online';
  order_status: 'pending' | 'paid' | 'cancelled';
  total_amount: number;
  deposit_amount: number;
  balance_amount: number;
}

const formatOrderDate = (value: string | Date) => {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return value;
};

export interface OrderListParams {
  page?: number;
  limit?: number;
  search?: string;
  order_status?: string | string[];
  start_date?: string;
  end_date?: string;
}

// Rate limiting configuration
const RATE_LIMIT = {
  windowMs: 60000, // 1 minute
  max: 60, // 60 requests per minute
  message: "Too many requests, please try again later",
};

// Cache configuration
const CACHE_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
};

// Convert form values to API format
const formatOrderData = (values: OrderFormValues) => {
  const subtotal = values.order_details.subtotal || 0;
  const taxPercentage = values.order_details.tax || 0;
  // Calculate actual tax amount from percentage
  const taxAmount = (taxPercentage / 100) * subtotal;
  const total = subtotal + taxAmount;

  return {
    customer_name: values.customer_name,
    email: values.email,
    contact_number: values.contact_number,
    event_date: formatOrderDate(values.event_date),
    event_time: values.event_time,
    service_type: values.service_type,
    order_details: {
      tax_percentage: taxPercentage,
      tax_amount: taxAmount,
      items: values.order_details.items || [],
      payments: values.order_details.payments || [],
      subtotal: subtotal
    },
    payment_option: values.payment_option,
    order_status: values.order_status,
    total_amount: total,
    deposit_amount: values.deposit_amount || 0,
    balance_amount: total - (values.deposit_amount || 0)
  };
};

// Fetch orders list with enhanced caching and rate limiting
export const useOrders = (params: OrderListParams = {}) => {
  const queryParams = new URLSearchParams();
  const abortControllerRef = useRef<AbortController | null>(null);
  
  if (params.page) queryParams.append("page", params.page.toString());
  if (params.limit) queryParams.append("limit", params.limit.toString());
  if (params.search) queryParams.append("search", params.search);
  if (params.order_status) {
    const statusValue = Array.isArray(params.order_status)
      ? params.order_status.join(",")
      : params.order_status;
    if (statusValue) queryParams.append("order_status", statusValue);
  }
  if (params.start_date) queryParams.append("start_date", params.start_date);
  if (params.end_date) queryParams.append("end_date", params.end_date);
  
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
  
  return useQuery({
    queryKey: ["orders", params],
    queryFn: async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      try {
        const response = await fetchApi(`/api/v1/orders${queryString}`, {
          signal: abortControllerRef.current.signal,
        });
        
        const remaining = response.headers?.get("X-RateLimit-Remaining");
        if (remaining && parseInt(remaining) < 10) {
          toast({
            title: "Rate Limit Warning",
            description: `You have ${remaining} requests remaining this minute`,
            variant: "default",
          });
        }
        
        return response as OrderResponse;
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }
        throw error;
      }
    },
    retry: (failureCount, error) => retry(failureCount, error),
    staleTime: CACHE_CONFIG.staleTime,
    gcTime: CACHE_CONFIG.gcTime,
  });
};

export const fetchOrdersForExport = async (params: OrderListParams = {}) => {
  const queryParams = new URLSearchParams();

  if (params.limit) queryParams.append("limit", params.limit.toString());
  if (params.search) queryParams.append("search", params.search);
  if (params.order_status) {
    const statusValue = Array.isArray(params.order_status)
      ? params.order_status.join(",")
      : params.order_status;
    if (statusValue) queryParams.append("order_status", statusValue);
  }
  if (params.start_date) queryParams.append("start_date", params.start_date);
  if (params.end_date) queryParams.append("end_date", params.end_date);
  if (!queryParams.has("limit")) queryParams.append("limit", "5000");

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
  return fetchApi(`/api/v1/orders${queryString}`) as Promise<OrderResponse>;
};

// Create a new order with optimistic updates
export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: OrderFormValues) => {
      const formattedData = formatOrderData(data);
      return fetchApi("/api/v1/orders", {
        method: "POST",
        body: JSON.stringify(formattedData),
      }).then(response => response as Order);
    },
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: ["orders"] });
      
      const previousOrders = queryClient.getQueryData(["orders"]);
      
      queryClient.setQueryData(["orders"], (old: any) => {
        const newData = {
          ...old,
          data: [...(old?.data || []), { ...newOrder, id: "temp" }],
        };
        return newData;
      });
      
      return { previousOrders };
    },
    onError: (err, newOrder, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(["orders"], context.previousOrders);
      }
      toast({
        title: "Error",
        description: err.message || "Failed to create order",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

// Update an existing order with optimistic updates
export const useUpdateOrder = (id: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: OrderFormValues) => {
      const formattedData = formatOrderData(data);
      return fetchApi(`/api/v1/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify(formattedData),
      }).then(response => response as Order);
    },
    onMutate: async (updatedOrder) => {
      await queryClient.cancelQueries({ queryKey: ["orders"] });
      await queryClient.cancelQueries({ queryKey: ["orders", id] });
      
      const previousOrders = queryClient.getQueryData(["orders"]);
      const previousOrder = queryClient.getQueryData(["orders", id]);
      
      queryClient.setQueryData(["orders", id], updatedOrder);
      queryClient.setQueryData(["orders"], (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((order: any) =>
            order.id === id ? { ...order, ...updatedOrder } : order
          ),
        };
      });
      
      return { previousOrders, previousOrder };
    },
    onError: (err, updatedOrder, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(["orders"], context.previousOrders);
      }
      if (context?.previousOrder) {
        queryClient.setQueryData(["orders", id], context.previousOrder);
      }
      toast({
        title: "Error",
        description: err.message || "Failed to update order",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", id] });
    },
  });
};

// Delete an order with optimistic updates
export const useDeleteOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => {
      return fetchApi(`/api/v1/orders/${id}`, {
        method: "DELETE",
      });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["orders"] });
      
      const previousOrders = queryClient.getQueryData(["orders"]);
      
      queryClient.setQueryData(["orders"], (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((order: any) => order.id !== id),
        };
      });
      
      return { previousOrders };
    },
    onError: (err, id, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(["orders"], context.previousOrders);
      }
      toast({
        title: "Error",
        description: err.message || "Failed to delete order",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

// Mark an order as paid
export const useMarkOrderAsPaid = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      console.log(`Marking order ${id} as paid...`);
      return await fetchApi(`/api/v1/orders/${id}/mark-as-paid`, {
        method: "PUT",
      }).then(response => response as Order);
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ["orders"] });
      
      // Save the current state
      const previousOrders = queryClient.getQueryData<OrderResponse>(["orders"]);
      
      // Perform an optimistic update
      if (previousOrders?.data?.data) {
        queryClient.setQueryData<OrderResponse>(["orders"], old => {
          if (!old || !old.data || !old.data.data) return old;
          
          return {
            ...old,
            data: {
              ...old.data,
              data: old.data.data.map(order => 
                order.id === id 
                  ? { ...order, order_status: 'paid' }
                  : order
              )
            }
          };
        });
      }
      
      return { previousOrders };
    },
    onSuccess: (updatedOrder) => {
      // Only invalidate single order cache on success
      queryClient.invalidateQueries({ 
        queryKey: ["orders", updatedOrder.id],
        exact: true 
      });
      
      toast({
        title: "Success",
        description: "Order marked as paid successfully",
      });
    },
    onError: (error: any, id, context) => {
      // If the mutation fails, rollback to the previous state
      if (context?.previousOrders) {
        queryClient.setQueryData(["orders"], context.previousOrders);
      }
      
      console.error("Failed to mark order as paid:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to mark order as paid",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // After either success or error, refresh the orders list once
      // with a delay to avoid race conditions
      setTimeout(() => {
        queryClient.invalidateQueries({ 
          queryKey: ["orders"],
          exact: false 
        });
      }, 500);
    },
  });
};

// Generate payment link for an order
export const useGeneratePaymentLink = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => {
      return fetchApi(`/api/v1/orders/${id}/payment-link`, {
        method: "POST",
      }).then(response => response as { paymentLink: string });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({
        title: "Success",
        description: "Payment link generated successfully",
      });
      return data.paymentLink;
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate payment link",
        variant: "destructive",
      });
    },
  });
};

// Get order invoice
export const useOrderInvoice = (orderId: string) => {
  return useQuery({
    queryKey: ["orders", orderId, "invoice"],
    queryFn: () => fetchApi(`/api/v1/orders/${orderId}/invoice`).then(response => response as { url: string }),
    enabled: !!orderId,
  });
};

// Download invoice
export const downloadInvoice = async (orderId: string) => {
  try {
    const response = await fetchApi(`/api/v1/orders/${orderId}/invoice`);
    // Handle the new response format
    if (response.status === "success" && response.data && response.data.pdf_url) {
      window.open(response.data.pdf_url, "_blank");
    } else if (response.url) {
      // Fallback for old response format
      window.open(response.url, "_blank");
    } else {
      throw new Error("No downloadable URL found in the response");
    }
  } catch (error: any) {
    toast({
      title: "Error",
      description: error.message || "Failed to download invoice",
      variant: "destructive",
    });
    throw error;
  }
};

export const useGenerateDepositPaymentLink = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetchApi(`/api/v1/orders/${orderId}/deposit-payment-link`, {
        method: 'POST',
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: 'Success',
        description: 'Deposit payment link generated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to generate deposit payment link',
        variant: 'destructive',
      });
    },
  });
};

export const useGenerateBalancePaymentLink = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetchApi(`/api/v1/orders/${orderId}/generate-balance-link`, {
        method: 'POST',
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: 'Success',
        description: 'Balance payment link generated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to generate balance payment link',
        variant: 'destructive',
      });
    },
  });
};

export const useCancelOrder = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetchApi(`/api/v1/orders/${orderId}/cancel`, {
        method: 'POST',
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
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
    },
  });
};

// Generate quotation template for remaining balance payment
export const useGenerateBalanceQuotation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetchApi(`/api/v1/orders/${orderId}/balance-quotation`, {
        method: 'POST',
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: 'Success',
        description: 'Balance quotation generated successfully',
      });
      return data;
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate balance quotation',
        variant: 'destructive',
      });
    },
  });
};

export const useMarkDepositAsPaid = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetchApi(`/api/v1/orders/${orderId}/mark-deposit-paid`, {
        method: 'PUT',
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: 'Success',
        description: 'Deposit marked as paid successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to mark deposit as paid',
        variant: 'destructive',
      });
    },
  });
};
