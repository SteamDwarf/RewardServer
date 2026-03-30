import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RewardsModule } from './rewards/rewards.module';
import { MerkleService } from './merkle/merkle.service';
import { MerkleModule } from './merkle/merkle.module';
import { NodesModule } from './nodes/nodes.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { TonService } from './ton/ton.service';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { validationSchema } from './config.schema';
import { TaskService } from './task/task.service';
import { TaskController } from './task/task.controller';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
            load: [configuration],
            validationSchema,
        }),
        RewardsModule,
        MerkleModule,
        NodesModule,
        SubscriptionsModule,
    ],
    controllers: [AppController, TaskController],
    providers: [AppService, MerkleService, TonService, TaskService],
})
export class AppModule {}
