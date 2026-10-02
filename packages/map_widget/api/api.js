// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import axios from "axios";
import config from "./config";

export function callGet(domain, path, params) {
	// console.log("call = " + domain + path);
	// console.log("call params = ");
	// console.log(params);
	return axios
		.get(domain + path, {
			params: params
		})
		.then(function(response) {
			//console.log("call response = ");
			//console.log(response.data);
			//console.log(response.config);
			return response.data;
		})
		.catch(function(error) {
			console.log(error.response);
			throw error;
		});
}

// Legacy activitytype bitmask values mapped to tag filters
const legacyTypeTags = {
	"256": "slopes",
	"512": "lifts",
	"768": "slopes,lifts"
};

export async function fetchActivities(tags, language, source) {
		return callGet(config.API_BASE_URL_TOURISM,"/ODHActivityPoi", {
			pagesize: 12000,
			tagfilter: legacyTypeTags[tags] || tags,
			fields: "Id,GpsInfo,Tags,TagIds,IsOpen,GpsTrack,Detail." + language +".Title,Detail." + language + ".BaseText,Source,SmgTags,Ratings.Difficulty,AdditionalPoiInfos",
			active: true,
			language: language,
			source: source,
			origin: config.ORIGIN
		})
		.then(response => {			
			this.nodes = response.Items;
		})
		.catch(e => {
			console.log(e)
			throw e;
		});
}

export async function fetchMeasuringpoints(type, language) {	
	return callGet(config.API_BASE_URL_TOURISM,"/Weather/Measuringpoint", {
		fields: "Id,Latitude,Longitude,LastUpdate,SnowHeight,newSnowHeight,Temperature,Active,LastSnowDate,Shortname",
		origin: config.ORIGIN
	})
	.then(response => {			
		this.nodes = response.Items;
	})
	.catch(e => {
		console.log(e)
		throw e;
	});
}

export async function fetchSkiAreas(language, source) {	
	return callGet(config.API_BASE_URL_TOURISM,"/SkiArea", {
		fields: "Id,Latitude,Longitude,SkiRegionName." + language + ",Detail." + language +".Title,Detail." + language + ".BaseText,ContactInfos" +  language + 
				",Active,OperationSchedule[0].Start,OperationSchedule[0].Stop" +
				",TotalSlopeKm,SlopeKmBlue,SlopeKmRed,SlopeKmBlack,LiftCount,Geo,Source,SkiRegionId",
		active: true,
		language: language,
		source: source,
		origin: config.ORIGIN
	})
	.then(response => {			
		this.nodes = response;
	})
	.catch(e => {
		console.log(e)
		throw e;
	});
}