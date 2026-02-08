import {
  createMetricsStore,
  metricsLogger as sharedMetricsLogger,
  getRecentMetrics as sharedGetRecentMetrics,
  getAggregatedStats as sharedGetAggregatedStats,
  getSuspiciousRequests as sharedGetSuspiciousRequests,
  getRequestsByIP as sharedGetRequestsByIP,
  resetMetrics as sharedResetMetrics,
  type MetricsStore,
  type RequestMetric,
  type AggregatedStats,
} from '@codex/shared';
import { getUser } from './auth.js';

export type { RequestMetric, AggregatedStats, MetricsStore };

export const metricsStore: MetricsStore = createMetricsStore(1000);

export function metricsLogger(serviceName: string) {
  return sharedMetricsLogger(serviceName, {
    store: metricsStore,
    getUserId: (c) => getUser(c)?.id,
  });
}

export function getRecentMetrics(limit = 100): RequestMetric[] {
  return sharedGetRecentMetrics(metricsStore, limit);
}

export function getAggregatedStats(): AggregatedStats {
  return sharedGetAggregatedStats(metricsStore);
}

export function getSuspiciousRequests(limit = 50): RequestMetric[] {
  return sharedGetSuspiciousRequests(metricsStore, limit);
}

export function getRequestsByIP(ip: string, limit = 50): RequestMetric[] {
  return sharedGetRequestsByIP(metricsStore, ip, limit);
}

export function resetMetrics() {
  sharedResetMetrics(metricsStore);
}
