const mitt = require("mitt");
const diffpatch = require("json-data-services/lib/utils/diffpatch");
const JsonSyncClient = require("json-sync/client");
const COMMANDS = require("json-sync/lib/commands");
const socket = require("socket.io-client");

const isValidUrl = /^https?:\/\/.*(:\d+)?.*$/;
function cp(data) {
    return JSON.parse(JSON.stringify(data));
}

const EVENTS = {
    connect: "connect",
    error: "error",
    users: "users"
};

class EditronSyncService {

    constructor(controller) {
        this.connected = false;
        this.emitter = mitt();
        this.currentLocks = [];
        this.controller = controller;
        this.dataService = controller.data();
        this.locationService = controller.location();
        this.queue = [];

        this.onUpdate = this.onUpdate.bind(this);
        this.onSynched = this.onSynched.bind(this);
        this.onError = this.onError.bind(this);
        this.onConnect = this.onConnect.bind(this);

        this.dataService.on("afterUpdate", this.onUpdate);
        this.locationService.on("blur", () => this.updateUserMeta({ focused: false }));
        this.locationService.on("focus", (pointer) => this.updateUserMeta({ focused: pointer }));
    }

    get EVENTS() {
        return EVENTS;
    }

    connect(url, id, options) {
        if (url == null || isValidUrl.test(url) === false) {
            console.error("EditronSyncService abort -- invalid id given", id);
            return;
        }
        if (id == null) {
            console.error("EditronSyncService abort -- invalid id given", id);
            return;
        }

        this.url = url;
        const transport = socket(url, options);
        this.use(transport, id, options.auth);
    }

    use(transport, id, credentials) {
        this.id = id;
        this.transport = transport;
        this.client = new JsonSyncClient(this.transport, id, diffpatch.options);
        this.client.on(JsonSyncClient.EVENTS.CONNECTED, this.onConnect);
        this.client.on(JsonSyncClient.EVENTS.ERROR, this.onError);
        this.client.on(JsonSyncClient.EVENTS.SYNCED, this.onSynched);
        this.transport.on(COMMANDS.updateUsers, (users) => this.updateUsers(users));
        this.transport.on("reconnect", () => {
            this.connected = true;
            this.emitter.emit(EVENTS.connect);
        });
        ["connect_error", "connect_timeout"].forEach((evtName) => {
            this.transport.on(evtName, (err) => {
                try {
                    if (err != null) {
                        if (err instanceof Error) {
                            err.message += ` (${evtName})`;
                        } else if (typeof err === "string") {
                            err.message += new Error(` (${evtName})`);
                        }
                    }
                } catch (e) {
                    console.log("Failed to update transport error message", e);
                }

                // Wrap in try/catch, because an exception here would prevent a reconnect
                try {
                    this.onError(err);
                } catch (eEvt) {
                    console.log("onError event handler for transport errors failed", eEvt);
                }
            });
        });

        this.client.join(credentials);
        console.log(`EditronSyncService: connecting to room '${id}'...`);
    }

    // @todo this implementation currently misses update pointer events...
    // flag input fields as locked if they are currently edited by another user
    lock(lockRequests) {
        // right now, css solution only - no need for programmatically logic
        const instances = this.controller.getInstances();
        this.currentLocks.forEach((user) => {
            if (instances[user.focused]) {
                instances[user.focused].forEach((editor) => editor.toElement().classList.remove("editron-lock"));
            }
        });

        this.currentLocks = lockRequests;
        lockRequests.forEach((user) => {
            if (instances[user.focused]) {
                instances[user.focused].forEach((editor) => editor.toElement().classList.add("editron-lock"));
            }
        });
    }

    updateUsers(users) {
        // console.log("Update users and meta", users);
        this.emitter.emit(EVENTS.users, {
            userId: this.transport.id,
            users
        });

        this.lock(users.filter((user) => user.id !== this.transport.id));
    }

    updateUserMeta(data = {}) {
        if (this.connected === false) {
            this.queue.push({ method: "updateUserMeta", args: [data] });
            return;
        }
        data.id = this.transport.id;
        // console.log("Send update user meta", data);
        this.transport.emit(COMMANDS.updateUserData, this.id, data);
    }

    on(eventName, cb) {
        this.emitter.on(eventName, cb);
    }

    off(eventName, cb) {
        this.emitter.off(eventName, cb);
    }

    onSynched() {
        console.log("EditronSyncService <received data>", cp(this.syncObject));
        // an update from the server has been applied, you can perform the updates in your application now
        this.controller.setData(this.syncObject.data);
    }

    onError(error) {
        console.error("SyncServer failed to connect", error);
        this.connected = this.transport.connected;
        this.emitter.emit(EVENTS.error, error);
    }

    onConnect() {
        this.connected = true;
        console.info(`SyncServer connected on id ${this.id}`);

        // the initial data has been loaded, you can initialize your application
        this.syncObject = this.client.getData();
        console.log("EditronSyncService <received initial data>", cp(this.syncObject));
        if (this.syncObject.data == null) {
            throw new Error("Initial data has no property 'data'");
            // this.syncObject.data = this.dataService.get();
            // console.log("DATASERVICE DATA", cp(this.syncObject.data));
            // console.log("EditronSyncService <send initial data>", cp(this.syncObject));
            // this.client.sync();
        } else if (this.syncObject.data._id) {
            throw new Error("Received invalid data", this.syncObject.data);

        } else {
            this.controller.setData(this.syncObject.data);
        }

        this.queue.forEach((task) => this[task.method](...task.args));
        this.queue.length = 0;

        this.emitter.emit(EVENTS.connect);
    }

    onUpdate(event) {
        if (this.connected) {
            this.syncObject.data = this.dataService.get();
            if (this.syncObject.data._id) {
                throw new Error("Received invalid application data", this.syncObject.data);
            }
            console.log("EditronSyncService <send data>", cp(this.syncObject));
            this.client.sync();
        }
    }

    destroy() {
        this.transport.disconnect();
        this.transport.destroy();
    }
}


module.exports = EditronSyncService;
