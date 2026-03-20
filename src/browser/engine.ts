import { Page } from 'playwright';
import { ApiClient } from '../api/client';

export interface Signal {
    request_id: string;
    action: 'PLACE_ORDER' | 'MODIFY_POSITION' | 'FULL_EXIT' | 'PARTIAL_EXIT' | 'HEARTBEAT';

    symbol: string;
    side?: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
    stop_loss?: number;
    take_profit?: number;
    position_id?: string;
    partial_exit_quantity?: number;
}

export class ExecutionEngine {
    constructor(private page: Page, private apiClient?: ApiClient) {}

    async execute(signal: Signal): Promise<any> {
        console.log(`Engine executing: ${signal.action} for ${signal.symbol}`);
        
        let result: any;
        switch (signal.action) {
            case 'PLACE_ORDER':
                result = await this.placeOrder(signal);
                break;
            case 'FULL_EXIT':
                result = await this.fullExit(signal);
                break;
            case 'PARTIAL_EXIT':
                result = await this.partialExit(signal);
                break;
            default:
                throw new Error(`Action ${signal.action} not implemented yet`);
        }

        // --- Final Confirmation ---
        if (result.success && this.apiClient) {
            console.log('Performing API Verification...');
            await this.page.waitForTimeout(3000); // Wait for broker to settle
            try {
                const positions = await this.apiClient.getOpenPositions();
                const found = positions.data && positions.data.some((p: any) => 
                    (p.symbol && p.symbol.includes(signal.symbol)) || 
                    (p.ticketID && result.ticket && result.ticket.includes(p.ticketID.toString()))
                );
                
                if (signal.action === 'PLACE_ORDER' && !found) {
                    console.warn('UI reported success, but API does not show position yet.');
                } else if (signal.action === 'FULL_EXIT' && found) {
                    console.warn('UI reported exit, but position still exists in API.');
                }
            } catch (vErr: any) {
                console.warn('API Verification failed (skipping):', vErr.message);
            }
        }

        return result;
    }

    private async waitForToast(timeout = 5000): Promise<{success: boolean, message: string}> {
        try {
            // Looking for common toast/snackbar classes in Angular Material
            const toastSelector = '.mat-mdc-snack-bar-container, .toast-message, .mdc-snackbar__label';
            await this.page.waitForSelector(toastSelector, { state: 'visible', timeout });
            const message = await this.page.innerText(toastSelector);
            console.log(`Toast captured: ${message}`);
            
            // Check for success keywords based on discovery
            const isSuccess = message.toLowerCase().includes('success') || 
                              message.toLowerCase().includes('done') ||
                              message.toLowerCase().includes('executed');
                              
            return { success: isSuccess, message };
        } catch (e) {
            return { success: false, message: 'No confirmation toast seen' };
        }
    }

    private async captureErrorSnapshot(name: string) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `./error_snapshots/error_${name}_${timestamp}.png`;
        try {
            const fs = require('fs');
            const path = require('path');
            const dir = './error_snapshots';
            if (!fs.existsSync(dir)) fs.mkdirSync(dir);
            await this.page.screenshot({ path: filename });
            console.log(`[Ruggedness] Error screenshot captured: ${filename}`);
        } catch (e) {
            console.error('Failed to capture error snapshot:', e);
        }
    }

    private async placeOrder(signal: Signal) {
        try {
            // 1. Find symbol
            const searchInput = 'mat-form-field:has-text("Search by Script Name") input';
            await this.page.waitForSelector(searchInput, { state: 'visible', timeout: 10000 });
            
            // Clear and fill
            await this.page.fill(searchInput, '', { force: true });
            await this.page.fill(searchInput, signal.symbol, { force: true });
            await this.page.keyboard.press('Enter');
            
            // Wait for list to update - instead of static timeout, wait for a row matching the symbol
            console.log(`Searching for ${signal.symbol}...`);
            const scriptSelector = `.script-name:has-text("${signal.symbol}"), .symbol-name:has-text("${signal.symbol}"), :has-text("${signal.symbol}")`;
            await this.page.waitForSelector(scriptSelector, { state: 'visible', timeout: 5000 });

            // 2. Open Order Dialog
            // Improved: Right-click is often more reliable in this UI to show context menu
            await this.page.click(scriptSelector, { button: 'right', force: true });
            
            console.log('Opening "New Position" dialog...');
            const newPosOption = 'text="New Position"';
            await this.page.waitForSelector(newPosOption, { state: 'visible', timeout: 3000 });
            await this.page.click(newPosOption, { force: true });

            // 3. Fill Amount
            const volumeInput = 'input[placeholder="Amount"]';
            await this.page.waitForSelector(volumeInput, { state: 'visible', timeout: 5000 });
            await this.page.fill(volumeInput, signal.quantity.toString(), { force: true });

            // 4. Submit
            const submitBtn = signal.side === 'BUY' ? 'button.buy-btn, button:has-text("BUY")' : 'button.sell-btn, button:has-text("SELL")';
            console.log(`Submitting ${signal.side} order...`);
            await this.page.click(submitBtn, { force: true });

            // --- VERIFICATION 1: Toast ---
            const toast = await this.waitForToast(8000);
            if (!toast.success) {
                console.warn(`[Ruggedness] Order feedback: ${toast.message}`);
            }

            // --- VERIFICATION 2: GUI Row ---
            console.log('Verifying in Positions tab...');
            const positionsTab = 'text="Positions"';
            await this.page.click(positionsTab, { force: true });
            
            const rowSelector = `tr:has-text("${signal.symbol}")`;
            try {
                // Wait for the row to appear in the table
                await this.page.waitForSelector(rowSelector, { state: 'visible', timeout: 10000 });
                console.log(`[Ruggedness] Success: ${signal.symbol} found in Positions.`);
                return { success: true, message: 'Order Confirmed in GUI', ticket: toast.message };
            } catch (e) {
                // Check if it's in history as a safe fallback
                return { success: toast.success, message: toast.success ? 'Order submitted (Toast seen)' : 'Order verification timed out', toast: toast.message };
            }
        } catch (error: any) {
            console.error(`[Ruggedness] PLACE_ORDER Failed: ${error.message}`);
            await this.captureErrorSnapshot(`placeOrder_${signal.symbol}`);
            throw error;
        }
    }

    private async fullExit(signal: Signal) {
        try {
            const positionsTab = 'text="Positions"';
            await this.page.click(positionsTab, { force: true });

            const rowSelector = `tr:has-text("${signal.symbol}")`;
            await this.page.waitForSelector(rowSelector, { state: 'visible', timeout: 5000 });
            
            console.log(`[Ruggedness] Exiting position: ${signal.symbol}`);
            await this.page.click(rowSelector, { button: 'right', force: true });
            
            const closeOption = 'text="Close Checked Positions"';
            await this.page.waitForSelector(closeOption, { state: 'visible', timeout: 3000 });
            await this.page.click(closeOption, { force: true });
            
            const toast = await this.waitForToast(8000);
            return { success: toast.success, message: toast.message };
        } catch (error: any) {
            console.error(`[Ruggedness] FULL_EXIT Failed: ${error.message}`);
            await this.captureErrorSnapshot(`fullExit_${signal.symbol}`);
            throw error;
        }
    }

    private async partialExit(signal: Signal) {
        if (!signal.partial_exit_quantity) throw new Error('Partial exit quantity required');

        await this.page.click('text="Positions"', { force: true });
        await this.page.waitForTimeout(2000);

        const rowSelector = `tr:has-text("${signal.symbol}")`;
        await this.page.waitForSelector(rowSelector);
        
        // In the new UI, we might need a specific "Close" dialog to enter quantity
        // If "Close Checked Positions" closes immediately, we use a different menu option
        console.log(`Right-clicking on position: ${signal.symbol} for partial exit`);
        await this.page.click(rowSelector, { button: 'right', force: true });
        await this.page.waitForTimeout(1000);

        // Try to find a "Close" or similar that opens a dialog
        await this.page.click('text="Close"', { force: true });
        await this.page.waitForTimeout(1000);

        // The partial close dialog should have the "Amount" field
        const volumeInput = 'input[placeholder="Amount"]';
        await this.page.waitForSelector(volumeInput);
        await this.page.fill(volumeInput, signal.partial_exit_quantity.toString(), { force: true });

        await this.page.click('button:has-text("Close Market")', { force: true });
        
        const toast = await this.waitForToast();
        return { success: toast.success, message: toast.message };
    }
}

