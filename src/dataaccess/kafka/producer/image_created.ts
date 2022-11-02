import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Producer } from "kafkajs";
import { Logger } from "winston";
import { Image } from "../../../proto/gen/Image";
import {
    BinaryConverter,
    BINARY_CONVERTER_TOKEN,
    ErrorWithStatus,
    LOGGER_TOKEN,
} from "../../../utils";
import { KAFKA_PRODUCER_TOKEN } from "./producer";

export class ImageCreated {
    constructor(public image: Image) {}
}

export interface ImageCreatedProducer {
    createImageCreatedMessage(message: ImageCreated): Promise<void>;
}

const TopicNameImageServiceImageCreated = "image_service_image_created";

export class ImageCreatedProducerImpl implements ImageCreatedProducer {
    constructor(
        private readonly producer: Producer,
        private readonly binaryConverter: BinaryConverter,
        private readonly logger: Logger
    ) {}

    public async createImageCreatedMessage(
        message: ImageCreated
    ): Promise<void> {
        try {
            await this.producer.connect();
            await this.producer.send({
                topic: TopicNameImageServiceImageCreated,
                messages: [{ value: this.binaryConverter.toBuffer(message) }],
            });
        } catch (error) {
            this.logger.error(
                `failed to create ${TopicNameImageServiceImageCreated} message`,
                { message, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }
}

injected(
    ImageCreatedProducerImpl,
    KAFKA_PRODUCER_TOKEN,
    BINARY_CONVERTER_TOKEN,
    LOGGER_TOKEN
);

export const IMAGE_CREATED_PRODUCER_TOKEN = token<ImageCreatedProducer>(
    "ImageCreatedProducer"
);
