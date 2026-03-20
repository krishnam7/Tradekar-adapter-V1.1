import { Page } from 'playwright';

export class ApiClient {
    private page: Page;
    private userId: string | null = null;
    private baseUrl: string;

    constructor(page: Page) {
        this.page = page;
        this.baseUrl = process.env.SERVER_API_BASE || '';
    }

    async setUserId(userId: string) {
        this.userId = userId;
    }

    private async browserFetch(url: string) {
        if (!this.page) throw new Error('Browser page not available');
        
        console.log(`Browser Fetching: ${this.baseUrl}${url}`);
        
        // Execute fetch inside the authenticated browser context
        const data = await this.page.evaluate(async ({ fullUrl }) => {
            const token = sessionStorage.getItem('Authorization') || localStorage.getItem('token');
            const response = await fetch(fullUrl, {
                headers: {
                    'Authorization': token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : '',
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        }, { fullUrl: `${this.baseUrl}${url}` });
        
        return data;
    }

    async getAccountSummary() {
        if (!this.userId) throw new Error('UserID not set');
        return await this.browserFetch(`/financialStandings/api/v2/userFinancials/${this.userId}`);
    }

    async getOpenPositions() {
        if (!this.userId) throw new Error('UserID not set');
        return await this.browserFetch(`/trading/api/v2/trading/${this.userId}`);
    }

    async getOrderHistory() {
        if (!this.userId) throw new Error('UserID not set');
        return await this.browserFetch(`/trading/api/v2/history/${this.userId}`);
    }
}

