import "dotenv/config";

const dbPort = process.env.dbPort!;
const dbHost = process.env.dbHost!;
const dbName = process.env.dbName!;
const dbUsername = process.env.dbUsername!;
const dbPassword = process.env.dbPassword!;
const redisHost = process.env.redisHost!;
const redisPort = process.env.redisPort!;
const fromEmail = process.env.fromEmail!;

export const envConfig = {
  dbPort,
  dbHost,
  dbName,
  dbUsername,
  dbPassword,
  dbUrl: `postgresql://${dbUsername}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`,
  redisHost,
  redisPort: Number(redisPort),
  fromEmail,
};

