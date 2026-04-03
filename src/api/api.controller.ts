import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { NodesService } from 'src/nodes/nodes.service';
import { NodeProviderResponseDTO } from './dto/nodeProviderResponse.dto';
import { fromNano } from '@ton/core';
import { NodesDemandDataResponseDTO } from './dto/nodesDemandDataResponse.dto';
import { NodesResponseDTO } from './dto/nodesResponse.dto';
import { NodesRequestDTO } from './dto/nodesRequest.dto';

@Controller('api')
export class ApiController {
    constructor(private readonly nodesService: NodesService) {}

    @Get('providers')
    async getProviders(): Promise<NodeProviderResponseDTO[]> {
        return this.nodesService.getNodeProviders();
    }

    @Get('providers/:address')
    async getProviderByAddress(
        @Param('address') address: string,
    ): Promise<NodeProviderResponseDTO | undefined> {
        const provider = await this.nodesService.getProviderByAddress(address);

        return provider;
    }

    @Get('nodes-demand')
    async getNodesDemand(): Promise<NodesDemandDataResponseDTO[]> {
        const demand = await this.nodesService.getNodesDemandData();

        return demand.map((d) => ({
            ...d,
            cost: fromNano(d.cost),
        }));
    }

    @Post('nodes')
    async getNodes(
        @Body() requestData: NodesRequestDTO,
    ): Promise<NodesResponseDTO> {
        const nodes = await this.nodesService.getNodes(
            requestData.providerAddress,
            requestData.nodesIds,
        );

        return { nodes };
    }

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
