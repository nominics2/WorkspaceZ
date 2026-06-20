"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { 
  Send, 
  Search, 
  Plus, 
  ChevronLeft, 
  Hash, 
  MoreVertical, 
  Paperclip, 
  Smile,
  MessageSquare,
  CheckCheck,
  Loader2,
  AlertCircle,
  UserPlus,
  User,
  Check,
  Users,
  X,
  FileIcon,
  Download,
  ImageIcon,
  ExternalLink,
  Files,
  ArrowDown,
  BellOff,
  Bell,
  MessageCircle,
  Info,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  LogOut,
  Edit2,
  UserMinus,
  Shield,
  Trash2,
  Copy,
  CheckSquare,
  AlertTriangle,
  Link as LinkIcon,
  Reply,
  FileText,
  FileSpreadsheet,
  Archive,
  Presentation,
  Maximize2,
  Settings,
  Volume2,
  Globe,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useFloatingChat, Chat } from "@/components/chat/FloatingChatProvider";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuCheckboxItem, 
  DropdownMenuTrigger, 
  DropdownMenuItem 
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "next/navigation";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size_bytes: number;
  message_id: string;
  uploaded_by: string;
  created_at: string;
  signed_url?: string;
  chat_messages?: {
    sender_id: string;
  };
}

interface Message {
  id: string;
  channel_id: string;
  workspace_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  updated_at?: string;
  created_task_id?: string | null;
  reply_to_message_id?: string | null;
  is_deleted?: boolean;
  profiles?: {
    full_name: string;
    avatar_url: string;
    avatar_preset: string;
  } | null;
  attachments?: Attachment[];
  channel_display_name?: string;
  tasks?: {
    is_deleted: boolean;
  } | null;
  reply_to?: Message | null;
}

interface WorkspaceMemberProfile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  avatar_preset: string;
  email: string;
  role?: string;
  last_seen_at?: string | null;
}

interface ChatChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  role: 'admin' | 'member';
  created_at: string;
}

interface ChatMemberWithProfile extends ChatChannelMember {
  profiles: {
    full_name: string;
    avatar_url: string;
    avatar_preset: string;
    email: string;
    username: string;
    last_seen_at: string | null;
  } | null;
}

interface TaskSearchResult {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  profiles?: {
    full_name: string;
    avatar_url: string;
    avatar_preset: string;
  } | null;
}

interface TypingUser {
  id: string;
  full_name: string;
  lastSeen: number;
}

export default function ChatPage() {
  const { activeWorkspace, userProfile, userRole } = useWorkspace();
  const { addBubble, refreshUnread, removeBubble, onlineUsers, notificationPrefs, updateNotificationPrefs } = useFloatingChat();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [muteStates, setMuteStates] = useState<Record<string, { is_muted: boolean, muted_until: string | null }>>({});
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [uploadingFileIndex, setUploadingFileIndex] = useState(0);

  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser>>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBroadcastRef = useRef<number>(0);
  const typingChannelRef = useRef<any>(null);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageInput, setEditMessageInput] = useState("");
  const [isEditingLoading, setIsEditingLoading] = useState(false);
  const [isMessageDeleteDialogOpen, setIsMessageDeleteDialogOpen] = useState(false);
  const [messageIdToDelete, setMessageIdToDelete] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);

  const [isAttachmentDeleteDialogOpen, setIsAttachmentDeleteDialogOpen] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<Attachment | null>(null);
  const [isDeletingAttachment, setIsDeletingAttachment] = useState(false);
  const [selectedImageForLightbox, setSelectedImageForLightbox] = useState<Attachment | null>(null);

  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [taskSourceMessage, setTaskSourceMessage] = useState<Message | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    assignedTo: "",
    teamId: ""
  });
  const [isTaskCreating, setIsTaskCreating] = useState(false);

  const [isLinkTaskOpen, setIsLinkTaskOpen] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [taskSearchResults, setTaskSearchResults] = useState<TaskSearchResult[]>([]);
  const [selectedTaskToLink, setSelectedTaskToLink] = useState<string | null>(null);
  const [isSearchingTasks, setIsSearchingTasks] = useState(false);
  const [isLinkingTask, setIsLinkingTask] = useState(false);

  const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);
  const [messageIdToUnlink, setMessageIdToUnlink] = useState<string | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const [isDeleteChatDialogOpen, setIsDeleteChatDialogOpen] = useState(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState("");
  const [inChatSearchResults, setInChatSearchResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const [globalSearchResults, setGlobalSearchResults] = useState<Message[]>([]);
  const [isGlobalSearching, setIsGlobalSearching] = useState(false);
  const [pendingJumpMessageId, setPendingHighlightMessageId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const [isMediaSheetOpen, setIsMediaSheetOpen] = useState(false);
  const [allMedia, setAllMedia] = useState<Attachment[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  const [isInfoSheetOpen, setIsInfoSheetOpen] = useState(false);
  const [infoMembers, setInfoMembers] = useState<ChatMemberWithProfile[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [isRenamingGroup, setIsRenamingGroup] = useState(false);
  const [newGroupNameInput, setNewGroupNameInput] = useState("");
  const [isRenamingLoading, setIsRenamingLoading] = useState(false);
  const [isLeavingLoading, setIsLeavingLoading] = useState(false);
  const [isArchivingLoading, setIsArchivingLoading] = useState(false);
  const [isDeleteGroupOpen, setIsDeleteGroupOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ChatMemberWithProfile | null>(null);
  const [isRemovingLoading, setIsRemovingLoading] = useState(false);

  const [memberToUpdateRole, setMemberToUpdateRole] = useState<ChatMemberWithProfile | null>(null);
  const [newRoleTarget, setNewRoleTarget] = useState<'admin' | 'member' | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(false);

  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [selectedMemberIdsToAdd, setSelectedMemberIdsToAdd] = useState<string[]>([]);
  const [isAddingMembersLoading, setIsAddingMembersLoading] = useState(false);
  const [addMembersSearchQuery, setAddMembersSearchQuery] = useState("");

  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState<"direct" | "group">("direct");
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const { toast } = useToast();
  const router = useRouter();

  const forceUnlockUI = () => {
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = "";
      document.body.style.overflow = "";
    }
  };

  useEffect(() => {
    return () => forceUnlockUI();
  }, []);

  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (!typingChannelRef.current || !userProfile) return;
    const now = Date.now();
    if (isTyping && now - lastBroadcastRef.current < 2000) return;
    if (isTyping) lastBroadcastRef.current = now;
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        id: userProfile.id,
        full_name: userProfile.full_name,
        is_typing: isTyping,
        timestamp: now
      }
    });
  }, [userProfile]);

  useEffect(() => {
    if (!selectedChatId || !userProfile) return;
    setTypingUsers({});
    const channel = supabase.channel(`chat-typing:${selectedChatId}`);
    typingChannelRef.current = channel;
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.id === userProfile.id) return;
        setTypingUsers(prev => {
          const next = { ...prev };
          if (payload.is_typing) {
            next[payload.id] = { id: payload.id, full_name: payload.full_name, lastSeen: Date.now() };
          } else {
            delete next[payload.id];
          }
          return next;
        });
      })
      .subscribe();
    const interval = setInterval(() => {
      setTypingUsers(prev => {
        const now = Date.now();
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(uid => {
          if (now - next[uid].lastSeen > 5000) {
            delete next[uid];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 2000);
    return () => {
      sendTypingStatus(false);
      supabase.removeChannel(channel);
      clearInterval(interval);
      typingChannelRef.current = null;
    };
  }, [selectedChatId, userProfile, supabase, sendTypingStatus]);

  const handleInputChange = (val: string) => {
    setMessageInput(val);
    if (!selectedChatId) return;
    if (val.trim().length > 0) {
      sendTypingStatus(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => sendTypingStatus(false), 3000);
    } else {
      sendTypingStatus(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const typingUsersList = useMemo(() => Object.values(typingUsers), [typingUsers]);
  const typingText = useMemo(() => {
    if (typingUsersList.length === 0) return null;
    if (typingUsersList.length === 1) return `${typingUsersList[0].full_name} is typing...`;
    if (typingUsersList.length === 2) return `${typingUsersList[0].full_name} and ${typingUsersList[1].full_name} are typing...`;
    return "Several people are typing...";
  }, [typingUsersList]);

  const formatLastSeen = (dateString: string | null) => {
    if (!dateString) return "Offline";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const sanitizeFileName = (name: string) => {
    const timestamp = Date.now();
    const cleanName = name.replace(/[^\w\d.-]/g, '_');
    return `${timestamp}-${cleanName}`;
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const isAtBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return true;
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    return scrollHeight - scrollTop <= clientHeight + 150;
  };

  const handleCopyMessage = (text: string) => {
    if (!text || text.trim().length === 0) return;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Message copied" });
    }).catch(() => {
      toast({ variant: "destructive", title: "Unable to copy message" });
    });
  };

  const getFileIcon = (fileName: string, fileType?: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (fileType?.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-emerald-500" />;
    if (ext === 'pdf') return <FileText className="w-5 h-5 text-rose-500" />;
    if (['xlsx', 'xls', 'csv'].includes(ext || '')) return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    if (['docx', 'doc'].includes(ext || '')) return <FileText className="w-5 h-5 text-blue-500" />;
    if (['pptx', 'ppt'].includes(ext || '')) return <Presentation className="w-5 h-5 text-orange-500" />;
    if (['zip', 'rar', '7z'].includes(ext || '')) return <Archive className="w-5 h-5 text-amber-500" />;
    return <FileIcon className="w-5 h-5 text-slate-500" />;
  };

  const fetchUnreadCounts = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_chat_unread_counts");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as any[]).forEach(item => { counts[item.channel_id] = item.unread_count; });
      setUnreadCounts(counts);
      refreshUnread();
    } catch (err) {}
  }, [supabase, refreshUnread]);

  const fetchMuteStates = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_chat_mute_states");
      if (error) throw error;
      const mutes: Record<string, { is_muted: boolean, muted_until: string | null }> = {};
      (data as any[]).forEach(item => {
        mutes[item.channel_id] = { is_muted: item.is_muted, muted_until: item.muted_until };
      });
      setMuteStates(mutes);
      refreshUnread();
    } catch (err) {}
  }, [supabase, refreshUnread]);

  const markAsRead = useCallback(async (channelId: string) => {
    try {
      const { error } = await supabase.rpc("mark_chat_channel_read", { p_channel_id: channelId });
      if (error) throw error;
      setUnreadCounts(prev => ({ ...prev, [channelId]: 0 }));
      refreshUnread();
    } catch (err) {}
  }, [supabase, refreshUnread]);

  const fetchChats = useCallback(async () => {
    if (!userProfile) return;
    setLoadingChats(true);
    setError(null);
    try {
      // 1. Get user's workspace memberships
      const { data: memberData, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userProfile.id)
        .eq('status', 'active');
      if (memberError) throw memberError;
      if (!memberData || memberData.length === 0) {
        setChats([]);
        return;
      }
      const workspaceIds = memberData.map(m => m.workspace_id);

      // 2. Get user's channel memberships to filter valid Direct/Group chats
      const { data: myMemberships } = await supabase
        .from('chat_channel_members')
        .select('channel_id')
        .eq('user_id', userProfile.id);
      
      const memberChannelIds = (myMemberships || []).map(m => m.channel_id);

      // 3. Fetch all active channels in those workspaces
      const { data: channelsData, error: channelsError } = await supabase
        .from('chat_channels')
        .select('id, workspace_id, sub_workspace_id, name, type, created_at, archived_at, archived_by')
        .in('workspace_id', workspaceIds)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (channelsError) throw channelsError;

      // Filter by prompt rules:
      // - workspace/general show if user is workspace member (they are, since we filtered workspaceIds)
      // - group/direct show ONLY if current user is in chat_channel_members
      const filteredChannels = (channelsData || []).filter(channel => {
        if (channel.name.toLowerCase() === 'general') return true;
        return memberChannelIds.includes(channel.id);
      });

      const channelIds = filteredChannels.map(c => c.id);
      if (channelIds.length === 0) {
        setChats([]);
        setLoadingChats(false);
        return;
      }

      const [messagesRes, participantsRes] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('id, channel_id, message, created_at')
          .in('channel_id', channelIds)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('chat_channel_members')
          .select('channel_id, user_id, profiles(full_name, username, email, avatar_url, avatar_preset, last_seen_at)')
          .in('channel_id', channelIds),
        fetchUnreadCounts(),
        fetchMuteStates()
      ]);

      const lastMessages = messagesRes.data || [];
      const participants = (participantsRes.data || []) as any[];

      const formattedChats: Chat[] = filteredChannels.map(channel => {
        const lastMsg = lastMessages.find(m => m.channel_id === channel.id);
        let displayName = channel.name;
        let displayAvatar = null;
        let displayAvatarPreset = null;
        let otherUserId = undefined;
        let otherUserLastSeen = undefined;

        if (channel.type === 'direct') {
          const otherMember = participants.find(p => p.channel_id === channel.id && p.user_id !== userProfile.id);
          if (otherMember?.profiles) {
            displayName = otherMember.profiles.full_name || otherMember.profiles.username || otherMember.profiles.email || 'Unknown User';
            displayAvatar = otherMember.profiles.avatar_url;
            displayAvatarPreset = otherMember.profiles.avatar_preset;
            otherUserId = otherMember.user_id;
            otherUserLastSeen = otherMember.profiles.last_seen_at;
          } else {
            // If participant profile not joined yet, provide generic label instead of filtering out
            displayName = "Chat with Workspace Member";
          }
        }

        return {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          workspace_id: channel.workspace_id,
          last_message: lastMsg?.message,
          last_message_at: lastMsg?.created_at,
          created_at: channel.created_at,
          display_name: displayName,
          display_avatar: displayAvatar,
          display_avatar_preset: displayAvatarPreset,
          other_user_id: otherUserId,
          other_user_last_seen: otherUserLastSeen,
          archived_at: channel.archived_at,
          archived_by: channel.archived_by
        };
      }).filter((c): c is Chat => c !== null).sort((a, b) => {
        const isAGeneral = a.name.toLowerCase() === 'general' && (activeWorkspace ? a.workspace_id === activeWorkspace.id : true);
        const isBGeneral = b.name.toLowerCase() === 'general' && (activeWorkspace ? b.workspace_id === activeWorkspace.id : true);
        if (isAGeneral) return -1;
        if (isBGeneral) return 1;
        const timeA = new Date(a.last_message_at || a.created_at || 0).getTime();
        const timeB = new Date(b.last_message_at || b.created_at || 0).getTime();
        return timeB - timeA;
      });

      setChats(formattedChats);
      
      // If our selected chat is no longer in the list, fallback
      if (selectedChatId && !formattedChats.some(c => c.id === selectedChatId)) {
        // Only reset if we're not waiting for a specific jump/new chat
      } else if (!selectedChatId && formattedChats.length > 0 && !showConversation) {
        setSelectedChatId(formattedChats[0].id);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while loading chats.");
    } finally {
      setLoadingChats(false);
    }
  }, [userProfile, supabase, activeWorkspace, selectedChatId, showConversation, fetchUnreadCounts, fetchMuteStates]);

  const fetchMessages = useCallback(async (channelId: string) => {
    setLoadingMessages(true);
    try {
      const [msgDataRes, attachDataRes] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('id, channel_id, workspace_id, sender_id, message, created_at, updated_at, is_deleted, created_task_id, reply_to_message_id, tasks(is_deleted)')
          .eq('channel_id', channelId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true }),
        supabase
          .from('chat_message_attachments')
          .select('*, chat_messages!inner(is_deleted)')
          .eq('channel_id', channelId)
          .eq('chat_messages.is_deleted', false)
      ]);
      if (msgDataRes.error) throw msgDataRes.error;
      const msgData: Message[] = msgDataRes.data || [];
      const attachData = attachDataRes.data || [];
      if (!msgData || msgData.length === 0) {
        setMessages([]);
        setLoadingMessages(false);
        return;
      }
      const senderIds = Array.from(new Set(msgData.map(m => m.sender_id)));
      const { data: profilesData } = await supabase.from('profiles').select('id, full_name, avatar_url, avatar_preset, last_seen_at').in('id', senderIds);
      const missingReplyIds = Array.from(new Set(msgData.map(m => m.reply_to_message_id).filter((id): id is string => !!id && !msgData.some(existing => existing.id === id))));
      let extraMessages: Message[] = [];
      if (missingReplyIds.length > 0) {
        const { data: extras } = await supabase.from('chat_messages').select('id, sender_id, message, created_at, is_deleted, profiles(full_name, avatar_url, avatar_preset)').in('id', missingReplyIds);
        if (extras) extraMessages = (extras as any[]).map(e => ({ ...e, profiles: e.profiles }));
      }
      const allLookupMap = [...msgData.map(m => ({ ...m, profiles: profilesData?.find(p => p.id === m.sender_id) || null })), ...extraMessages];
      let enrichedAttachments: Attachment[] = [...attachData];
      if (attachData.length > 0) {
        const { data: signedData, error: signedError } = await supabase.storage.from('chat-attachments').createSignedUrls(attachData.map(a => a.file_path), 3600);
        if (!signedError && signedData) {
          enrichedAttachments = attachData.map(a => {
            const signedInfo = signedData.find(s => s.path === a.file_path);
            return { ...a, signed_url: signedInfo?.signedUrl };
          });
        }
      }
      const enrichedMessages: Message[] = msgData.map(m => ({
        ...m,
        profiles: profilesData?.find(p => p.id === m.sender_id) || null,
        attachments: enrichedAttachments.filter(a => a.message_id === m.id),
        reply_to: m.reply_to_message_id ? allLookupMap.find(am => am.id === m.reply_to_message_id) : null
      }));
      setMessages(enrichedMessages);
      setTimeout(() => {
        scrollToBottom("auto");
        if (pendingJumpMessageId) {
          const element = document.getElementById(`message-${pendingJumpMessageId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedMessageId(pendingJumpMessageId);
            setTimeout(() => setHighlightedMessageId(null), 3000);
          }
          setPendingHighlightMessageId(null);
        }
      }, 100);
    } catch (err: any) {
      toast({ variant: "destructive", title: "History Sync Failed", description: err.message });
    } finally {
      setLoadingMessages(false);
    }
  }, [supabase, toast, scrollToBottom, pendingJumpMessageId]);

  const fetchMembers = useCallback(async () => {
    if (!activeWorkspace || !userProfile) return;
    setLoadingMembers(true);
    try {
      const { data: memberData, error: memberError } = await supabase.from('workspace_members').select('user_id, role, status').eq('workspace_id', activeWorkspace.id).eq('status', 'active');
      if (memberError) throw memberError;
      if (memberData && memberData.length > 0) {
        const uids = memberData.map(m => m.user_id).filter(id => id !== userProfile.id);
        if (uids.length > 0) {
          const { data: profileData, error: profileError } = await supabase.from('profiles').select('id, full_name, username, avatar_url, avatar_preset, email, last_seen_at').in('id', uids);
          if (profileError) throw profileError;
          const enriched = (profileData || []).map(p => ({ ...p, role: memberData.find(m => m.user_id === p.id)?.role }));
          setWorkspaceMembers(enriched);
        } else {
          setWorkspaceMembers([]);
        }
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: "Unable to load workspace roster." });
    } finally {
      setLoadingMembers(false);
    }
  }, [activeWorkspace, userProfile, supabase, toast]);

  const fetchMedia = useCallback(async () => {
    if (!selectedChatId) return;
    setLoadingMedia(true);
    try {
      const { data: attachData, error: attachError } = await supabase.from('chat_message_attachments').select('*, chat_messages!inner(is_deleted, sender_id)').eq('channel_id', selectedChatId).eq('chat_messages.is_deleted', false).order('created_at', { ascending: false });
      if (attachError) throw attachError;
      if (!attachData || attachData.length === 0) {
        setAllMedia([]);
        return;
      }
      const { data: signedData } = await supabase.storage.from('chat-attachments').createSignedUrls(attachData.map(a => a.file_path), 3600);
      const enriched = attachData.map(a => {
        const signedInfo = signedData?.find(s => s.path === a.file_path);
        return { ...a, signed_url: signedInfo?.signedUrl };
      });
      setAllMedia(enriched);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gallery Error", description: "Failed to load shared files." });
    } finally {
      setLoadingMedia(false);
    }
  }, [selectedChatId, supabase, toast]);

  const fetchInfoMembers = useCallback(async () => {
    const chat = chats.find(c => c.id === selectedChatId);
    if (!chat || chat.name.toLowerCase() === 'general') return;
    setLoadingInfo(true);
    try {
      const { data: memberData, error: memberError } = await supabase.from('chat_channel_members').select('*').eq('channel_id', chat.id).order('created_at', { ascending: true });
      if (memberError) throw memberError;
      if (!memberData || memberData.length === 0) {
        setInfoMembers([]);
        return;
      }
      const userIds = memberData.map(m => m.user_id);
      const { data: profileData, error: profileError } = await supabase.from('profiles').select('id, full_name, username, avatar_url, avatar_preset, email, last_seen_at').in('id', userIds);
      if (profileError) throw profileError;
      const enriched: ChatMemberWithProfile[] = memberData.map(m => ({ ...m, profiles: profileData?.find(p => p.id === m.user_id) || null }));
      setInfoMembers(enriched);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Roster Sync Failed", description: err.message });
    } finally {
      setLoadingInfo(false);
    }
  }, [selectedChatId, chats, supabase, toast]);

  const performInChatSearch = useCallback(async (query: string) => {
    if (!selectedChatId || query.length < 2) {
      setInChatSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase.from('chat_messages').select('id, channel_id, workspace_id, sender_id, message, created_at, created_task_id').eq('channel_id', selectedChatId).eq('is_deleted', false).ilike('message', `%${query}%`).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      if (data && data.length > 0) {
        const senderIds = Array.from(new Set(data.map(m => m.sender_id)));
        const { data: profilesData } = await supabase.from('profiles').select('id, full_name, avatar_url, avatar_preset').in('id', senderIds);
        const enriched = data.map(m => ({ ...m, profiles: profilesData?.find(p => p.id === m.sender_id) || null }));
        setInChatSearchResults(enriched);
      } else {
        setInChatSearchResults([]);
      }
    } catch (err: any) {} finally {
      setIsSearching(false);
    }
  }, [selectedChatId, supabase]);

  const performGlobalSearch = useCallback(async (query: string) => {
    if (query.length < 2 || chats.length === 0) {
      setGlobalSearchResults([]);
      return;
    }
    setIsGlobalSearching(true);
    try {
      const channelIds = chats.map(c => c.id);
      const { data, error } = await supabase.from('chat_messages').select('id, channel_id, workspace_id, sender_id, message, created_at, created_task_id').in('channel_id', channelIds).eq('is_deleted', false).ilike('message', `%${query}%`).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      if (data && data.length > 0) {
        const senderIds = Array.from(new Set(data.map(m => m.sender_id)));
        const { data: profilesData } = await supabase.from('profiles').select('id, full_name, avatar_url, avatar_preset').in('id', senderIds);
        const enriched = data.map(m => {
          const channel = chats.find(c => c.id === m.channel_id);
          return { ...m, profiles: profilesData?.find(p => p.id === m.sender_id) || null, channel_display_name: channel?.display_name || 'Archive' };
        });
        setGlobalSearchResults(enriched);
      } else {
        setGlobalSearchResults([]);
      }
    } catch (err: any) {} finally {
      setIsGlobalSearching(false);
    }
  }, [supabase, chats]);

  const performTaskSearch = useCallback(async (query: string) => {
    if (!activeWorkspace || query.length < 2) {
      setTaskSearchResults([]);
      return;
    }
    setIsSearchingTasks(true);
    try {
      const { data, error } = await supabase.from('tasks').select('id, title, status, priority, due_date, assigned_to, profiles:assigned_to(full_name, avatar_url, avatar_preset)').eq('workspace_id', activeWorkspace.id).eq('is_deleted', false).ilike('title', `%${query}%`).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      setTaskSearchResults((data || []).map(t => ({ ...t, profiles: t.profiles as any })));
    } catch (err: any) {} finally {
      setIsSearchingTasks(false);
    }
  }, [activeWorkspace, supabase]);

  const handleMute = async (duration: '1h' | '8h' | '24h' | 'forever') => {
    if (!selectedChatId) return;
    let mutedUntil: string | null = null;
    const now = new Date();
    if (duration === '1h') mutedUntil = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    else if (duration === '8h') mutedUntil = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
    else if (duration === '24h') mutedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    try {
      const { error } = await supabase.rpc("mute_chat_channel", { p_channel_id: selectedChatId, p_muted_until: mutedUntil });
      if (error) throw error;
      setMuteStates(prev => ({ ...prev, [selectedChatId]: { is_muted: true, muted_until: mutedUntil } }));
      refreshUnread();
      toast({ title: "Notifications silenced" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Mute failed", description: err.message });
    }
  };

  const handleUnmute = async () => {
    if (!selectedChatId) return;
    try {
      const { error } = await supabase.rpc("unmute_chat_channel", { p_channel_id: selectedChatId });
      if (error) throw error;
      setMuteStates(prev => ({ ...prev, [selectedChatId]: { is_muted: false, muted_until: null } }));
      refreshUnread();
      toast({ title: "Notifications restored" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Unmute failed", description: err.message });
    }
  };

  const handleToggleBrowserNotifications = async (checked: boolean) => {
    if (!checked) {
      updateNotificationPrefs({ browser_enabled: false });
      return;
    }
    if (!("Notification" in window)) {
      toast({ variant: "destructive", title: "Unsupported", description: "Your browser does not support desktop notifications." });
      return;
    }
    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission === "granted") {
      updateNotificationPrefs({ browser_enabled: true });
      new Notification("Notifications Enabled", { body: "You will now receive workspace alerts on your desktop.", icon: "/brand/logomark.png" });
    } else {
      toast({ variant: "destructive", title: "Permission Denied", description: "Browser notifications are blocked. Enable them in your browser settings." });
      updateNotificationPrefs({ browser_enabled: false });
    }
  };

  const handleRenameGroup = async () => {
    const text = newGroupNameInput.trim();
    if (!selectedChatId || !text || isRenamingLoading) return;
    setIsRenamingLoading(true);
    try {
      const { error } = await supabase.rpc("rename_group_chat", { p_channel_id: selectedChatId, p_name: text });
      if (error) throw error;
      toast({ title: "Group renamed" });
      setIsRenamingGroup(false);
      await fetchChats();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Rename failed", description: err.message });
    } finally {
      setIsRenamingLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedChatId || isLeavingLoading) return;
    setIsLeavingLoading(true);
    try {
      const { error } = await supabase.rpc("leave_group_chat", { p_channel_id: selectedChatId });
      if (error) throw error;
      toast({ title: "You left the group" });
      setIsInfoSheetOpen(false);
      removeBubble(selectedChatId);
      setSelectedChatId(null);
      setShowConversation(false);
      await fetchChats();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Exit failed", description: err.message });
    } finally {
      setIsLeavingLoading(false);
      forceUnlockUI();
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedChatId || isArchivingLoading) return;
    setIsArchivingLoading(true);
    try {
      const { error } = await supabase.rpc("archive_group_chat", { p_channel_id: selectedChatId });
      if (error) throw error;
      toast({ title: "Group deleted" });
      setIsInfoSheetOpen(false);
      setIsDeleteGroupOpen(false);
      removeBubble(selectedChatId);
      setSelectedChatId(null);
      setShowConversation(false);
      await fetchChats();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Deletion failed", description: err.message });
    } finally {
      setIsArchivingLoading(false);
      forceUnlockUI();
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedChatId || !memberToRemove || isRemovingLoading) return;
    setIsRemovingLoading(true);
    try {
      const { error } = await supabase.rpc("remove_group_chat_member", { p_channel_id: selectedChatId, p_member_user_id: memberToRemove.user_id });
      if (error) throw error;
      toast({ title: "Member removed", description: `${memberToRemove.profiles?.full_name} has been disconnected from the group.` });
      setMemberToRemove(null);
      await fetchInfoMembers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Removal failed", description: err.message });
    } finally {
      setIsRemovingLoading(false);
      forceUnlockUI();
    }
  };

  const handleUpdateMemberRole = async () => {
    if (!selectedChatId || !memberToUpdateRole || !newRoleTarget || isRoleLoading) return;
    setIsRoleLoading(true);
    try {
      const { error } = await supabase.rpc("set_group_chat_member_role", { p_channel_id: selectedChatId, p_member_user_id: memberToUpdateRole.user_id, p_role: newRoleTarget });
      if (error) throw error;
      toast({ title: newRoleTarget === 'admin' ? "Member Promoted" : "Member Demoted", description: `${memberToUpdateRole.profiles?.full_name} is now a group ${newRoleTarget}.` });
      setMemberToUpdateRole(null);
      setNewRoleTarget(null);
      await fetchInfoMembers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    } finally {
      setIsRoleLoading(false);
      forceUnlockUI();
    }
  };

  const handleAddMembersToGroup = async () => {
    if (!selectedChatId || selectedMemberIdsToAdd.length === 0 || isAddingMembersLoading) return;
    setIsAddingMembersLoading(true);
    try {
      const { data, error } = await supabase.rpc("add_group_chat_members", { p_channel_id: selectedChatId, p_member_user_ids: selectedMemberIdsToAdd });
      if (error) throw error;
      const insertedCount = (data as number) || 0;
      if (insertedCount > 0) toast({ title: "Group Roster Updated", description: `${insertedCount} new member${insertedCount === 1 ? '' : 's'} added successfully.` });
      else toast({ title: "Roster Unchanged", description: "Selected members were already in the group." });
      setIsAddMembersOpen(false);
      setSelectedMemberIdsToAdd([]);
      setAddMembersSearchQuery("");
      await fetchInfoMembers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Enrollment Failed", description: err.message });
    } finally {
      setIsAddingMembersLoading(false);
      forceUnlockUI();
    }
  };

  const handleUpdateMessage = async () => {
    const text = editMessageInput.trim();
    if (!editingMessageId || !text || isEditingLoading) return;
    const original = messages.find(m => m.id === editingMessageId);
    if (original?.message === text) { setEditingMessageId(null); return; }
    setIsEditingLoading(true);
    try {
      const { error } = await supabase.from('chat_messages').update({ message: text, updated_at: new Date().toISOString() }).eq('id', editingMessageId).eq('sender_id', userProfile?.id);
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, message: text, updated_at: new Date().toISOString() } : m));
      setEditingMessageId(null);
      setEditMessageInput("");
      toast({ title: "Message updated" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Edit failed", description: err.message });
    } finally {
      setIsEditingLoading(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!messageIdToDelete || !userProfile) return;
    try {
      const { error } = await supabase.rpc("soft_delete_chat_message", { p_message_id: messageIdToDelete });
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== messageIdToDelete));
      toast({ title: "Message deleted" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Unable to delete message", description: err.message });
    } finally {
      setIsMessageDeleteDialogOpen(false);
      setMessageIdToDelete(null);
      forceUnlockUI();
    }
  };

  const handleDeleteAttachment = async () => {
    if (!attachmentToDelete || isDeletingAttachment) return;
    setIsDeletingAttachment(true);
    try {
      const { error } = await supabase.rpc("delete_chat_message_attachment", { p_attachment_id: attachmentToDelete.id });
      if (error) throw error;
      setMessages(prev => prev.map(m => {
        if (m.id === attachmentToDelete.message_id) {
          const nextAttachments = m.attachments?.filter(a => a.id !== attachmentToDelete.id) || [];
          if (!m.message && nextAttachments.length === 0) return { ...m, is_deleted: true, attachments: [] };
          return { ...m, attachments: nextAttachments };
        }
        return m;
      }).filter(m => !m.is_deleted));
      setAllMedia(prev => prev.filter(a => a.id !== attachmentToDelete.id));
      toast({ title: "Attachment deleted" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Delete failed", description: err.message });
    } finally {
      setIsDeletingAttachment(false);
      setAttachmentToDelete(null);
      setIsAttachmentDeleteDialogOpen(false);
      forceUnlockUI();
    }
  };

  const handleDeleteDirectChat = async () => {
    if (!selectedChatId || isDeletingChat) return;
    setIsDeletingChat(true);
    try {
      // Optimistic cleanup
      const deletedId = selectedChatId;
      const currentWorkspaceId = chats.find(c => c.id === deletedId)?.workspace_id;
      
      const { error } = await supabase.rpc("delete_direct_chat_for_me", { p_channel_id: deletedId });
      
      // If error is "not a member", treat as stale UI success
      if (error && !error.message.toLowerCase().includes("not a member")) {
        throw error;
      }
      
      toast({ title: "Conversation removed" });
      setIsDeleteChatDialogOpen(false);
      removeBubble(deletedId);
      
      // Select General if possible
      const generalChat = chats.find(c => c.name.toLowerCase() === 'general' && c.workspace_id === currentWorkspaceId && c.id !== deletedId);
      
      setSelectedChatId(null);
      setShowConversation(false);
      
      // Force local refresh
      setChats(prev => prev.filter(c => c.id !== deletedId));
      await fetchChats();
      await fetchUnreadCounts();
      
      if (generalChat) {
        handleSelectChat(generalChat.id);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Deletion failed", description: err.message });
    } finally {
      setIsDeletingChat(false);
      forceUnlockUI();
    }
  };

  const handleOpenCreateTask = (msg: Message) => {
    setTaskSourceMessage(msg);
    setTaskForm({
      title: msg.message ? msg.message.slice(0, 100) : "Task from chat attachment",
      description: msg.message || "Action item originating from a chat conversation.",
      priority: "medium",
      dueDate: "",
      assignedTo: userProfile?.id || "",
      teamId: chats.find(c => c.id === selectedChatId)?.sub_workspace_id || ""
    });
    setIsCreateTaskOpen(true);
    fetchMembers();
  };

  const handleCreateTaskFromMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskSourceMessage || isTaskCreating) return;
    setIsTaskCreating(true);
    try {
      const { data: taskId, error } = await supabase.rpc("create_task_from_chat_message", {
        p_message_id: taskSourceMessage.id,
        p_title: taskForm.title.trim(),
        p_description: taskForm.description.trim() || null,
        p_assigned_to: taskForm.assignedTo || null,
        p_due_date: taskForm.dueDate || null,
        p_priority: taskForm.priority,
        p_sub_workspace_id: taskForm.teamId || null
      });
      if (error) throw error;
      toast({ title: "Task Linked", description: "Your message has been converted to an action item.", action: <Button variant="outline" size="sm" onClick={() => router.push(`/tasks?taskId=${taskId}`)}>View Task</Button> });
      setMessages(prev => prev.map(m => m.id === taskSourceMessage.id ? { ...m, created_task_id: taskId } : m));
      setIsCreateTaskOpen(false);
      setTaskSourceMessage(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Creation Failed", description: err.message });
    } finally {
      setIsTaskCreating(false);
      forceUnlockUI();
    }
  };

  const handleOpenLinkTask = (msg: Message) => {
    setTaskSourceMessage(msg);
    setTaskSearchQuery("");
    setTaskSearchResults([]);
    setSelectedTaskToLink(null);
    setIsLinkTaskOpen(true);
  };

  const handleLinkTask = async () => {
    if (!taskSourceMessage || !selectedTaskToLink || isLinkingTask) return;
    setIsLinkingTask(true);
    try {
      const { data: taskId, error } = await supabase.rpc("link_chat_message_to_task", { p_message_id: taskSourceMessage.id, p_task_id: selectedTaskToLink });
      if (error) throw error;
      toast({ title: "Task Linked", description: "Message successfully associated with an existing work item.", action: <Button variant="outline" size="sm" onClick={() => router.push(`/tasks?taskId=${taskId}`)}>View Task</Button> });
      setMessages(prev => prev.map(m => m.id === taskSourceMessage.id ? { ...m, created_task_id: taskId } : m));
      setIsLinkTaskOpen(false);
      setTaskSourceMessage(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Linking Failed", description: err.message });
    } finally {
      setIsLinkingTask(false);
      forceUnlockUI();
    }
  };

  const handleUnlinkTask = async () => {
    if (!messageIdToUnlink || isUnlinking) return;
    setIsUnlinking(true);
    try {
      const { error } = await supabase.rpc("unlink_chat_message_from_task", { p_message_id: messageIdToUnlink });
      if (error) throw error;
      toast({ title: "Task Unlinked", description: "The association between this message and the task has been removed." });
      setMessages(prev => prev.map(m => m.id === messageIdToUnlink ? { ...m, created_task_id: null } : m));
      setIsUnlinkConfirmOpen(false);
      setMessageIdToUnlink(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Unlink Failed", description: err.message });
    } finally {
      setIsUnlinking(false);
      forceUnlockUI();
    }
  };

  const addFilesToSelection = useCallback((files: File[]) => {
    let newValidFiles: File[] = [];
    let skippedSize = false;
    let skippedCount = false;
    const currentTotal = selectedFiles.length;
    for (const file of files) {
      if (newValidFiles.length + currentTotal >= 5) { skippedCount = true; break; }
      if (file.size > 5 * 1024 * 1024) { skippedSize = true; continue; }
      const isDuplicate = selectedFiles.some(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified);
      if (!isDuplicate) newValidFiles.push(file);
    }
    if (newValidFiles.length > 0) setSelectedFiles(prev => [...prev, ...newValidFiles]);
    if (skippedCount) toast({ variant: "destructive", title: "Limit reached", description: "You can attach up to 5 files per message." });
    else if (skippedSize) toast({ variant: "destructive", title: "Files skipped", description: "Some files were skipped because they are larger than 5MB." });
  }, [selectedFiles, toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    addFilesToSelection(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedChatId || isSending) return;
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    if (!selectedChatId || isSending) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToSelection(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => { if (inChatSearchQuery) performInChatSearch(inChatSearchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [inChatSearchQuery, performInChatSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) performGlobalSearch(searchQuery);
      else setGlobalSearchResults([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performGlobalSearch]);

  useEffect(() => {
    const timer = setTimeout(() => { if (taskSearchQuery) performTaskSearch(taskSearchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [taskSearchQuery, performTaskSearch]);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  useEffect(() => {
    if (selectedChatId) {
      fetchMessages(selectedChatId);
      markAsRead(selectedChatId);
      setSelectedFiles([]);
      setUploadProgress(0);
      setUploadingFileIndex(0);
      setUploadingFileName("");
      setIsSearchOpen(false);
      setInChatSearchQuery("");
      setInChatSearchResults([]);
      setIsRenamingGroup(false);
      setEditingMessageId(null);
      setReplyingToMessage(null);
      setTypingUsers({});
      setIsDragging(false);
      dragCounterRef.current = 0;
    } else {
      setMessages([]);
    }
  }, [selectedChatId, fetchMessages, markAsRead]);

  useEffect(() => {
    if (!selectedChatId) return;
    const channel = supabase.channel(`chat_messages:${selectedChatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
        const newMessage = payload.new as any;
        if (newMessage.channel_id !== selectedChatId && newMessage.sender_id !== userProfile?.id) {
          setUnreadCounts(prev => ({ ...prev, [newMessage.channel_id]: (prev[newMessage.channel_id] || 0) + 1 }));
          return;
        }
        if (newMessage.channel_id === selectedChatId) {
          const wasAtBottom = isAtBottom();
          setMessages((prev) => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, { ...newMessage, profiles: null, attachments: [], reply_to: null }];
          });
          if (wasAtBottom || newMessage.sender_id === userProfile?.id) markAsRead(selectedChatId);
          setTimeout(() => fetchMessages(selectedChatId), 1000);
          try {
            const { data: profileData } = await supabase.from('profiles').select('id, full_name, avatar_url, avatar_preset, last_seen_at').eq('id', newMessage.sender_id).single();
            setMessages((prev) => prev.map(m => m.id === newMessage.id ? { ...m, profiles: profileData || null } : m).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
            if (wasAtBottom || newMessage.sender_id === userProfile?.id) setTimeout(() => scrollToBottom(), 100);
          } catch (err) {}
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, (payload) => {
        const updatedMessage = payload.new as any;
        if (updatedMessage.channel_id === selectedChatId) {
          if (updatedMessage.is_deleted) setMessages((prev) => prev.filter(m => m.id !== updatedMessage.id));
          else setMessages((prev) => prev.map(m => m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedChatId, supabase, userProfile?.id, scrollToBottom, fetchMessages, markAsRead]);

  const handleSelectChat = (id: string) => { setSelectedChatId(id); setShowConversation(true); };

  const handleJumpToMessage = (channelId: string, msgId: string) => {
    if (selectedChatId === channelId) {
      const element = document.getElementById(`message-${msgId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(msgId);
        setTimeout(() => setHighlightedMessageId(null), 3000);
      }
    } else {
      setPendingHighlightMessageId(msgId);
      handleSelectChat(channelId);
    }
    if (window.innerWidth < 768) setShowConversation(true);
  };

  const handleSendMessage = async () => {
    const text = messageInput.trim();
    const chatObj = chats.find(c => c.id === selectedChatId);
    if (!chatObj || !userProfile || (!text && selectedFiles.length === 0) || isSending) return;
    setIsSending(true);
    setUploadProgress(0);
    sendTypingStatus(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    let messageId: string | null = null;
    const uploadedPaths: string[] = [];
    try {
      const { data: msgData, error: sendError } = await supabase.from('chat_messages').insert({ channel_id: chatObj.id, workspace_id: chatObj.workspace_id, sender_id: userProfile.id, message: text || "", reply_to_message_id: replyingToMessage?.id || null }).select('id').single();
      if (sendError) throw sendError;
      messageId = msgData.id;
      setUploadProgress(5);
      if (selectedFiles.length > 0) {
        const totalFiles = selectedFiles.length;
        for (let i = 0; i < totalFiles; i++) {
          const file = selectedFiles[i];
          setUploadingFileIndex(i + 1);
          setUploadingFileName(file.name);
          const safeName = sanitizeFileName(file.name);
          const storagePath = `${chatObj.workspace_id}/${chatObj.id}/${messageId}/${safeName}`;
          const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(storagePath, file, { upsert: false, contentType: file.type });
          if (uploadError) {
            if (uploadedPaths.length > 0) await supabase.storage.from('chat-attachments').remove(uploadedPaths);
            await supabase.from('chat_messages').delete().eq('id', messageId);
            throw uploadError;
          }
          uploadedPaths.push(storagePath);
          const { error: attachError } = await supabase.from('chat_message_attachments').insert({ workspace_id: chatObj.workspace_id, channel_id: chatObj.id, message_id: messageId, uploaded_by: userProfile.id, file_name: file.name, file_path: storagePath, file_type: file.type || null, file_size_bytes: file.size });
          if (attachError) {
            if (uploadedPaths.length > 0) await supabase.storage.from('chat-attachments').remove(uploadedPaths);
            await supabase.from('chat_messages').delete().eq('id', messageId);
            throw attachError;
          }
          const stepProgress = 5 + ((i + 1) / totalFiles) * 95;
          setUploadProgress(Math.min(stepProgress, 100));
        }
      } else {
        setUploadProgress(100);
      }
      setMessageInput("");
      setSelectedFiles([]);
      setReplyingToMessage(null);
      setUploadProgress(0);
      setUploadingFileIndex(0);
      setUploadingFileName("");
      await fetchMessages(chatObj.id);
      fetchUnreadCounts();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Transmission Failed", description: err.message });
      setUploadProgress(0);
      setUploadingFileIndex(0);
      setUploadingFileName("");
    } finally {
      setIsSending(false);
    }
  };

  const handleStartChat = async () => {
    if (!activeWorkspace || isStartingChat) return;
    if (chatMode === 'direct' && !selectedMemberId) return;
    if (chatMode === 'group' && (!groupName.trim() || selectedMemberIds.length < 2)) return;
    setIsStartingChat(true);
    try {
      let channelId: string | null = null;
      if (chatMode === 'direct') {
        const { data, error } = await supabase.rpc("create_or_get_direct_chat", { p_workspace_id: activeWorkspace.id, p_other_user_id: selectedMemberId });
        if (error) throw error;
        channelId = data;
      } else {
        const { data, error } = await supabase.rpc("create_group_chat", { p_workspace_id: activeWorkspace.id, p_name: groupName.trim(), p_member_user_ids: selectedMemberIds });
        if (error) throw error;
        channelId = data;
      }

      // 1. Close modal and clear inputs
      setIsNewChatOpen(false);
      setSelectedMemberId(null);
      setSelectedMemberIds([]);
      setGroupName("");
      setMemberSearchQuery("");

      // 2. Immediate data sync
      await fetchChats();

      // 3. Selection and navigation
      if (channelId) {
        // Verify current user membership in local list or fetch it directly
        const { data: membership } = await supabase
          .from('chat_channel_members')
          .select('id')
          .eq('channel_id', channelId)
          .eq('user_id', userProfile?.id)
          .single();
        
        if (membership) {
          handleSelectChat(channelId);
        } else {
          toast({ variant: "destructive", title: "Initialization Error", description: "Unable to verify membership in new channel." });
        }
      }
      
      toast({ title: chatMode === 'group' ? "Focus group created" : "Direct chat initialized" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Handshake Failed", description: err.message });
    } finally {
      setIsStartingChat(false);
      forceUnlockUI();
    }
  };

  const filteredChats = chats.filter(c => c.display_name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredMembers = workspaceMembers.filter(m => m.full_name?.toLowerCase().includes(memberSearchQuery.toLowerCase()) || m.username?.toLowerCase().includes(memberSearchQuery.toLowerCase()) || m.email?.toLowerCase().includes(memberSearchQuery.toLowerCase()));
  const addableMembers = workspaceMembers.filter(m => {
    const isAlreadyMember = infoMembers.some(im => im.user_id === m.id);
    const matchesSearch = m.full_name?.toLowerCase().includes(addMembersSearchQuery.toLowerCase()) || m.username?.toLowerCase().includes(addMembersSearchQuery.toLowerCase()) || m.email?.toLowerCase().includes(addMembersSearchQuery.toLowerCase());
    return !isAlreadyMember && matchesSearch;
  });
  const totalUnread = Object.keys(unreadCounts).reduce((acc, currId) => {
    const isMuted = muteStates[currId]?.is_muted && (!muteStates[currId].muted_until || new Date(muteStates[currId].muted_until!) > new Date());
    if (isMuted) return acc;
    return acc + (unreadCounts[currId] || 0);
  }, 0);
  const isCurrentChatMuted = selectedChatId ? (muteStates[selectedChatId]?.is_muted && (!muteStates[selectedChatId]?.muted_until || new Date(muteStates[selectedChatId].muted_until!) > new Date())) : false;
  const selectedChat = chats.find(c => c.id === selectedChatId);
  const currentUserInGroup = infoMembers.find(m => m.user_id === userProfile?.id);
  const isAdminOrSuper = userRole === 'superadmin' || userRole === 'admin' || userRole === 'manager';
  const canUserManageRoster = currentUserInGroup?.role === 'admin' || isAdminOrSuper;
  const onlineCount = useMemo(() => {
    if (!selectedChat) return 0;
    if (selectedChat.name.toLowerCase() === 'general') return Object.keys(onlineUsers).length;
    return infoMembers.filter(m => !!onlineUsers[m.user_id]).length;
  }, [selectedChat, infoMembers, onlineUsers]);

  return (
    <div className="h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] flex overflow-hidden bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] shadow-2xl animate-in fade-in duration-500 relative">
      <div className={cn("w-full md:w-[350px] border-r dark:border-slate-800 flex flex-col shrink-0 transition-all", showConversation ? "hidden md:flex" : "flex")}>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Chat</h1>
              {totalUnread > 0 && <Badge className="bg-primary text-white text-[10px] h-5 rounded-full border-2 border-white dark:border-slate-900">{totalUnread > 99 ? "99+" : totalUnread}</Badge>}
            </div>
            <Button size="icon" variant="ghost" className="rounded-xl text-primary hover:bg-primary/5" aria-label="New Chat" onClick={() => { setIsNewChatOpen(true); fetchMembers(); }}>
              <Plus className="w-5 h-5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search everything..." className="pl-10 h-11 bg-slate-100 dark:bg-slate-800 border-none rounded-xl" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            {searchQuery && <button className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Clear Search" onClick={() => { setSearchQuery(""); setGlobalSearchResults([]); }}><X className="w-4 h-4 text-slate-400" /></button>}
          </div>
        </div>
        <ScrollArea className="flex-1 px-3">
          <div className="space-y-6 pb-6">
            {searchQuery.length >= 2 && (
              <div className="space-y-1 px-1">
                <div className="flex items-center justify-between px-2 mb-2">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Message Threads</p>
                   {isGlobalSearching && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                </div>
                {globalSearchResults.map((res) => (
                  <button key={`global-${res.id}`} onClick={() => handleJumpToMessage(res.channel_id, res.id)} className="w-full text-left p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 flex gap-3">
                    <Avatar className="w-8 h-8 shrink-0"><AvatarImage src={res.profiles?.avatar_preset ? `/avatars/${res.profiles.avatar_preset}.png` : res.profiles?.avatar_url} /><AvatarFallback className="text-[10px]">{res.profiles?.full_name?.[0]}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-baseline mb-0.5"><p className="text-xs font-bold truncate">{res.channel_display_name}</p><span className="text-[9px] text-slate-400 shrink-0 ml-1">{new Date(res.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span></div>
                       <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 leading-relaxed"><span className="font-bold text-slate-700 dark:text-slate-300 mr-1">{res.profiles?.full_name?.split(' ')[0]}:</span>{res.message}</p>
                    </div>
                  </button>
                ))}
                <Separator className="my-4 opacity-50" />
              </div>
            )}
            <div className="space-y-1">
              {loadingChats ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /><p className="text-xs font-medium">Synchronizing conversations...</p></div>
              ) : filteredChats.map((chat) => {
                  const isActive = selectedChatId === chat.id;
                  const unreadCount = unreadCounts[chat.id] || 0;
                  const isMuted = muteStates[chat.id]?.is_muted && (!muteStates[chat.id].muted_until || new Date(muteStates[chat.id].muted_until!) > new Date());
                  const isUserOnline = chat.type === 'direct' && chat.other_user_id ? !!onlineUsers[chat.other_user_id] : false;
                  return (
                    <button key={chat.id} onClick={() => handleSelectChat(chat.id)} className={cn("w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all hover:bg-slate-50 dark:hover:bg-slate-800", isActive && "bg-primary/10")}>
                      <div className="relative">
                        <Avatar className="w-12 h-12 border-2 border-white dark:border-slate-800 shadow-sm shrink-0">
                          <AvatarImage src={chat.display_avatar_preset ? `/avatars/${chat.display_avatar_preset}.png` : chat.display_avatar} />
                          <AvatarFallback className="bg-primary/10 text-primary font-bold">
                            {chat.name.toLowerCase() === 'general' ? <Hash className="w-5 h-5" /> : chat.type === 'group' ? <Users className="w-5 h-5" /> : (chat.display_name?.[0] || 'C').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {isUserOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0"><p className={cn("font-bold text-sm truncate", isActive ? "text-primary" : "text-slate-900 dark:text-white")}>{chat.display_name}</p>{isMuted && <BellOff className="w-3 h-3 text-slate-400" />}</div>
                          {chat.last_message_at && <span className="text-[10px] text-slate-400 font-medium ml-2 shrink-0">{new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{chat.last_message || 'No activity yet'}</p>
                          {unreadCount > 0 && <Badge className={cn("h-5 min-w-[20px] px-1 text-white text-[10px] font-bold rounded-full border-2 border-white dark:border-slate-900 shrink-0", isMuted ? "bg-slate-400" : "bg-primary")}>{unreadCount > 99 ? "99+" : unreadCount}</Badge>}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </ScrollArea>
      </div>

      <div 
        className={cn("flex-1 flex flex-col bg-slate-50/30 dark:bg-slate-950/20 transition-all relative", !showConversation ? "hidden md:flex" : "flex")}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {selectedChat ? (
          <>
            <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex items-center justify-between">
              {isSearchOpen ? (
                <div className="flex items-center gap-3 w-full"><Button variant="ghost" size="icon" aria-label="Close Search" onClick={() => { setIsSearchOpen(false); setInChatSearchQuery(""); setInChatSearchResults([]); }}><ChevronLeft className="w-5 h-5" /></Button><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Filter this thread..." className="pl-10 h-10 bg-slate-100 dark:bg-slate-800 border-none rounded-xl" value={inChatSearchQuery} onChange={(e) => setInChatSearchQuery(e.target.value)} autoFocus />{inChatSearchQuery && <button className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Clear Query" onClick={() => { setInChatSearchQuery(""); setInChatSearchResults([]); }}><X className="w-4 h-4 text-slate-400" /></button>}</div></div>
              ) : (
                <>
                  <div className="flex items-center gap-4 min-w-0"><Button variant="ghost" size="icon" aria-label="Back" className="md:hidden rounded-xl h-10 w-10" onClick={() => setShowConversation(false)}><ChevronLeft className="w-6 h-6" /></Button><Avatar className="w-10 h-10 cursor-pointer" onClick={() => { setIsInfoSheetOpen(true); fetchInfoMembers(); }}><AvatarImage src={selectedChat.display_avatar_preset ? `/avatars/${selectedChat.display_avatar_preset}.png` : selectedChat.display_avatar} /><AvatarFallback className="bg-primary/10 text-primary font-bold">{selectedChat.name.toLowerCase() === 'general' ? <Hash className="w-4 h-4" /> : selectedChat.type === 'group' ? <Users className="w-4 h-4" /> : (selectedChat.display_name?.[0] || 'C').toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><div className="flex items-center gap-2"><p className="font-bold text-sm md:text-base dark:text-white truncate">{selectedChat.display_name}</p>{isCurrentChatMuted && <BellOff className="w-3 h-3 text-slate-400" />}</div><p className={cn("text-[10px] md:text-xs font-medium flex items-center gap-1.5", (selectedChat.type === 'direct' && selectedChat.other_user_id && onlineUsers[selectedChat.other_user_id]) || (selectedChat.type !== 'direct' && onlineCount > 0) ? "text-emerald-500" : "text-slate-400")}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", (selectedChat.type === 'direct' && selectedChat.other_user_id && onlineUsers[selectedChat.other_user_id]) || (selectedChat.type !== 'direct' && onlineCount > 0) ? "bg-emerald-500" : "bg-slate-300")} />
                    {selectedChat.type === 'direct' ? (
                      selectedChat.other_user_id && onlineUsers[selectedChat.other_user_id] ? "Online" : 
                      (selectedChat.other_user_last_seen ? `Last seen ${formatLastSeen(selectedChat.other_user_last_seen)}` : "Offline")
                    ) : `${onlineCount} online`}
                  </p></div></div>
                  <div className="flex items-center gap-1">
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="Chat Info" className="rounded-xl text-slate-400" onClick={() => { setIsInfoSheetOpen(true); fetchInfoMembers(); }}><Info className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent>Conversation details</TooltipContent></Tooltip></TooltipProvider>
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="Detach" className="rounded-xl text-slate-400 hover:text-primary" onClick={() => addBubble(selectedChat)}><MessageCircle className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent>Open as floating window</TooltipContent></Tooltip></TooltipProvider>
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="Media & Files" className="rounded-xl text-slate-400" onClick={() => { setIsMediaSheetOpen(true); fetchMedia(); }}><Files className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent>Shared assets</TooltipContent></Tooltip></TooltipProvider>
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="Search" className="rounded-xl text-slate-400" onClick={() => setIsSearchOpen(true)}><Search className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent>Search thread</TooltipContent></Tooltip></TooltipProvider>
                    <DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="More Options" className="rounded-xl text-slate-400"><MoreVertical className="w-5 h-5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 dark:bg-slate-900 dark:border-slate-800">
                        <DropdownMenuLabel className="dark:text-slate-100">Notification Settings</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setIsNotificationSettingsOpen(true)} className="gap-2"><Settings className="w-4 h-4" /> Global Preferences</DropdownMenuItem>
                        <DropdownMenuSeparator className="dark:bg-slate-800" />
                        <DropdownMenuLabel className="dark:text-slate-100">Quick Mute</DropdownMenuLabel>
                        {isCurrentChatMuted ? <DropdownMenuItem onClick={handleUnmute} className="gap-2 text-primary font-medium"><Bell className="w-4 h-4" /> Restore Alerts</DropdownMenuItem> : <><DropdownMenuItem onClick={() => handleMute('1h')}>Mute for 1 hour</DropdownMenuItem><DropdownMenuItem onClick={() => handleMute('8h')}>Mute for 8 hours</DropdownMenuItem><DropdownMenuItem onClick={() => handleMute('24h')}>Mute for 24 hours</DropdownMenuItem><DropdownMenuItem onClick={() => handleMute('forever')} className="text-rose-500">Mute Indefinitely</DropdownMenuItem></>}
                        {selectedChat.type === 'direct' && (
                          <>
                            <DropdownMenuSeparator className="dark:bg-slate-800" />
                            <DropdownMenuLabel className="dark:text-slate-100">Manage Chat</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setIsDeleteChatDialogOpen(true)} className="text-rose-500 gap-2 dark:hover:bg-rose-500/10">
                              <Trash2 className="w-4 h-4" /> Delete Chat
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </>
              )}
            </div>
            {isSearchOpen && inChatSearchQuery.length >= 2 && (
              <div className="absolute top-20 left-4 right-4 md:left-[350px] z-[40] pointer-events-none"><div className="max-w-xl mx-auto w-full pointer-events-auto bg-white dark:bg-slate-900 border dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden max-h-[60vh] flex flex-col"><div className="p-3 bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800 flex items-center justify-between"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Context Hits</span>{isSearching && <Loader2 className="w-3 h-3 animate-spin text-primary" />}</div><ScrollArea className="flex-1"><div className="p-1 space-y-1">{inChatSearchResults.map(res => (<button key={res.id} className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex gap-3 group" onClick={() => { const el = document.getElementById(`message-${res.id}`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setHighlightedMessageId(res.id); setTimeout(() => setHighlightedMessageId(null), 3000); } }}><Avatar className="w-8 h-8"><AvatarImage src={res.profiles?.avatar_preset ? `/avatars/${res.profiles.avatar_preset}.png` : res.profiles?.avatar_url} /><AvatarFallback className="text-[10px]">{res.profiles?.full_name?.[0]}</AvatarFallback></Avatar><div className="flex-1 min-w-0"><div className="flex justify-between items-baseline mb-0.5"><p className="text-xs font-bold truncate group-hover:text-primary">{res.profiles?.full_name}</p><span className="text-[9px] text-slate-400 shrink-0 ml-2">{new Date(res.created_at).toLocaleDateString()}</span></div><p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{res.message}</p></div></button>))}</div></ScrollArea></div></div>
            )}
            <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 md:px-8">
              <div className="py-8 space-y-6">
                {loadingMessages ? <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3"><Loader2 className="w-8 h-8 animate-spin" /><p className="text-sm font-medium">Synchronizing history...</p></div> : messages.length === 0 ? <p className="text-center text-sm text-slate-400 py-20 italic">No messages yet. Start the conversation!</p> : messages.map((msg) => {
                  const isMe = msg.sender_id === userProfile?.id;
                  const isHighlighted = highlightedMessageId === msg.id;
                  const isEditing = editingMessageId === msg.id;
                  const wasEdited = msg.updated_at && new Date(msg.updated_at).getTime() - new Date(msg.created_at).getTime() > 1000;
                  const canDelete = isMe || (selectedChat?.type === 'group' && canUserManageRoster) || isAdminOrSuper;
                  const isTaskDeleted = msg.tasks?.is_deleted;
                  const isTaskUnavailable = msg.created_task_id && !msg.tasks;
                  const imageAttachments = msg.attachments?.filter(a => a.file_type?.startsWith('image/')) || [];
                  const otherAttachments = msg.attachments?.filter(a => !a.file_type?.startsWith('image/')) || [];
                  return (
                    <div key={msg.id} id={`message-${msg.id}`} className={cn("group flex gap-3 max-w-[85%] md:max-w-[70%] transition-all", isMe ? "ml-auto flex-row-reverse" : "mr-auto", isHighlighted && "scale-105")}>
                      {!isMe && <Avatar className="w-8 h-8 shrink-0 mt-1"><AvatarImage src={msg.profiles?.avatar_preset ? `/avatars/${msg.profiles.avatar_preset}.png` : msg.profiles?.avatar_url} /><AvatarFallback className="text-[10px]">{msg.profiles?.full_name?.[0]}</AvatarFallback></Avatar>}
                      <div className={cn("flex flex-col relative", isMe ? "items-end" : "items-start", isEditing && "w-full")}>
                        {!isMe && <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1">{msg.profiles?.full_name}</span>}
                        {isEditing ? (
                          <div className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl border-2 border-primary/20 space-y-2">
                             <p className="text-[9px] font-bold text-primary uppercase tracking-widest px-1">Editing Message</p>
                             <Textarea value={editMessageInput} onChange={e => setEditMessageInput(e.target.value)} className="min-h-[80px] bg-white dark:bg-slate-950 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 text-sm" autoFocus onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleUpdateMessage(); } if (e.key === 'Escape') setEditingMessageId(null); }} />
                             <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold uppercase" onClick={() => setEditingMessageId(null)} disabled={isEditingLoading}>Cancel</Button>
                                <Button size="sm" className="h-7 text-[10px] font-bold uppercase" onClick={handleUpdateMessage} disabled={isEditingLoading || !editMessageInput.trim()}>{isEditingLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save Changes'}</Button>
                             </div>
                          </div>
                        ) : (
                          <div className={cn("rounded-2xl shadow-sm text-sm leading-relaxed border-2 border-transparent transition-all relative", isMe ? "bg-primary text-white rounded-tr-none" : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border dark:border-slate-700", isHighlighted && "border-primary ring-4 ring-primary/20", msg.message || msg.attachments?.length ? "px-4 py-3" : "p-1")}>
                            {msg.reply_to && (
                              <div onClick={() => handleJumpToMessage(msg.channel_id, msg.reply_to!.id)} className={cn("mb-2 p-2 rounded-lg border-l-4 cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-[11px]", isMe ? "bg-white/10 border-white/40 text-white/90" : "bg-slate-50 dark:bg-slate-950/50 border-primary/40 text-slate-500 dark:text-slate-400")}><p className="font-bold mb-0.5">{msg.reply_to.profiles?.full_name || "Unknown User"}</p><p className="line-clamp-1 italic">{msg.reply_to.is_deleted ? "Message deleted" : (msg.reply_to.message || "Attachment")}</p></div>
                            )}
                            {msg.message && <p className={cn(msg.attachments?.length ? "mb-3" : "")}>{msg.message}</p>}
                            {imageAttachments.length > 0 && (
                              <div className={cn("grid gap-2 mb-2", imageAttachments.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                                {imageAttachments.map((att) => (
                                  <div key={att.id} className="relative group/img overflow-hidden rounded-xl bg-black/5 dark:bg-white/5 aspect-square">
                                    {!att.signed_url ? (
                                      <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">Attachment unavailable</div>
                                    ) : (
                                      <>
                                        <img src={att.signed_url} alt={att.file_name} className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setSelectedImageForLightbox(att)} />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                           <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-md border-none text-white hover:bg-white/30" onClick={() => setSelectedImageForLightbox(att)}><Maximize2 className="w-4 h-4" /></Button>
                                           <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-md border-none text-white hover:bg-white/30" onClick={() => window.open(att.signed_url, '_blank')}><Download className="w-4 h-4" /></Button>
                                        </div>
                                        <div className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                           <DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}>
                                              <DropdownMenuTrigger asChild>
                                                <Button size="icon" variant="secondary" className="h-6 w-6 rounded-lg bg-black/40 backdrop-blur-sm border-none text-white"><MoreVertical className="w-3 h-3" /></Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => { setAttachmentToDelete(att); setIsAttachmentDeleteDialogOpen(true); }} className="text-rose-500"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                                              </DropdownMenuContent>
                                           </DropdownMenu>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {otherAttachments.length > 0 && (
                              <div className="space-y-2 mt-2">
                                {otherAttachments.map(att => {
                                  const canDeleteAttachment = (att.uploaded_by === userProfile?.id) || (msg.sender_id === userProfile?.id) || isAdminOrSuper;
                                  return (
                                    <div key={att.id} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-colors group/file", isMe ? "bg-white/10 border-white/20 hover:bg-white/20" : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80")}>
                                      <div className={cn("p-2 rounded-lg", isMe ? "bg-white/20" : "bg-white dark:bg-slate-800 shadow-sm")}>{getFileIcon(att.file_name, att.file_type)}</div>
                                      <div className="flex-1 min-w-0"><p className={cn("text-xs font-bold truncate", isMe ? "text-white" : "text-slate-900 dark:text-slate-100")} title={att.file_name}>{att.file_name}</p><p className={cn("text-[10px] uppercase opacity-70 font-medium", isMe ? "text-white/80" : "text-slate-500")}>{formatBytes(att.file_size_bytes)} • {att.file_name.split('.').pop()?.toUpperCase()}</p></div>
                                      <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg", isMe ? "text-white hover:bg-white/20" : "text-slate-50")} onClick={() => window.open(att.signed_url, '_blank')}><Download className="w-4 h-4" /></Button>
                                        {canDeleteAttachment && (
                                          <DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}>
                                            <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg", isMe ? "text-white hover:bg-white/20" : "text-slate-50")}><MoreVertical className="w-4 h-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                              <DropdownMenuItem onClick={() => { setAttachmentToDelete(att); setIsAttachmentDeleteDialogOpen(true); }} className="text-rose-500"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {msg.created_task_id && (
                              <div className="mt-3 pt-2 border-t border-white/20 dark:border-slate-700">
                                <button disabled={isTaskDeleted || isTaskUnavailable} onClick={() => router.push(`/tasks?taskId=${msg.created_task_id}`)} className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase hover:opacity-80 transition-opacity", isMe ? "text-white" : "text-primary", (isTaskDeleted || isTaskUnavailable) && "opacity-50 cursor-not-allowed")}>{isTaskDeleted ? <><X className="w-3 h-3" /> Task Deleted</> : isTaskUnavailable ? <><AlertTriangle className="w-3 h-3" /> Task Unavailable</> : <><CheckSquare className="w-3 h-3" /> Linked Task Created</>}</button>
                              </div>
                            )}
                            <div className={cn("flex items-center gap-1.5 mt-1.5 justify-end opacity-70 text-[9px] font-bold", isMe ? "text-white/80" : "text-slate-400")}>{wasEdited && <span className="italic mr-1">(edited)</span>}<span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>{isMe && <CheckCheck className="w-3 h-3" />}</div>
                            {!isEditing && (
                              <div className={cn("absolute top-0 opacity-0 md:group-hover:opacity-100 transition-opacity", isMe ? "-left-10" : "-right-10")}>
                                <DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label="Message actions" className="h-8 w-8 rounded-full dark:text-slate-400 dark:hover:text-white"><MoreVertical className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align={isMe ? "end" : "start"} className="w-48 dark:bg-slate-900 dark:border-slate-800">
                                     <DropdownMenuItem onClick={() => setReplyingToMessage(msg)} className="gap-2"><Reply className="h-4 w-4" /> Reply</DropdownMenuItem>
                                     <DropdownMenuItem onClick={() => handleCopyMessage(msg.message)} disabled={!msg.message || msg.message.trim().length === 0} className="gap-2"><Copy className="h-4 w-4" /> Copy Message</DropdownMenuItem>
                                     {isMe && msg.message && <DropdownMenuItem onClick={() => { setEditingMessageId(msg.id); setEditMessageInput(msg.message); }} className="gap-2"><Edit2 className="h-4 w-4" /> Edit Message</DropdownMenuItem>}
                                     {canDelete && <DropdownMenuItem onClick={() => { setMessageIdToDelete(msg.id); setIsMessageDeleteDialogOpen(true); }} className="gap-2 text-rose-500"><Trash2 className="h-4 w-4" /> Delete Message</DropdownMenuItem>}
                                     <DropdownMenuSeparator className="dark:bg-slate-800" />
                                     {msg.created_task_id ? (<><DropdownMenuItem disabled={isTaskDeleted || isTaskUnavailable} onClick={() => router.push(`/tasks?taskId=${msg.created_task_id}`)} className="gap-2"><ExternalLink className="h-4 w-4" /> View Task</DropdownMenuItem><DropdownMenuItem onClick={() => { setMessageIdToUnlink(msg.id); setIsUnlinkConfirmOpen(true); }} className="gap-2 text-rose-500"><X className="h-4 w-4" /> Unlink Task</DropdownMenuItem></>) : (<><DropdownMenuItem onClick={() => handleOpenCreateTask(msg)} className="gap-2"><CheckSquare className="h-4 w-4" /> Create Task</DropdownMenuItem><DropdownMenuItem onClick={() => handleOpenLinkTask(msg)} className="gap-2"><LinkIcon className="h-4 w-4" /> Link Existing Task</DropdownMenuItem></>)}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            {isDragging && !isSending && (
              <div className="absolute inset-0 z-[100] bg-primary/10 backdrop-blur-[2px] flex items-center justify-center pointer-events-none border-4 border-dashed border-primary m-4 rounded-[2rem] animate-in fade-in zoom-in duration-200"><div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border dark:border-slate-800"><div className="p-4 bg-primary/10 rounded-2xl"><Plus className="w-10 h-10 text-primary" /></div><p className="text-xl font-bold dark:text-white">Drop files to attach</p><p className="text-sm text-muted-foreground uppercase font-bold tracking-widest">Up to 5 files • 5MB each</p></div></div>
            )}
            <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t dark:border-slate-800 relative">
              {typingText && (
                <div className="absolute bottom-full left-0 right-0 px-6 py-2 animate-in fade-in slide-in-from-bottom-1 duration-200 pointer-events-none"><div className="flex items-center gap-2 max-w-4xl mx-auto"><div className="flex gap-1"><span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" /><span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" /><span className="w-1 h-1 bg-primary rounded-full animate-bounce" /></div><span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 italic">{typingText}</span></div></div>
              )}
              {isSending && uploadProgress > 0 && (
                <div className="absolute bottom-full left-0 right-0 bg-white dark:bg-slate-900 border-t dark:border-slate-800 p-3 px-6 animate-in slide-in-from-bottom-2 duration-200 z-50 shadow-lg"><div className="max-w-4xl mx-auto space-y-2"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3 overflow-hidden"><Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" /><div className="min-w-0"><p className="text-[10px] font-bold text-primary uppercase tracking-widest">{uploadingFileIndex > 0 ? `Uploading ${uploadingFileIndex} of ${selectedFiles.length}` : 'Starting Transfer...'}</p><p className="text-xs text-slate-500 dark:text-slate-400 truncate">{uploadingFileName || 'Preparing message...'}</p></div></div><span className="text-xs font-bold text-primary">{Math.round(uploadProgress)}%</span></div><Progress value={uploadProgress} className="h-1.5" /></div></div>
              )}
              {replyingToMessage && !isSending && (
                <div className="absolute bottom-full left-0 right-0 bg-slate-50 dark:bg-slate-950 border-t dark:border-slate-800 p-3 px-6 animate-in slide-in-from-bottom-2 duration-200"><div className="flex items-center justify-between gap-4 max-w-4xl mx-auto"><div className="flex items-center gap-3 overflow-hidden"><div className="w-1 h-8 bg-primary rounded-full shrink-0" /><div className="min-w-0"><p className="text-[10px] font-bold text-primary uppercase tracking-widest">Replying to {replyingToMessage.profiles?.full_name}</p><p className="text-xs text-slate-500 dark:text-slate-400 truncate">{replyingToMessage.message || "Attachment"}</p></div></div><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setReplyingToMessage(null)}><X className="w-4 h-4" /></Button></div></div>
              )}
              {selectedFiles.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {selectedFiles.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border dark:border-slate-800 animate-in zoom-in-95 duration-200 group"><div className="p-2 bg-primary/10 rounded-lg">{getFileIcon(file.name, file.type)}</div><div className="min-w-0 max-w-[150px]"><p className="text-xs font-bold truncate">{file.name}</p><p className="text-[10px] text-muted-foreground uppercase">{formatBytes(file.size)}</p></div><Button variant="ghost" size="icon" aria-label="Remove Attachment" className="h-7 w-7 rounded-full hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} disabled={isSending}><X className="w-3.5 h-3.5" /></Button></div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-950 p-2 rounded-2xl border dark:border-slate-800 transition-all focus-within:ring-2 focus-within:ring-primary/20">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} multiple />
                <Button variant="ghost" size="icon" aria-label="Attach File" className="text-slate-400 hover:text-primary rounded-xl shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isSending}><Paperclip className="w-5 h-5" /></Button>
                <Input className="border-none shadow-none bg-transparent focus-visible:ring-0 text-base flex-1 dark:text-white" placeholder={isSending ? "Uploading files..." : "Compose message..."} value={messageInput} onChange={(e) => handleInputChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} disabled={isSending} />
                <Button size="icon" aria-label="Send" onClick={handleSendMessage} className={cn("rounded-xl transition-all", (messageInput.trim() || selectedFiles.length > 0) && !isSending ? "bg-primary" : "bg-slate-300 dark:bg-slate-700")} disabled={(!messageInput.trim() && selectedFiles.length === 0) || isSending}>{isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}</Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4"><MessageSquare className="w-12 h-12 text-primary/40" /><h2 className="text-xl font-bold">Workspace Messenger</h2><p className="text-sm text-slate-500 max-w-xs">Select or start a conversation to begin collaborating with your team.</p></div>
        )}
      </div>

      <Dialog open={isNotificationSettingsOpen} onOpenChange={(open) => { if (!isSavingPrefs) { setIsNotificationSettingsOpen(open); if (!open) forceUnlockUI(); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden dark:bg-slate-950 rounded-[2rem]">
          <div className="p-8 pb-4"><DialogHeader><div className="p-3 bg-primary/10 rounded-2xl w-fit mb-4"><Bell className="w-6 h-6 text-primary" /></div><DialogTitle className="text-2xl font-bold tracking-tight">Notification Preferences</DialogTitle><DialogDescription>Configure how you want to be alerted for new workspace activity.</DialogDescription></DialogHeader><div className="space-y-6 mt-8"><div className="flex items-center justify-between gap-4"><div className="space-y-0.5"><Label className="text-sm font-bold flex items-center gap-2"><MessageSquare className="w-4 h-4 text-slate-400" /> In-App Alerts</Label><p className="text-[10px] text-muted-foreground">Show toast notifications while active in WorkspaceZ.</p></div><Switch checked={notificationPrefs?.in_app_enabled || false} onCheckedChange={(c) => updateNotificationPrefs({ in_app_enabled: c })} disabled={isSavingPrefs} /></div><div className="flex items-center justify-between gap-4"><div className="space-y-0.5"><Label className="text-sm font-bold flex items-center gap-2"><Globe className="w-4 h-4 text-slate-400" /> Desktop Notifications</Label><p className="text-[10px] text-muted-foreground">Receive browser alerts even when tab is in background.</p></div><Switch checked={notificationPrefs?.browser_enabled || false} onCheckedChange={handleToggleBrowserNotifications} disabled={isSavingPrefs} /></div><div className="flex items-center justify-between gap-4"><div className="space-y-0.5"><Label className="text-sm font-bold flex items-center gap-2"><Volume2 className="w-4 h-4 text-slate-400" /> Alert Sounds</Label><p className="text-[10px] text-muted-foreground">Play a subtle audio ping for new chat messages.</p></div><Switch checked={notificationPrefs?.sound_enabled || false} onCheckedChange={(c) => updateNotificationPrefs({ sound_enabled: c })} disabled={isSavingPrefs} /></div><div className="flex items-center justify-between gap-4"><div className="space-y-0.5"><Label className="text-sm font-bold flex items-center gap-2"><Eye className="w-4 h-4 text-slate-400" /> Message Previews</Label><p className="text-[10px] text-muted-foreground">Include a snippet of the message text in notifications.</p></div><Switch checked={notificationPrefs?.show_message_preview || false} onCheckedChange={(c) => updateNotificationPrefs({ show_message_preview: c })} disabled={isSavingPrefs} /></div></div></div>
          <DialogFooter className="p-6 pt-0 bg-slate-50 dark:bg-slate-900/40 border-t dark:border-slate-800 mt-4"><Button variant="ghost" className="w-full rounded-xl" onClick={() => setIsNotificationSettingsOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewChatOpen} onOpenChange={(open) => { setIsNewChatOpen(open); if (!open) forceUnlockUI(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden dark:bg-slate-950 rounded-[2rem]">
          <div className="p-6 pb-0"><DialogHeader><DialogTitle className="text-2xl font-bold">New Thread</DialogTitle><DialogDescription>Start a secure conversation within the workspace.</DialogDescription></DialogHeader><Tabs value={chatMode} onValueChange={(v: any) => setChatMode(v)} className="mt-6"><TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-900"><TabsTrigger value="direct">Direct Message</TabsTrigger><TabsTrigger value="group">Group Channel</TabsTrigger></TabsList><div className="mt-6 space-y-4">{chatMode === 'group' && <div className="space-y-2"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Channel Label</p><Input placeholder="Internal Project X..." value={groupName} onChange={(e) => setGroupName(e.target.value)} className="rounded-2xl" /></div>}<div className="space-y-2"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{chatMode === 'group' ? `Participants (${selectedMemberIds.length})` : 'Select Recipient'}</p><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search roster..." className="pl-10 rounded-2xl" value={memberSearchQuery} onChange={(e) => setMemberSearchQuery(e.target.value)} /></div></div></div></Tabs></div>
          <div className="p-6"><ScrollArea className="h-64"><div className="space-y-2">{loadingMembers ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : filteredMembers.map((member) => { const isSelected = chatMode === 'group' ? selectedMemberIds.includes(member.id) : selectedMemberId === member.id; return (<button key={member.id} onClick={() => chatMode === 'group' ? (setSelectedMemberIds(prev => prev.includes(member.id) ? prev.filter(x => x !== member.id) : [...prev, member.id])) : setSelectedMemberId(member.id)} className={cn("w-full flex items-center gap-4 p-3 rounded-2xl transition-all", isSelected ? "bg-primary/10 ring-1 ring-primary/20 shadow-sm" : "hover:bg-slate-50 dark:hover:bg-slate-900")}><Avatar className="w-10 h-10"><AvatarImage src={member.avatar_preset ? `/avatars/${member.avatar_preset}.png` : member.avatar_url} /><AvatarFallback>{member.full_name[0]}</AvatarFallback></Avatar><div className="flex-1 min-w-0 text-left"><div className="flex items-center gap-1.5"><p className="font-bold text-sm truncate">{member.full_name}</p><Badge variant="outline" className="text-[8px] uppercase">{member.role}</Badge></div><p className="text-[10px] text-slate-500 truncate">@{member.username || member.email.split('@')[0]}</p></div>{isSelected && <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md animate-in zoom-in"><Check className="w-3 h-3 text-white" /></div>}</button>); })}</div></ScrollArea></div>
          <DialogFooter className="p-6 pt-0 border-t dark:border-slate-800"><Button variant="ghost" className="flex-1 rounded-xl" onClick={() => setIsNewChatOpen(false)}>Cancel</Button><Button className="flex-1 rounded-xl shadow-lg" disabled={isStartingChat || (chatMode === 'direct' && !selectedMemberId) || (chatMode === 'group' && (!groupName.trim() || selectedMemberIds.length < 2))} onClick={handleStartChat}>{isStartingChat ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}{isStartingChat ? 'Initializing...' : chatMode === 'group' ? 'Launch Group' : 'Start Thread'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isMediaSheetOpen} onOpenChange={(open) => { setIsMediaSheetOpen(open); if (!open) forceUnlockUI(); }}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col dark:bg-slate-950 overflow-hidden"><div className="p-6 pb-0"><SheetHeader><div className="flex items-center gap-2 mb-1"><Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[10px] h-4">Asset Manager</Badge></div><SheetTitle className="text-2xl font-bold">Media & Files</SheetTitle><SheetDescription>All attachments shared in {selectedChat?.display_name}.</SheetDescription></SheetHeader><Tabs defaultValue="media" className="mt-8 flex-1 flex flex-col"><TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-900/50 mb-6"><TabsTrigger value="media" className="gap-2"><ImageIcon className="w-3.5 h-3.5" /> Gallery</TabsTrigger><TabsTrigger value="files" className="gap-2"><FileIcon className="w-3.5 h-3.5" /> Documents</TabsTrigger></TabsList><ScrollArea className="flex-1 -mx-6 px-6"><TabsContent value="media" className="m-0 pb-8">{loadingMedia ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div> : allMedia.filter(m => m.file_type?.startsWith('image/')).length === 0 ? <p className="text-center text-sm text-slate-400 py-20">No images shared yet.</p> : <div className="grid grid-cols-2 gap-4">{allMedia.filter(m => m.file_type?.startsWith('image/')).map((item) => {
          const canDeleteFromGallery = (item.uploaded_by === userProfile?.id) || (item.chat_messages?.sender_id === userProfile?.id) || isAdminOrSuper;
          return (
            <div key={item.id} className="group relative aspect-square rounded-2xl overflow-hidden border dark:border-slate-800 bg-slate-50 dark:bg-slate-900">{item.signed_url ? (<img src={item.signed_url} alt={item.file_name} className="w-full h-full object-cover cursor-pointer" onClick={() => setSelectedImageForLightbox(item)} />) : (<div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground p-4 text-center">Attachment unavailable</div>)}<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">{item.signed_url && <Button size="icon" variant="secondary" aria-label="View" className="h-8 w-8 rounded-full" onClick={() => setSelectedImageForLightbox(item)}><Maximize2 className="w-3.5 h-3.5" /></Button>}{item.signed_url && <Button size="icon" variant="secondary" aria-label="Download" className="h-8 w-8 rounded-full" onClick={() => window.open(item.signed_url, '_blank')}><Download className="w-3.5 h-3.5" /></Button>}{canDeleteFromGallery && (<Button size="icon" variant="destructive" aria-label="Delete" className="h-8 w-8 rounded-full" onClick={() => { setAttachmentToDelete(item); setIsAttachmentDeleteDialogOpen(true); }}><Trash2 className="w-3.5 h-3.5" /></Button>)}</div></div>
          );
        })}</div>}</TabsContent><TabsContent value="files" className="m-0 pb-8">{allMedia.filter(m => !m.file_type?.startsWith('image/')).length === 0 ? <p className="text-center text-sm text-slate-400 py-20">No files shared yet.</p> : allMedia.filter(m => !m.file_type?.startsWith('image/')).map((item) => {
          const canDeleteFromGallery = (item.uploaded_by === userProfile?.id) || (item.chat_messages?.sender_id === userProfile?.id) || isAdminOrSuper;
          return (
            <div key={item.id} className="flex items-center gap-4 p-3 rounded-2xl border dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:bg-slate-50 transition-colors group"><div className="p-2.5 bg-primary/10 rounded-xl">{getFileIcon(item.file_name, item.file_type)}</div><div className="flex-1 min-w-0"><p className="text-sm font-bold truncate" title={item.file_name}>{item.file_name}</p><p className="text-[10px] text-muted-foreground uppercase">{formatBytes(item.file_size_bytes)}</p></div><div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button size="icon" variant="ghost" aria-label="Download" onClick={() => window.open(item.signed_url, '_blank')}><Download className="w-4 h-4" /></Button>{canDeleteFromGallery && (<Button size="icon" variant="ghost" className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" aria-label="Delete" onClick={() => { setAttachmentToDelete(item); setIsAttachmentDeleteDialogOpen(true); }}><Trash2 className="w-4 h-4" /></Button>)}</div></div>
          );
        })}</TabsContent></ScrollArea></Tabs></div></SheetContent>
      </Sheet>

      <Sheet open={isInfoSheetOpen} onOpenChange={(open) => { setIsInfoSheetOpen(open); if (!open) { setIsRenamingGroup(false); forceUnlockUI(); } }}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col dark:bg-slate-950 overflow-hidden"><div className="p-8 pb-4"><SheetHeader className="items-center text-center"><div className="relative mb-4"><Avatar className="w-20 h-20 border-4 border-white dark:border-slate-800 shadow-xl"><AvatarImage src={selectedChat?.display_avatar_preset ? `/avatars/${selectedChat.display_avatar_preset}.png` : selectedChat?.display_avatar} /><AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">{selectedChat?.name.toLowerCase() === 'general' ? <Hash className="w-10 h-10" /> : selectedChat?.type === 'group' ? <Users className="w-10 h-10" /> : selectedChat?.display_name?.[0]?.toUpperCase()}</AvatarFallback></Avatar>{selectedChat?.type === 'direct' && selectedChat.other_user_id && onlineUsers[selectedChat.other_user_id] && (<div className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 border-4 border-white dark:border-slate-950 rounded-full" />)}</div><div className="flex items-center gap-2">{isRenamingGroup ? (<div className="flex items-center gap-2 mt-2"><Input value={newGroupNameInput} onChange={e => setNewGroupNameInput(e.target.value)} className="h-9 w-48 text-sm" autoFocus maxLength={80} disabled={isRenamingLoading} onKeyDown={(e) => { if (e.key === 'Enter') handleRenameGroup(); if (e.key === 'Escape') setIsRenamingGroup(false); }} /><Button size="icon" className="h-8 w-8 shrink-0" onClick={handleRenameGroup} disabled={isRenamingLoading || !newGroupNameInput.trim()}>{isRenamingLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-4 h-4" />}</Button><Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setIsRenamingGroup(false)} disabled={isRenamingLoading}><X className="w-4 h-4" /></Button></div>) : (<><SheetTitle className="text-2xl font-bold dark:text-white">{selectedChat?.display_name}</SheetTitle>{selectedChat?.type === 'group' && (<Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => { setNewGroupNameInput(selectedChat.name); setIsRenamingGroup(true); }}><Edit2 className="w-4 h-4" /></Button>)}</>)}</div><SheetDescription className="text-sm font-medium text-emerald-500 uppercase tracking-widest mt-1">{selectedChat?.name.toLowerCase() === 'general' ? 'Workspace Channel' : selectedChat?.type === 'direct' ? 'Direct Message' : 'Group Workspace'}</SheetDescription></SheetHeader></div><ScrollArea className="flex-1 px-8 pb-8"><div className="space-y-8 mt-4">{selectedChat?.name.toLowerCase() === 'general' ? (<div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 text-center"><p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed italic">This is the primary workspace hub. Everyone in <strong>{activeWorkspace?.name}</strong> has automatic access to this conversation.</p></div>) : (<><div className="grid grid-cols-2 gap-3"><div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-800"><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Participants</p><p className="text-xl font-bold dark:text-white">{infoMembers.length}</p></div><div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-800"><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Online</p><p className="text-xl font-bold text-emerald-500">{infoMembers.filter(m => !!onlineUsers[m.user_id]).length}</p></div></div><div className="space-y-4"><div className="flex items-center justify-between"><h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Conversation Roster</h4>{loadingInfo && <Loader2 className="w-3 h-3 animate-spin text-primary" />}</div><div className="space-y-3">{infoMembers.length === 0 && !loadingInfo ? (<p className="text-xs text-center text-slate-400 py-4 italic">No participants detected.</p>) : infoMembers.map(member => (<div key={member.id} className="flex items-center justify-between group"><div className="flex items-center gap-3"><div className="relative"><Avatar className="w-9 h-9 border dark:border-slate-800"><AvatarImage src={member.profiles?.avatar_preset ? `/avatars/${member.profiles.avatar_preset}.png` : member.profiles?.avatar_url} /><AvatarFallback className="text-xs">{member.profiles?.full_name?.[0]}</AvatarFallback></Avatar>{onlineUsers[member.user_id] && (<div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full" />)}</div><div className="min-w-0"><div className="flex items-center gap-1.5"><p className="text-sm font-bold truncate dark:text-slate-100">{member.profiles?.full_name}</p>{member.user_id === userProfile?.id && <Badge variant="secondary" className="text-[8px] h-3.5 px-1 py-0 opacity-60">You</Badge>}</div><p className="text-[10px] text-slate-500 truncate">{onlineUsers[member.user_id] ? "Online" : formatLastSeen(member.profiles?.last_seen_at)}</p></div></div><div className="flex items-center gap-2"><Badge variant="outline" className={cn("text-[8px] uppercase h-4 px-1.5", member.role === 'admin' ? "border-primary text-primary" : "text-slate-400")}>{member.role}</Badge>{selectedChat?.type === 'group' && canUserManageRoster && member.user_id !== userProfile?.id && (<DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="w-3.5 h-3.5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48 dark:bg-slate-900 dark:border-slate-800"><DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-500">Manage Member</DropdownMenuLabel>{member.role === 'member' ? (<DropdownMenuItem onClick={() => { setMemberToUpdateRole(member); setNewRoleTarget('admin'); }} className="gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Promote to Admin</DropdownMenuItem>) : (<DropdownMenuItem onClick={() => { setMemberToUpdateRole(member); setNewRoleTarget('member'); }} className="gap-2"><ShieldAlert className="w-4 h-4 text-amber-500" /> Demote to Member</DropdownMenuItem>)}<DropdownMenuSeparator className="dark:bg-slate-800" /><DropdownMenuItem onClick={() => setMemberToRemove(member)} className="text-rose-500 gap-2 dark:hover:bg-rose-500/10"><UserMinus className="w-4 h-4" /> Remove from Group</DropdownMenuItem></DropdownMenuContent></DropdownMenu>)}</div></div>))}</div></div></>)}<div className="space-y-4 pt-4 border-t dark:border-slate-800"><h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Management</h4><div className="space-y-2">{selectedChat?.type === 'group' ? (<><Button variant="outline" className="w-full justify-start gap-3 rounded-xl border-slate-100 dark:border-slate-800" onClick={() => { setNewGroupNameInput(selectedChat.name); setIsRenamingGroup(true); }}><Edit2 className="w-4 h-4" /> Rename Group</Button><Button variant="outline" className="w-full justify-start gap-3 rounded-xl border-slate-100 dark:border-slate-800" onClick={() => { setIsAddMembersOpen(true); fetchMembers(); }}><UserPlus className="w-4 h-4" /> Add Participants</Button><div className="pt-2 flex flex-col gap-2"><AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="w-full justify-start gap-3 rounded-xl text-rose-500 border-rose-50 heart:border-rose-900/20 hover:bg-rose-50 dark:hover:bg-rose-950/20"><LogOut className="w-4 h-4" /> Leave Group</Button></AlertDialogTrigger><AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800"><AlertDialogHeader><AlertDialogTitle className="dark:text-white">Leave Group?</AlertDialogTitle><AlertDialogDescription className="dark:text-slate-400">Are you sure you want to leave <strong>{selectedChat.name}</strong>? You will no longer be able to see or send messages in this group.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="dark:bg-slate-900 dark:text-white dark:border-slate-800">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleLeaveGroup} className="bg-rose-500 hover:bg-rose-600 text-white">{isLeavingLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Leave Group</AlertDialogAction></AlertDialogFooter></AlertDialog></AlertDialog>{canUserManageRoster && (<AlertDialog open={isDeleteGroupOpen} onOpenChange={setIsDeleteGroupOpen}><AlertDialogTrigger asChild><Button variant="outline" className="w-full justify-start gap-3 rounded-xl text-rose-600 border-rose-100 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/10 hover:bg-rose-100 dark:hover:bg-rose-900/30"><Trash2 className="w-4 h-4" /> Delete Group</Button></AlertDialogTrigger><AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800"><AlertDialogHeader><AlertDialogTitle className="dark:text-white">Delete Group?</AlertDialogTitle><AlertDialogDescription className="dark:text-slate-400">This will remove the group <strong>{selectedChat.name}</strong> from members’ chat lists. Message history and shared files will be preserved in the archive.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="dark:bg-slate-900 dark:text-white dark:border-slate-800">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteGroup} className="bg-rose-600 hover:bg-rose-700 text-white" disabled={isArchivingLoading}>{isArchivingLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}Confirm Delete</AlertDialogAction></AlertDialogFooter></AlertDialog></AlertDialog>)}</div></>) : (<p className="text-[10px] text-muted-foreground italic px-1">Management actions are not available for this chat type.</p>)}</div></div></div></ScrollArea></SheetContent>
      </Sheet>

      <Dialog open={!!selectedImageForLightbox} onOpenChange={(open) => { if (!open) { setSelectedImageForLightbox(null); forceUnlockUI(); } }}>
        <DialogContent className="max-w-[90vw] md:max-w-4xl p-0 overflow-hidden dark:bg-slate-950 border-none shadow-2xl">{selectedImageForLightbox && (<div className="flex flex-col h-full"><div className="p-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex items-center justify-between shrink-0"><div className="flex items-center gap-3 overflow-hidden"><div className="p-2 bg-primary/10 rounded-lg shrink-0"><ImageIcon className="w-4 h-4 text-primary" /></div><p className="text-sm font-bold truncate dark:text-white">{selectedImageForLightbox.file_name}</p></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" className="h-8 gap-2 dark:border-slate-800" onClick={() => window.open(selectedImageForLightbox.signed_url, '_blank')}><ExternalLink className="w-3.5 h-3.5" /> Open Original</Button><Button size="sm" className="h-8 gap-2 shadow-lg" onClick={() => window.open(selectedImageForLightbox.signed_url, '_blank')}><Download className="w-3.5 h-3.5" /> Download</Button></div></div><div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-8 flex items-center justify-center min-h-[50vh] max-h-[80vh]"><img src={selectedImageForLightbox.signed_url} alt={selectedImageForLightbox.file_name} className="max-w-full max-h-full object-contain rounded-lg shadow-xl" /></div><div className="p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-800 flex items-center justify-between text-[10px] uppercase font-bold text-slate-500 shrink-0"><span>Size: {formatBytes(selectedImageForLightbox.file_size_bytes)}</span><span>Shared on: {new Date(selectedImageForLightbox.created_at).toLocaleDateString()}</span></div></div>)}</DialogContent>
      </Dialog>

      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => { if (!open) { setMemberToRemove(null); forceUnlockUI(); } }}>
        <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800"><AlertDialogHeader><AlertDialogTitle className="dark:text-white">Remove Member?</AlertDialogTitle><AlertDialogDescription className="dark:text-slate-400">Are you sure you want to remove <strong>{memberToRemove?.profiles?.full_name}</strong> from this conversation? They will lose access to all message history.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="dark:bg-slate-900 dark:text-white dark:border-slate-800" onClick={() => { setMemberToRemove(null); forceUnlockUI(); }}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleRemoveMember} className="bg-rose-500 hover:bg-rose-600 text-white" disabled={isRemovingLoading}>{isRemovingLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Confirm Removal</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!memberToUpdateRole} onOpenChange={(open) => { if (!open) { setMemberToUpdateRole(null); forceUnlockUI(); } }}>
        <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800"><AlertDialogHeader><AlertDialogTitle className="dark:text-white">{newRoleTarget === 'admin' ? 'Promote to Admin?' : 'Demote to Member?'}</AlertDialogTitle><AlertDialogDescription className="dark:text-slate-400">{newRoleTarget === 'admin' ? `Are you sure you want to make ${memberToUpdateRole?.profiles?.full_name} an administrator of this group?` : `Are you sure you want to demote ${memberToUpdateRole?.profiles?.full_name} to a normal member?`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="dark:bg-slate-900 dark:text-white dark:border-slate-800" onClick={() => { setMemberToUpdateRole(null); forceUnlockUI(); }}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleUpdateMemberRole} className={cn("bg-primary hover:bg-primary/90 text-white", newRoleTarget === 'member' && "bg-amber-600 hover:bg-amber-700")} disabled={isRoleLoading}>{isRoleLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Confirm Change</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isMessageDeleteDialogOpen} onOpenChange={(open) => { setIsMessageDeleteDialogOpen(open); if (!open) { setMessageIdToDelete(null); forceUnlockUI(); } }}>
        <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800"><AlertDialogHeader><AlertDialogTitle className="dark:text-white">Delete this message?</AlertDialogTitle><AlertDialogDescription className="dark:text-slate-400">This message will be removed from the chat for everyone. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="dark:bg-slate-900 dark:text-white dark:border-slate-800" onClick={() => { setIsMessageDeleteDialogOpen(false); setMessageIdToDelete(null); forceUnlockUI(); }}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteMessage} className="bg-rose-500 hover:bg-rose-600 text-white">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isAttachmentDeleteDialogOpen} onOpenChange={(open) => { setIsAttachmentDeleteDialogOpen(open); if (!open) { setAttachmentToDelete(null); forceUnlockUI(); } }}>
        <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800"><AlertDialogHeader><AlertDialogTitle className="dark:text-white">Delete attachment?</AlertDialogTitle><AlertDialogDescription className="dark:text-slate-400">This file will be removed from the chat for everyone. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="dark:bg-slate-900 dark:text-white dark:border-slate-800" onClick={() => { setIsAttachmentDeleteDialogOpen(false); setAttachmentToDelete(null); forceUnlockUI(); }}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteAttachment} className="bg-rose-500 hover:bg-rose-600 text-white" disabled={isDeletingAttachment}>{isDeletingAttachment ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Confirm Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isUnlinkConfirmOpen} onOpenChange={(open) => { setIsUnlinkConfirmOpen(open); if (!open) { setMessageIdToUnlink(null); forceUnlockUI(); } }}>
        <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800"><AlertDialogHeader><AlertDialogTitle className="dark:text-white">Unlink task?</AlertDialogTitle><AlertDialogDescription className="dark:text-slate-400">This will remove the task link from this message. The task itself will not be deleted.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="dark:bg-slate-900 dark:text-white dark:border-slate-800" onClick={() => { setIsUnlinkConfirmOpen(false); setMessageIdToUnlink(null); forceUnlockUI(); }}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleUnlinkTask} className="bg-rose-500 hover:bg-rose-600 text-white" disabled={isUnlinking}>{isUnlinking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Confirm Unlink</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteChatDialogOpen} onOpenChange={(open) => { setIsDeleteChatDialogOpen(open); if (!open) forceUnlockUI(); }}>
        <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Delete chat?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">
              This will remove the conversation from your chat list. It will not delete the chat for the other person.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-900 dark:text-white dark:border-slate-800">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDirectChat} className="bg-rose-600 hover:bg-rose-700 text-white" disabled={isDeletingChat}>
              {isDeletingChat ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete Conversation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isAddMembersOpen} onOpenChange={(open) => { setIsAddMembersOpen(open); if (!open) forceUnlockUI(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden dark:bg-slate-950 rounded-[2rem]"><div className="p-6 pb-0"><DialogHeader><DialogTitle className="text-2xl font-bold">Expand Roster</DialogTitle><DialogDescription>Select active workspace members to enroll in this group.</DialogDescription></DialogHeader><div className="relative mt-6"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search roster..." className="pl-10 rounded-2xl bg-slate-100 dark:bg-slate-900 border-none" value={addMembersSearchQuery} onChange={(e) => setAddMembersSearchQuery(e.target.value)} /></div></div><div className="p-6"><ScrollArea className="h-64"><div className="space-y-2">{loadingMembers ? (<div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>) : addableMembers.length === 0 ? (<p className="text-center text-sm text-slate-400 py-10 italic">No eligible members found.</p>) : addableMembers.map((member) => { const isSelected = selectedMemberIdsToAdd.includes(member.id); return (<button key={member.id} onClick={() => (setSelectedMemberIdsToAdd(prev => prev.includes(member.id) ? prev.filter(x => x !== member.id) : [...prev, member.id]))} className={cn("w-full flex items-center gap-4 p-3 rounded-2xl transition-all", isSelected ? "bg-primary/10 ring-1 ring-primary/20 shadow-sm" : "hover:bg-slate-50 dark:hover:bg-slate-900")}><Avatar className="w-10 h-10"><AvatarImage src={member.avatar_preset ? `/avatars/${member.avatar_preset}.png` : member.avatar_url} /><AvatarFallback>{member.full_name[0]}</AvatarFallback></Avatar><div className="flex-1 min-w-0 text-left"><div className="flex items-center gap-1.5"><p className="font-bold text-sm truncate">{member.full_name}</p><Badge variant="outline" className="text-[8px] uppercase">{member.role}</Badge></div><p className="text-[10px] text-slate-500 truncate">@{member.username || member.email.split('@')[0]}</p></div><Checkbox checked={isSelected} className="rounded-full" /></button>); })}</div></ScrollArea></div><DialogFooter className="p-6 pt-0 border-t dark:border-slate-800"><Button variant="ghost" className="flex-1 rounded-xl" onClick={() => { setIsAddMembersOpen(false); setSelectedMemberIdsToAdd([]); forceUnlockUI(); }}>Cancel</Button><Button className="flex-1 rounded-xl shadow-lg" disabled={isAddingMembersLoading || selectedMemberIdsToAdd.length === 0} onClick={handleAddMembersToGroup}>{isAddingMembersLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}{isAddingMembersLoading ? 'Enrolling...' : `Add Selected (${selectedMemberIdsToAdd.length})`}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={isCreateTaskOpen} onOpenChange={(open) => { setIsCreateTaskOpen(open); if (!open) { setTaskSourceMessage(null); forceUnlockUI(); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden dark:bg-slate-950 rounded-[2rem]"><div className="p-8 pb-4"><DialogHeader><DialogTitle className="text-2xl font-bold">Create Task from Message</DialogTitle><DialogDescription>Convert this conversation point into a trackable workspace assignment.</DialogDescription></DialogHeader><form onSubmit={handleCreateTaskFromMessage} className="space-y-4 mt-6"><div className="space-y-2"><Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Task Title</Label><Input value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} placeholder="Summarize the action item..." required className="rounded-xl dark:bg-slate-900 border-none" /></div><div className="space-y-2"><Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Description</Label><Textarea value={taskForm.description} onChange={e => setTaskForm({...taskForm, description: e.target.value})} placeholder="Additional context..." rows={4} className="rounded-xl dark:bg-slate-900 border-none" /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Priority</Label><Select value={taskForm.priority} onValueChange={v => setTaskForm({...taskForm, priority: v})}><SelectTrigger className="rounded-xl dark:bg-slate-900 border-none"><SelectValue /></SelectTrigger><SelectContent className="dark:bg-slate-950"><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Due Date</Label><Input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({...taskForm, dueDate: e.target.value})} className="rounded-xl dark:bg-slate-900 border-none" /></div></div><div className="space-y-2"><Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Assign To</Label><Select value={taskForm.assignedTo} onValueChange={v => setTaskForm({...taskForm, assignedTo: v})}><SelectTrigger className="rounded-xl dark:bg-slate-900 border-none"><SelectValue placeholder="Unassigned" /></SelectTrigger><SelectContent className="dark:bg-slate-950"><SelectItem value={userProfile?.id || "me"}>Me ({userProfile?.full_name})</SelectItem>{workspaceMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent></Select></div><DialogFooter className="pt-4 flex-row gap-3"><Button type="button" variant="ghost" className="flex-1 rounded-xl" onClick={() => { setIsCreateTaskOpen(false); forceUnlockUI(); }}>Cancel</Button><Button type="submit" className="flex-1 rounded-xl shadow-lg" disabled={isTaskCreating}>{isTaskCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckSquare className="w-4 h-4 mr-2" />}{isTaskCreating ? "Creating..." : "Create Task"}</Button></DialogFooter></form></div></DialogContent>
      </Dialog>

      <Dialog open={isLinkTaskOpen} onOpenChange={(open) => { setIsLinkTaskOpen(open); if (!open) { setTaskSourceMessage(null); forceUnlockUI(); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden dark:bg-slate-950 rounded-[2rem]"><div className="p-8 pb-4"><DialogHeader><DialogTitle className="text-2xl font-bold tracking-tight">Link Existing Task</DialogTitle><DialogDescription>Associate this message with an active work item in the workspace.</DialogDescription></DialogHeader><div className="space-y-4 mt-6"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search tasks by title..." className="pl-10 h-11 bg-slate-100 dark:bg-slate-900 border-none rounded-xl" value={taskSearchQuery} onChange={(e) => setTaskSearchQuery(e.target.value)} /></div><ScrollArea className="h-64 rounded-xl border dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 p-2">{isSearchingTasks ? (<div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /><p className="text-[10px] font-bold uppercase">Scanning Board...</p></div>) : taskSearchResults.length === 0 ? (<p className="text-center text-sm text-slate-500 py-20 italic">{taskSearchQuery.length < 2 ? "Type to search tasks..." : "No matching tasks found."}</p>) : (<div className="space-y-1">{taskSearchResults.map((task) => (<button key={task.id} onClick={() => setSelectedTaskToLink(task.id)} className={cn("w-full text-left p-3 rounded-xl transition-all flex items-start gap-3", selectedTaskToLink === task.id ? "bg-primary/10 ring-1 ring-primary/20 shadow-sm" : "hover:bg-white dark:hover:bg-slate-900")}><div className={cn("w-1.5 h-10 rounded-full shrink-0", task.priority === 'urgent' ? 'bg-rose-500' : task.priority === 'high' ? 'bg-amber-500' : 'bg-primary')} /><div className="flex-1 min-w-0"><p className="font-bold text-sm truncate dark:text-slate-100">{task.title}</p><div className="flex items-center gap-2 mt-1"><Badge variant="outline" className="text-[8px] h-4 py-0 uppercase opacity-60">{task.status.replace('_', ' ')}</Badge>{task.profiles && (<div className="flex items-center gap-1"><Avatar className="w-3.5 h-3.5"><AvatarImage src={task.profiles.avatar_preset ? `/avatars/${task.profiles.avatar_preset}.png` : task.profiles.avatar_url} /><AvatarFallback className="text-[6px]">{task.profiles.full_name?.[0]}</AvatarFallback></Avatar><span className="text-[9px] text-slate-500 truncate max-w-[60px]">{task.profiles.full_name?.split(' ')[0]}</span></div>)}</div></div>{selectedTaskToLink === task.id && (<div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md animate-in zoom-in"><Check className="w-3 h-3 text-white" /></div>)}</button>))}</div>)}</ScrollArea><DialogFooter className="pt-4 flex-row gap-3"><Button variant="ghost" className="flex-1 rounded-xl" onClick={() => { setIsLinkTaskOpen(false); forceUnlockUI(); }} disabled={isLinkingTask}>Cancel</Button><Button className="flex-1 rounded-xl shadow-lg" disabled={isLinkingTask || !selectedTaskToLink} onClick={handleLinkTask}>{isLinkingTask ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LinkIcon className="w-4 h-4 mr-2" />}{isLinkingTask ? "Linking..." : "Link Selected"}</Button></DialogFooter></div></div></DialogContent>
      </Dialog>
    </div>
  );
}
