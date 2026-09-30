// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

export default {	
	API_BASE_URL_TOURISM: process.env.TOURISM_BASE_PATH,
	ORIGIN: 'webcomp-tourism-skiareas',
	// Proxy for KML tracks (e.g. dolomitisuperski.com), the track url is appended.
	// Switched off while dolomitisuperski.com (Cloudflare) blocks the proxy, KML files are then loaded directly.
	// Set USE_KML_PROXY back to true once the proxy works again.
	USE_KML_PROXY: false,
	KML_PROXY: 'https://images.opendatahub.testingmachine.eu/api/ODHProxyCustomCached/kml/'
};
