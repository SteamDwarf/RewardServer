import { Controller, Get, Post } from '@nestjs/common';
import { TaskService } from './task.service';
import { Address, Dictionary, fromNano } from '@ton/core';
import { RewardInfo } from 'src/rewards/types/rewards.types';

@Controller('task')
export class TaskController {
    constructor(private readonly taskService: TaskService) {}

    /* @Post('send-jettons')
    async runTask() {
        await this.taskService.sendJettonsTooPoolRoute();

        return { message: 'Jettons sent' };
    }

    @Get('rewards')
    async getRewards() {
        const rewards = await this.taskService.getRewardsFromContract();

        return this.prepareRewards(rewards);
    }

    @Post('set-rewards')
    async setRewards() {
        await this.taskService.setRewards();

        return this.prepareRewards(
            await this.taskService.getRewardsFromContract(),
        );
    }

    @Post('send-rewards')
    async sendRewards() {
        await this.taskService.sendRewardToProviderRoute();

        return { message: 'Rewards sent' };
    }

    private prepareRewards(rewards: Dictionary<Address, RewardInfo>) {
        const rewardsArray = rewards.keys().map((key) => {
            const value = rewards.get(key);

            return {
                address: key.toString(), // Превращаем Address в строку
                amount: fromNano(value?.amount ?? 0n), // BigInt -> string (обязательно!)
                isClaimed: value?.isClaimed,
            };
        });

        return rewardsArray;
    } */
}
