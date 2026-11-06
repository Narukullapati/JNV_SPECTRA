import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const orderSchema = z.object({
  customer_name: z.string().min(2, { message: "Customer name is required" }),
  email: z.string().email({ message: "Email is required" }),
  contact_number: z.string().min(1, { message: "Contact number is required" }),
  event_date: z.date({ required_error: "Event date is required" }),
  event_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: "Invalid time format (HH:MM)" }),
  payment_option: z.enum(["paid_offline", "online"], { 
    required_error: "Payment option is required",
    invalid_type_error: "Invalid payment option"
  }),
  order_status: z.enum(["pending", "confirmed", "paid", "cancelled"]).default("pending"),
  total_amount: z.number().min(0.01, { message: "Total amount is required and must be greater than 0" }),
  deposit_amount: z.number().min(0.01, { message: "Deposit amount is required and must be greater than 0" }),
  balance_amount: z.number().min(0, { message: "Balance amount cannot be negative" }),
   order_details: z.object({
     tax: z.number().min(0, { message: "Tax percentage cannot be negative" }).max(100, { message: "Tax percentage cannot exceed 100%" }),
     items: z.array(z.object({
       name: z.string().min(1, { message: "Service name is required" }),
       price: z.number().min(0.01, { message: "Price must be greater than 0" }),
       quantity: z.number().min(1, { message: "Quantity must be at least 1" }),
     })),
     total: z.number().min(0.01, { message: "Total must be greater than 0" }),
     subtotal: z.number().min(0, { message: "Subtotal cannot be negative" }),
   }),
}).refine((data) => {
  return data.deposit_amount + data.balance_amount === data.total_amount;
}, {
  message: "Deposit amount plus balance amount must equal total amount",
  path: ["balance_amount"],
});

type OrderFormValues = z.infer<typeof orderSchema>;

interface OrderFormProps {
  onSubmit: (data: OrderFormValues) => void;
  isLoading?: boolean;
  initialValues?: Partial<OrderFormValues>;
}

export function OrderForm({ onSubmit, isLoading = false, initialValues }: OrderFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!initialValues;
  const [services, setServices] = useState<Array<{ name: string; price: number; quantity: number }>>(initialValues?.order_details?.items || []);
  const [newService, setNewService] = useState({ name: "", price: undefined, quantity: 1 });

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_name: "",
      email: "",
      contact_number: "",
      event_date: undefined,
      event_time: "",
      payment_option: "paid_offline",
      order_status: "pending",
      total_amount: undefined,
      deposit_amount: undefined,
      balance_amount: undefined,
      order_details: {
        subtotal: undefined,
        tax: undefined,
        total: undefined,
        items: []
      },
      ...(initialValues || {})
    }
  });

  const addService = () => {
    if (newService.name && newService.price !== undefined && newService.price > 0) {
      setServices([...services, newService]);
      const currentItems = form.getValues("order_details.items") || [];
      form.setValue("order_details.items", [...currentItems, newService]);
      setNewService({ name: "", price: undefined, quantity: 1 });
      updateAmounts();
    }
  };

  const removeService = (index: number) => {
    const updatedServices = services.filter((_, i) => i !== index);
    setServices(updatedServices);
    form.setValue("order_details.items", updatedServices);
    updateAmounts();
  };

     const updateService = (index: number, field: 'name' | 'price' | 'quantity', val: string) => {
    const updated = services.map((sv, i) => {
      if (i !== index) return sv;
      if (field === 'name') return { ...sv, name: val };
      const n = val === '' ? 0 : Number(val);
      return { ...sv, [field]: field === 'quantity' ? Math.max(1, Math.floor(n) || 1) : Math.max(0, n) };
    });
    setServices(updated);
    form.setValue("order_details.items", updated, { shouldDirty: true, shouldValidate: true });
    updateAmounts();
  };

const updateAmounts = () => {
     const items = form.getValues("order_details.items") || [];
     const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
     const taxPercentage = form.getValues("order_details.tax") || 0;
     // Calculate actual tax amount from percentage
     const taxAmount = (taxPercentage / 100) * subtotal;
     const total = subtotal + taxAmount;

     form.setValue("order_details.subtotal", subtotal, {
       shouldValidate: true,
       shouldDirty: true,
       shouldTouch: true
     });
     form.setValue("order_details.total", total, {
       shouldValidate: true,
       shouldDirty: true,
       shouldTouch: true
     });
     form.setValue("total_amount", total, {
       shouldValidate: true,
       shouldDirty: true,
       shouldTouch: true
     });
     // keep deposit $ fixed; balance follows the new total
     const dep = form.getValues("deposit_amount") || 0;
     form.setValue("balance_amount", total - dep, {
       shouldValidate: true,
       shouldDirty: true,
       shouldTouch: true
     });
   };

  const handleSubmit = async (values: OrderFormValues) => {
    console.log('Form submitted with values:', values);
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

   const handleTaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     e.preventDefault();
     const value = parseFloat(e.target.value) || 0;

     // Validate tax percentage is between 0 and 100
     if (value > 100) {
       form.setError("order_details.tax", {
         type: "manual",
         message: "Tax percentage cannot be greater than 100%"
       });
       return;
     }

     if (value < 0) {
       form.setError("order_details.tax", {
         type: "manual",
         message: "Tax percentage cannot be negative"
       });
       return;
     }

     form.clearErrors("order_details.tax");
     form.setValue("order_details.tax", value, {
       shouldValidate: true,
       shouldDirty: true,
       shouldTouch: true
     });
     updateAmounts();
   };

  const handleDepositChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Deposit changed:', e.target.value);
    e.preventDefault();
    let percentage = parseFloat(e.target.value) || 0;
    if (percentage > 100) {
      percentage = 100;
      e.target.value = "100";
    }
    if (percentage < 0) {
      percentage = 0;
      e.target.value = "0";
    }
    const total = form.getValues("total_amount") || 0;
    const value = Math.round(((percentage / 100) * total) * 100) / 100;

    form.setValue("deposit_amount", value, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true
    });
    form.setValue("balance_amount", Math.round((total - value) * 100) / 100, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true
    });
  };

  return (
    <div className="space-y-4">
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="space-y-4 pt-4">
          <div className="flex justify-between items-start pb-3 border-b">
            <div className="flex items-center gap-3">
              <div className="bg-[#4b1248] rounded-lg p-1.5">
                <img src="https://jnvspectra.com/jnvSpectraLogoBold.png" alt="JNV Spectra" className="h-12 w-12 object-contain" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#4b1248]">JNV Spectra</h2>
                <p className="text-xs text-gray-500">Event Management &amp; Rentals</p>
                <p className="text-xs text-gray-500">info@jnvspectra.com&nbsp;&nbsp;|&nbsp;&nbsp;+1 (941) 773-3879</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-800">{isEdit ? "Update Order" : "New Order"}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>
          </div>
          <Form {...form}>
            <form 
              onSubmit={form.handleSubmit(handleSubmit)} 
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customer_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="John Doe" 
                          {...field}
                          onChange={(e) => {
                            e.preventDefault();
                            field.onChange(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="john@example.com" 
                          {...field}
                          onChange={(e) => {
                            e.preventDefault();
                            field.onChange(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl>
                        <Input 
                          type="tel" 
                          placeholder="+1 234 567 8900" 
                          {...field}
                          onChange={(e) => {
                            e.preventDefault();
                            field.onChange(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="event_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Event Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="event_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Time</FormLabel>
                      <FormControl>
                        <Input 
                          type="time" 
                          {...field}
                          onChange={(e) => {
                            e.preventDefault();
                            field.onChange(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold text-gray-500">Item summary</p>

                <div>
                  {(
                    <div className="border rounded overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b text-left">
                            <th className="px-3 py-2 font-semibold">Item summary</th>
                            <th className="px-3 py-2 font-semibold w-16">Qty</th>
                            <th className="px-3 py-2 font-semibold w-24 text-right">Rate</th>
                            <th className="px-3 py-2 font-semibold w-24 text-right">Total</th>
                            <th className="px-3 py-2 w-16"></th>
                          </tr>
                        </thead>
                        <tbody>
                  {services.map((service, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="px-2 py-1">
                        <Input className="h-8 border-0 shadow-none px-1" value={service.name} onChange={(e) => updateService(index, 'name', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <Input className="h-8 w-16 border-0 shadow-none px-1 text-center" type="number" min={1} value={service.quantity} onChange={(e) => updateService(index, 'quantity', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <Input className="h-8 w-24 border-0 shadow-none px-1 text-right" type="number" min={0} step="0.01" value={service.price} onChange={(e) => updateService(index, 'price', e.target.value)} />
                      </td>
                      <td className="px-3 py-2 text-right">${(service.price * service.quantity).toFixed(2)}</td>
                      <td className="px-3 py-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-500 hover:text-red-600"
                        onClick={() => removeService(index)}
                      >
                        Remove
                      </Button>
                      </td>
                    </tr>
                  ))}
                          <tr className="bg-gray-50/60">
                            <td className="px-2 py-1">
                              <Input className="h-8 border-0 shadow-none px-1 bg-transparent" placeholder="New item..."
                                value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
                            </td>
                            <td className="px-2 py-1">
                              <Input className="h-8 w-16 border-0 shadow-none px-1 text-center bg-transparent" type="number" min={1} placeholder="1"
                                value={newService.quantity} onChange={(e) => setNewService({ ...newService, quantity: parseInt(e.target.value) || 1 })} />
                            </td>
                            <td className="px-2 py-1">
                              <Input className="h-8 w-24 border-0 shadow-none px-1 text-right bg-transparent" type="number" min={0} step="0.01" placeholder="0.00"
                                value={newService.price === undefined ? "" : newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value === "" ? undefined : parseFloat(e.target.value) })} />
                            </td>
                            <td className="px-3 py-2 text-right text-gray-400">—</td>
                            <td className="px-3 py-2 text-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button type="button" variant="ghost" size="sm"
                                    className="h-7 w-7 p-0 text-[#4b1248] hover:text-[#4b1248]/70"
                                    onClick={addService}
                                    disabled={!newService.name || newService.price === undefined || newService.price <= 0}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5v14"/></svg>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-[#4b1248] text-white text-xs">Click here to add to invoice</TooltipContent>
                              </Tooltip>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                   control={form.control}
                   name="order_details.tax"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Tax (%)</FormLabel>
                       <FormControl>
                         <Input
                           type="number"
                           min="0"
                           max="100"
                           step="0.01"
                           placeholder="Enter tax percentage (0-100)"
                           value={field.value}
                           onChange={handleTaxChange}
                         />
                       </FormControl>
                       <FormDescription>Enter tax percentage (e.g., 5 for 5%)</FormDescription>
                       <FormMessage />
                     </FormItem>
                   )}
                 />

                <FormField
                  control={form.control}
                  name="total_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Amount</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0"
                          step="0.01"
                          {...field}
                          disabled
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deposit_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deposit Percentage</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0"
                          max="100"
                          step="1"
                          value={field.value ? Math.round((field.value / form.getValues("total_amount")) * 100) : ""}
                          onChange={handleDepositChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="balance_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Balance Amount</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0"
                          step="0.01"
                          {...field}
                          disabled
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_option"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Option</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="paid_offline" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Pay Offline
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="online" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Pay Online
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={isSubmitting || isLoading}
                >
                  {isSubmitting || isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    isEdit ? "Update Order" : "Create Order"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
