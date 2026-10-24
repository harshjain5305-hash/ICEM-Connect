import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Location, LocationSearchInput } from './location.schema';

export const SEED_LOCATIONS: Location[] = [
  {
    id: 'loc_icem_campus',
    name: 'ICEM Main Campus (Parandwadi)',
    type: 'ICEM',
    latitude: 18.7238,
    longitude: 73.6823,
    address: 'Indira College of Engineering & Management, Parandwadi, Talegaon, Pune 410507',
    is_active: true,
  },
  {
    id: 'loc_icem_gate',
    name: 'ICEM College Main Gate & Bus Bay',
    type: 'ICEM',
    latitude: 18.7245,
    longitude: 73.6811,
    address: 'College Campus Gate, Parandwadi Road, Pune',
    is_active: true,
  },
  {
    id: 'loc_somatne_phata',
    name: 'Somatne Phata (Expressway Junction)',
    type: 'MAIN_ROAD',
    latitude: 18.7182,
    longitude: 73.6894,
    address: 'Old Mumbai-Pune Highway / Expressway Interchange',
    is_active: true,
  },
  {
    id: 'loc_talegaon_station',
    name: 'Talegaon Dabhade Railway Station',
    type: 'BUS_STOP',
    latitude: 18.7302,
    longitude: 73.6749,
    address: 'Railway Station Road, Talegaon Dabhade, Pune',
    is_active: true,
  },
  {
    id: 'loc_talegaon_market',
    name: 'Talegaon Station Road & Market',
    type: 'LANDMARK',
    latitude: 18.7315,
    longitude: 73.6781,
    address: 'Station Road Market, Talegaon Dabhade',
    is_active: true,
  },
  {
    id: 'loc_dehu_road',
    name: 'Dehu Road Station Chowk',
    type: 'BUS_STOP',
    latitude: 18.7156,
    longitude: 73.7312,
    address: 'Dehu Road Cantonment, Pune',
    is_active: true,
  },
  {
    id: 'loc_kiwale_phata',
    name: 'Kiwale Phata / Mukai Chowk (BRTS)',
    type: 'MAIN_ROAD',
    latitude: 18.6654,
    longitude: 73.7432,
    address: 'Kiwale, Ravet BRTS Corridor, Pune',
    is_active: true,
  },
  {
    id: 'loc_ravet_bridge',
    name: 'Ravet Chowk / D.Y. Patil Road',
    type: 'AREA',
    latitude: 18.6521,
    longitude: 73.7548,
    address: 'Ravet, Pimpri-Chinchwad, Pune',
    is_active: true,
  },
  {
    id: 'loc_akurdi_station',
    name: 'Akurdi Railway Station Chowk',
    type: 'BUS_STOP',
    latitude: 18.6478,
    longitude: 73.7711,
    address: 'Akurdi Station Road, PCMC, Pune',
    is_active: true,
  },
  {
    id: 'loc_chinchwad_station',
    name: 'Chinchwad Station (Old Highway)',
    type: 'BUS_STOP',
    latitude: 18.6341,
    longitude: 73.7915,
    address: 'Mumbai-Pune Road, Chinchwad, Pune',
    is_active: true,
  },
  {
    id: 'loc_pimpri_chowk',
    name: 'Pimpri Station & Market Chowk',
    type: 'LANDMARK',
    latitude: 18.6258,
    longitude: 73.8052,
    address: 'Dr. Ambedkar Chowk, Pimpri, Pune',
    is_active: true,
  },
  {
    id: 'loc_nigdi_depot',
    name: 'Nigdi Bus Depot / Bhakti Shakti',
    type: 'BUS_STOP',
    latitude: 18.6621,
    longitude: 73.7667,
    address: 'Bhakti Shakti Terminal, Nigdi, Pune',
    is_active: true,
  },
  {
    id: 'loc_bhosari_stand',
    name: 'Bhosari Bus Stand (Alandi Road)',
    type: 'MAIN_ROAD',
    latitude: 18.6214,
    longitude: 73.8441,
    address: 'Pune-Nashik Highway, Bhosari, Pune',
    is_active: true,
  },
  {
    id: 'loc_wakad_bridge',
    name: 'Wakad Flyover / Ginger Chowk',
    type: 'MAIN_ROAD',
    latitude: 18.5998,
    longitude: 73.7654,
    address: 'Hinjewadi-Wakad Road Junction, Pune',
    is_active: true,
  },
  {
    id: 'loc_hinjewadi_phase1',
    name: 'Hinjewadi Shivaji Chowk (Phase 1)',
    type: 'AREA',
    latitude: 18.5912,
    longitude: 73.7389,
    address: 'Rajiv Gandhi Infotech Park Phase 1, Hinjewadi, Pune',
    is_active: true,
  },
];

export const locationService = {
  /**
   * Searches locations by text query and optional type filter.
   * Conforms to Phase 2 deliverable requirement in Phases.md §6.
   */
  async search(params: LocationSearchInput = {}): Promise<Location[]> {
    const { query = '', type, limit = 10 } = params;
    const isLive = isSupabaseConfigured();

    if (isLive) {
      try {
        const { data, error } = await supabase.rpc('search_locations', {
          p_query: query,
          p_type: type,
          p_limit: limit,
        });

        if (!error && data) {
          return data as Location[];
        }

        // Fallback to table select
        let builder = supabase
          .from('locations')
          .select('*')
          .eq('is_active', true);

        if (type) {
          builder = builder.eq('type', type);
        }

        if (query) {
          builder = builder.ilike('name', `%${query}%`);
        }

        const { data: tableData } = await builder.limit(limit);
        if (tableData) return tableData as Location[];
      } catch {
        // Fall back to seed dataset
      }
    }

    // Local / offline / fallback search
    const cleanQuery = query.trim().toLowerCase();

    return SEED_LOCATIONS.filter((loc) => {
      if (!loc.is_active) return false;
      if (type && loc.type !== type) return false;
      if (!cleanQuery) return true;

      const nameMatch = loc.name.toLowerCase().includes(cleanQuery);
      const addrMatch = loc.address ? loc.address.toLowerCase().includes(cleanQuery) : false;
      return nameMatch || addrMatch;
    })
      .sort((a, b) => {
        // Prioritize ICEM campus locations first
        if (a.type === 'ICEM' && b.type !== 'ICEM') return -1;
        if (b.type === 'ICEM' && a.type !== 'ICEM') return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, limit);
  },

  /**
   * Retrieves all active locations.
   */
  async getAll(): Promise<Location[]> {
    return this.search({ limit: 50 });
  },

  /**
   * Retrieves a location by its ID, seed slug, or name.
   */
  async getById(id: string): Promise<Location | null> {
    if (!id) return null;

    // 1. Fetch live active locations (or fallback seed locations)
    const results = await this.search({ limit: 50 });

    // Direct match on ID (e.g. database UUID or seed ID)
    const directMatch = results.find((loc) => loc.id === id);
    if (directMatch) return directMatch;

    // 2. Check if id is a canonical seed key (e.g. 'loc_akurdi_station', 'loc_icem_campus')
    const seed = SEED_LOCATIONS.find((s) => s.id === id);
    if (seed) {
      // Find the corresponding location in live results by name
      const liveByName = results.find(
        (l) => l.name.trim().toLowerCase() === seed.name.trim().toLowerCase()
      );
      if (liveByName) return liveByName;
      return seed;
    }

    // 3. Fallback: check if id matches a location name directly
    const byName = results.find(
      (l) => l.name.trim().toLowerCase() === id.trim().toLowerCase()
    );
    if (byName) return byName;

    // 4. Final fallback to seed locations
    return SEED_LOCATIONS.find((loc) => loc.id === id) || null;
  },

  /**
   * Retrieves designated campus origin/destination locations.
   */
  async getCampusLocations(): Promise<Location[]> {
    return this.search({ type: 'ICEM', limit: 10 });
  },
};
