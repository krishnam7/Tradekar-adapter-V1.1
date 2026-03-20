import { chromium, BrowserContext, Page } from 'playwright';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

export class SessionManager {
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private token: string | null = null;

    async initialize() {
        const userDataDir = path.resolve(process.env.USER_DATA_DIR || './browser_data');
        const headless = process.env.HEADLESS === 'true';

        const executablePath = process.env.BROWSER_EXECUTABLE_PATH || undefined;

        this.context = await chromium.launchPersistentContext(userDataDir, {
            headless,
            executablePath,
            viewport: { width: 1280, height: 720 },
            args: ['--disable-blink-features=AutomationControlled']
        });

        this.page = await this.context.newPage();
        await this.checkAndLogin();
    }

    public async checkAndLogin() {
        if (!this.page || this.page.isClosed()) {
            console.log('[Ruggedness] Page closed or missing. Relaunching...');
            await this.initialize();
            return;
        }

        console.log('Navigating to terminal...');
        await this.page.goto('https://web.theplatformapi.com/login', { waitUntil: 'networkidle' });

        if (this.page.url().includes('/home')) {
            console.log('[Ruggedness] Already on Dashboard.');
            await this.extractToken();
            return;
        }

        const broker = process.env.BROKER_NAME || 'Trade Karo Limited';
        const username = process.env.BROKER_USERNAME || '';
        const password = process.env.BROKER_PASSWORD || '';

        // 1. Select Broker
        console.log(`Selecting Broker: ${broker}`);
        const searchBox = 'input[placeholder="Search"]';
        try {
            await this.page.waitForSelector(searchBox, { state: 'visible', timeout: 10000 });
            await this.page.fill(searchBox, '', { force: true }); // Clear first
            await this.page.fill(searchBox, broker, { force: true });
            
            // Wait for results
            const brokerOption = `text="${broker}"`;
            await this.page.waitForSelector(brokerOption, { state: 'visible', timeout: 5000 });
            await this.page.click(brokerOption, { force: true });
        } catch (e: any) {
            console.error(`[Ruggedness] Broker selection failed: ${e.message}`);
            const ts = new Date().getTime();
            await this.page.screenshot({ path: `./error_snapshots/login_fail_${ts}.png` });
            throw e;
        }

        // 2. Enter Credentials
        console.log('Entering credentials...');
        const userInp = 'input.mat-mdc-input-element:not([type="password"]):not([placeholder="Search"])';
        await this.page.waitForSelector(userInp, { state: 'visible' });
        await this.page.fill(userInp, username);
        await this.page.fill('input[type="password"]', password);

        // 3. Submit
        await this.page.click('button.login-page-buttons', { force: true });

        // 4. Wait for redirection
        try {
            await this.page.waitForURL('**/home', { timeout: 30000 });
            console.log('Login successful.');
            await this.extractToken();
        } catch (e) {
            console.error('[Ruggedness] Login redirection timed out or failed.');
            throw e;
        }
    }

    private async extractToken() {
        if (!this.page) return;

        // The token is stored in sessionStorage under 'Authorization'
        const tokenData = await this.page.evaluate(() => {
            return sessionStorage.getItem('Authorization') || 
                   localStorage.getItem('token') ||
                   localStorage.getItem('Authorization');
        });

        if (tokenData) {
            this.token = tokenData.replace('Bearer ', '');
            console.log('JWT Token extracted successfully.');
        } else {
            console.warn('Could not find JWT token in storage. Polling API might fail.');
        }
    }

    async getCookies(): Promise<string> {
        if (!this.context) return '';
        const cookies = await this.context.cookies();
        return cookies.map(c => `${c.name}=${c.value}`).join('; ');
    }

    getToken(): string | null {
        return this.token;
    }


    getPage(): Page | null {
        return this.page;
    }

    async close() {
        if (this.context) {
            await this.context.close();
        }
    }
}
