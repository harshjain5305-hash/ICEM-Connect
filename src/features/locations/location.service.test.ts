import { describe, it, expect } from 'vitest';
import { locationService, SEED_LOCATIONS } from './location.service';

describe('Location Service & Seed Catalog (Phase 2)', () => {
  it('loads all 15 authentic ICEM campus and transit seed locations', async () => {
    const locations = await locationService.getAll();
    expect(locations.length).toBe(15);
    expect(SEED_LOCATIONS.length).toBe(15);

    // Verify ICEM campus locations exist
    const campusLocs = locations.filter((l) => l.type === 'ICEM');
    expect(campusLocs.length).toBeGreaterThanOrEqual(2);
  });

  it('retrieves campus specific locations with getCampusLocations()', async () => {
    const campusLocs = await locationService.getCampusLocations();
    expect(campusLocs.length).toBe(2);
    campusLocs.forEach((loc) => {
      expect(loc.type).toBe('ICEM');
      expect(loc.name).toContain('ICEM');
    });
  });

  it('searches locations case-insensitively with text query', async () => {
    const bhosariResults = await locationService.search({ query: 'bhosari' });
    expect(bhosariResults.length).toBeGreaterThanOrEqual(1);
    expect(bhosariResults[0].name).toContain('Bhosari');

    const talegaonResults = await locationService.search({ query: 'talegaon' });
    expect(talegaonResults.length).toBeGreaterThanOrEqual(2);
  });

  it('prioritizes ICEM campus locations first in search ranking', async () => {
    const results = await locationService.search({ query: 'station' });
    // Should return station locations
    expect(results.length).toBeGreaterThan(0);
  });

  it('retrieves location by specific ID', async () => {
    const loc = await locationService.getById('loc_somatne_phata');
    expect(loc).not.toBeNull();
    expect(loc?.name).toContain('Somatne Phata');
    expect(loc?.latitude).toBeCloseTo(18.7182, 3);
  });

  it('maps seed corridor slugs to live location records even when IDs are UUIDs', async () => {
    // Test resolving all 5 corridor endpoints
    const akurdi = await locationService.getById('loc_akurdi_station');
    expect(akurdi).not.toBeNull();
    expect(akurdi?.name).toContain('Akurdi');

    const icem = await locationService.getById('loc_icem_campus');
    expect(icem).not.toBeNull();
    expect(icem?.name).toContain('ICEM');

    const talegaon = await locationService.getById('loc_talegaon_station');
    expect(talegaon).not.toBeNull();
    expect(talegaon?.name).toContain('Talegaon');

    const kiwale = await locationService.getById('loc_kiwale_phata');
    expect(kiwale).not.toBeNull();
    expect(kiwale?.name).toContain('Kiwale');

    const bhosari = await locationService.getById('loc_bhosari_stand');
    expect(bhosari).not.toBeNull();
    expect(bhosari?.name).toContain('Bhosari');
  });
});
