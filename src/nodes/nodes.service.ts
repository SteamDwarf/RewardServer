import { Injectable } from '@nestjs/common';
import { NodeProvider } from './types/nodes.types';
import { Address } from '@ton/core';

@Injectable()
export class NodesService {
    nodeProviders: NodeProvider[];

    constructor() {
        this.nodeProviders = [
            {
                name: 'Atlas Nodes',
                address: '0QB7PgjX66DGBfkOhwMV7h0haCP0FTEYc8aoSC6h5Y4MgHTR',
                nodes: [
                    {
                        id: 101,
                        country: 'US',
                        rating: 4.8,
                        reviewsCount: 128,
                        tickets: 0,
                        uptime: 0.99,
                    },
                    {
                        id: 102,
                        country: 'DE',
                        rating: 3.2,
                        reviewsCount: 41,
                        tickets: 7,
                        uptime: 0.92,
                    },
                    {
                        id: 103,
                        country: 'FR',
                        rating: 1.1,
                        reviewsCount: 12,
                        tickets: 23,
                        uptime: 0.64,
                    },
                    {
                        id: 104,
                        country: 'SG',
                        rating: 0,
                        reviewsCount: 0,
                        tickets: 6,
                        uptime: 0.91,
                    },
                    {
                        id: 105,
                        country: 'US',
                        rating: 2.4,
                        reviewsCount: 19,
                        tickets: 14,
                        uptime: 0.73,
                    },
                ],
            },
            {
                name: 'Nordic Host',
                address: '0QCE-RicEBmEsMlp14ippkeBPzBi4KmmlsqdezExSWPOGmU-',
                nodes: [
                    {
                        id: 201,
                        country: 'DE',
                        rating: 4.9,
                        reviewsCount: 210,
                        tickets: 1,
                        uptime: 0.997,
                    },
                    {
                        id: 202,
                        country: 'FR',
                        rating: 2.0,
                        reviewsCount: 33,
                        tickets: 18,
                        uptime: 0.81,
                    },
                    {
                        id: 203,
                        country: 'US',
                        rating: 3.7,
                        reviewsCount: 58,
                        tickets: 0,
                        uptime: 0.95,
                    },
                    {
                        id: 204,
                        country: 'SG',
                        rating: 0,
                        reviewsCount: 0,
                        tickets: 27,
                        uptime: 0.52,
                    },
                    {
                        id: 205,
                        country: 'DE',
                        rating: 4.0,
                        reviewsCount: 44,
                        tickets: 5,
                        uptime: 0.9,
                    },
                ],
            },
            {
                name: 'Aurora Cloud',
                address: '0QCDDw3yO4UWGIX1pHZm-hTUhpmh7iYOldlBCre86DTgMkVo',
                nodes: [
                    {
                        id: 301,
                        country: 'FR',
                        rating: 4.3,
                        reviewsCount: 97,
                        tickets: 3,
                        uptime: 0.93,
                    },
                    {
                        id: 302,
                        country: 'US',
                        rating: 1.8,
                        reviewsCount: 21,
                        tickets: 20,
                        uptime: 0.78,
                    },
                    {
                        id: 303,
                        country: 'DE',
                        rating: 3.9,
                        reviewsCount: 63,
                        tickets: 0,
                        uptime: 0.96,
                    },
                    {
                        id: 304,
                        country: 'SG',
                        rating: 2.7,
                        reviewsCount: 34,
                        tickets: 12,
                        uptime: 0.7,
                    },
                    {
                        id: 305,
                        country: 'US',
                        rating: 4.6,
                        reviewsCount: 140,
                        tickets: 4,
                        uptime: 0.985,
                    },
                ],
            },
        ];
    }

    getNodeProviders(): NodeProvider[] {
        return this.nodeProviders;
    }

    getProviderByAddress(address: string): NodeProvider | undefined {
        return this.nodeProviders.find((p) =>
            Address.parse(p.address).equals(Address.parse(address)),
        );
    }
}
