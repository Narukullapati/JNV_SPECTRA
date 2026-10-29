import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
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
      
      {/* Financial + monthly trends */}
      {stats ? (() => {
        const nowM = new Date();
        const orders = (stats.recentOrders || []).filter((o: any) => {
          const d = new Date(o.date || o.created_at || o.event_date);
          return !isNaN(d.getTime()) && d.getMonth() === nowM.getMonth() && d.getFullYear() === nowM.getFullYear();
        });
        const num = (v: any) => Number(v) || 0;
        const billed = orders.reduce((a: number, o: any) => a + num(o.total ?? o.total_amount), 0);
        const online = orders.filter((o: any) => (o.payment_option === 'online' || o.payment === 'online'));
        const offline = orders.filter((o: any) => (o.payment_option === 'paid_offline' || o.payment === 'paid_offline'));
        const onlineAmt = online.reduce((a: number, o: any) => a + num(o.total ?? o.total_amount), 0);
        const offlineAmt = offline.reduce((a: number, o: any) => a + num(o.total ?? o.total_amount), 0);
        const pending = Math.max(billed - (onlineAmt + offlineAmt), 0);
        const card = 'bg-card border rounded-xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all';
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 jnv-stagger">
            <div className={card}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Total Billed</p>
              <p className="text-xl font-bold">{formatCurrency(billed)}</p>
              <p className="text-xs text-muted-foreground mt-1">{orders.length} orders this month</p>
            </div>
            <div className={card}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Balance Pending</p>
              <p className="text-xl font-bold text-[#e0a422]">{formatCurrency(pending)}</p>
              <p className="text-xs text-muted-foreground mt-1">unpaid balances</p>
            </div>
            <div className={card}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Online Payments</p>
              <p className="text-xl font-bold">{formatCurrency(onlineAmt)}</p>
              <p className="text-xs text-muted-foreground mt-1">{online.length} orders</p>
            </div>
            <div className={card}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Offline Payments</p>
              <p className="text-xl font-bold">{formatCurrency(offlineAmt)}</p>
              <p className="text-xs text-muted-foreground mt-1">{offline.length} orders</p>
            </div>
          </div>
        );
      })() : null}

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
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 jnv-stagger items-start">
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
            
            <div className="flex flex-col gap-6">
            {/* Monthly Orders Chart */}
            <div className="bg-card border rounded-lg p-5 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Orders — Last 6 Months</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthlyTrend || []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="35%">
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip formatter={(v: any) => [v, 'Orders']} />
                    <Bar dataKey="orders" radius={[4, 4, 0, 0]} style={{ filter: 'drop-shadow(3px 3px 0 rgba(60,10,60,.35))' }}>
                      {(stats.monthlyTrend || []).map((_: any, i: number) => (
                        <Cell key={i} fill={i % 2 === 0 ? '#6c2e70' : '#e0a422'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payments — Last 6 Months */}
            <div className="bg-card border rounded-lg p-5 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Payments — Last 6 Months</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(stats.monthlyTrend || []).map((m: any) => ({
                      month: m.month,
                      online: m.online || 0,
                      offline: m.offline || 0,
                      pending: Math.max((m.billed || 0) - (m.online || 0) - (m.offline || 0), 0),
                    }))}
                    margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="30%">
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip formatter={(v: any, name: any) => [formatCurrency(v), name]} />
                    <Bar dataKey="online" name="Online" fill="#6c2e70" radius={[3, 3, 0, 0]} style={{ filter: 'drop-shadow(2px 2px 0 rgba(60,10,60,.3))' }} />
                    <Bar dataKey="offline" name="Offline" fill="#e0a422" radius={[3, 3, 0, 0]} style={{ filter: 'drop-shadow(2px 2px 0 rgba(120,80,10,.3))' }} />
                    <Bar dataKey="pending" name="Pending" fill="#9ca3af" radius={[3, 3, 0, 0]} style={{ filter: 'drop-shadow(2px 2px 0 rgba(80,80,80,.25))' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{background:'#6c2e70'}} />Online</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{background:'#e0a422'}} />Offline</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{background:'#9ca3af'}} />Pending</span>
              </div>
            </div>
            </div>

          </>
        ) : null}
      </div>

    </DashboardLayout>
  );
}
