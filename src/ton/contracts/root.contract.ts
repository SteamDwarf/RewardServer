import { Address, Contract, ContractProvider, TupleBuilder } from '@ton/core';

class Root implements Contract {
    private _addresses: Map<bigint, Address | null> = new Map();
    constructor(readonly address: Address) {}

    async getAddressFromRoot(provider: ContractProvider, contractId: bigint) {
        if (this._addresses.has(contractId)) {
            return this._addresses.get(contractId);
        }

        const params = new TupleBuilder();

        params.writeNumber(contractId);

        const { stack } = await provider.get('get_contract', params.build());
        const address = stack.readAddressOpt();

        this._addresses.set(contractId, address);

        return address;
    }
}

export default Root;
