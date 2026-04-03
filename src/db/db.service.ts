import { Injectable } from '@nestjs/common';
import { Address, toNano } from '@ton/core';
import { NodeProvider } from 'src/nodes/types/nodes.types';

@Injectable()
export class DbService {
    private readonly countryBaseCost: Record<string, bigint> = {
        US: toNano('1.0'),
        DE: toNano('2.0'),
        FR: toNano('1.5'),
        SG: toNano('1.0'),
    };
    private readonly countryDemand: Record<string, number> = {
        US: 100,
        DE: 200,
        FR: 200,
        SG: 300,
    };
    private nodeProviders: NodeProvider[] = [
        {
            name: 'Dmitriy',
            address: 'EQDAklR_5QOxqCWII2mRf3_AZlQH_hAM8Q8M37YXoxK_Cyc0',
            owner: 'EQB7PgjX66DGBfkOhwMV7h0haCP0FTEYc8aoSC6h5Y4MgJKe',
            nodes: [
                {
                    id: 101,
                    country: 'US',
                    rating: 4.8,
                    reviewsCount: 128,
                    tickets: 0,
                    uptime: 0.99,
                    weight: 0,
                },
                {
                    id: 102,
                    country: 'DE',
                    rating: 3.2,
                    reviewsCount: 41,
                    tickets: 7,
                    uptime: 0.92,
                    weight: 0,
                },
                {
                    id: 103,
                    country: 'FR',
                    rating: 1.1,
                    reviewsCount: 12,
                    tickets: 23,
                    uptime: 0.64,
                    weight: 0,
                },
                {
                    id: 104,
                    country: 'SG',
                    rating: 0,
                    reviewsCount: 0,
                    tickets: 6,
                    uptime: 0.91,
                    weight: 0,
                },
                {
                    id: 105,
                    country: 'US',
                    rating: 2.4,
                    reviewsCount: 19,
                    tickets: 14,
                    uptime: 0.73,
                    weight: 0,
                },
            ],
            weights: {
                averageWeight: 0,
                totalWeight: 0,
            },
        },
        {
            name: 'apiVPN',
            address: 'EQBZ-TSf-HFUAbZtv3JtpGRwRtMsMm7HQsTJV-gMcb3scHbG',
            owner: 'EQCD4tkrxmGcQ7ww3BYcD59-YOt4udc2zVnFVCmxM3fkAoqv',
            nodes: [
                {
                    id: 201,
                    country: 'DE',
                    rating: 4.9,
                    reviewsCount: 210,
                    tickets: 1,
                    uptime: 0.997,
                    weight: 0,
                },
                {
                    id: 202,
                    country: 'FR',
                    rating: 2.0,
                    reviewsCount: 33,
                    tickets: 18,
                    uptime: 0.81,
                    weight: 0,
                },
                {
                    id: 203,
                    country: 'US',
                    rating: 3.7,
                    reviewsCount: 58,
                    tickets: 0,
                    uptime: 0.95,
                    weight: 0,
                },
                {
                    id: 204,
                    country: 'SG',
                    rating: 0,
                    reviewsCount: 0,
                    tickets: 27,
                    uptime: 0.52,
                    weight: 0,
                },
                {
                    id: 205,
                    country: 'DE',
                    rating: 4.0,
                    reviewsCount: 44,
                    tickets: 5,
                    uptime: 0.9,
                    weight: 0,
                },
            ],
            weights: {
                averageWeight: 0,
                totalWeight: 0,
            },
        },
        {
            name: 'node tlst02',
            address: 'EQAQ81Bkgo78leogCL5lguUNjH2V1qha9xbYUrawIB4wLKST',
            owner: 'EQC394rp_XbLMOmUyESLjKIgBK-8RvEboUm8HPi7U78eMliZ',
            nodes: [
                {
                    id: 301,
                    country: 'FR',
                    rating: 4.3,
                    reviewsCount: 97,
                    tickets: 3,
                    uptime: 0.93,
                    weight: 0,
                },
                {
                    id: 302,
                    country: 'US',
                    rating: 1.8,
                    reviewsCount: 21,
                    tickets: 20,
                    uptime: 0.78,
                    weight: 0,
                },
                {
                    id: 303,
                    country: 'DE',
                    rating: 3.9,
                    reviewsCount: 63,
                    tickets: 0,
                    uptime: 0.96,
                    weight: 0,
                },
                {
                    id: 304,
                    country: 'SG',
                    rating: 2.7,
                    reviewsCount: 34,
                    tickets: 12,
                    uptime: 0.7,
                    weight: 0,
                },
                {
                    id: 305,
                    country: 'US',
                    rating: 4.6,
                    reviewsCount: 140,
                    tickets: 4,
                    uptime: 0.985,
                    weight: 0,
                },
            ],
            weights: {
                averageWeight: 0,
                totalWeight: 0,
            },
        },
    ];

    async findAllProviders(): Promise<NodeProvider[]> {
        return this.nodeProviders;
    }

    async findProviderByAddress(
        address: string,
    ): Promise<NodeProvider | undefined> {
        const searchAddr = Address.parse(address);

        return this.nodeProviders.find((p) =>
            Address.parse(p.address).equals(searchAddr),
        );
    }

    // Метод для сохранения рассчитанных весов
    async updateWeights(
        address: string,
        updateData: {
            totalWeight: number;
            averageWeight: number;
            nodeWeights: Record<number, number>;
        },
    ) {
        const provider = this.nodeProviders.find((p) => p.address === address);

        if (provider) {
            provider.weights.totalWeight = updateData.totalWeight;
            provider.weights.averageWeight = updateData.averageWeight;

            provider.nodes.forEach((node) => {
                node.weight = updateData.nodeWeights[node.id] ?? 0;
            });
        }
    }

    async getCountriesDemand() {
        return this.countryDemand;
    }

    async getCountryDemand(country: string) {
        return this.countryDemand[country];
    }

    async getCountriesBaseCost() {
        return this.countryBaseCost;
    }

    async getCountryBaseCost(country: string) {
        return this.countryBaseCost[country];
    }
}
