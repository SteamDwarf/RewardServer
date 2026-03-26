import { Test, TestingModule } from '@nestjs/testing';
import { RewardsService } from './rewards.service';
import { MerkleService } from 'src/merkle/merkle.service';
import { NodesService } from 'src/nodes/nodes.service';


describe('RewardsService', () => {
    let service: RewardsService;

    const merkleServiceMock = {
        hashLeaf: jest.fn(),
        hashPair: jest.fn(),
        buildTree: jest.fn(),
        getProof: jest.fn(),
    };

    const nodesServiceMock = {
        getNodeProviders: jest.fn(),
        getProviderByAddress: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RewardsService,
                { provide: MerkleService, useValue: merkleServiceMock },
                { provide: NodesService, useValue: nodesServiceMock },
            ],
        }).compile();

        service = module.get<RewardsService>(RewardsService);

        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should return provider nodes with weights', () => {
        nodesServiceMock.getProviderByAddress.mockReturnValue({
            address: '0:e839e5a22cec5f2370adfbb0a4d713f0479d9861938ed9e2e31abd85244ad58e',
            nodes: [
                { id: 101, country: 'US', rating: 4.8, reviewsCount: 128, tickets: 0, uptime: 0.99 },
            ],
        });

        nodesServiceMock.getNodeProviders.mockReturnValue([
            {
                address: '0:e839e5a22cec5f2370adfbb0a4d713f0479d9861938ed9e2e31abd85244ad58e',
                nodes: [{ id: 101, country: 'US', rating: 4.8, reviewsCount: 128, tickets: 0, uptime: 0.99 }],
            },
        ]);

        const result = service.getProviderNodesWithWeight(
            '0:e839e5a22cec5f2370adfbb0a4d713f0479d9861938ed9e2e31abd85244ad58e',
        );

        expect(result.address).toBeDefined();
        expect(result.nodes.length).toBe(1);
        expect(result.nodes[0].weight).toBeGreaterThanOrEqual(0);
    });
});
