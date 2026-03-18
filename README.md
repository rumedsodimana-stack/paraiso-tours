# Paraíso Ceylon Tours — Travel Operations Software

A modern travel agency management platform built for Paraíso Ceylon Tours. Built with Next.js 16, TypeScript, and Tailwind CSS.

## Features

- **Dashboard** — Overview of active leads, scheduled tours, revenue, and conversion metrics
- **Lead Management** — Track inquiries, filter by status, search, and manage the full sales cycle
- **Tour Packages** — Browse and view package details with itineraries, inclusions, and pricing
- **Tour Calendar** — Monthly view of scheduled tours with movement tracking
- **Quotations** — Create and manage tour quotations (coming soon)
- **Payments** — Track payments and payouts (coming soon)
- **Hotels & Suppliers** — Manage contracts and supplier data (coming soon)
- **Settings** — User and system configuration (coming soon)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Icons:** Lucide React

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/     # Main app routes
│   │   ├── page.tsx     # Dashboard home
│   │   ├── leads/       # Lead management
│   │   ├── packages/    # Tour packages
│   │   ├── calendar/    # Tour calendar
│   │   └── ...
│   └── layout.tsx       # Root layout
├── components/          # Reusable UI components
├── lib/                 # Types, mock data, utilities
```

## License

Private — Paraíso Ceylon Tours
