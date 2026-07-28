export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Message Queues Learning API",
    version: "1.0.0",
    description: "API documentation for learning message queue implementations (Redis, BullMQ, RabbitMQ, Kafka).",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Development Server",
    },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health Check",
        description: "Checks if the server is running and the database connection is healthy.",
        responses: {
          200: {
            description: "Server is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "OK" },
                  },
                },
              },
            },
          },
          500: {
            description: "Database or server unhealthy",
          },
        },
      },
    },
  },
};
