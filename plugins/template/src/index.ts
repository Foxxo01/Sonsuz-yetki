import { findByProps, findStore } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import Settings from "./settings";

let permissionStore: any;
let userStore: any;
let guildStore: any;
let originalMethods: Map<string, Function> = new Map();

const setProtoFields = (obj: any, fields: string[], value: any) => {
  fields.forEach(field => {
    try {
      if (obj && obj[field] !== undefined) {
        const key = `${obj.constructor?.name || 'obj'}.${field}`;
        if (!originalMethods.has(key)) {
          originalMethods.set(key, obj[field]);
        }
        Object.getPrototypeOf(obj)[field] = value;
      }
    } catch(e) {}
  });
};

const overridePermissions = () => {
  try {
    if (!permissionStore || !userStore || !guildStore) {
      showToast("Failed to find stores", getAssetIDByName("Small"));
      return;
    }

    // Override permission methods
    setProtoFields(permissionStore, [
      "getGuildPermissions",
      "getChannelPermissions",
      "computePermissions",
      "computeBasicPermissions"
    ], () => 0n);

    setProtoFields(permissionStore, [
      "can",
      "canAccessGuildSettings",
      "canAccessMemberSafetyPage",
      "canBasicChannel",
      "canImpersonateRole",
      "canManageUser",
      "canWithPartialContext",
      "isRoleHigher"
    ], () => true);

    // Set as owner
    const currentUser = userStore.getCurrentUser?.();
    if (currentUser) {
      const guilds = guildStore.getGuilds?.() || {};
      Object.values(guilds).forEach((g: any) => {
        if (g) g.ownerId = currentUser.id;
      });
    }

    if (typeof permissionStore.emitChange === "function") permissionStore.emitChange();
    if (typeof guildStore.emitChange === "function") guildStore.emitChange();

    showToast("⚠️ Admin override applied (visual only)", getAssetIDByName("Warning"));
  } catch (e) {
    console.error("[AdminBypass]", e);
    showToast("Failed to override", getAssetIDByName("Small"));
  }
};

const restoreMethods = () => {
  for (const [key, value] of originalMethods) {
    try {
      const parts = key.split('.');
      const methodName = parts[parts.length - 1];
      const store = permissionStore || guildStore;
      if (store && store[methodName]) {
        Object.getPrototypeOf(store)[methodName] = value;
      }
    } catch(e) {}
  }
  originalMethods.clear();
};

export default {
  onLoad() {
    try {
      permissionStore = findStore("PermissionStore") || findByProps("getGuildPermissionProps");
      userStore = findStore("UserStore") || findByProps("getCurrentUser");
      guildStore = findStore("GuildStore") || findByProps("getGuilds");

      if (permissionStore && userStore && guildStore) {
        overridePermissions();
      } else {
        showToast("Failed to find Discord stores", getAssetIDByName("Small"));
      }
    } catch (e) {
      console.error("[AdminBypass]", e);
    }
  },

  onUnload() {
    restoreMethods();
    showToast("Admin bypass disabled", getAssetIDByName("Check"));
  },

  settings: Settings,
};
