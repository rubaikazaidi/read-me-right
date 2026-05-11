import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, X, UserPlus, Clock, GraduationCap, Mail, Hash } from "lucide-react";
import { format } from "date-fns";

interface JoinRequest {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  grade: string | null;
  age: number | null;
  gr_number: string | null;
  account_created_at: string;
  requested_at: string;
  status: string;
}

export const JoinRequestsPanel = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("organization_join_requests")
      .select("id, user_id, full_name, email, grade, age, gr_number, account_created_at, requested_at, status")
      .eq("status", "pending")
      .order("requested_at", { ascending: false });

    if (!error && data) setRequests(data as JoinRequest[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id: string) => {
    setActingId(id);
    const { error } = await supabase.rpc("approve_join_request", { _request_id: id });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Approved", description: "Student added to your organization." });
      setRequests((r) => r.filter((x) => x.id !== id));
    }
    setActingId(null);
  };

  const handleDecline = async (id: string) => {
    setActingId(id);
    const { error } = await supabase.rpc("decline_join_request", { _request_id: id });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Declined", description: "Request declined." });
      setRequests((r) => r.filter((x) => x.id !== id));
    }
    setActingId(null);
  };

  if (loading) {
    return <p className="text-xs text-muted-foreground px-2">Loading…</p>;
  }

  if (requests.length === 0) {
    return <p className="text-xs text-muted-foreground px-2">No pending requests.</p>;
  }

  return (
    <div className="space-y-2 px-2">
      {requests.map((req) => (
        <div
          key={req.id}
          className="rounded-lg border bg-card p-3 space-y-2 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <UserPlus className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-sm truncate">{req.full_name}</span>
            </div>
            <Badge variant="outline" className="text-[10px]">Pending</Badge>
          </div>

          <div className="space-y-1 text-[11px] text-muted-foreground">
            {req.email && (
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{req.email}</span>
              </div>
            )}
            {req.grade && (
              <div className="flex items-center gap-1.5">
                <GraduationCap className="h-3 w-3 shrink-0" />
                <span>Grade {req.grade}{req.age ? ` · Age ${req.age}` : ""}</span>
              </div>
            )}
            {req.gr_number && (
              <div className="flex items-center gap-1.5">
                <Hash className="h-3 w-3 shrink-0" />
                <span>{req.gr_number}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 pt-1">
              <Clock className="h-3 w-3 shrink-0" />
              <span>Requested {format(new Date(req.requested_at), "MMM d, h:mm a")}</span>
            </div>
            <div className="text-[10px] opacity-80">
              Account created {format(new Date(req.account_created_at), "MMM d, yyyy")}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={() => handleApprove(req.id)}
              disabled={actingId === req.id}
            >
              <Check className="h-3 w-3 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 flex-1 text-xs"
              onClick={() => handleDecline(req.id)}
              disabled={actingId === req.id}
            >
              <X className="h-3 w-3 mr-1" /> Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
