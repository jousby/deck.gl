// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import test from 'tape-promise/tape';
import {geojsonToBinary} from '@loaders.gl/gis';
import {processPickInfo} from '@deck.gl/core/lib/picking/pick-info';
import {LayerManager, WebMercatorViewport, DeckRenderer} from '@deck.gl/core';
import {ScatterplotLayer, GeoJsonLayer} from '@deck.gl/layers';
import {MVTLayer} from '@deck.gl/geo-layers';
import {device} from '@deck.gl/test-utils';

import {equals} from '@math.gl/core';

const testLayer = new ScatterplotLayer({
  id: 'test-layer',
  data: ['a', 'b'],
  getPosition: d => [0, 0],
  autoHighlight: true
});

const testLayerWithCallback = new ScatterplotLayer({
  id: 'test-layer-with-callback',
  data: ['a', 'b'],
  getPosition: d => [0, 0],
  autoHighlight: true,
  highlightColor: ({object}) => (object === 'b' ? [255, 0, 0] : [0, 255, 0])
});

const testCompositeLayer = new GeoJsonLayer({
  id: 'test-composite-layer',
  data: [{type: 'Feature', geometry: {type: 'Point', coordinates: [0, 0]}}]
});

const geoJSONData = [
  {
    id: 12,
    type: 'Feature',
    geometry: {type: 'Point', coordinates: [0, 0]},
    properties: {layerName: 'layerA'}
  },
  {
    id: 12,
    type: 'Feature',
    geometry: {type: 'Point', coordinates: [0, 0]},
    properties: {layerName: 'layerB'}
  }
];

class TestMVTLayer extends MVTLayer {
  getTileData() {
    return this.props.data;
  }
}

TestMVTLayer.layerName = 'TestMVTLayer';

const testMVTLayer = new TestMVTLayer({
  id: 'test-mvt-layer',
  autoHighlight: true,
  binary: false,
  data: geoJSONData
});

const geoJSONBinaryData = geojsonToBinary(JSON.parse(JSON.stringify(geoJSONData)));
geoJSONBinaryData.points.fields = geoJSONData.map(({id}) => ({id}));

const testMVTLayerBinary = new TestMVTLayer({
  id: 'test-mvt-layer-binary',
  autoHighlight: true,
  binary: true,
  data: geoJSONBinaryData
});

const parameters = {
  mode: 'hover',
  viewports: [
    new WebMercatorViewport({
      id: 'map1',
      longitude: -122,
      latitude: 38,
      zoom: 1,
      width: 200,
      height: 200
    }),
    new WebMercatorViewport({
      id: 'map2',
      longitude: -122,
      latitude: 38,
      zoom: 1,
      x: 200,
      y: 0,
      width: 200,
      height: 200
    }),
    new WebMercatorViewport({
      id: 'minimap',
      longitude: -100,
      latitude: 40,
      zoom: 1,
      x: 250,
      y: 50,
      width: 100,
      height: 100
    })
  ],
  layers: [testLayer, testLayerWithCallback, testCompositeLayer, testMVTLayer, testMVTLayerBinary],
  pixelRatio: 2
};

function validateUniforms(actual, expected) {
  for (const key in expected) {
    if (!equals(actual[key], expected[key])) {
      return {key, expected: expected[key], actual: actual[key]};
    }
  }
  return null;
}

/* eslint-disable max-statements */
test('processPickInfo', async t => {
  const layerManager = new LayerManager(device, {viewport: parameters.viewports[0]});
  layerManager.setProps({onError: t.notOk});
  const deckRenderer = new DeckRenderer(device);

  layerManager.setLayers(parameters.layers);

  while (!parameters.layers.every(l => l.isLoaded)) {
    layerManager.updateLayers();

    deckRenderer.renderLayers({
      viewports: [layerManager.context.viewport],
      layers: layerManager.getLayers(),
      onViewportActive: layerManager.activateViewport
    });
    await sleep(100);
  }

  const TEST_CASES = [
    {
      pickInfo: {
        pickedColor: null,
        pickedLayer: null,
        pickedObjectIndex: -1
      },
      x: 100,
      y: 100,
      size: 1,
      info: {layer: null, index: -1, picked: false, x: 100, coordinate: [-122, 38]},
      lastPickedInfo: {layerId: null, index: -1},
      testLayerPickingUniforms: {isHighlightActive: false}
    },
    {
      pickInfo: {
        pickedColor: [1, 0, 0, 0],
        pickedLayer: testLayer,
        pickedObjectIndex: 0
      },
      x: 100,
      y: 100,
      size: 2,
      info: {layer: testLayer, object: 'a', index: 0, picked: true, x: 100, coordinate: [-122, 38]},
      lastPickedInfo: {layerId: 'test-layer', index: 0},
      testLayerPickingUniforms: {isHighlightActive: true, highlightedObjectColor: [1, 0, 0]}
    },
    {
      pickInfo: {
        pickedColor: [2, 0, 0, 0],
        pickedLayer: testLayer,
        pickedObjectIndex: 1
      },
      x: 100,
      y: 100,
      size: 2,
      info: {layer: testLayer, object: 'b'},
      lastPickedInfo: {layerId: 'test-layer', index: 1},
      testLayerPickingUniforms: {isHighlightActive: true, highlightedObjectColor: [2, 0, 0]}
    },
    {
      pickInfo: {
        pickedColor: [1, 0, 0, 0],
        pickedLayer: testLayerWithCallback,
        pickedViewports: parameters.viewports.slice(0, 2),
        pickedObjectIndex: 0
      },
      x: 100,
      y: 100,
      size: 3,
      info: {
        layer: testLayerWithCallback,
        object: 'a',
        index: 0,
        picked: true,
        x: 100,
        coordinate: [-122, 38]
      },
      lastPickedInfo: {layerId: 'test-layer-with-callback', index: 0},
      testLayerPickingUniforms: {isHighlightActive: false},
      currentLayerPickingUniforms: {
        isHighlightActive: true,
        highlightedObjectColor: [1, 0, 0],
        highlightColor: [0, 1, 0, 1]
      }
    },
    {
      pickInfo: {
        pickedColor: [2, 0, 0, 0],
        pickedLayer: testLayerWithCallback,
        pickedViewports: parameters.viewports.slice(0, 2),
        pickedObjectIndex: 1
      },
      x: 100,
      y: 100,
      size: 2,
      info: {layer: testLayerWithCallback, object: 'b'},
      lastPickedInfo: {layerId: 'test-layer-with-callback', index: 1},
      testLayerPickingUniforms: {isHighlightActive: false},
      currentLayerPickingUniforms: {
        isHighlightActive: true,
        highlightedObjectColor: [2, 0, 0],
        highlightColor: [1, 0, 0, 1]
      }
    },
    {
      pickInfo: {
        pickedColor: [1, 0, 0, 0],
        pickedLayer: testCompositeLayer.getSubLayers()[0],
        pickedObjectIndex: 0
      },
      x: 100,
      y: 100,
      size: 3,
      info: {
        layer: testCompositeLayer,
        object: {type: 'Feature', geometry: {type: 'Point', coordinates: [0, 0]}}
      },
      lastPickedInfo: {layerId: 'test-composite-layer-points-circle', index: 0},
      testLayerPickingUniforms: {isHighlightActive: false}
    },
    {
      pickInfo: {
        pickedColor: [1, 0, 0, 0],
        pickedLayer: testMVTLayer.getSubLayers()[0].getSubLayers()[0],
        pickedObjectIndex: 0
      },
      x: 100,
      y: 100,
      size: 2,
      info: {
        layer: testMVTLayer,
        object: {
          id: 12,
          type: 'Feature',
          geometry: {type: 'Point'},
          properties: {layerName: 'layerA'}
        }
      },
      highlightedObjectIndex: 0,
      lastPickedInfo: {layerId: 'test-mvt-layer-0-0-1-points-circle', index: 0},
      testLayerPickingUniforms: {isHighlightActive: false}
    },
    {
      pickInfo: {
        pickedColor: [2, 0, 0, 0],
        pickedLayer: testMVTLayer.getSubLayers()[0].getSubLayers()[0],
        pickedObjectIndex: 1
      },
      x: 100,
      y: 100,
      size: 2,
      info: {
        layer: testMVTLayer,
        object: {
          id: 12,
          type: 'Feature',
          geometry: {type: 'Point'},
          properties: {layerName: 'layerB'}
        }
      },
      highlightedObjectIndex: 1,
      lastPickedInfo: {layerId: 'test-mvt-layer-0-0-1-points-circle', index: 1},
      testLayerPickingUniforms: {isHighlightActive: false}
    },
    {
      pickInfo: {
        pickedColor: [1, 0, 0, 0],
        pickedLayer: testMVTLayerBinary.getSubLayers()[0].getSubLayers()[0],
        pickedObjectIndex: 0
      },
      x: 100,
      y: 100,
      size: 2,
      info: {
        layer: testMVTLayerBinary,
        object: {
          id: 12,
          type: 'Feature',
          geometry: {type: 'Point'},
          properties: {layerName: 'layerA'}
        }
      },
      highlightedObjectIndex: 0,
      lastPickedInfo: {layerId: 'test-mvt-layer-binary-0-0-1-points-circle', index: 0},
      testLayerPickingUniforms: {isHighlightActive: false}
    },
    {
      pickInfo: {
        pickedColor: [2, 0, 0, 0],
        pickedLayer: testMVTLayerBinary.getSubLayers()[0].getSubLayers()[0],
        pickedObjectIndex: 1
      },
      x: 100,
      y: 100,
      size: 2,
      info: {
        layer: testMVTLayerBinary,
        object: {
          id: 12,
          type: 'Feature',
          geometry: {type: 'Point'},
          properties: {layerName: 'layerB'}
        }
      },
      highlightedObjectIndex: 1,
      lastPickedInfo: {layerId: 'test-mvt-layer-binary-0-0-1-points-circle', index: 1},
      testLayerPickingUniforms: {isHighlightActive: false}
    },
    {
      pickInfo: {
        pickedColor: [1, 0, 0, 0],
        pickedLayer: testLayer,
        pickedObjectIndex: 0
      },
      x: 300,
      y: 100,
      size: 2,
      info: {layer: testLayer, object: 'a', index: 0, picked: true, x: 300, coordinate: [-100, 40]},
      lastPickedInfo: {layerId: 'test-layer', index: 0},
      testLayerPickingUniforms: {isHighlightActive: true, highlightedObjectColor: [1, 0, 0]}
    },
    {
      pickInfo: {
        pickedColor: [2, 0, 0, 0],
        pickedLayer: testLayerWithCallback,
        pickedViewports: parameters.viewports.slice(0, 2),
        pickedObjectIndex: 1
      },
      x: 300,
      y: 100,
      size: 3,
      info: {layer: testLayerWithCallback, object: 'b', x: 300, coordinate: [-122, 38]},
      lastPickedInfo: {layerId: 'test-layer-with-callback', index: 1},
      testLayerPickingUniforms: {isHighlightActive: false, highlightedObjectColor: [1, 0, 0]}
    },
    {
      pickInfo: {
        pickedColor: [0, 0, 0, 0],
        pickedLayer: null,
        pickedObjectIndex: -1
      },
      x: -1,
      y: -1,
      size: 2,
      info: {layer: testLayerWithCallback, x: -1, viewport: parameters.viewports[0]},
      lastPickedInfo: {layerId: null, index: -1},
      testLayerPickingUniforms: {isHighlightActive: false, highlightedObjectColor: [1, 0, 0]}
    }
  ];

  const lastPickedInfo = {};
  parameters.lastPickedInfo = lastPickedInfo;

  let testLayerPickingUniforms, currentLayerPickingUniforms;

  for (const testCase of TEST_CASES) {
    parameters.pickInfo = testCase.pickInfo;
    parameters.x = testCase.x;
    parameters.y = testCase.y;
    const infos = processPickInfo(parameters);
    t.is(infos.size, testCase.size, 'returns expected infos');

    const info = infos.get(testCase.info.layer && testCase.info.layer.id);

    for (const key in testCase.info) {
      const expected = testCase.info[key];
      if (Number.isFinite(expected) || Array.isArray(expected)) {
        t.ok(equals(info[key], expected), `info.${key}`);
      } else {
        t.deepEqual(info[key], expected, `info.${key}`);
      }
    }
    for (const key in testCase.lastPickedInfo) {
      t.deepEqual(lastPickedInfo[key], testCase.lastPickedInfo[key], `lastPickedInfo.${key}`);
    }
    testLayerPickingUniforms = testLayer.getModels()[0].shaderInputs.getUniformValues().picking;
    t.notOk(
      validateUniforms(testLayerPickingUniforms, testCase.testLayerPickingUniforms),
      'testLayerPickingUniforms'
    );
    if (testCase.currentLayerPickingUniforms) {
      currentLayerPickingUniforms = testCase.pickInfo.pickedLayer
        .getModels()[0]
        .shaderInputs.getUniformValues().picking;
      t.notOk(
        validateUniforms(currentLayerPickingUniforms, testCase.currentLayerPickingUniforms),
        'currentLayerPickingUniforms'
      );
    }

    if (testCase.highlightedObjectIndex !== undefined) {
      const renderedLayer = info.layer.renderLayers()[0][0];
      const {highlightedObjectIndex} = renderedLayer.props;
      t.deepEqual(highlightedObjectIndex, testCase.highlightedObjectIndex, 'highlightObjectIndex');
    }
  }

  layerManager.finalize();

  t.end();
});

function sleep(ms) {
  return new Promise(resolve => {
    /* global setTimeout */
    setTimeout(resolve, ms);
  });
}
