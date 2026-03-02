import { ProviderRewardResult } from "../types/rewards.types";

export class RewardsCalculationResponseDTO {
    totalReward: number;
    baseSum: number;
    perfPool: number;
    totalWeight: number;
    providers: ProviderRewardResult[];
}
