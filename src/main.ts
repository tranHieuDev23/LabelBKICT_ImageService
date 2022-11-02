import minimist from "minimist";
import { startGRPCServer } from "./cmd/start_grpc_server";
import { migrateFilesToS3 } from "./cmd/migrate_files_to_s3";

const args = minimist(process.argv);
if (args["start_grpc_server"]) {
    startGRPCServer(".env");
} else if (args["migrate_files_to_s3"]) {
    migrateFilesToS3(".env");
} else {
    console.log("no component was selected, exiting...");
}
