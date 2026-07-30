module.exports = {
  apps: [
    {
      name: "nvdi-career-decision",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3000",
        ENV_FILE: ".env.production",
      },
      env_production: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3000",
        ENV_FILE: ".env.production",
      },
    },
  ],
};
