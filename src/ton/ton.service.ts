import {
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeyPair, mnemonicToPrivateKey } from '@ton/crypto';
import {
    Contract,
    OpenedContract,
    Sender,
    TonClient,
    WalletContractV4,
    WalletContractV5R1,
} from '@ton/ton';
import { EnvVariables } from 'src/configuration';
import { MAINNET_GLOBAL_ID, TESTNET_GLOBAL_ID } from './ton.constants';

@Injectable()
export class TonService {
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

        return await this.checkLastTransactionStatus();
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

    private async checkLastTransactionStatus() {
        const transactions = await this._client.getTransactions(
            this._walletContract.address,
            {
                limit: 1,
            },
        );

        if (transactions.length === 0) {
            throw new InternalServerErrorException(
                'No transactions found for this wallet',
            );
        }

        const lastTx = transactions[0];
        const description = lastTx.description;

        if (description.type === 'generic') {
            const computePhase = description.computePhase;

            if (computePhase.type === 'vm' && computePhase.exitCode !== 0) {
                this._logger.error(
                    `Transaction failed with exit code: ${computePhase.exitCode}`,
                );
                throw new InternalServerErrorException(
                    `Blockchain transaction failed (exit code: ${computePhase.exitCode})`,
                );
            }

            if (computePhase.type === 'skipped') {
                throw new InternalServerErrorException(
                    `Transaction skipped: ${computePhase.reason}`,
                );
            }
        }

        this._logger.log('Transaction confirmed successfully');
        return lastTx;
    }
}
