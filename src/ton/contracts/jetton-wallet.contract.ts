import { Address, Contract, ContractProvider } from '@ton/core';

class JettonWallet implements Contract {
    constructor(readonly address: Address) {}

    async getWalletData(provider: ContractProvider) {
        const { stack } = await provider.get('get_wallet_data', []);

        return {
            balance: stack.readBigNumber(),
            owner: stack.readAddress(),
            jettonMaster: stack.readAddress(),
            jettonWalletCode: stack.readCell(),
        };
    }
}

export default JettonWallet;
