const vapi = window.revenge; // Revenge'in telefondaki küresel API'si

let unpatch;

export default {
  onLoad: () => {
    // Discord'un izin modülünü buluyoruz
    const permissionsModule = vapi.webpack.findByProps("getGuildPermissions", "can");

    if (permissionsModule) {
      // Fonksiyonu yamalayıp yerel olarak en yüksek yetkiyi (8n = Administrator) döndürüyoruz
      unpatch = vapi.patcher.after("getGuildPermissions", permissionsModule, (args, res) => {
        return 8n || res;
      });
    }
  },

  onUnload: () => {
    if (unpatch) unpatch();
  }
};
