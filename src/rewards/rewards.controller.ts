import {
    BadRequestException,
    Controller,
    Get,
    Param,
    Post,
    Query,
} from '@nestjs/common';
import { ProviderNodesWithWeightResponseDTO } from './dto/providerNodesWithWeightResponse.dto';
import { RewardsService } from './rewards.service';
import { NodesDemandDataResponseDTO } from './dto/nodesDemandDataResponse.dto';
import { ProviderReward } from './types/rewards.types';
import { fromNano } from '@ton/core';
import { CalculateMonthlyRewardsDTO } from './dto/rewardsCalculationResponse.dto';
import { ProviderRewardResponseDTO } from './dto/providerRewardResponse.dto';

@Controller('rewards')
export class RewardsController {
    constructor(private readonly rewardsService: RewardsService) {}

    @Get('nodes/:address')
    getProviderNodesWithWeight(
        @Param('address') address: string,
    ): ProviderNodesWithWeightResponseDTO {
        return this.rewardsService.getProviderNodesWithWeight(address);
    }

    @Get('nodes-demand')
    async getNodesDemand(): Promise<NodesDemandDataResponseDTO[]> {
        const demand = await this.rewardsService.getNodesDemandData();

        return demand.map((d) => ({
            ...d,
            cost: fromNano(d.cost),
        }));
    }

    @Post('update')
    async calculateMonthlyRewards(
        @Query('totalPool') totalPool: string,
        @Query('periodId') periodId: string,
    ): Promise<CalculateMonthlyRewardsDTO[]> {
        const rewardValue = BigInt(totalPool);
        const periodValue = Number(periodId);

        if (rewardValue <= 0) {
            throw new BadRequestException(
                'totalPool must be a positive number',
            );
        }
        if (!Number.isInteger(periodValue) || periodValue < 0) {
            throw new BadRequestException('periodId must be uint32');
        }

        const rewards = await this.rewardsService.calculateMonthlyRewards({
            totalPool: rewardValue,
            periodId: periodValue,
        });

        return rewards.map((r) => ({
            ...r,
            address: r.address.toString(),
            amount: fromNano(r.amount),
        }));
    }

    @Get(':provider')
    async getRewardData(
        @Param('provider') provider: string,
        @Query('periodId') periodId: string,
    ): Promise<ProviderRewardResponseDTO> {
        const periodValue = Number(periodId);
        if (!Number.isInteger(periodValue) || periodValue < 0) {
            throw new BadRequestException('periodId must be uint32');
        }

        const reward = this.rewardsService.getRewardData(periodValue, provider);

        return {
            amount: fromNano(reward),
        };
    }

    /* @Get()
    calculateRewards(
        @Query('totalReward') totalReward: string,
    ): RewardsCalculationResponseDTO {
        const value = Number(totalReward);

        if (!Number.isFinite(value) || value <= 0) {
            throw new BadRequestException('totalReward must be a positive number');
        }

        return this.rewardsService.calculateRewardsFromNodes(value);
    } */
}
