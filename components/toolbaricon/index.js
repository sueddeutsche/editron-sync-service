const m = require("mithril");
const __ = require("editron-core/utils/i18n").translate;


const View = {
    view(vnode) {
        const users = vnode.attrs.users;

        return m(".editron-toolbar__users",
            {
                title: __("toolbar:users:tooltip"),
                "class": users.length > 1 ? "active" : "inactive",
                onclick: () => vnode.attrs.onclick(users)
            },
            m("a.editron-toolbar__action.editron-toolbar__action--show-users",
                m("span.mmf-icon__bubble", users.length),
                m("i.mmf-icon", "person")
            )
        );
    }
};


class ToolbarIcon {

    constructor(controller, syncService, options = {}) {
        this.viewModel = {
            users: [],
            onclick: options.onclick || ((users) => console.log(users))
        };

        syncService.on("users", (event) => {
            this.viewModel.userId = event.userId;
            this.viewModel.users = event.users;
            this.render();
        });

        this.$element = controller.createElement(".editron-toolbar__users");
        this.render();
    }

    render() {
        m.render(this.$element, m(View, this.viewModel));
    }

    toElement() {
        return this.$element;
    }
}


module.exports = ToolbarIcon;
