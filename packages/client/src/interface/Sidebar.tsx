import { Component, JSX, Match, Show, Switch, createMemo } from "solid-js";

import { Channel, Server as ServerI } from "stoat.js";

import {
  CategoryContextMenu,
  ChannelContextMenu,
  ServerSidebarContextMenu,
} from "@revolt/app";
import { useClient, useUser } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { useLocation, useParams, useSmartParams } from "@revolt/routing";
import { useState } from "@revolt/state";
import { LAYOUT_SECTIONS } from "@revolt/state/stores/Layout";

import { usePlugins, getAllPluginServers, resolveClientFromPlugins } from "../plugins/context";

import { HomeSidebar, ServerList, ServerSidebar } from "./navigation";

/**
 * Left-most channel navigation sidebar
 */
export const Sidebar = (props: {
  /**
   * Menu generator TODO FIXME: remove
   */
  menuGenerator: (t: ServerI | Channel) => JSX.Directives["floating"];
}) => {
  const user = useUser();
  const state = useState();
  const client = useClient();
  const { openModal } = useModals();
  const plugins = usePlugins();

  /**
   * Get ordered servers, including any extra servers from plugins.
   */
  const orderedServers = () => {
    const primaryServers = state.ordering.orderedServers(client());

    const extraServers = getAllPluginServers(plugins);
    if (extraServers.length > 0) {
      const primaryIds = new Set(primaryServers.map((s) => s.id));
      const additional = extraServers.filter((s) => !primaryIds.has(s.id));
      if (additional.length > 0) {
        return [...primaryServers, ...additional];
      }
    }

    return primaryServers;
  };

  const params = useParams<{ server: string }>();
  const location = useLocation();

  return (
    <div style={{ display: "flex", "flex-shrink": 0 }}>
      <ServerList
        orderedServers={orderedServers()}
        setServerOrder={state.ordering.setServerOrder}
        unreadConversations={state.ordering
          .orderedConversations(client())
          .filter(
            // TODO: muting channels
            (channel) => channel.unread,
          )}
        user={user()!}
        selectedServer={() => params.server}
        onCreateOrJoinServer={() =>
          openModal({
            type: "create_or_join_server",
            client: client(),
          })
        }
        menuGenerator={props.menuGenerator}
      />
      <Show
        when={
          state.layout.getSectionState(LAYOUT_SECTIONS.PRIMARY_SIDEBAR, true) &&
          !location.pathname.startsWith("/discover")
        }
      >
        <Switch fallback={<Home />}>
          <Match when={params.server}>
            <Server />
          </Match>
        </Switch>
      </Show>
    </div>
  );
};

/**
 * Render sidebar for home
 */
const Home: Component = () => {
  const params = useSmartParams();
  const client = useClient();
  const state = useState();
  const conversations = createMemo(() =>
    state.ordering.orderedConversations(client()),
  );

  return (
    <HomeSidebar
      conversations={conversations}
      channelId={params().channelId}
      openSavedNotes={(navigate) => {
        // Check whether the saved messages channel exists already
        const channelId = [...client()!.channels.values()].find(
          (channel) => channel.type === "SavedMessages",
        )?.id;

        if (navigate) {
          if (channelId) {
            // Navigate if exists
            navigate(`/channel/${channelId}`);
          } else {
            // If not, try to create one but only if navigating
            client()!
              .user!.openDM()
              .then((channel) => navigate(`/channel/${channel.id}`));
          }
        }

        // Otherwise return channel ID if available
        return channelId;
      }}
    />
  );
};

/**
 * Render sidebar for a server
 */
const Server: Component = () => {
  const { openModal } = useModals();
  const params = useSmartParams();
  const client = useClient();
  const plugins = usePlugins();

  /**
   * Resolve the correct client for this server.
   * The primary client is tried first; if the server isn't found,
   * we ask plugin client resolvers (e.g. multi-instance).
   */
  const resolvedClient = () => {
    const serverId = params().serverId;
    if (!serverId) return client()!;
    // If primary client owns this server, use it
    if (client()?.servers.has(serverId)) return client()!;
    // Otherwise ask plugins
    const pluginClient = resolveClientFromPlugins(plugins, serverId);
    if (pluginClient) return pluginClient;
    return client()!;
  };

  const server = () => {
    const serverId = params().serverId;
    if (!serverId) return undefined!;
    return resolvedClient().servers.get(serverId)!;
  };

  /**
   * Open the server information modal
   */
  function openServerInfo() {
    openModal({
      type: "server_info",
      server: server(),
    });
  }

  /**
   * Open the server settings modal
   */
  function openServerSettings() {
    openModal({
      type: "settings",
      config: "server",
      context: server(),
    });
  }

  return (
    <Show when={server()}>
      <ServerSidebar
        server={server()}
        channelId={params().channelId}
        openServerInfo={openServerInfo}
        openServerSettings={openServerSettings}
        menuGenerator={(target) => ({
          contextMenu: () =>
            target instanceof Channel ? (
              <ChannelContextMenu channel={target} />
            ) : target instanceof ServerI ? (
              <ServerSidebarContextMenu server={target} />
            ) : (
              <CategoryContextMenu server={server()} category={target} />
            ),
        })}
      />
    </Show>
  );
};
