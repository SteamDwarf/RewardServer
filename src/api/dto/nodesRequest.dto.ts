import { IsArray, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class NodesRequestDTO {
    @IsString()
    @IsNotEmpty()
    providerAddress: string;

    @IsArray()
    @IsString({ each: true })
    @IsNotEmpty()
    nodesIds: string[];
}
