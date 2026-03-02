import { BadRequestException, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ProviderNodesWithWeightResponseDTO } from './dto/providerNodesWithWeightResponse.dto';
import { type RewardResponseDTO } from './dto/rewardResponse.dto';
import { RewardsCalculationResponseDTO } from './dto/rewardsCalculationResponse.dto';
import { RewardsService } from './rewards.service';
import { NodesDemandDataResponseDTO } from './dto/nodesDemandDataResponse.dto';

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
    getNodesDemand(): Promise<NodesDemandDataResponseDTO[]> {
        return this.rewardsService.getNodesDemandData();
    }

    @Post('update')
    async updateMonthlyRewards(
        @Query('totalReward') totalReward: string,
    ): Promise<string> {
        const value = Number(totalReward);
        
        if (!Number.isFinite(value) || value <= 0) {
            throw new BadRequestException('totalReward must be a positive number');
        }

        return this.rewardsService.updateMonthlyRewards(value);
    }

    @Get(':provider')
    getRewardData(@Param('provider') provider: string): RewardResponseDTO {
        return this.rewardsService.getRewardData(provider);
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
