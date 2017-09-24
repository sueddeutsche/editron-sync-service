# editron client for syncing data changes to other clients

> The service requires a running server with an implemented `editron-sync-server`

## Usage


In your editron application

```bash
npm install editron-sync-service --save
```

and setup like

```js
const EditronController = require("editron-core/Controller");
const controller = new EditronController(schema, data);
const SyncService = require("editron-sync-service/SyncService");
const syncService = new SyncService(controller);

syncService.connect(urlToSynServer, uniqueId);
```

Additionally you may add any component like

```js
const UsersIcon = require("editron-sync-service/components/usersicon");
const users = new UsersIcon(controller, syncService, $targetHTMLNode);
```
