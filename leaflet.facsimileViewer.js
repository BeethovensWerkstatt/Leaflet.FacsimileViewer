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
		}

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
        
        center = this.options.facsViewer.xy2latlng(map.options.imageConfig.width / 4, map.options.imageConfig.height / 4);
        map.setView(center, zoom, true);
		
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
      	return Math.floor(num / 256);;
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

	initialize: function (image, svgFile, options) { // (String, LatLngBounds, Object)
		this._url = url;
		this._svgFile = svgFile;
		
		var svgBounds;
		
		if (image.options.detectRetina && L.Browser.retina && image.options.maxZoom > 0)
		    svgBounds = [xy2latlng(0,0), xy2latlng(image.options.width / 2,image.options.height / 2)];
		else    
		    svgBounds = [xy2latlng(0,0), xy2latlng(image.options.width,image.options.height)];
		
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
        overlays: []
    },
    
    initialize: function(id) {
        this._containerID = id;
        
    },
    
    loadImage: function(options) {
    
        options = L.setOptions(this, options);
        this._maxZoom = Math.max(Math.ceil(Math.log2(options.width / 256)), Math.ceil(Math.log2(options.height / 256)));
        
        var map = this._map = L.map(this._containerID,{
            crs: L.CRS.Simple,
            imageConfig: options,
            facsViewer: this
        }).setView(new L.LatLng(0,0),3);
        
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
        }).addTo(this._map);
        
        var imageBounds = [this.xy2latlng(0,0),this.xy2latlng(options.width,options.height)];
        
        var overlays = {};
        for (var i = 0; i < options.overlays.length; i++) {
        
            var svgCode = options.overlays[i].code;
            var title = options.overlays[i].title;
            
            overlays[title] = L.svgOverlay(this._tiles,svgCode).addTo(this._map);
        }
        
        L.control.layers({},overlays,{collapsed: false}).addTo(this._map);
        
        if(options.dpi > 1)
            L.control.scale(this._tiles).addTo(this._map);
            
    },
    
    unload: function() {
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
    
    xy2latlng: function(x,y) {
  		
       	var zoom = this._map.getZoom();
       	
       	if (L.Browser.retina && this._maxZoom > 0)
       	    zoom = zoom--;
       	
     	var latlng = this._map.unproject(L.point((x / Math.pow(2,6-zoom)), (y / Math.pow(2,6-zoom))));
       	
       	return latlng;
  	
    },
  
    latlng2xy: function(latlng) {
  	
       	var zoom = this._map.getZoom();
       	
       	if (L.Browser.retina && this._maxZoom > 0)
       	    zoom = zoom++;
       	
       	var point = this._map.project(latlng);
       	var eX = point.x * Math.pow(2,6-zoom)
     	var eY = point.y * Math.pow(2,6-zoom)
     	
     	return {x:eX,y:eY};
  	
    }
    
});

L.facsimileViewer = function (id, options) {
	return new L.FacsimileViewer(id, options);
};

