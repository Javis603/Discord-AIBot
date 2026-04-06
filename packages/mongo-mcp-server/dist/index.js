"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const mongodb_1 = require("mongodb");
let client = null;
let clientConnecting = null;
function getMongoUri() {
    const uri = (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();
    if (!uri) {
        throw new Error('Missing MongoDB connection string. Set MONGODB_URI (or MONGO_URI).');
    }
    return uri;
}
function getDbName(defaultDb) {
    const fromEnv = (process.env.MONGO_DB_NAME || '').trim();
    if (fromEnv)
        return fromEnv;
    if (defaultDb)
        return defaultDb;
    return 'admin';
}
function isWriteAllowed() {
    const v = (process.env.MONGO_MCP_ALLOW_WRITES || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(v);
}
async function getClient() {
    if (client)
        return client;
    if (clientConnecting)
        return clientConnecting;
    const uri = getMongoUri();
    clientConnecting = (async () => {
        const mongoClient = new mongodb_1.MongoClient(uri, {
            serverSelectionTimeoutMS: 5000,
        });
        await mongoClient.connect();
        client = mongoClient;
        return mongoClient;
    })().finally(() => {
        clientConnecting = null;
    });
    return clientConnecting;
}
function clampLimit(limit, max) {
    const n = typeof limit === 'number' ? limit : Number(limit);
    if (!Number.isFinite(n) || n <= 0)
        return Math.min(50, max);
    return Math.min(Math.floor(n), max);
}
function ensureObject(value, fieldName) {
    if (value === null || value === undefined)
        return {};
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${fieldName} must be an object`);
    }
    return value;
}
async function main() {
    const server = new mcp_js_1.McpServer({ name: 'mongo-mcp', version: '1.0.0' });
    const tool = server.tool?.bind(server);
    tool('mongo_ping', {
        description: 'Ping the configured MongoDB server',
        inputSchema: { type: 'object', properties: { db: { type: 'string', optional: true } }, required: [] },
    }, async ({ db }) => {
        try {
            const c = await getClient();
            const dbName = getDbName(db);
            const result = await c.db(dbName).admin().command({ ping: 1 });
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: true, db: dbName, result }, null, 2) }],
            };
        }
        catch (error) {
            return {
                content: [
                    { type: 'text', text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2) },
                ],
            };
        }
    });
    tool('mongo_list_collections', {
        description: 'List collections in a MongoDB database',
        inputSchema: { type: 'object', properties: { db: { type: 'string', optional: true } }, required: [] },
    }, async ({ db }) => {
        try {
            const c = await getClient();
            const dbName = getDbName(db);
            const collections = await c.db(dbName).listCollections({}, { nameOnly: true }).toArray();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ success: true, db: dbName, collections: collections.map((x) => x.name) }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    { type: 'text', text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2) },
                ],
            };
        }
    });
    tool('mongo_find', {
        description: 'Find documents in a MongoDB collection (read-only, limited)',
        inputSchema: {
            type: 'object',
            properties: {
                db: { type: 'string', description: 'Database name (optional)' },
                collection: { type: 'string', description: 'Collection name' },
                filter: { type: 'object', optional: true },
                projection: { type: 'object', optional: true },
                sort: { type: 'object', optional: true },
                limit: { type: 'number', optional: true },
            },
            required: ['collection'],
        },
    }, async ({ db, collection, filter, projection, sort, limit }) => {
        try {
            const c = await getClient();
            const dbName = getDbName(db);
            const lim = clampLimit(limit, 100);
            const f = ensureObject(filter, 'filter');
            const proj = ensureObject(projection, 'projection');
            const s = ensureObject(sort, 'sort');
            let cursor = c
                .db(dbName)
                .collection(collection)
                .find(f, { projection: Object.keys(proj).length ? proj : undefined });
            if (Object.keys(s).length) {
                cursor = cursor.sort(s);
            }
            cursor = cursor.limit(lim);
            const docs = await cursor.toArray();
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: true, db: dbName, collection, limit: lim, count: docs.length, docs }, null, 2) }],
            };
        }
        catch (error) {
            return {
                content: [
                    { type: 'text', text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2) },
                ],
            };
        }
    });
    tool('mongo_aggregate', {
        description: 'Aggregate documents in a MongoDB collection (read-only, limited)',
        inputSchema: {
            type: 'object',
            properties: {
                db: { type: 'string', description: 'Database name (optional)' },
                collection: { type: 'string', description: 'Collection name' },
                pipeline: { type: 'array', items: { type: 'object' } },
                limit: { type: 'number', optional: true },
            },
            required: ['collection', 'pipeline'],
        },
    }, async ({ db, collection, pipeline, limit }) => {
        try {
            if (!Array.isArray(pipeline)) {
                throw new Error('pipeline must be an array');
            }
            const c = await getClient();
            const dbName = getDbName(db);
            const lim = clampLimit(limit, 100);
            const cursor = c
                .db(dbName)
                .collection(collection)
                .aggregate(pipeline, { allowDiskUse: false })
                .limit(lim);
            const docs = await cursor.toArray();
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: true, db: dbName, collection, limit: lim, count: docs.length, docs }, null, 2) }],
            };
        }
        catch (error) {
            return {
                content: [
                    { type: 'text', text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2) },
                ],
            };
        }
    });
    tool('mongo_insert_one', {
        description: 'Insert one document (requires MONGO_MCP_ALLOW_WRITES=true)',
        inputSchema: {
            type: 'object',
            properties: {
                db: { type: 'string', description: 'Database name (optional)' },
                collection: { type: 'string', description: 'Collection name' },
                document: { type: 'object', description: 'Document to insert' },
            },
            required: ['collection', 'document'],
        },
    }, async ({ db, collection, document }) => {
        try {
            if (!isWriteAllowed()) {
                throw new Error('Writes are disabled. Set MONGO_MCP_ALLOW_WRITES=true to enable write tools.');
            }
            const doc = ensureObject(document, 'document');
            const c = await getClient();
            const dbName = getDbName(db);
            const result = await c.db(dbName).collection(collection).insertOne(doc);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ success: true, db: dbName, collection, insertedId: result.insertedId, acknowledged: result.acknowledged }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    { type: 'text', text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2) },
                ],
            };
        }
    });
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    const shutdown = async () => {
        try {
            await server.close();
        }
        finally {
            try {
                await client?.close();
            }
            catch {
            }
            process.exit(0);
        }
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
