export interface MerkleLeafData {
    rewardDistributorAddress: string;
    periodId: number;
    claimerAddress: string;
    amount: bigint;
    formulaVersion: number;
    snapshotHash: bigint;
}