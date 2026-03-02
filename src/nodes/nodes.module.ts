import { Module } from '@nestjs/common';
import { NodesService } from './nodes.service';
import { NodesController } from './nodes.controller';

@Module({
  providers: [NodesService],
  exports: [NodesService],
  controllers: [NodesController],
})
export class NodesModule {}
