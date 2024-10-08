// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

/* eslint-disable func-style, no-console, max-len */
import test from 'tape-promise/tape';

import {
  ScatterplotLayer,
  IconLayer,
  ArcLayer,
  LineLayer,
  GridCellLayer,
  ColumnLayer,
  ScreenGridLayer,
  PointCloudLayer,
  PathLayer
  // TextLayer
} from 'deck.gl';

import * as FIXTURES from 'deck.gl-test/data';

import {testLayer, generateLayerTests, getLayerUniforms} from '@deck.gl/test-utils';

const GRID = [
  {position: [37, 122]},
  {position: [37.1, 122]},
  {position: [37, 122.8]},
  {position: [37.1, 122.8]}
];

test('ScreenGridLayer', t => {
  const testCases = generateLayerTests({
    Layer: ScreenGridLayer,
    sampleProps: {
      data: FIXTURES.points,
      getPosition: d => d.COORDINATES,
      gpuAggregation: false
    },
    assert: t.ok,
    onBeforeUpdate: ({testCase}) => t.comment(testCase.title),
    onAfterUpdate: ({testCase}) => t.comment(testCase.title)
  });

  testLayer({Layer: ScreenGridLayer, testCases, onError: t.notOk});

  t.end();
});

test('ScatterplotLayer', t => {
  const testCases = generateLayerTests({
    Layer: ScatterplotLayer,
    sampleProps: {
      data: FIXTURES.points,
      getPosition: d => d.COORDINATES
    },
    assert: t.ok,
    onBeforeUpdate: ({testCase}) => t.comment(testCase.title),
    onAfterUpdate: ({layer}) => {
      t.is(
        getLayerUniforms(layer).radiusScale,
        layer.props.radiusScale,
        'should update radiusScale'
      );
    }
  });

  testLayer({Layer: ScatterplotLayer, testCases, onError: t.notOk});

  t.end();
});

test('ArcLayer', t => {
  const testCases = generateLayerTests({
    Layer: ArcLayer,
    sampleProps: {
      data: FIXTURES.routes,
      getSourcePosition: d => d.START,
      getTargetPosition: d => d.END
    },
    assert: t.ok,
    onBeforeUpdate: ({testCase}) => t.comment(testCase.title)
  });

  testLayer({Layer: ArcLayer, testCases, onError: t.notOk});

  t.end();
});

test('PointCloudLayer', t => {
  const testCases = generateLayerTests({
    Layer: PointCloudLayer,
    sampleProps: {
      data: FIXTURES.getPointCloud(),
      getPosition: d => d.position
    },
    assert: t.ok,
    onBeforeUpdate: ({testCase}) => t.comment(testCase.title),
    onAfterUpdate: ({layer}) => {
      t.is(getLayerUniforms(layer).pointSize, layer.props.radiusPixels, 'should update pointSize');
    }
  });

  testLayer({Layer: PointCloudLayer, testCases, onError: t.notOk});

  t.end();
});

test('LineLayer', t => {
  const testCases = generateLayerTests({
    Layer: LineLayer,
    sampleProps: {
      data: FIXTURES.routes,
      getSourcePosition: d => d.START,
      getTargetPosition: d => d.END
    },
    assert: t.ok,
    onBeforeUpdate: ({testCase}) => t.comment(testCase.title)
  });

  testLayer({Layer: LineLayer, testCases, onError: t.notOk});

  t.end();
});

test('ColumnLayer', t => {
  const testCases = generateLayerTests({
    Layer: ColumnLayer,
    sampleProps: {
      data: GRID,
      getPosition: d => d.position
    },
    assert: t.ok,
    onBeforeUpdate: ({testCase}) => t.comment(testCase.title),
    onAfterUpdate: ({layer}) => {
      t.ok(layer.state.edgeDistance, 'edgeDistance is populated');
    }
  });

  testLayer({Layer: ColumnLayer, testCases, onError: t.notOk});

  t.end();
});

test('GridCellLayer', t => {
  const testCases = generateLayerTests({
    Layer: GridCellLayer,
    sampleProps: {
      data: GRID,
      getPosition: d => d.position
    },
    assert: t.ok,
    onBeforeUpdate: ({testCase}) => t.comment(testCase.title)
  });

  testLayer({Layer: GridCellLayer, testCases, onError: t.notOk});

  t.end();
});

test('IconLayer', t => {
  /* global document */
  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 24;

  const testCases = generateLayerTests({
    Layer: IconLayer,
    sampleProps: {
      data: FIXTURES.points,
      iconAtlas: canvas,
      iconMapping: {
        marker: {x: 0, y: 0, width: 24, height: 24}
      },
      getPosition: d => d.COORDINATES,
      getIcon: d => 'marker'
    },
    assert: t.ok,
    onBeforeUpdate: ({testCase}) => t.comment(testCase.title)
  });

  testLayer({Layer: IconLayer, testCases, onError: t.notOk});

  t.end();
});

test('PathLayer', t => {
  const testCases = generateLayerTests({
    Layer: PathLayer,
    sampleProps: {
      data: FIXTURES.zigzag,
      getPath: d => d.path,
      getColor: (d, {index}) => [index, 0, 0]
    },
    assert: t.ok,
    onBeforeUpdate: ({testCase}) => t.comment(testCase.title),
    onAfterUpdate: ({layer}) => {
      t.is(
        getLayerUniforms(layer).widthMinPixels,
        layer.props.widthMinPixels,
        'should update widthMinPixels'
      );
      t.ok(layer.getStartIndices(), 'should have vertex layout');
    }
  });

  testLayer({Layer: PathLayer, testCases, onError: t.notOk});

  t.end();
});

/* TextLayer tests don't work under Node due to fontAtlas needing canvas
test('Text#constructor', t => {
  const data = [
    {
      text: 'north',
      coordinates: [0, 100]
    },
    {
      text: 'south',
      coordinates: [0, -100]
    },
    {
      text: 'east',
      coordinates: [100, 0]
    },
    {
      text: 'west',
      coordinates: [-100, 0]
    }
  ];

  testLayer({
    Layer: TextLayer,
    testCases: [
      {props: []},
      {props: null},
      {
        props: {
          data,
          getText: d => d.text,
          getPosition: d => d.coordinates
        }
      },
      {
        updateProps: {
          data: data.slice(0, 2)
        },
        onAfterUpdate({layer, oldState}) {
          t.ok(layer.state.data.length !== oldState.data.length, 'should update state.data');
        }
      }
    ]
  });

  t.end();
});
*/
