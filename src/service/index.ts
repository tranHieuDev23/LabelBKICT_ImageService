import { Container } from "brandi";
import {
    ImageServiceHandlersFactory,
    IMAGE_SERVICE_HANDLERS_FACTORY_TOKEN,
} from "./handler";
import {
    ImageServiceGRPCServer,
    IMAGE_SERVICE_GRPC_SERVER_TOKEN,
} from "./server";

export * from "./handler";
export * from "./server";

export function bindToContainer(container: Container): void {
    container
        .bind(IMAGE_SERVICE_HANDLERS_FACTORY_TOKEN)
        .toInstance(ImageServiceHandlersFactory)
        .inSingletonScope();
    container
        .bind(IMAGE_SERVICE_GRPC_SERVER_TOKEN)
        .toInstance(ImageServiceGRPCServer)
        .inSingletonScope();
}
