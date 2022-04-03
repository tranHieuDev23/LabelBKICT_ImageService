module.exports = {
    apps: [
        {
            name: "image_service",
            script: "./dist/main.js",
            instances: 16,
            instance_var: "NODE_ID",
        },
    ],
};
