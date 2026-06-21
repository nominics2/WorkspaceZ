"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { 
  PlaneTakeoff, 
  Plus, 
  Loader2, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronRight, 
  Info, 
  User, 
  ClipboardCheck, 
  MoreVertical,
  History,
  ShieldCheck,
  Stethoscope,
  Activity,
  FilterX,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSearchParams } from "next/navigation";

const LEAVE_TYPES = [
  { id: 'annual_leave', label: 'Annual Holiday', icon: PlaneTakeoff, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  { id: 'sick_leave', label: 'Medical Leave', icon: Activity, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10' },
  { id: 'frl', label: 'FRL Request', icon: ShieldCheck, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  { id: 'other', label: 'Other / Compassionate', icon: Info, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' },
];

export default function LeavePage() {
  const { activeWorkspace, userProfile, userRole, hasPermission } = useWorkspace();
  const searchParams = useSearchParams();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    startDate: new Date().toISOString().split('T')[0],
    days: "1",
    type: "annual_leave",
    reason: ""
  });
  const [calculatedDates, setCalculatedDates] = useState<{ endDate: string | null, returnDate: string | null }>({
    endDate: null,
    returnDate: null
  });

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedLeave, setSelectedTask] = useState<any>(null);
  const [reviewRemark, setReviewRemark] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // Deletion state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [leaveToDelete, setLeaveToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  const isAdmin = userRole === 'superadmin' || userRole === 'admin';
  const isSuperAdmin = userRole === 'superadmin';
  const canApprove = isAdmin || hasPermission('approve_leave_requests');

  const forceUnlockUI = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = "auto";
      document.body.style.overflow = "auto";
      setTimeout(() => {
        document.body.style.pointerEvents = "";
        document.body.style.overflow = "";
      }, 300);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leave_requests_view')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeaves(data || []);

      const requestId = searchParams.get('id');
      if (requestId) {
        const found = data?.find(l => l.id === requestId);
        if (found) handleOpenDetail(found);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, supabase, toast, searchParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDetail = (leave: any) => {
    setSelectedTask(leave);
    setReviewRemark(leave.manager_reason || "");
    setIsDetailOpen(true);
  };

  const calculateDates = useCallback(async () => {
    const days = parseInt(applyForm.days);
    if (!applyForm.startDate || isNaN(days) || days < 1) return;

    try {
      const [endRes, returnRes] = await Promise.all([
        supabase.rpc('calculate_leave_end_date_excluding_fridays', { p_start_date: applyForm.startDate, p_number_of_days: days }),
        supabase.rpc('calculate_leave_return_date_excluding_fridays', { p_start_date: applyForm.startDate, p_number_of_days: days })
      ]);

      setCalculatedDates({
        endDate: endRes.data,
        returnDate: returnRes.data
      });
    } catch (err) {}
  }, [applyForm.startDate, applyForm.days, supabase]);

  useEffect(() => {
    calculateDates();
  }, [calculateDates]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !applyForm.reason.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('create_leave_request', {
        p_workspace_id: activeWorkspace.id,
        p_start_date: applyForm.startDate,
        p_number_of_days: parseInt(applyForm.days),
        p_leave_type: applyForm.type,
        p_reason: applyForm.reason.trim()
      });

      if (error) throw error;

      toast({ title: "Request Submitted", description: "Your leave request has been sent for review." });
      setIsApplyModalOpen(false);
      setApplyForm({ startDate: new Date().toISOString().split('T')[0], days: "1", type: "annual_leave", reason: "" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Application Failed", description: err.message });
    } finally {
      setSaving(false);
      forceUnlockUI();
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const { error } = await supabase.rpc('cancel_leave_request', { p_leave_request_id: id });
      if (error) throw error;
      toast({ title: "Request Cancelled" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Action Failed", description: err.message });
    } finally {
      forceUnlockUI();
    }
  };

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedLeave || !reviewRemark.trim()) {
      toast({ variant: "destructive", title: "Remark Required", description: "Please provide a remark for the applicant." });
      return;
    }
    setReviewing(true);
    try {
      const { error } = await supabase.rpc('review_leave_request', {
        p_leave_request_id: selectedLeave.id,
        p_status: status,
        p_manager_reason: reviewRemark.trim()
      });

      if (error) throw error;

      toast({ title: `Request ${status.toUpperCase()}` });
      setIsDetailOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Review Failed", description: err.message });
    } finally {
      setReviewing(false);
      forceUnlockUI();
    }
  };

  const handleDelete = async () => {
    if (!leaveToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_leave_request", {
        p_leave_request_id: leaveToDelete.id
      });

      if (error) {
        console.error("[Leave Delete] Error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      toast({ title: "Leave request deleted." });
      setIsDeleteDialogOpen(false);
      setLeaveToDelete(null);
      setIsDetailOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "Deletion Failed", 
        description: err.message || "An unexpected error occurred." 
      });
    } finally {
      setDeleting(false);
      forceUnlockUI();
    }
  };

  const myLeaves = useMemo(() => leaves.filter(l => l.user_id === userProfile?.id), [leaves, userProfile]);
  const teamLeaves = useMemo(() => leaves.filter(l => l.status === 'approved'), [leaves]);
  const pendingApprovals = useMemo(() => leaves.filter(l => l.status === 'pending' && l.user_id !== userProfile?.id), [leaves, userProfile]);
  const approvedHistory = useMemo(() => leaves.filter(l => l.status === 'approved' && l.user_id !== userProfile?.id), [leaves, userProfile]);
  const rejectedHistory = useMemo(() => leaves.filter(l => l.status === 'rejected' && l.user_id !== userProfile?.id), [leaves, userProfile]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <PlaneTakeoff className="w-8 h-8 text-primary" /> Leave & Absence
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Manage your time off and view team presence.</p>
        </div>
        <Button onClick={() => setIsApplyModalOpen(true)} className="rounded-2xl h-12 px-8 shadow-xl shadow-primary/20 gap-2">
          <Plus className="w-5 h-5" /> Apply for Leave
        </Button>
      </div>

      <Tabs defaultValue="my_requests" className="space-y-6">
        <TabsList className="bg-white dark:bg-slate-900 p-1 border dark:border-slate-800 rounded-xl w-full flex overflow-x-auto no-scrollbar">
          <TabsTrigger value="my_requests" className="rounded-lg px-6 font-bold flex-1 md:flex-none">My Requests</TabsTrigger>
          <TabsTrigger value="team_schedule" className="rounded-lg px-6 font-bold flex-1 md:flex-none">Team Schedule</TabsTrigger>
          {canApprove && (
            <TabsTrigger value="management" className="rounded-lg px-6 font-bold flex items-center gap-2 flex-1 md:flex-none">
              Management {pendingApprovals.length > 0 && <Badge className="h-4 px-1 bg-primary text-[10px]">{pendingApprovals.length}</Badge>}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my_requests" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {myLeaves.length === 0 ? (
              <EmptyState message="You haven't applied for any leave yet." />
            ) : (
              myLeaves.map(leave => (
                <LeaveCard 
                  key={leave.id} 
                  leave={leave} 
                  onOpen={() => handleOpenDetail(leave)} 
                  onDelete={() => { setLeaveToDelete(leave); setIsDeleteDialogOpen(true); }}
                  isMe 
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="team_schedule" className="space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teamLeaves.length === 0 ? (
                <EmptyState message="No approved leaves at the moment." />
              ) : (
                teamLeaves.map(leave => (
                  <LeaveCard key={leave.id} leave={leave} onOpen={() => handleOpenDetail(leave)} />
                ))
              )}
           </div>
        </TabsContent>

        {canApprove && (
          <TabsContent value="management" className="space-y-6">
            <Tabs defaultValue="pending">
              <TabsList className="bg-slate-100 dark:bg-slate-950 p-1 rounded-lg">
                <TabsTrigger value="pending" className="text-xs font-bold">Pending ({pendingApprovals.length})</TabsTrigger>
                <TabsTrigger value="approved" className="text-xs font-bold">Approved</TabsTrigger>
                <TabsTrigger value="rejected" className="text-xs font-bold">Rejected</TabsTrigger>
              </TabsList>
              
              <TabsContent value="pending" className="mt-4 space-y-4">
                {pendingApprovals.length === 0 ? <EmptyState message="No pending requests to review." /> : pendingApprovals.map(l => <LeaveCard key={l.id} leave={l} onOpen={() => handleOpenDetail(l)} isManagement />)}
              </TabsContent>
              <TabsContent value="approved" className="mt-4 space-y-4">
                {approvedHistory.length === 0 ? <EmptyState message="No approved requests found." /> : approvedHistory.map(l => <LeaveCard key={l.id} leave={l} onOpen={() => handleOpenDetail(l)} isManagement />)}
              </TabsContent>
              <TabsContent value="rejected" className="mt-4 space-y-4">
                {rejectedHistory.length === 0 ? <EmptyState message="No rejected requests found." /> : rejectedHistory.map(l => <LeaveCard key={l.id} leave={l} onOpen={() => handleOpenDetail(l)} isManagement />)}
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}
      </Tabs>

      {/* Apply Modal */}
      <Dialog open={isApplyModalOpen} onOpenChange={(open) => { if (!saving) { setIsApplyModalOpen(open); if (!open) forceUnlockUI(); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden dark:bg-slate-950 dark:border-slate-800 rounded-[2.5rem] shadow-2xl border-none">
          <div className="bg-primary h-2 w-full" />
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold">Apply for Leave</DialogTitle>
              <DialogDescription>Submit your time-off request. Fridays are automatically excluded.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleApply} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Starts On</Label>
                  <Input type="date" value={applyForm.startDate} onChange={e => setApplyForm({...applyForm, startDate: e.target.value})} required className="rounded-xl h-11 dark:bg-slate-900 border-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Duration (Days)</Label>
                  <Input type="number" min="1" max="30" value={applyForm.days} onChange={e => setApplyForm({...applyForm, days: e.target.value})} required className="rounded-xl h-11 dark:bg-slate-900 border-none" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Leave Category</Label>
                <Select value={applyForm.type} onValueChange={v => setApplyForm({...applyForm, type: v})}>
                  <SelectTrigger className="h-11 rounded-xl dark:bg-slate-900 border-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 rounded-xl">
                    {LEAVE_TYPES.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Reason / Purpose</Label>
                <Textarea value={applyForm.reason} onChange={e => setApplyForm({...applyForm, reason: e.target.value})} placeholder="Why are you taking leave?" rows={3} required className="rounded-xl dark:bg-slate-900 border-none resize-none" />
              </div>

              {calculatedDates.endDate && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">End Date:</span>
                    <span className="font-bold">{format(parseISO(calculatedDates.endDate), "PPP")}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Return Date:</span>
                    <span className="font-bold text-primary">{format(parseISO(calculatedDates.returnDate!), "PPP")}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic flex items-center gap-1 mt-1">
                    <Info className="w-3 h-3" /> Fridays are not counted as leave days.
                  </p>
                </div>
              )}

              <DialogFooter className="gap-3 flex-row pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsApplyModalOpen(false)} disabled={saving} className="flex-1 rounded-xl h-12">Cancel</Button>
                <Button type="submit" disabled={saving || !applyForm.reason.trim()} className="flex-1 rounded-xl h-12 shadow-lg shadow-primary/20 font-bold">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ClipboardCheck className="w-4 h-4 mr-2" />}
                  Submit Request
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Dialog open={isDetailOpen} onOpenChange={(open) => { if (!reviewing) { setIsDetailOpen(open); if (!open) forceUnlockUI(); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden dark:bg-slate-950 dark:border-slate-800 rounded-[2.5rem] shadow-2xl border-none">
          {selectedLeave && (
            <div className="flex flex-col h-full">
              <div className={cn("h-2 w-full", 
                selectedLeave.status === 'approved' ? "bg-emerald-500" : 
                selectedLeave.status === 'rejected' ? "bg-rose-500" : "bg-amber-500"
              )} />
              <div className="p-8">
                <DialogHeader className="mb-8">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-12 w-12 border-2 border-white dark:border-slate-800 shadow-sm">
                      <AvatarImage src={selectedLeave.avatar_preset ? `/avatars/${selectedLeave.avatar_preset}.png` : selectedLeave.avatar_url} />
                      <AvatarFallback className="font-bold bg-primary/10 text-primary">{selectedLeave.full_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <DialogTitle className="text-xl font-bold">{selectedLeave.full_name}</DialogTitle>
                        {isSuperAdmin && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20" 
                            onClick={() => { setLeaveToDelete(selectedLeave); setIsDeleteDialogOpen(true); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{selectedLeave.email}</p>
                    </div>
                    <Badge className={cn("ml-auto uppercase text-[9px] font-black tracking-widest",
                      selectedLeave.status === 'approved' ? "bg-emerald-500" : 
                      selectedLeave.status === 'rejected' ? "bg-rose-500" : "bg-amber-500"
                    )}>{selectedLeave.status}</Badge>
                  </div>
                </DialogHeader>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-800 space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Start Date</p>
                      <p className="text-xs font-bold">{format(parseISO(selectedLeave.start_date), "PP")}</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-800 space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Return Date</p>
                      <p className="text-xs font-bold text-primary">{format(parseISO(selectedLeave.return_date), "PP")}</p>
                    </div>
                  </div>

                  <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-800">
                    <div className="flex justify-between items-center mb-1">
                      <Badge variant="outline" className="text-[9px] uppercase dark:border-slate-700">{selectedLeave.leave_type.replace('_', ' ')}</Badge>
                      <span className="text-xs font-bold">{selectedLeave.number_of_days} Business Days</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 italic">"{selectedLeave.reason}"</p>
                  </div>

                  {canApprove && selectedLeave.status !== 'cancelled' && (
                    <div className="space-y-3 pt-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Manager Decision Remark</Label>
                      <Textarea 
                        value={reviewRemark} 
                        onChange={e => setReviewRemark(e.target.value)} 
                        placeholder="Write a reason for approval/rejection..."
                        rows={3}
                        className="rounded-xl dark:bg-slate-900 border-none resize-none text-sm"
                      />
                      <div className="flex gap-3 pt-2">
                        <Button 
                          variant="ghost" 
                          className="flex-1 rounded-xl h-11 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-bold"
                          disabled={reviewing || !reviewRemark.trim()}
                          onClick={() => handleReview('rejected')}
                        >
                          {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reject"}
                        </Button>
                        <Button 
                          className="flex-1 rounded-xl h-11 bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 font-bold"
                          disabled={reviewing || !reviewRemark.trim()}
                          onClick={() => handleReview('approved')}
                        >
                          {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Approve"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {!canApprove && selectedLeave.manager_reason && (
                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" /> Manager Remark
                      </p>
                      <p className="text-xs font-medium italic text-slate-700 dark:text-slate-300">"{selectedLeave.manager_reason}"</p>
                      {selectedLeave.reviewed_by_name && (
                        <p className="text-[9px] text-muted-foreground mt-2">— {selectedLeave.reviewed_by_name}</p>
                      )}
                    </div>
                  )}

                  {selectedLeave.status === 'pending' && selectedLeave.user_id === userProfile?.id && (
                    <Button variant="outline" className="w-full h-11 rounded-xl text-rose-500 hover:bg-rose-50 border-rose-100" onClick={() => handleCancel(selectedLeave.id)}>
                      Cancel Request
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { if (!open) { setLeaveToDelete(null); forceUnlockUI(); } setIsDeleteDialogOpen(open); }}>
        <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white text-xl">Delete leave request?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">
              This will permanently remove this leave request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-0">
            <AlertDialogCancel className="dark:bg-slate-900 dark:text-white dark:border-slate-800" disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleDelete(); }} 
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LeaveCard({ leave, onOpen, onDelete, isMe, isManagement }: { leave: any, onOpen: () => void, onDelete?: () => void, isMe?: boolean, isManagement?: boolean }) {
  const type = LEAVE_TYPES.find(t => t.id === leave.leave_type) || LEAVE_TYPES[3];
  const TypeIcon = type.icon;

  return (
    <Card className="border-none shadow-sm dark:bg-slate-900 group hover:shadow-md transition-all cursor-pointer overflow-hidden" onClick={onOpen}>
      <div className="flex items-center p-4 gap-4">
        <div className={cn("p-3 rounded-xl shrink-0 transition-transform group-hover:scale-110", type.bg)}>
          <TypeIcon className={cn("w-5 h-5", type.color)} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-bold text-sm truncate dark:text-white">
              {!isMe ? leave.full_name : type.label}
            </h3>
            {isMe && <Badge variant="outline" className="text-[8px] uppercase h-4 px-1 tracking-tighter opacity-60">My Request</Badge>}
            <Badge className={cn("ml-auto text-[9px] uppercase font-bold px-1.5 h-4", 
              leave.status === 'approved' ? "bg-emerald-500" : 
              leave.status === 'rejected' ? "bg-rose-500" : "bg-amber-500"
            )}>{leave.status}</Badge>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-2">
            <Calendar className="w-3 h-3" /> {format(parseISO(leave.start_date), "MMM d")} - {format(parseISO(leave.end_date), "MMM d, yyyy")}
          </p>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-black text-slate-900 dark:text-slate-100">{leave.number_of_days}d</p>
            {isMe && onDelete && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                title="Delete request"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-[9px] font-bold text-primary uppercase tracking-tighter">Return: {format(parseISO(leave.return_date), "MMM d")}</p>
        </div>
      </div>
      
      {leave.manager_reason && (
        <div className="px-4 pb-3">
          <div className="bg-slate-50 dark:bg-slate-950/40 p-2 rounded-lg border dark:border-slate-800">
            <p className="text-[9px] text-slate-500 line-clamp-1 italic">"{leave.manager_reason}"</p>
          </div>
        </div>
      )}
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-20 text-center bg-white dark:bg-slate-900/40 rounded-[2.5rem] border-2 border-dashed dark:border-slate-800 opacity-60">
      <PlaneTakeoff className="w-12 h-12 mx-auto mb-4 text-slate-300" />
      <p className="text-sm font-medium text-slate-500">{message}</p>
    </div>
  );
}
