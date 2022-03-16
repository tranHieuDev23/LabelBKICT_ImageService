import { injected, token } from "brandi";
import { Snowflake } from "nodejs-snowflake";
import { DistributedConfig, DISTRIBUTED_CONFIG_TOKEN } from "../config";

export interface IDGenerator {
    Generate(): Promise<number>;
}

export class SnowflakeIDGenerator implements IDGenerator {
    private readonly snowflake: Snowflake;

    constructor(distributedConfig: DistributedConfig) {
        this.snowflake = new Snowflake({
            instance_id: distributedConfig.nodeID,
        });
    }

    public async Generate(): Promise<number> {
        return new Promise<number>((resolve) => {
            resolve(+this.snowflake.getUniqueID().toString(10));
        });
    }
}

injected(SnowflakeIDGenerator, DISTRIBUTED_CONFIG_TOKEN);

export const ID_GENERATOR_TOKEN = token<IDGenerator>("IDGenerator");
