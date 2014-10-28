Wu.StatusPane = Wu.Class.extend({
	_ : 'statuspane', 


	initialize : function (options) {
		
		// set options
		Wu.setOptions(this, options);

		// init container
		this.initContainer();

		// add hooks
		this.addHooks();

	},

	initContainer : function () {

		// create div
		var container 	= this._container 	= Wu.DomUtil.create('div', 'home-container');
		var logo 	= this._logo 		= Wu.DomUtil.create('div', 'home-logo', container);
		var statusWrap 	= this._statusWrap 	= Wu.DomUtil.create('div', 'home-status-wrap', container);
		var status 				= Wu.DomUtil.create('div', 'home-status', statusWrap);

		// set default status
		this.clearStatus();

		// add to sidepane if assigned container in options
		if (this.options.addTo) this.addTo(this.options.addTo);

	},

	addHooks : function () {
		// open sidepane menu on mousedown
		Wu.DomEvent.on(this._container, 'mousedown', this.toggle, this);

		// global TAB key toggle
		// Wu.DomEvent.on(document, 'keydown', this.tab, this);	// todo: fix tabbing in inputs
	},

	tab : function (e) {
		if (e.keyCode == 9) this.toggle();
	},

	toggle : function () {
		this.isOpen ? this.close() : this.open();
	
		// div cleanups to do when hitting home
		this.cleaningJobs();
	},

	cleaningJobs: function () {

		// make sure layermenu edit is disabled
		var layerMenu = Wu.app.MapPane.layerMenu;
		if (layerMenu) layerMenu.disableEdit();

		// close all open options
		app.SidePane.Map.closeAll();
	},

	// open sidepane menu
	open : function (e) {
		this.isOpen = true;
		var sidepane = app.SidePane;
		sidepane.expand();
		this.refresh();

		this.checkMapBlur();
		this.setContentHeights();

		// remove help pseudo
		Wu.DomUtil.removeClass(app._mapPane, 'click-to-start');

		// Remove start pane
		app.StartPane.deactivate();

		// trigger activation on active menu item
		app._activeMenu._activate()

		// console.log('StatusPane.open(). Currently active menu item:', app._activeMenuItem);
	},

	// close sidepane menu
	close : function (e) {
		this.isOpen = false;
		var sidepane = app.SidePane;
		sidepane.collapse();
		this.refresh();

		// console.log('StatusPane.close(). Currently active menu item:', app._activeMenuItem);

		// app.MapPane._container
		Wu.DomUtil.removeClass(app.MapPane._container, "map-blur") // (j) – removes the blur on map if it's set by one of the fullpanes

	},

	setContentHeights : function () {

		var clientsPane = app.SidePane.Clients;
		var optionsPane = app.SidePane.Map;

		if (clientsPane) clientsPane.setContentHeight();
		if (optionsPane) optionsPane.setContentHeight();
	},

	checkMapBlur : function () {

		if ( 	app._activeMenuItem == 'documents' || 
			app._activeMenuItem == 'dataLibrary' || 
			app._activeMenuItem == 'users' ) 
		{
			Wu.DomUtil.addClass(app.MapPane._container, "map-blur");
		}

	},

	addTo : function (wrapper, before) {
		// insert first in wrapper
		if (before) {
			wrapper.insertBefore(this._container, wrapper.firstChild);
		} else {
			wrapper.appendChild(this._container);
		}
	},

	setHeight : function (height) {
		// set height
		this._container.style.height = parseInt(height) + 'px';
	},

	refresh : function () {
		if (!this.project) return;
		// set height to project headerHeight
		var headerHeight = this.project.getHeaderHeight();
		this.setHeight(headerHeight);
	},

	updateContent : function (project) {
		this.project = project;

		// refresh height
		this.refresh();

		// collapse errything to just logo
		this.close();
	},

	setStatus : function (message, timer) {
		var that = this;

		// clear last clearTimer
		if (this.clearTimer) clearTimeout(this.clearTimer);

		// create div
		var status = Wu.DomUtil.create('div', 'home-status');
		
		// set message
		status.innerHTML = message;
		
		// push onto dom
		this.pushStatus(status);

		// clearTimer
		this.clearTimer = setTimeout(function () {
			that.clearStatus();
		}, timer || 3000);
	
	},

	// set 3000ms save status
	setSaveStatus : function () {
		this.setStatus('Saved!');
	},

	pushStatus : function (div) {

		// get old status div, insertBefore
		var old = this._statusWrap.firstChild;
		this._statusWrap.insertBefore(div, old);
		
		// wait 50ms for div to enter DOM
		setTimeout(function () {

			// add in class
			Wu.DomUtil.addClass(div, 'status-in');

			// after css effects done (250ms);
			setTimeout(function () {
				// remove old
				Wu.DomUtil.remove(old);
			}, 250);
		}, 50);
		
		
	},

	clearStatus : function () {
		// set default string
		var portalName = app.getPortalName();
		
		// do nothing if same
		if (portalName == this.getStatus()) return;

		// set status
		this.setStatus(portalName);
	},

	getStatus : function () {
		return this._statusWrap.firstChild.innerHTML;
	},


});

Wu.ProgressBar = Wu.Class.extend({

	initialize : function (options) {
		
		// set options
		Wu.setOptions(this, options);

		// init container
		this.initContainer();

	},

	initContainer : function () {

		// create progress bar
		this._progressBar = Wu.DomUtil.create('div', 'status-progress-bar', this._container);

		// add to sidepane if assigned container in options
		if (this.options.addTo) this.addTo(this.options.addTo);

	},

	addTo : function () {
		var pane = this.options.addTo;
		pane.appendChild(this._progressBar);
	},

	setProgress : function (percent) {
		if (percent < this._current + 9) return;

		var bar = this._progressBar;
		bar.style.opacity = 1;
		bar.style.width = percent + '%';
		this._current = percent;
	},

	hideProgress : function () {
		var bar = this._progressBar;
		bar.style.opacity = 0;
		this._current = 0;
		bar.style.width = 0;
	},
	
	// do a timed progress
	timedProgress : function (ms) {
		var that = this,
		    duration = ms || 5000, // five seconds default
		    steps = 10,	 	   // five steps default
		    p = 0;		   // start percentage
		
		// calculate delay
		var delay = parseInt(duration) / steps;

		// start progress
		this._timedProgress(p, delay, steps);	

	},

	_timedProgress : function (percent, delay, steps) {
		var that = this;

		// set progress to percent after delay
		percent = percent + (100/steps);
		this.setProgress(percent);
		
		setTimeout(function () {

			// play it again sam
			if (percent < 100) return that._timedProgress(percent, delay, steps);

			// done, hide progress bar
			that.hideProgress();

		}, delay)
	}


});








