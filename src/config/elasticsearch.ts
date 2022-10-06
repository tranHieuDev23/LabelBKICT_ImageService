import { token } from "brandi";

export class ElasticsearchConfig {
    public host = "127.0.0.1";
    public port = 9200;

    public static fromEnv(): ElasticsearchConfig {
        const config = new ElasticsearchConfig();
        if (process.env.ELASTICSEARCH_HOST !== undefined) {
            config.host = process.env.ELASTICSEARCH_HOST;
        }
        if (process.env.ELASTICSEARCH_PORT !== undefined) {
            config.port = +process.env.ELASTICSEARCH_PORT;
        }
        return config;
    }
}

export const ELASTICSEARCH_CONFIG_TOKEN = token<ElasticsearchConfig>("ElasticsearchConfig");
