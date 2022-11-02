import {
    loadPackageDefinition,
    Server,
    ServerCredentials,
} from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { injected, token } from "brandi";
import {
    ImageServiceHandlersFactory,
    IMAGE_SERVICE_HANDLERS_FACTORY_TOKEN,
} from "./handler";
import { GRPCServerConfig, GRPC_SERVER_CONFIG } from "../config";
import { ProtoGrpcType } from "../proto/gen/image_service";
import { Logger } from "winston";
import { LOGGER_TOKEN } from "../utils";

export class ImageServiceGRPCServer {
    constructor(
        private readonly handlerFactory: ImageServiceHandlersFactory,
        private readonly grpcServerConfig: GRPCServerConfig,
        private readonly logger: Logger
    ) {}

    public loadProtoAndStart(protoPath: string): void {
        const imageServiceProtoGrpc = this.loadImageServiceProtoGrpc(protoPath);

        const server = new Server();
        server.addService(
            imageServiceProtoGrpc.ImageService.service,
            this.handlerFactory.getImageServiceHandlers()
        );

        server.bindAsync(
            `0.0.0.0:${this.grpcServerConfig.port}`,
            ServerCredentials.createInsecure(),
            (error, port) => {
                if (error) {
                    this.logger.error("failed to start grpc server", { error });
                    return;
                }

                console.log(`starting grpc server, listening to port ${port}`);
                this.logger.info("starting grpc server", { port });
                server.start();
            }
        );
    }

    private loadImageServiceProtoGrpc(protoPath: string): ProtoGrpcType {
        const packageDefinition = loadSync(protoPath, {
            keepCase: false,
            enums: Number,
            defaults: false,
            oneofs: true,
        });
        const imageServicePackageDefinition = loadPackageDefinition(
            packageDefinition
        ) as unknown;
        return imageServicePackageDefinition as ProtoGrpcType;
    }
}

injected(
    ImageServiceGRPCServer,
    IMAGE_SERVICE_HANDLERS_FACTORY_TOKEN,
    GRPC_SERVER_CONFIG,
    LOGGER_TOKEN
);

export const IMAGE_SERVICE_GRPC_SERVER_TOKEN = token<ImageServiceGRPCServer>(
    "ImageServiceGRPCServer"
);
