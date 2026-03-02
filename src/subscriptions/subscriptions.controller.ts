import {
    BadRequestException,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { ProviderState } from './types/subscriptions.types';
import { ProviderAuthGuard } from '../auth/provider-auth.guard';

type AuthenticatedRequest = Request & { user: { address: string } };

@Controller('subscriptions')
export class SubscriptionsController {
    constructor(
        private readonly subscriptionsService: SubscriptionsService,
    ) {}

    @Get()
    listProviders(): Array<{ address: string; state: ProviderState }> {
        return this.subscriptionsService.listProviders();
    }

    @Get('addresses')
    getProviderAddresses(): string[] {
        return this.subscriptionsService.getProviderAddresses();
    }

    @Get(':address')
    getProviderState(
        @Param('address') address: string,
    ): { address: string; state: ProviderState } {
        const state = this.subscriptionsService.getProviderState(address);

        if (!state) {
            throw new NotFoundException('Provider not registered');
        }

        const normalized = this.subscriptionsService.addProviderAddress(address);

        return { address: normalized, state };
    }

    @Post()
    @UseGuards(ProviderAuthGuard)
    addProvider(
        @Req() req: AuthenticatedRequest,
    ): { address: string; state: ProviderState } {
        const address = req.user.address;
        const normalized = this.subscriptionsService.addProviderAddress(address);
        const state = this.subscriptionsService.getProviderState(normalized);

        if (!state) {
            throw new NotFoundException('Provider not registered');
        }

        return { address: normalized, state };
    }

    @Delete()
    @UseGuards(ProviderAuthGuard)
    removeProvider(
        @Req() req: AuthenticatedRequest,
    ): { address: string; state: ProviderState } {
        return this.subscriptionsService.removeProviderAddress(req.user.address);
    }

    @Post('updated')
    @UseGuards(ProviderAuthGuard)
    markProviderUpdated(
        @Req() req: AuthenticatedRequest,
        @Query('updatedAt') updatedAt?: string,
    ): { address: string; state: ProviderState } {
        const address = req.user.address;
        const parsedUpdatedAt = this.parseUpdatedAt(updatedAt);

        this.subscriptionsService.markProviderUpdated(address, parsedUpdatedAt);

        const state = this.subscriptionsService.getProviderState(address);

        if (!state) {
            throw new NotFoundException('Provider not registered');
        }

        const normalized = this.subscriptionsService.addProviderAddress(address);

        return { address: normalized, state };
    }

    private parseUpdatedAt(value?: string): Date | undefined {
        if (!value) {
            return undefined;
        }

        const parsed = new Date(value);

        if (Number.isNaN(parsed.getTime())) {
            throw new BadRequestException('updatedAt must be a valid ISO date');
        }

        return parsed;
    }
}
