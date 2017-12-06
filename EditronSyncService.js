const mitt = require("mitt");
const diffpatch = require("json-data-services/lib/utils/diffpatch");
const JsonSyncClient = require("json-sync/client");
const COMMANDS = require("json-sync/lib/commands");
const socket = require("socket.io-client");

const isValidUrl = /^https?:\/\/.*(:\d+)?.*$/;


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
        this.emitter.emit("users", {
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
        console.log("EditronSyncService <received data>", this.data.data);
        // an update from the server has been applied, you can perform the updates in your application now
        this.controller.setData(this.data.data, true);
    }

    onError(error) {
        console.error("SyncServer failed to connect", error);
    }

    onConnect() {
        this.connected = true;
        console.info(`SyncServer connected on id ${this.id}`);

        // the initial data has been loaded, you can initialize your application
        this.data = this.client.getData();
        console.log("EditronSyncService <received initial data>", this.data.data);
        if (this.data.data == null) {
            this.data.data = this.dataService.get();
            console.log("EditronSyncService <send initial data>", this.data.data);
            this.client.sync();
        } else {
            this.dataService.set("#", this.data.data, true);
        }

        this.queue.forEach((task) => this[task.method](...task.args));
        this.queue.length = 0;
    }

    onUpdate(event) {
        if (this.connected) {
            this.data.data = this.dataService.get();
            console.log("EditronSyncService <send data>", this.data.data);
            this.client.sync();
        }
    }

    destroy() {
        this.transport.disconnect();
        this.transport.destroy();
    }
}


module.exports = EditronSyncService;