import {Node} from '../../nodes/types/nodes.types';

export interface ProviderReward {
    address: string;
    amount: string;
}

export interface NodeRewardResult {
    nodeId: number;
    country: string;
    baseReward: number;
    performanceReward: number;
    totalReward: number;
    weight: number;
}

export interface ProviderRewardResult {
    address: string;
    totalReward: number;
    nodes: NodeRewardResult[];
}

export interface RewardsCalculationResult {
    totalReward: number;
    baseSum: number;
    perfPool: number;
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
    perfPool: number;
}

export type CountryNodeCounts = Record<string, number>;

export interface RewardsTreeData {
    periodId: number;
    formulaVersion: number;
    snapshotHash: string;
    rewardDistributorAddress: string;
    root: string;
    tree: Buffer[][];
    rewards: ProviderReward[];
}

export interface NodeWithWeight extends Node {
    weight: number;
}

export interface UpdateMonthlyRewardsInput {
    totalReward: number;
    periodId: number;
    formulaVersion: number;
    snapshotHash: string;
    rewardDistributorAddress: string;
}

