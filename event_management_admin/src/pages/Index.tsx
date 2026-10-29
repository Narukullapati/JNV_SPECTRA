import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { Calendar, DollarSign, Package, ShoppingBag, Loader2, RefreshCw } from "lucide-react";
import { useDashboardStats } from "@/api/analytics";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

const formatDateInputValue = (value: string) => {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return new Date(year, month - 1, day).toLocaleDateString();
};

export default function Index() {
  const navigate = useNavigate();
  const [timeFrame, setTimeFrame] = useState<string>("30");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");
  const { toast } = useToast();
  
  // Fetch dashboard stats with auto-refresh every 30 seconds
  const { data, isLoading, error, refetch } = useDashboardStats({
    timeFrame: parseInt(timeFrame, 10),
    fromDate: appliedFromDate || undefined,
    toDate: appliedToDate || undefined,
  }, 30000);
  const stats = data?.data;
  const hasAppliedCustomRange = Boolean(appliedFromDate && appliedToDate);
  const rangeDescription = hasAppliedCustomRange
    ? `${formatDateInputValue(appliedFromDate)} - ${formatDateInputValue(appliedToDate)}`
    : `Last ${timeFrame} days`;

  const handleTimeFrameChange = (value: string) => {
    setTimeFrame(value);
    setFromDate("");
    setToDate("");
    setAppliedFromDate("");
    setAppliedToDate("");
  };

  const handleApplyDateRange = () => {
    if (!fromDate || !toDate) {
      toast({
        title: "Date range required",
        description: "Select both From Date and To Date.",
        variant: "destructive",
      });
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      toast({
        title: "Invalid date range",
        description: "From Date must be before or equal to To Date.",
        variant: "destructive",
      });
      return;
    }

    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
  };

  const handleClearDateRange = () => {
    setFromDate("");
    setToDate("");
    setAppliedFromDate("");
    setAppliedToDate("");
  };

  // Function to manually refresh data
  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshing dashboard data",
      description: "Dashboard statistics are being updated.",
    });
  };

  // Render loading skeletons when data is being fetched
  const renderStatsCardSkeleton = () => (
    <div className="rounded-lg border p-6 space-y-2">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/5 mt-2" />
      <Skeleton className="h-3 w-1/4 mt-1" />
    </div>
  );

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Dashboard Overview</h1>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <Button 
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Data
              </>
            )}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Preset:</span>
            <Select value={timeFrame} onValueChange={handleTimeFrameChange}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Time Frame" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">From:</span>
            <Input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">To:</span>
            <Input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-40"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleApplyDateRange}
            disabled={isLoading || !fromDate || !toDate}
          >
            Apply Range
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearDateRange}
            disabled={isLoading || (!fromDate && !toDate && !hasAppliedCustomRange)}
          >
            Clear Range
          </Button>
        </div>
      </div>
      {hasAppliedCustomRange && (
        <div className="mb-4 text-sm text-muted-foreground">
          Using custom range: {formatDateInputValue(appliedFromDate)} to{" "}
          {formatDateInputValue(appliedToDate)}
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 jnv-stagger">
        {isLoading ? (
          <>
            {renderStatsCardSkeleton()}
            {renderStatsCardSkeleton()}
            {renderStatsCardSkeleton()}
            {renderStatsCardSkeleton()}
          </>
        ) : error ? (
          <div className="col-span-4 p-4 border rounded-lg bg-red-50 text-red-500">
            Error loading dashboard data. Please try again later.
          </div>
        ) : stats ? (
          <>
            <StatsCard 
              title="Total Revenue" 
              value={formatCurrency(stats.totalRevenue?.value || 0)} 
              description={rangeDescription}
              icon={<DollarSign />}
              trend={stats.totalRevenue?.trend || { value: 0, isPositive: true }}
            />
            <StatsCard 
              title="Active Services" 
              value={(stats.activeServices?.value || 0).toString()} 
              description="All services"
              icon={<Package />}
              trend={stats.activeServices?.trend || { value: 0, isPositive: true }}
            />
            <StatsCard 
              title="New Orders" 
              value={(stats.newOrders?.value || 0).toString()} 
              description="Last 7 days"
              icon={<ShoppingBag />}
              trend={stats.newOrders?.trend || { value: 0, isPositive: true }}
            />
            <StatsCard 
              title="Active Events" 
              value={(stats.activeEvents?.value || 0).toString()} 
              description="Currently active"
              icon={<Calendar />}
              trend={stats.activeEvents?.trend || { value: 0, isPositive: true }}
            />
          </>
        ) : null}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 jnv-stagger items-start">
        {isLoading ? (
          <>
            <div className="rounded-lg border p-6 space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <div className="space-y-3">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center justify-between pb-3 border-b">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border rounded-lg p-6 flex flex-col items-center justify-center">
              <Skeleton className="h-12 w-12 rounded-full mb-4" />
              <Skeleton className="h-6 w-36 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          </>
        ) : stats ? (
          <>
            <RecentOrders orders={stats.recentOrders} />
            
            {/* Orders Growth Card */}
            <div className="jnv-grad-card border rounded-lg p-6 flex flex-col items-center justify-center shadow-lg">
              <ShoppingBag size={48} className="mb-4 jnv-pulse-gold" />
              <h3 className="text-lg font-semibold mb-1">Orders Growth</h3>
              <p className="text-sm opacity-90">
                {stats.newOrders.trend.isPositive ? '+' : ''}{stats.newOrders.trend.value}% from last period
              </p>
            </div>

            {/* Quick Actions */}
            <div className="bg-card border rounded-lg p-6 flex flex-col justify-center">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Orders', path: '/orders', icon: <ShoppingBag className="h-4 w-4" /> },
                  { label: 'Venues', path: '/venues', icon: <Calendar className="h-4 w-4" /> },
                  { label: 'Services', path: '/services', icon: <Package className="h-4 w-4" /> },
                  { label: 'Rentals', path: '/rentals', icon: <DollarSign className="h-4 w-4" /> },
                ].map((a) => (
                  <button
                    key={a.path}
                    onClick={() => navigate(a.path)}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all hover:border-[#6c2e70] hover:bg-[#6c2e70] hover:text-white hover:shadow-md"
                  >
                    {a.icon}
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Order Status Breakdown */}
            <div className="bg-card border rounded-lg p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold mb-4">Recent Orders Status</h3>
              {(() => {
                const orders = stats.recentOrders || [];
                const counts = orders.reduce((acc: Record<string, number>, o: any) => {
                  const st = (o.order_status || o.status || 'pending').toLowerCase();
                  acc[st] = (acc[st] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);
                const colors: Record<string, string> = { pending: '#e0a422', confirmed: '#16a34a', paid: '#4b1248', cancelled: '#dc2626', completed: '#16a34a' };
                const total = orders.length || 1;
                const entries = Object.entries(counts);
                if (!entries.length) return <p className="text-sm text-muted-foreground">No recent orders</p>;
                return (
                  <div className="space-y-3">
                    {entries.map(([st, n]) => (
                      <div key={st} className="flex items-center gap-3">
                        <span className="text-sm capitalize w-24">{st}</span>
                        <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(n / total) * 100}%`, background: colors[st] || '#6c2e70' }} />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{n}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </>
        ) : null}
      </div>

      {/* Financial + monthly trends */}
      {stats ? (() => {
        const orders = stats.recentOrders || [];
        const num = (v: any) => Number(v) || 0;
        const billed = orders.reduce((a: number, o: any) => a + num(o.total_amount), 0);
        const pending = orders.reduce((a: number, o: any) =>
          (o.order_status || 'pending') !== 'paid' ? a + num(o.balance_amount) : a, 0);
        const online = orders.filter((o: any) => o.payment_option === 'online');
        const offline = orders.filter((o: any) => o.payment_option === 'paid_offline');
        const onlineAmt = online.reduce((a: number, o: any) => a + num(o.total_amount), 0);
        const offlineAmt = offline.reduce((a: number, o: any) => a + num(o.total_amount), 0);
        const byMonth = orders.reduce((acc: Record<string, number>, o: any) => {
          const d = new Date(o.event_date || o.created_at);
          if (isNaN(d.getTime())) return acc;
          const k = d.toLocaleString('en-US', { month: 'short' });
          acc[k] = (acc[k] || 0) + num(o.total_amount);
          return acc;
        }, {} as Record<string, number>);
        const months = Object.entries(byMonth).slice(-6);
        const maxM = Math.max(...months.map(([, v]) => v), 1);
        const card = 'bg-card border rounded-lg p-4';
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 jnv-stagger">
            <div className={card}>
              <p className="text-xs text-muted-foreground mb-1">Total Billed</p>
              <p className="text-xl font-bold">{formatCurrency(billed)}</p>
              <p className="text-xs text-muted-foreground mt-1">{orders.length} recent orders</p>
            </div>
            <div className={card}>
              <p className="text-xs text-muted-foreground mb-1">Balance Pending</p>
              <p className="text-xl font-bold text-[#e0a422]">{formatCurrency(pending)}</p>
              <p className="text-xs text-muted-foreground mt-1">unpaid balances</p>
            </div>
            <div className={card}>
              <p className="text-xs text-muted-foreground mb-1">Online Payments</p>
              <p className="text-xl font-bold">{formatCurrency(onlineAmt)}</p>
              <p className="text-xs text-muted-foreground mt-1">{online.length} online · {offline.length} offline ({formatCurrency(offlineAmt)})</p>
            </div>
            <div className={card}>
              <p className="text-xs text-muted-foreground mb-2">Monthly Trend</p>
              <div className="space-y-1.5">
                {months.map(([m, v]) => (
                  <div key={m} className="flex items-center gap-2">
                    <span className="text-xs w-8">{m}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(v / maxM) * 100}%`, background: 'linear-gradient(90deg,#6c2e70,#e0a422)' }} />
                    </div>
                  </div>
                ))}
                {!months.length && <p className="text-xs text-muted-foreground">No data</p>}
              </div>
            </div>
          </div>
        );
      })() : null}
    </DashboardLayout>
  );
}
