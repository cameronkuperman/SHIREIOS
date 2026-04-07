import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTableCommand,
  createRuntime,
  createSnapshot,
  runDeterministicScenarioStep,
  runRandomAiStep,
} from './runtime.ts';

test('seat commands emit canonical occupied updates', () => {
  const runtime = createRuntime('2026-03-07T12:00:00.000Z');
  const result = applyTableCommand(runtime, {
    type: 'seat_walk_in',
    commandId: 'command-1',
    floorId: runtime.floorId,
    tableId: '2',
    requestedAt: '2026-03-07T12:01:00.000Z',
    party: {
      id: 'walk-in-1',
      name: 'Taylor',
      size: 2,
      source: 'walk_in',
    },
  });

  assert.equal(result.message.type, 'table.updated');
  if (result.message.type !== 'table.updated') {
    return;
  }

  assert.equal(result.message.table.state, 'occupied');
  assert.equal(result.message.table.currentPartyName, 'Taylor');
  assert.equal(result.message.source, 'host');
  assert.equal(result.message.commandId, 'command-1');
  assert.equal(result.runtime.tablesById['2']?.displayStatus, 'occupied');
});

test('snapshot shape stays aligned with runtime tables', () => {
  const runtime = createRuntime('2026-03-07T12:00:00.000Z');
  const snapshot = createSnapshot(runtime, '2026-03-07T12:02:00.000Z');

  assert.equal(snapshot.floorId, runtime.floorId);
  assert.equal(Object.keys(snapshot.tablesById ?? {}).length, Object.keys(runtime.tablesById).length);
  assert.equal(snapshot.sequence, runtime.sequence);
});

test('deterministic scenario includes block and unblock transitions', () => {
  let runtime = createRuntime('2026-03-07T12:00:00.000Z');

  for (let step = 0; step < 6; step += 1) {
    runtime = runDeterministicScenarioStep(runtime, '2026-03-07T12:05:00.000Z').runtime;
  }

  assert.equal(runtime.tablesById.P2?.isBlocked, true);
  runtime = runDeterministicScenarioStep(runtime, '2026-03-07T12:06:00.000Z').runtime;
  assert.equal(runtime.tablesById.P2?.isBlocked, false);
});

test('ai steps emit ML-tagged updates without command ids', () => {
  const runtime = createRuntime('2026-03-07T12:00:00.000Z');
  const result = runRandomAiStep(runtime, '2026-03-07T12:03:00.000Z');

  assert.equal(result.message.type, 'table.updated');
  assert.equal(result.message.source, 'ml');
  assert.equal(result.message.commandId, null);
});
