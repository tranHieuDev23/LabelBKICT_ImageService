import { Container } from "brandi";
import { MigrateFilesToS3JobImpl, MIGRATE_FILES_TO_S3_JOBS_TOKEN } from "./migrate_files_to_s3";

export * from "./migrate_files_to_s3";

export function bindToContainer(container: Container): void {
    container.bind(MIGRATE_FILES_TO_S3_JOBS_TOKEN).toInstance(MigrateFilesToS3JobImpl).inSingletonScope();
}
