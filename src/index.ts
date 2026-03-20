import { SessionManager } from './browser/session';
import { ApiClient } from './api/client';
import { ExecutionEngine, Signal } from './browser/engine';
import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5005;
const session = new SessionManager();
let apiClient: ApiClient | null = null;
let engine: ExecutionEngine | null = null;

async function bootstrap() {
    console.log('--- Trade Karo Adapter Starting ---');

    // 1. Initialize Browser & Login
    await session.initialize();
    const token = session.getToken();
    const page = session.getPage();

    if (token && page) {
        apiClient = new ApiClient(page);
        engine = new ExecutionEngine(page, apiClient);

        
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        const userId = payload.userId;
        console.log(`Authenticated as User ID: ${userId}`);
        apiClient.setUserId(userId);

    function log(msg: string, ...args: any[]) {
        const ts = new Date().toISOString().replace('T', ' ').substr(0, 19);
        console.log(`[${ts}] ${msg}`, ...args);
    }

    async function checkConnection() {
        if (!apiClient) return;
        try {
            const summary = await apiClient.getAccountSummary();
            log(`[Status] Balance: ${summary.data.balance}`);
        } catch (e: any) {
            log('[Status] Connection lost. Reconnecting...');
            try {
                await session.checkAndLogin();
                log('[Status] Re-Login Successful.');
            } catch (err: any) {
                log('[Status] Re-Login Failed:', err.message);
            }
        }
    }

    // Start Connection Monitor
    setInterval(checkConnection, 60000);

    // API Key security middleware
    const authMiddleware = (req: Request, res: Response, next: any) => {
        const apiKey = req.headers['x-api-key'];
        const validKey = process.env.AUTH_TOKEN;

        if (!apiKey || apiKey !== validKey) {
            log(`[Security] Blocked unauthorized request from ${req.ip}`);
            return res.status(401).json({ status: 'failed', error: 'Unauthorized: Invalid API Key' });
        }
        next();
    };

    // 2. Start Webhook Listener
    app.post('/signal', authMiddleware, async (req: Request, res: Response) => {
        const signal: Signal = req.body;
        log(`--- Incoming Signal: ${signal.action} for ${signal.symbol} (Req: ${signal.request_id}) ---`);
        
        if (signal.action === 'HEARTBEAT') {
            return res.json({ status: 'live', timestamp: new Date().toISOString() });
        }

        if (!engine) {
            log('[Error] Engine not initialized');
            return res.status(503).json({ status: 'failed', error: 'Engine not ready' });
        }

        try {
            const result = await engine.execute(signal);
            log(`[Success] Result for ${signal.request_id}:`, JSON.stringify(result));
            res.json({ status: 'completed', request_id: signal.request_id, result });
        } catch (err: any) {
            log(`[Error] Execution Failed for ${signal.request_id}:`, err.message);
            res.status(500).json({ status: 'failed', request_id: signal.request_id, error: err.message });
        }
    });

    app.listen(PORT, () => {
        log(`Adapter listening on port ${PORT}`);
    });
}

bootstrap().catch(err => {
    console.error('Bootstrap failed:', err);
});
