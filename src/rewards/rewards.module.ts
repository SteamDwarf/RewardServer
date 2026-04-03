import { Module } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { DbModule } from 'src/db/db.module';

@Module({
    providers: [RewardsService],
    imports: [DbModule],
    exports: [RewardsService],
})
export class RewardsModule {}
