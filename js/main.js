var config = {
  feedbackLayer: {
    url: "http://maps.wakegov.com/arcgis/rest/services/Environmental/FloodplainFeedbackEFS/FeatureServer/0"
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
  jurisdictions: {
  	url: "http://maps.wakegov.com/arcgis/rest/services/Jurisdictions/PlanningJurisdictions/MapServer/0"
  },
  geometry: {
    url: "http://maps.wakegov.com/arcgis/rest/services/Utilities/Geometry/GeometryServer"
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
    current.setView(point, 17);
    proposed.setView(point, 17);
  }
  function getInfo(point) {
    info = {};
    //_gaq.push(['_trackEvent', 'Search', 'Location', '"coordinates":['+point.x+', '+point.y+']']);
    updateLocation(point);
    updateLocationMarkers(point);
    searchParcel(point);
  }
  function mapClickHandler (e) {
    lastAction = "click";
    var point = [e.latlng.lng, e.latlng.lat];
    //_gaq.push(['_trackEvent', 'Search', 'Type', 'Map Click']);
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
  function searchParcel(point) {
    L.esri.Tasks.query({url: config.parcels.url + '/0'})
    .contains(L.latLng(point[1], point[0]))
    .run(function (error, featureCollection) {
      if (featureCollection.features.length > 0) {
        propGj = featureCollection.features[0];
        addressText = featureCollection.features[0].properties['SITE_ADDRESS'];
        updateLocationText('info', addressText);
        L.geoJson(featureCollection).addTo(locMarkersC);
        L.geoJson(featureCollection).addTo(locMarkersP);
        getCurrentFema(featureCollection);
        proposed.fitBounds(L.geoJson(featureCollection).getBounds());
       // updateLocationText();
      } else {
        if (lastAction === "click") {
          addressText = "";
          clearAllInfo();
          updateLocationText('danger', 'Location not on a property');
        }

      }
    });
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
      div.append('<p>' + (data.area * 0.000247105).toFixed(2) + ' acres ' /*+ getDifferenceLabel(data)*/ + '</p>');
      div.append('<p>' + data.description + '</p>');
    });
  }
  function updateLocationMarkers(point) {
    var icon = L.icon({
      iconUrl: 'img/location.png',
      iconSize: [14,14]
    });
    locMarkersC.clearLayers();
    locMarkersC.addLayer(L.marker([point[1], point[0]], {icon:icon}));
    locMarkersP.clearLayers();
    locMarkersP.addLayer(L.marker([point[1], point[0]], {icon:icon}));
  }
  function updateLocationText(style, text) {
    $("#location").html(addressText);
    if (style === "info") {
      $("#addressAlert").removeClass('alert-danger').addClass('alert-info');
    } else if (style === "danger") {
      $("#addressAlert").removeClass('alert-info').addClass('alert-danger');
    }
    showAddressAlert(text);
  }
  function updateLocation (point) {
    mapPoint = point;
    updateLocationMarkers(point);
    //updateLocationText('info', addressText);
    $("#addPointButton").html('	Change  <span class="glyphicon glyphicon-pushpin"></span>');
  }
  function setLocationHandler (e) {
    updateLocation(e.latlng)
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
    //_gaq.push(['_trackEvent', 'Search', type]);
    console.log(point);
    getInfo(point);
  }
  function searchByAddress (data) {
    L.esri.Tasks.query({url: config.addresses.url + "/1"}).where("ADDRESS = '" + data.value + "'").run(function (error, featureCollection, response) {
      if (featureCollection.features.length > 0) {
        var point = featureCollection.features[0].geometry.coordinates;
        displayPoint(point, "Address");
      }
    });
  }
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
          return encodeURI(newUrl);
        }
      }
    });
    addresses.initialize();
    $("#searchInput").typeahead({hint: true, highlight: true, minLength: 1},
      {name:'Addresses',
      displayKey:'value',
      source:addresses.ttAdapter()}
    ).on("typeahead:selected", typeaheadSelected);
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

  function sendEmail (contact, name, oid) {
  	$.ajax({
  		url: 'php/mail.php',
  		type: 'GET',
  		data: {
  			name: name,
        email: $("#inputEmail").val(),
  			contact: contact,
  			feedback: $("#commentArea").val(),
  			location: $("#location").text(),
  			id: oid
  		},
  	})
  	.done(function() {
  		console.log("success");
  	})
  	.fail(function() {
  		console.log("error");
  	})
  	.always(function() {
  		console.log("complete");       
        $("#mapModal").modal("toggle");
        $("#inputName").val("");
        $("#inputEmail").val("");
        $("#confirmEmail").val("");
        $("#commentArea").val("");
/*        $("#typeSelect").prop("selectedIndex", 0);*/
        locMarkersP.clearLayers();
        locMarkersC.clearLayers();
  	});
  	
  }

  function getContactEmail (etj, oid) {
  	$.getJSON("json/contacts.json", function (data) {
  		var contact = data.filter(function (contact) {
  			return contact.jurisdiction === etj;
  		});
  		if (contact.length > 0) {
  			contact = contact[0];
  			console.log(contact);
  			sendEmail(contact.email, contact.name, oid);
  		}
  	});
  }

  function getContact (oid) {
  	L.esri.Tasks.query({url: config.jurisdictions.url})
  		.contains(L.latLng(mapPoint[1], mapPoint[0]))
  		.returnGeometry(false)
  		.fields('JURISDICTION')
  		.run(function (error, featureCollection) {
  			var etj = "";
  			if (featureCollection.features.length > 0) {
  				etj = featureCollection.features[0].properties.JURISDICTION;
  				getContactEmail(etj, oid);
  			} else {
  				sendEmail('Betsy.Pearce@wakegov.com', 'Betsy Pearce', oid);
  			}
  		});
  }
  function submitForm () {
    var edit = {
      "type": "Feature",
      "properties": {
        "NAME":$("#inputName").val(),
        "EMAIL":$("#inputEmail").val(),
        "ADDRESS":$("#location").text(),
        "OWN":$('.btn-group[name="owner"]>label.active').index(),
        "FEEDBACK":$("#commentArea").val()/*,
        "TYPE":$("option:selected", "#typeSelect").val()*/
      },
      "geometry": {
        "type": "Point",
        "coordinates": mapPoint
      }
    };
    feedbackLayer.addFeature(edit, function (error, result) {
      if (result.success) {
        //feedbackLayer.refresh();
        getContact(result.objectId);
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
    if (feature.properties.CREATED_DATE) {
      var submitted = moment(new Date(feature.properties.CREATED_DATE)).format('MMMM Do YYYY, h:mm a');
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
      if (feature.properties.RESPONSE_DATE != feature.properties.CREATED_DATE){
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
  current = L.map('currentMap', {minZoom: 9}).setView([35.81889, -78.64447], 10);
  proposed = L.map('proposedMap', {minZoom: 9}).setView([35.81889, -78.64447], 10);
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
    where: "DISPLAY = 1 OR DISPLAY IS NULL"}).addTo(proposed);

  	feedbackLayer.bindPopup(function (feature) {
  		var createDate = "";
  		if (feature.properties.CREATED_DATE) {
  			createDate = moment(new Date(feature.properties.CREATED_DATE)).format('MMMM Do YYYY, h:mm a');
  		} else {
  			createDate = moment(Date.now()).format('MMMM Do YYYY, h:mm a');
  		}
	    return L.Util.template('<strong>Feedback </strong>{FEEDBACK}<br/><strong>Submitted </strong>' + createDate, feature.properties);
  	});
    L.control.layers({}, {'Flood Hazard Areas': currentLayer}).addTo(current);
    L.control.layers({}, {'Flood Hazard Areas': prelimLayer, 'Floodway Changes': changeLayer,'Feedback': feedbackLayer}).addTo(proposed);
    var lcP = L.control.locate().addTo(proposed);
    var lcC = L.control.locate().addTo(current);
    proposed.on("locationfound", function (location){
      lastAction = "click";
      lcP.stopLocate();
      var point = [location.latlng.lng, location.latlng.lat];
      //_gaq.push(['_trackEvent', 'Search', 'Type', 'Geolocation']);
      getInfo(point);
      setMapView(point);
    });
    current.on("locationfound", function (location){
      lastAction = "click";
      lcC.stopLocate();
      var point = [location.latlng.lng, location.latlng.lat];
      //_gaq.push(['_trackEvent', 'Search', 'Type','Geolocation']);
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
