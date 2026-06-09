# Acadex - University Attendance Management System

A modern, production-ready university attendance management system built with React, TypeScript, Supabase, and Tailwind CSS.

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 3 + Shadcn/UI
- **Animation**: Framer Motion
- **Routing**: React Router DOM v6
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Icons**: Lucide React
- **Backend**: Supabase (Auth, Database, Realtime, Storage)
- **PWA**: vite-plugin-pwa
- **Export**: jsPDF, xlsx

## Features

### Authentication & Roles
- Email/password authentication via Supabase
- Role-based access control (Student, Admin, Super Admin)
- Protected routes with role guards
- Forgot password / password reset

### Student Dashboard
- Attendance overview with statistics
- Attendance trend charts
- Recent activity feed
- Upcoming sessions
- Mark attendance via session code
- View attendance records (searchable, filterable, paginated)
- Export records to CSV and PDF
- Profile management (edit name, index number)
- Account deletion with confirmation
- View enrolled courses

### Admin Dashboard
- Class overview statistics
- Session management (create, end, delete)
- Automatic unique attendance code generation
- QR code generation for sessions
- Attendance tracking with present/absent lists
- Export attendance to CSV
- Course listing
- Analytics with charts

### Super Admin Dashboard
- Full system overview with analytics
- Student management (search, filter, delete)
- Admin management (promote, demote, add)
- Program management (CRUD)
- Course management (CRUD with program assignment)
- Session overview
- Level promotion system (bulk)
- Audit logs with export
- Data export to CSV and Excel

### General Features
- Mobile-first responsive design
- Dark mode / Light mode
- Toast notifications
- Loading states and error boundaries
- Realtime updates via Supabase Realtime
- PWA support (offline caching, installable)
- Professional university branding
- Smooth animations

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)

### 1. Clone and Install

```bash
git clone <repo-url> acadex
cd acadex
npm install
```

### 2. Supabase Setup

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - (Optional) `supabase/migrations/003_seed_data.sql`

### 3. Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Authentication Setup

In your Supabase dashboard:
1. Go to **Authentication > Providers**
2. Ensure **Email** provider is enabled
3. (Optional) Disable "Confirm email" for development under Email settings

### 5. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 6. Build for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

## Project Structure

```
acadex/
├── public/               # Static assets
├── src/
│   ├── assets/           # Images, fonts
│   ├── components/       # UI and shared components
│   │   ├── ui/           # Shadcn/UI primitives
│   │   └── shared/       # App-specific components
│   ├── contexts/         # React contexts (Auth, Theme)
│   ├── hooks/            # Custom hooks
│   ├── layouts/          # Layout components
│   ├── lib/              # Utilities (supabase client, cn)
│   ├── pages/            # Page components
│   │   ├── auth/         # Login, Register, ForgotPassword
│   │   ├── student/      # Student pages
│   │   ├── admin/        # Admin pages
│   │   └── super-admin/  # Super admin pages
│   ├── routes/           # Route definitions
│   ├── services/         # API service functions
│   ├── types/            # TypeScript types
│   ├── utils/            # Helper utilities
│   ├── App.tsx           # Root component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── supabase/
│   └── migrations/       # SQL migration files
├── .env.example          # Environment template
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Deployment

### Vercel

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
4. Deploy (build command: `npm run build`, output: `dist`)

### Manual

```bash
npm run build
# Serve dist/ with any static file server
```

## Role Descriptions

| Role | Access |
|------|--------|
| **Student** | Own dashboard, mark attendance, view records, edit profile |
| **Admin** | Student view + admin dashboard, session management, class tracking |
| **Super Admin** | Full system control, user management, programs, courses, audit logs |

## API Endpoints (Supabase)

This project uses Supabase client-side SDK directly. No custom backend API needed.

## License

MIT
