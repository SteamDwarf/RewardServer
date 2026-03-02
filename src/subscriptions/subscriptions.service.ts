import { BadRequestException, Injectable } from '@nestjs/common';
import { Address } from '@ton/core';
import { ProviderState } from './types/subscriptions.types';

@Injectable()
export class SubscriptionsService {
    private static readonly INTERVAL_DAYS = 30;
    private readonly providers = new Map<string, ProviderState>();

    addProviderAddress(address: string): string {
        const normalized = this.normalizeAddress(address);

        if (!this.providers.has(normalized)) {
            const now = new Date();

            this.providers.set(normalized, {
                createdAt: now,
                lastUpdatedAt: null,
                nextUpdateAt: this.addDays(now, SubscriptionsService.INTERVAL_DAYS),
            });
        }
        return normalized;
    }

    getProviderAddresses(): string[] {
        return Array.from(this.providers.keys());
    }

    getProviderState(address: string): ProviderState | undefined {
        const normalized = this.normalizeAddress(address);

        return this.providers.get(normalized);
    }

    listProviders(): Array<{ address: string; state: ProviderState }> {
        return Array.from(this.providers.entries()).map(([address, state]) => ({
            address,
            state,
        }));
    }

    removeProviderAddress(address: string): { address: string; state: ProviderState } {
        const normalized = this.normalizeAddress(address);
        const state = this.providers.get(normalized);

        if (!state) {
            throw new BadRequestException('Provider not registered');
        }

        this.providers.delete(normalized);

        return { address: normalized, state };
    }

    markProviderUpdated(address: string, updatedAt: Date = new Date()): void {
        const normalized = this.normalizeAddress(address);
        const state = this.providers.get(normalized);
        
        if (!state) {
            throw new BadRequestException('Provider not registered');
        }

        state.lastUpdatedAt = updatedAt;
        state.nextUpdateAt = this.addDays(updatedAt, SubscriptionsService.INTERVAL_DAYS);
    }

    private normalizeAddress(address: string): string {
        try {
            return Address.parse(address).toRawString();
        } catch {
            throw new BadRequestException('Invalid TON address');
        }
    }

    private addDays(date: Date, days: number): Date {
        const d = new Date(date.getTime());
        
        d.setUTCDate(d.getUTCDate() + days);

        return d;
    }
}
