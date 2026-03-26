import { BadRequestException, Injectable } from '@nestjs/common';
import { Address, beginCell, Cell } from '@ton/core';
import { MerkleLeafData } from './types.ts/merkle.types';

@Injectable()
export class MerkleService {
    // Хешируем лист так же, как в контракте Tact
    hashLeaf(leafData: MerkleLeafData): Buffer {
        this.assertLeafInput(leafData);

        const cell = beginCell()
            .storeAddress(Address.parse(leafData.rewardDistributorAddress))
            .storeUint(leafData.periodId, 32)
            .storeAddress(Address.parse(leafData.claimerAddress))
            .storeCoins(leafData.amount)
            .storeUint(leafData.formulaVersion, 16)
            .storeUint(leafData.snapshotHash, 256)
            .endCell();

        return this.hashAsContract(cell);
    }

    // Хешируем пару узлов с сортировкой (Canonical Order)
    hashPair(left: Buffer, right: Buffer): Buffer {
        const [a, b] = Buffer.compare(left, right) <= 0 
            ? [left, right] 
            : [right, left];
        
        const cell = beginCell()
            .storeUint(BigInt(`0x${a.toString('hex')}`), 256)
            .storeUint(BigInt(`0x${b.toString('hex')}`), 256)
            .endCell()
        
        return this.hashAsContract(cell);    
    }

    buildTree(leaves: Buffer[]): Buffer[][] {
        let tree = [leaves];
        let currentLayer = leaves;

        while (currentLayer.length > 1) {
            const nextLayer: Buffer[] = [];

            for (let i = 0; i < currentLayer.length; i += 2) {
                if (i + 1 < currentLayer.length) {
                    nextLayer.push(this.hashPair(currentLayer[i], currentLayer[i + 1]));
                } else {
                    // Если нечетное количество — дублируем последний элемент
                    nextLayer.push(currentLayer[i]);
                }
            }

            tree.push(nextLayer);
            currentLayer = nextLayer;
        }
        return tree;
    }

    getProof(tree: Buffer[][], index: number): string[] {
        const proof: string[] = [];
        let currentIndex = index;

        for (let i = 0; i < tree.length - 1; i++) {
            const layer = tree[i];
            const isRight = currentIndex % 2 === 1;
            const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;

            if (siblingIndex < layer.length) {
                proof.push(layer[siblingIndex].toString('hex'));
            }
            currentIndex = Math.floor(currentIndex / 2);
        }
        return proof;
    }

    getProofHashes(tree: Buffer[][], index: number): Buffer[] {
        const proof: Buffer[] = [];
        let currentIndex = index;

        for (let level = 0; level < tree.length - 1; level += 1) {
            const layer = tree[level];
            const siblingIndex = currentIndex % 2 === 1 ? currentIndex - 1 : currentIndex + 1;

            if (siblingIndex < layer.length) {
                proof.push(layer[siblingIndex]);
            }
            currentIndex = Math.floor(currentIndex / 2);
        }

        return proof;
    }

    buildProofCell(proofHashes: Buffer[]): Cell {
        if (proofHashes.length === 0) {
            return beginCell().endCell();
        }

        const chunks: Buffer[][] = [];

        for (let i = 0; i < proofHashes.length; i += 3) {
            chunks.push(proofHashes.slice(i, i + 3));
        }

        let next: Cell | null = null;

        for (let i = chunks.length - 1; i >= 0; i -= 1) {
            const b = beginCell();

            for (const h of chunks[i]) {
                b.storeUint(BigInt(`0x${h.toString('hex')}`), 256);
            }

            if (next) b.storeRef(next);

            next = b.endCell();
        }

        return next!;
    }

    private hashAsContract(cell: Cell): Buffer {
        /**
         * TODO:
         * Здесь должен быть 1:1 эквивалент Tact `sha256(cell.asSlice())`.
         * До продакшена обязателен golden-test "contract vs backend".
         */
        return cell.hash();
    }

    private assertLeafInput(input: MerkleLeafData): void {
        if (!Number.isInteger(input.periodId) || input.periodId < 0 || input.periodId > 0xffffffff) {
            throw new BadRequestException('periodId must be uint32');
        }
        if (!Number.isInteger(input.formulaVersion) || input.formulaVersion < 0 || input.formulaVersion > 0xffff) {
            throw new BadRequestException('formulaVersion must be uint16');
        }
        if (input.amount <= 0n) {
            throw new BadRequestException('amount must be positive');
        }
        if (input.snapshotHash < 0n || input.snapshotHash > ((1n << 256n) - 1n)) {
            throw new BadRequestException('snapshotHash must be uint256');
        }
    }

}
