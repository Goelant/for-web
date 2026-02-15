/**
 * Configure contexts and render App
 */
import "./sentry";

import { JSX, onMount, useContext } from "solid-js";
import { render } from "solid-js/web";

import { attachDevtoolsOverlay } from "@solid-devtools/overlay";
import { Navigate, Route, Router, useParams } from "@solidjs/router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import "material-symbols";
import "mdui/mdui.css";
import * as StoatJS from "stoat.js";
import { PublicBot, PublicChannelInvite } from "stoat.js";

import FlowCheck from "@revolt/auth/src/flows/FlowCheck";
import FlowConfirmReset from "@revolt/auth/src/flows/FlowConfirmReset";
import FlowCreate from "@revolt/auth/src/flows/FlowCreate";
import FlowDeleteAccount from "@revolt/auth/src/flows/FlowDelete";
import FlowHome from "@revolt/auth/src/flows/FlowHome";
import FlowLogin from "@revolt/auth/src/flows/FlowLogin";
import FlowResend from "@revolt/auth/src/flows/FlowResend";
import FlowReset from "@revolt/auth/src/flows/FlowReset";
import FlowVerify from "@revolt/auth/src/flows/FlowVerify";
import { ClientContext, clientContext, useClient } from "@revolt/client";
import { I18nProvider } from "@revolt/i18n";
import { KeybindContext } from "@revolt/keybinds";
import { ModalContext, ModalRenderer, useModals } from "@revolt/modal";
import { VoiceContext } from "@revolt/rtc";
import { StateContext, SyncWorker, useState } from "@revolt/state";
import * as RevoltUI from "@revolt/ui";

import {
  PluginProvider,
  usePlugins,
  resolveClientFromPlugins,
  loadPlugins,
  exposeSharedDependencies,
  exposeAppModules,
} from "./plugins";

/* @refresh reload */
import "@revolt/ui/styles";

import AuthPage from "./Auth";
import Interface from "./Interface";
import "./index.css";
import { DevelopmentPage } from "./interface/Development";
import { Discover } from "./interface/Discover";
import { Friends } from "./interface/Friends";
import { HomePage } from "./interface/Home";
import { ServerHome } from "./interface/ServerHome";
import { ChannelPage } from "./interface/channels/ChannelPage";
import "./serviceWorkerInterface";

attachDevtoolsOverlay();

/**
 * Redirect PWA start to the last active path
 */
function PWARedirect() {
  const state = useState();
  return <Navigate href={state.layout.getLastActivePath()} />;
}

/**
 * Open settings and redirect to last active path
 */
function SettingsRedirect() {
  const { openModal } = useModals();

  onMount(() => openModal({ type: "settings", config: "user" }));
  return <PWARedirect />;
}

/**
 * Open invite and redirect to last active path
 */
function InviteRedirect() {
  const params = useParams();
  const client = useClient();
  const { openModal, showError } = useModals();

  onMount(() => {
    if (params.code) {
      client()
        // TODO: add a helper to stoat.js for this
        .api.get(`/invites/${params.code as ""}`)
        .then((invite) => PublicChannelInvite.from(client(), invite))
        .then((invite) => openModal({ type: "invite", invite }))
        .catch(showError);
    }
  });

  return <PWARedirect />;
}

/**
 * Open bot invite and redirect to last active path
 */
function BotRedirect() {
  const params = useParams();
  const client = useClient();
  const { openModal, showError } = useModals();

  onMount(() => {
    if (params.code) {
      client()
        // TODO: add a helper to stoat.js for this
        .api.get(`/bots/${params.code as ""}/invite`)
        .then((invite) => new PublicBot(client(), invite))
        .then((invite) => openModal({ type: "add_bot", invite }))
        .catch(showError);
    }
  });

  return <PWARedirect />;
}

/**
 * Generic bridge that overrides the client context when plugins
 * claim ownership of the current server or channel.
 * All child components (messages, composition, etc.) automatically
 * use the correct client via useClient().
 */
function PluginClientBridge(props: { children?: JSX.Element }) {
  const params = useParams<{ server?: string; channel?: string }>();
  const primaryController = useContext(clientContext);
  const plugins = usePlugins();

  const resolvedController = () => {
    const entityId = params.server || params.channel;
    if (entityId && plugins) {
      const resolvedClient = resolveClientFromPlugins(plugins, entityId);
      if (resolvedClient) {
        return new Proxy(primaryController, {
          get(target, prop) {
            if (prop === "getCurrentClient") {
              return () => resolvedClient;
            }
            return (target as never)[prop as never];
          },
        });
      }
    }
    return primaryController;
  };

  return (
    <clientContext.Provider
      value={resolvedController() as typeof primaryController}
    >
      {props.children}
    </clientContext.Provider>
  );
}

/**
 * Component that loads plugins after the app is mounted.
 */
function PluginLoader() {
  const client = useClient();

  onMount(() => {
    // Expose shared deps for plugins
    exposeSharedDependencies();
    exposeAppModules({
      "@revolt/ui": RevoltUI,
      "@revolt/client": { useClient, clientContext },
      "@revolt/modal": { useModals },
      "stoat.js": StoatJS,
    });

    // Load plugins from plugins/ directory
    loadPlugins(() => client());
  });

  return null;
}

function MountContext(props: { children?: JSX.Element }) {
  const state = useState();

  /**
   * Tanstack Query client
   */
  const client = new QueryClient();

  return (
    <KeybindContext>
      <ModalContext>
        <PluginProvider>
          <ClientContext state={state}>
            <I18nProvider>
              <VoiceContext>
                <QueryClientProvider client={client}>
                  <PluginLoader />
                  {props.children}
                  <ModalRenderer />
                  <RevoltUI.FloatingManager />
                </QueryClientProvider>
              </VoiceContext>
            </I18nProvider>
            <SyncWorker />
          </ClientContext>
        </PluginProvider>
      </ModalContext>
    </KeybindContext>
  );
}

render(
  () => (
    <StateContext>
      <Router root={MountContext}>
        <Route path="/login" component={AuthPage as never}>
          <Route path="/delete/:token" component={FlowDeleteAccount} />
          <Route path="/check" component={FlowCheck} />
          <Route path="/create" component={FlowCreate} />
          <Route path="/auth" component={FlowLogin} />
          <Route path="/resend" component={FlowResend} />
          <Route path="/reset" component={FlowReset} />
          <Route path="/verify/:token" component={FlowVerify} />
          <Route path="/reset/:token" component={FlowConfirmReset} />
          <Route path="/*" component={FlowHome} />
        </Route>
        <Route path="/" component={Interface as never}>
          <Route path="/pwa" component={PWARedirect} />
          <Route path="/dev" component={DevelopmentPage} />
          <Route path="/discover/*" component={Discover} />
          <Route path="/settings" component={SettingsRedirect} />
          <Route path="/invite/:code" component={InviteRedirect} />
          <Route path="/bot/:code" component={BotRedirect} />
          <Route path="/friends" component={Friends} />
          <Route path="/server/:server/*" component={PluginClientBridge}>
            <Route path="/channel/:channel/*" component={ChannelPage} />
            <Route path="/*" component={ServerHome} />
          </Route>
          <Route
            path="/channel/:channel/*"
            component={PluginClientBridge}
          >
            <Route path="/*" component={ChannelPage} />
          </Route>
          <Route path="/*" component={HomePage} />
        </Route>
      </Router>

      <RevoltUI.LoadTheme />
      {/* <ReportBug /> */}
    </StateContext>
  ),
  document.getElementById("root") as HTMLElement,
);
