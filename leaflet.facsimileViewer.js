/*
 * Leaflet.FacsimileViewer (version 0.1)
 * A JS library for displaying high-res images, based on
 * Leaflet 0.8-dev (fc05abd) -> http://leafletjs.com
 * 
 * Partly based on Leaflet plugin L.TileLayer.Zoomify
 * see https://github.com/turban/Leaflet.Zoomify
 * 
 * 2014-10-23 Johannes Kepper 
 */


 /*
 * L.TileLayer.Plain display tiles with Leaflet
 * based on L.TileLayer.Zoomify (which is incompatible with Leaflet 0.8-dev)
 */

L.TileLayer.Plain = L.TileLayer.extend({
	options: {
		tolerance: 0.8
	},
    
    //overrides
	initialize: function (url, options) {
		
		this._url = url;
		
		options = L.setOptions(this, options);
		
		// detecting retina displays, adjusting tileSize and zoom levels
		if (options.detectRetina && L.Browser.retina && options.maxZoom > 0) {
            
            options.tileSize = Math.floor(options.tileSize / 2);
			options.zoomOffset++;

			options.minZoom = Math.max(0, options.minZoom);
			options.maxZoom--;
			
			//options.width = options.width / 2;
			//options.height = options.height / 2;
		}
        
        //console.log('options.maxZoom: ' + options.maxZoom);
        
		if (typeof options.subdomains === 'string') {
			options.subdomains = options.subdomains.split('');
		}
        
        var imageSize = L.point(options.width, options.height),
	    	tileSize = options.tileSize;
        
        this._imageSize = [imageSize];
    	this._gridSize = [this._getGridSize(imageSize)];
        
        while (parseInt(imageSize.x) > tileSize || parseInt(imageSize.y) > tileSize) {
        	imageSize = imageSize.divideBy(2).floor();
        	this._imageSize.push(imageSize);
        	this._gridSize.push(this._getGridSize(imageSize));
        }
        
        
		this._imageSize.reverse();
		this._gridSize.reverse();

        this.options.maxZoom = this._gridSize.length - 1;
        /*if(L.Browser.retina)
            this.options.maxZoom -= 1;*/
        //console.log('this.options.maxZoom: ' + this.options.maxZoom);
	},

    //overrides
	onAdd: function () {
	    
	    this._initContainer();
	    
	    if (!this.options.updateWhenIdle) {
			// update tiles on move, but not more often than once per given interval
			this._update = L.Util.throttle(this._update, this.options.updateInterval, this);
		}
        
        var map = this._map;
        var mapSize = map.getSize();
		var zoom = this._getBestFitZoom(mapSize);
		var imageSize = this._imageSize[zoom];
		//var center = map.options.crs.pointToLatLng(L.point(imageSize.x / 2, imageSize.y / 2), zoom);
        
        //center = this.options.facsViewer.xy2latlng(map.options.imageConfig.width / 4, map.options.imageConfig.height / 4);
        //map.setView(center, zoom, true);
		
		this._reset();
		this._update();
	},

    //new
	_getGridSize: function (imageSize) {
	    var tileSize = this.options.tileSize;
	    return L.point(Math.ceil(imageSize.x / tileSize), Math.ceil(imageSize.y / tileSize));
	},

    //new
	_getBestFitZoom: function (mapSize) {
	
	    var tolerance = this.options.tolerance,
			zoom = this._imageSize.length - 1,
			imageSize, zoom;
        
        
		while (zoom) {
			imageSize = this._imageSize[zoom];
			if (imageSize.x * tolerance < mapSize.x && imageSize.y * tolerance < mapSize.y) {
				    return zoom;
			}			
			zoom--;
		}
		return zoom;
	},
    
    //override
	_addTile: function (coords, container) {
	
		var tilePos = this._getTilePos(coords);
		
		// wrap tile coords if necessary (depending on CRS)
		this._wrapCoords(coords);
		
		var tile = this.createTile(coords, L.bind(this._tileReady, this));
		
		this._initTile(tile);

		// if createTile is defined with a second argument ("done" callback),
		// we know that tile is async and will be ready later; otherwise
		if (this.createTile.length < 2) {
			// mark tile as ready, but delay one frame for opacity animation to happen
			setTimeout(L.bind(this._tileReady, this, null, tile), 0);
		}
		
		var zoom = this._map.getZoom();
	    var imageSize = this._imageSize[zoom];
		var gridSize = this._gridSize[zoom];
		var tileSize = this.options.tileSize;

		if (coords.x === gridSize.x - 1) {
			tile.style.width = imageSize.x - (tileSize * (gridSize.x - 1)) + 'px';
		} 

		if (coords.y === gridSize.y - 1) {
			tile.style.height = imageSize.y - (tileSize * (gridSize.y - 1)) + 'px';			
		} 

		// we prefer top/left over translate3d so that we don't create a HW-accelerated layer from each tile
		// which is slow, and it also fixes gaps between tiles in Safari
		L.DomUtil.setPosition(tile, tilePos, true);

		// save tile in cache
		this._tiles[this._tileCoordsToKey(coords)] = tile;

		container.appendChild(tile);
		this.fire('tileloadstart', {tile: tile});
		
		$(tile).error(function(){
            $(this).css('visibility', 'hidden');
        });
	},
    
    //override : was tilePoint
	getTileUrl: function (coords) {
	
	    var url = this._url + 'TileGroup'
		  + this._getTileGroup(coords)
		  + '/'
		  + this._map.getZoom()
		  + '-'
		  + coords.x
		  + '-'
		  + coords.y
		  + '.jpg';
	    
	    //console.log('loading ' + url + ' for coords ' + coords);
	   
	
		return url;
	},

    //new
	_getTileGroup: function (coords) {
	
		var zoom = this._map.getZoom(),
			num = 0,
			gridSize;

		for (z = 0; z < zoom; z++) {
			gridSize = this._gridSize[z];
			num += gridSize.x * gridSize.y; 
		}	

		num += coords.y * this._gridSize[zoom].x + coords.x;
      	return Math.floor(num / 256);
	}

});

L.tileLayer.plain = function (url, options) {
	return new L.TileLayer.Plain(url, options);
};

/*
 * L.Control.Scale is used for displaying metric/imperial scale on the map.
 */

L.Control.Scale.Dim = L.Control.Scale.extend({
	
	_update: function () {
		
		var map = this._map;
		var maxPixels = map.options.imageConfig.width;
        
        var maxDim = L.CRS.Simple.distance(
				map.containerPointToLatLng([0, 0]),
				map.containerPointToLatLng([maxPixels, 0]));
        
        if (L.Browser.retina)
            maxDim = maxDim * 2;
        
        
		this._updateScales(maxDim);
	},

	_updateScales: function (maxDim) {
	
	    if (this._map.options.imageConfig.dpi) {
	        if (this.options.metric && maxDim) {
     			this._updateMetric(maxDim);
     		}
     		if (this.options.imperial && maxDim) {
     			this._updateImperial(maxDim);
     		}
	    }
	
		
	},

	_updateMetric: function (maxDim) {
	
	    var dpi = this._map.options.imageConfig.dpi;
	    var dim = this._getRoundNum(maxDim);
	    
	    var cm = Math.floor(maxDim / dpi / 0.3937 * 100) / 100;
	    
		var label = cm + ' cm';
		
		this._updateScale(this._mScale, label, dim / maxDim);
	},

	_updateImperial: function (maxDim) {
		
		var dpi = this._map.options.imageConfig.dpi;
	    var dim = this._getRoundNum(maxDim);
	    
	    var inch = Math.floor(maxDim / dpi * 100) / 100;
	    
		var label = inch + ' in';
		
		this._updateScale(this._iScale, label, dim / maxDim);
	},

	_getRoundNum: function (num) {
		/*var pow10 = Math.pow(10, (Math.floor(num) + '').length - 1),
		    d = num / pow10;

		d = d >= 10 ? 10 :
		    d >= 5 ? 5 :
		    d >= 3 ? 3 :
		    d >= 2 ? 2 : 1;
*/
		return Math.floor(num * 1) / 1;
	}
});

L.control.scale = function (options) {
	return new L.Control.Scale.Dim(options);
};

/*
 * L.SvgOverlay is used to overlay images over the map (to specific geographical bounds).
 */

L.SvgOverlay = L.ImageOverlay.extend({

	options: {
		opacity: 1,
		alt: ''
	},

	initialize: function (tiles, svgFile, options) { // (String, LatLngBounds, Object)
		this._tiles = tiles;
		this._svgFile = svgFile;
		
		var svgBounds;
		
		/*if (tiles.options.detectRetina && L.Browser.retina && tiles.options.maxZoom > 0)
		    svgBounds = [this._tiles.options.facsViewer.xy2latlng(0,0), this._tiles.options.facsViewer.xy2latlng(tiles.options.width / 2,tiles.options.height / 2)];
		else   */ 
		    svgBounds = [this._tiles.options.facsViewer.xy2latlng(0,0), this._tiles.options.facsViewer.xy2latlng(tiles.options.width,tiles.options.height)];
		
		this._bounds = L.latLngBounds(svgBounds);
        
        L.setOptions(this, options);
	},

	_initImage: function () {
		//var img = this._image = L.DomUtil.create('img',
		//		'leaflet-image-layer ' + (this._zoomAnimated ? 'leaflet-zoom-animated' : ''));
        
        var img = this._image = this._svgFile;
        
		img.onselectstart = L.Util.falseFn;
		img.onmousemove = L.Util.falseFn;

		img.onload = L.bind(this.fire, this, 'load');
		//img.src = this._url;
		//img.alt = this.options.alt;
	}

});

L.svgOverlay = function (bounds, options) {
	return new L.SvgOverlay(bounds, options);
};

/*
function xy2latlng(x,y) {
  		
  		var zoom = map.getZoom();
  		
		var latlng = map.unproject(L.point((x / Math.pow(2,6-zoom)), (y / Math.pow(2,6-zoom))));
  		
  		return latlng;
  		
  	};
  	
  	function latlng2xy(latlng) {
  		
  		var zoom = map.getZoom();
  		var point = map.project(latlng);
  		var eX = point.x * Math.pow(2,6-zoom)
		var eY = point.y * Math.pow(2,6-zoom)
		
		return {x:eX,y:eY};
  		
  	};*/


L.FacsimileViewer = L.Class.extend ({
    
    options: {
        width: -1,
        height: -1,
        dpi: -1,
        attribution: '',
        url: '' ,
        overlays: [],
        lang: 'en'
    },
    
    initialize: function(id) {
        this._containerID = id;
        
    },
    
    loadImage: function(options, measures, scaleFactor, successFunc) {
    
        options = L.setOptions(this, options);
        
        this._maxZoom = Math.max(Math.ceil(Math.log(options.width / 256) / Math.LN2), Math.ceil(Math.log(options.height / 256) / Math.LN2));
        if(L.Browser.retina)
            this._maxZoom += 1;
        
        //console.log('width: ' + options.width + ' | height: ' + options.height + ' | maxZoom: ' + this._maxZoom + ' | gridSize: ' + this._gridSize);
        L_DISABLE_3D = true;
        var map = this._map = L.map(this._containerID,{
            crs: L.CRS.Simple,
            imageConfig: options,
            facsViewer: this,
            maxZoom: this._maxZoom,
            minZoom: 1
        }).setView(new L.LatLng(0,0),2);
        
        var center = this.xy2latlng(options.width / 2,options.height / 2);
        var sw = this.xy2latlng(0,options.height);
        var ne = this.xy2latlng(options.width,0);
        var bounds = L.latLngBounds(sw, ne);
        
        //map.setMaxBounds(bounds);
        
        //L.marker(sw).addTo(map);
        //L.marker(ne).addTo(map);
        //L.marker(center).addTo(map);
        
        map.fitBounds(bounds);
        
        map.attributionControl.options.prefix = '';
        
        var tiles = this._tiles = L.tileLayer.plain(options.url, {
            tms: false,
            detectRetina: true,
            continuousWorld: true,
            tolerance: 1,
            attribution: options.attribution,
            width: options.width,
            height: options.height,
            tileSize: 256,
            minZoom: 1,
            maxZoom: this._maxZoom,
            dpi: options.dpi,
            imageConfig: options,
            facsViewer: this
        }).addTo(map);
        
        if(L.Browser.retina) {
            map.options.maxZoom -= 1;
            tiles.options.maxZoom -= 1;    
        }
        
        var overlays = {};
        
        for (var i = 0; i < options.overlays.length; i++) {
            
            var svgCode = options.overlays[i].code;
            var title = options.overlays[i].title;
            
            overlays[title] = L.svgOverlay(this._tiles,svgCode).addTo(this._map);
        }
        
        /*if(options.overlays.length > 0) {*/
            var layerControl = this._map._layerControl = L.control.layers({},overlays,{collapsed: false});
            layerControl.addTo(this._map);
        /*}*/
        
        if(options.dpi > 1)
            L.control.scale(this._tiles).addTo(this._map);
        
        var measureMarkers = [];
        
        $.each(measures, function(index,measure){
           
           var ulx = measure.ulx * scaleFactor;
           var uly = measure.uly * scaleFactor;
           var lrx = measure.lrx * scaleFactor;
           var lry = measure.lry * scaleFactor;
           
           var cx = (ulx + lrx) / 2;
           var cy = (uly + lry) / 2;
           
           var label = (measure.label !== '') ? measure.label : measure.n;
           
           var icon = L.divIcon({html:label,className: 'measureLabel',iconSize: [45,16]});
           
           var fullRect = L.rectangle([facs.xy2latlng(ulx,uly),facs.xy2latlng(lrx,lry)], {color: "rgba(0,0,0,0.2)", weight: 1});
           
           var marker = L.marker(facs.xy2latlng(cx,cy), {icon: icon});
           
           measureMarkers.push(marker);
           
           marker.on('mouseover',function(e){
               fullRect.addTo(map);
           });
           
           marker.on('mouseout',function(e){
               map.removeLayer(fullRect);
           });
        });
        
        var measureGroup = this._measureGroup = L.layerGroup(measureMarkers);
        
        var label = '';
        if(lang = 'de')
            label = 'Taktzahlen einblenden';
        else if(lang = 'en')
            label = 'Show Measure Numbers';
        
        
        map._layerControl.addOverlay(measureGroup, label);
        measureGroup.addTo(map);
        
        map.on('overlayadd', function(e){
            
            //if a layer other than the currently active is added -> always true
            if(e !== this.options.facsViewer._activeLayer) {
                
                //if the added layer is not the layer for bar numbers
                if(e._leaflet_id !== this.options.facsViewer._measureGroup._leaflet_id) {
                    if(typeof this.options.facsViewer._activeLayer === 'object') {
                        map.removeLayer(this.options.facsViewer._activeLayer);
                        map._layerControl._update();
                        
                        $.each(this.options.facsViewer.unUsedStates, function(index,indexOfState){
                   	        var elem = $('.leaflet-control-layers-overlays label')[indexOfState + 1];
                   	        
                   	        $(elem).children('input').attr('disabled','disabled');
                   	        $(elem).css('color','#999999');
                   	        $(elem).find('.colorSample').css('opacity','0.25');
                   	    });
                        
                    }
                    
                    this.options.facsViewer._activeLayer = e;
                    
                } 
                
            }
            
            if(this.options.facsViewer._clickLayer)
                this.options.facsViewer._clickLayer.bringToFront();
            
        });
        
        map.on('overlayremove', function(e){
            
            //if a layer other than the bar numbers are removed, reset the _activeLayer variable
            if(e._leaflet_id !== this.options.facsViewer._measureGroup._leaflet_id)
                this.options.facsViewer._activeLayer = '';
        });
        
        if(typeof successFunc === 'function')
            successFunc();
        
        /*map.on('click', function(e){
            
    	   var img = this.options.facsViewer.latlng2xy(e.latlng);
		
		   if(img.x > options.width || img.y > options.height || img.x < 0 || img.y < 0)
		      console.log('clicked outside');
		   else 
		      console.log("You clicked the map at " + img.x + ' / ' + img.y);
		
    	});*/
    	
    },
    
    addLayer: function(overlay) {
    
        var svgCode = overlay.code;
        var title = overlay.title;
        var background = overlay.background;
        var colorSample = overlay.colorSample;
        
        /*if(!background && !this._map._panes.overlayPane.hasChildNodes()) {
            var layerControl = this._map._layerControl = L.control.layers({},{},{collapsed: false});
            layerControl.addTo(this._map);
        }*/
        
        var newLayer = L.svgOverlay(this._tiles,svgCode);//.addTo(this._map);
        
        if(!background) {
            
            if(overlay.colorSample)
                title = title + '<span class="colorSample" style="background-color: ' + colorSample + '"></span>';
            
            this._map._layerControl.addOverlay(newLayer, title);
            
            if(typeof this._clickLayer !== 'undefined')
                this._clickLayer.bringToFront();
            
        } else {
            this.activateLayer(newLayer);    
            
            this._clickLayer = newLayer;
            
        }
        
        return newLayer;
                    
    },
    
    activateLayer: function(layer) {
        
        //console.log('adding layer');
    
        layer.addTo(this._map);
        
        
        return layer;
    },
    
    unload: function() {
    
        if(this._map)
            this._map.remove();
        
        options  = {
            width: -1,
            height: -1,
            dpi: -1,
            attribution: '',
            fileURL: '' ,
            overlays: []
        };
    },
    
    showRect: function(ulx,uly,lrx,lry) {
        
        var southWest = this.xy2latlng(ulx,lry),
            northEast = this.xy2latlng(lrx,uly),
            bounds = L.latLngBounds(southWest, northEast);
        
        bounds = bounds.pad(0.4);
        
        this._map.fitBounds(bounds);
    },
    
    xy2latlng: function(x,y) {
  		
       	var zoom = this._map.getZoom();
       	
       	if (L.Browser.retina && this._maxZoom > 0)
       	    zoom = zoom--;
       	
     	var latlng = this._map.unproject(L.point((x / Math.pow(2,this._maxZoom - zoom)), (y / Math.pow(2,this._maxZoom - zoom))));
       	
       	return latlng;
  	
    },
  
    latlng2xy: function(latlng) {
  	
       	var zoom = this._map.getZoom();
       	
       	if (L.Browser.retina && this._maxZoom > 0)
       	    zoom = zoom++;
       	
       	var point = this._map.project(latlng);
       	var eX = point.x * Math.pow(2,this._maxZoom - zoom)
     	var eY = point.y * Math.pow(2,this._maxZoom - zoom)
     	
     	return {x:eX,y:eY};
  	
    }
    
});

L.facsimileViewer = function (id, options) {
	return new L.FacsimileViewer(id, options);
};

