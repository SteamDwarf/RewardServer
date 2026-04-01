import { Injectable, NotFoundException } from '@nestjs/common';
import { Address, toNano } from '@ton/core';
import { NodesService } from 'src/nodes/nodes.service';
import { Node, NodeProvider } from 'src/nodes/types/nodes.types';
import { ProviderNodesWithWeightResponseDTO } from './dto/providerNodesWithWeightResponse.dto';
import {
    BaseRewardsResult,
    CountryNodeCounts,
    NodesDemand,
    NodeWeightsResult,
    PerfPoolResult,
    ProviderReward,
    ProviderRewardResult,
    RewardsCalculationResult,
    UpdateMonthlyRewardsInput,
} from './types/rewards.types';
import { NodesDemandDataResponseDTO } from './dto/nodesDemandDataResponse.dto';

@Injectable()
export class RewardsService {
    private readonly countryBaseCost: Record<string, bigint> = {
        US: toNano('1.0'),
        DE: toNano('2.0'),
        FR: toNano('1.5'),
        SG: toNano('1.0'),
    };
    private readonly countryDemand: Record<string, number> = {
        US: 100,
        DE: 200,
        FR: 200,
        SG: 300,
    };
    private readonly baseMargin = 1.2;
    private rewardDataByPeriod = new Map<number, ProviderReward[]>();

    constructor(private readonly nodesService: NodesService) {}

    getRewardData(periodId: number, providerAddress: string): bigint {
        const data = this.rewardDataByPeriod.get(periodId);
        if (!data) {
            throw new NotFoundException('No rewards for this period');
        }

        const provider = Address.parse(providerAddress);
        const index = data.findIndex((reward) =>
            reward.address.equals(provider),
        );

        if (index === -1) {
            throw new NotFoundException('No rewards for this address');
        }

        return data[index].amount;
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

    async getNodesDemandData(): Promise<NodesDemand[]> {
        const providers = this.nodesService.getNodeProviders();

        const nodeCountByCountry: Record<string, number> = {};

        providers.forEach((provider) => {
            provider.nodes.forEach((node) => {
                const country = node.country;
                nodeCountByCountry[country] =
                    (nodeCountByCountry[country] || 0) + 1;
            });
        });

        return Object.keys(this.countryDemand).map((country) => {
            const demand = this.countryDemand[country];
            const activeNodes = nodeCountByCountry[country] || 0;
            const cost = this.countryBaseCost[country] || 0n;

            /**
             * Расчет Saturation (Насыщенности):
             * Чем больше нод относительно спроса, тем выше процент.
             * Ограничиваем 100%, если нод стало больше, чем нужно.
             */
            const saturation =
                demand > 0
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

    async calculateMonthlyRewards(
        input: UpdateMonthlyRewardsInput,
    ): Promise<ProviderReward[]> {
        const calculation = this.calculateRewardsFromNodes(input.totalPool);
        const rewards: ProviderReward[] = calculation.providers.map(
            (provider) => ({
                address: Address.parse(provider.address),
                amount: BigInt(provider.totalReward),
                isClaimed: false,
            }),
        );

        if (rewards.length === 0) {
            throw new NotFoundException('No rewards');
        }

        this.rewardDataByPeriod.set(input.periodId, rewards);

        return rewards;
    }

    private calculateRewards(
        nodeProviders: NodeProvider[],
        totalPool: bigint,
    ): RewardsCalculationResult {
        const allNodes = this.getAllNodes(nodeProviders);

        if (allNodes.length === 0) {
            return this.buildEmptyRewardsResult(totalPool);
        }

        // 1) Base rewards and total base sum
        const { baseRewardsByNodeId, baseSum } =
            this.calculateBaseRewards(allNodes);
        // 2) Remaining pool for performance rewards (or scale base down)
        const { baseScale, perfPool } = this.calculatePerfPool(
            baseSum,
            totalPool,
        );

        // 3) Node weights for performance distribution
        const countryNodeCounts = this.getCountryNodeCounts(allNodes);
        const { weightsByNodeId, totalWeight } = this.calculateWeights(
            allNodes,
            countryNodeCounts,
        );

        // 4) If all weights are zero, split perfPool evenly
        /* const equalPerfReward =
            totalWeight === 0 ? perfPool / allNodes.length : 0; */

        let providers = nodeProviders.map((provider) =>
            this.buildProviderRewards(
                provider,
                baseRewardsByNodeId,
                baseScale,
                weightsByNodeId,
                totalWeight,
                perfPool,
            ),
        );

        providers = this.distributeRemainder(providers, Number(totalPool));

        providers.forEach((p) => {
            this.distributeRemainder(p.nodes, p.totalReward);
        });

        return {
            totalPool,
            baseSum: BigInt(Math.floor(baseSum * baseScale)),
            perfPool,
            totalWeight,
            providers,
        };
    }

    calculateRewardsFromNodes(totalPool: bigint): RewardsCalculationResult {
        return this.calculateRewards(
            this.nodesService.getNodeProviders(),
            totalPool,
        );
    }

    private distributeRemainder<T extends { totalReward: number }>(
        items: T[],
        totalAmount: number,
    ): T[] {
        if (items.length === 0) return items;

        const totalBigInt = BigInt(Math.round(totalAmount));

        let currentSum = 0n;
        const withMetadata = items.map((item) => {
            const floorVal = BigInt(Math.floor(item.totalReward));
            const fraction = item.totalReward - Math.floor(item.totalReward);

            currentSum += floorVal;

            return { item, floorVal, fraction };
        });

        let remainder = totalBigInt - currentSum;

        withMetadata.sort((a, b) => b.fraction - a.fraction);

        for (let i = 0; i < Number(remainder); i++) {
            withMetadata[i % withMetadata.length].floorVal += 1n;
        }

        // 5. Записываем целые значения обратно в объекты
        return withMetadata.map((m) => {
            m.item.totalReward = Number(m.floorVal);
            return m.item;
        });
    }

    private buildEmptyRewardsResult(
        totalPool: bigint,
    ): RewardsCalculationResult {
        return {
            totalPool,
            baseSum: 0n,
            perfPool: 0n,
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

    private calculatePerfPool(
        baseSum: number,
        totalPool: bigint,
    ): PerfPoolResult {
        const totalNum = Number(totalPool);

        if (baseSum <= totalNum) {
            // Денег хватает: база 100%, остаток в бонусный пул
            return {
                baseScale: 1.0,
                perfPool: totalPool - BigInt(Math.floor(baseSum)),
            };
        } else {
            // Денег мало: режем базу пропорционально, бонусов нет
            return {
                baseScale: baseSum > 0 ? totalNum / baseSum : 1.0,
                perfPool: 0n,
            };
        }
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
        perfPool: bigint,
    ): ProviderRewardResult {
        const nodes = provider.nodes.map((node) => {
            const baseReward =
                (baseRewardsByNodeId.get(node.id) ?? 0) * baseScale;
            const weight = weightsByNodeId.get(node.id) ?? 0;
            const perfShare = totalWeight > 0 ? weight / totalWeight : 0;
            const performanceReward = Number(perfPool) * perfShare;

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
        const baseCost = this.countryBaseCost[node.country] ?? toNano('1.0');

        return Number(baseCost) * this.baseMargin;
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
        const presenceScore = 0.15;
        const effectiveRating = node.reviewsCount === 0 ? 3.0 : node.rating;
        const ratingFactor = Math.pow(effectiveRating / 5.0, 2);

        const qualityScore = 0.1 * Math.log(node.tickets + 1);

        const countryDemand = this.countryDemand[node.country] ?? 100;
        const countryExisting = countryNodeCounts[node.country] ?? 0;
        const demandFactor = countryDemand / (countryExisting + 1);
        const locationMultiplier = Math.min(
            1 + 0.5 * Math.log(demandFactor + 1),
            2.5,
        );

        const uptimeFactor = Math.pow(Math.max(0, node.uptime), 2);

        return (
            (presenceScore + qualityScore) *
            locationMultiplier *
            uptimeFactor *
            ratingFactor
        );
    }
}
