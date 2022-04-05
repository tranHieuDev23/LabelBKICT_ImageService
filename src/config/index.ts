import { Container } from "brandi";
import { APPLICATION_CONFIG_TOKEN } from "./application";
import { ImageServiceConfig, IMAGE_SERVICE_CONFIG_TOKEN } from "./config";
import { DATABASE_CONFIG_TOKEN } from "./database";
import { DISTRIBUTED_CONFIG_TOKEN } from "./distributed";
import { GRPC_SERVER_CONFIG } from "./grpc_service";
import { KAFKA_CONFIG_TOKEN } from "./kafka";
import { LOG_CONFIG_TOKEN } from "./log";

export * from "./log";
export * from "./distributed";
export * from "./database";
export * from "./kafka";
export * from "./grpc_service";
export * from "./application";
export * from "./config";

export function bindToContainer(container: Container): void {
    container
        .bind(IMAGE_SERVICE_CONFIG_TOKEN)
        .toInstance(ImageServiceConfig.fromEnv)
        .inSingletonScope();
    container
        .bind(LOG_CONFIG_TOKEN)
        .toInstance(() => container.get(IMAGE_SERVICE_CONFIG_TOKEN).logConfig)
        .inSingletonScope();
    container
        .bind(DISTRIBUTED_CONFIG_TOKEN)
        .toInstance(
            () => container.get(IMAGE_SERVICE_CONFIG_TOKEN).distributedConfig
        )
        .inSingletonScope();
    container
        .bind(DATABASE_CONFIG_TOKEN)
        .toInstance(
            () => container.get(IMAGE_SERVICE_CONFIG_TOKEN).databaseConfig
        )
        .inSingletonScope();
    container
        .bind(KAFKA_CONFIG_TOKEN)
        .toInstance(() => container.get(IMAGE_SERVICE_CONFIG_TOKEN).kafkaConfig)
        .inSingletonScope();
    container
        .bind(GRPC_SERVER_CONFIG)
        .toInstance(
            () => container.get(IMAGE_SERVICE_CONFIG_TOKEN).grpcServerConfig
        )
        .inSingletonScope();
    container
        .bind(APPLICATION_CONFIG_TOKEN)
        .toInstance(
            () => container.get(IMAGE_SERVICE_CONFIG_TOKEN).applicationConfig
        )
        .inSingletonScope();
}
