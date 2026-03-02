import { Injectable } from '@nestjs/common';
import { Address, beginCell } from '@ton/core';

@Injectable()
export class MerkleService {
    // Хешируем лист так же, как в контракте Tact
    hashLeaf(address: string, amount: bigint): Buffer {
        return beginCell()
        .storeAddress(Address.parse(address))
        .storeCoins(amount)
        .endCell()
        .hash();
    }

    // Хешируем пару узлов с сортировкой (Canonical Order)
    hashPair(left: Buffer, right: Buffer): Buffer {
        const sorted = Buffer.compare(left, right) <= 0 
        ? [left, right] 
        : [right, left];
        
        return beginCell()
        .storeUint(BigInt('0x' + sorted[0].toString('hex')), 256)
        .storeUint(BigInt('0x' + sorted[1].toString('hex')), 256)
        .endCell()
        .hash();
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
}
