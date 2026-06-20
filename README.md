# WorkspaceZ

A modern, full-stack team productivity suite built with Next.js, Supabase, and Shadcn UI.

## Features
- **Intelligent Dashboard**: Real-time overview of tasks, workload, and activity logs.
- **Task Management**: Robust system with subtasks, due dates, priority levels, and member assignment.
- **PWA Support**: Installable application with offline capabilities and real-time push notifications.
- **Trash & Recovery**: Secure deletion and restoration for tasks, notes, and notifications.
- **Collaboration**: Real-time workspace chat and shared notes (knowledge base).
- **Admin Control**: Granular role-based permissions, member management, and audit logs.
- **Automation**: Scheduled and manual notification checks for deadlines and reminders.
- **Responsive UI**: Optimized experience for both desktop and mobile devices.

## Tech Stack
- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Database & Auth**: [Supabase](https://supabase.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **AI Integration**: [Genkit](https://github.com/firebase/genkit)

## Push Notifications Setup

To enable PWA Push Notifications, you must configure VAPID keys:

1. Generate keys:
   ```bash
   npx web-push generate-vapid-keys
   ```

2. Add the following to your `.env.local`:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: (The public key generated above)
   - `VAPID_PRIVATE_KEY`: (The private key generated above)
   - `VAPID_SUBJECT`: `mailto:your-email@example.com`

3. Ensure the `public/sw.js` file exists.

## Getting Started

### Prerequisites
- Node.js 18+ 
- A Supabase project

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/nominics2/WorkspaceZ.git
   cd WorkspaceZ
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Copy `.env.example` to `.env.local` and fill in your Supabase credentials.

4. Run the development server:
   ```bash
   npm run dev
   ```

## Repository
[https://github.com/nominics2/WorkspaceZ.git](https://github.com/nominics2/WorkspaceZ.git)
