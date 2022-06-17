module.exports = {
    apps: [
        {
            name: "image_service",
            script: "./dist/main.js",
            instances: 8,
            instance_var: "NODE_ID",
        },
    ],
};
