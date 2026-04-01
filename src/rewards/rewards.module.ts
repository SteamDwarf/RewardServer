import { Module } from '@nestjs/common';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { NodesModule } from 'src/nodes/nodes.module';

@Module({
    controllers: [RewardsController],
    providers: [RewardsService],
    imports: [NodesModule],
    exports: [RewardsService],
})
export class RewardsModule {}
