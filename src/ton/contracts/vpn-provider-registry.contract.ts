import {
    Address,
    beginCell,
    Contract,
    ContractProvider,
    Sender,
} from '@ton/core';
import { MESSAGES_FEE } from '../ton.constants';
import { getRandomQueryId } from 'src/common/utils/blockchain.utils';

class VPNProviderRegistry implements Contract {
    private _jettonWalletAddress: Address | null;

    constructor(readonly address: Address) {}

    async getJettonWalletAddress(provider: ContractProvider) {
        if (this._jettonWalletAddress) return this._jettonWalletAddress;

        const { stack } = await provider.get('get_jetton_wallet', []);
        const address = stack.readAddressOpt();

        this._jettonWalletAddress = address;

        return address;
    }

    async sendJettonsToPool(
        provider: ContractProvider,
        sender: Sender,
        amount: bigint,
    ) {
        const body = beginCell()
            .storeUint(3393410961, 32)
            .storeUint(getRandomQueryId(), 64)
            .storeCoins(amount)
            .endCell();

        return provider.internal(sender, {
            value: MESSAGES_FEE.SEND_JETTONS,
            bounce: true,
            body,
        });
    }
}

export default VPNProviderRegistry;
