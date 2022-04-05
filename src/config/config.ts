import { token } from "brandi";
import { ApplicationConfig } from "./application";
import { DatabaseConfig } from "./database";
import { DistributedConfig } from "./distributed";
import { GRPCServerConfig } from "./grpc_service";
import { KafkaConfig } from "./kafka";
import { LogConfig } from "./log";

export class ImageServiceConfig {
    public logConfig = new LogConfig();
    public distributedConfig = new DistributedConfig();
    public databaseConfig = new DatabaseConfig();
    public kafkaConfig = new KafkaConfig();
    public grpcServerConfig = new GRPCServerConfig();
    public applicationConfig = new ApplicationConfig();

    public static fromEnv(): ImageServiceConfig {
        const config = new ImageServiceConfig();
        config.logConfig = LogConfig.fromEnv();
        config.distributedConfig = DistributedConfig.fromEnv();
        config.databaseConfig = DatabaseConfig.fromEnv();
        config.kafkaConfig = KafkaConfig.fromEnv();
        config.grpcServerConfig = GRPCServerConfig.fromEnv();
        config.applicationConfig = ApplicationConfig.fromEnv();
        return config;
    }
}

export const IMAGE_SERVICE_CONFIG_TOKEN =
    token<ImageServiceConfig>("ImageServiceConfig");
