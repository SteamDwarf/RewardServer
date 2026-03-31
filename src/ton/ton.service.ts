import {
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeyPair, mnemonicToPrivateKey } from '@ton/crypto';
import {
    CommonMessageInfoInternal,
    Contract,
    Message,
    OpenedContract,
    Sender,
    TonClient,
    Transaction,
    WalletContractV4,
    WalletContractV5R1,
} from '@ton/ton';
import { EnvVariables } from 'src/configuration';
import { MAINNET_GLOBAL_ID, TESTNET_GLOBAL_ID } from './ton.constants';

@Injectable()
export class TonService {
    private static readonly TX_LOOKUP_ATTEMPTS = 5;
    private static readonly TX_LOOKUP_DELAY_MS = 1500;
    private static readonly TX_PAGE_SIZE = 10;
    private static readonly TX_PAGINATION_ATTEMPTS = 5;

    private readonly _logger = new Logger(TonService.name);
    private _client: TonClient;
    private _walletContract: OpenedContract<
        WalletContractV4 | WalletContractV5R1
    >;
    private _keyPair?: KeyPair;

    constructor(private configService: ConfigService<EnvVariables>) {}

    async onModuleInit() {
        await this.initTonClient();
        await this.connectWallet();

        this._logger.log(
            `Blockchain Service initialized. Wallet: ${this._walletContract.address.toString()}`,
        );
    }

    async waitForTransaction(callback: () => Promise<void>) {
        const oldSeqno = await this.getSeqno();
        const previousLastTransaction = await this.getLastWalletTransaction();

        await callback();
        this._logger.log('Waiting for transaction...');

        let currentSeqno = oldSeqno;
        let attempts = 0;
        const maxAttempts = 20;

        while (currentSeqno <= oldSeqno && attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            currentSeqno = await this.getSeqno();
            attempts++;
        }

        if (currentSeqno <= oldSeqno) {
            throw new InternalServerErrorException(
                'Transaction timeout or failed to update seqno',
            );
        }

        return await this.checkLastTransactionStatus(previousLastTransaction);
    }

    async getSeqno(): Promise<number> {
        return await this._walletContract.getSeqno();
    }

    openContract<T extends Contract>(contract: T): OpenedContract<T> {
        return this._client.open(contract);
    }

    getSender(): Sender {
        if (!this._walletContract || !this._keyPair) {
            throw new InternalServerErrorException(
                'Wallet contract or key pair is not initialized. Check mnemonic or network configuration."',
            );
        }

        return this._walletContract.sender(this._keyPair?.secretKey);
    }

    private async initTonClient() {
        const tonClientEndpoint = this.configService.get('tonClientEndpoint', {
            infer: true,
        });
        const tonClientKey = this.configService.get('tonClientKey', {
            infer: true,
        });

        this._client = new TonClient({
            endpoint: tonClientEndpoint!,
            apiKey: tonClientKey,
        });
    }

    private async connectWallet() {
        const mnemonic = this.configService.get('walletMnemonic', {
            infer: true,
        });
        const walletVersion = this.configService.get('walletVersion', {
            infer: true,
        });

        const keyPair = await mnemonicToPrivateKey(mnemonic!);
        this._keyPair = keyPair;

        const network = this.configService.get('network', { infer: true });

        if (walletVersion === 'w5') {
            this._walletContract = this._client.open(
                WalletContractV5R1.create({
                    workchain: 0,
                    publicKey: keyPair.publicKey,
                    walletId: {
                        networkGlobalId:
                            network === 'MAINNET'
                                ? MAINNET_GLOBAL_ID
                                : TESTNET_GLOBAL_ID,
                    },
                }),
            );
        }

        if (walletVersion === 'v4') {
            this._walletContract = this._client.open(
                WalletContractV4.create({
                    publicKey: keyPair.publicKey,
                    workchain: 0,
                }),
            );
        }
    }

    private async checkLastTransactionStatus(
        previousLastTransaction?: { lt: string; hash: string } | null,
    ) {
        const transactions =
            await this.getTransactionsSince(previousLastTransaction);

        if (transactions.length === 0) {
            throw new InternalServerErrorException(
                'No new wallet transactions found after sending message',
            );
        }

        const rootTx = this.findRootTransaction(transactions);
        await this.validateTransactionChain(rootTx);

        this._logger.log('Transaction confirmed successfully');
        return rootTx;
    }

    private async getTransactionsSince(
        previousLastTransaction?: { lt: string; hash: string } | null,
    ): Promise<Transaction[]> {
        const transactions: Transaction[] = [];
        let cursor:
            | {
                  lt: string;
                  hash: string;
              }
            | undefined;

        for (
            let attempt = 0;
            attempt < TonService.TX_PAGINATION_ATTEMPTS;
            attempt++
        ) {
            const page = await this._client.getTransactions(
                this._walletContract.address,
                {
                    limit: TonService.TX_PAGE_SIZE,
                    ...(cursor
                        ? {
                              lt: cursor.lt,
                              hash: cursor.hash,
                              inclusive: false,
                          }
                        : {}),
                },
            );

            if (page.length === 0) {
                break;
            }

            let reachedPreviousTransaction = false;

            for (const transaction of page) {
                if (
                    previousLastTransaction &&
                    this.isSameTransaction(
                        transaction,
                        previousLastTransaction.lt,
                        previousLastTransaction.hash,
                    )
                ) {
                    reachedPreviousTransaction = true;
                    break;
                }

                transactions.push(transaction);
            }

            if (reachedPreviousTransaction || !previousLastTransaction) {
                return transactions;
            }

            const lastTxInPage = page[page.length - 1];
            cursor = {
                lt: lastTxInPage.lt.toString(),
                hash: lastTxInPage.hash().toString('base64'),
            };
        }

        return transactions;
    }

    private findRootTransaction(transactions: Transaction[]): Transaction {
        const externalInTransaction = transactions.find(
            (transaction) => transaction.inMessage?.info.type === 'external-in',
        );

        if (externalInTransaction) {
            return externalInTransaction;
        }

        const outgoingTransaction = transactions.find(
            (transaction) => transaction.outMessagesCount > 0,
        );

        if (outgoingTransaction) {
            return outgoingTransaction;
        }

        throw new InternalServerErrorException(
            'Unable to determine the root wallet transaction for the sent message',
        );
    }

    private async getLastWalletTransaction(): Promise<{
        lt: string;
        hash: string;
    } | null> {
        const state = await this._client.getContractState(
            this._walletContract.address,
        );

        return state.lastTransaction;
    }

    private isSameTransaction(
        transaction: Transaction,
        lt: string,
        hashBase64: string,
    ): boolean {
        return (
            transaction.lt.toString() === lt &&
            transaction.hash().toString('base64') === hashBase64
        );
    }

    private async validateTransactionChain(
        transaction: Transaction,
        visited = new Set<string>(),
    ): Promise<void> {
        const txId = this.getTransactionId(transaction);

        if (visited.has(txId)) {
            return;
        }

        visited.add(txId);
        this.assertTransactionSucceeded(transaction);

        for (const [, message] of transaction.outMessages) {
            if (message.info.type !== 'internal') {
                continue;
            }

            const childTx = await this.findChildTransaction(message);
            await this.validateTransactionChain(childTx, visited);
        }
    }

    private assertTransactionSucceeded(transaction: Transaction): void {
        const txId = this.getTransactionId(transaction);
        const { description } = transaction;

        if (
            description.type === 'generic' ||
            description.type === 'tick-tock' ||
            description.type === 'split-prepare' ||
            description.type === 'merge-install'
        ) {
            const computePhase = description.computePhase;

            if (computePhase.type === 'skipped') {
                this._logger.error(
                    `Transaction ${txId} skipped: ${computePhase.reason}`,
                );
                throw new InternalServerErrorException(
                    `Blockchain transaction ${txId} skipped: ${computePhase.reason}`,
                );
            }

            if (computePhase.type === 'vm') {
                if (!computePhase.success || computePhase.exitCode !== 0) {
                    this._logger.error(
                        `Transaction ${txId} failed with exit code: ${computePhase.exitCode}`,
                    );
                    throw new InternalServerErrorException(
                        `Blockchain transaction ${txId} failed (exit code: ${computePhase.exitCode})`,
                    );
                }
            }
        }

        if ('aborted' in description && description.aborted) {
            this._logger.error(`Transaction ${txId} was aborted`);
            throw new InternalServerErrorException(
                `Blockchain transaction ${txId} was aborted`,
            );
        }

        if ('actionPhase' in description && description.actionPhase) {
            const { actionPhase } = description;

            if (!actionPhase.success || !actionPhase.valid) {
                this._logger.error(
                    `Transaction ${txId} failed in action phase with result code: ${actionPhase.resultCode}`,
                );
                throw new InternalServerErrorException(
                    `Blockchain transaction ${txId} failed in action phase (result code: ${actionPhase.resultCode})`,
                );
            }
        }

        if ('bouncePhase' in description && description.bouncePhase) {
            this._logger.error(
                `Transaction ${txId} bounced (${description.bouncePhase.type})`,
            );
            throw new InternalServerErrorException(
                `Blockchain transaction ${txId} bounced (${description.bouncePhase.type})`,
            );
        }
    }

    private async findChildTransaction(message: Message): Promise<Transaction> {
        const info = this.getInternalMessageInfo(message);
        const source = info.src;
        const destination = info.dest;
        const createdLt = info.createdLt.toString();

        let lastError: unknown;

        for (let attempt = 1; attempt <= TonService.TX_LOOKUP_ATTEMPTS; attempt++) {
            try {
                return await this._client.tryLocateResultTx(
                    source,
                    destination,
                    createdLt,
                );
            } catch (error) {
                lastError = error;

                if (attempt < TonService.TX_LOOKUP_ATTEMPTS) {
                    await this.delay(TonService.TX_LOOKUP_DELAY_MS);
                }
            }
        }

        throw new InternalServerErrorException(
            `Unable to locate child transaction for message ${source.toString()} -> ${destination.toString()} (lt: ${createdLt})`,
            { cause: lastError instanceof Error ? lastError : undefined },
        );
    }

    private getTransactionId(transaction: Transaction): string {
        return `${transaction.lt.toString()}:${transaction.hash().toString('hex')}`;
    }

    private getInternalMessageInfo(message: Message): CommonMessageInfoInternal {
        if (message.info.type !== 'internal') {
            throw new InternalServerErrorException(
                `Expected internal message, got ${message.info.type}`,
            );
        }

        return message.info;
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
