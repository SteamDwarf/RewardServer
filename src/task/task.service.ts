import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { fromNano, OpenedContract, Sender } from '@ton/core';
import { chunkArray } from 'src/common/utils/chunkArray';
import { EnvVariables } from 'src/configuration';
import { RewardsService } from 'src/rewards/rewards.service';
import JettonWallet from 'src/ton/contracts/jetton-wallet.contract';
import RewardDistributor from 'src/ton/contracts/reward-distributor.contract';
import Root from 'src/ton/contracts/root.contract';
import VPNProviderRegistry from 'src/ton/contracts/vpn-provider-registry.contract';
import { CONTRACTS_IDS } from 'src/ton/ton.constants';
import { TonService } from 'src/ton/ton.service';

@Injectable()
export class TaskService {
    private readonly _logger = new Logger(TaskService.name);

    constructor(
        private readonly _tonService: TonService,
        private readonly _rewardService: RewardsService,
        private readonly _configService: ConfigService<EnvVariables>,
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleDailyJettonTransfer() {
        const rootAddress = this._configService.get('root', {
            infer: true,
        })!;
        const root = this._tonService.openContract(new Root(rootAddress));

        await this.sendJettonsToPool(root);

        // 2. Проверяем, первое ли сегодня число месяца
        const isFirstDayOfMonth = new Date().getDate() === 1;

        if (isFirstDayOfMonth) {
            const rewardDistributorAddress = await root.getAddressFromRoot(
                CONTRACTS_IDS.RewardDistributor,
            );

            if (!rewardDistributorAddress) {
                throw new NotFoundException(
                    'RewardDistributor address is not found',
                );
            }

            const rewardDistributor = this._tonService.openContract(
                new RewardDistributor(rewardDistributorAddress),
            );

            const sender = this._tonService.getSender();

            this._logger.log(
                'It is the 1st day of the month. Starting rewards cycle...',
            );
            await this.calculateAndSetRewards(sender, rewardDistributor);
            await this.sendRewardToProviders(sender, rewardDistributor);
        }

        this._logger.log('--- Daily Cycle Finished ---');
    }

    async setRewards() {
        const rootAddress = this._configService.get('root', {
            infer: true,
        })!;
        const root = this._tonService.openContract(new Root(rootAddress));
        const rewardDistributorAddress = await root.getAddressFromRoot(
            CONTRACTS_IDS.RewardDistributor,
        );

        if (!rewardDistributorAddress) {
            throw new NotFoundException(
                'RewardDistributor address is not found',
            );
        }

        const rewardDistributor = this._tonService.openContract(
            new RewardDistributor(rewardDistributorAddress),
        );

        const sender = this._tonService.getSender();

        await this.calculateAndSetRewards(sender, rewardDistributor);
    }

    public async getRewardsFromContract() {
        const rootAddress = this._configService.get('root', {
            infer: true,
        })!;
        const root = this._tonService.openContract(new Root(rootAddress));
        const rewardDistributorAddress = await root.getAddressFromRoot(
            CONTRACTS_IDS.RewardDistributor,
        );

        if (!rewardDistributorAddress) {
            throw new NotFoundException(
                'RewardDistributor address is not found',
            );
        }

        const rewardDistributor = this._tonService.openContract(
            new RewardDistributor(rewardDistributorAddress),
        );

        return rewardDistributor.getRewards();
    }

    async sendRewardToProviderRoute() {
        const rootAddress = this._configService.get('root', {
            infer: true,
        })!;
        const root = this._tonService.openContract(new Root(rootAddress));
        const rewardDistributorAddress = await root.getAddressFromRoot(
            CONTRACTS_IDS.RewardDistributor,
        );

        if (!rewardDistributorAddress) {
            throw new NotFoundException(
                'RewardDistributor address is not found',
            );
        }

        const rewardDistributor = this._tonService.openContract(
            new RewardDistributor(rewardDistributorAddress),
        );

        const sender = this._tonService.getSender();

        await this.sendRewardToProviders(sender, rewardDistributor);
    }

    async sendJettonsTooPoolRoute() {
        const rootAddress = this._configService.get('root', {
            infer: true,
        })!;
        const root = this._tonService.openContract(new Root(rootAddress));
        await this.sendJettonsToPool(root);
    }

    private async calculateAndSetRewards(
        sender: Sender,
        rewardDistributor: OpenedContract<RewardDistributor>,
    ) {
        this._logger.log('Starting monthly rewards calculation...');

        const rewardPool = await rewardDistributor.getRewardPool();

        const rewards = await this._rewardService.calculateMonthlyRewards({
            periodId: 1,
            totalPool: rewardPool,
        });

        await this._tonService.waitForTransaction(async () => {
            await rewardDistributor.sendRewardsInfo(sender, 1n, rewards);
        });
    }

    private async sendJettonsToPool(root: OpenedContract<Root>) {
        this._logger.log('Starting daily Jetton transfer...');

        try {
            const vpnProviderRegistryAddress = await root.getAddressFromRoot(
                CONTRACTS_IDS.VPNProviderRegistry,
            );

            if (!vpnProviderRegistryAddress) {
                throw new NotFoundException(
                    'VPNProviderRegistry address is not found',
                );
            }

            const vpnProviderRegistry = this._tonService.openContract(
                new VPNProviderRegistry(vpnProviderRegistryAddress),
            );
            const registryJettonWalletAddress =
                await vpnProviderRegistry.getJettonWalletAddress();

            if (!registryJettonWalletAddress) {
                throw new NotFoundException(
                    'VPNProviderRegistry does not have Jetton wallet',
                );
            }

            const registryJettonWallet = this._tonService.openContract(
                new JettonWallet(registryJettonWalletAddress),
            );
            const { balance } = await registryJettonWallet.getWalletData();

            if (balance === 0n) {
                this._logger.log('VPNProviderRegistry Jetton wallet is empty');
            } else {
                this._logger.log(`Sending ${fromNano(balance)} VPNT`);
                const sender = this._tonService.getSender();

                await this._tonService.waitForTransaction(async () => {
                    return await vpnProviderRegistry.sendJettonsToPool(
                        sender,
                        balance,
                    );
                });
            }

            this._logger.log('The daily Jetton transfer is complete');
        } catch (e) {
            this._logger.error('Error in daily Jetton transfer', e);
        }
    }

    private async sendRewardToProviders(
        sender: Sender,
        rewardDistributor: OpenedContract<RewardDistributor>,
    ) {
        const rewardsInfo = await rewardDistributor.getRewards();
        const providersChunks = chunkArray(rewardsInfo.keys(), 50);

        for (const chunk of providersChunks) {
            await this._tonService.waitForTransaction(async () => {
                rewardDistributor.sendRewardToProvider(sender, chunk);
            });
        }
    }
}
