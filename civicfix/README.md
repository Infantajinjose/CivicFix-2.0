# CivicFix 2.0 — Enterprise SaaS Problem Resolution Platform

CivicFix 2.0 is an enterprise-grade multi-tenant community maintenance, civic issue resolution, and spatial operations SaaS platform.

It is designed for municipalities, residential associations, college campuses, hospital complexes, and facility management operators.

---

## 🌟 CivicFix 2.0 Feature Overview

### 1. AI-Powered Complaint Analysis
- **Automatic Classification**: Classifies citizen complaints into categories (`Garbage`, `Water`, `Roads`, `Streetlights`, `Drainage`, `Sanitation`, `Electrical`, `Buildings`, `Other`).
- **Dynamic Priority & Routing**: Recommends `low`, `medium`, `high`, or `urgent` priority and assigns the responsible department.
- **Short Summary Extraction**: Summarizes long complaint descriptions.
- **Duplicate Detection Engine**: Compares incoming reports with recent active issues using Jaccard word-set similarity and GPS Haversine distance formula (within 150m radius).
- **Manager Override**: Department managers and administrators can review and override AI suggestions with a complete audit record.
- **Configurable Fallback**: Uses Google Gemini API if `GEMINI_API_KEY` is provided, or a high-accuracy transparent rule-based NLP engine.

### 2. Real-Time Notification Center (Socket.IO)
- Persistent MongoDB `Notification` records ensuring notifications are never lost on logout.
- Socket.IO live notifications with unread count badge and live interactive dropdown.
- Events tracked:
  - New complaint created
  - Task assigned to worker
  - Status changed
  - Worker accepted / rejected / paused / completed
  - Manager verified work
  - SLA deadline approaching warning (< 20% or 4h left)
  - SLA overdue escalation alert
  - Citizen satisfaction feedback received

### 3. Advanced Live Map & Geographic Intelligence
- Leaflet + OpenStreetMap integration with interactive spatial markers.
- Distinct color coding by priority (`urgent`: red, `high`: orange, `medium`: blue, `low`: slate) and category badges.
- Geographic cluster & repeat hotspot detection.
- Click any marker to view ticket details or assign a field technician directly from the map.
- Strictly protects citizen privacy on public views (no names, phone numbers, or private emails).

### 4. Worker Mobile Portal & Smart Task Management
- Mobile-first field technician interface (`/worker`).
- Filter views: **Today's Tasks**, **Active in Field**, **Pending Acceptance**, **Completed**.
- Direct turn-by-turn navigation via Google Maps or OpenStreetMap.
- Formal lifecycle: `Assigned` &rarr; `Accepted` &rarr; `In Progress` &rarr; `Completed` &rarr; `Verified`.
- Support for pausing with reason, rejecting with reason, and completing with **Before & After photographic evidence**.

### 5. SLA Management & Automatic Escalation
- Organisation-configurable resolution deadlines (e.g. Critical 4h, High 24h, Medium 72h, Low 168h).
- Background scheduler running every 60 seconds (`node-cron`).
- Real-time countdown timer in UI with color-coded urgency states.
- Automatic overdue detection, generating `Escalation` records and dispatching live alerts to department managers.

### 6. Public Transparency Dashboard
- Unauthenticated public dashboard accessible at `/public/:slug`.
- Real-time resolution metrics: Total complaints received, verified closures, closure rate, average resolution duration.
- Civic category bar charts & department performance metrics.
- Safe anonymized spatial map and showcase of recently resolved community problems.

### 7. QR Code-Based Fast Complaint Reporting
- Facility QR Code Generator (`/qr-locations`) for buildings, floors, blocks, and public stations.
- Download high-resolution printable PNG QR badges.
- Citizen scan route (`/report/qr/:code`): automatically resolves location, department, and category so citizens submit complaints with one tap.

### 8. Feedback, Ratings & Resolution Verification
- Citizen resolution rating (1 to 5 stars) and feedback comments.
- Explicit confirmation: "Was the problem solved? Yes / No".
- Reopen workflow: citizens can request ticket reopening with mandatory reason and evidence photos.
- Department satisfaction index and ranking.

### 9. Advanced Predictive Analytics & Insights
- Algorithmic workload forecast projecting estimated complaint velocity for the next 4 weeks.
- Recurrent problem hotspots (geographic zones with repeated incidents).
- Worker workload distribution index and staffing recommendations for overloaded departments.
- One-click CSV and printable PDF report export.

### 10. Multi-Organisation SaaS Subscription & Super Admin
- Three commercial SaaS tiers:
  - **STARTER**: Up to 5 workers, 3 departments, basic tracking.
  - **PROFESSIONAL**: Up to 25 workers, 10 departments, AI analysis, SLA engine, QR reporting, advanced analytics.
  - **ENTERPRISE**: Unlimited workers, custom limits, public dashboard, priority SLA.
- Real-time workspace capacity meters.
- Razorpay test integration + instant sandbox upgrade mode.
- Super Admin Control Center (`/admin/super`) for global platform oversight, organization suspensions, and security audit logs.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 20 or later
- MongoDB (running locally or via MongoDB Atlas)

### 1. Start Backend API
```bash
cd civicfix/backend
npm install
npm run seed     # Populates rich demo data with all 5 roles
npm run dev      # Starts API & Socket.IO on port 5000
```

### 2. Start Frontend App
```bash
cd civicfix/frontend
npm install
npm run dev      # Starts Vite dev server on http://localhost:5173
```

Open your browser at **http://localhost:5173**.

---

## 🔑 Demo Login Accounts

All demo accounts use password: `CivicFix@123`

| Role | Email | Password | Primary Capabilities |
|---|---|---|---|
| **Super Admin** | `superadmin@civicfix.com` | `CivicFix@123` | Platform oversight, tenant approvals, audit logs |
| **Organisation Owner** | `owner@civicfix.demo` | `CivicFix@123` | Full organisation workspace, billing, team setup |
| **Department Manager** | `manager@civicfix.demo` | `CivicFix@123` | Worker dispatch, SLA management, task verification |
| **Field Worker** | `worker@civicfix.demo` | `CivicFix@123` | Mobile portal, accept/start/complete, before/after photos |
| **Resident** | `resident@civicfix.demo` | `CivicFix@123` | Report issue, AI assistance, QR scan, 5-star rating |

---

## 🌐 Public Transparency Portals
- Metropolis Community Transparency: **http://localhost:5173/public/civicfix-demo**
- QR Scan Landing Example: **http://localhost:5173/report/qr/QR-DEMO-A1**
