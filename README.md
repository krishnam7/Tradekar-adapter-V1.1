# Trade Karo Hybrid Execution Adapter V1.1 (Rugged Edition)

A high-speed, enterprise-grade execution adapter designed for the **Trade Karo Limited** web terminal. This adapter bridges the gap between your automated Trading Strategy (Algo) and the broker terminal using a **Hybrid Automation Engine**.

---

## ⚡ Key Performance & Ruggedness Features

*   **Ultra-Fast Execution**: Optimized UI navigation with dynamic wait logic. Average order placement is **under 6 seconds**.
*   **Unsupervised Reliability**: 
    *   **Auto-Recovery**: Automatically detects browser crashes or page closures and relaunches the session instantly.
    *   **Rugged Selectors**: Uses Angular-native `mat-form-field` selectors to handle floating labels and complex UI states.
*   **Screen Response Feedback**: 
    *   **Active Monitoring**: Confirms trades via both UI "Toasts" and Real-time Position Table auditing.
    *   **Error Snapshots**: Automatically captures a high-res screenshot to `./error_snapshots/` if an execution fails, allowing for instant audit.
*   **Zero Interference**: Uses a project-isolated Chromium profile. It will **never** disturb your personal Chrome history, cookies, or sessions.

---

## 🛠️ Installation & Quick Start

1.  **Install dependencies**:
    ```powershell
    npm install
    ```

2.  **Configure `.env`**:
    Edit the `.env` file with your credentials and security token:
    ```env
    PORT=5005
    AUTH_TOKEN=TRADE_KARO_ALGO_SECURE_TOKEN_2026  # Current secure key
    
    BROKER_USERNAME=8000092803
    BROKER_PASSWORD=YourPassword
    BROKER_NAME=Trade Karo Limited
    
    HEADLESS=false              # Set to true for background operation
    USER_DATA_DIR=./browser_data # Isolated browser profile
    ```

3.  **Run the Adapter**:
    ```powershell
    npm start
    ```

---

## 📡 Algorithmic API Call Guide

The adapter is built for **unsupervised REST API consumption**. Your Algo (Python, PineScript, C#, etc.) should send JSON signals to the adapter's local server.

### **1. Security: API Key Authorization**
The adapter is protected with `x-api-key` validation. 
*   **Active Key**: `TRADE_KARO_ALGO_SECURE_TOKEN_2026`
*   **Header Name**: `x-api-key`

---

### **2. API Reference (POST `/signal`)**

**Endpoint**: `http://localhost:5005/signal`

#### **Payload Fields:**
*   `request_id`: (String) Unique tracking ID for the trade (e.g. `ALGO_101`).
*   `action`: (Enum) `PLACE_ORDER`, `FULL_EXIT`, or `HEARTBEAT`.
*   `symbol`: (String) Market symbol name as searchable in terminal (e.g. `SBIN`, `LT`).
*   `side`: (Enum) `BUY` or `SELL` (Required for placement).
*   `quantity`: (Number) Lot size or units.

#### **Example cURL (SELL Order):**
```bash
curl -X POST http://localhost:5005/signal \
     -H "Content-Type: application/json" \
     -H "x-api-key: TRADE_KARO_ALGO_SECURE_TOKEN_2026" \
     -d '{"request_id":"req_001","action":"PLACE_ORDER","symbol":"SBIN","side":"SELL","quantity":1}'
```

---

### **3. Python Integration (Algo Backend Sample)**
Copy-paste this directly into your Python trading logic:

```python
import requests

SIGNAL_URL = "http://localhost:5005/signal"
API_KEY = "TRADE_KARO_ALGO_SECURE_TOKEN_2026"

def execute_trade(symbol, action, side, qty):
    payload = {
        "request_id": f"ALGO_SIGNAL_{symbol}",
        "action": action,
        "symbol": symbol,
        "side": side,
        "quantity": qty
    }
    headers = {"x-api-key": API_KEY}
    
    try:
        response = requests.post(SIGNAL_URL, json=payload, headers=headers)
        return response.json()
    except Exception as e:
        return {"status": "failed", "error": str(e)}

# Execute: Sell 1 SBIN
response = execute_trade("SBIN", "PLACE_ORDER", "SELL", 1)
print(response)
```

---

## 📸 Error Snapshots & Maintenance
If the adapter encounters a UI issue while you are away, it automatically captures a "Screen Response" to the **`error_snapshots/`** folder. 
*   Filenames include the **Action**, **Symbol**, and **Timestamp**.
*   This provides a perfect audit trail of the terminal state during any failed execution.

---
**Trade Karo Adapter V1.1** | *Rugged. Fast. Autonomous.*
