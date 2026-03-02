import { Controller, Get } from '@nestjs/common';
import { NodesService } from './nodes.service';
import { NodeProviderResponseDTO } from './dto/nodeProviderResponse.dto';

@Controller('nodes')
export class NodesController {
    constructor(private readonly nodesService: NodesService) {}

    @Get('providers')
    getProviders(): NodeProviderResponseDTO[] {
        return this.nodesService.getNodeProviders().map((provider) => ({
            name: provider.name,
            address: provider.address,
            nodes: provider.nodes.map((node) => ({
                id: node.id,
                country: node.country,
                rating: node.rating,
                reviewsCount: node.reviewsCount,
                tickets: node.tickets,
                uptime: node.uptime,
            })),
        }));
    }
}
