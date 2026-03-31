import { ConfigService } from '@nestjs/config';
import { Address } from '@ton/ton';
import { EnvVariables } from 'src/configuration';
import { TonService } from './ton.service';

describe('TonService', () => {
    const walletAddress = Address.parseRaw(`0:${'0'.repeat(64)}`);
    const contractAddress = Address.parseRaw(
        `0:${'1'.padStart(64, '0')}`,
    );
    const childAddress = Address.parseRaw(`0:${'2'.padStart(64, '0')}`);

    let service: TonService;
    let client: {
        getTransactions: jest.Mock;
        getContractState: jest.Mock;
        tryLocateResultTx: jest.Mock;
    };

    beforeEach(() => {
        service = new TonService({} as ConfigService<EnvVariables>);
        client = {
            getTransactions: jest.fn(),
            getContractState: jest.fn(),
            tryLocateResultTx: jest.fn(),
        };

        (service as any)._client = client;
        (service as any)._walletContract = {
            address: walletAddress,
        };

        jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('validates a successful transaction chain recursively', async () => {
        const childTx = createTransaction({
            lt: 2n,
            hashHex: '02',
        });
        const rootTx = createTransaction({
            lt: 1n,
            hashHex: '01',
            outMessages: [
                createInternalMessage(walletAddress, contractAddress, 100n),
                createInternalMessage(contractAddress, childAddress, 101n),
            ],
        });

        client.getTransactions.mockResolvedValue([rootTx]);
        client.tryLocateResultTx
            .mockResolvedValueOnce(childTx)
            .mockResolvedValueOnce(createTransaction({ lt: 3n, hashHex: '03' }));

        await expect(service['checkLastTransactionStatus']()).resolves.toBe(
            rootTx,
        );
        expect(client.tryLocateResultTx).toHaveBeenCalledTimes(2);
    });

    it('fails when a nested transaction fails', async () => {
        const rootTx = createTransaction({
            lt: 1n,
            hashHex: '01',
            outMessages: [
                createInternalMessage(walletAddress, contractAddress, 100n),
            ],
        });
        const failedChildTx = createTransaction({
            lt: 2n,
            hashHex: '02',
            description: createGenericDescription({
                computePhase: {
                    type: 'vm',
                    success: false,
                    exitCode: 42,
                },
            }),
        });

        client.getTransactions.mockResolvedValue([rootTx]);
        client.tryLocateResultTx.mockResolvedValue(failedChildTx);

        await expect(service['checkLastTransactionStatus']()).rejects.toThrow(
            'exit code: 42',
        );
    });

    it('fails when the root transaction action phase is unsuccessful', async () => {
        const rootTx = createTransaction({
            lt: 1n,
            hashHex: '01',
            inMessage: createExternalInMessage(walletAddress),
            description: createGenericDescription({
                actionPhase: {
                    success: false,
                    valid: false,
                    resultCode: 37,
                },
            }),
        });

        client.getTransactions.mockResolvedValue([rootTx]);

        await expect(service['checkLastTransactionStatus']()).rejects.toThrow(
            'action phase',
        );
    });

    it('retries locating a child transaction before succeeding', async () => {
        const rootTx = createTransaction({
            lt: 1n,
            hashHex: '01',
            outMessages: [
                createInternalMessage(walletAddress, contractAddress, 100n),
            ],
        });
        const childTx = createTransaction({
            lt: 2n,
            hashHex: '02',
        });

        client.getTransactions.mockResolvedValue([rootTx]);
        client.tryLocateResultTx
            .mockRejectedValueOnce(new Error('not indexed yet'))
            .mockResolvedValueOnce(childTx);

        await expect(service['checkLastTransactionStatus']()).resolves.toBe(
            rootTx,
        );
        expect(client.tryLocateResultTx).toHaveBeenCalledTimes(2);
    });

    it('uses the external-in wallet transaction instead of a later bounced message', async () => {
        const sendTx = createTransaction({
            lt: 1n,
            hashHex: '01',
            inMessage: createExternalInMessage(walletAddress),
            outMessages: [
                createInternalMessage(walletAddress, contractAddress, 100n),
            ],
        });
        const bouncedWalletTx = createTransaction({
            lt: 2n,
            hashHex: '02',
            inMessage: createInternalMessage(contractAddress, walletAddress, 101n, {
                bounced: true,
                bounce: false,
            }),
        });
        const failedChildTx = createTransaction({
            lt: 3n,
            hashHex: '03',
            description: createGenericDescription({
                computePhase: {
                    type: 'vm',
                    success: false,
                    exitCode: 15738,
                },
                aborted: true,
            }),
        });

        client.getTransactions.mockResolvedValue([bouncedWalletTx, sendTx]);
        client.tryLocateResultTx.mockResolvedValue(failedChildTx);

        await expect(service['checkLastTransactionStatus']()).rejects.toThrow(
            'exit code: 15738',
        );
    });
});

function createTransaction({
    lt,
    hashHex,
    description,
    inMessage,
    outMessages = [],
}: {
    lt: bigint;
    hashHex: string;
    description?: Record<string, unknown>;
    inMessage?: Record<string, unknown> | null;
    outMessages?: Array<Record<string, unknown>>;
}) {
    return {
        lt,
        description: description ?? createGenericDescription(),
        inMessage: inMessage ?? null,
        outMessages: new Map(outMessages.map((message, index) => [index, message])),
        outMessagesCount: outMessages.length,
        hash: () => Buffer.from(hashHex.padStart(64, '0'), 'hex'),
    };
}

function createGenericDescription({
    computePhase,
    actionPhase,
    aborted = false,
    bouncePhase,
}: {
    computePhase?: Record<string, unknown>;
    actionPhase?: Record<string, unknown>;
    aborted?: boolean;
    bouncePhase?: Record<string, unknown>;
} = {}) {
    return {
        type: 'generic',
        computePhase: computePhase ?? {
            type: 'vm',
            success: true,
            exitCode: 0,
        },
        actionPhase: actionPhase ?? {
            success: true,
            valid: true,
            resultCode: 0,
        },
        aborted,
        bouncePhase,
    };
}

function createInternalMessage(
    src: Address,
    dest: Address,
    createdLt: bigint,
    overrides: Record<string, unknown> = {},
) {
    return {
        info: {
            type: 'internal',
            src,
            dest,
            createdLt,
            bounce: true,
            bounced: false,
            ...overrides,
        },
    };
}

function createExternalInMessage(dest: Address) {
    return {
        info: {
            type: 'external-in',
            dest,
        },
    };
}
