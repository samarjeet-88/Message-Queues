import { integer, jsonb, pgEnum, pgTable,uuid, varchar,timestamp } from "drizzle-orm/pg-core"


export const stageEnum=pgEnum('outboxStage',["pending","queued","processing","success","failed"])


export const outbox=pgTable("outbox",{
    id:uuid("id").primaryKey(),
    stage:stageEnum("stage").default("pending").notNull(),
    messageType:varchar("messageType",{length:255}).notNull(),
    streamId:varchar("streamId",{length:255}),
    retryCount:integer("retryCount").default(0).notNull(),
    performedBy:varchar("performedBy",{length:255}),
    payload:jsonb("payload").notNull(),
    createdAt:timestamp("createdAt").defaultNow().notNull(),
    updatedAt:timestamp("updatedAt").defaultNow().$onUpdate(()=>new Date()).notNull()
})