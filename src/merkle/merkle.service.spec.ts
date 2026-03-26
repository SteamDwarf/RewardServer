import { Test, TestingModule } from '@nestjs/testing';
import { MerkleService } from './merkle.service';

describe('MerkleService', () => {
    let service: MerkleService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [MerkleService],
        }).compile();

        service = module.get<MerkleService>(MerkleService);
    });

    it('builds deterministic pair hash in canonical order', () => {
        const a = Buffer.from('11'.repeat(32), 'hex');
        const b = Buffer.from('22'.repeat(32), 'hex');

        const h1 = service.hashPair(a, b);
        const h2 = service.hashPair(b, a);

        expect(h1.equals(h2)).toBe(true);
    });

    it('buildProofCell packs hashes and can produce non-empty BOC', () => {
        const hashes = [
            Buffer.from('01'.repeat(32), 'hex'),
            Buffer.from('02'.repeat(32), 'hex'),
            Buffer.from('03'.repeat(32), 'hex'),
            Buffer.from('04'.repeat(32), 'hex'),
        ];

        const cell = service.buildProofCell(hashes);
        const boc = cell.toBoc();

        expect(boc.length).toBeGreaterThan(0);
    });
});
