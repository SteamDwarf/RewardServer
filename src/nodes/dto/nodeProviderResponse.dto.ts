import {Node} from '../types/nodes.types';


export interface NodeProviderResponseDTO {
    name: string;
    address: string;
    nodes: Node[];
}
