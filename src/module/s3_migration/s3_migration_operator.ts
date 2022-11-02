import { injected, token } from "brandi";
import { readdir } from "fs/promises";
import { createReadStream } from "fs";
import { join } from "path";
import { BucketDM } from "../../dataaccess/s3";

export interface S3MigrationOperator {
    migrateFilesToS3(directory: string, buckedDM: BucketDM): Promise<void>;
}

export class S3MigrationOperatorImpl implements S3MigrationOperator {
    public async migrateFilesToS3(directory: string, bucketDM: BucketDM): Promise<void> {
        const fileNameList = await readdir(directory);
        for (const fileName of fileNameList) {
            const fullFilePath = join(directory, fileName);
            const fileStream = createReadStream(fullFilePath);
            await bucketDM.uploadFile(fileName, fileStream);
        }
    }
}

injected(S3MigrationOperatorImpl);

export const S3_MIGRATION_OPERATOR_TOKEN = token<S3MigrationOperator>("S3MigrationOperator");
