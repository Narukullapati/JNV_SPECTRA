import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export const useAuditLogs = () =>
  useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => (await fetchApi("/api/v1/audit-logs")).data,
  });
