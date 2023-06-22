import { loadPackageDefinition, credentials } from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { injected, token } from "brandi";
import { ModelServiceConfig, MODEL_SERVICE_CONFIG_TOKEN } from "../../config";
import { ModelServiceClient } from "../../proto/gen/ModelService";
import { ProtoGrpcType } from "../../proto/gen/model_service";

export function getModelServiceDM(
    ModelServiceConfig: ModelServiceConfig
): ModelServiceClient {
    const ModelServiceProtoGrpc = loadModelServiceProtoGrpc(
        ModelServiceConfig.protoPath
    );
    return new ModelServiceProtoGrpc.ModelService(
        `${ModelServiceConfig.host}:${ModelServiceConfig.port}`,
        credentials.createInsecure()
    );
}

function loadModelServiceProtoGrpc(protoPath: string): ProtoGrpcType {
    const packageDefinition = loadSync(protoPath, {
        keepCase: false,
        enums: String,
        defaults: false,
        oneofs: true,
    });
    const ModelServicePackageDefinition = loadPackageDefinition(
        packageDefinition
    ) as unknown;
    return ModelServicePackageDefinition as ProtoGrpcType;
}

injected(getModelServiceDM, MODEL_SERVICE_CONFIG_TOKEN);

export const MODEL_SERVICE_DM_TOKEN =
    token<ModelServiceClient>("ModelServiceClient");
