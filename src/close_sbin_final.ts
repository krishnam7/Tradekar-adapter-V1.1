
import { SessionManager } from './browser/session';
import { ApiClient } from './api/client';
import { ExecutionEngine, Signal } from './browser/engine';
import * as dotenv from 'dotenv';
dotenv.config();

async function closeSbin() {
    console.log('--- Closing SBIN Final ---');
    const session = new SessionManager();
    
    try {
        await session.initialize();
        const page = session.getPage();
        const token = session.getToken();

        if (token && page) {
            const apiClient = new ApiClient(page);
            const engine = new ExecutionEngine(page, apiClient);
            
            const signal: Signal = {
                request_id: `close_sbin_${Date.now()}`,
                action: 'FULL_EXIT',
                symbol: 'SBIN',
                quantity: 0
            };

            const result = await engine.execute(signal);
            console.log('Final Close Result:', JSON.stringify(result, null, 2));
        }
    } catch (e) {
        console.error('Final Close Failed:', e);
    } finally {
        await session.close();
    }
}

closeSbin().catch(console.error);
