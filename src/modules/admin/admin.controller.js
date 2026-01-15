import { linksService } from '../../services/links.service.js';
import { storageService } from '../../services/storage.service.js';
import { supabase } from '../../config/supabase.js';

// ========== HELPERS ==========
function parseBlacklistedCountries(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

function safeAnalyticsClicks(analytics) {
  if (!analytics || typeof analytics !== 'object') return 0;
  return analytics.total_clicks || analytics.clicks || 0;
}

function toISOorNull(dateStr) {
  if (!dateStr) return null;
  const trimmed = String(dateStr).trim();
  if (!trimmed) return null;
  const d = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ========== CONTROLADOR PRINCIPAL ==========
export const adminController = {
  
  // =========================
  //  DASHBOARD
  // =========================
  async renderDashboard(req, res) {
    try {
      const { data: links, error } = await supabase
        .from('smart_links')
        .select('id, is_active, analytics');

      if (error) throw error;

      const totalLinks = links?.length || 0;
      const activeLinks = links?.filter((l) => l.is_active).length || 0;
      const inactiveLinks = totalLinks - activeLinks;
      const totalClicks = links?.reduce( (acc, l) => acc + safeAnalyticsClicks(l.analytics),0) || 0;

      return res.render('admin/dashboard', {
        layout: 'admin/layout',
        currentSection: 'dashboard',
        stats: {
          totalLinks,
          activeLinks,
          inactiveLinks,
          totalClicks,
        },
        error: null,
      });
    } catch (err) {
      console.error('[renderDashboard] Error:', err);
      return res.render('admin/dashboard', {
        layout: 'admin/layout',
        currentSection: 'dashboard',
        stats: null,
        error: 'Error cargando estadísticas del dashboard',
      });
    }
  },

  // =========================
  //  CLIENTES (LISTADO)
  // =========================
  async renderClients(req, res) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          smart_links (id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const clients = (data || []).map((c) => {
        const linkCount = c.smart_links ? c.smart_links.length : 0;
        // Calcular el totalMoney correctamente
        const totalMoney = c.smart_links ? c.smart_links.reduce((acc, l) => {
          // Si el precio no está definido, usar 30 como valor por defecto
          const p = typeof l.price === 'number' ? l.price : 30;
          return acc + p;
        }, 0) : 0;
        return {
          id: c.id,
          name: c.name,
          contact: c.contact || 'No asignado',
          notas: c.notas || '',
          created_at: c.created_at,
          links_comprados: linkCount,
          money_total: totalMoney,
        };
      });

      return res.render('admin/clients', {
        layout: 'admin/layout',
        currentSection: 'clients',
        clients,
        error: null,
      });
    } catch (err) {
      console.error('[renderClients] Error:', err);
      return res.render('admin/clients', {
        layout: 'admin/layout',
        currentSection: 'clients',
        clients: [],
        error: 'Error cargando clientes',
      });
    }
  },

  // =========================
  //  PERFIL DEL CLIENTE
  // =========================
  async renderClientProfile(req, res) {
    try {
      const { id } = req.params;

      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (clientError) throw clientError;

      const { data: links, error: linksError } = await supabase
        .from('smart_links')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });

      if (linksError) throw linksError;

      return res.render('admin/profile', {
        layout: 'admin/layout',
        currentSection: 'clients',
        client,
        links: links || [],
        error: null
      });
    } catch (err) {
      console.error('[renderClientProfile] Error:', err);
      res.redirect('/admin/clients?error=notfound');
    }
  },

  // =========================
  //  CREAR LINK (CON AJAX)
  // =========================
  async createLink(req, res) {
    try {
      const {
        slug, display_name, subtitle, instagram, onlyfans, tiktok, telegram,
        link_mode, custom_domain, status, client_id: clientIdRaw,
        new_client_name, new_client_contact, price, fecha_vencimiento,
        os_force = 'all', blacklisted_countries,
      } = req.body;

      const file = req.file;
      let photoUrl = req.body.photo || null;

      if (file) {
        const upload = await storageService.uploadPhoto(
          file.buffer, file.originalname, file.mimetype, slug
        );
        photoUrl = upload.publicUrl;
      }

      let clientId = clientIdRaw ? Number(clientIdRaw) : null;

      if (!clientId && new_client_name) {
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            name: new_client_name,
            contact: new_client_contact || null,
          })
          .select('id')
          .single();

        if (clientError) throw clientError;
        clientId = newClient.id;
      }

      const priceNumber = (price && price.trim() !== '') ? Number(price) : 30;
      const fechaVencimientoISO = toISOorNull(fecha_vencimiento);

      const advanced_config = {
        os_force,
        blacklisted_countries: parseBlacklistedCountries(blacklisted_countries),
        geofilter_enabled: false,
        data_analysis_enabled: false,
      };

      const newLink = {
        slug: slug.trim(),
        display_name,
        subtitle,
        onlyfans,
        instagram,
        telegram,
        tiktok,
        link_mode: link_mode || 'landing',
        custom_domain: custom_domain || null,
        client_id: clientId,
        is_active: true,
        status: status || 'active',
        photo: photoUrl,
        price: priceNumber,
        fecha_vencimiento: fechaVencimientoISO,
        analytics: { total_clicks: 0 },
        advanced_config,
      };

      const saved = await linksService.saveLink(newLink);
      const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest';

      if (isAjax) {
        return res.json({ success: true, message: 'Link creado', link: saved, photoUrl });
      }
      return res.redirect('/admin/links');

    } catch (error) {
      console.error('[createLink] Error:', error);
      const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest';
      if (isAjax) return res.status(500).json({ success: false, error: error.message });
      return res.status(500).render('admin/links', {
        layout: 'admin/layout', currentSection: 'links', links: [], clients: [],
        error: 'Error creando el Smart Link',
      });
    }
  },

  // =========================
  //  ACTUALIZAR LINK (UPDATE)
  // =========================
  async updateLink(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const { data, error } = await supabase
        .from('smart_links')
        .update({
          display_name: updateData.display_name,
          price: updateData.price,
          fecha_vencimiento: updateData.fecha_vencimiento,
          instagram: updateData.instagram,
          onlyfans: updateData.onlyfans,
          subtitle: updateData.subtitle,
          tiktok: updateData.tiktok
        })
        .eq('id', id)
        .select();

      if (error) throw error;
      res.json({ success: true, data });
    } catch (err) {
      console.error("Error en updateLink:", err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // =========================
  //  TOGGLE SERVICE (ON/OFF)
  // =========================
  async toggleService(req, res) {
    try {
      const { id } = req.params;
      const { currentStatus } = req.body;
      
      const newStatus = currentStatus === 'active' ? 'pending_payment' : 'active';
      const is_active = newStatus === 'active';

      const { data, error } = await supabase
        .from('smart_links')
        .update({ status: newStatus, is_active: is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, newStatus: data.status });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // =========================
  //  ELIMINAR LINK
  // =========================
  async deleteLink(req, res) {
    try {
      const { id } = req.params;
      const { error } = await supabase
        .from('smart_links')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // =========================
  //  TOGGLE IS_ACTIVE (GENERICO)
  // =========================
  async toggleLinkActive(req, res) {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      const { data, error } = await supabase
        .from('smart_links')
        .update({ is_active: !!is_active })
        .eq('id', id)
        .select('id, is_active')
        .single();

      if (error) throw error;
      return res.json({ success: true, link: data });
    } catch (err) {
      console.error('[toggleLinkActive] Error:', err);
      return res.status(500).json({ success: false, message: 'Error interno' });
    }
  }
  ,
  // =========================
  //  LISTADO DE SMART LINKS
  // =========================
  async renderLinks(req, res) {
    try {
      const { data: links, error } = await supabase
        .from('smart_links')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, contact')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (clientsError) throw clientsError;

      return res.render('admin/links', {
        layout: 'admin/layout',
        currentSection: 'links',
        links: links || [],
        clients: clients || [],
        error: null,
      });
    } catch (err) {
      console.error('[renderLinks] Error:', err);
      return res.render('admin/links', {
        layout: 'admin/layout',
        currentSection: 'links',
        links: [],
        clients: [],
        error: 'Error cargando los Smart Links',
      });
    }
  }
};