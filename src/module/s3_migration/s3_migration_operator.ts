import { injected, token } from "brandi";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { BucketDM } from "../../dataaccess/s3";

export interface S3MigrationOperator {
    migrateFilesToS3(directory: string, buckedDM: BucketDM): Promise<void>;
}

export class S3MigrationOperatorImpl implements S3MigrationOperator {
    public async migrateFilesToS3(directory: string, bucketDM: BucketDM): Promise<void> {
        const fileNameList = await readdir(directory);
        await Promise.all(
            fileNameList.map(async (fileName) => {
                const fullFilePath = join(directory, fileName);
                const fileData = await readFile(fullFilePath);
                await bucketDM.uploadFile(fileName, fileData);
            })
        );
    }
}

injected(S3MigrationOperatorImpl);

export const S3_MIGRATION_OPERATOR_TOKEN = token<S3MigrationOperator>("S3MigrationOperator");
