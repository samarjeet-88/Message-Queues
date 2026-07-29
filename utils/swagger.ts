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
    "/redis/notification": {
      post: {
        summary: "Push a notification to the outbox and Redis queue",
        description: "Inserts a notification task into the database outbox table, then pushes it to the Redis queue for workers to process.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  message: { type: "string", example: "Test notification message" },
                },
                "required": ["message"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Notification successfully accepted and queued",
            content: {
              "application/json": {
                "schema": {
                  type: "object",
                  properties: {
                    "Notification pushed successfully": {
                      type: "object",
                      properties: {
                        type: { type: "string", example: "redisNotification" },
                        data: {
                          type: "object",
                          properties: {
                            id: { type: "string", example: "01910243-7fba-70a0-8321-df62eb0efb92" },
                            stage: { type: "string", example: "pending" },
                            messageType: { type: "string", example: "notification" },
                            retryCount: { type: "integer", example: 0 },
                            payload: {
                              type: "object",
                              properties: {
                                message: { type: "string", example: "Test notification message" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
