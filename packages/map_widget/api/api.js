import axios from "axios";
import config from "./config";

export function callGet(domain, path, params) {
	console.log("call = " + domain + path);
	console.log("call params = ");
	console.log(params);
	return axios
		.get(domain + path, {
			params: params
		})
		.then(function(response) {
			console.log("call response = ");
			console.log(response.data);
			console.log(response.config);
			return response.data;
		})
		.catch(function(error) {
			console.log(error.response);
			throw error;
		});
}

export async function fetchStations(type) {
	console.log(type)
	return callGet(config.API_BASE_URL_MOBILITY, "/flat/" + (type || '*'), {
			limit: -1,
			select: "scode,stype,sname,sorigin,scoordinate,smetadata,pcode",
			where: "scoordinate.neq.null,sactive.eq.true",
			distinct: true
		})
		.then(response => {
			this.nodes = response.data;
		})
		.catch(e => {
			console.log(e)
			throw e;
		});
	}

export async function fetchActivities(type, language) {	
		return callGet(config.API_BASE_URL_TOURISM,"/Activity", {
			pagesize: 12000,
			activitytype: type,
			fields: "Id,GpsInfo,Type,SubType,IsOpen,GpsTrack,Detail." + language +".Title,Detail." + language + ".BaseText",
			active: true,
			language: language
		})
		.then(response => {			
			this.nodes = response.Items;
		})
		.catch(e => {
			console.log(e)
			throw e;
		});
}

export async function fetchSkiAreas(language) {	
	return callGet(config.API_BASE_URL_TOURISM,"/SkiArea", {
		fields: "Id,Latitude,Longitude,SkiRegionName." + language + ",Detail." + language +".Title,Detail." + language + ".BaseText,ContactInfos" +  language + 
				",Active,OperationSchedule[0].Start,OperationSchedule[0].Stop" +
				",TotalSlopeKm,SlopeKmBlue,SlopeKmRed,SlopeKmBlack,LiftCount",
		active: true,
		language: language
	})
	.then(response => {			
		this.nodes = response;
	})
	.catch(e => {
		console.log(e)
		throw e;
	});
}