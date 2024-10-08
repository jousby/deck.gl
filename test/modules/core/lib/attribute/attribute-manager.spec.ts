// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

/* eslint-disable dot-notation, max-statements, no-unused-vars */
import AttributeManager from '@deck.gl/core/lib/attribute/attribute-manager';
import test from 'tape-promise/tape';
import {device} from '@deck.gl/test-utils';

function update(attribute, {data}) {
  const {value, size} = attribute;
  let i = 0;
  for (const object of data) {
    for (let n = 0; n < size; ++n) {
      value[i + n] = i + n;
    }
    i += size;
  }
}

test('AttributeManager imports', t => {
  t.equals(typeof AttributeManager, 'function', 'AttributeManager import successful');
  t.end();
});

test('AttributeManager constructor', t => {
  const attributeManager = new AttributeManager(device);

  t.ok(attributeManager, 'AttributeManager construction successful');
  t.end();
});

test('AttributeManager.add', t => {
  const attributeManager = new AttributeManager(device);

  // Now autodeduced from shader declarations
  // t.throws(
  //   () => attributeManager.add({positions: {update}}),
  //   'AttributeManager.add - throws on missing attribute size'
  // );

  t.throws(
    () => attributeManager.add({positions: {size: 2}}),
    'AttributeManager.add - throws on missing attribute update'
  );

  attributeManager.add({positions: {size: 2, accessor: 'getPosition', update}});
  t.ok(
    attributeManager.getAttributes()['positions'],
    'AttributeManager.add - add attribute successful'
  );
  t.deepEquals(
    attributeManager.updateTriggers,
    {positions: ['positions'], getPosition: ['positions']},
    'AttributeManager.add - build update triggers mapping'
  );
  attributeManager.addInstanced({instancePositions: {size: 2, accessor: 'getPosition', update}});
  t.equals(
    attributeManager.getAttributes()['instancePositions'].settings.stepMode,
    'instance',
    'AttributeManager.addInstanced creates attribute with stepMode:instance'
  );
  t.end();
});

test('AttributeManager.update', t => {
  const attributeManager = new AttributeManager(device);
  attributeManager.add({positions: {size: 2, update}});

  let attribute;

  // First update, should autoalloc and update the value array
  attributeManager.update({
    numInstances: 1,
    data: [{}]
  });

  attribute = attributeManager.getAttributes()['positions'];
  t.ok(ArrayBuffer.isView(attribute.value), 'attribute has typed array');
  t.equals(attribute.value[1], 1, 'attribute value is correct');

  // Second update without invalidation, should not update
  attribute.value[1] = 2;

  attributeManager.update({
    numInstances: 1,
    data: [{}]
  });

  attribute = attributeManager.getAttributes()['positions'];
  t.ok(ArrayBuffer.isView(attribute.value), 'attribute has typed array');
  t.equals(attribute.value[1], 2, 'Second update, attribute value was not changed');

  // Third update, with invalidation, should update
  attributeManager.invalidateAll();
  attributeManager.update({
    numInstances: 1,
    data: [{}]
  });

  attribute = attributeManager.getAttributes()['positions'];
  t.ok(ArrayBuffer.isView(attribute.value), 'attribute has typed array');
  t.equals(attribute.value[1], 1, 'Third update, attribute value was updated');

  t.end();
});

test('AttributeManager.update - 0 numInstances', t => {
  const attributeManager = new AttributeManager(device);
  attributeManager.add({positions: {size: 2, update}});

  // First update, should autoalloc and update the value array
  attributeManager.update({
    numInstances: 0,
    data: []
  });

  const attribute = attributeManager.getAttributes()['positions'];
  t.ok(ArrayBuffer.isView(attribute.value), 'attribute has typed array');

  t.end();
});

test('AttributeManager.update - constant attribute', t => {
  const attributeManager = new AttributeManager(device);
  let updateCalled = 0;
  attributeManager.add({
    colors: {
      size: 3,
      update: (attr, {numInstances, data, props}) => {
        updateCalled++;
        if (Array.isArray(props.getColor)) {
          attr.constant = true;
          attr.value = props.getColor;
        } else {
          for (let i = 0, j = 0; i < numInstances; i++) {
            const color = props.getColor(data[i]);
            attr.value[j++] = color[0];
            attr.value[j++] = color[1];
            attr.value[j++] = color[2];
          }
        }
      }
    }
  });

  const attribute = attributeManager.getAttributes()['colors'];
  attribute.constant = true;
  attribute.value = [0, 1, 0];

  // First update, should set constant value
  attributeManager.update({
    numInstances: 2,
    props: {getColor: [0.5, 0.75, 0.125]},
    data: [1, 2]
  });

  t.is(updateCalled, 0, 'should not call updater for constant attribute');
  t.is(attribute.state.allocatedValue, null, 'should not allocate for constant attribute');
  t.ok(attribute.state.constant, 'constant value is set');

  attribute.constant = false;
  attributeManager.invalidate('colors');

  // second update, should autoalloc and update the value array
  attributeManager.update({
    numInstances: 2,
    props: {getColor: [0.5, 0.75, 0.125]},
    data: [1, 2]
  });

  t.is(updateCalled, 1, 'updater is called');
  t.ok(attribute.state.allocatedValue, 'should allocate new value array');
  t.deepEqual(attribute.value, [0.5, 0.75, 0.125], 'correct attribute value');
  t.ok(attribute.state.constant, 'constant value is set');

  attributeManager.invalidate('colors');

  // third update, should autoalloc and update the value array
  attributeManager.update({
    numInstances: 2,
    props: {getColor: x => [x, x, x]},
    data: [1, 2]
  });

  t.is(updateCalled, 2, 'updater is called');
  t.deepEqual(attribute.value.slice(0, 6), [1, 1, 1, 2, 2, 2], 'correct attribute value');
  t.notOk(attribute.state.constant, 'no longer a constant');

  t.end();
});

test('AttributeManager.update - external virtual buffers', t => {
  const attributeManager = new AttributeManager(device);

  const dummyUpdate = () => t.fail('updater should not be called when external buffer is present');

  attributeManager.add({
    positions: {size: 2, update: dummyUpdate},
    colors: {size: 3, type: 'uint8', update: dummyUpdate}
  });

  // First update, should autoalloc and update the value array
  attributeManager.update({
    numInstances: 1,
    buffers: {
      positions: new Float32Array([0, 0]),
      colors: new Uint8ClampedArray([0, 0, 0])
    }
  });

  let attribute = attributeManager.getAttributes()['positions'];
  t.ok(ArrayBuffer.isView(attribute.value), 'positions attribute has typed array');
  attribute = attributeManager.getAttributes()['colors'];
  t.ok(ArrayBuffer.isView(attribute.value), 'colors attribute has typed array');

  attributeManager.update({
    numInstances: 1,
    buffers: {
      positions: new Float32Array([0, 0]),
      colors: new Float32Array([0, 0, 0])
    }
  });

  t.is(
    attribute.getBufferLayout().attributes[0].format,
    'float32x3',
    'colors is set to correct format'
  );

  attributeManager.update({
    numInstances: 1,
    buffers: {
      positions: new Float32Array([0, 0]),
      colors: new Uint32Array([0, 0, 0])
    }
  });
  t.is(
    attribute.getBufferLayout().attributes[0].format,
    'uint32x3',
    'colors is set to correct format'
  );

  t.end();
});

test('AttributeManager.update - external logical buffers', t => {
  const attributeManager = new AttributeManager(device);

  const dummyAccessor = () =>
    t.fail('accessor should not be called when external buffer is present');

  attributeManager.add({
    positions: {size: 2, accessor: 'getPosition'},
    colors: {size: 4, type: 'uint8', accessor: 'getColor', defaultValue: [0, 0, 0, 255]},
    types: {size: 1, accessor: 'getType', transform: x => x - 65}
  });

  // First update, should autoalloc and update the value array
  attributeManager.update({
    numInstances: 2,
    data: {length: 2},
    props: {
      getPosition: dummyAccessor,
      getColor: dummyAccessor,
      getType: dummyAccessor
    },
    buffers: {
      getPosition: new Float32Array([1, 1, 2, 2]),
      getColor: {value: new Uint8ClampedArray([255, 0, 0, 0, 255, 0]), size: 3},
      getType: new Uint8Array([65, 68])
    }
  });

  let attribute = attributeManager.getAttributes()['positions'];
  t.deepEqual(attribute.value, [1, 1, 2, 2], 'positions attribute has value');

  t.is(attribute.getVertexOffset(0), 0, 'getVertexOffset returns correct result');
  t.is(attribute.getVertexOffset(1), 2, 'getVertexOffset returns correct result');
  t.is(attribute.getVertexOffset(2), 4, 'getVertexOffset returns correct result');

  attribute = attributeManager.getAttributes()['colors'];
  t.deepEqual(attribute.value, [255, 0, 0, 0, 255, 0], 'colors attribute has value');
  t.is(attribute.getAccessor().size, 3, 'colors attribute has correct size');

  attribute = attributeManager.getAttributes()['types'];
  t.deepEqual(attribute.value.slice(0, 2), [0, 3], 'types attribute has value');

  t.end();
});

test('AttributeManager.update - external logical buffers - variable width', t => {
  const attributeManager = new AttributeManager(device);

  const dummyAccessor = () =>
    t.fail('accessor should not be called when external buffer is present');

  attributeManager.add({
    positions: {size: 2, accessor: 'getPosition'},
    colors: {size: 4, type: 'uint8', accessor: 'getColor', defaultValue: [0, 0, 0, 255]}
  });

  // First update, should autoalloc and update the value array
  attributeManager.update({
    numInstances: 3,
    startIndices: [0, 2],
    data: {
      length: 2,
      vertexStarts: [0, 1]
    },
    props: {
      getPosition: dummyAccessor,
      getColor: dummyAccessor
    },
    buffers: {
      getPosition: new Float32Array([1, 1, 2, 2]),
      getColor: {value: new Uint8ClampedArray([255, 0, 0, 0, 255, 0]), size: 3}
    }
  });

  let attribute = attributeManager.getAttributes()['positions'];
  t.deepEqual(attribute.value.slice(0, 6), [1, 1, 1, 1, 2, 2], 'positions attribute has value');

  t.is(attribute.getVertexOffset(0), 0, 'getVertexOffset returns correct result');
  t.is(attribute.getVertexOffset(1), 4, 'getVertexOffset returns correct result');
  t.is(attribute.getVertexOffset(2), 6, 'getVertexOffset returns correct result');

  attribute = attributeManager.getAttributes()['colors'];
  t.deepEqual(
    attribute.value.slice(0, 12),
    [255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255],
    'colors attribute has value'
  );

  t.end();
});

test('AttributeManager.invalidate', t => {
  const attributeManager = new AttributeManager(device);
  attributeManager.add({positions: {size: 2, update}});
  attributeManager.add({colors: {size: 2, accessor: 'getColor', update}});
  attributeManager.update({
    numInstances: 1,
    data: [{}]
  });

  attributeManager.invalidate('positions');
  t.ok(attributeManager.getAttributes()['positions'].needsUpdate, 'invalidated attribute by name');

  attributeManager.invalidate('getColor');
  t.ok(
    attributeManager.getAttributes()['colors'].needsUpdate,
    'invalidated attribute by accessor name'
  );

  t.end();
});

test('AttributeManager.getBufferLayouts', t => {
  const attributeManager = new AttributeManager(device);
  attributeManager.add({
    // indexed attribute
    indices: {size: 1, isIndexed: true, update},
    // non-instanced attribute
    colors: {size: 4, type: 'unorm8', stepMode: 'vertex', accessor: 'getColor'},
    // instanced attribute
    instanceColors: {size: 4, type: 'unorm8', stepMode: 'instance', accessor: 'getColor'},
    // dynamically assigned stepMode
    positions: {size: 3, type: 'float64', fp64: true, stepMode: 'dynamic', accessor: 'getPosition'}
  });

  t.deepEqual(
    attributeManager.getBufferLayouts(),
    [
      {
        name: 'indices',
        byteStride: 4,
        attributes: [
          {
            attribute: 'indices',
            format: 'uint32',
            byteOffset: 0
          }
        ],
        stepMode: 'vertex'
      },
      {
        name: 'colors',
        byteStride: 4,
        attributes: [
          {
            attribute: 'colors',
            format: 'unorm8x4',
            byteOffset: 0
          }
        ],
        stepMode: 'vertex'
      },
      {
        name: 'instanceColors',
        byteStride: 4,
        attributes: [
          {
            attribute: 'instanceColors',
            format: 'unorm8x4',
            byteOffset: 0
          }
        ],
        stepMode: 'instance'
      },
      {
        name: 'positions',
        byteStride: 24,
        attributes: [
          {
            attribute: 'positions',
            format: 'float32x3',
            byteOffset: 0
          },
          {
            attribute: 'positions64Low',
            format: 'float32x3',
            byteOffset: 12
          }
        ],
        stepMode: 'instance'
      }
    ],
    'getBufferLayouts()'
  );

  t.is(
    attributeManager.getBufferLayouts({isInstanced: false})[3].stepMode,
    'vertex',
    'dynamic attribute.stepMode in nonInstancedModel'
  );
  t.is(
    attributeManager.getBufferLayouts({isInstanced: true})[3].stepMode,
    'instance',
    'dynamic attribute.stepMode in instancedModel'
  );

  t.end();
});
