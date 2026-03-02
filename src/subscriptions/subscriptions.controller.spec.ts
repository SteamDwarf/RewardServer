import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('SubscriptionsController', () => {
    let controller: SubscriptionsController;
    let service: SubscriptionsService;
    const ADDRESS_1 =
        '0:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const ADDRESS_2 =
        '0:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    const requestFor = (address: string) =>
        ({ user: { address } }) as any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [SubscriptionsController],
            providers: [SubscriptionsService],
        }).compile();

        controller = module.get<SubscriptionsController>(
            SubscriptionsController,
        );
        service = module.get<SubscriptionsService>(SubscriptionsService);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('lists providers with their state', () => {
        controller.addProvider(requestFor(ADDRESS_1));
        controller.addProvider(requestFor(ADDRESS_2));

        const list = controller.listProviders();

        expect(list).toHaveLength(2);
        expect(list[0].address).toBe(ADDRESS_1);
        expect(list[1].address).toBe(ADDRESS_2);
        expect(list[0].state).toBe(service.getProviderState(ADDRESS_1));
    });

    it('returns provider addresses in insertion order', () => {
        controller.addProvider(requestFor(ADDRESS_1));
        controller.addProvider(requestFor(ADDRESS_2));

        expect(controller.getProviderAddresses()).toEqual([
            ADDRESS_1,
            ADDRESS_2,
        ]);
    });

    it('returns provider state by address', () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-01-10T00:00:00Z'));

        controller.addProvider(requestFor(ADDRESS_1));
        const result = controller.getProviderState(ADDRESS_1);

        expect(result.address).toBe(ADDRESS_1);
        expect(result.state.createdAt.toISOString()).toBe(
            '2026-01-10T00:00:00.000Z',
        );
    });

    it('throws when provider state is missing', () => {
        expect(() => controller.getProviderState(ADDRESS_1)).toThrow(
            NotFoundException,
        );
    });

    it('registers provider and returns state', () => {
        const result = controller.addProvider(requestFor(ADDRESS_1));

        expect(result.address).toBe(ADDRESS_1);
        expect(result.state).toBeDefined();
        expect(service.getProviderState(ADDRESS_1)).toBe(result.state);
    });

    it('removes provider and returns its state', () => {
        controller.addProvider(requestFor(ADDRESS_1));
        const state = service.getProviderState(ADDRESS_1);

        const removed = controller.removeProvider(requestFor(ADDRESS_1));

        expect(removed).toEqual({ address: ADDRESS_1, state });
        expect(controller.getProviderAddresses()).toEqual([]);
    });

    it('marks provider updated with explicit updatedAt', () => {
        controller.addProvider(requestFor(ADDRESS_1));

        const result = controller.markProviderUpdated(
            requestFor(ADDRESS_1),
            '2026-02-10T12:30:00.000Z',
        );

        expect(result.state.lastUpdatedAt?.toISOString()).toBe(
            '2026-02-10T12:30:00.000Z',
        );
        expect(result.state.nextUpdateAt?.toISOString()).toBe(
            '2026-03-12T12:30:00.000Z',
        );
    });

    it('marks provider updated using current time when updatedAt is omitted', () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-02-01T09:15:00Z'));
        controller.addProvider(requestFor(ADDRESS_1));

        const result = controller.markProviderUpdated(requestFor(ADDRESS_1));

        expect(result.state.lastUpdatedAt?.toISOString()).toBe(
            '2026-02-01T09:15:00.000Z',
        );
        expect(result.state.nextUpdateAt?.toISOString()).toBe(
            '2026-03-03T09:15:00.000Z',
        );
    });

    it('throws on invalid updatedAt', () => {
        controller.addProvider(requestFor(ADDRESS_1));

        expect(() =>
            controller.markProviderUpdated(requestFor(ADDRESS_1), 'not-a-date'),
        ).toThrow(BadRequestException);
    });

    it('throws when marking update for unknown provider', () => {
        expect(() =>
            controller.markProviderUpdated(requestFor(ADDRESS_1)),
        ).toThrow(
            BadRequestException,
        );
    });

    it('throws when removing unknown provider', () => {
        expect(() => controller.removeProvider(requestFor(ADDRESS_1))).toThrow(
            BadRequestException,
        );
    });
});
