# Trade Reconciliation Exception Tracker

## Overview
The Trade Reconciliation Exception Tracker is an enterprise-grade, frontend web application designed to streamline the identification, categorization, and resolution of trade breaks in Capital Markets. This tool replaces manual spreadsheet-based reconciliation with a centralized, auditable dashboard.

## Key Features
*   **Secure Authentication:** Local-storage based user registration and session management.
*   **Trade Ingestion:** Drag-and-drop interface for uploading mock CSV/Excel trade files, alongside a validated manual entry form.
*   **Reconciliation Engine (Mock):** Simulated backend matching logic to identify Price, Quantity, and Instrument breaks.
*   **Exception Management:** Interactive data tables with bulk-update capabilities and color-coded status tracking (Open, In Review, Resolved).
*   **Data Visualization:** Integrated Chart.js dashboard displaying match rates and severity metrics.
*   **Reporting & Audit:** Native JavaScript CSV export functionality and a timestamped activity audit trail.

## Tech Stack
*   **Frontend HTML/CSS:** Semantic HTML5, CSS3, Tailwind CSS (via CDN for utility styling).
*   **Frontend Logic:** Vanilla JavaScript (ES6+). No heavy frameworks.
*   **Data Persistence:** Browser `localStorage` (acting as a mock database for the ILP prototype phase).
*   **Charting:** Chart.js (via CDN).

## Directory Structure
├── assets/           # Images, icons, and mock JSON data
├── components/       # Reusable UI elements (Navbar, Sidebar)
├── css/              # Modular stylesheets
├── js/               # Application logic, auth, and state management
└── [HTML Files]      # Page templates (index, dashboard, exceptions, etc.)

## How to Run Locally
Due to CORS security policies regarding dynamic component loading (`fetch`), this application must be served over HTTP, not the `file://` protocol.

1. Open your terminal and navigate to the project root directory.
2. Start a local web server. If using Python, run:
   `python -m http.server 8000`
3. Open your web browser and navigate to:
   `http://localhost:8000`

## Future Integration Scope
This frontend is designed to be decoupled. In the next phase, the `localStorage` mock data layer will be replaced with REST API calls connecting to a .NET/C# backend console application, which will handle the physical matching algorithms and SQL database interactions.
