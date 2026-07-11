# SAP ERP & Commodity Market Data Flow Architecture

This document describes the live, real-world data flow architecture implemented in this application. The system connects physical backend Excel spreadsheets (acting as simulated SAP S/4HANA databases) with live market price fluctuation engines and a real-time foreign exchange API.

---

## 1. Architectural Overview Diagram

```
+---------------------------------------------------------------------------------+
|                                1. FRONTEND CLIENT                               |
|   - SAP Materials & BOM Allocation Grid       - Sourcing Geopolitical Risks     |
|   - Commodity Exchange Ticker Dashboard       - Strategic AI Advisory           |
|                                                                                 |
|                   ▲                                      │                      |
|                   │ [A] GET Requests (Polling/Refresh)   │ [B] POST Save        |
|                   │                                      ▼                      |
+-----------------------------------+---------------------------------------------+
                                    │
                                    ▼
+---------------------------------------------------------------------------------+
|                               2. EXPRESS BACKEND                                |
|   - REST API Endpoints (e.g. /api/materials, /api/commodities, /api/ticker)     |
|   - Real-time Price Fluctuation Loop (Runs every 60 seconds)                    |
|   - Live Market FX Fetch Engine (Queries open.er-api.com)                       |
+-----------------------------------+---------------------------------------------+
                                    │
                                    ├──────────────────────────────┐
                                    ▼                              ▼
+--------------------------------------------------+  +---------------------------+
|               3. DISK DATABASE FILES             |  |      4. EXTERNAL FEEDS    |
|   - /data/sap_automobile.xlsx                    |  |  [C] Live Exchange API    |
|   - /data/sap_pharma.xlsx                        |  |      - USD/INR Tickers    |
|   - /data/sap_retail.xlsx                        |  |      - USD/EUR Tickers    |
|   - /data/sap_telecom.xlsx                       |  |  [D] AI Synthesis         |
|   - /data/sap_finance.xlsx                       |  |      - Gemini models      |
|   - /data/sap_banks.xlsx                         |  |                           |
|   - /data/sap_oil_gas.xlsx                       |  |                           |
|   - /data/sap_manufacturing.xlsx                 |  |                           |
|   - /data/sap_software.xlsx                      |  |                           |
+--------------------------------------------------+  +---------------------------+
```

---

## 2. Dynamic Data Pathways

### [Pathway A] Reading Data (Frontend to Client)
1. The frontend React client issues HTTP GET requests to `/api/materials?industry=xxx` and `/api/commodities?industry=xxx`.
2. Rather than serving static mock data, the Express server uses the `xlsx` library to read, parse, and structure sheets from physical Excel files on the backend disk (`/data/sap_[industry].xlsx`).
3. If an Excel file doesn't exist yet, the system bootstraps it on startup using rich default templates.

### [Pathway B] Writing & Direct Updates (Manual ERP Saves)
1. When a user modifies an inventory count, vendor name, or commodity weight directly on the frontend grid, they hit **Save to SAP Excel DB**.
2. This issues an HTTP POST containing the updated dataset.
3. The Express server merges the edits and writes a clean, fresh binary spreadsheet directly over the existing `.xlsx` file on disk.
4. Next-second updates or reloads automatically read this written spreadsheet.

### [Pathway C] Real-time Market Fluctuation Engine (Automatic Tickers)
1. A backend background process runs every **60 seconds**.
2. The engine reads each industry's physical Excel file from disk.
3. It performs a "random-walk" fluctuation on base metal/commodity prices (Copper, Steel, Aluminum, Nickel) to simulate active trading floors (such as MCX India or the London Metal Exchange).
4. **Dynamic Price Propagation:** It automatically recalculates the `unitPrice` and `totalValue` of each material on disk proportionally based on:
   - The material's explicit **commodity weights** configuration.
   - The newly fluctuated base commodity exchange price.
   - Real-time foreign exchange multipliers.
5. The engine updates the commodity `history` arrays and writes the newly updated sheets directly back to the physical Excel databases on disk.
6. The frontend automatically fetches these updated figures, creating a lively, dynamic, real-world dashboard.

### [Pathway D] Live Foreign Exchange API Feed
1. The backend integrates with the public exchange rate feed `https://open.er-api.com/v6/latest/USD`.
2. Every **5 minutes**, the background scheduler queries the API to fetch live global currency exchange rates (USD/INR, USD/EUR).
3. The live rate directly impacts procurement and sourcing costs, modifying local material master pricing on-the-fly to reflect real currency volatility.

---

## 3. Data Integrity & Status Matrix

| Component | Architecture Role | Real-world Status | Source / Location | Preference |
| :--- | :--- | :--- | :--- | :--- |
| **BOM Materials** | SAP S/4HANA Master Data | **LIVE FILE DATABASE** | `/data/sap_[industry].xlsx` | Excel Disk DB |
| **Commodity Prices** | Global Exchange Market Prices | **LIVE SIMULATION + LIVE FX** | Fluctuated & saved to disk Excel | Real Live Ticker |
| **Exchange Rates (FX)** | Currency Sourcing Volatility | **REAL ONLINE API** | `open.er-api.com` (USD/INR Feed) | Real API Website |
| **Strategic Memo** | Sourcing & Hedge Action Advisory | **LIVE AI GENERATION** | Gemini 3.5 Flash | Live AI Sourcing |
| **Geopolitical Risks** | Regional Trade & Logistical Risk | **LIVE FILE DATABASE** | `/data/sap_[industry].xlsx` (Risk Sheet) | Excel Disk DB |

---

## 4. Troubleshooting and Manual Control

- **Verification:** To confirm database disk operations, you can navigate to the **SAP Excel Databases** tab in the UI. It lists the exact file paths, file sizes, and verification timestamps.
- **Manual Fluctuation Trigger:** If you do not want to wait for the 60-second auto-timer to tick, click the **"Trigger Live Market Price Fluctuation"** button under the *Data Flow & Architecture* panel. This immediately forces a disk rewrite across all Excel databases on the server.
