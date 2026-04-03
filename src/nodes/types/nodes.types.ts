export interface NodeProvider {
    name: string;
    owner: string;
    address: string;
    nodes: Node[];
    weights: {
        totalWeight: number;
        averageWeight: number;
    };
}

export interface Node {
    id: number;
    country: string;
    rating: number;
    reviewsCount: number;
    tickets: number;
    uptime: number;
    weight: number;
}

export interface NodesDemand {
    country: string;
    cost: bigint;
    demand: number;
    saturation: number;
}
