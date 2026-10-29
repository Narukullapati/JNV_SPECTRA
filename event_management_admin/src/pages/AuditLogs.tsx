import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuditLogs } from "@/api/auditLogs";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

const colDefs: any[] = [
  { headerName: "#", width: 70, valueGetter: (p: any) => (p.node ? p.node.rowIndex + 1 : "") },
  { headerName: "Time", field: "created_at", flex: 1.2, minWidth: 170,
    valueFormatter: (p: any) => new Date(p.value).toLocaleString("en-US", { timeZone: "America/New_York" }) },
  { headerName: "User", field: "user_email", flex: 1.4, minWidth: 180 },
  { headerName: "Action", field: "action", flex: 1, minWidth: 140 },
  { headerName: "IP Address", field: "ip_address", flex: 1, minWidth: 130 },
  { headerName: "Entity", field: "entity", flex: 0.7, minWidth: 90 },
  { headerName: "Entity ID", field: "entity_id", flex: 1.4, minWidth: 180 },
  { headerName: "Details", field: "details", flex: 2, minWidth: 220 },
];

export default function AuditLogs() {
  const { data, isLoading } = useAuditLogs();
  const rows = data?.data || [];
  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Audit Log</h1>
      </div>
      <div className="ag-theme-quartz" style={{ height: Math.max(320, window.innerHeight - 200), width: "100%" }}>
        <AgGridReact
          theme={themeQuartz}
          rowData={rows}
          columnDefs={colDefs}
          defaultColDef={{ sortable: true, filter: true, floatingFilter: true, resizable: true }}
          pagination={true}
          paginationPageSize={20}
          loading={isLoading}
          autoSizeStrategy={{ type: "fitGridWidth" }}
        />
      </div>
    </DashboardLayout>
  );
}
