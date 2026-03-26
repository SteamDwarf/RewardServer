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
        @Query('periodId') periodId: string,
        @Query('formulaVersion') formulaVersion: string,
        @Query('snapshotHash') snapshotHash: string,
        @Query('rewardDistributorAddress') rewardDistributorAddress: string,
    ): Promise<string> {
        const rewardValue = Number(totalReward);
        const periodValue = Number(periodId);
        const formulaValue = Number(formulaVersion);

        if (!Number.isFinite(rewardValue) || rewardValue <= 0) {
            throw new BadRequestException('totalReward must be a positive number');
        }
        if (!Number.isInteger(periodValue) || periodValue < 0) {
            throw new BadRequestException('periodId must be uint32');
        }
        if (!Number.isInteger(formulaValue) || formulaValue < 0) {
            throw new BadRequestException('formulaVersion must be uint16');
        }
        if (!snapshotHash) {
            throw new BadRequestException('snapshotHash is required');
        }
        if (!rewardDistributorAddress) {
            throw new BadRequestException('rewardDistributorAddress is required');
        }

        return this.rewardsService.updateMonthlyRewards({
            totalReward: rewardValue,
            periodId: periodValue,
            formulaVersion: formulaValue,
            snapshotHash,
            rewardDistributorAddress,
        });
    }

    @Get(':provider')
    getRewardData(
        @Param('provider') provider: string,
        @Query('periodId') periodId: string,
    ): RewardResponseDTO {
        const periodValue = Number(periodId);
        if (!Number.isInteger(periodValue) || periodValue < 0) {
            throw new BadRequestException('periodId must be uint32');
        }

        return this.rewardsService.getRewardData(periodValue, provider);
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
