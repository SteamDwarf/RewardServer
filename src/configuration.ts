import { Address } from '@ton/core';

export interface EnvVariables {
    tonClientEndpoint: string;
    tonClientKey: string;
    walletMnemonic: string[];
    walletVersion: string;
    network: string;
    root: Address;
}

export default (): EnvVariables => {
    return {
        tonClientEndpoint: process.env.TON_CLIENT_ENDPOINT!,
        tonClientKey: process.env.TON_CLIENT_KEY!,
        walletMnemonic: process.env.WALLET_MNEMONIC!.split(' '),
        walletVersion: process.env.WALLET_VERSION!,
        network: process.env.NETWORK!,
        root: Address.parse(process.env.ROOT!),
    };
};
