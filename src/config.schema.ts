import * as Joi from 'joi';

export const validationSchema = Joi.object({
    NODE_ENV: Joi.string().valid('dev', 'prod', 'test').default('dev'),
    TON_CLIENT_ENDPOINT: Joi.string().default(
        'https://testnet.toncenter.com/api/v2/jsonRPC',
    ),
    TON_CLIENT_KEY: Joi.string().required(),
    WALLET_MNEMONIC: Joi.string().required(),
    WALLET_VERSION: Joi.string().required(),
    NETWORK: Joi.string().default('TESTNET'),
    ROOT: Joi.string().required(),
});
