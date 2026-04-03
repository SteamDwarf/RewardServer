import { NodeWithWeight } from '../../rewards/types/rewards.types';

export class ProviderNodesWithWeightResponseDTO {
    address: string;
    nodes: NodeWithWeight[];
}
