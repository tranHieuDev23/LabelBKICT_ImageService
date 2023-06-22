import { token } from "brandi";

export class ModelServiceConfig {
    public protoPath = "./src/proto/dependencies/model_service.proto";
    public host = "127.0.0.1";
    public port = 20003;

    public static fromEnv(): ModelServiceConfig {
        const config = new ModelServiceConfig();
        if (process.env.MODEL_SERVICE_PROTO_PATH !== undefined) {
            config.protoPath = process.env.MODEL_SERVICE_PROTO_PATH;
        }
        if (process.env.MODEL_SERVICE_HOST !== undefined) {
            config.host = process.env.MODEL_SERVICE_HOST;
        }
        if (process.env.MODEL_SERVICE_PORT !== undefined) {
            config.port = +process.env.MODEL_SERVICE_PORT;
        }
        return config;
    }
}

export const MODEL_SERVICE_CONFIG_TOKEN =
    token<ModelServiceConfig>("ModelServiceConfig");
