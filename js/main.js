var config = {
	feedbackLayer: {
		url: "http://maps.raleighnc.gov/arcgis/rest/services/Planning/UDO_Feedback/FeatureServer/0"
	},
	current: {
		url: "http://iriskgis.ncem.org/arcgis/rest/services/FRIS_FloodZones/MapServer",
		layerIds: [1]
	},
	preliminary: {
		url: "http://iriskgis.ncem.org/arcgis/rest/services/NCPRELIM/FRIS_FloodZones/MapServer",
		layerIds: [1]
	},
	changes: {
		url: "http://iriskgis.ncem.org/arcgis/rest/services/FRIS_CSLF_Floodway/MapServer",
		layerIds: [0]
	},
	parcels: {
		url: "http://maps.raleighnc.gov/arcgis/rest/services/Parcels/MapServer"
	},
	addresses: {
		url: "http://maps.raleighnc.gov/arcgis/rest/services/Addresses/MapServer"
	},
	geometry: {
		url: "http://maps.raleighnc.gov/arcgis/rest/services/Utilities/Geometry/GeometryServer"
	}
}

$(document).ready(function () {
	var current,
	proposed,
	listeners = [],
	mapPoint,
	feedbackLayer,
	json,
	types,
	locMarkersC,
	locMarkersP,
	addressText = "",
	lastAction = "",
	info = {},
	propGj,
	currentInfo = [],
	prelimInfo = [],
	legend = {};

	function setMapView(point) {
		current.setView([point.y, point.x], 16);
		proposed.setView([point.y, point.x], 16);
	}

	function getInfo(point) {
		info = {};
		_gaq.push(['_trackEvent', 'Search', 'Location', '"coordinates":['+point.x+', '+point.y+']']);
		updateLocation(point);
		updateLocationMarkers(point);
		searchParcel(point);
	}

	function mapClickHandler (e) {
		lastAction = "click";
		var point = {x: e.latlng.lng, y: e.latlng.lat};
		_gaq.push(['_trackEvent', 'Search', 'Type', 'Map Click']);
		getInfo(point);
	}

	function addMapClick () {
		proposed.on("click", mapClickHandler);
		current.on("click", mapClickHandler);
	}

	function removeMapClick() {
		proposed.off("click", mapClickHandler);
		current.off("click", mapClickHandler);
	}

	function showAddressAlert (address) {
		var mql = window.matchMedia("(max-width: 992px)");
		$("#addressAlert").css("visibility", "visible");
		$("#addressAlert").show();
		$("#addressAlert strong").text(address);
	}

	function retrievedParcel(data) {
		$("#searchInput").typeahead('val', '');
		if (data.results.length > 0) {
			var geom = data.results[0].geometry;
				addressText = data.results[0].attributes['Site Address'];
				updateLocationText();
				propGj = L.esri.Util.arcgisToGeojson(data.results[0].geometry);
				L.geoJson(propGj).addTo(locMarkersC);
				L.geoJson(propGj).addTo(locMarkersP);
				getCurrentFema (propGj);
			} else {
				if (lastAction === "click") {
					addressText = "Right-of-Way";
				}
				updateLocationText();
			}
		}
		function searchParcel(point) {
			$.ajax({url: config.parcels.url + "/identify",
			dataType: "json",
			data: {
				geometry: point.x + ',' + point.y,
				geometryType: 'esriGeometryPoint',
				sr: 4236,
				tolerance: 3,
				layers: "all:0,1",
				mapExtent: point.x-1 +","+point.y-1+","+point.x+1+","+point.y+1,
				imageDisplay: proposed.getSize().x+","+ proposed.getSize().y+",96",
				returnGeometry: true,
				f: "json"
			}
		}).done(retrievedParcel);
	}
	function getCurrentFema (gj) {
		currentInfo = [];
		prelimInfo = [];
		var q = L.esri.Tasks.query({url:config.current.url + '/1'}).intersects(L.geoJson(gj));
		q.run(function (error, fc, response) {
			var intersect = null,
			desc = {};
			$.each(fc.features, function (i, f) {
				intersect = turf.intersect(f, propGj);
				intersect.properties = f.properties;
				intersect.properties.area = turf.area(intersect);
				desc = getDescription(intersect.properties.ZONE_LID_VALUE);

				var val = $(currentInfo).filter(function () {
					return this.value === intersect.properties.ZONE_LID_VALUE;
				});
				if (val.length > 0) {
					val[0].area += intersect.properties.area;
				} else {
					currentInfo.push({value: intersect.properties.ZONE_LID_VALUE, label: desc.label, description: desc.description, area: intersect.properties.area});
				}
			});
			getPrelimFema(propGj);
		});
	}

	function compare(a,b) {
		if (a.label < b.label)
		return -1;
		if (a.label > b.label)
		return 1;
		return 0;
	}

	function getPrelimFema (gj) {
		var q = L.esri.Tasks.query({url:config.preliminary.url + '/1'}).intersects(L.geoJson(gj));
		q.run(function (error, fc, response) {
			var intersect = null,
			desc = {};
			$.each(fc.features, function (i, f) {
				intersect = turf.intersect(f, propGj);
				intersect.properties = f.properties;
				intersect.properties.area = turf.area(intersect);
				desc = getDescription(intersect.properties.ZONE_LID_VALUE);

				var val = $(prelimInfo).filter(function () {
					return this.value === intersect.properties.ZONE_LID_VALUE;
				});
				if (val.length > 0) {
					val[0].area += intersect.properties.area;
				} else {
					prelimInfo.push({value: intersect.properties.ZONE_LID_VALUE, label: desc.label, description: desc.description, area: intersect.properties.area});
				}
			});
			currentInfo = currentInfo.sort(compare);
			prelimInfo = prelimInfo.sort(compare);

			reportInfo(currentInfo, prelimInfo);
			console.log(currentInfo);
			console.log(prelimInfo);
		});
	}

	function reportInfo (currentInfo, prelimInfo) {
		clearAllInfo();
		buildCurrentFemaInfo(currentInfo);
		buildPrelimFemaInfo(prelimInfo);
	}

	function getDescription (value) {
		var desc = {};
		var arr = $(json).filter(function () {
			return this.value === value;
		});

		if (arr.length > 0) {
			desc = arr[0];
		}
		return desc;
	}

	function buildCurrentFemaInfo (info) {
		var div = $("#currentInfo");
		if (info.length === 0) {
			div.append('<p class="lead">Property does not fall within a floodzone</p>');
		}
		var desc = {};
		$(info).each(function (i, data) {
			div.append('<p class="lead">' + data.label + '</p>');
			div.append('<p>' + (data.area * 0.000247105).toFixed(2) + ' acres</p>');
			div.append('<p>' + data.description + '</p>');
		});
	}

	function getDifferenceLabel (data) {
		var label = "";
		var arr = $(currentInfo).filter(function () {
			return this.label === data.label;
		});
		if (arr.length > 0) {
			var diff = ((data.area * 0.000247105) - (arr[0].area * 0.000247105)).toFixed(2);
			var className = "";
			if (diff === 0.00) {
				className = 'primary';
			} else if (diff < 0.00) {
				className = 'danger';
			} else if (diff > 0.00) {
				className = 'success';
				diff = "+" + diff;
			}

			label  ='<span class="label label-' + className + '">' + diff + '</span>';

		} else {
			label = '<span class="label label-success">' + (data.area * 0.000247105).toFixed(2) + '</span>';
		}
		return label;
	}

	function buildPrelimFemaInfo (info) {
		var div = $("#proposedInfo");
		if (info.length === 0) {
			div.append('<p class="lead">Property does not fall within a floodzone</p>');
		}
		$(info).each(function (i, data) {
			div.append('<p class="lead">' + data.label + '</p>');
			div.append('<p>' + (data.area * 0.000247105).toFixed(2) + ' acres ' + getDifferenceLabel(data) + '</p>');
			div.append('<p>' + data.description + '</p>');
		});
	}

	function updateLocationMarkers(point) {
		var icon = L.icon({
			iconUrl: 'img/location.png',
			iconSize: [14,14]
		});
		locMarkersC.clearLayers();
		locMarkersC.addLayer(L.marker([point.y, point.x], {icon:icon}));
		locMarkersP.clearLayers();
		locMarkersP.addLayer(L.marker([point.y, point.x], {icon:icon}));
	}

	function updateLocationText() {
		$("#location").html(addressText);
		showAddressAlert(addressText);
	}
	function updateLocation (point) {
		var lngLat = [point.x, point.y];
		mapPoint = point;
		//$("#locMessage").text(Math.round(lngLat[1]* 1000)/1000 + ", " + Math.round(lngLat[0]* 1000)/1000);
		updateLocationMarkers(point);
		updateLocationText();
		$("#addPointButton").html('	Change  <span class="glyphicon glyphicon-pushpin"></span>');
	}

	function setLocationHandler (e) {
		updateLocation({x: e.latlng.lng, y: e.latlng.lat});
		$("#mapModal").modal("toggle");
		proposed.off("click", setLocationHandler);
		$("#currentMap").css("opacity", 1);
		addMapClick();
	}

	function clearAllInfo () {
		$("#currentDesc").empty();
		$("#currentInfo").empty();
		$("#proposedDesc").empty();
		$("#proposedInfo").empty();
	}

	function displayPoint (point, type) {
		lastAction = "search";
		_gaq.push(['_trackEvent', 'Search', type]);
		getInfo(point);
		setMapView(point);
	}
	function searchByAddress (data) {
		$.ajax({
			url: config.addresses.url + "/1/query",
			type: 'GET',
			dataType: 'json',
			data: {f: 'json',
			where: "ADDRESS = '" + data.value + "'",
			returnGeometry: true,
			outSR: 4326
		},
	})
	.done(function(data) {
		if (data.features.length > 0) {
			var point = data.features[0].geometry;
			displayPoint(point, "Address");
		}
	});
}

/*function searchByPIN (data) {
	$.ajax({
		url: config.parcels.url + "/0/query",
		type: 'GET',
		dataType: 'json',
		data: {f: 'json',
		where: "PIN_NUM = '" + data.value + "'",
		returnGeometry: true,
		outSR: 4326
	},
})
.done(function(data) {
	$.ajax({
		url: config.geometry.url + '/labelPoints',
		type: 'POST',
		dataType: 'json',
		data: {f: 'json',
		polygons: '[' + JSON.stringify(data.features[0].geometry) + ']',
		sr: 4326
	},
})
.done(function(data) {
	if (data.labelPoints.length > 0) {
		var point = data.labelPoints[0];
		displayPoint(point, 'PIN');
	}
});
});
}*/

function typeaheadSelected (obj, data, dataset) {
	if (dataset === "Addresses") {
		searchByAddress(data);
	} else if (dataset === "PIN") {
		searchByPIN(data);
	}
}
function addressFilter (resp) {
	var data = []
	if (resp.features.length > 0) {
		$(resp.features).each(function (i, f) {
			data.push({value:f.attributes['ADDRESS']});
		});
	}
	return data;
}

/*function pinFilter (resp) {
	var data = []
	if (resp.features.length > 0) {
		$(resp.features).each(function (i, f) {
			data.push({value:f.attributes.PIN_NUM});
		});
	}

	return data;
}*/
function setTypeahead () {
	var addresses = new Bloodhound({
		datumTokenizer: function (datum) {
			return Bloodhound.tokenizers.whitespace(datum.value);
		},
		queryTokenizer: Bloodhound.tokenizers.whitespace,
		remote: {
			url: config.addresses.url + "/1/query?orderByFields=ADDRESS&returnGeometry=false&outFields=ADDRESS&returnDistinctValues=false&f=json",
			filter: addressFilter,
			replace: function(url, uriEncodedQuery) {
				var newUrl = url + '&where=ADDRESS like ' + "'" + uriEncodedQuery.toUpperCase() +"%'";
				return newUrl;
			}
		}
	});
/*	var pin = new Bloodhound({
		datumTokenizer: function (datum) {
			return Bloodhound.tokenizers.whitespace(datum.value);
		},
		queryTokenizer: Bloodhound.tokenizers.whitespace,
		remote: {
			url: config.parcels.url + "/1/query?orderByFields=PIN_NUM&returnGeometry=false&outFields=PIN_NUM&returnDistinctValues=true&f=json",
			filter: pinFilter,
			replace: function (url, uriEncodedQuery) {
				var newUrl = url + "&where=PIN_NUM LIKE '" + uriEncodedQuery + "%' OR PIN_NUM LIKE '0" + parseInt(uriEncodedQuery).toString() + "%'";
				return newUrl;
			}
		}
	});*/
	addresses.initialize();
	//pin.initialize();
	$("#searchInput").typeahead({hint: true, highlight: true, minLength: 1},
		{name:'Addresses',
		displayKey:'value',
		source:addresses.ttAdapter()/*,
		templates: {
			header: "<h5>Addresses</h5>"
		}*/}/*,
		{name:'PIN',
		displayKey:'value',
		source:pin.ttAdapter(),
		templates: {
			header: "<h5>PIN</h5>"
		}}*/).on("typeahead:selected", typeaheadSelected);
	};

	setTypeahead();

	$(".btn-group>ul>li").click(function () {
		if ($(this).index() > 0 || mapPoint) {
			$("#"+$(this).data("modal")).modal("show");
		} else {
			$("#warningModal").modal("show");
		}
	});

	$("#addPointButton").click(function () {
		$("#mapModal").modal("toggle");
		$("#currentMap").css("opacity", 0.3);
		removeMapClick();
		proposed.on("click", setLocationHandler);
	});


	//validation error functions//
	function placeErrors (error, element) {
		var group = $(element).closest('.form-group div').addClass("has-error");
		$('.help-block', group).remove();
		group.append("<span class='help-block'>"+error.text()+"</span>");
	}

	function removeErrors (label, element) {
		var group = $(element).closest('.form-group div').removeClass("has-error");
		$('.help-block', group).remove();
	}

	function submitForm () {
		var edit = {geometry: mapPoint,
			attributes: {
				"NAME":$("#inputName").val(),
				"EMAIL":$("#inputEmail").val(),
				"ADDRESS":$("#location").text(),
				"OWN":$('.btn-group[name="owner"]>label.active').index(),
				"FEEDBACK":$("#commentArea").val(),
				"TYPE":$("option:selected", "#typeSelect").val(),
				"PROPOSED":$("#proposedDesc span").text(),
				"EXISTING":$("#currentDesc span").text()
			}
		};
		$.ajax({
			url: config.feedbackLayer.url + '/addFeatures',
			type: 'POST',
			dataType: 'json',
			data: {f: 'json',
			features: JSON.stringify([edit])
		},
	})
	.done(function(e) {
		var result = e.addResults[0];
		if (result.success) {
			$.ajax({
				url: "php/mail.php",
				type: "GET",
				data: {
					name: $("#inputName").val(),
					email: $("#inputEmail").val(),
					type: $("option:selected", "#typeSelect").text(),
					feedback: $("#commentArea").val(),
					location: $("#location").text(),
					id: result.objectId
				}
			});
			$("#mapModal").modal("toggle");
			$("#inputName").val("");
			$("#inputEmail").val("");
			$("#confirmEmail").val("");
			$("#commentArea").val("");
			$("#typeSelect").prop("selectedIndex", 0);
			locMarkersP.clearLayers();
			locMarkersC.clearLayers();
			feedbackLayer.refresh();
		}

	});
}

$.validator.addMethod("radioActive", function(value, element) {
	return $(".active", element).length > 0;
}, "Selection required");

$.validator.addMethod("confirmEmail", function (value, element) {
	return value === $("#inputEmail").val();
}, "Email address does not match");

$('form').validate({
	ignore: [],
	rules: {
		name: {
			required: true,
			maxlength: 50
		},
		email: {
			required: true,
			email: true,
			maxlength: 50
		},
		confirmEmail: {
			required: true,
			email: true,
			confirmEmail: true,
			maxlength: 50
		},
		address: {
			required: true,
			maxlength: 100
		},
		comment: {
			required: true,
			maxlength: 1000
		},
		owner: {
			radioActive: true
		}
	},
	submitHandler: submitForm,
	errorPlacement: placeErrors,
	success: removeErrors
});


function getFeedbackType (type) {
	var arr = $(types).filter(function () {
		return this.code === type;
	});
	return (arr.length > 0) ? arr[0].name : type;
}

function popupLinkClicked () {
	$("#popupModal .modal-title").text($(this).data('title'));
	$("#popupModal .modal-body").text($(this).data('full'));
	$("#popupModal").modal('show');
}

function buildPopup(feature) {
	var popup = $("<div></div>");
	var content = "",
	fullFeedback = "",
	fullResponse = "";

	popup.append("<strong>Category</strong> "+getFeedbackType(feature.properties.TYPE)+"<br/>");

	if (feature.properties.FEEDBACK.length > 200) {
		popup.append("<strong>Feedback </strong><span>"+feature.properties.FEEDBACK.substring(0,200)+"...</span>");
		var fbPopup = $('<a class="popup-link" href="javascript:void(0)" data-title="Feedback" data-full="'+feature.properties.FEEDBACK.replace(/"/g, '&quot;')+'"> View More</a>').appendTo(popup);
		fbPopup.click(popupLinkClicked);
		popup.append("</span><br/>");
	} else {
		popup.append("<strong>Feedback </strong><span>"+feature.properties.FEEDBACK+"<br/>");
	}

	if (feature.properties.CREATE_DATE) {
		var submitted = moment(new Date(feature.properties.CREATE_DATE)).format('MMMM Do YYYY, h:mm a');
		popup.append("<strong>Submitted</strong> "+submitted.toString()+"<br/>");
	}

	if (feature.properties.RESPONDED) {
		if (feature.properties.RESPONSE.length > 200) {
			popup.append("<strong>Response </strong><span>"+feature.properties.RESPONSE.substring(0,200)+"...</span>");
			var rePopup = $('<a class="popup-link" href="javascript:void(0)" data-title="Response" data-full="'+feature.properties.RESPONSE.replace(/"/g, '&quot;')+'"> View More</a>').appendTo(popup);
			rePopup.click(popupLinkClicked);
			popup.append("</span><br/>");
		} else {
			popup.append("<strong>Response </strong><span>"+feature.properties.RESPONSE+"<br/>");
		}
	}

	if (feature.properties.RESPONSE_DATE) {
		if (feature.properties.RESPONSE_DATE != feature.properties.CREATE_DATE){
			var responded = moment(new Date(feature.properties.RESPONSE_DATE)).format('MMMM Do YYYY, h:mm a');
			popup.append("<strong>Responded</strong> "+responded.toString());
		}
	}
	return popup;
}

function feedbackLayerLoaded (e) {
	$(e.metadata.fields).each(function (i, f) {
		if (f.name === "TYPE") {
			if (f.domain.type === "codedValue") {
				types = f.domain.codedValues;
				$(f.domain.codedValues).each(function (i, cv) {
					$("#typeSelect").append("<option value='"+cv.code+"'>"+cv.name+"</option>");
				});
			}
		}
	});
}

function buildLegend (legend) {
	var div = $(".legend-col"),
	idx = 0;
	$(legend).each(function (i, layer) {
		idx = (i < 6) ? 0 : 1;
		$(div[idx]).append("<div class='legend-item'><img src='data:image/png;base64," + layer.imageData +"' alt=''/><span>"+ layer.label +"</span></div>");
	});
}

function getLegend(url) {
	return $.ajax({
		url: url + '/legend',
		type: 'GET',
		dataType: 'json',
		data: {f: 'json'},
	})
	.done(function(data) {
		legend = data.layers[1].legend;
		buildLegend(legend);
	});
}

$("#closeWarning").click(function () {
	$(".browser-warning").hide();
});
$(".glyphicon-question-sign").tooltip();
$(".feedback").tooltip();
current = L.map('currentMap', {minZoom: 10}).setView([35.81889, -78.64447], 11);
proposed = L.map('proposedMap', {minZoom: 10}).setView([35.81889, -78.64447], 11);

current.sync(proposed);
proposed.sync(current);


var layerC = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
});
current.addLayer(layerC);

var layerP = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
});
proposed.addLayer(layerP);

addMapClick();

L.esri.dynamicMapLayer(config.parcels.url, {opacity: 0.2, layers: [0,1], position: 'back'}).addTo(current);
L.esri.dynamicMapLayer(config.parcels.url, {opacity: 0.2, layers: [0,1], position: 'back'}).addTo(proposed);
var currentLayer = L.esri.dynamicMapLayer(config.current.url, {opacity: 0.50, layers:[1]}).addTo(current);
var prelimLayer = L.esri.dynamicMapLayer(config.preliminary.url, {position: 'back', opacity: 0.50, layers: [1]}).addTo(proposed);
var changeLayer = L.esri.dynamicMapLayer(config.changes.url, {position: 'front', opacity: 0.50, layers: [0]});
getLegend(config.current.url);

locMarkersC = L.featureGroup().addTo(current);
locMarkersP = L.featureGroup().addTo(proposed);
var icons = [L.icon({
	iconUrl: 'img/marker-icon-red.png',
	iconSize: [25,41]
}),L.icon({
	iconUrl: 'img/marker-icon-green.png',
	iconSize: [25,41]
})];
$('textarea').maxlength({
	alwaysShow: true,limitReachedClass: "label label-important"
});

var template = "<strong>Category</strong> {TYPE} <br/><strong>Feedback</strong> {FEEDBACK}";
feedbackLayer = L.esri.clusteredFeatureLayer(config.feedbackLayer.url,{
	where: "DISPLAY = 1 OR DISPLAY IS NULL",
	cluster: new L.MarkerClusterGroup({
		iconCreateFunction: function(cluster) {
			var count = cluster.getChildCount();
			var digits = (count+"").length;
			return new L.DivIcon({
				html: count,
				className:"cluster digits-"+digits,
				iconSize: null
			});
		}
	}),
	createMarker: function (geojson, latlng) {
		var responded = (geojson.properties.RESPONDED) ? geojson.properties.RESPONDED: 0;
		return L.marker(latlng, {
			icon: icons[responded]
		});
	},
	onEachMarker: function (feature, layer) {
		layer.bindPopup(buildPopup(feature)[0]);
	}})
	.on('metadata', feedbackLayerLoaded);

	L.control.layers({}, {'Flood Hazard Areas': currentLayer}).addTo(current);
	L.control.layers({}, {'Flood Hazard Areas': prelimLayer, 'Floodway Changes': changeLayer,'Feedback': feedbackLayer}).addTo(proposed);
	var lcP = L.control.locate().addTo(proposed);
	var lcC = L.control.locate().addTo(current);

	proposed.on("locationfound", function (location){
		lastAction = "click";
		lcP.stopLocate();
		var point = {x: location.latlng.lng, y: location.latlng.lat};
		_gaq.push(['_trackEvent', 'Search', 'Type', 'Geolocation']);
		getInfo(point);
		setMapView(point);
	});

	current.on("locationfound", function (location){
		lastAction = "click";
		lcC.stopLocate();
		var point = {x: location.latlng.lng, y: location.latlng.lat};
		_gaq.push(['_trackEvent', 'Search', 'Type','Geolocation']);
		getInfo(point);
		setMapView(point)
	});
	$.getJSON('json/fema.json', function(data, textStatus) {
		json = data;
	});

	$(window).resize(function () {
		var mq = window.matchMedia("(max-width: 760px)");
		if (mq.matches && addressText) {
			$("#addressAlert").show();
		}
	});
});
