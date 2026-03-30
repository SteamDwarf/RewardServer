import { Address } from '@ton/core';

export interface NodeProvider {
    name: string;
    address: string;
    nodes: Node[];
}

export interface Node {
    id: number;
    country: string;
    rating: number;
    reviewsCount: number;
    tickets: number;
    uptime: number;
}
