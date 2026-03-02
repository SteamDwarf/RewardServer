import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
    let service: SubscriptionsService;
    const ADDRESS_1 =
        '0:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const ADDRESS_2 =
        '0:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [SubscriptionsService],
        }).compile();

        service = module.get<SubscriptionsService>(SubscriptionsService);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('registers a provider with initial state and returns normalized address', () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

        const normalized = service.addProviderAddress(ADDRESS_1);
        const state = service.getProviderState(ADDRESS_1);

        expect(normalized).toBe(ADDRESS_1);
        expect(state).toBeDefined();
        expect(state?.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
        expect(state?.lastUpdatedAt).toBeNull();
        expect(state?.nextUpdateAt?.toISOString()).toBe(
            '2026-01-31T00:00:00.000Z',
        );
    });

    it('does not overwrite existing provider state on duplicate add', () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-01-05T10:00:00.000Z'));

        service.addProviderAddress(ADDRESS_1);
        const firstState = service.getProviderState(ADDRESS_1);

        jest.setSystemTime(new Date('2026-02-01T10:00:00.000Z'));
        service.addProviderAddress(ADDRESS_1);
        const secondState = service.getProviderState(ADDRESS_1);

        expect(secondState).toBe(firstState);
        expect(secondState?.createdAt.toISOString()).toBe(
            '2026-01-05T10:00:00.000Z',
        );
        expect(secondState?.nextUpdateAt?.toISOString()).toBe(
            '2026-02-04T10:00:00.000Z',
        );
    });

    it('returns a list of provider addresses in insertion order', () => {
        service.addProviderAddress(ADDRESS_1);
        service.addProviderAddress(ADDRESS_2);

        expect(service.getProviderAddresses()).toEqual([ADDRESS_1, ADDRESS_2]);
    });

    it('lists providers with their state', () => {
        service.addProviderAddress(ADDRESS_1);
        const state = service.getProviderState(ADDRESS_1);

        const list = service.listProviders();

        expect(list).toHaveLength(1);
        expect(list[0]).toEqual({
            address: ADDRESS_1,
            state,
        });
    });

    it('removes provider and returns its state', () => {
        service.addProviderAddress(ADDRESS_1);
        const state = service.getProviderState(ADDRESS_1);

        const removed = service.removeProviderAddress(ADDRESS_1);

        expect(removed).toEqual({ address: ADDRESS_1, state });
        expect(service.getProviderState(ADDRESS_1)).toBeUndefined();
        expect(service.getProviderAddresses()).toEqual([]);
    });

    it('marks provider updated and recalculates next update date', () => {
        service.addProviderAddress(ADDRESS_1);
        const updatedAt = new Date('2026-02-10T12:30:00.000Z');

        service.markProviderUpdated(ADDRESS_1, updatedAt);
        const state = service.getProviderState(ADDRESS_1);

        expect(state?.lastUpdatedAt?.toISOString()).toBe(
            '2026-02-10T12:30:00.000Z',
        );
        expect(state?.nextUpdateAt?.toISOString()).toBe(
            '2026-03-12T12:30:00.000Z',
        );
    });

    it('throws when marking update for an unknown provider', () => {
        expect(() => service.markProviderUpdated(ADDRESS_1)).toThrow(
            'Provider not registered',
        );
    });

    it('throws when removing an unknown provider', () => {
        expect(() => service.removeProviderAddress(ADDRESS_1)).toThrow(
            'Provider not registered',
        );
    });

    it('throws on invalid TON address', () => {
        expect(() => service.addProviderAddress('not-a-ton-address')).toThrow(
            'Invalid TON address',
        );
    });
});
