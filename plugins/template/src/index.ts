import { metro } from "@vendetta";

// Discord içerisinden gerekli mağaza (Store) modüllerini çekiyoruz
const PermissionStore = metro.findByProps("getGuildPermissionProps", "computePermissions");
const UserStore = metro.findByProps("getCurrentUser", "getUser");
const GuildStore = metro.findByProps("getGuilds", "getGuildsArray") || metro.findByProps("getGuilds");

// Orijinal fonksiyonları eklenti kapandığında geri yüklemek için saklıyoruz
const originalMethods: Record<string, any> = {};
let changeListenerRemover: (() => void) | null = null;

// Sunucu sahipliğini istemci tarafında üzerimize alan fonksiyon
const applyOwnerOverride = () => {
    try {
        const guildsObj = GuildStore.getGuilds?.() || {};
        const guildsArray = GuildStore.getGuildsArray?.() || Object.values(guildsObj);
        const currentUser = UserStore.getCurrentUser?.();
        
        if (guildsArray && currentUser) {
            guildsArray.forEach((g: any) => { 
                if (g) g.ownerId = currentUser.id; 
            });
        }
    } catch (e) {
        console.error("[Sonsuz Yetki] Sahiplik değiştirme hatası:", e);
    }
};

export const onLoad = () => {
    if (!PermissionStore || !GuildStore || !UserStore) {
        throw new Error("Discord dahili modüllerine erişilemedi. Eklenti yüklenemiyor.");
    }

    // 1. Adım: Orijinal metodları yedekle ve prototip seviyesinde manipüle et
    const proto = Object.getPrototypeOf(PermissionStore);
    
    const trueMethods = ["can", "canAccessGuildSettings", "canAccessMemberSafetyPage", "canBasicChannel", "canImpersonateRole", "canManageUser", "canWithPartialContext", "isRoleHigher"];
    const bitwiseMethods = ["getGuildPermissions", "getChannelPermissions", "computePermissions", "computeBasicPermissions"];

    // Sürekli true dönmesi gereken yetki kontrolleri
    trueMethods.forEach(method => {
        if (proto[method]) {
            originalMethods[method] = proto[method];
            proto[method] = () => true;
        }
    });

    // En yüksek yetki bitini (~0n veya -1) dönmesi gereken fonksiyonlar
    bitwiseMethods.forEach(method => {
        if (proto[method]) {
            originalMethods[method] = proto[method];
            proto[method] = () => ~0n;
        }
    });

    // getGuildPermissionProps fonksiyonunu manipüle etme
    if (proto.getGuildPermissionProps) {
        originalMethods["getGuildPermissionProps"] = proto.getGuildPermissionProps;
        let permissionProps = { ADMINISTRATOR: true, ADMIN: true };
        try {
            const rawProps = originalMethods["getGuildPermissionProps"]({ id: "0" }) || {};
            permissionProps = Object.fromEntries(Object.keys(rawProps).map(key => [key, true])) as any;
        } catch(e) {}
        proto.getGuildPermissionProps = (guild: any) => ({ ...permissionProps, guild });
    }

    // 2. Adım: Değişiklikleri tetikle ve arayüzü güncelle
    if (typeof PermissionStore.emitChange === "function") PermissionStore.emitChange();

    // 3. Adım: Sunucu listesi değiştikçe sahipliği sürekli güncelle
    if (typeof GuildStore.addChangeListener === "function") {
        GuildStore.addChangeListener(applyOwnerOverride);
        changeListenerRemover = () => GuildStore.removeChangeListener(applyOwnerOverride);
    }
    applyOwnerOverride();
    if (typeof GuildStore.emitChange === "function") GuildStore.emitChange();
};

export const onUnload = () => {
    // Eklenti kapatıldığında Discord'un kararsız kalmaması için her şeyi orijinal haline döndürüyoruz
    const proto = Object.getPrototypeOf(PermissionStore);
    
    Object.keys(originalMethods).forEach(method => {
        try {
            proto[method] = originalMethods[method];
        } catch(e) {}
    });

    // Dinleyiciyi (listener) kaldır
    if (changeListenerRemover) {
        try { changeListenerRemover(); } catch(e) {}
    }

    // Arayüzü eski haline döndürmek için tekrar tetikle
    if (typeof PermissionStore.emitChange === "function") PermissionStore.emitChange();
    if (typeof GuildStore.emitChange === "function") GuildStore.emitChange();
};
