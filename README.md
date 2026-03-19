# CoreInventory IMS — Full-Stack

A production-grade Inventory Management System built with React + TypeScript + Node.js + PostgreSQL.
The Inventory Management System (IMS) is a modular digital application designed to efficiently manage and monitor all inventory-related operations within a business. It replaces traditional methods such as manual registers, spreadsheets, and scattered tracking systems with a centralized, real-time, and user-friendly platform.
The primary objective of the system is to simplify stock management, improve accuracy, and enhance operational efficiency by providing a single integrated solution for tracking products, stock levels, purchases, sales, and inventory movements.
The application enables businesses to maintain real-time visibility of inventory, ensuring that stock levels are always up to date. Users can easily add, update, or remove products, monitor available quantities, and receive alerts when inventory reaches low levels. This helps prevent stock shortages, overstocking, and manual errors.

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
