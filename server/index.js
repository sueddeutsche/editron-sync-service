const http = require("http");
const server = require("restify").createServer();
const socketio = require("socket.io");
const JsonSync = require("json-sync");
const InMemoryDataAdapter = require("json-sync/server/adapter/InMemoryDataAdapter");

const PORT = process.env.PORT || 5500;
const SOCKET_ROOT = process.env.SOCKET_ROOT || "/socket";

// setting up the diffsync server
const transport = socketio.listen(server.server, { path: SOCKET_ROOT });
// eslint-disable-next-line no-unused-vars
const jsonSyncServer = new JsonSync.Server(transport, new InMemoryDataAdapter());

// starting the http server
server.listen(PORT, () => {
    console.log("server listening at %s", PORT);
});

process.once("SIGTERM", () => {
    http.close(() => {
        console.log("Server shutdown complete");
    });
});
