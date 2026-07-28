import "dotenv/config";

const dbPort = process.env.dbPort!;
const dbHost = process.env.dbHost!;
const dbName = process.env.dbName!;
const dbUsername = process.env.dbUsername!;
const dbPassword = process.env.dbPassword!;

export const db = {
  dbPort,
  dbHost,
  dbName,
  dbUsername,
  dbPassword,
  dbUrl: `postgresql://${dbUsername}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`,
};
