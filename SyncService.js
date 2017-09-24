const mitt = require("mitt");
const diffpatch = require("json-data-services/lib/utils/diffpatch");
const JsonSyncClient = require("json-sync/src/client");
const COMMANDS = require("json-sync/src/commands");
const socket = require("socket.io-client");

const isValidUrl = /^https?:\/\/.*:\d+.*$/;


class SyncService {

    constructor(controller) {
        this.controller = controller;
        this.dataService = controller.data();
        this.connected = false;
        this.emitter = mitt();

        this.onUpdate = this.onUpdate.bind(this);
        this.onSynched = this.onSynched.bind(this);
        this.onError = this.onError.bind(this);
        this.onConnect = this.onConnect.bind(this);

        this.dataService.on("afterUpdate", this.onUpdate);
    }

    connect(url, id) {
        if (url == null || isValidUrl.test(url) === false) {
            console.error("SyncService abort -- invalid id given", id);
            return;
        }
        if (id == null) {
            console.error("SyncService abort -- invalid id given", id);
            return;
        }

        this.id = id;
        this.url = url;
        this.transport = socket(url);

        this.client = new JsonSyncClient(this.transport, id, diffpatch.options);
        this.client.on("connected", this.onConnect);
        this.client.on("error", this.onError);
        this.client.on("synced", this.onSynched);

        this.transport.on(COMMANDS.updateUsers, (users) => {
            console.log("User list has updated", users);
            this.emitter.emit("users", {
                userId: this.transport.id,
                users
            });
        });

        this.client.initialize();
        console.log(`SyncServer: connect to ${url} in room ${id}`);
    }

    on(eventName, cb) {
        this.emitter.on(eventName, cb);
    }

    off(eventName, cb) {
        this.emitter.off(eventName, cb);
    }

    onSynched() {
        // console.log("sync apply changes");
        // an update from the server has been applied, you can perform the updates in your application now
        // @todo pass data through schemaService.addDefaultData before applying changes
        this.dataService.set("#", this.data.data, true);
    }

    onError(error) {
        console.error("SyncServer failed to connect", error);
    }

    onConnect() {
        this.connected = true;
        console.info(`SyncServer connected on id ${this.id}`);

        // the initial data has been loaded, you can initialize your application
        this.data = this.client.getData();
        if (this.data.data == null) {
            this.data.data = this.dataService.get();
            this.client.sync();
        } else {
            this.dataService.set("#", this.data.data, true);
        }
    }

    onUpdate(event) {
        if (this.connected) {
            this.data.data = this.dataService.get();
            this.client.sync();
        }
    }
}


module.exports = SyncService;
