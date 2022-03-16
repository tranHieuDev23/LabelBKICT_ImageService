import { Container } from "brandi";
import dotenv from "dotenv";
import * as utils from "../utils";
import * as config from "../config";
import * as db from "../dataaccess/db";
import * as service from "../service";

export function startGRPCServer(dotenvPath: string) {
    dotenv.config({
        path: dotenvPath,
    });

    const container = new Container();
    utils.bindToContainer(container);
    config.bindToContainer(container);
    db.bindToContainer(container);
    service.bindToContainer(container);

    const server = container.get(service.IMAGE_SERVICE_GRPC_SERVER_TOKEN);
    server.loadProtoAndStart("./src/proto/service/image_service.proto");
}
