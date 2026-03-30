import { Test, TestingModule } from '@nestjs/testing';
import { RewardsService } from './rewards.service';
import { MerkleService } from 'src/merkle/merkle.service';
import { NodesService } from 'src/nodes/nodes.service';
import { NotFoundException } from '@nestjs/common';
import { Address, toNano } from '@ton/core';

describe('RewardsService', () => {
    let service: RewardsService;
    let nodesService: NodesService;

    const mockNodesService = {
        getNodeProviders: jest.fn(),
    };
    const mockMerkleService = {
        getProofHashes: jest.fn(),
        buildProofCell: jest.fn(),
    };

    const addr1 = new Address(0, Buffer.alloc(32, 1)).toString(); // Валидный внутренний адрес 1
    const addr2 = new Address(0, Buffer.alloc(32, 2)).toString(); // Валидный внутренний адрес 2
    const addr3 = new Address(0, Buffer.alloc(32, 3)).toString();

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RewardsService,
                { provide: NodesService, useValue: mockNodesService },
                { provide: MerkleService, useValue: mockMerkleService },
            ],
        }).compile();

        service = module.get<RewardsService>(RewardsService);
        nodesService = module.get<NodesService>(NodesService);
    });

    describe('calculateMonthlyRewards (Jetton Logic)', () => {
        it('должен гарантировать, что сумма наград провайдеров равна totalPool (BigInt)', async () => {
            const mockProviders = [
                {
                    address: addr1, // Валидный адрес 1
                    nodes: [
                        {
                            id: 1,
                            country: 'US',
                            rating: 4.8,
                            uptime: 0.99,
                            tickets: 10,
                            reviewsCount: 50,
                        },
                    ],
                },
                {
                    address: addr2, // Валидный адрес 2
                    nodes: [
                        {
                            id: 2,
                            country: 'DE',
                            rating: 3.5,
                            uptime: 0.85,
                            tickets: 2,
                            reviewsCount: 5,
                        },
                    ],
                },
                {
                    address: addr3, // Валидный адрес 3
                    nodes: [
                        {
                            id: 3,
                            country: 'SG',
                            rating: 5.0,
                            uptime: 1.0,
                            tickets: 20,
                            reviewsCount: 100,
                        },
                    ],
                },
            ];
            mockNodesService.getNodeProviders.mockReturnValue(mockProviders);

            // Имитируем пул в 1000 Jettons (9 знаков после запятой)
            const totalPool = toNano('1000');
            const result = await service.calculateMonthlyRewards({
                totalPool,
                periodId: 1,
            });

            const sum = result.reduce(
                (acc, curr) => acc + BigInt(curr.amount),
                0n,
            );

            // Проверка: ни один нанотон не потерян
            expect(sum).toBe(totalPool);
            expect(result.length).toBe(3);
        });

        it('должен корректно масштабировать базу вниз (baseScale < 1) при пустом пуле', async () => {
            const mockProviders = [
                {
                    address: addr1,
                    nodes: [
                        {
                            id: 1,
                            country: 'DE',
                            rating: 5,
                            uptime: 1,
                            tickets: 0,
                            reviewsCount: 10,
                        },
                    ],
                },
            ];
            mockNodesService.getNodeProviders.mockReturnValue(mockProviders);

            // Базовая стоимость DE (2.0) * Margin (1.2) = 2.4.
            // Мы даем всего 1.0. baseScale должен стать ~0.416
            const totalPool = toNano('1'); // 1.0 Jetton
            const result = await service.calculateMonthlyRewards({
                totalPool,
                periodId: 1,
            });

            expect(BigInt(result[0].amount)).toBe(totalPool);
        });

        it('должен обеспечивать внутреннюю сходимость (сумма нод === сумма провайдера)', async () => {
            const mockProviders = [
                {
                    address: addr1,
                    nodes: [
                        {
                            id: 1,
                            country: 'US',
                            rating: 4,
                            uptime: 1,
                            tickets: 5,
                            reviewsCount: 10,
                        },
                        {
                            id: 2,
                            country: 'US',
                            rating: 5,
                            uptime: 0.9,
                            tickets: 2,
                            reviewsCount: 20,
                        },
                    ],
                },
            ];
            mockNodesService.getNodeProviders.mockReturnValue(mockProviders);

            const totalPool = BigInt('777777777777777'); // Произвольное большое число

            // Используем calculateRewardsFromNodes напрямую, чтобы заглянуть внутрь структуры
            const calculation = service.calculateRewardsFromNodes(totalPool);
            const provider = calculation.providers[0];

            // Считаем сумму всех нод внутри этого провайдера
            const nodesSum = provider.nodes.reduce(
                (sum, node) => sum + BigInt(Math.round(node.totalReward)),
                0n,
            );

            // Сумма нод должна в точности совпадать с тем, что мы выделили провайдеру
            expect(nodesSum).toBe(BigInt(Math.round(provider.totalReward)));
        });
    });

    describe('distributeRemainder', () => {
        it('должен отдавать "лишние" единицы элементам с наибольшим остатком', () => {
            const items = [
                { id: 1, totalReward: 10.9 }, // Должен получить 11
                { id: 2, totalReward: 10.1 }, // Должен получить 10
            ];
            const targetAmount = 21;

            // @ts-ignore (доступ к приватному методу для теста)
            const result = service.distributeRemainder(items, targetAmount);

            expect(result.find((i) => i.id === 1)?.totalReward).toBe(11);
            expect(result.find((i) => i.id === 2)?.totalReward).toBe(10);
            expect(result[0].totalReward + result[1].totalReward).toBe(21);
        });
    });
});
