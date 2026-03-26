export interface RewardResponseDTO {
    periodId: number;
    amount: string;
    formulaVersion: number;
    snapshotHash: string;
    root: string;
    proofCellBoc: string;
}