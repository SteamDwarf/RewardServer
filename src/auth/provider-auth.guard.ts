import {
    BadRequestException,
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Address } from '@ton/core';

@Injectable()
export class ProviderAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const address = request?.user?.address;

        if (!address) {
            throw new UnauthorizedException('Provider address is missing');
        }

        try {
            request.user.address = Address.parse(address).toRawString();
        } catch {
            throw new BadRequestException('Invalid TON address');
        }

        return true;
    }
}
