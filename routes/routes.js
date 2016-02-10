// ROUTE: routes.js 

// utils
var _ 		= require('lodash');
var fs 		= require('fs-extra');
var gm 		= require('gm');
var kue 	= require('kue');
var fss 	= require("q-io/fs");
var zlib 	= require('zlib');
var uuid 	= require('node-uuid');
var util 	= require('util');
var utf8 	= require("utf8");
var mime 	= require("mime");
var exec 	= require('child_process').exec;
var dive 	= require('dive');
var async 	= require('async');
var carto 	= require('carto');
var colors 	= require('colors');
var crypto      = require('crypto');
var fspath 	= require('path');
var mapnik 	= require('mapnik');
var request 	= require('request');
var nodepath    = require('path');
var formidable  = require('formidable');
var nodemailer  = require('nodemailer');
var uploadProgress = require('node-upload-progress');
var mapnikOmnivore = require('mapnik-omnivore');
var errorHandler = require('../middleware/error-handler')();

// api
var api = require('../api/api');

// function exports
module.exports = function(app, passport) {

	// link app
	api.app = app;

	// authenticate shorthand
	var checkAccess = api.token.authenticate;

	/**
	* @apiDefine token
	* @apiParam {String} access_token A valid access token
	* @apiError Unauthorized The <code>access_token</code> is invalid. (403)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	*/
	// ================================
	// HOME PAGE (with login links) ===
	// ================================
	app.get('/', function(req, res) {
		api.portal.getBase(req, res);
	});
	
	/**
	* @api {post} /api/portal Get portal store
	* @apiName getPortal
	* @apiGroup User
	* @apiUse token
	*
	* @apiSuccess {object} Projects Projects that user have access to
	* @apiSuccess {object} Datasets Datasets that user owns or have access to
	* @apiSuccess {object} Contacts Contacts that user has in contact list
	*/
	// =====================================
	// GET PORTAL  =========================
	// =====================================
	app.post('/api/portal', checkAccess, api.portal.getPortal);
	
	/**
	* @api {post} /api/project/create Create a project
	* @apiName create
	* @apiGroup Project
	* @apiUse token
	* @apiParam {String} name Name of project
	* @apiSuccess {JSON} Project JSON object of the newly created project
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request name doesn't exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['name']
	*		}
	*	}
	* }
	*/
	// =====================================
	// CREATE NEW PROJECT  =================
	// =====================================
	app.post('/api/project/create', checkAccess, api.project.create, errorHandler);

	/**
	* @api {post} /api/project/delete Delete a project
	* @apiName delete
	* @apiGroup Project
	* @apiUse token
	* @apiParam {String} project_id Uuid of project
	* @apiSuccess {String} project ID of deleted project
	* @apiSuccess {Boolean} deleted True if successful
	* @apiSuccessExample {json} Success-Response:
	*  {
	*    "project": "project-o121l2m-12d12dlk-addasml",
	*    "deleted": true
	*  }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request project_id doesn't exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['project_id']
	*		}
	*	}
	* }
	* @apiError Not_found If project doesn't exist(404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "No such project.",
	*		"code": "404"
	*	}
	* }
	*/
	// =====================================
	// DELETE PROJECT   ====================
	// =====================================
	app.post('/api/project/delete', checkAccess, api.project.deleteProject, errorHandler);

	/**
	* @api {post} /api/project/get/public Get a public project
	* @apiName get public project
	* @apiGroup Project
	* @apiUse token
	* @apiParam {String} username Username
	* @apiParam {String} project_slug Project slug
	* @apiSuccess {JSON} Project JSON object of the newly created project
	* @apiSuccessExample {json} Success-Response:
	* {
	*  _id: '56af8403c608bbce6616d291',
	*  lastUpdated: '2016-02-01T16:12:51.390Z',
	*  created: '2016-02-01T16:12:51.390Z',
	*  createdBy: 'uuid-mocha-test-project',
	*  uuid: 'uuid-mocha-test-project_public',
	*  etc..
	* }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request username or project_slug don't exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['username', 'project_slug']
	*		}
	*	}
	* }
	* @apiError Not_found If user with specific username doesn't exist(404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "No such user.",
	*		"code": "404"
	*	}
	* }
	* @apiError Not_found If project with specific slug doesn't exist(404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "No such project.",
	*		"code": "404"
	*	}
	* }
	* @apiError Bad_request If project isn't public(404)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Not a public project.",
	*		"code": "400"
	*	}
	* }
	*/
	// =====================================
	// CREATE NEW PROJECT  =================
	// =====================================
	app.post('/api/project/get/public', checkAccess, api.project.getPublic, errorHandler);

	app.post('/api/project/get/private', checkAccess, api.project.getPrivate, errorHandler);

	/**
	* @api {get} /api/status Get portal status
	* @apiName status
	* @apiGroup Admin
	* @apiUse token
	*
	* @apiSuccess {json} status Status of portal, versions etc.
	* @apiSuccessExample {json} Success-Response:
	* {
	*   "status": {
	*     "versions": {
	*       "systemapic_api": "1.3.5",
	*       "postgis": "POSTGIS=2.1.7 r13414 GEOS=3.4.2-CAPI-1.8.2 r3921 PROJ=Rel. 4.8.0, 6 March 2012 GDAL=GDAL 1.10.1, released 2013/08/26 LIBXML=2.9.1 LIBJSON=UNKNOWN TOPOLOGY RASTER",
	*       "postgres": "PostgreSQL 9.3.9 on x86_64-unknown-linux-gnu, compiled by gcc (Ubuntu 4.8.2-19ubuntu1) 4.8.2, 64-bit",
	*       "mongodb": "3.2.1",
	*       "redis": "3.0.6"
	*     }
	*   }
	* }
	*/
	// =====================================
	// GET STATUS   ====================
	// =====================================
	app.get('/api/status', checkAccess, api.portal.status);

	// deprecated
	app.post('/oauth/token', api.oauth2.getToken);
		
	/**
	* @api {post} /api/token Get access token
	* @apiName access_token
	* @apiGroup User
	* @apiParam {String} username Email or username
	* @apiParam {String} password Password
	* @apiParam {Boolean} [refresh=false] Refresh access token
	*
	* @apiSuccess {json} status Access token JSON
	* @apiSuccessExample {json} Success-Response:
	* {
	*	"access_token":"AMduTdFBlXcBc1PKS5Ot4MZzwGjPhKw3y2LzJwJ0CGz0lpRGhK5xHGMcGLqvrOfY1aBR4M9Y4O126WRr5YSQGNZoLPbN0EXMwlRD0ajCqsd4MRr55UpfVYAfrLRL9i0tuglrtGYVs2iT8bl75ZVfYnbDl4Vjp4ElQoWqf6XdqMsIr25XxO5cZB9NRRl3mxA8gWRzCd5bvgZFZTWa6Htx5ugRqwWiudc8lbWNDCx85ms1up94HLKrQXoGMC8FVgf4",
	*	"expires_in":"36000",
	*	"token_type":"Bearer"
	* }
	* @apiError {json} Unauthorized Missing or invalid information.
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*     "error": "Please provide username/email and password."
	* }
	*/
	// ================================
	// GET TOKEN FROM PASSWORD ========
	// ================================
	app.post('/api/token', api.token.getTokenFromPassword);

	/**
	* @api {post} /api/token/refresh Refresh access token
	* @apiName refresh_access_token
	* @apiGroup User
	* @apiUse token
	*
	* @apiSuccess {json} status Access token JSON
	* @apiSuccessExample {json} Success-Response:
	* {
	*	"access_token":"AMduTdFBlXcBc1PKS5Ot4MZzwGjPhKw3y2LzJwJ0CGz0lpRGhK5xHGMcGLqvrOfY1aBR4M9Y4O126WRr5YSQGNZoLPbN0EXMwlRD0ajCqsd4MRr55UpfVYAfrLRL9i0tuglrtGYVs2iT8bl75ZVfYnbDl4Vjp4ElQoWqf6XdqMsIr25XxO5cZB9NRRl3mxA8gWRzCd5bvgZFZTWa6Htx5ugRqwWiudc8lbWNDCx85ms1up94HLKrQXoGMC8FVgf4",
	*	"expires_in":"36000",
	*	"token_type":"Bearer"
	* }
	*/
	// ================================
	// REFRESH TOKEN ==================
	// ================================
	app.post('/api/token/refresh', checkAccess, api.token.refresh);
	
	/**
	* @api {post} /api/token/check Check access token
	* @apiName check_access_token
	* @apiGroup User
	* @apiUse token
	*
	* @apiSuccess {json} status Access token JSON
	*/
	// ================================
	// CHECK TOKEN ====================
	// ================================
	app.post('/api/token/check', checkAccess, function (req, res) {
		res.send(req.user);
	});

	/**
	* @api {get} /api/token/check Check access token
	* @apiName check_access_token
	* @apiGroup User
	* @apiUse token
	*
	* @apiSuccess {json} status Valid status
	* @apiSuccessExample {json} Success-Response:
	* {
	*	"valid" : true
	* }
	*/
	// ================================
	// CHECK TOKEN ====================
	// ================================
	app.get('/api/token/check', checkAccess, function (req, res) {
		res.send({valid : true});
	});
	
	/**
	* @api {post} /api/user/session Check if already logged in (browser-only)
	* @apiName user_session
	* @apiGroup User
	*
	* @apiSuccess {json} access_token Valid access token (either user or public)
	*/
	// ================================
	// CHECK SESSION ==================
	// ================================
	app.post('/api/user/session', api.token.checkSession);

	// =====================================
	// ERROR LOGGING =======================
	// =====================================
	app.post('/api/error/log', checkAccess, api.error.clientLog);

	// =====================================
	// ANALYTICS ===================
	// =====================================
	app.post('/api/analytics/set', checkAccess, api.analytics.set);

	// =====================================
	// ANALYTICS ===================
	// =====================================
	app.post('/api/analytics/get', checkAccess, api.analytics.get);

	// =====================================
	// RESUMABLE.js UPLOADS ================
	// =====================================
	app.get('/api/data/upload/chunked', checkAccess, function (req, res) {
		api.upload.chunkedCheck(req, res);
	});

	// =====================================
	// RESUMABLE.js UPLOADS ================
	// =====================================
	app.get('/download/:identifier', checkAccess, function (req, res) {
		api.upload.chunkedIdent(req, res);
	});

	// todo: this route is now DEAD; still alive in wu.js (?? still true?)
	// =====================================
	// UPLOAD DATA LIBRARY FILES =========== // renamed route to /chunked (still true??)
	// =====================================
	app.post('/api/data/upload/chunked', checkAccess, api.upload.chunkedUpload);


	// =====================================
	// SET ACCESS / deprecated =============
	// =====================================
	app.post('/api/project/setAccess', checkAccess, function (req,res) {
		api.project.setAccess(req, res);
	});

	/**
	* @api {post} /api/project/addInvites Add invites
	* @apiName add invites
	* @apiGroup Project
	* @apiUse token
	* @apiParam {String} project Uuid of project
	* @apiParam {Object} access Access object
	* @apiSuccess {json} access Project access object
	* @apiSuccessExample {json} Success-Response:
	* {
  	*  read: ['test'],
  	*  edit: ['uuid-mocha-test-project'],
	*  options: {
	*    share: true,
	*    download: false,
	*    isPublic: false
	*  }
	*}
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request access or project do not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['access', 'project']
	*		}
	*	}
	* }
	* @apiError Not_found If project doesn't exist(404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "No such project.",
	*		"code": "404"
	*	}
	* }
	*/
	// =====================================
	// CREATE NEW PROJECT  =================
	// =====================================
	// change route to /api/project/invite
	app.post('/api/project/addInvites', checkAccess, api.project.addInvites, errorHandler);

	/**
	* @api {post} /api/upload/get Get upload
	* @apiName get upload
	* @apiGroup Upload
	* @apiUse token
	* @apiParam {String} file_id
	* @apiSuccess {Object} file Upload file
	* @apiSuccess {Object} layer Related layer
	* @apiSuccess {Object} project Related project
	* @apiSuccessExample {json} Success-Response:
	* {
	*  file: {
	*    _id: '56af0e566f8ca08221ee2ca7',
	*    lastUpdated: '2016-02-01T07:50:46.730Z',
	*    created: '2016-02-01T07:50:46.726Z',
	*    dataSize: '109770',
	*    type: 'postgis',
	*    originalName: 'shapefile.zip',
	*    name: 'shapefile',
	*    createdBy: 'uuid-mocha-test-project',
	*    uuid: 'file_tzcqhdaecyhmqraulgby',
	*    __v: 0,
	*    access: {
	*      clients: [],
	*      projects: [],
	*      users: []
	*    },
	*    data: {
	*      image: [Object],
	*      postgis: [Object]
	*    },
	*    format: [],
	*    keywords: [],
	*    files: []
	*  },
	*  layer: null
	* }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request file_id do not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['file_id']
	*		}
	*	}
	* }
	* @apiError Not_found If file doesn't upload(404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "no such upload status id",
	*		"code": "404"
	*	}
	* }
	*/
	// =====================================
	// GET UPLOAD ==========================
	// =====================================
	app.get('/api/upload/get', checkAccess, api.upload.getUpload, errorHandler);

	/**
	* @api {post} /api/import Import data
	* @apiName import
	* @apiGroup Data
	* @apiUse token
	* @apiParam {Buffer} data File buffer
	*
	* @apiSuccess {json} status Upload Status JSON
	* @apiSuccessExample {json} Success-Response:
	* {
	*	"file_id":"file_fxqzngykgzjxtsunulti",
	*	"user_id":"test-user-uuid",
	*	"filename":"shapefile.zip",
	*	"timestamp":1453063189097,
	*	"status":"Processing",
	*	"size":109770,
	*	"upload_success":true,
	*	"error_code":null,
	*	"error_text":null
	* }
	*/
	// =====================================
	// IMPORT DATA to POSTGIS ==============
	// =====================================
	// change to /api/data/import
	app.post('/api/import', checkAccess, function (req, res) {
		api.upload.upload(req, res);
	});

	// =====================================
	// GET UPLOAD STATUS ===================
	// =====================================
	// change to /api/import/status
	app.get('/api/import/status', checkAccess, function (req, res) {
		api.upload.getUploadStatus(req, res);
	});

	// =====================================
	// JOIN BETA MAIL ======================
	// =====================================
	app.get('/api/joinbeta', function (req, res) {
		api.portal.joinBeta(req, res);
	});

	/**
	* @api {post} /api/project/update Update project
	* @apiName update
	* @apiGroup Project
	* @apiUse token
	* @apiParam {String} project_id Uuid of project which should be update
	* @apiParam {String} logo New logo of project
	* @apiParam {String} header New header of project
	* @apiParam {Array} baseLayers New baseLayers of project
	* @apiParam {Object} position New position of project
	* @apiParam {Object} bounds New bounds of project
	* @apiParam {Array} layermenu New layermenu of project
	* @apiParam {Array} folders New folders of project
	* @apiParam {Object} controls New controls of project
	* @apiParam {String} description New description of project
	* @apiParam {Array} keywords New keywords of project
	* @apiParam {String} colorTheme New colorTheme of project
	* @apiParam {String} title New title of project
	* @apiParam {String} slug New slug of project
	* @apiParam {Object} connectedAccounts New connectedAccounts of project
	* @apiParam {Object} settings New settings of project
	* @apiParam {Array} categories New categories of project
	* @apiParam {Boolean} thumbCreated New thumbCreated of project
	* @apiParam {String} state New state of project
	* @apiParam {Array} pending New pending of project
	* @apiSuccess {json} access Project access object
	* @apiSuccessExample {json} Success-Response:
	* {
  	*   updated: ['logo', 'header', etc...],
  	*   project: {
	*    _id: '56af0e566f8ca08221ee2ca7',
	*    lastUpdated: '2016-02-01T07:50:46.730Z',
	*    created: '2016-02-01T07:50:46.726Z',
	*	 etc...
  	*   }
	* }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request project_id doesn't not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['project_id']
	*		}
	*	}
	* }
	* @apiError Not_found If project doesn't exist(404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "No such project.",
	*		"code": "404"
	*	}
	* }
	* @apiError Bad_request User haven't access to the project (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "No access.",
	*		"code": "400"
	*	}
	* }
	*/
	// =====================================
	// UPDATE PROJECT ======================
	// =====================================
	app.post('/api/project/update', checkAccess, api.project.update, errorHandler);

	/**
	* @api {post} /api/project/unique Unique project
	* @apiName unique
	* @apiGroup Project
	* @apiUse token
	* @apiSuccess {Boolean} unique Project access object
	* @apiSuccessExample {json} Success-Response:
	* {
  	*   updated: ['logo', 'header', etc...],
  	*   project: {
	*    _id: '56af0e566f8ca08221ee2ca7',
	*    lastUpdated: '2016-02-01T07:50:46.730Z',
	*    created: '2016-02-01T07:50:46.726Z',
	*	 etc...
  	*   }
	* }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	*/
	// =====================================
	// CHECK UNIQUE SLUG ===================
	// =====================================
	app.post('/api/project/unique', checkAccess, api.project.checkUniqueSlug, errorHandler);

	// =====================================
	// SET PROJECT HASH ====================
	// =====================================
	// change to /api/project/setHash
	app.post('/api/project/hash/set', checkAccess, function (req,res) {
		api.project.setHash(req, res);
	});

	// =====================================
	// GET PROJECT HASH ====================
	// =====================================
	// change to /api/project/getHash
	app.post('/api/project/hash/get', checkAccess, function (req,res) {
		api.project.getHash(req, res);
	});

	// =====================================
	// UPLOAD PROJECT LOGO  ================
	// =====================================
	// change to /api/project/setLogo
	app.post('/api/project/uploadlogo', checkAccess, function (req,res) {
		api.upload.projectLogo(req, res);
	});

	// =====================================
	// UPLOAD IMAGE ========================
	// =====================================
	// change to /api/import/image
	app.post('/api/upload/image', checkAccess, function (req,res) {
		api.upload.image(req, res);
	});

	// =====================================
	// SERVE STATIC FILES SECURELY  ========
	// =====================================
	// special route, don't touch for now
	app.get('/images/*', checkAccess, function (req,res) {
		api.file.sendImage(req, res);
	});

	// =====================================
	// SERVE STATIC FILES SECURELY  ========
	// =====================================
	// change to /api/... 
	// special route, don't touch for now
	app.get('/pixels/fit/*',checkAccess, function (req,res) {
		api.pixels.serveFitPixelPerfection(req, res);
	});

	// =====================================
	// SERVE STATIC FILES SECURELY  ========
	// =====================================
	// change to /api/... 
	app.get('/pixels/image/*', checkAccess, function (req,res) {
		api.pixels.serveImagePixelPerfection(req, res);
	});

	// =====================================
	// SERVE STATIC FILES SECURELY  ========
	// =====================================
	// change to /api/... 
	app.get('/pixels/screenshot/*', function (req,res) {
		api.pixels.serveScreenshot(req, res);
	});

	// =====================================
	// SERVE STATIC FILES SECURELY  ========
	// =====================================
	// change to /api/... 
	app.get('/pixels/*', checkAccess, function (req,res) {
		api.pixels.servePixelPerfection(req, res);
	});

	// =====================================
	// GET MAPBOX ACCOUNT ==================
	// =====================================
	// change to /api/tools/mapbox/get
	app.post('/api/util/getmapboxaccount', checkAccess, function (req, res) {
		api.provider.mapbox.getAccount(req, res);
	});
	
	// =====================================
	// CREATE SNAPSHOT =====================
	// =====================================
	// create snapshot of current map
	// change to /api/tools/snap/create
	app.post('/api/util/snapshot', checkAccess, function (req, res) {
		api.pixels.createSnapshot(req, res);
	});

	// =====================================
	// CREATE THUMBNAIL ====================
	// =====================================
	// change to /api/tools/thumb/create
	app.post('/api/util/createThumb', checkAccess, function (req, res) {
		api.pixels.createThumb(req, res);
	});

	// =====================================
	// CREATE PDF SNAPSHOT =================
	// =====================================
	// change to /api/tools/pdf/create
	app.post('/api/util/pdfsnapshot', checkAccess, function (req, res) {
		api.pixels.createPDFSnapshot(req, res);
	});

	// =====================================
	// AUTO-CREATE LEGENDS =================
	// =====================================
	// change to /api/layer/legends/create
	app.post('/api/layer/createlegends', checkAccess, function (req, res) {
		api.legend.create(req, res);
	});

	// =====================================
	// GET GEOJSON FILES ===================
	// =====================================
	// change to /api/data/get ... 
	// todo: perhaps improve this, put all downloads together, with type/format in query/form.. todo later
	app.post('/api/geojson', checkAccess, function (req,res) {
		api.file.getGeojsonFile(req, res);
	});
	
	// =====================================
	// GET FILE DOWNLOAD ===================
	// =====================================
	// change to /api/data/download
	app.get('/api/file/download', checkAccess, function (req, res) {
		api.file.download(req, res);
	});

	// =====================================
	// GET FILE DOWNLOAD ===================
	// =====================================
	// change to /api/tools/tilecount
	app.get('/api/util/getTilecount', checkAccess, function (req, res) {
		api.geo.getTilecount(req, res);
	});

	/**
	* @api {post} /api/geo/json2carto Return carto css
	* @apiName json2carto
	* @apiGroup Geo
	* @apiUse token
	* @apiParam {Object} style Style object parameter
	* @apiSuccess {String} cartoCss Carto css
	* @apiSuccessExample {String} Success-Response:
	* "@polygon_opacity: 1;
	*#layer {
	*
	*	polygon-opacity: @polygon_opacity;
	*
	*	polygon-fill: red;
	*
	*}"
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request uuid does not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing style!",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['style']
	*		}
	*	}
	* }
	*/
	// =====================================
	// GET GEOJSON FILES ===================
	// =====================================
	// change to /api/tools/json2carto
	app.post('/api/geo/json2carto', checkAccess, api.geo.json2carto, errorHandler);

	// =====================================
	// DOWNLOAD DATASET ====================
	// =====================================
	// change to /api/data/download (POST/GET routes with same name no problem)
	app.post('/api/file/downloadDataset', checkAccess, function (req,res) {
		api.postgis.downloadDatasetFromFile(req, res);
	});

	// =====================================
	// DOWNLOAD DATASET ====================
	// =====================================
	// change to /api/layer/download
	app.post('/api/layer/downloadDataset', checkAccess, function (req,res) {
		api.postgis.downloadDatasetFromLayer(req, res);
	});
	
	/**
	* @api {post} /api/file/update Update a file
	* @apiName update
	* @apiGroup File
	* @apiUse token
	* @apiParam {String} uuid Uuid of file
	*
	* @apiSuccess {Array} updated Array of updated fields
	* @apiSuccess {Object} file Updated file
	* @apiSuccessExample {json} Success-Response:
	* {
	*   "updated": ['name', 'description'],
	*   "file": {
	*       lastUpdated: '2016-01-19T12:49:49.076Z',
    *       created: '2016-01-19T12:49:48.943Z',
    *       ... etc
	*   }
	* }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError File with uuid <code>uuid</code> doesn't exist. (422)
	* @apiErrorExample {json} Error-Response:
	* Error 422: File doesn't exist
	* {
	*    "error": "bad file uuid"
	* }
	*/
	// =====================================
	// UPDATE FILE =========================
	// =====================================
	// change to /api/data/update
	app.post('/api/file/update', checkAccess, api.file.update, errorHandler);

	/**
	* @api {post} /api/file/getLayers Get layers
	* @apiName getLayers
	* @apiGroup File
	* @apiUse token
	* @apiParam {String} type Type of file(raster or postgis)
	* @apiParam {Object} data Object with file_id field for raster files or database_name and table_name for postgis files
	* @apiSuccess {Array} array of layers
	* @apiSuccessExample {json} Success-Response:
	* [
	*   {
	*	  uuid: 'layer uuid',
	*	  title: 'layer title',
	*	  description: 'layer description',
	*	  ... etc
	*   }
	* ]
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Missing required fields. (422)
	* @apiErrorExample {json} Error-Response:
	* Error 422: Missing type parameter or database_name and table_name for postgis type
	* {
	*    "error": "Missing information. Check out https://docs.systemapic.com/ for details on the API."
	* }
	* @apiError Missing required fields. (422)
	* @apiErrorExample {json} Error-Response:
	* Error 422: Missing file_id for rater type
	* {
	*    "error": "request body should contains data.file_id"
	* }
	*/
	// =====================================
	// GET LAYERS OF FILE ==================
	// =====================================
	// change to /api/data/getLayers
	app.post('/api/file/getLayers', checkAccess, api.file.getLayers);

	/**
	* @api {post} /api/dataset/share Share dataset
	* @apiName shareDataset
	* @apiGroup File
	* @apiUse token
	* @apiParam {String} dataset File id
	* @apiParam {Array} users Array of user's ids
	* @apiSuccess {Object} err Error object
	* @apiSuccess {Boolean} success
	* @apiSuccess {Object} file_shared File shared object
	* @apiSuccess {Array} users_shared_with Shared users
	* @apiSuccessExample {json} Success-Response:
	* {
	*  err: null
	*  success: true,
	*  file_shared: {
	*	file_name: 'fileName',
	*	file_uuid: 'fileUuid',
	*  }
	*  users_shared_with : ['userId']
	* }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request dataset or users do not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['users', 'dataset']
	*		}
	*	}
	* }
	* @apiError Not_found file does not exist (404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "No such file.",
	*		"code": "404"
	*	}
	* }
	*/
	// =====================================
	// SHARE DATASET =======================
	// =====================================
	// change to /api/data/share
	app.post('/api/dataset/share', checkAccess, api.file.shareDataset, errorHandler);
	
	/**
	* @api {post} /api/file/delete Delete data
	* @apiName delete
	* @apiGroup File
	* @apiUse token
	* @apiParam {String} file_id File id
	* @apiSuccess {json} status Upload Status JSON
	* @apiSuccessExample {json} Success-Response:
	* {
	*   "success": true,
	*   "err": {}
	* }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request file_id does not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['file_id']
	*		}
	*	}
	* }
	* @apiError Not_found database_name or table_name does not exist in file.data.postgis or file_id doesn't exist in file.data.raster (404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "404"
	*	}
	* }
	* @apiError Internal_server_error Problems with drop table (500)
	* @apiErrorExample {json} Error-Response:
	* Error 500: Internal server error
	* {
	*    "error": {
	*		"message": "Can't drop table tableName",
	*		"code": "500"
	*	}
	* }
	* @apiError Not_found If file type is postgis and file with file.data.posgis.table_name id doesn't exist(404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "No such file.",
	*		"code": "404"
	*	}
	* }
	*/
	// =====================================
	// DELETE DATA =========================
	// =====================================
	// change to /api/data/delete
	app.post('/api/file/delete', checkAccess, api.file.deleteFile, errorHandler);

	/**
	* @api {post} /api/file/addtoproject Add file to the project
	* @apiName addToTheProject
	* @apiGroup File
	* @apiUse token
	* @apiParam {String} file_id File id
	* @apiParam {String} project_id Project id
	* @apiSuccess {json} status Upload Status JSON
	* @apiSuccessExample {json} Success-Response:
	*{
	*  _id: '56a76e07b6aa58e535c88d22',
	*  lastUpdated: '2016-01-26T13:00:55.159Z',
	*  created: '2016-01-26T13:00:55.018Z',
	*  createdByUsername: 'relatedProjectCreatedByUsername',
	*  createdByName: 'relatedProjectCreatedByName',
	*  createdBy: 'relatedProjectCreatedBy',
	*  uuid: 'relatedProjectInfo',
	*  layers: ['56a76e07b6aa58e535c88d23'],
	*  files: ['56a76e07b6aa58e535c88d21'],
	*  roles: [],
	*  access: {
	*    options: {
	*      isPublic: false,
	*      download: false,
	*      share: true
	*    },
	*    edit: [],
	*    read: ['test-user-uuid']
	*  },
	*  categories: [],
	*  keywords: [],
	*  description: 'Description',
	*  slug: 'projectslug',
	*  name: 'relatedProjectName'
	* etc...
	*}
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request file_id or project_id does not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['file_id', 'project_id']
	*		}
	*	}
	* }
	* @apiError Not_found File with specific id not found(404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "No such file",
	*		"code": "404"
	*	}
	* }
	* @apiError Not_found Project with specific id not found(404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "No such project",
	*		"code": "404"
	*	}
	* }
	*/
	// =====================================
	// ADD/LINK FILE TO NEW PROJECT ========
	// =====================================
	// change to /api/project/addData
	app.post('/api/file/addtoproject', checkAccess, api.file.addFileToProject, errorHandler);

	/**
	* @api {post} /api/layers/delete Delete data
	* @apiName delete
	* @apiGroup Layer
	* @apiUse token
	* @apiParam {String} layer_id Layer id
	* @apiParam {String}  project__id Project id 
	* @apiSuccess {json} status Upload Status JSON
	* @apiSuccessExample {json} Success-Response:
	* {
	*   "success": true,
	*   "err": {}
	* }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request layer_id or project_id does not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['layer_id', 'project_id']
	*		}
	*	}
	* }
	* @apiError Not_found Layer with specific id not found(404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "No such layers",
	*		"code": "404"
	*	}
	* }
	* @apiError Not_found Project with specific id not found(404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "No such project.",
	*		"code": "404"
	*	}
	* }
	*/
	// =====================================
	// DELETE LAYER(S) =====================
	// =====================================
	// change to /api/layer/delete (layer, not layers)
	app.post('/api/layers/delete', checkAccess, api.layer.deleteLayer, errorHandler);

	/**
	* @api {post} /api/layers Get layers related with project
	* @apiName get layers by project id
	* @apiGroup Layer
	* @apiUse token
	* @apiParam {String} project Project uuid
	* @apiSuccess {Array} layers Array of layers related with project
	* @apiSuccessExample {json} Success-Response:
	*[{
	*    data: [Object],
	*    __v: 0,
	*    uuid: 'relatedLayerUuid',
	*    title: 'relatedLayerTitle',
	*    description: 'relatedLayerDescription',
	*    created: Mon Jan 25 2016 11: 37: 44 GMT + 0000(UTC),
	*    lastUpdated: Mon Jan 25 2016 11: 37: 44 GMT + 0000(UTC),
	*    _id: 56 a60908fdce40a15eca6773
	*}, and etc]
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }	
	* @apiError Bad_request project does not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['project']
	*		}
	*	}
	* }
	*/
	// =====================================
	// LAYERS ==============================
	// =====================================
	// change to /api/layer/get 
	app.post('/api/layers', checkAccess, api.layer.get, errorHandler); // todo: layer/layers !! make all same...

	/**
	* @api {post} /api/layers/new Create layer
	* @apiName create
	* @apiGroup Layer
	* @apiUse token
	* @apiParam {String} title Title of new layer
	* @apiParam {String} description Description of new layer
	* @apiParam {String} legend Legend of new legend
	* @apiParam {String} file File of new layer
	* @apiParam {String} metadata Metadata of new layer
	* @apiParam {String} data Data of new layer
	* @apiParam {String} style Style of new layer
	* @apiSuccess {JSON} Layer New Layer object
	* @apiSuccessExample {json} Success-Response:
	* {
	*    __v: 0,
	*    lastUpdated: '2016-01-20T10:55:30.983Z',
	*    created: '2016-01-20T10:55:30.983Z',
	*    legend: '',
	*    description: 'new layer description',
	*    title: 'new layer title',
	*    uuid: 'layer-ae4fc38c-58f0-4468-81e7-7330d226dc24',
	*    _id: '569f67a2ebb7233b667d8a02'
	* }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	*/
	// =====================================
	// CREATE NEW LAYER ====================
	// =====================================
	// change to /api/layer/create 
	app.post('/api/layers/new', checkAccess, api.layer.create);

	// =====================================
	// NEW OSM LAYERS ======================
	// =====================================
	// change to /api/layer/osm/create 
	app.post('/api/layers/osm/new', checkAccess, api.layer.createOSM, errorHandler); // todo: api.layer.osm.create()

	/**
	* @api {post} /api/layer/update Update layer
	* @apiName update
	* @apiGroup Layer
	* @apiUse token
	* @apiParam {String} layer uuid of updated layer
	* @apiParam {String} title New title of updated layer
	* @apiParam {String} description New description of updated layer
	* @apiParam {String} satellite_position New satellite_position of updated layer
	* @apiParam {String} copyright New copyright of updated layer
	* @apiParam {String} tooltip New tooltip of updated layer
	* @apiParam {String} style New style of updated layer
	* @apiParam {String} filter New filter of updated layer
	* @apiParam {String} legends New legends of updated layer
	* @apiParam {String} opacity New opacity of updated layer
	* @apiParam {Number} zIndex New zIndex of updated layer
	* @apiParam {Object} data New data of updated layer
	* @apiSuccess {String} response Update info 
	* @apiSuccessExample {String} Success-Response:
	* 'save done'
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Missing required fields. (422)
	* @apiErrorExample {json} Error-Response:
	* Error 422: Missing layer parameter or layer with such id doesn't exist
	* {
	*    "error": "Missing information. Check out https://docs.systemapic.com/ for details on the API."
	* }
	*/
	// =====================================
	// UPDATE LAYERS =======================
	// =====================================
	app.post('/api/layer/update', checkAccess, api.layer.update);

	// =====================================
	// RELOAD LAYER METADATA ===============
	// =====================================
	// change to /api/layer/reloadMeta (camelcase) 
	app.post('/api/layer/reloadmeta', checkAccess, api.layer.reloadMeta, errorHandler);

	// =====================================
	// SET CARTOCSS ========================
	// =====================================
	// change to /api/layer/carto/set 
	app.post('/api/layers/cartocss/set', checkAccess, function (req, res) {
		api.layer.setCartoCSS(req, res);
	});

	// =====================================
	// GET CARTOCSS ========================
	// =====================================
	// change to /api/layer/carto/get 
	app.post('/api/layers/cartocss/get', checkAccess, function (req, res) {
		api.layer.getCartoCSS(req, res);
	});

	/**
	* @api {post} /api/user/update Update user
	* @apiName update
	* @apiGroup User
	* @apiUse token
	* @apiParam {String} uuid Uuid of user
	* @apiSuccess {Array} updated Array of updated fields
	* @apiSuccess {Object} user Updated user
	* @apiSuccessExample {json} Success-Response:
	* {
	*   "updated": ['phone', 'company'],
	*   "user": {
	*       lastUpdated: '2016-01-19T12:49:49.076Z',
    *       created: '2016-01-19T12:49:48.943Z',
    *       ... etc
	*   }
	* }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request uuid does not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['uuid']
	*		}
	*	}
	* }
	* @apiError Bad_request uuid does not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "No access.",
	*		"code": "400"
	*	}
	* }
	* @apiError Not_found If user doesn't exist(404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "No such user.",
	*		"code": "404"
	*	}
	* }
	*/
	// =====================================
	// UPDATE USER INFORMATION  ============
	// =====================================
	app.post('/api/user/update', checkAccess, api.user.update, errorHandler);

	// =====================================
	// CREATE NEW USER =====================
	// =====================================
	app.post('/api/user/new', checkAccess, function (req,res) { // todo: remove /new route
		api.user.create(req, res);
	});
	// keep only this route, not /api/user/new
	app.post('/api/user/create', checkAccess, function (req,res) {
		api.user.create(req, res);
	});

	// TODO this endpoint does not exist
	// =====================================
	// DELETE USER =========================
	// =====================================
	app.post('/api/user/delete', checkAccess, function (req,res) {
		api.user.deleteUser(req, res);
	});

	// =====================================
	// DELETGATE USER ======================
	// =====================================
	app.post('/api/user/delegate', checkAccess, function (req,res) {
		api.delegateUser(req, res);
	});

	/**
	* @apiIgnore
	* @api {post} /api/user/unique Is unique email
	* @apiName unique email
	* @apiGroup User
	* @apiUse token
	* @apiParam {String} email Email which should be check
	* @apiSuccess {Boolean} unique True if email is unique
	* @apiSuccessExample {json} Success-Response:
	* {
	*   "unique": true
	* }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request Email does not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['email']
	*		}
	*	}
	* }
	*/
	// =====================================
	// CHECK UNIQUE USER/EMAIL =============
	// =====================================
	app.post('/api/user/unique', checkAccess, api.user.checkUniqueEmail, errorHandler);

	/**
	* @apiIgnore
	* @api {post} /api/user/uniqueUsername Is unique email
	* @apiName unique username
	* @apiGroup User
	* @apiUse token
	* @apiParam {String} username Username which should be check
	* @apiSuccess {Boolean} unique True if username is unique
	* @apiSuccessExample {json} Success-Response:
	* {
	*   "unique": true
	* }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request Username does not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['username']
	*		}
	*	}
	* }
	*/
	// =====================================
	// CHECK UNIQUE USER/EMAIL =============
	// =====================================
	app.post('/api/user/uniqueUsername', api.user.checkUniqueUsername, errorHandler);

	/**
	* @apiIgnore
	* @api {post} /api/user/uniqueEmail Is unique email
	* @apiName unique email
	* @apiGroup User
	* @apiUse token
	* @apiParam {String} email Email which should be check
	* @apiSuccess {Boolean} unique True if email is unique
	* @apiSuccessExample {json} Success-Response:
	* {
	*   "unique": true
	* }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request Email does not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['email']
	*		}
	*	}
	* }
	*/
	// =====================================
	// CHECK UNIQUE USER/EMAIL =============
	// =====================================
	app.post('/api/user/uniqueEmail', api.user.checkUniqueEmail, errorHandler);

	/**
	* @api {post} /api/user/invite Send invite mail
	* @apiName Send invite mail
	* @apiGroup User
	* @apiUse token
	* @apiParam {Array} emails Array of emails
	* @apiParam {String} customMessage Custom message
	* @apiParam {Object} access Access object	
	* @apiSuccess {Object} error error object
	* @apiSuccessExample {json} Success-Response:
	* {
	*   "error": null
	* }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request Emails or customMessage or access do not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['emails', 'customMessage', 'access']
	*		}
	*	}
	* }
	*/
	// =====================================
	// SEND INVITE MAIL ====================
	// =====================================
	app.post('/api/user/invite', checkAccess, api.user.invite, errorHandler);

	/**
	* @api {post} /api/user/requestContact Request contact
	* @apiName Request contact
	* @apiGroup User
	* @apiUse token
	* @apiParam {String} contact User id
	* @apiSuccess {Object} error error object
	* @apiSuccessExample {json} Success-Response:
	* {
	*   "error": null
	* }
	* @apiError Unauthorized The <code>access_token</code> is invalid. (401)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Unauthorized
	* {
	*    "error": "Invalid access token."
	* }
	* @apiError Bad_request Contact does not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['contact']
	*		}
	*	}
	* }
	* @apiError Bad_request user does not exist in request body (404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: Not found
	* {
	*    "error": {
	*		"message": "No such user.",
	*		"code": "404"
	*	}
	* }
	*/
	// =====================================
	// REQUEST CONTACT =====================
	// =====================================
	app.post('/api/user/requestContact', checkAccess, api.user.requestContact, errorHandler);

	// =====================================
	// REQUEST CONTACT =====================
	// =====================================
	// change to /api/user/acceptContact/*
	app.get('/api/user/acceptContactRequest/*', function (req,res) {
		api.user.acceptContactRequest(req, res);
	});

	// =====================================
	// INVITE TO PROJECTS ==================
	// =====================================
	// todo: see if this can be removed (replaced by /api/user/invite?)
	app.post('/api/user/inviteToProjects', checkAccess, api.user.inviteToProjects, errorHandler);

	// =====================================
	// CHECK UNIQUE USER/EMAIL =============
	// =====================================
	app.post('/api/invite/link', checkAccess, function (req,res) {
		api.user.getInviteLink(req, res);
	});

	// =====================================
	// access: SET PROJECT ACCESS  =========
	// =====================================
	app.post('/api/access/set/project', checkAccess, function (req,res) {
		api.access.setProject(req, res);
	});

	// =====================================
	// access: GET ROLE  ===============
	// =====================================
	app.post('/api/access/getrole', checkAccess, function (req,res) {
		api.access.getRole(req, res);
	});

	// =====================================
	// access: SET ROLE  ===============
	// =====================================
	app.post('/api/access/setrolemember', checkAccess, function (req,res) {
		api.access.setRoleMember(req, res);
	});

	// =====================================
	// access: SET ROLE SUPERADMIN =========
	// =====================================
	app.post('/api/access/super/setrolemember', checkAccess, function (req,res) {
		api.access.setSuperRoleMember(req, res);
	});

	// =====================================
	// access: SET ROLE  ===============
	// =====================================
	app.post('/api/access/portal/setrolemember', checkAccess, function (req,res) {
		api.access.setPortalRoleMember(req, res);
	});

	// =====================================
	// access: SET NO ROLE  ================
	// =====================================
	app.post('/api/access/setnorole', checkAccess, function (req,res) {
		api.access.setNoRole(req, res);
	});

	// =====================================
	// CHECK RESET PASSWORD TOKEN ==========
	// =====================================
	app.post('/reset/checktoken', function (req, res) {
		api.auth.checkResetToken(req, res);
	});

	/**
	* @api {post} /reset Send reset password mail
	* @apiName send reset password mail
	* @apiGroup User
	* @apiParam {String} email User's email
	* @apiSuccess {String} text Please check your email for password reset link.
	* @apiError Bad_request Email does not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['email']
	*		}
	*	}
	* }
	* @apiError Not_found If user with specific email doesn't exist(404)
	* @apiErrorExample {json} Error-Response:
	* Error 404: User not found
	* {
	*    "error": {
	*		"message": "No such user.",
	*		"code": "404"
	*	}
	* }
	*/
	// =====================================
	// RESET PASSWORD ======================
	// =====================================
	// change to /api/... 
	app.post('/reset', api.auth.requestPasswordReset, errorHandler);

	// =====================================
	// RESET PASSWORD ======================
	// =====================================
	// change to /api/... 
	app.get('/reset', function (req, res) {
		api.auth.serveResetPage(req, res);
	});

	/**
	* @api {post} /reset/password Reset password
	* @apiName reset password
	* @apiGroup User
	* @apiParam {String} password New password
	* @apiParam {String} token Access token
	* @apiSuccess {String} text Moved Temporarily. Redirecting to /
	* @apiError Bad_request password or token do not exist in request body (400)
	* @apiErrorExample {json} Error-Response:
	* Error 400: Bad request
	* {
	*    "error": {
	*		"message": "Missing information. Check out https://docs.systemapic.com/ for details on the API.",
	*		"code": "400",
	*		"errors": {
	*			"missingRequiredFields": ['token', 'password']
	*		}
	*	}
	* }
	* @apiError Not_found If file doesn't upload(404)
	* @apiErrorExample {json} Error-Response:
	* Error 401: Invalid token
	* {
	*    "error": {
	*		"message": "Invalid access token.",
	*		"code": "401"
	*	}
	* }
	*/
	// =====================================
	// CREATE PASSWORD =====================
	// ===================================== 
	// change to /api/... 
	app.post('/reset/password', api.auth.createPassword, errorHandler);

	// =====================================
	// ZXCVBN DICTIONARY =================
	// ===================================== 
	// change to /api/... 
	app.get('/zxcvbn.js', function (req, res) {
		fs.readFile('../public/js/lib/zxcvbn/zxcvbn.js', function (err, data) {
			res.send(data);
		});
	});

	// ===================================== // todo: rename route to /api/config/client.js
	// SERVER CLIENT CONFIG ================
	// =====================================
	// change to /api/... 
	app.get('/clientConfig.js', function (req, res) {
		var configString = 'var systemapicConfigOptions = ' + JSON.stringify(api.clientConfig);
		res.setHeader("content-type", "application/javascript");
		res.end(configString);
	});

	// ===================================== // todo: rename route to /api/loginConfig.js
	// SERVER LOGIN CONFIG =================
	// ===================================== 
	// change to /api/... 
	app.get('/loginConfig.js', function (req, res) {
		var configString = 'var loginConfig = ' + JSON.stringify(api.loginConfig);
		res.setHeader("content-type", "application/javascript");
		res.end(configString);
	});

	// =====================================
	// DEBUG: PHANTOMJS FEEDBACK ===========
	// ===================================== 
	app.post('/api/debug/phantom', checkAccess, function (req, res) {
		res.end();
	});

	// =====================================
	// LOGIN ===============================
	// =====================================
	app.get('/login', function(req, res) {
		console.log('get login');
		api.portal.login(req, res);
	});

	// =====================================
	// PRIVACY POLICY ======================
	// =====================================
	// change to /api/privacy-policy
	app.get('/privacy-policy', function(req, res) {
		// api.portal.login(req, res);
		res.render('../../views/privacy.ejs');
	});

	// // =====================================
	// // SIGNUP ==============================
	// // =====================================
	// app.get('/signup', function(req, res) {
	// 	api.portal.signup(req, res);
	// });

	// =====================================
	// LOGOUT ==============================
	// =====================================
	app.get('/logout', function(req, res) {
		api.portal.logout(req, res);
	});

	// =====================================
	// INVITE ==============================
	// =====================================
	app.get('/invite/*', function(req, res) {
		api.portal.invite(req, res);
	});

	// // =====================================
	// // INVITE ==============================
	// // =====================================
	// app.get('/api/invitation/*', function(req, res) {
	// 	api.portal.invitation(req, res);
	// });

	// =====================================
	// LOGIN ===============================
	// =====================================
	// app.post('/login', passport.authenticate('local-login', {
	// 	successRedirect : '/', // redirect to the portal
	// 	failureRedirect : '/login', // redirect back to the signup page if there is an error
	// 	failureFlash : true // allow flash messages
	// }));

	// =====================================
	// FORGOT PASSWORD =====================
	// =====================================
	app.post('/api/forgot', function (req, res) {
		api.auth.forgotPassword(req, res);
	});

	// =====================================
	// FORGOT PASSWORD =====================
	// =====================================
	app.get('/forgot', function (req, res) {
		res.render('../../views/forgot.ejs', {
		});
	});

	// =====================================
	// REGISTER ACCOUNT ====================
	// =====================================
	// app.post('/register', passport.authenticate('local-signup', {
	// 	successRedirect : '/', // redirect to the secure profile section
	// 	failureRedirect : '/invite', // redirect back to the signup page if there is an error
	// 	failureFlash : true // allow flash messages
	// }));	
	// =====================================
	// WILDCARD PATHS ======================		
	// =====================================
	app.get('*', function (req, res) {
		api.portal.wildcard(req, res);
	});

	// helper function : if is logged in
	function isLoggedIn(req, res, next) {
		if (req.isAuthenticated()) return next();
		res.redirect('/');
	}
	
};