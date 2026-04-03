import { Injectable } from '@nestjs/common';
import { NodeProvider, NodesDemand } from './types/nodes.types';
import { DbService } from 'src/db/db.service';

@Injectable()
export class NodesService {
    constructor(private readonly db: DbService) {}

    async getNodeProviders(): Promise<NodeProvider[]> {
        return this.db.findAllProviders();
    }

    async getProviderByAddress(
        address: string,
    ): Promise<NodeProvider | undefined> {
        return this.db.findProviderByAddress(address);
    }

    async getNodesDemandData(): Promise<NodesDemand[]> {
        const providers = await this.db.findAllProviders();
        const countriesDemand = await this.db.getCountriesDemand();
        const countriesCost = await this.db.getCountriesBaseCost();

        const nodeCountByCountry: Record<string, number> = {};

        providers.forEach((provider) => {
            provider.nodes.forEach((node) => {
                const country = node.country;
                nodeCountByCountry[country] =
                    (nodeCountByCountry[country] || 0) + 1;
            });
        });

        return Object.keys(countriesDemand).map((country) => {
            const demand = countriesDemand[country];
            const activeNodes = nodeCountByCountry[country] || 0;
            const cost = countriesCost[country] || 0n;

            /**
             * Расчет Saturation (Насыщенности):
             * Чем больше нод относительно спроса, тем выше процент.
             * Ограничиваем 100%, если нод стало больше, чем нужно.
             */
            const saturation =
                demand > 0
                    ? Math.min(Math.round((activeNodes / demand) * 100), 100)
                    : 0;

            return {
                country,
                cost,
                demand,
                saturation,
            };
        });
    }
}
