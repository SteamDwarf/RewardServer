import { toNano } from '@ton/core';

export const TESTNET_GLOBAL_ID = -3;
export const MAINNET_GLOBAL_ID = -239;

export type CONTRACTS =
    | 'NodeProviderStore'
    | 'NodeProviderRegistry'
    | 'VPNProviderStore'
    | 'VPNProviderRegistry'
    | 'BlackList'
    | 'JettonMaster'
    | 'RewardDistributor';

export const CONTRACTS_IDS: Record<CONTRACTS, bigint> = {
    NodeProviderRegistry: 10n,
    NodeProviderStore: 11n,
    VPNProviderRegistry: 20n,
    VPNProviderStore: 21n,
    BlackList: 30n,
    JettonMaster: 40n,
    RewardDistributor: 60n,
};

export const MESSAGES_FEE = {
    SEND_JETTONS: toNano('0.2'),
    SET_REWARDS: toNano('0.2'),

    /* DEPLOY: toNano('0.1'),
    BIND: toNano('0.1'),
    SET_ADDRESS_TO_ROOT: toNano('0.1'),
    SET_JETTON_DATA: toNano('0.1'),
    SET_JETTON_WALLET: toNano('0.1'),
    SET_CONTRACT_ADDRESS: toNano('0.1'),
    UPGRADE_CONTRACT: toNano('0.1'),
    SET_CONTRACT_DATA: toNano('0.1'),
    MIGRATE_ROOT: toNano('0.1'),
    SEND_JETTONS: toNano('0.2') */
};
