// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import test from 'tape-promise/tape';
import '@luma.gl/core';

import DeckGL from 'deck.gl';
import * as deck from 'deck.gl';

import * as layers from '@deck.gl/layers';
import * as aggregationLayers from '@deck.gl/aggregation-layers';
import * as carto from '@deck.gl/carto';
import * as geoLayers from '@deck.gl/geo-layers';
import * as meshLayers from '@deck.gl/mesh-layers';

import * as core from '@deck.gl/core';
import * as json from '@deck.gl/json';
import * as arcgis from '@deck.gl/arcgis';
import * as googleMaps from '@deck.gl/google-maps';
import * as mapbox from '@deck.gl/mapbox';
import * as react from '@deck.gl/react';
import * as testUtils from '@deck.gl/test-utils';

test('Top-level imports', t0 => {
  const hasEmptyExports = obj => {
    for (const key in obj) {
      if (obj[key] === undefined) {
        return key;
      }
    }
    return false;
  };

  t0.test('import "deck.gl"', t => {
    t.notOk(hasEmptyExports(deck), 'No empty top-level export in deck.gl');
    t.notOk(hasEmptyExports(core), 'No empty top-level export in @deck.gl/core');
    t.end();
  });

  t0.test('import layers', t => {
    t.notOk(hasEmptyExports(layers), 'No empty top-level export in @deck.gl/layers');
    t.notOk(
      hasEmptyExports(aggregationLayers),
      'No empty top-level export in @deck.gl/aggregation-layers'
    );
    t.notOk(hasEmptyExports(carto), 'No empty top-level export in @deck.gl/carto');
    t.notOk(hasEmptyExports(geoLayers), 'No empty top-level export in @deck.gl/geo-layers');
    t.notOk(hasEmptyExports(meshLayers), 'No empty top-level export in @deck.gl/mesh-layers');
    t.end();
  });

  t0.test('import utilities', t => {
    t.notOk(hasEmptyExports(json), 'No empty top-level export in @deck.gl/json');
    t.notOk(hasEmptyExports(arcgis), 'No empty top-level export in @deck.gl/arcgis');
    t.notOk(hasEmptyExports(googleMaps), 'No empty top-level export in @deck.gl/google-maps');
    t.notOk(hasEmptyExports(mapbox), 'No empty top-level export in @deck.gl/mapbox');
    t.notOk(hasEmptyExports(react), 'No empty top-level export in @deck.gl/react');
    t.notOk(hasEmptyExports(testUtils), 'No empty top-level export in @deck.gl/test-utils');
    t.end();
  });

  t0.test('selected imports', t => {
    t.ok(deck.Layer, 'Layer symbol imported');
    t.ok(deck.ScatterplotLayer, 'ScatterplotLayer symbol imported');
    t.ok(deck.ScreenGridLayer, 'ScreenGridLayer symbol imported');
    t.ok(deck.ArcLayer, 'ArcLayer symbol imported');
    t.ok(deck.LineLayer, 'LineLayer symbol imported');

    t.ok(Number.isFinite(deck.COORDINATE_SYSTEM.LNGLAT), 'COORDINATE_SYSTEM.LNGLAT imported');
    t.ok(
      Number.isFinite(deck.COORDINATE_SYSTEM.METER_OFFSETS),
      'COORDINATE_SYSTEM.METERS imported'
    );
    t.ok(Number.isFinite(deck.COORDINATE_SYSTEM.CARTESIAN), 'COORDINATE_SYSTEM.CARTESIAN imported');
    t.end();
  });

  t0.test('deck.gl default import', t => {
    t.ok(DeckGL, 'DeckGL symbol imported from /react');
    t.end();
  });

  t0.end();
});

test('deck.gl re-exports', t => {
  const findMissingExports = (source, target) => {
    const missingExports = [];
    for (const key in source) {
      // Exclude experimental exports
      if (key[0] !== '_' && key !== 'experimental' && target[key] !== source[key]) {
        missingExports.push(key);
      }
    }
    return missingExports.length ? missingExports : null;
  };

  t.notOk(findMissingExports(core, deck), 'deck.gl re-exports everything from @deck.gl/core');
  t.notOk(findMissingExports(layers, deck), 'deck.gl re-exports everything from @deck.gl/layers');
  t.notOk(
    findMissingExports(aggregationLayers, deck),
    'deck.gl re-exports everything from @deck.gl/aggregation-layers'
  );
  t.notOk(
    findMissingExports(geoLayers, deck),
    'deck.gl re-exports everything from @deck.gl/geo-layers'
  );
  t.notOk(
    findMissingExports(meshLayers, deck),
    'deck.gl re-exports everything from @deck.gl/mesh-layers'
  );

  t.end();
});
