import {
    Address,
    beginCell,
    Builder,
    Contract,
    ContractProvider,
    Dictionary,
    DictionaryValue,
    Sender,
    Slice,
} from '@ton/core';
import { getRandomQueryId } from 'src/common/utils/blockchain.utils';
import { ProviderReward, RewardInfo } from 'src/rewards/types/rewards.types';
import { MESSAGES_FEE } from '../ton.constants';
import { NodeProvider } from 'src/nodes/types/nodes.types';

class RewardDistributor implements Contract {
    constructor(readonly address: Address) {}

    async getRewardPool(provider: ContractProvider): Promise<bigint> {
        const { stack } = await provider.get('get_pool', []);

        return stack.readBigNumber();
    }

    async getRewards(
        provider: ContractProvider,
    ): Promise<Dictionary<Address, RewardInfo>> {
        const { stack } = await provider.get('rewards', []);

        const res = Dictionary.loadDirect(
            Dictionary.Keys.Address(),
            this.dictValueParserRewardInfo(),
            stack.readCellOpt(),
        );

        return res;
    }

    async sendRewardsInfo(
        provider: ContractProvider,
        sender: Sender,
        periodId: bigint,
        rewards: ProviderReward[],
    ) {
        const dict = Dictionary.empty(
            Dictionary.Keys.Address(),
            this.dictValueParserRewardInfo(),
        );

        rewards.forEach((r) => {
            dict.set(r.address, r);
        });

        const body = beginCell()
            .storeUint(2544689112, 32)
            .storeUint(getRandomQueryId(), 64)
            .storeUint(periodId, 32)
            .storeDict(dict)
            .endCell();

        return provider.internal(sender, {
            value: MESSAGES_FEE.SET_REWARDS,
            bounce: true,
            body,
        });
    }

    async sendRewardToProvider(
        provider: ContractProvider,
        sender: Sender,
        providers: Address[],
    ) {
        const providersDict = Dictionary.empty(
            Dictionary.Keys.BigInt(257),
            Dictionary.Values.Address(),
        );

        providers.forEach((p, i) => {
            providersDict.set(BigInt(i), p);
        });

        console.log(providersDict);

        const body = beginCell()
            .storeUint(3709138512, 32)
            .storeUint(getRandomQueryId(), 64)
            .storeDict(providersDict)
            .storeUint(providers.length, 32)
            .endCell();

        return provider.internal(sender, {
            value: MESSAGES_FEE.SET_REWARDS * BigInt(providers.length),
            bounce: true,
            body,
        });
    }

    private dictValueParserRewardInfo(): DictionaryValue<RewardInfo> {
        return {
            serialize: (src, builder) => {
                builder.storeRef(
                    beginCell().store(this.storeRewardInfo(src)).endCell(),
                );
            },
            parse: (src) => {
                return this.loadRewardInfo(src.loadRef().beginParse());
            },
        };
    }

    private storeRewardInfo(src: RewardInfo): (builder: Builder) => void {
        return (builder: Builder) => {
            const b_0 = builder;

            b_0.storeCoins(src.amount);
            b_0.storeBit(src.isClaimed);
        };
    }

    protected loadRewardInfo(slice: Slice): RewardInfo {
        const sc_0 = slice;
        const _amount = sc_0.loadCoins();
        const _isClaimed = sc_0.loadBit();

        return {
            amount: _amount,
            isClaimed: _isClaimed,
        };
    }
}

export default RewardDistributor;
