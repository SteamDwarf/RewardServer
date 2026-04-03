import { Address } from '@ton/core';
import { Node } from '../../nodes/types/nodes.types';

export interface RewardInfo {
    amount: bigint;
    isClaimed: boolean;
}

export interface ProviderReward extends RewardInfo {
    address: Address;
    owner: Address;
}

export interface NodeRewardResult {
    nodeId: string;
    country: string;
    baseReward: number;
    performanceReward: number;
    totalReward: number;
    weight: number;
}

export interface ProviderRewardResult {
    owner: string;
    address: string;
    totalReward: number;
    nodes: NodeRewardResult[];
}

export interface RewardsCalculationResult {
    totalPool: bigint;
    baseSum: bigint;
    perfPool: bigint;
    totalWeight: number;
    providers: ProviderRewardResult[];
}

export interface NodeWeightsResult {
    weightsByNodeId: Map<number, number>;
    totalWeight: number;
}

export interface BaseRewardsResult {
    baseRewardsByNodeId: Map<number, number>;
    baseSum: number;
}

export interface PerfPoolResult {
    baseScale: number;
    perfPool: bigint;
}

export type CountryNodeCounts = Record<string, number>;

export interface NodeWithWeight extends Node {
    weight: number;
}

export interface UpdateMonthlyRewardsInput {
    totalPool: bigint;
    periodId: number;
}
