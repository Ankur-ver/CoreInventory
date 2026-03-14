# CoreInventory IMS — Full-Stack

A production-grade Inventory Management System built with React + TypeScript + Node.js + PostgreSQL.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, React Router v6, Zustand, Axios, TailwindCSS |
| Backend | Node.js, Express, TypeScript |
| Auth | JWT (access + refresh tokens), bcrypt |
| ORM | Prisma |
| Database | PostgreSQL |
| Validation | Zod |

## Project Structure

```
coreinventory/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Auth, error, validation
│   │   ├── models/          # Prisma types re-exports
│   │   ├── routes/          # Express routers
│   │   └── utils/           # JWT, password, response helpers
│   ├── prisma/
│   │   └── schema.prisma    # DB schema
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api/             # Axios instances + endpoint functions
    │   ├── components/      # Reusable UI + layout components
    │   ├── context/         # Auth context
    │   ├── hooks/           # Custom hooks
    │   ├── pages/           # Route-level page components
    │   ├── types/           # Shared TypeScript interfaces
    │   └── utils/           # Helpers
    └── package.json
```

## Quick Start

### 1. Database
```bash
createdb coreinventory
```

### 2. Backend
```bash
cd backend
cp .env.example .env   # fill in your values
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

### Default Credentials (after seed)
- Email: `admin@coreinventory.com`
- Password: `Admin@123`

## API Base URL
`http://localhost:4000/api`
