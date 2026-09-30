// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Single colour palette for everything drawn on the map.
 * Lines (Leaflet paths) use these values directly, markers and popups
 * get them as CSS custom properties (see cssVariables).
 */
const colors = {
  // Neutrals
  ink: '#1e293b',          // text, dark outlines
  inkMuted: '#64748b',     // secondary text
  closed: '#94a3b8',       // anything closed / inactive
  surface: '#ffffff',      // marker fill, line casing, popup background

  // Lift infrastructure and ski areas (one teal family)
  lift: '#155e75',         // lift lines, station rings
  skiarea: '#0e7490',      // ski area badge

  // Status
  open: '#15803d',

  // Slopes, standard piste colours by Ratings.Difficulty
  slopeEasy: '#2563eb',      // 2 blue
  slopeMedium: '#dc2626',    // 4 red
  slopeDifficult: '#111827', // 6 black
  slopeUnrated: '#64748b'
};

export function slopeColor(difficulty)
{
  switch (String(difficulty))
  {
    case "2": return colors.slopeEasy;
    case "4": return colors.slopeMedium;
    case "6": return colors.slopeDifficult;
    default: return colors.slopeUnrated;
  }
}

// ":host { --color-ink: #1e293b; ... }" for the component stylesheet
export function cssVariables()
{
  const vars = Object.keys(colors)
    .map(key => '--color-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + ': ' + colors[key] + ';')
    .join(' ');
  return ':host { ' + vars + ' }';
}

export default colors;
