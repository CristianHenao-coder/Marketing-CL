import { linksService } from "../../services/links.service.js";
import { StorageService as storageService } from "../../services/storage.service.js";
import { supabase } from "../../config/supabase.js";

// ========== HELPERS INTERNOS ==========
const parseBlacklistedCountries = (raw) =>
  raw ? raw.split(",").map(c => c.trim().toUpperCase()).filter(Boolean) : [];

const safeAnalyticsClicks = (analytics) =>
  analytics?.total_clicks || analytics?.clicks || 0;

const toISOorNull = (dateStr) => {
  if (!dateStr || !String(dateStr).trim()) return null;
  const d = new Date(`${dateStr.trim()}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const adminController = {

  // =========================
  //  DASHBOARD
  // =========================
  async renderDashboard(req, res) {
    try {
      const { data: links, error } = await supabase.from("smart_links").select("id, is_active, analytics");
      if (error) throw error;

      const stats = {
        totalLinks: links?.length || 0,
        activeLinks: links?.filter(l => l.is_active).length || 0,
        totalClicks: links?.reduce((acc, l) => acc + safeAnalyticsClicks(l.analytics), 0) || 0
      };
      stats.inactiveLinks = stats.totalLinks - stats.activeLinks;

      res.render("admin/dashboard", { layout: "admin/layout", currentSection: "dashboard", stats, error: null });
    } catch (err) {
      res.render("admin/dashboard", { layout: "admin/layout", currentSection: "dashboard", stats: null, error: "Error en dashboard" });
    }
  },

  // =========================
  //  CLIENTES
  // =========================
  async renderClients(req, res) {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select(`id, name, contact, notas, created_at, smart_links (id, is_active, price)`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const clients = (data || []).map(c => {
        const links = c.smart_links || [];
        return {
          ...c,
          total_links: links.length,
          active_links: links.filter(l => l.is_active).length,
          total_money: links.reduce((acc, l) => acc + Number(l.price || 0), 0)
        };
      });

      res.render("admin/clients", { layout: "admin/layout", currentSection: "clients", clients, error: null });
    } catch (err) {
      res.render("admin/clients", { layout: "admin/layout", currentSection: "clients", clients: [], error: "Error en clientes" });
    }
  },

  async updateClient(req, res) {
    try {
      const { id } = req.params;
      const { name, contact } = req.body;
      const { data, error } = await supabase
        .from("clients")
        .update({ name: name?.trim(), contact: contact?.trim() || null })
        .eq("id", id).select().single();

      if (error) throw error;
      res.json({ success: true, client: data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async deleteClient(req, res) {
    try {
      const { id } = req.params;
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async renderClientProfile(req, res) {
    try {
      const { id } = req.params;
      const { data: client, error } = await supabase
        .from("clients")
        .select(`*, smart_links (*)`)
        .eq("id", id)
        .single();

      if (error) throw error;

      // Calculate total money for the client profile view
      const links = client.smart_links || [];
      client.total_money = links.reduce((acc, l) => acc + Number(l.price || 0), 0);

      // Corrected view name from "admin/client_profile" to "admin/profile"
      res.render("admin/profile", { layout: "admin/layout", currentSection: "clients", client, error: null });
    } catch (err) {
      res.redirect("/admin/clients");
    }
  },

  // =========================
  //  LINKS
  // =========================
  async renderLinks(req, res) {
    try {
      const { data: clients } = await supabase.from("clients").select("id, name, contact").order("name");
      const { data: linksData } = await supabase.from("smart_links").select("*").order("created_at", { ascending: false });

      const clientsMap = new Map(clients.map(c => [String(c.id), c]));
      const links = linksData.map(l => ({
        ...l,
        client_name: clientsMap.get(String(l.client_id))?.name || "—",
        total_clicks: safeAnalyticsClicks(l.analytics)
      }));

      res.render("admin/links", { layout: "admin/layout", currentSection: "links", links, clients });
    } catch (err) {
      res.render("admin/links", { layout: "admin/layout", currentSection: "links", links: [], clients: [], error: "Error" });
    }
  },

  async createLink(req, res) {
    try {
      const b = req.body;
      let photoUrl = b.photo || null;

      if (req.file) {
        // Note: StorageService.uploadPhoto signature is (slug, file)
        const up = await storageService.uploadPhoto(b.slug, req.file);
        photoUrl = up.publicUrl;
      }

      // Lógica de cliente nuevo o existente
      let clientId = b.client_id ? Number(b.client_id) : null;
      if (!clientId && b.new_client_name) {
        const { data: nc } = await supabase.from("clients").insert({ name: b.new_client_name, contact: b.new_client_contact }).select("id").single();
        clientId = nc.id;
      }

      const newLink = {
        slug: b.slug?.trim(),
        custom_domain: b.custom_domain?.trim() || null,
        display_name: b.display_name,
        onlyfans: b.onlyfans,
        instagram: b.instagram,
        telegram: b.telegram,
        link_mode: b.link_mode || "landing",
        client_id: clientId,
        is_active: true,
        photo: photoUrl,
        price: Number(b.price || 30),
        fecha_vencimiento: toISOorNull(b.fecha_vencimiento),
        advanced_config: {
          os_force: b.os_force || "all",
          blacklisted_countries: parseBlacklistedCountries(b.blacklisted_countries)
        }
      };

      const saved = await linksService.saveLink(newLink);

      if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
        return res.json({ success: true, link: saved });
      }
      res.redirect("/admin/links");
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async deleteLink(req, res) {
    try {
      const { error } = await supabase.from("smart_links").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async toggleLinkActive(req, res) {
    try {
      const { id } = req.params;
      const { is_active } = req.body;
      const { data, error } = await supabase.from("smart_links").update({ is_active: !!is_active }).eq("id", id).select().single();
      if (error) throw error;
      res.json({ success: true, link: data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async toggleService(req, res) {
    try {
      const { id } = req.params;
      const { currentStatus } = req.body;

      // Logic: if currentStatus is 'active', switch to 'pending_payment' (or 'inactive' based on your logic)
      // If it's anything else, switch to 'active'.
      // Assuming 'status' field in 'smart_links' table based on your schema description.

      const newStatus = currentStatus === 'active' ? 'pending_payment' : 'active';

      const { data, error } = await supabase
        .from("smart_links")
        .update({ status: newStatus })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, newStatus: data.status });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async updateLink(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      // Filter allowed fields to update
      const allowed = ['display_name', 'onlyfans', 'instagram', 'telegram', 'price', 'link_mode'];
      const toUpdate = {};
      for (const key of allowed) {
        if (updates[key] !== undefined) toUpdate[key] = updates[key];
      }

      const { data, error } = await supabase.from("smart_links").update(toUpdate).eq("id", id).select().single();
      if (error) throw error;
      res.json({ success: true, link: data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
};