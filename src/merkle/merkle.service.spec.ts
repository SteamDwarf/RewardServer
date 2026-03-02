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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
