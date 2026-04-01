import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Address, Sender } from '@ton/core';
import { RewardsService } from 'src/rewards/rewards.service';
import JettonWallet from 'src/ton/contracts/jetton-wallet.contract';
import RewardDistributor from 'src/ton/contracts/reward-distributor.contract';
import Root from 'src/ton/contracts/root.contract';
import VPNProviderRegistry from 'src/ton/contracts/vpn-provider-registry.contract';
import { CONTRACTS_IDS } from 'src/ton/ton.constants';
import { TonService } from 'src/ton/ton.service';
import { TaskService } from './task.service';

describe('TaskService', () => {
    let service: TaskService;

    let tonService: {
        openContract: jest.Mock;
        getSender: jest.Mock;
        waitForTransaction: jest.Mock;
    };
    let rewardsService: {
        calculateMonthlyRewards: jest.Mock;
    };
    let configService: {
        get: jest.Mock;
    };

    const rootAddress = createAddress('1');
    const vpnProviderRegistryAddress = createAddress('2');
    const registryJettonWalletAddress = createAddress('3');
    const rewardDistributorAddress = createAddress('4');
    const providerA = createAddress('5');
    const providerB = createAddress('6');
    const sender = { address: createAddress('7') } as Sender;

    const rootContract = {
        getAddressFromRoot: jest.fn(),
    };
    const vpnProviderRegistryContract = {
        getJettonWalletAddress: jest.fn(),
        sendJettonsToPool: jest.fn(),
    };
    const jettonWalletContract = {
        getWalletData: jest.fn(),
    };
    const rewardDistributorContract = {
        getRewardPool: jest.fn(),
        sendRewardsInfo: jest.fn(),
        getRewards: jest.fn(),
        sendRewardToProvider: jest.fn(),
    };

    beforeEach(async () => {
        jest.useFakeTimers();

        tonService = {
            openContract: jest.fn(),
            getSender: jest.fn().mockReturnValue(sender),
            waitForTransaction: jest
                .fn()
                .mockImplementation(
                    async (callback: () => Promise<unknown> | unknown) =>
                        await callback(),
                ),
        };
        rewardsService = {
            calculateMonthlyRewards: jest.fn(),
        };
        configService = {
            get: jest.fn().mockReturnValue(rootAddress),
        };

        rootContract.getAddressFromRoot.mockReset();
        vpnProviderRegistryContract.getJettonWalletAddress.mockReset();
        vpnProviderRegistryContract.sendJettonsToPool.mockReset();
        jettonWalletContract.getWalletData.mockReset();
        rewardDistributorContract.getRewardPool.mockReset();
        rewardDistributorContract.sendRewardsInfo.mockReset();
        rewardDistributorContract.getRewards.mockReset();
        rewardDistributorContract.sendRewardToProvider.mockReset();

        tonService.openContract.mockImplementation((contract: unknown) => {
            if (contract instanceof Root) {
                return rootContract;
            }

            if (contract instanceof VPNProviderRegistry) {
                return vpnProviderRegistryContract;
            }

            if (contract instanceof JettonWallet) {
                return jettonWalletContract;
            }

            if (contract instanceof RewardDistributor) {
                return rewardDistributorContract;
            }

            throw new Error('Unknown contract instance');
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TaskService,
                { provide: TonService, useValue: tonService },
                { provide: RewardsService, useValue: rewardsService },
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();

        service = module.get<TaskService>(TaskService);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('sends jettons to the pool every day and skips the monthly rewards flow on non-first days', async () => {
        jest.setSystemTime(new Date('2026-03-15T12:00:00.000Z'));

        rootContract.getAddressFromRoot.mockImplementation(
            async (contractId: bigint) => {
                if (contractId === CONTRACTS_IDS.VPNProviderRegistry) {
                    return vpnProviderRegistryAddress;
                }

                return null;
            },
        );
        vpnProviderRegistryContract.getJettonWalletAddress.mockResolvedValue(
            registryJettonWalletAddress,
        );
        jettonWalletContract.getWalletData.mockResolvedValue({
            balance: 250n,
        });

        await service.handleDailyJettonTransfer();

        expect(configService.get).toHaveBeenCalledWith('root', {
            infer: true,
        });
        expect(rootContract.getAddressFromRoot).toHaveBeenCalledTimes(1);
        expect(rootContract.getAddressFromRoot).toHaveBeenCalledWith(
            CONTRACTS_IDS.VPNProviderRegistry,
        );
        expect(vpnProviderRegistryContract.sendJettonsToPool).toHaveBeenCalledWith(
            sender,
            250n,
        );
        expect(tonService.waitForTransaction).toHaveBeenCalledTimes(1);
        expect(rewardsService.calculateMonthlyRewards).not.toHaveBeenCalled();
        expect(rewardDistributorContract.getRewardPool).not.toHaveBeenCalled();
        expect(rewardDistributorContract.sendRewardsInfo).not.toHaveBeenCalled();
        expect(
            rewardDistributorContract.sendRewardToProvider,
        ).not.toHaveBeenCalled();
    });

    it('runs both the daily transfer and monthly rewards distribution on the first day of the month', async () => {
        jest.setSystemTime(new Date('2026-04-01T12:00:00.000Z'));

        const calculatedRewards = [
            {
                address: providerA,
                amount: 70n,
                isClaimed: false,
            },
            {
                address: providerB,
                amount: 30n,
                isClaimed: false,
            },
        ];
        const rewardsDictionaryMock = {
            keys: jest.fn().mockReturnValue([providerA, providerB]),
        };

        rootContract.getAddressFromRoot.mockImplementation(
            async (contractId: bigint) => {
                if (contractId === CONTRACTS_IDS.VPNProviderRegistry) {
                    return vpnProviderRegistryAddress;
                }

                if (contractId === CONTRACTS_IDS.RewardDistributor) {
                    return rewardDistributorAddress;
                }

                return null;
            },
        );
        vpnProviderRegistryContract.getJettonWalletAddress.mockResolvedValue(
            registryJettonWalletAddress,
        );
        jettonWalletContract.getWalletData.mockResolvedValue({
            balance: 500n,
        });
        rewardDistributorContract.getRewardPool.mockResolvedValue(100n);
        rewardsService.calculateMonthlyRewards.mockResolvedValue(
            calculatedRewards,
        );
        rewardDistributorContract.getRewards.mockResolvedValue(
            rewardsDictionaryMock,
        );

        await service.handleDailyJettonTransfer();

        expect(rootContract.getAddressFromRoot).toHaveBeenNthCalledWith(
            1,
            CONTRACTS_IDS.VPNProviderRegistry,
        );
        expect(rootContract.getAddressFromRoot).toHaveBeenNthCalledWith(
            2,
            CONTRACTS_IDS.RewardDistributor,
        );
        expect(vpnProviderRegistryContract.sendJettonsToPool).toHaveBeenCalledWith(
            sender,
            500n,
        );
        expect(rewardsService.calculateMonthlyRewards).toHaveBeenCalledWith({
            periodId: 3,
            totalPool: 100n,
        });
        expect(rewardDistributorContract.sendRewardsInfo).toHaveBeenCalledWith(
            sender,
            3n,
            calculatedRewards,
        );
        expect(
            rewardDistributorContract.sendRewardToProvider,
        ).toHaveBeenCalledWith(sender, [providerA, providerB]);
        expect(tonService.waitForTransaction).toHaveBeenCalledTimes(3);
    });
});

function createAddress(fill: string) {
    return Address.parseRaw(`0:${fill.repeat(64)}`);
}
