import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RewardsModule } from './rewards/rewards.module';
import { NodesModule } from './nodes/nodes.module';
import { TonService } from './ton/ton.service';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { validationSchema } from './config.schema';
import { TaskService } from './task/task.service';
import { TaskController } from './task/task.controller';
import { DbService } from './db/db.service';
import { DbModule } from './db/db.module';
import { ApiController } from './api/api.controller';
import { ApiModule } from './api/api.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
            load: [configuration],
            validationSchema,
        }),
        RewardsModule,
        NodesModule,
        DbModule,
        ApiModule,
    ],
    controllers: [AppController, TaskController, ApiController],
    providers: [AppService, TonService, TaskService, DbService],
})
export class AppModule {}
