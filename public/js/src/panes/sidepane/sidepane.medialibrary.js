Wu.SidePane.MediaLibrary = Wu.SidePane.Item.extend({

	type : 'mediaLibrary',
	title : 'Media',

	initContent : function () {

		// create new fullscreen page, and set as default content
		this._content = Wu.DomUtil.create('div', 'fullpage-mediaLibrary', Wu.app._appPane);
		
		// create container (overwrite default) and insert template			// innerHTML
		this._container = Wu.DomUtil.create('div', 'editor-wrapper', this._content, ich.mediaLibrary({ media : 'this is media!' }));

		// get panes
		this._innerContent = Wu.DomUtil.get('mediaLibrary-inner-content');

		this._leftImage = {}
		this._leftImage.innerSlider 	= Wu.DomUtil.get("mediaLibrary-inner-slider-left");
		this._leftImage.grabGrid 	= Wu.DomUtil.get("mediaLibrary-grabgrid-left");
		this._leftImage.Image 		= Wu.DomUtil.get("mediaLibrary-image-container-left");
		this._leftImage.Image.img 	= this._leftImage.Image.getElementsByTagName("img")[0];
		this._leftImage.nativeResolution = Wu.DomUtil.get("mediaLibrary-data-resolution-l");
		this._leftImage.filename 	= Wu.DomUtil.get("mediaLibrary-data-filename-l");
		this._leftImage.fileCaptured 	= Wu.DomUtil.get("mediaLibrary-data-captured-l");
		this._leftImage.fileUploaded 	= Wu.DomUtil.get("mediaLibrary-data-uploaded-l");
		this._leftImage.fileUploadedBy 	= Wu.DomUtil.get("mediaLibrary-data-uploaded-by-l");
		this._leftImage.percent 	= Wu.DomUtil.get("mediaLibrary-percent-left-side");
		this._leftImage.zoomIn 		= Wu.DomUtil.get("mediaLibrary-zoom-in-left");
		this._leftImage.zoomOut 	= Wu.DomUtil.get("mediaLibrary-zoom-out-left");

		this._rightImage = {}
		this._rightImage.innerSlider 	= Wu.DomUtil.get("mediaLibrary-inner-slider-right");
		this._rightImage.grabGrid 	= Wu.DomUtil.get("mediaLibrary-grabgrid-right");
		this._rightImage.Image 		= Wu.DomUtil.get("mediaLibrary-image-container-right");
		this._rightImage.Image.img 	= this._rightImage.Image.getElementsByTagName("img")[0];
		this._rightImage.nativeResolution = Wu.DomUtil.get("mediaLibrary-data-resolution-r");
		this._rightImage.filename 	= Wu.DomUtil.get("mediaLibrary-data-filename-r");
		this._rightImage.fileCaptured 	= Wu.DomUtil.get("mediaLibrary-data-captured-r");
		this._rightImage.fileUploaded 	= Wu.DomUtil.get("mediaLibrary-data-uploaded-r");
		this._rightImage.fileUploadedBy = Wu.DomUtil.get("mediaLibrary-data-uploaded-by-r");
		this._rightImage.percent 	= Wu.DomUtil.get("mediaLibrary-percent-right-side");
		this._rightImage.zoomIn 	= Wu.DomUtil.get("mediaLibrary-zoom-in-right");
		this._rightImage.zoomOut 	= Wu.DomUtil.get("mediaLibrary-zoom-out-right");


	},


	_addHooks : function () {

		console.log('addHooks');
		// Wu.DomEvent.on(this._button, 'mousedown', this.dosomething, this);

		// Zooming in on Left Image
		Wu.DomEvent.on(this._leftImage.zoomIn, 'mousedown', function() { this.zoomImg('left', 'in') }, this);
		Wu.DomEvent.on(this._leftImage.zoomIn, 'mouseup',   function() { this.zoomImg_stop('left') }, this);

		// Zooming out on Left Image
		Wu.DomEvent.on(this._leftImage.zoomOut, 'mousedown', function() { this.zoomImg('left', 'out') }, this);
		Wu.DomEvent.on(this._leftImage.zoomOut, 'mouseup',   function() { this.zoomImg_stop('left') }, this);
		
		// Zooming in on Right Image
		Wu.DomEvent.on(this._rightImage.zoomIn, 'mousedown', function() { this.zoomImg('right', 'in') }, this);
		Wu.DomEvent.on(this._rightImage.zoomIn, 'mouseup',   function() { this.zoomImg_stop('right') }, this);

		// Zooming out on Right Image
		Wu.DomEvent.on(this._rightImage.zoomOut, 'mousedown', function() { this.zoomImg('right', 'out') }, this);
		Wu.DomEvent.on(this._rightImage.zoomOut, 'mouseup',   function() { this.zoomImg_stop('right') }, this);


	},

	zoomImg : function (side, direction) {
		

		var zoomThis;

		// LEFT
		if ( side == "left" ) {
			var zoomThis = this._leftImage;
			var currentActiveNativeWidth = this.images[this._currentActiveLeft].file.data.image.dimensions.width;
		} 
		

		// RIGHT
		if ( side == "right" ) {
			var zoomThis = this._rightImage;
			var currentActiveNativeWidth = this.images[this._currentActiveRight].file.data.image.dimensions.width;			
		} 


			// get image container
			var container = zoomThis.Image.img;

			var imgContainer = zoomThis.Image.img;
			
			var _imgWidth = imgContainer.offsetWidth;
			var _imgHeight = imgContainer.offsetHeight;
			var _imgLeft = imgContainer.offsetLeft;
			var _imgTop = imgContainer.offsetTop;

			var hw_prop = _imgHeight / _imgWidth;			

			var _imgWrapperWidth = zoomThis.Image.offsetWidth;
			var _imgWrapperHeight = zoomThis.Image.offsetHeight;		


			var that = this;

			// ZOOOOOMING 
			this.imgZooming = setInterval(function() {
				
				// How fast we want to Zoom
				// 1% of image width
				if ( direction == "in" ) {
					zoomIndex = _imgWidth/100;
				} else {
					zoomIndex = - _imgWidth/100;					
				}

				// New Image width
				_imgWidth+=zoomIndex;

				// New Image height
				var zoomIndexHeight = zoomIndex * hw_prop;
				_imgHeight+=zoomIndexHeight;
				
				// Figure out percent position of image center relevant to container center
				KOPercentLeft = (-_imgLeft + (_imgWrapperWidth / 2) ) / _imgWidth;
				KOPercentTop = (-_imgTop + (_imgWrapperHeight / 2) ) / _imgHeight;

				// New Left Position
				leftZoomIndex = zoomIndex * KOPercentLeft;
				_imgLeft-=leftZoomIndex;

				// New Top Position
				topZoomIndex = (zoomIndex * hw_prop) * KOPercentTop;
				_imgTop-=topZoomIndex;

				// Update Percentage Number
				var currentPercent = Math.round((_imgWidth / currentActiveNativeWidth) * 100);
				zoomThis.percent.innerHTML = currentPercent;
				
				imgContainer.style.width  = _imgWidth           + 'px';
				imgContainer.style.height = _imgHeight 		+ 'px';
				imgContainer.style.left   = _imgLeft            + 'px';
				imgContainer.style.top    = _imgTop             + 'px';

			}, 10);
		
		
	},

	zoomImg_stop : function (side) {

		clearInterval(this.imgZooming);

		if ( side == "left" ) {
			this.__leftImageUpdate();
		}

		if ( side == "right" ) {
		}
		
	},




	__leftImageUpdate : function () {

			var crunchPath = app.options.servers.portal + 'pixels/';		

			var thisImage = this.images[this._currentActiveLeft];

			var nativeWidth = thisImage.file.data.image.dimensions.width;
			var nativeHeight = thisImage.file.data.image.dimensions.height;

			var imageWidth = this._leftImage.Image.img.offsetWidth;
			var imageHeight = this._leftImage.Image.img.offsetHeight;

			var wrapperWidth = this._leftImage.Image.offsetWidth;
			var wrapperHeight = this._leftImage.Image.offsetHeight;

			var _xCrop = this._leftImage.Image.img.offsetLeft;
			var _yCrop = this._leftImage.Image.img.offsetTop;

			// Make sure to never crop if the offsetTop and offsetLeft is positive
			if ( _xCrop > 0 ) _xCrop = 0;
			if ( _yCrop > 0 ) _yCrop = 0;


			console.log("************************");
			console.log("New image", thisImage.file.uuid)
			console.log("New image width:", imageWidth);
			console.log("New image height:", imageHeight);
			console.log("------------------------");
			console.log("New image X-crop:", Math.abs(_xCrop));
			console.log("New image Y-crop:", Math.abs(_yCrop));
			console.log("------------------------");
			console.log("New image crop width:", wrapperWidth)
			console.log("New image crop height:", wrapperHeight)
			console.log("************************");
			
			var _requestCrunch = crunchPath;
				_requestCrunch += thisImage.file.uuid;
				_requestCrunch += '?width=' + imageWidth;
				_requestCrunch += '&height=' + imageHeight;
				_requestCrunch += '&cropw=' + wrapperWidth;
				_requestCrunch += '&croph=' + wrapperHeight;
				_requestCrunch += '&cropx=' + Math.abs(_xCrop);
				_requestCrunch += '&cropy=' + Math.abs(_yCrop);

			
			// Load image before pasting it (high res version)
			var myTempImage = new Image();
			var that = this;

			myTempImage.onload=function() {
				that._rightImage.Image.img.style.top = '0px';
				that._rightImage.Image.img.style.left = '0px';
				that._rightImage.Image.img.src = myTempImage.src;
			};
			myTempImage.src = _requestCrunch;


	},

	removeHooks : function () {

	},

	addEditHooks : function () {
				       
	},

	removeEditHooks : function () {
		
	},

	// fired when different sidepane selected, for clean-up
	deactivate : function () {
		console.log('clear!');
	},



	updateContent : function () {
		this.update();
	},

	update : function () {
		// set project
		this.project = app.activeProject;
		
		console.log('MEDIALIBRARY: ', this.project);

		// flush
		this.reset();

		// build shit
		this.refresh();

		// add edit hooks
		this.addEditHooks();
	
	},

	thumbClick : function (uuid, side) {

		console.log('thumbClick');
		console.log('side', side);

		var store = this.images[uuid];

		if ( side == 'left' ) {
			var imgFrame = this._leftImage;
			this._currentActiveLeft = uuid;
		}

		if ( side == 'right' ) {
			var imgFrame = this._rightImage;
			this._currentActiveRight = uuid;
		}

		imgFrame.Image.img.removeAttribute("style");

		var crunchPath = app.options.servers.portal + 'pixels/';		


		// Request Image
		var largeImgRequest = crunchPath + uuid + '?width=1200&height=800';
		
		// Get dimensions of raw file
		var _rawWidth = store.file.data.image.dimensions.width;
		var _rawHeight = store.file.data.image.dimensions.height;

		// Set the Image Data fields
		imgFrame.nativeResolution.innerHTML = _rawWidth + ' x ' + _rawHeight + ' pixels';
		imgFrame.filename.innerHTML = store.file.name;

		imgFrame.fileCaptured.innerHTML = new Date(store.file.data.image.created).toDateString();

		// 'unknown'; //files[t].captured;
		var dateString = new Date(store.file.created).toDateString();
		imgFrame.fileUploaded.innerHTML = dateString;
		imgFrame.fileUploadedBy.innerHTML = store.file.createdByName;

		// Figure out the percent
		var containerWidth = imgFrame.Image.offsetWidth;
		var showingPercent = Math.round((containerWidth / _rawWidth) * 100);
		imgFrame.percent.innerHTML = showingPercent;

		// Figure out the orientation
		var rawProp = _rawWidth / _rawHeight;

		if ( rawProp >= 1 ) { 
			Wu.DomUtil.addClass(imgFrame.Image, "landscape", this);
			Wu.DomUtil.removeClass(imgFrame.Image, "portrait", this);
		} else { 
			Wu.DomUtil.removeClass(imgFrame.Image, "landscape", this);
			Wu.DomUtil.addClass(imgFrame.Image, "portrait", this);
		}


		var newWidth = 900;
		var _prop = newWidth / _rawWidth;
		var newHeight = _rawHeight * _prop;

		var _imgWrapperWidth = imgFrame.Image.offsetWidth;		
		var _imgWrapperHeight = imgFrame.Image.offsetHeight;

		var _bProp = _imgWrapperWidth / newWidth;
		var newVisualHeight = newHeight * _bProp;

		var _newOffsetTop = ((_imgWrapperHeight / 2) - (newVisualHeight / 2));

		// Center Image vertically
		imgFrame.Image.img.style.top = Math.round(_newOffsetTop) + 'px';

		// Insert image
		imgFrame.Image.img.src = crunchPath + uuid + '?width=' + newWidth + '&height=' + newHeight;



	},


	refresh : function () {

		console.log('refresh');
		// build divs and content for project (this.project)

		// get array of files
		var files = this.project.getFiles();
		console.log('files: ', files);


		var crunchPath = 'http://85.10.202.87:8080/pixels/';

		var jpegs = _.filter(files, function (f) {
			return f.format.indexOf('jpg') > -1;
		});

		this.images = {};

		jpegs.forEach(function(jpg) {

			// Left Image Slider
			var store = this.images[jpg.uuid] = {};
			// store.data = this.images[jpg.uuid] = {};
			// store.data = jpg;
			store.file = jpg;
			// store.file.data.image.dimensions; // 
			
			store.left = {};
			store.left.div = Wu.DomUtil.create('div', 'mediaLibrary-slider-thumb', this._leftImage.innerSlider);
			store.left.img = Wu.DomUtil.create('img', '', store.left.div);
			store.left.img.src = crunchPath + jpg.uuid + '?width=145&height=500';


			store.right = {};
			store.right.div = Wu.DomUtil.create('div', 'mediaLibrary-slider-thumb', this._rightImage.innerSlider);
			store.right.img = Wu.DomUtil.create('img', '', store.right.div);
			store.right.img.src = crunchPath + jpg.uuid + '?width=145&height=500';

			// Click on thumb on LEFT side
			Wu.DomEvent.on(store.left.div, 'click', function () {
				console.log("clicking on a left thumb");
				this.thumbClick(jpg.uuid, 'left');
			}, this);

			// Click on thumb on Right side
			Wu.DomEvent.on(store.right.div, 'click', function () {
				console.log("clicking on a left thumb");
				this.thumbClick(jpg.uuid, 'right');
			}, this);

		}, this);


		this._imgDraggable();

		// add hooks
		this._addHooks();

	},

	// DRAGGABLE
	// DRAGGABLE
	// DRAGGABLE

	_imgDraggable : function () {

		var _dragGrid = this._leftImage.grabGrid;

		Wu.DomEvent.on(_dragGrid, 'mousedown', function() { this._initDragging() }, this);
		Wu.DomEvent.on(_dragGrid, 'mousemove', function(e) { this._draggingImage(e) }, this);
		// Wu.DomEvent.on(document, 'mouseup', function() { this._stopDragging() }, this);		// ko var her! 
														// ga feil. kanskje finne noe
														// lavere enn document

		this.__x_pos = 0; // Stores x & y coordinates of the mouse pointer
		this.__y_pos = 0;
		this.__x_elem = 0; // Stores top, left values (edge) of the element
		this.__y_elem = 0;

	},

	
	// Will be called when user starts dragging an element
	_initDragging : function () {

		// Store the object of the element which needs to be moved
		this.__x_elem = this.__x_pos - this._leftImage.Image.img.offsetLeft;
		this.__y_elem = this.__y_pos - this._leftImage.Image.img.offsetTop;

		this._draggingLeftImage = true;

		return false;
	
	},

	_draggingImage : function (e) {

		    this.__x_pos = document.all ? window.event.clientX : e.pageX;
		    this.__y_pos = document.all ? window.event.clientY : e.pageY;

		    if ( this._draggingLeftImage ) {

				var __new_X = this.__x_pos - this.__x_elem;
				var __new_Y = this.__y_pos - this.__y_elem;

				// Moving X
				var movingX = 	this._leftImage.Image.img.offsetLeft - __new_X;
				var hrX = 		this._rightImage.Image.img.offsetLeft;
				console.log("movingX", movingX);

				// Moving Y
				var movingY = 	this._leftImage.Image.img.offsetTop - __new_Y;
				var hrY = 		this._rightImage.Image.img.offsetTop;
				console.log("movingY", movingY);


				this._leftImage.Image.img.style.left = __new_X + 'px';
				this._leftImage.Image.img.style.top = __new_Y + 'px';


				this._rightImage.Image.img.style.left = hrX - movingX + 'px';
				this._rightImage.Image.img.style.top = hrY - movingY + 'px';
			}
	},	

	_stopDragging : function () {
		this._draggingLeftImage = false;
		this.__leftImageUpdate();
	},

	reset : function () {
		// remove all inside div
		// this._innerContent.innerHTML = '';

		// this.innerSliderLeft.innerHTML = '';
		// this.innerSliderRight.innerHTML = '';
	
		this.removeHooks();
	},

});

