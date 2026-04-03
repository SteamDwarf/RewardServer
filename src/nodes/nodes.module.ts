import { Module } from '@nestjs/common';
import { NodesService } from './nodes.service';
import { DbModule } from 'src/db/db.module';

@Module({
    providers: [NodesService],
    exports: [NodesService],
    imports: [DbModule],
})
export class NodesModule {}
