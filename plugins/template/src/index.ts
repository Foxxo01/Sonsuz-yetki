import { findByProps, findStore } from "@vendetta/metro";
import Settings from "./settings";

let permissionStore;
let userStore;
let guildStore;
let originalMethods = new Map();

const setProtoFields = (obj, fields, value) => {
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
    if (!permissionStore || !userStore || !guildStore) return;

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

    const currentUser = userStore.getCurrentUser?.();
    if (currentUser) {
      const guilds = guildStore.getGuilds?.() || {};
      Object.values(guilds).forEach((g) => {
        if (g) g.ownerId = currentUser.id;
      });
    }

    if (typeof permissionStore.emitChange === "function") permissionStore.emitChange();
    if (typeof guildStore.emitChange === "function") guildStore.emitChange();
  } catch (e) {
    console.error("[AdminBypass]", e);
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
      }
    } catch (e) {
      console.error("[AdminBypass]", e);
    }
  },
  onUnload() {
    restoreMethods();
  },
  settings: Settings,
};
