import { Container } from "brandi";
import dotenv from "dotenv";
import * as utils from "../utils";
import * as config from "../config";
import * as s3 from "../dataaccess/s3";
import * as modules from "../module";
import * as jobs from "../jobs";

export function migrateFilesToS3(dotenvPath: string) {
    dotenv.config({
        path: dotenvPath,
    });

    const container = new Container();
    utils.bindToContainer(container);
    config.bindToContainer(container);
    s3.bindToContainer(container);
    modules.bindToContainer(container);
    jobs.bindToContainer(container);

    const job = container.get(jobs.MIGRATE_FILES_TO_S3_JOBS_TOKEN);
    job.execute().then(() => {
        process.exit();
    });
}
