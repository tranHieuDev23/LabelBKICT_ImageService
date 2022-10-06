import { injected, token } from "brandi";
import { createLogger, format, Logger, transports } from "winston";
import "winston-daily-rotate-file";
import { ElasticsearchTransport } from "winston-elasticsearch";
import { ElasticsearchConfig, ELASTICSEARCH_CONFIG_TOKEN, LogConfig, LOG_CONFIG_TOKEN } from "../config";

export function initializeLogger(elasticsearchConfig: ElasticsearchConfig, logConfig: LogConfig): Logger {
    const logger = createLogger({
        format: format.combine(format.timestamp(), format.json()),
        defaultMeta: {},
        transports: [
            new transports.DailyRotateFile({
                level: "error",
                dirname: logConfig.logDir,
                filename: "error-%DATE%.log",
                datePattern: "YYYY-MM-DD-HH",
            }),
            new transports.DailyRotateFile({
                level: "info",
                dirname: logConfig.logDir,
                filename: "info-%DATE%.log",
                datePattern: "YYYY-MM-DD-HH",
            }),
            new ElasticsearchTransport({
                level: "error",
                source: "image_service",
                clientOpts: {
                    node: `http://${elasticsearchConfig.host}:${elasticsearchConfig.port}`,
                },
            }),
        ],
    });

    if (process.env.NODE_ENV === "production") {
        logger.level = "info";
    } else {
        logger.level = "debug";
    }

    return logger;
}

injected(initializeLogger, ELASTICSEARCH_CONFIG_TOKEN, LOG_CONFIG_TOKEN);

export const LOGGER_TOKEN = token<Logger>("Logger");
