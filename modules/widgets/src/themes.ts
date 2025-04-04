// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

/**
 * A Deck Theme is a set of CSS variables that control CSS styling of the official widgets.
 */
export type DeckWidgetTheme = {
  '--button-background': string;
  '--button-stroke': string;
  '--button-inner-stroke': string;
  '--button-shadow': string;
  '--button-backdrop-filter': string;
  '--button-icon-idle': string;
  '--button-icon-hover': string;
  '--icon-compass-north-color': string;
  '--icon-compass-south-color': string;
};

export const LightTheme = {
  '--button-background': '#fff',
  '--button-stroke': 'rgba(255, 255, 255, 0.3)',
  '--button-inner-stroke': 'unset',
  '--button-shadow': '0px 0px 8px 0px rgba(0, 0, 0, 0.25)',
  '--button-backdrop-filter': 'unset',
  '--button-icon-idle': 'rgba(97, 97, 102, 1)',
  '--button-icon-hover': 'rgba(24, 24, 26, 1)',
  '--icon-compass-north-color': '#F05C44',
  '--icon-compass-south-color': '#C2C2CC'
} as const satisfies DeckWidgetTheme;

export const DarkTheme = {
  '--button-background': 'rgba(18, 18, 20, 1)',
  '--button-stroke': 'rgba(18, 18, 20, 0.30)',
  '--button-inner-stroke': 'unset',
  '--button-shadow': '0px 0px 8px 0px rgba(0, 0, 0, 0.25)',
  '--button-backdrop-filter': 'unset',
  '--button-icon-idle': 'rgba(158, 157, 168, 1)',
  '--button-icon-hover': 'rgba(215, 214, 229, 1)',
  '--icon-compass-north-color': '#F05C44',
  '--icon-compass-south-color': '#C2C2CC'
} as const satisfies DeckWidgetTheme;

export const LightGlassTheme = {
  '--button-background': 'rgba(255, 255, 255, 0.6)',
  '--button-stroke': 'rgba(255, 255, 255, 0.3)',
  '--button-inner-stroke': '1px solid rgba(255, 255, 255, 0.6)',
  '--button-shadow':
    '0px 0px 8px 0px rgba(0, 0, 0, 0.25), 0px 0px 8px 0px rgba(0, 0, 0, 0.1) inset',
  '--button-backdrop-filter': 'blur(4px)',
  '--button-icon-idle': 'rgba(97, 97, 102, 1)',
  '--button-icon-hover': 'rgba(24, 24, 26, 1)',
  '--icon-compass-north-color': '#F05C44',
  '--icon-compass-south-color': '#C2C2CC'
} as const satisfies DeckWidgetTheme;

export const DarkGlassTheme = {
  '--button-background': 'rgba(18, 18, 20, 0.75)',
  '--button-stroke': 'rgba(18, 18, 20, 0.30)',
  '--button-inner-stroke': '1px solid rgba(18, 18, 20, 0.75)',
  '--button-shadow':
    '0px 0px 8px 0px rgba(0, 0, 0, 0.25), 0px 0px 8px 0px rgba(0, 0, 0, 0.1) inset',
  '--button-backdrop-filter': 'blur(4px)',
  '--button-icon-idle': 'rgba(158, 157, 168, 1)',
  '--button-icon-hover': 'rgba(215, 214, 229, 1)',
  '--icon-compass-north-color': '#F05C44',
  '--icon-compass-south-color': '#C2C2CC'
} as const satisfies DeckWidgetTheme;
