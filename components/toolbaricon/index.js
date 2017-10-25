const m = require("mithril");
const __ = require("editron-core/utils/i18n").translate;


const View = {
    view(vnode) {
        const users = vnode.attrs.users;
        const userList = users
            .map((user) => { // eslint-disable-line arrow-body-style
                return user.session ? `${user.session.login}(${user.session.login_alias})` : undefined;
            })
            .filter((value) => value !== undefined)
            .join(",\n");

        return m(".editron-toolbar__users",
            {
                title: userList.length > 0 ? userList : __("toolbar:users:tooltip"),
                "data-users": userList,
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
