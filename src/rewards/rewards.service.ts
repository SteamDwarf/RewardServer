import {
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { Address, toNano } from '@ton/core';
import { NodesService } from 'src/nodes/nodes.service';
import { Node, NodeProvider } from 'src/nodes/types/nodes.types';
import { ProviderNodesWithWeightResponseDTO } from '../api/dto/providerNodesWithWeightResponse.dto';
import {
    CountryNodeCounts,
    PerfPoolResult,
    ProviderReward,
    ProviderRewardResult,
    RewardsCalculationResult,
    UpdateMonthlyRewardsInput,
} from './types/rewards.types';
import { NodesDemandDataResponseDTO } from '../api/dto/nodesDemandDataResponse.dto';
import { DbService } from 'src/db/db.service';

@Injectable()
export class RewardsService implements OnModuleInit {
    private readonly _logger = new Logger(RewardsService.name);

    private readonly baseMargin = 1.2;
    private rewardDataByPeriod = new Map<number, ProviderReward[]>();
    private intervalId?: NodeJS.Timeout;

    constructor(private readonly db: DbService) {}

    //TODO
    //@Cron(CronExpression.EVERY_10_MINUTES)
    /* async handleCron() {
        await this.recalculateAllWeights();
    } */

    onModuleDestroy() {
        if (this.intervalId) clearInterval(this.intervalId);
    }

    async onModuleInit() {
        await this.recalculateAllWeights();

        this.intervalId = setInterval(
            () => this.recalculateAllWeights(),
            10 * 60 * 1000,
        );
    }

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

    async calculateMonthlyRewards(
        input: UpdateMonthlyRewardsInput,
    ): Promise<ProviderReward[]> {
        const calculation = await this.calculateRewardsFromNodes(
            input.totalPool,
        );
        const rewards: ProviderReward[] = calculation.providers.map(
            (provider) => ({
                address: Address.parse(provider.address),
                owner: Address.parse(provider.owner),
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

    async getProviderWeights(address: string) {
        const provider = await this.db.findProviderByAddress(address);

        if (!provider) {
            throw new NotFoundException(
                'Weights not calculated yet for this provider',
            );
        }

        return {
            averageWeight: provider.weights.averageWeight,
            totalWeight: provider.weights.totalWeight,
        };
    }

    async calculateRewardsFromNodes(
        totalPool: bigint,
    ): Promise<RewardsCalculationResult> {
        const providers = await this.db.findAllProviders();
        return this.calculateRewards(providers, totalPool);
    }

    private async calculateRewards(
        nodeProviders: NodeProvider[],
        totalPool: bigint,
    ) {
        const allNodes = this.getAllNodes(nodeProviders);

        if (allNodes.length === 0) {
            return this.buildEmptyRewardsResult(totalPool);
        }

        // 1) Base rewards and total base sum
        const { baseRewardsByNodeId, baseSum } =
            await this.calculateBaseRewards(allNodes);
        // 2) Remaining pool for performance rewards (or scale base down)
        const { baseScale, perfPool } = this.calculatePerfPool(
            baseSum,
            totalPool,
        );

        // 3) Node weights for performance distribution
        const countryNodeCounts = this.getCountryNodeCounts(allNodes);
        const { weightsByNodeId, totalWeight } = await this.calculateWeights(
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

    private async calculateBaseRewards(nodes: Node[]) {
        const baseRewardsByNodeId = new Map<number, number>();
        let baseSum = 0;

        for (const node of nodes) {
            const baseReward = await this.calculateBaseReward(node);

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

    private async calculateWeights(
        nodes: Node[],
        countryNodeCounts: CountryNodeCounts,
    ) {
        const weightsByNodeId = new Map<number, number>();
        let totalWeight = 0;

        for (const node of nodes) {
            const weight = await this.calculateNodeWeight(
                node,
                countryNodeCounts,
            );

            weightsByNodeId.set(node.id, weight);
            totalWeight += weight;
        }

        return { weightsByNodeId, totalWeight };
    }

    async recalculateAllWeights() {
        const providers = await this.db.findAllProviders();

        // 1. Собираем все ноды для расчета общей статистики сети
        const allNodes = providers.flatMap((p) => p.nodes);
        const countryCounts = this.getCountryNodeCounts(allNodes);

        // 2. Считаем веса для каждого провайдера
        for (const provider of providers) {
            const nodeWeights: Record<number, number> = {};
            let totalWeight = 0;

            for (const node of provider.nodes) {
                const weight = await this.calculateNodeWeight(
                    node,
                    countryCounts,
                );

                nodeWeights[node.id] = weight;
                totalWeight += weight;
            }

            // 3. Сохраняем результат в "БД"
            await this.db.updateWeights(provider.address, {
                totalWeight,
                averageWeight: totalWeight / (provider.nodes.length || 1),
                nodeWeights,
            });
        }
        this._logger.log('Weights synchronized with DB');
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
            owner: provider.owner,
            address: provider.address,
            totalReward: totalProviderReward,
            nodes,
        };
    }

    private async calculateBaseReward(node: Node) {
        const baseCost =
            (await this.db.getCountryBaseCost(node.country)) ?? toNano('1.0');

        return Number(baseCost) * this.baseMargin;
    }

    private getCountryNodeCounts(nodes: Node[]): CountryNodeCounts {
        const counts: CountryNodeCounts = {};

        for (const node of nodes) {
            counts[node.country] = (counts[node.country] ?? 0) + 1;
        }

        return counts;
    }

    private async calculateNodeWeight(
        node: Node,
        countryNodeCounts: CountryNodeCounts,
    ) {
        const presenceScore = 0.15;
        const effectiveRating = node.reviewsCount === 0 ? 3.0 : node.rating;
        const ratingFactor = Math.pow(effectiveRating / 5.0, 2);

        const qualityScore = 0.1 * Math.log(node.tickets + 1);

        const countryDemand =
            (await this.db.getCountryDemand(node.country)) ?? 100;
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
