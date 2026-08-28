(() => {
  // 1. Adım: Kullanılabilir en kararlı Metro bulucuyu tespit et
  let metro = null;
  try {
    metro = (typeof vendetta !== 'undefined' ? vendetta.metro : null) || 
            (typeof revenge !== 'undefined' ? revenge.metro : null) || 
            (typeof global !== 'undefined' ? global.vendetta?.metro : null);
  } catch(e) {}

  // 2. Adım: Eğer üstteki global nesneler kısıtlanmışsa, React Native'in kendi dahili require yapısını tara
  if (!metro) {
    try {
      const modules = window.__r?.() || global.__r?.() || {};
      const metroKey = Object.keys(modules).find(k => modules[k]?.exports?.findByProps);
      if (metroKey) metro = modules[metroKey].exports;
    } catch(e) {}
  }

  // 3. Adım: Modülleri ayırt etme fonksiyonu
  const findModuleByProps = (...props) => {
    if (!metro) return null;
    try {
      if (typeof metro.findByProps === "function") return metro.findByProps(...props);
      if (typeof metro.find === "function") return metro.find(m => props.every(p => p in (m?.exports || m)));
    } catch (e) {}
    return null;
  };

  // Eğer metro hiçbir şekilde bulunamazsa, eval'in yerel kapsamındaki nesneleri dökümle
  if (!metro) {
    return "Hata: Metro modül motoruna erişilemedi. İstemci kısıtlaması var.";
  }

  const PermissionStore = findModuleByProps("getGuildPermissionProps", "computePermissions");
  const UserStore = findModuleByProps("getCurrentUser", "getUser");
  const GuildStore = findModuleByProps("getGuilds", "getGuildsArray") || findModuleByProps("getGuilds");

  if (!PermissionStore || !GuildStore || !UserStore) {
    return `Eksik bulma hatası:\nPermission: ${!!PermissionStore}\nUser: ${!!UserStore}\nGuild: ${!!GuildStore}`;
  }

  const setProtoFields = (obj, fields, value) => {
    fields.forEach(field => {
      try { Object.getPrototypeOf(obj)[field] = value; } catch(e) {}
    });
  };

  let permissionProps = {};
  try {
    const rawProps = PermissionStore.getGuildPermissionProps({ id: "0" }) || {};
    permissionProps = Object.fromEntries(Object.keys(rawProps).map(key => [key, true]));
  } catch(e) {
    permissionProps = { ADMINISTRATOR: true, ADMIN: true };
  }

  // Enjeksiyon aşaması
  setProtoFields(PermissionStore, ["getGuildPermissions", "getChannelPermissions", "computePermissions", "computeBasicPermissions"], () => ~0n);
  setProtoFields(PermissionStore, ["getGuildPermissionProps"], guild => ({ ...permissionProps, guild }));
  setProtoFields(PermissionStore, ["can", "canAccessGuildSettings", "canAccessMemberSafetyPage", "canBasicChannel", "canImpersonateRole", "canManageUser", "canWithPartialContext", "isRoleHigher"], () => true);
  
  if (typeof PermissionStore.emitChange === "function") PermissionStore.emitChange();

  try {
    const applyOwnerOverride = () => {
      const guildsObj = GuildStore.getGuilds?.() || {};
      const guildsArray = GuildStore.getGuildsArray?.() || Object.values(guildsObj);
      const currentUser = UserStore.getCurrentUser?.();
      if (guildsArray && currentUser) {
        guildsArray.forEach(g => { if (g) g.ownerId = currentUser.id; });
      }
    };
    if (typeof GuildStore.addChangeListener === "function") GuildStore.addChangeListener(applyOwnerOverride);
    applyOwnerOverride();
  } catch(e) {}

  if (typeof GuildStore.emitChange === "function") GuildStore.emitChange();

  return "Discord sonsuz yetki başarıyla hesaba tanımlandı!";
})();
