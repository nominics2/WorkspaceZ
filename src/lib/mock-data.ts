export const ROLES = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  MEMBER: 'Member',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const TASK_STATUS = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  WAITING: 'Waiting',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
} as const;

export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

export const TASK_PRIORITY = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
} as const;

export type TaskPriority = typeof TASK_PRIORITY[keyof typeof TASK_PRIORITY];

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  assignedTo: string;
  createdBy: string;
  workspaceId: string;
  subWorkspaceId?: string;
  progressMode: 'auto' | 'manual';
  progress: number;
  subtasks: { id: string; title: string; completed: boolean }[];
  attachments: { id: string; name: string; size: number }[];
  comments: { id: string; user: string; text: string; date: string }[];
}

export const MOCK_USER = {
  id: 'u1',
  name: 'Alex Johnson',
  email: 'alex@example.com',
  role: ROLES.SUPERADMIN,
  workspaceId: 'w1',
  avatar: 'https://picsum.photos/seed/alex/100/100',
};

export const MOCK_WORKSPACE = {
  id: 'w1',
  name: 'Tech Innovators',
  joinCode: 'TI-X492',
  storageUsed: 420 * 1024 * 1024, // 420MB
  storageLimit: 1024 * 1024 * 1024, // 1GB
};

export const MOCK_TASKS: Task[] = [
  {
    id: 't1',
    title: 'Design Dashboard v2',
    description: 'Create high-fidelity mockups for the new WorkspaceZ dashboard.',
    status: TASK_STATUS.IN_PROGRESS,
    priority: TASK_PRIORITY.URGENT,
    dueDate: '2024-06-25',
    assignedTo: 'Alex Johnson',
    createdBy: 'Alex Johnson',
    workspaceId: 'w1',
    progressMode: 'manual',
    progress: 65,
    subtasks: [],
    attachments: [],
    comments: [],
  },
  {
    id: 't2',
    title: 'PWA Service Worker Integration',
    description: 'Implement offline support using service workers.',
    status: TASK_STATUS.TODO,
    priority: TASK_PRIORITY.HIGH,
    dueDate: '2024-06-28',
    assignedTo: 'Dev Team',
    createdBy: 'Alex Johnson',
    workspaceId: 'w1',
    progressMode: 'auto',
    progress: 0,
    subtasks: [
      { id: 'st1', title: 'Register service worker', completed: false },
      { id: 'st2', title: 'Cache static assets', completed: false },
    ],
    attachments: [],
    comments: [],
  },
];