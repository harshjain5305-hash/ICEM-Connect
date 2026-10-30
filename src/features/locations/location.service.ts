import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Location, LocationSearchInput, CreateLocationInput, UpdateLocationInput } from './location.schema';
import { STORAGE_KEYS, getLocalData, saveLocalData } from '@/lib/localStorage';

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

function getMergedLocalLocations(): Location[] {
  const custom = getLocalData<Location>(STORAGE_KEYS.LOCATIONS);
  const map = new Map<string, Location>();

  for (const s of SEED_LOCATIONS) {
    map.set(s.id, { ...s });
  }

  for (const [id, loc] of Object.entries(custom)) {
    map.set(id, loc);
  }

  return Array.from(map.values());
}

export const locationService = {
  /**
   * Searches locations by text query and optional type filter.
   * Conforms to Phase 2 deliverable requirement in Phases.md §6.
   */
  async search(params: LocationSearchInput = {}): Promise<Location[]> {
    const { query = '', type, limit = 50 } = params;
    const isLive = isSupabaseConfigured();

    if (isLive) {
      try {
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

        const { data: tableData, error } = await builder.limit(limit);
        if (!error && tableData && tableData.length > 0) {
          return tableData as Location[];
        }
      } catch {
        // Fall back to local dataset
      }
    }

    // Local / offline / fallback search
    const cleanQuery = query.trim().toLowerCase();
    const source = getMergedLocalLocations();

    return source.filter((loc) => {
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
    return this.search({ limit: 100 });
  },

  /**
   * Retrieves all locations (including inactive) for administrative management.
   */
  async listAll(): Promise<Location[]> {
    const isLive = isSupabaseConfigured();
    if (isLive) {
      try {
        const { data, error } = await supabase
          .from('locations')
          .select('*')
          .order('name', { ascending: true });
        if (!error && data && data.length > 0) {
          return data as Location[];
        }
      } catch (err) {
        console.warn('Live listAll locations error:', err);
      }
    }

    return getMergedLocalLocations().sort((a, b) => a.name.localeCompare(b.name));
  },

  /**
   * Creates a new location / waypoint.
   */
  async createLocation(input: CreateLocationInput): Promise<Location> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      try {
        const { data, error } = await supabase
          .from('locations')
          .insert({
            name: input.name.trim(),
            type: input.type,
            latitude: input.latitude,
            longitude: input.longitude,
            address: input.address?.trim() || null,
            is_active: input.is_active ?? true,
          })
          .select('*')
          .single();

        if (!error && data) {
          return data as Location;
        }
      } catch (err) {
        console.warn('Live createLocation error, persisting locally:', err);
      }
    }

    // Local mode / fallback
    const newId = `loc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newLocation: Location = {
      id: newId,
      name: input.name.trim(),
      type: input.type,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address?.trim() || null,
      is_active: input.is_active ?? true,
    };

    const custom = getLocalData<Location>(STORAGE_KEYS.LOCATIONS);
    custom[newId] = newLocation;
    saveLocalData(STORAGE_KEYS.LOCATIONS, custom);

    return newLocation;
  },

  /**
   * Updates an existing location.
   */
  async updateLocation(id: string, updates: UpdateLocationInput): Promise<Location> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      try {
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (updates.name !== undefined) payload.name = updates.name.trim();
        if (updates.type !== undefined) payload.type = updates.type;
        if (updates.latitude !== undefined) payload.latitude = updates.latitude;
        if (updates.longitude !== undefined) payload.longitude = updates.longitude;
        if (updates.address !== undefined) payload.address = updates.address?.trim() || null;
        if (updates.is_active !== undefined) payload.is_active = updates.is_active;

        const { data, error } = await supabase
          .from('locations')
          .update(payload)
          .eq('id', id)
          .select('*')
          .single();

        if (!error && data) {
          return data as Location;
        }
      } catch (err) {
        console.warn('Live updateLocation error, falling back to local:', err);
      }
    }

    // Local / fallback mode
    const custom = getLocalData<Location>(STORAGE_KEYS.LOCATIONS);
    const existing = custom[id] || SEED_LOCATIONS.find((s) => s.id === id);
    if (!existing) {
      throw new Error(`Location with ID ${id} not found`);
    }

    const updated: Location = {
      ...existing,
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      address: updates.address !== undefined ? updates.address?.trim() || null : existing.address,
    };

    custom[id] = updated;
    saveLocalData(STORAGE_KEYS.LOCATIONS, custom);

    return updated;
  },

  /**
   * Toggles active status of a location.
   */
  async toggleActive(id: string, isActive: boolean): Promise<Location> {
    return this.updateLocation(id, { is_active: isActive });
  },

  /**
   * Retrieves a location by its ID, seed slug, or name.
   */
  async getById(id: string): Promise<Location | null> {
    if (!id) return null;

    // 1. Fetch live active locations (or fallback seed locations)
    const results = await this.getAll();

    // Direct match on ID (e.g. database UUID or seed ID)
    const directMatch = results.find((loc) => loc.id === id);
    if (directMatch) return directMatch;

    // 2. Check in merged local locations
    const merged = getMergedLocalLocations();
    const localMatch = merged.find((loc) => loc.id === id);
    if (localMatch) return localMatch;

    // 3. Fallback: check if id matches a location name directly
    const byName = results.find(
      (l) => l.name.trim().toLowerCase() === id.trim().toLowerCase()
    );
    if (byName) return byName;

    return null;
  },

  /**
   * Retrieves designated campus origin/destination locations.
   */
  async getCampusLocations(): Promise<Location[]> {
    return this.search({ type: 'ICEM', limit: 10 });
  },
};
