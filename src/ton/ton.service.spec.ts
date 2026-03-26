import { Test, TestingModule } from '@nestjs/testing';
import { TonService } from './ton.service';

describe('TonService', () => {
  let service: TonService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TonService],
    }).compile();

    service = module.get<TonService>(TonService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
