import test from 'node:test';
import assert from 'node:assert/strict';
import { metricEvent, publicMetricArea } from '../src/lib/aggregateMetricsPolicy.ts';

test('metric dimensions are bounded and contain no paths, identifiers, or free text', () => {
  assert.deepEqual(metricEvent({ area: 'APPS', metric: 'VIEW', bucket: 'COUNT' }), { area: 'APPS', metric: 'VIEW', bucket: 'COUNT' });
  assert.equal(publicMetricArea('/order/private-invoice'), null);
  assert.equal(publicMetricArea('/admin/apps'), null);
  assert.equal(publicMetricArea('/apps/capcut'), 'APPS_DETAIL');
  assert.equal(publicMetricArea('/roblox?token=secret'), null);
  for (const body of [{ area: 'APPS', metric: 'VIEW', bucket: 'COUNT', email: 'x' }, { area: '/order/12', metric: 'VIEW', bucket: 'COUNT' }, { area: 'APPS', metric: 'PAID', bucket: 'COUNT' }]) assert.throws(() => metricEvent(body));
  assert.deepEqual(metricEvent({ area: 'APPS', metric: 'LCP', bucket: 'GOOD' }), { area: 'APPS', metric: 'LCP', bucket: 'GOOD' });
  assert.throws(() => metricEvent({ area: 'APPS', metric: 'VIEW', bucket: 'GOOD' }));
});
