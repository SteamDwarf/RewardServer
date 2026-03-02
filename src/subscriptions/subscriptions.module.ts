import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { ProviderAuthGuard } from '../auth/provider-auth.guard';

@Module({
  providers: [SubscriptionsService, ProviderAuthGuard],
  controllers: [SubscriptionsController]
})
export class SubscriptionsModule {}
