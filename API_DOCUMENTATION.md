# Trade Karo Adapter V1.1 - API Documentation

This document describes the REST API interface for the Trade Karo Hybrid Execution Adapter. The adapter allows automated trading systems to execute orders on the Trade Karo Limited web terminal via a secure local bridge.

---

## 🔒 Security & Authentication

The adapter is protected by a mandatory API Key validation layer (`x-api-key`).

### **How to Acquire/Configure the API Key**
1.  Open the `.env` file in the root directory.
2.  Locate the `AUTH_TOKEN` variable.
3.  Set it to a unique, secure string.
    *   *Default*: `TRADE_KARO_ALGO_SECURE_TOKEN_2026`
4.  Restart the adapter for changes to take effect.

### **Authorization Header**
Every request to the adapter must include the following header:
```http
x-api-key: <YOUR_AUTH_TOKEN>
```

---

## 📡 REST API Reference

### **Endpoint: POST `/signal`**
The primary interface for submitting trade signals.

#### **URL**: `http://localhost:5005/signal`
#### **Method**: `POST`
#### **Headers**:
- `Content-Type: application/json`
- `x-api-key: [Your API Key]`

#### **Request Body (JSON)**:
| Field | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `request_id` | `string` | A unique identifier for the request (e.g. `ALGO_001`). Used for tracking in logs. | Yes |
| `action` | `string` | The action to perform: `PLACE_ORDER`, `FULL_EXIT`, or `HEARTBEAT`. | Yes |
| `symbol` | `string` | The instrument symbol as it appears in the terminal (e.g. `SBIN`, `RELIANCE`). | Yes (except Heartbeat) |
| `side` | `string` | `BUY` or `SELL`. | Only for `PLACE_ORDER` |
| `quantity` | `number` | The number of units or lots to trade. | Yes (except Heartbeat) |

---

### **Action: PLACE_ORDER**
Executes a new entry in the market.

**Example Payload**:
```json
{
    "request_id": "RELIANCE_ENTRY_001",
    "action": "PLACE_ORDER",
    "symbol": "RELIANCE",
    "side": "BUY",
    "quantity": 10
}
```

### **Action: FULL_EXIT**
Closes all open positions for the specified symbol.

**Example Payload**:
```json
{
    "request_id": "SBIN_EXIT_99",
    "action": "FULL_EXIT",
    "symbol": "SBIN",
    "quantity": 0
}
```

### **Action: HEARTBEAT**
Checks if the adapter and browser session are alive.

**Example Payload**:
```json
{
    "request_id": "HB_778",
    "action": "HEARTBEAT"
}
```

---

## 💻 Integration Examples

### **Python (Requests Library)**
```python
import requests

def send_signal(action, symbol, side, qty):
    url = "http://localhost:5005/signal"
    headers = {
        "x-api-key": "TRADE_KARO_ALGO_SECURE_TOKEN_2026",
        "Content-Type": "application/json"
    }
    payload = {
        "request_id": f"ALGO_SIGNAL_{symbol}",
        "action": action,
        "symbol": symbol,
        "side": side,
        "quantity": qty
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        return response.json()
    except Exception as e:
        return {"status": "failed", "error": str(e)}

# Close SBIN Position
result = send_signal("FULL_EXIT", "SBIN", "SELL", 0)
print(result)
```

### **cURL**
```bash
curl -X POST http://localhost:5005/signal \
     -H "Content-Type: application/json" \
     -H "x-api-key: TRADE_KARO_ALGO_SECURE_TOKEN_2026" \
     -d '{
           "request_id": "CURL_EXIT",
           "action": "FULL_EXIT",
           "symbol": "SBIN",
           "quantity": 0
         }'
```

---

## 🛠️ Errors & Troubleshooting

| Status Code | Reason | Resolution |
| :--- | :--- | :--- |
| `401 Unauthorized` | Missing or incorrect `x-api-key` header. | Verify the key in your code matches the `.env` `AUTH_TOKEN`. |
| `503 Service Unavailable` | Browser session crashed or not initialized. | Check if terminal is open; the adapter will try to auto-relaunch. |
| `500 Internal Server Error` | UI navigation failed (e.g. symbol not found). | Check `error_snapshots/` folder for a screenshot of the failure. |

---
**Trade Karo Adapter V1.1** | *Rugged Trading Infrastructure*
