import { injected, token } from "brandi";
import { Client } from "minio";
import { Logger } from "winston";
import { S3Config, S3_CONFIG_TOKEN } from "../../config";
import { LOGGER_TOKEN } from "../../utils";
import { BucketDMImpl } from "./bucket_dm";
import { MINIO_CLIENT_TOKEN } from "./minio";

export function initializeThumbnailImageDM(minioClient: Client, logger: Logger, s3Config: S3Config): BucketDMImpl {
    return new BucketDMImpl(s3Config.thumbnailImageBucket, minioClient, logger);
}

injected(initializeThumbnailImageDM, MINIO_CLIENT_TOKEN, LOGGER_TOKEN, S3_CONFIG_TOKEN);

export const THUMBNAIL_IMAGE_DM_TOKEN = token<BucketDMImpl>("ThumbnailImageDM");
