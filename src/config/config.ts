import { token } from "brandi";
import { ApplicationConfig } from "./application";
import { DatabaseConfig } from "./database";
import { DistributedConfig } from "./distributed";
import { GRPCServerConfig } from "./grpc_service";
import { KafkaConfig } from "./kafka";
import { LogConfig } from "./log";
import { ElasticsearchConfig } from "./elasticsearch";
import { S3Config } from "./s3";
import { ModelServiceConfig } from "./model_service";

export class ImageServiceConfig {
    public logConfig = new LogConfig();
    public distributedConfig = new DistributedConfig();
    public databaseConfig = new DatabaseConfig();
    public kafkaConfig = new KafkaConfig();
    public s3Config = new S3Config();
    public modelServiceConfig = new ModelServiceConfig();
    public grpcServerConfig = new GRPCServerConfig();
    public elasticsearchConfig = new ElasticsearchConfig();
    public applicationConfig = new ApplicationConfig();

    public static fromEnv(): ImageServiceConfig {
        const config = new ImageServiceConfig();
        config.logConfig = LogConfig.fromEnv();
        config.distributedConfig = DistributedConfig.fromEnv();
        config.databaseConfig = DatabaseConfig.fromEnv();
        config.kafkaConfig = KafkaConfig.fromEnv();
        config.s3Config = S3Config.fromEnv();
        config.modelServiceConfig = ModelServiceConfig.fromEnv();
        config.grpcServerConfig = GRPCServerConfig.fromEnv();
        config.elasticsearchConfig = ElasticsearchConfig.fromEnv();
        config.applicationConfig = ApplicationConfig.fromEnv();
        return config;
    }
}

export const IMAGE_SERVICE_CONFIG_TOKEN = token<ImageServiceConfig>("ImageServiceConfig");
