import { randomBytes } from 'crypto';

export const getRandomQueryId = (): bigint => {
    return BigInt('0x' + randomBytes(8).toString('hex'));
};
