import { describe, it, expect } from 'vitest';
import { checkBackendHealth } from './healthService';

describe('Backend Health Check (Phase 0 Deliverable)', () => {
  it('should return a structured health report with latency and diagnostics', async () => {
    const report = await checkBackendHealth();

    expect(report).toBeDefined();
    expect(['healthy', 'unconfigured', 'error', 'connecting']).toContain(report.status);
    expect(typeof report.latencyMs).toBe('number');
    expect(report.latencyMs).toBeGreaterThanOrEqual(0);
    expect(report.config).toBeDefined();
    expect(report.config.institutionalDomain).toBe('indiraicem.ac.in');
    expect(typeof report.timestamp).toBe('string');
  });
});
