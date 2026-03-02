import { Injectable, NotFoundException } from '@nestjs/common';
import { Address } from '@ton/core';
import { MerkleService } from 'src/merkle/merkle.service';
import { NodesService } from 'src/nodes/nodes.service';
import { Node, NodeProvider } from 'src/nodes/types/nodes.types';
import { ProviderNodesWithWeightResponseDTO } from './dto/providerNodesWithWeightResponse.dto';
import { RewardResponseDTO } from './dto/rewardResponse.dto';
import {
    BaseRewardsResult,
    CountryNodeCounts,
    NodeWeightsResult,
    PerfPoolResult,
    ProviderReward,
    ProviderRewardResult,
    RewardsCalculationResult,
    RewardsTreeData,
} from './types/rewards.types';
import { NodesDemandDataResponseDTO } from './dto/nodesDemandDataResponse.dto';

@Injectable()
export class RewardsService {
    private readonly countryBaseCost: Record<string, number> = {
        US: 1.0,
        DE: 2.0,
        FR: 1.5,
        SG: 1.0,
    };
    private readonly countryDemand: Record<string, number> = {
        US: 100,
        DE: 200,
        FR: 200,
        SG: 300,
    };
    private readonly baseMargin = 1.2;
    private treeData: RewardsTreeData | null = null;

    constructor(
        private readonly merkleService: MerkleService,
        private readonly nodesService: NodesService,
    ) {}

    getRewardData(providerAddress: string): RewardResponseDTO {
        if (!this.treeData) {
            throw new NotFoundException('No rewards');
        }

        const index = this.treeData.rewards.findIndex((reward) =>
            Address.parse(reward.address).equals(Address.parse(providerAddress)),
        );

        if (index === -1) {
            throw new NotFoundException('No rewards for this address');
        }

        const proof = this.merkleService.getProof(this.treeData.tree, index);

        return {
            amount: this.treeData.rewards[index].amount,
            proof,
            root: this.treeData.root,
        };
    }

    getProviderNodesWithWeight(
        address: string,
    ): ProviderNodesWithWeightResponseDTO {
        const nodeProvider = this.nodesService.getProviderByAddress(address);

        if (!nodeProvider) {
            throw new NotFoundException('Provider not found');
        }

        const allNodes = this.getAllNodes(this.nodesService.getNodeProviders());
        const countryNodeCounts = this.getCountryNodeCounts(allNodes);

        const nodes = nodeProvider.nodes.map((node) => ({
            id: node.id,
            country: node.country,
            rating: node.rating,
            reviewsCount: node.reviewsCount,
            tickets: node.tickets,
            uptime: node.uptime,
            weight: this.calculateNodeWeight(node, countryNodeCounts),
        }));

        return {
            address: nodeProvider.address,
            nodes,
        };
    }

    async getNodesDemandData(): Promise<NodesDemandDataResponseDTO[]> {
        const providers = await this.nodesService.getNodeProviders();
        
        const nodeCountByCountry: Record<string, number> = {};
        
        providers.forEach(provider => {
            provider.nodes.forEach(node => {
                const country = node.country;
                nodeCountByCountry[country] = (nodeCountByCountry[country] || 0) + 1;
            });
        });

        return Object.keys(this.countryDemand).map((country) => {
            const demand = this.countryDemand[country];
            const activeNodes = nodeCountByCountry[country] || 0;
            const cost = this.countryBaseCost[country] || 0;

            /**
             * Расчет Saturation (Насыщенности):
             * Чем больше нод относительно спроса, тем выше процент.
             * Ограничиваем 100%, если нод стало больше, чем нужно.
             */
            const saturation = demand > 0 
                ? Math.min(Math.round((activeNodes / demand) * 100), 100)
                : 0;

            return {
                country,
                cost,
                demand,
                saturation,
            };
        });
    }

    async updateMonthlyRewards(totalReward: number): Promise<string> {
        const calculation = this.calculateRewardsFromNodes(totalReward);
        const rewards: ProviderReward[] = calculation.providers.map(
            (provider) => ({
                address: provider.address,
                amount: this.toIntegerAmountString(provider.totalReward),
            }),
        );

        const leaves = rewards.map((reward) =>
            this.merkleService.hashLeaf(reward.address, BigInt(reward.amount)),
        );

        const tree = this.merkleService.buildTree(leaves);
        const root = tree[tree.length - 1][0].toString('hex');

        this.treeData = {
            root,
            tree,
            rewards,
        };

        return `0x${root}`;
    }

    private toIntegerAmountString(value: number): string {
        if (!Number.isFinite(value)) {
            throw new Error('Invalid reward amount');
        }

        return Math.round(value).toString();
    }

    calculateRewards(
        nodeProviders: NodeProvider[],
        totalReward: number,
    ): RewardsCalculationResult {
        const allNodes = this.getAllNodes(nodeProviders);
        
        if (allNodes.length === 0) {
            return this.buildEmptyRewardsResult(totalReward);
        }

        // 1) Base rewards and total base sum
        const { baseRewardsByNodeId, baseSum } =
            this.calculateBaseRewards(allNodes);
        // 2) Remaining pool for performance rewards (or scale base down)
        const { baseScale, perfPool } = this.calculatePerfPool(
            baseSum,
            totalReward,
        );

        // 3) Node weights for performance distribution
        const countryNodeCounts = this.getCountryNodeCounts(allNodes);
        const { weightsByNodeId, totalWeight } = this.calculateWeights(
            allNodes,
            countryNodeCounts,
        );

        // 4) If all weights are zero, split perfPool evenly
        const equalPerfReward =
            totalWeight === 0 ? perfPool / allNodes.length : 0;

        const providers = nodeProviders.map((provider) =>
            this.buildProviderRewards(
                provider,
                baseRewardsByNodeId,
                baseScale,
                weightsByNodeId,
                totalWeight,
                perfPool,
                equalPerfReward,
            ),
        );

        return {
            totalReward,
            baseSum: baseSum * baseScale,
            perfPool,
            totalWeight,
            providers,
        };
    }

    calculateRewardsFromNodes(totalReward: number): RewardsCalculationResult {
        return this.calculateRewards(
            this.nodesService.getNodeProviders(),
            totalReward,
        );
    }

    private buildEmptyRewardsResult(
        totalReward: number,
    ): RewardsCalculationResult {
        return {
            totalReward,
            baseSum: 0,
            perfPool: 0,
            totalWeight: 0,
            providers: [],
        };
    }

    private getAllNodes(nodeProviders: NodeProvider[]): Node[] {
        return nodeProviders.flatMap((provider) => provider.nodes);
    }

    private calculateBaseRewards(nodes: Node[]): BaseRewardsResult {
        const baseRewardsByNodeId = new Map<number, number>();
        let baseSum = 0;

        for (const node of nodes) {
            const baseReward = this.calculateBaseReward(node);

            baseRewardsByNodeId.set(node.id, baseReward);
            baseSum += baseReward;
        }

        return { baseRewardsByNodeId, baseSum };
    }

    private calculatePerfPool(baseSum: number, totalReward: number): PerfPoolResult {
        if (baseSum < totalReward) {
            return { baseScale: 1, perfPool: totalReward - baseSum };
        }

        if (baseSum > 0) {
            return { baseScale: totalReward / baseSum, perfPool: 0 };
        }

        return { baseScale: 1, perfPool: 0 };
    }

    private calculateWeights(
        nodes: Node[],
        countryNodeCounts: CountryNodeCounts,
    ): NodeWeightsResult {
        const weightsByNodeId = new Map<number, number>();
        let totalWeight = 0;

        for (const node of nodes) {
            const weight = this.calculateNodeWeight(node, countryNodeCounts);

            weightsByNodeId.set(node.id, weight);
            totalWeight += weight;
        }

        return { weightsByNodeId, totalWeight };
    }

    private buildProviderRewards(
        provider: NodeProvider,
        baseRewardsByNodeId: Map<number, number>,
        baseScale: number,
        weightsByNodeId: Map<number, number>,
        totalWeight: number,
        perfPool: number,
        equalPerfReward: number,
    ): ProviderRewardResult {
        const nodes = provider.nodes.map((node) => {
            const baseReward =
                (baseRewardsByNodeId.get(node.id) ?? 0) * baseScale;
            const weight = weightsByNodeId.get(node.id) ?? 0;
            const performanceReward =
                totalWeight > 0
                    ? perfPool * (weight / totalWeight)
                    : equalPerfReward;

            return {
                nodeId: node.id,
                country: node.country,
                baseReward,
                performanceReward,
                totalReward: baseReward + performanceReward,
                weight,
            };
        });

        const totalProviderReward = nodes.reduce(
            (sum, node) => sum + node.totalReward,
            0,
        );

        return {
            address: provider.address,
            totalReward: totalProviderReward,
            nodes,
        };
    }

    private calculateBaseReward(node: Node): number {
        const baseCost = this.countryBaseCost[node.country] ?? 1.0;
        
        return baseCost * this.baseMargin;
    }

    private getCountryNodeCounts(nodes: Node[]): CountryNodeCounts {
        const counts: CountryNodeCounts = {};

        for (const node of nodes) {
            counts[node.country] = (counts[node.country] ?? 0) + 1;
        }

        return counts;
    }

    private calculateNodeWeight(
        node: Node,
        countryNodeCounts: CountryNodeCounts,
    ): number {
        // Presence + quality, adjusted by location, uptime, and rating penalty
        const presenceScore = 0.1;
        const effectiveRating = node.reviewsCount === 0 ? 4.0 : node.rating;
        const ratingFactor = Math.pow(effectiveRating / 5.0, 2);

        const qualityScore = (0.1 * Math.log(node.tickets + 1)) * ratingFactor;

        const countryDemand = this.countryDemand[node.country] ?? 100;
        const countryExisting = countryNodeCounts[node.country] ?? 0;
        const demandFactor = countryDemand / (countryExisting + 1);
        const locationMultiplier = 1 + (0.2 * Math.log(demandFactor + 1));

        const safeUptime = Math.max(0, node.uptime);

        return (
            (presenceScore + qualityScore) *
            locationMultiplier *
            safeUptime *
            ratingFactor
        );
    }
}
