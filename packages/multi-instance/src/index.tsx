import type { StoatPlugin, PluginAPI } from "./plugin-types";
import { createSignal } from "./deps";

import { ClientManager } from "./ClientManager";
import { InstancesStore } from "./stores/InstancesStore";
import { MultiAuth } from "./stores/MultiAuth";
import { mountAddInstanceModal } from "./AddInstanceModal";

/**
 * MdDns icon SVG (Material Design "dns" icon)
 */
function DnsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
    </svg>
  );
}

const plugin: StoatPlugin = {
  name: "multi-instance",
  version: "0.1.0",

  async setup(api: PluginAPI) {
    // 1. Initialize stores & manager
    const instancesStore = new InstancesStore();
    const multiAuth = new MultiAuth();
    const manager = new ClientManager(multiAuth, instancesStore);

    await instancesStore.hydrate();
    await multiAuth.hydrate();

    // 2. Connect all saved instances
    for (const { instanceUrl } of multiAuth.getActiveSessions()) {
      manager.connectInstance(instanceUrl);
    }
    for (const { instanceUrl } of multiAuth.getAllSessions()) {
      if (!manager.getClient(instanceUrl)) {
        manager.connectInstance(instanceUrl);
      }
    }

    // 3. Register client resolver (servers + channels)
    api.registerClientResolver((entityId: string) => {
      const serverUrl = manager.resolveServerInstance(entityId);
      if (serverUrl) return manager.getClient(serverUrl);
      const channelUrl = manager.resolveChannelInstance(entityId);
      if (channelUrl) return manager.getClient(channelUrl);
      return undefined;
    });

    // 4. Register server provider (extra servers from other instances)
    api.registerServerProvider(() => {
      return manager.allServers();
    });

    // 5. Mount the modal (plugin manages its own overlay)
    const [showModal, setShowModal] = createSignal(false);
    mountAddInstanceModal(manager, showModal, () => setShowModal(false));

    // 6. Register sidebar action — opens the plugin's own modal
    api.registerSidebarAction({
      icon: () => DnsIcon(),
      tooltip: "Add an instance",
      onClick: () => setShowModal(true),
    });

    console.info("[multi-instance] Plugin initialized");
  },
};

export default plugin;
