// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import type {Device} from '@luma.gl/core';
import PickLayersPass, {PickingColorDecoder} from '../passes/pick-layers-pass';
import {getClosestObject, getUniqueObjects, PickedPixel} from './picking/query-object';
import {
  processPickInfo,
  getLayerPickingInfo,
  getEmptyPickingInfo,
  PickingInfo
} from './picking/pick-info';

import type {Framebuffer} from '@luma.gl/core';
import type {FilterContext, Rect} from '../passes/layers-pass';
import type Layer from './layer';
import type {Effect} from './effect';
import type View from '../views/view';
import type Viewport from '../viewports/viewport';

export type PickByPointOptions = {
  x: number;
  y: number;
  radius?: number;
  depth?: number;
  mode?: string;
  unproject3D?: boolean;
};

export type PickByRectOptions = {
  x: number;
  y: number;
  width?: number;
  height?: number;
  mode?: string;
  maxObjects?: number | null;
};

type PickOperationContext = {
  layers: Layer[];
  views: Record<string, View>;
  viewports: Viewport[];
  onViewportActive: (viewport: Viewport) => void;
  effects: Effect[];
};

/** Manages picking in a Deck context */
export default class DeckPicker {
  device: Device;
  pickingFBO?: Framebuffer;
  depthFBO?: Framebuffer;
  pickLayersPass: PickLayersPass;
  layerFilter?: (context: FilterContext) => boolean;

  /** Identifiers of the previously picked object, for callback tracking and auto highlight */
  lastPickedInfo: {
    index: number;
    layerId: string | null;
    info: PickingInfo | null;
  };

  _pickable: boolean = true;

  constructor(device: Device) {
    this.device = device;
    this.pickLayersPass = new PickLayersPass(device);
    this.lastPickedInfo = {
      index: -1,
      layerId: null,
      info: null
    };
  }

  setProps(props: any): void {
    if ('layerFilter' in props) {
      this.layerFilter = props.layerFilter;
    }

    if ('_pickable' in props) {
      this._pickable = props._pickable;
    }
  }

  finalize() {
    if (this.pickingFBO) {
      this.pickingFBO.destroy();
    }
    if (this.depthFBO) {
      this.depthFBO.destroy();
    }
  }

  /** Pick the closest info at given coordinate */
  pickObject(opts: PickByPointOptions & PickOperationContext) {
    return this._pickClosestObject(opts);
  }

  /** Get all unique infos within a bounding box */
  pickObjects(opts: PickByRectOptions & PickOperationContext) {
    return this._pickVisibleObjects(opts);
  }

  // Returns a new picking info object by assuming the last picked object is still picked
  getLastPickedObject({x, y, layers, viewports}, lastPickedInfo = this.lastPickedInfo.info) {
    const lastPickedLayerId = lastPickedInfo && lastPickedInfo.layer && lastPickedInfo.layer.id;
    const lastPickedViewportId =
      lastPickedInfo && lastPickedInfo.viewport && lastPickedInfo.viewport.id;
    const layer = lastPickedLayerId ? layers.find(l => l.id === lastPickedLayerId) : null;
    const viewport =
      (lastPickedViewportId && viewports.find(v => v.id === lastPickedViewportId)) || viewports[0];
    const coordinate = viewport && viewport.unproject([x - viewport.x, y - viewport.y]);

    const info = {
      x,
      y,
      viewport,
      coordinate,
      layer
    };

    return {...lastPickedInfo, ...info};
  }

  // Private

  /** Ensures that picking framebuffer exists and matches the canvas size */
  _resizeBuffer() {
    // Create a frame buffer if not already available
    if (!this.pickingFBO) {
      this.pickingFBO = this.device.createFramebuffer({
        colorAttachments: ['rgba8unorm'],
        depthStencilAttachment: 'depth16unorm'
      });

      if (this.device.isTextureFormatRenderable('rgba32float')) {
        const depthFBO = this.device.createFramebuffer({
          colorAttachments: ['rgba32float'],
          depthStencilAttachment: 'depth16unorm'
        });
        this.depthFBO = depthFBO;
      }
    }

    // Resize it to current canvas size (this is a noop if size hasn't changed)
    const {canvas} = this.device.getDefaultCanvasContext();
    this.pickingFBO?.resize({width: canvas.width, height: canvas.height});
    this.depthFBO?.resize({width: canvas.width, height: canvas.height});
  }

  /** Preliminary filtering of the layers list. Skid picking pass if no layer is pickable. */
  _getPickable(layers: Layer[]): Layer[] | null {
    if (this._pickable === false) {
      return null;
    }
    const pickableLayers = layers.filter(
      layer => this.pickLayersPass.shouldDrawLayer(layer) && !layer.isComposite
    );
    return pickableLayers.length ? pickableLayers : null;
  }

  /** Pick the closest object at the given coordinate */
  // eslint-disable-next-line max-statements,complexity
  _pickClosestObject({
    layers,
    views,
    viewports,
    x,
    y,
    radius = 0,
    depth = 1,
    mode = 'query',
    unproject3D,
    onViewportActive,
    effects
  }: PickByPointOptions & PickOperationContext): {
    result: PickingInfo[];
    emptyInfo: PickingInfo;
  } {
    // @ts-expect-error TODO - assuming WebGL context
    const pixelRatio = this.device.canvasContext.cssToDeviceRatio();

    const pickableLayers = this._getPickable(layers);

    if (!pickableLayers || viewports.length === 0) {
      return {
        result: [],
        emptyInfo: getEmptyPickingInfo({viewports, x, y, pixelRatio})
      };
    }

    this._resizeBuffer();

    // Convert from canvas top-left to WebGL bottom-left coordinates
    // Top-left coordinates [x, y] to bottom-left coordinates [deviceX, deviceY]
    // And compensate for pixelRatio
    // @ts-expect-error TODO - assuming WebGL context
    const devicePixelRange = this.device.canvasContext.cssToDevicePixels([x, y], true);
    const devicePixel = [
      devicePixelRange.x + Math.floor(devicePixelRange.width / 2),
      devicePixelRange.y + Math.floor(devicePixelRange.height / 2)
    ];

    const deviceRadius = Math.round(radius * pixelRatio);
    const {width, height} = this.pickingFBO as Framebuffer;
    const deviceRect = this._getPickingRect({
      deviceX: devicePixel[0],
      deviceY: devicePixel[1],
      deviceRadius,
      deviceWidth: width,
      deviceHeight: height
    });

    const cullRect: Rect = {
      x: x - radius,
      y: y - radius,
      width: radius * 2 + 1,
      height: radius * 2 + 1
    };

    let infos: Map<string | null, PickingInfo>;
    const result: PickingInfo[] = [];
    const affectedLayers = new Set<Layer>();

    for (let i = 0; i < depth; i++) {
      let pickInfo: PickedPixel;

      if (deviceRect) {
        const pickedResult = this._drawAndSample({
          layers: pickableLayers,
          views,
          viewports,
          onViewportActive,
          deviceRect,
          cullRect,
          effects,
          pass: `picking:${mode}`
        });

        pickInfo = getClosestObject({
          ...pickedResult,
          deviceX: devicePixel[0],
          deviceY: devicePixel[1],
          deviceRadius,
          deviceRect
        });
      } else {
        pickInfo = {
          pickedColor: null,
          pickedObjectIndex: -1
        };
      }

      let z;
      if (pickInfo.pickedLayer && unproject3D && this.depthFBO) {
        const {pickedColors: pickedColors2} = this._drawAndSample(
          {
            layers: [pickInfo.pickedLayer],
            views,
            viewports,
            onViewportActive,
            deviceRect: {
              x: pickInfo.pickedX as number,
              y: pickInfo.pickedY as number,
              width: 1,
              height: 1
            },
            cullRect,
            effects,
            pass: `picking:${mode}:z`
          },
          true
        );
        // picked value is in common space (pixels) from the camera target (viewport.position)
        // convert it to meters from the ground
        if (pickedColors2[3]) {
          z = pickedColors2[0];
        }
      }

      // Only exclude if we need to run picking again.
      // We need to run picking again if an object is detected AND
      // we have not exhausted the requested depth.
      if (pickInfo.pickedLayer && i + 1 < depth) {
        affectedLayers.add(pickInfo.pickedLayer);
        pickInfo.pickedLayer.disablePickingIndex(pickInfo.pickedObjectIndex);
      }

      // This logic needs to run even if no object is picked.
      infos = processPickInfo({
        pickInfo,
        lastPickedInfo: this.lastPickedInfo,
        mode,
        layers: pickableLayers,
        viewports,
        x,
        y,
        z,
        pixelRatio
      });

      for (const info of infos.values()) {
        if (info.layer) {
          result.push(info);
        }
      }

      // If no object is picked stop.
      if (!pickInfo.pickedColor) {
        break;
      }
    }

    // reset only affected buffers
    for (const layer of affectedLayers) {
      layer.restorePickingColors();
    }

    return {result, emptyInfo: infos!.get(null) as PickingInfo};
  }

  /** Pick all objects within the given bounding box */
  // eslint-disable-next-line max-statements
  _pickVisibleObjects({
    layers,
    views,
    viewports,
    x,
    y,
    width = 1,
    height = 1,
    mode = 'query',
    maxObjects = null,
    onViewportActive,
    effects
  }: PickByRectOptions & PickOperationContext): PickingInfo[] {
    const pickableLayers = this._getPickable(layers);

    if (!pickableLayers || viewports.length === 0) {
      return [];
    }

    this._resizeBuffer();

    // Convert from canvas top-left to WebGL bottom-left coordinates
    // And compensate for pixelRatio
    // @ts-expect-error TODO - assuming WebGL context
    const pixelRatio = this.device.canvasContext.cssToDeviceRatio();
    // @ts-expect-error TODO - assuming WebGL context
    const leftTop = this.device.canvasContext.cssToDevicePixels([x, y], true);

    // take left and top (y inverted in device pixels) from start location
    const deviceLeft = leftTop.x;
    const deviceTop = leftTop.y + leftTop.height;

    // take right and bottom (y inverted in device pixels) from end location
    // @ts-expect-error TODO - assuming WebGL context
    const rightBottom = this.device.canvasContext.cssToDevicePixels([x + width, y + height], true);
    const deviceRight = rightBottom.x + rightBottom.width;
    const deviceBottom = rightBottom.y;

    const deviceRect = {
      x: deviceLeft,
      y: deviceBottom,
      // deviceTop and deviceRight represent the first pixel outside the desired rect
      width: deviceRight - deviceLeft,
      height: deviceTop - deviceBottom
    };

    const pickedResult = this._drawAndSample({
      layers: pickableLayers,
      views,
      viewports,
      onViewportActive,
      deviceRect,
      cullRect: {x, y, width, height},
      effects,
      pass: `picking:${mode}`
    });

    const pickInfos = getUniqueObjects(pickedResult);

    // `getUniqueObjects` dedup by picked color
    // However different picked color may be linked to the same picked object, e.g. stroke and fill of the same polygon
    // picked from different sub layers of a GeoJsonLayer
    // Here after resolving the picked index with `layer.getPickingInfo`, we need to dedup again by unique picked objects
    const uniquePickedObjects = new Map<string, Set<unknown>>();
    const uniqueInfos: PickingInfo[] = [];

    const limitMaxObjects = Number.isFinite(maxObjects);

    for (let i = 0; i < pickInfos.length; i++) {
      if (limitMaxObjects && uniqueInfos.length >= maxObjects!) {
        break;
      }
      const pickInfo = pickInfos[i];
      let info: PickingInfo = {
        color: pickInfo.pickedColor,
        layer: null,
        index: pickInfo.pickedObjectIndex,
        picked: true,
        x,
        y,
        pixelRatio
      };

      info = getLayerPickingInfo({layer: pickInfo.pickedLayer as Layer, info, mode});
      // info.layer is always populated because it's a picked pixel
      const pickedLayerId = info.layer!.id;
      if (!uniquePickedObjects.has(pickedLayerId)) {
        uniquePickedObjects.set(pickedLayerId, new Set<unknown>());
      }
      const uniqueObjectsInLayer = uniquePickedObjects.get(pickedLayerId) as Set<unknown>;
      // info.object may be null if the layer is using non-iterable data.
      // Fall back to using index as identifier.
      const pickedObjectKey = info.object ?? info.index;
      if (!uniqueObjectsInLayer.has(pickedObjectKey)) {
        uniqueObjectsInLayer.add(pickedObjectKey);
        uniqueInfos.push(info);
      }
    }

    return uniqueInfos;
  }

  /** Renders layers into the picking buffer with picking colors and read the pixels. */
  _drawAndSample(params: {
    deviceRect: Rect;
    pass: string;
    layers: Layer[];
    views: Record<string, View>;
    viewports: Viewport[];
    onViewportActive: (viewport: Viewport) => void;
    cullRect?: Rect;
    effects: Effect[];
  }): {
    pickedColors: Uint8Array;
    decodePickingColor: PickingColorDecoder;
  };

  /** Renders layers into the picking buffer with encoded z values and read the pixels. */
  _drawAndSample(
    params: {
      deviceRect: Rect;
      pass: string;
      layers: Layer[];
      views: Record<string, View>;
      viewports: Viewport[];
      onViewportActive: (viewport: Viewport) => void;
      cullRect?: Rect;
      effects: Effect[];
    },
    pickZ: true
  ): {
    pickedColors: Float32Array;
    decodePickingColor: null;
  };

  _drawAndSample(
    {
      layers,
      views,
      viewports,
      onViewportActive,
      deviceRect,
      cullRect,
      effects,
      pass
    }: {
      deviceRect: Rect;
      pass: string;
      layers: Layer[];
      views: Record<string, View>;
      viewports: Viewport[];
      onViewportActive: (viewport: Viewport) => void;
      cullRect?: Rect;
      effects: Effect[];
    },
    pickZ: boolean = false
  ): {
    pickedColors: Uint8Array | Float32Array;
    decodePickingColor: PickingColorDecoder | null;
  } {
    const pickingFBO = pickZ ? this.depthFBO : this.pickingFBO;
    const opts = {
      layers,
      layerFilter: this.layerFilter,
      views,
      viewports,
      onViewportActive,
      pickingFBO,
      deviceRect,
      cullRect,
      effects,
      pass,
      pickZ,
      preRenderStats: {},
      isPicking: true
    };

    for (const effect of effects) {
      if (effect.useInPicking) {
        opts.preRenderStats[effect.id] = effect.preRender(opts);
      }
    }

    const {decodePickingColor} = this.pickLayersPass.render(opts);

    // Read from an already rendered picking buffer
    // Returns an Uint8ClampedArray of picked pixels
    const {x, y, width, height} = deviceRect;
    const pickedColors = new (pickZ ? Float32Array : Uint8Array)(width * height * 4);
    this.device.readPixelsToArrayWebGL(pickingFBO as Framebuffer, {
      sourceX: x,
      sourceY: y,
      sourceWidth: width,
      sourceHeight: height,
      target: pickedColors
    });

    return {pickedColors, decodePickingColor};
  }

  // Calculate a picking rect centered on deviceX and deviceY and clipped to device
  // Returns null if pixel is outside of device
  _getPickingRect({
    deviceX,
    deviceY,
    deviceRadius,
    deviceWidth,
    deviceHeight
  }: {
    deviceX: number;
    deviceY: number;
    deviceRadius: number;
    deviceWidth: number;
    deviceHeight: number;
  }): Rect | null {
    // Create a box of size `radius * 2 + 1` centered at [deviceX, deviceY]
    const x = Math.max(0, deviceX - deviceRadius);
    const y = Math.max(0, deviceY - deviceRadius);
    const width = Math.min(deviceWidth, deviceX + deviceRadius + 1) - x;
    const height = Math.min(deviceHeight, deviceY + deviceRadius + 1) - y;

    // x, y out of bounds.
    if (width <= 0 || height <= 0) {
      return null;
    }

    return {x, y, width, height};
  }
}
