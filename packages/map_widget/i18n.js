// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

const translations = {
  open: { de: 'Geöffnet', it: 'Aperto', en: 'Open' },
  closed: { de: 'Geschlossen', it: 'Chiuso', en: 'Closed' },

  // GpsInfo.Gpstype
  valleystationpoint: { de: 'Talstation', it: 'Stazione a valle', en: 'Valley station' },
  middlestationpoint: { de: 'Mittelstation', it: 'Stazione intermedia', en: 'Middle station' },
  mountainstationpoint: { de: 'Bergstation', it: 'Stazione a monte', en: 'Mountain station' },

  // Lift types, see liftType() in map_widget.js
  lift_chairlift: { de: 'Sessellift', it: 'Seggiovia', en: 'Chairlift' },
  lift_chairlift_seats: { de: '{n}er-Sessellift', it: 'Seggiovia a {n} posti', en: '{n}-seater chairlift' },
  lift_skilift: { de: 'Schlepplift', it: 'Sciovia', en: 'Ski lift' },
  lift_ropeway: { de: 'Seilbahn', it: 'Funivia', en: 'Aerial tramway' },
  lift_gondola: { de: 'Umlaufbahn', it: 'Cabinovia', en: 'Gondola' },
  lift_cabin: { de: 'Kabinenbahn', it: 'Cabinovia', en: 'Cable car' },
  lift_funicular: { de: 'Standseilbahn', it: 'Funicolare', en: 'Funicular' },
  lift_telemix: { de: 'Kombibahn', it: 'Telemix', en: 'Telemix' },
  lift_carpet: { de: 'Förderband', it: 'Tapis roulant', en: 'Moving carpet' },
  lift_train: { de: 'Zug', it: 'Treno', en: 'Train' },
  lift_bus: { de: 'Skibus', it: 'Skibus', en: 'Ski bus' },
  lift_unknown: { de: 'Aufstiegsanlage', it: 'Impianto di risalita', en: 'Lift' }
};

// Translates a key into the given language (de, it, en), falls back to English, then to the key itself
export function t(key, language, params)
{
  const entry = translations[key];
  if (!entry)
    return key;

  let text = entry[language] || entry.en;
  Object.keys(params || {}).forEach(p => text = text.replace('{' + p + '}', params[p]));
  return text;
}
