export default {
  template: "rest-api",

  language: "typescript",
  architecture: "modular",

  database: {
    provider: "postgresql",
    client: "prisma"
  },

  features: {
    resourceGenerator: true,
  },

  validation: "zod",
  srcDir: "src",
};
