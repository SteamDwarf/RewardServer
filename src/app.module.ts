import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RewardsModule } from './rewards/rewards.module';
import { MerkleService } from './merkle/merkle.service';
import { MerkleModule } from './merkle/merkle.module';
import { NodesModule } from './nodes/nodes.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [RewardsModule, MerkleModule, NodesModule, SubscriptionsModule],
  controllers: [AppController],
  providers: [AppService, MerkleService],
})
export class AppModule {}
