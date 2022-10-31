module.exports = {
    apps: [
        {
            name: "image_service",
            script: "./dist/main.js",
            args: " --start_grpc_server",
            instances: 8,
            instance_var: "NODE_ID",
        },
    ],
};
