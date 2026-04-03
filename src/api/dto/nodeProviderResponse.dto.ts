import { Node } from '../../nodes/types/nodes.types';

export interface NodeProviderResponseDTO {
    name: string;
    address: string;
    owner: string;
    weights: {
        averageWeight: number;
        totalWeight: number;
    };
    nodes: Node[];
}
