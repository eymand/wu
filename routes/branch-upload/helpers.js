// app/routes/helpers.js rsub

// database schemas
var Project 	= require('../models/project');
var Clientel 	= require('../models/client');	// weird name cause 'Client' is restricted name
var User  	= require('../models/user');
var File 	= require('../models/file');
var Layers 	= require('../models/layer');

// file handling
var fs 		= require('fs-extra');
var fss 	= require("q-io/fs");
var utf8 	= require("utf8");

// utils
var async 	= require('async');
var util 	= require('util');
var request 	= require('request');
var uuid 	= require('node-uuid');
var _ 		= require('lodash-node');
var zlib 	= require('zlib');
var uploadProgress = require('node-upload-progress');
var crypto      = require('crypto');
var nodemailer  = require('nodemailer');
var nodepath    = require('path');

// superusers
var superusers = [
			'user-9fed4b5f-ad48-479a-88c3-50f9ab44b17b', // KO
			'user-e6e5d7d9-3b4c-403b-ad80-a854b0215831'  // J
		]

// convenience method for checking hardcoded super user
function superadmin(user) {
	if (superusers.indexOf(user.uuid) >= 0) return true;
	return false;
}

// function exports
module.exports = api = {

								    

	// #########################################
	// ###  API: Create Project              ###
	// #########################################
	createProject : function (req, res) {


		console.log('________________');
		console.log('API: createProject');
		console.log('_________________');

		var json = req.body;
		var user = req.user;

		// return if not authorized
		if (!api.can.create.project( user )) return api._errorUnauthorized(req, res);

		// create new project
		var project = api._newProject(user, json);

		// add to superadmins: just add the uuid to User(s)
		api.addProjectToSuperadmins(project.uuid);
		
		// add default mapbox account		  		  // callback
		api._getMapboxAccount(req, res, project, 'systemapic', api._returnProject); // todo:::::
		

	},

	

	_newProject : function (user, json) {
		
		// new mongo model
		var project 		= new Project();
		project.uuid 		= 'project-' + uuid.v4();
		project.createdBy 	= user.uuid;
		project.createdByName   = user.firstName + ' ' + user.lastName;
		project.slug 		= json.name.replace(/\s+/g, '').toLowerCase();
		project.name 		= json.name;
		project.description 	= json.description;
		project.keywords 	= json.keywords;
		project.client 		= json.client;
		return project;

	},

	


	forgotPassword : function (req, res) {

		// render page and pass in flash data if applicable
		res.render('../../views/login.ejs', { message: 'Please check ' + req.body.email + ' for new login details.' });

		var email = req.body.email;

		User
		.findOne({'local.email' : email})
		.exec(function (err, user) {

			var password = crypto.randomBytes(16).toString('hex');
			user.local.password = user.generateHash(password);
			user.markModified('local');
		
			// save the user
			user.save(function(err, doc) { 

				// send email with login details to user
				api.sendNewUserEmail(user, password);
			
			});
		});
	},


	_errorUnauthorized : function (req, res) {
		var message = 'Unauthorized access attempt. Your IP ' + req._remoteAddress + ' has been logged.';
		res.end(JSON.stringify({ error : message }));
	},


	_returnProject : function (req, res, project, error) {

		Project
		.findOne({uuid : project.uuid})
		.populate('files')
		.populate('layers')
		.exec(function (err, project) {
			res.end(JSON.stringify({
				error : error,
				project: project}
			));
		});

	},




	// import mapbox account from username, create Layer Objects of all layers, return Layers to client.
	getMapboxAccount : function (req, res) {

		var username 	= req.body.username;
		var projectUuid = req.body.projectId;
		var userUuid 	= req.user.uuid;

		console.log('______________________')
		console.log('API: getMapboxAccount ');
		console.log('     username: ', username);
		console.log('     project', projectUuid);
		console.log('______________________')



		Project
		.findOne({uuid : projectUuid})
		.populate('files')
		.populate('layers')
		.exec(function (err, project) {

			// get mapbox account
			api._getMapboxAccount(req, res, project, username, api._returnProject);

		});


	},







	_getMapboxAccount : function (req, res, project, username, callback) {

		// add ops to async queue
		var ops = [];

		ops.push(function (callback) {
			// add default mapbox account: systemapic
			api.requestMapboxAccount(project, username, callback);
		});

		ops.push(function (project,  mapboxLayers, callback) {

			// create layers from mapbox data
			api.createLayersFromMapbox(project, mapboxLayers, callback);
		});

		ops.push(function (project, layers, callback) {

			// add layers to project
			api.addLayersToProject(project, layers, username, callback); 
		});

		ops.push(function(project, callback) {
			// save project
			project.markModified('layers');
			project.markModified('connectedAccounts');
			project.save(function (err, result) {
				callback(null, project);
			});
		});

		// do async and go to callback
		async.waterfall(ops, function (err, project) {

			if (err) {
				console.log('ERROR: ', err);
				return callback(req, res, project, err);
			}

			callback(req, res, project);
		});
	},

	// send request to mapbox
	requestMapboxAccount : function (project, username, callback) {
		
		console.log('______________________')
		console.log('API: requestMapboxAccount ');
		console.log('     username: ', username);
		console.log('     project', project.uuid);
		console.log('______________________')

		// mapbox url
		var url = 'http://api.tiles.mapbox.com/v3/' + username + '/maps.json';
		
		// send request to mapbox
		request(url, function (error, response, body) {

			// err handling
			if (error || response.statusCode != 200) return callback(error || response.statusCode);

			// parse result
			var mapboxLayers = JSON.parse(body);

			// return error thus cancel async waterfall if no layers
			if (_.isEmpty(mapboxLayers)) return callback({error : 'No layers in account.'}, project);

			// return layers to async ops
			callback(null, project, mapboxLayers);

		});

	},



	// mapbox helper fn
	createLayersFromMapbox : function (project, mapboxLayers, callback) {
		
		var layers = [];

		// create Layer in dB and save to Project
		mapboxLayers.forEach(function (ml) {

			// create Layers object
			var layer 		= new Layers();
			layer.uuid 		= 'layer-' + uuid.v4(); // unique uuid
			layer.title 		= ml.name;
			layer.description 	= ml.description;
			layer.legend		= ml.legend;
			layer.maxZoom 		= ml.maxzoom;
			layer.minZoom 		= ml.minzoom;
			layer.bounds 		= ml.bounds;
			layer.tms		= false;
			layer.data.mapbox 	= ml.id; 		// eg. rawger.geography-class
			layer.attribution 	= ml.attribution; 	// html

			// array of Layers objects
			layers.push(layer);

			// save
			layer.save(function (err) {
				if (err) throw err;
			});

			// remove old mapbox layer if existing
			_.remove(project.layers, function (old) {
				return old.data.mapbox == ml.id;	
			});
			
		});


		callback(null, project, layers);

	},


	// mapbox helper fn
	addLayersToProject : function (project, layers, username, callback) {

		// add new layers
		layers.forEach(function (add) {
			project.layers.addToSet(add._id); // mongodB Layer object
		});

		// add account
		project.connectedAccounts.mapbox.addToSet(username);

		// return to async ops
		callback(null, project);
	
	},








	addProjectToSuperadmins : function (projectUuid) {
		User.find({uuid : {$in : superusers}}, function (err, results) {
			results.forEach(function (user) {
				user.role.reader.projects.addToSet(projectUuid);
				user.role.editor.projects.addToSet(projectUuid);
				user.role.manager.projects.addToSet(projectUuid);
				user.markModified('role');
				user.save(function (err, res) {
					console.log('addProjectToSuperadmins OK: ' + projectUuid);
				});
			});
		});
	},


	



	// #########################################
	// ###  API: Delete Project              ###
	// #########################################
	deleteProject : function (req, res) {

		var user        = req.user;
		var userUuid 	= req.user.uuid;
		var clientUuid 	= req.body.clientUuid;
		var projectUuid = req.body.projectUuid;

		console.log('deleteProject: ', req.body);

		// find project (async)
		var model = Project.findOne({ uuid : projectUuid });
		model.exec(function (err, project) {
			
			// return if not authorized
			if (!api.can.remove.project( user, project )) {
				var message = 'Unauthorized access attempt. Your IP ' + req._remoteAddress + ' has been logged.';
				return res.end(JSON.stringify({ error : message }));
			};


			// remove project
			model.remove(function (err, result) {
				console.log('Removed project ' + project.name);
				console.log(err, result);
			
				// todo!!! remove from users 
				api.removeProjectFromEveryone(project.uuid);

				// return success
				return res.end(JSON.stringify({
					result : 'Project ' + project.name + ' deleted.'
				}));
			});
		});
	},


	removeProjectFromSuperadmin : function (projectUuid) {
		User.find({uuid : {$in : superusers}}, function (err, results) {
			results.forEach(function (user) {
				user.role.reader.projects.pull(projectUuid);
				user.role.editor.projects.pull(projectUuid);
				user.role.manager.projects.pull(projectUuid);
				user.markModified('role');
				user.save(function (err, res) {
					console.log('removeProjectFromSuperadmin OK: ' + projectUuid);		
				});
			});
		});
	},


	// remove project from all users
	removeProjectFromEveryone : function (projectUuid) {

		User
		.find({ $or : [ { 'role.reader.projects'  : projectUuid }, 
		 		{ 'role.editor.projects'  : projectUuid }, 
		 		{ 'role.manager.projects' : projectUuid } ]
		 })
		.exec(function (err, users) {
			users.forEach(function (user) {
				user.role.reader.projects.pull(projectUuid);
				user.role.editor.projects.pull(projectUuid);
				user.role.manager.projects.pull(projectUuid);
				user.markModified('role');
				user.save(function (err, res) {
					console.log('removeProjectFromEveryone OK: ' + projectUuid);		
				});
			});
		})

	},

	




	// #########################################
	// ###  API: Update Project              ###
	// #########################################
	updateProject : function (req, res) {
		console.log('Updating project.', req.body);

		var user        = req.user;
		var userid 	= req.user.uuid;
		var projectUuid = req.body.uuid;

		// find project
		var model = Project.findOne({ uuid : projectUuid });
		model.exec(function (err, project) {
			
			// return error
			if (err) return res.end(JSON.stringify({ error : 'Error retrieving project.' }));
			
			// return if not authorized
			if (!api.can.update.project(user, project)) {
				var message = 'Unauthorized access attempt. Your IP ' + req._remoteAddress + ' has been logged.';
				return res.end(JSON.stringify({ error : message }));
			};


					
			// valid fields
			var valid = [
				'name', 
				'logo', 
				'header', 
				'baseLayers',
				'position',
				'bounds',
				'layermenu', 
				'folders', 
				'controls', 
				'description', 
				'keywords', 
				'colorTheme',
				'title',
				'slug',
				'connectedAccounts'
			];
	
			var queries = {};

			// enqueue queries for valid fields
			valid.forEach(function (field) {
				if (req.body[field]) {
					console.log('Updating project field: ', field);

					// enqueue update
					queries = api._enqueueProjectUpdate(queries, field, req);
				}
			});

			// run queries to database
			async.parallel(queries, function(err, doc) {
				// handle err
				if (err) return res.end(JSON.stringify({ 
					error : "Error updating project." 
				}));
							
				// return doc
				res.end(JSON.stringify(doc));
			});
		});
	},


	// async mongo update queue
	_enqueueProjectUpdate : function (queries, field, req) {
		queries[field] = function(callback) {	
			return Project.findOne({ uuid : req.body.uuid }, function (err, project){
				project[field] = req.body[field];
				project.markModified(field);
				project.save(function(err) {
					if (err) console.error(err); // log error
				});
				return callback(err);
			});
		};
		return queries;
	},


	uploadProjectLogo : function (req, res) {

		var from = req.files.file.path;
		var file = 'image-' + uuid.v4();
		var to = '/var/www/data/images/' + file;

		// rename and move to image folder
		fs.rename(from, to, function (err) {
			
			if (err) res.end(JSON.stringify({error : err}));
			

			res.end(file);	// file will be saved by client
		});	
	},


	uploadClientLogo : function (req, res) {
		var from = req.files.file.path;
		var file = 'image-' + uuid.v4();
		var to   = '/var/www/data/images/' + file;

		// rename and move to image folder
		fs.rename(from, to, function (err) {
			if (err) res.end(JSON.stringify({error : err}));
			res.end(file);	// file will be saved by client
		});	
	},


	uploadImage : function (req, res) {
		var from = req.files.file.path;
		var file = 'image-' + uuid.v4();
		var to   = '/var/www/data/images/' + file;
		
		// rename and move to image folder
		fs.rename(from, to, function (err) {
			if (err) res.end(JSON.stringify({error : err}));
			res.end(file);	// file will be saved by client
		});	
	},












	// #########################################
	// ###  API: Create Client               ###
	// #########################################
	createClient : function (req, res) {

		// set vars
		var user = req.user;
		var json = req.body;

		// return if not authorized
		if (!api.can.create.client( user )) {
			var message = 'Unauthorized access attempt. Your IP ' + req._remoteAddress + ' has been logged.';
			return res.end(JSON.stringify({ error : message }));
		};

		// create new client
		var client 		= new Clientel();
		client.uuid 		= 'client-' + uuid.v4();
		client.createdBy 	= user.uuid;
		client.slug 		= json.name.replace(/\s+/g, '').toLowerCase();	// TODO: check if unique?
		client.name 		= json.name;
		client.description 	= json.description;
		client.keywords 	= json.keywords;

		// save new client
		client.save(function(err) {
			if (err) return res.end(JSON.stringify({
				error : 'Error creating client.'
			}));
			
			// add to superadmins
			api.addClientToSuperadmins(client.uuid);

			// saved ok
			res.end(JSON.stringify(client));
		});
	},


	addClientToSuperadmins : function (clientUuid) {
		User.find({uuid : {$in : superusers}}, function (err, results) {
			results.forEach(function (user) {
				user.role.reader.clients.addToSet(clientUuid);
				user.role.editor.clients.addToSet(clientUuid);
				user.role.manager.clients.addToSet(clientUuid);
				user.markModified('role');
				user.save(function (err, res) {
					console.log('addClientToSuperadmins OK: ' + clientUuid);		
				});
			});
		});
	},

	


	// #########################################
	// ###  API: Delete Client               ###
	// #########################################
	deleteClient : function (req, res) {
		var clientUuid = req.body.cid;
		var userUuid = req.user.uuid;
		var user = req.user;


		// find client
		var model = Clientel.findOne({ uuid : clientUuid });
		model.exec(function (err, client) {
			
			// return error
			if (err) return res.end(JSON.stringify({ error : 'Error retrieving client.' }));
			
			// return if not authorized
			if (!api.can.remove.client(user, client)) {
				var message = 'Unauthorized access attempt. Your IP ' + req._remoteAddress + ' has been logged.';
				return res.end(JSON.stringify({ error : message }));
			};

			// remove client		
			model.remove(function(err, result) { 
				if (err) return res.end(JSON.stringify({
					error : 'Error removing client.'
				}));

				console.log('Removed client ', client.name);

				// remove from superadmins
				api.removeClientFromEveryone(client.uuid);

				// return
				res.end(JSON.stringify(result)); 
			});
		});
	},


	removeClientFromSuperadmin : function (clientUuid) {
		User.find({uuid : {$in : superusers}}, function (err, results) {
			results.forEach(function (user) {
				user.role.reader.clients.pull(clientUuid);
				user.role.editor.clients.pull(clientUuid);
				user.role.manager.clients.pull(clientUuid);
				user.markModified('role');
				user.save(function (err, res) {
					console.log('removeClientFromSuperadmin OK: ' + clientUuid);		
				});
			});
		});
	},

	// remove project from all users
	removeClientFromEveryone : function (clientUuid) {

		User
		.find({ $or : [ { 'role.reader.clients'  : clientUuid }, 
		 		{ 'role.editor.clients'  : clientUuid }, 
		 		{ 'role.manager.clients' : clientUuid } ]
		 })
		.exec(function (err, users) {
			users.forEach(function (user) {
				user.role.reader.clients.pull(clientUuid);
				user.role.editor.clients.pull(clientUuid);
				user.role.manager.clients.pull(clientUuid);
				user.markModified('role');
				user.save(function (err, res) {
					console.log('removeclientsFromEveryone OK: ' + clientUuid);		
				});
			});
		})

	},
	




	// #########################################
	// ###  API: Update Client               ###
	// #########################################
	updateClient : function (req, res) {

		var clientUuid 	= req.body.uuid;
		var userid 	= req.user.uuid;
		var user        = req.user;
		var queries 	= {};
		
		console.log('saving client: ', req.body);
		

		// find client
		var model = Clientel.findOne({ uuid : clientUuid });
		model.exec(function (err, client) {
			
			// return error
			if (err) return res.end(JSON.stringify({ error : 'Error retrieving client.' }));
			
			// return if not authorized
			if (!api.can.update.client(user, client)) {
				var message = 'Unauthorized access attempt. Your IP ' + req._remoteAddress + ' has been logged.';
				return res.end(JSON.stringify({ error : message }));
			};


			// add projects to client
			if (isObject(req.body.projects)) {
				queries.projects = function(callback) {
					return Clientel.findOne({ uuid : clientUuid }, function (err, client){
						client.projects = req.body.projects;
						client.save(function(err) {
							if (err) return res.end(JSON.stringify({
								error : 'Error updating client.'
							}));
						});
						return callback(err);
					});
				}
			}

			// update name
			if (req.body.name) {
				queries.name = function(callback) {
					return Clientel.findOne({ uuid : clientUuid }, function (err, client){
						client.name = req.body.name;
						client.save(function(err) {
							if (err) return res.end(JSON.stringify({
								error : 'Error updating client.'
							}));
						});
						return callback(err);
					});
				}
			}

			// update description
			if (req.body.description) {
				queries.description = function(callback) {
					return Clientel.findOne({ uuid : clientUuid }, function (err, client){
						client.description = req.body.description;
						client.save(function(err) {
							if (err) return res.end(JSON.stringify({
								error : 'Error updating client.'
							}));
						});
						return callback(err);
					});
				}
			}

			// update description
			if (req.body.logo) {
				queries.logo = function(callback) {
					return Clientel.findOne({ uuid : clientUuid }, function (err, client){
						client.logo = req.body.logo;
						client.save(function(err) {
							if (err) return res.end(JSON.stringify({
								error : 'Error updating client.'
							}));
						});
						return callback(err);
					});
				}
			}

			async.series(queries, function(err, doc) {
				if (err) return res.end(JSON.stringify({
					error : 'Error updating client.'
				}));		

				// return
				res.end(JSON.stringify(doc));
			});
		});
	},



	// #########################################
	// ###  API: Check Unique Client         ###
	// #########################################
	checkClientUnique : function (req, res) {
		Clientel.find({ 'slug' : req.body.slug}, function(err, result) { 
			if (result.length == 0) return res.end('{"unique" : true }'); 	// unique
			return res.end('{"unique" : false }');				// not unique
		});
	},



































	// #########################################
	// ###  API: Create User                 ###
	// #########################################
	createUser : function (req, res) {

		var user      = req.user;
		var email     = req.body.email;
		var lastName  = req.body.lastName;
		var firstName = req.body.firstName;

		// return if not authorized
		if (!api.can.create.user( user )) {
			var message = 'Unauthorized access attempt. Your IP ' + req._remoteAddress + ' has been logged.';
			return res.end(JSON.stringify({ error : message }));
		};

		// return if no email, or if email already in use
		if (!email) {
			var message = 'Unauthorized access attempt. Your IP ' + req._remoteAddress + ' has been logged.';
			return res.end(JSON.stringify({ error : message }));
		};


		// create the user
		var newUser            	= new User();
		newUser.uuid 		= 'user-' + uuid.v4();
		newUser.local.email    	= email;	
		var password 		= crypto.randomBytes(16).toString('hex');
		newUser.local.password 	= newUser.generateHash(password);
		newUser.firstName 	= firstName;
		newUser.lastName 	= lastName;
		newUser.company 	= 'Company';
		newUser.position 	= 'Position';
		newUser.createdBy	= user.uuid;
		
		// save the user
		newUser.save(function(err, doc) { 
			if (err) return res.end(JSON.stringify({
				error : 'Error creating user.'
			}));

			// send email with login details to user
			api.sendNewUserEmail(newUser, password);
			
			// return success
			res.end(JSON.stringify(doc));

		});

		

	},




	sendNewUserEmail : function (newUser, password) {
		console.log('sending email!')
		
		// todo: SSL
		var name    = newUser.firstName + ' ' + newUser.lastName;
		var email   = newUser.local.email;

		var from    = 'Systemapic.com <knutole@noerd.biz>';
		var to      = email;
		var body    = '<h1>Welcome to Systemapic.com ' + name + '</h1><br><h3>Login to <a href="http://systemapic.com" target="_blank">Systemapic.com</a> with the following details:</h3><br>Username: ' + email + ' <br>Password: ' + password;
		var subject = 'Congratulations! Here are your access details for Systemapic.com';
		var bcc     = ['knutole@noerd.biz']; // todo: add admins, superadmins to bcc

		// hook up to gmail
		var transporter = nodemailer.createTransport({
			service: 'gmail',
			auth: {
				user: 'knutole@noerd.biz',
				pass: '***REMOVED***@noerdbiz'
			}
		});

		// send email
		transporter.sendMail({
			from    : from,
			to      : to,	
			bcc     : bcc, 
			subject : subject,
			html    : body
		});

	},



	// #########################################
	// ###  API: Update User                 ###
	// ######################################### 	// todo: send email notifications on changes?
	updateUser : function (req, res) {

		console.log('update user: ', req.body);

		var userUuid 	= req.body.uuid;
		var authUser 	= req.user.uuid;
		var user        = req.user;

		// find user
		var model = User.findOne({ uuid : userUuid });
		model.exec(function (err, subject) {
			
			// return error
			if (err) return res.end(JSON.stringify({ error : 'Error retrieving client.' }));
			
			// return if not authorized
			if (!api.can.update.user(user, subject)) {
				var message = 'Unauthorized access attempt. Your IP ' + req._remoteAddress + ' has been logged.';
				return res.end(JSON.stringify({ error : message }));
			};





			// create async queue
			var queries = {};

			// save company
			if (req.body.company) {
				queries.company = function(callback) {
					return User.findOne({ uuid : userUuid }, function (err, user) {
						// set and save
						user.company = req.body.company;
						user.save(function(err) {
							if (err) console.error(err); // log error
						});
						// async callback
						return callback(err, user);
					});
				}
			}

			// save position
			if (req.body.position) {
				queries.position = function(callback) {
					return User.findOne({ uuid : userUuid }, function (err, user) {
						// set and save
						user.position = req.body.position;
						user.save(function(err) {
							if (err) console.error(err); // log error
						});
						// async callback
						return callback(err, user);
					});
				}
			}

			// save phone
			if (req.body.phone) {
				queries.phone = function(callback) {
					return User.findOne({ uuid : userUuid }, function (err, user) {
						// set and save
						user.phone = req.body.phone;
						user.save(function(err) {
							if (err) console.error(err); // log error
						});
						// async callback
						return callback(err, user);
					});
				}
			}

			// // save email
			// if (req.body.email) {
			// 	queries.email = function(callback) {
			// 		return User.findOne({ uuid : userUuid }, function (err, user) {
			// 			// set and save
			// 			user.local.email = req.body.email;
			// 			user.save(function(err) {
			// 				if (err) console.error(err); // log error
			// 			});
			// 			// async callback
			// 			return callback(err, user);
			// 		});
			// 	}
			// }

			// save company
			if (req.body.firstName) {
				queries.firstName = function(callback) {
					return User.findOne({ uuid : userUuid }, function (err, user) {
						// set and save
						user.firstName = req.body.firstName;
						user.save(function(err) {
							if (err) console.error(err); // log error
						});
						// async callback
						return callback(err, user);
					});
				}
			}

			// save company
			if (req.body.lastName) {
				queries.lastName = function(callback) {
					return User.findOne({ uuid : userUuid }, function (err, user) {
						// set and save
						user.lastName = req.body.lastName;
						user.save(function(err) {
							if (err) console.error(err); // log error
						});
						// async callback
						return callback(err, user);
					});
				}
			}

			
		
			// run async queries
			async.parallel(queries, function(err, doc) {

				// return error
				if (err) return res.end(JSON.stringify({
					error : 'Error updating user.'
				}));	
				
				// return success
				res.end(JSON.stringify(doc));
			});
		});
	},






	// #########################################
	// ###  API: Remove User                 ###	//todo: send email notifications?
	// #########################################
	deleteUser : function (req, res) {

		var userUuid 	= req.body.uuid;
		var authUser 	= req.user.uuid;
		var user        = req.user;

		// find user
		var model = User.findOne({ uuid : userUuid });
		model.exec(function (err, subject) {
			
			// return error
			if (err) return res.end(JSON.stringify({ error : 'Error retrieving user.' }));
			
			// return if not authorized
			if (!api.can.remove.user(user, subject)) {
				var message = 'Unauthorized access attempt. Your IP ' + req._remoteAddress + ' has been logged.';
				return res.end(JSON.stringify({ error : message }));
			};

			model.remove().exec(function (err, result) {

				// return error
				if (err) return res.end(JSON.stringify({ error : 'Error retrieving user.' }));

				return res.end(JSON.stringify({ 
					message : 'User deleted.',
					result : result 
				}));

			})
		});
	},










	// #########################################
	// ###  API: Delegate User               ###
	// #########################################
	// add access to projects 
	delegateUser : function (req, res) {

		var user 	= req.user; 		      	// user that is giving access
		var userUuid 	= req.body.userUuid;      	// user that is getting access
		var role 	= req.body.role;  		// role that user is given
		var projectUuid = req.body.projectUuid;   	// project user is given role to
		var add         = req.body.add; 		// add or revoke, true/false


		// return if missing information
		if (!userUuid || !role || !projectUuid) return res.end(JSON.stringify({
			error : 'Error delegating accesss, missing information.'
		}));


		// get project
		Project
		.findOne({uuid : projectUuid})
		.exec(function (err, project) {
			console.log('Project: ', project.name);


			// get user
			User
			.findOne({uuid : userUuid})
			.exec(function (err, subject) {
				console.log('User: ', subject.firstName, subject.lastName);

				// add access
				if (add) {

					console.log('DELEGATING ' + role + ' access to project ' + project.name + ' for user ' + subject.firstName);
	
					// read access
					if (role == 'reader') {

						// check if user is allowed to delegate read access to project
						if (api.can.delegate.reader(user, project)) {

							subject.role.reader.projects.addToSet(project.uuid);
							subject.role.reader.clients.addToSet(project.client); // make sure can read client
							subject.markModified('role');
							subject.save(function (err, result) {
								if (err) return res.end(JSON.stringify({ error : err }));
								var message = 'Success! read'
								return res.end(JSON.stringify({ result : message }));
							});

						} else {
							console.log('access denied: role: reader, user: ' + subject.firstName + ', project: ' + project.name);
							var message = 'Unauthorized access delegation attempt. Your IP ' + req._remoteAddress + ' has been logged.';
							return res.end(JSON.stringify({ error : message }));
						}


					}


					// edit access
					if (role == 'editor') {

						// check if user is allowed to delegate read access to project
						if (api.can.delegate.editor(user, project)) {

							subject.role.editor.projects.addToSet(project.uuid);
							subject.role.reader.clients.addToSet(project.client); // make sure can read client
							subject.markModified('role');
							subject.save(function (err, result) {
								if (err) return res.end(JSON.stringify({ error : err }));
								var message = 'Success!'
								return res.end(JSON.stringify({ result : message }));
							});

						} else {
							console.log('access denied: role: editor, user: ' + subject.firstName + ', project: ' + project.name);
							var message = 'Unauthorized access delegation attempt. Your IP ' + req._remoteAddress + ' has been logged.';
							return res.end(JSON.stringify({ error : message }));
						}

					}

					// manager access
					if (role == 'manager') {

						// check if user is allowed to delegate read access to project
						if (api.can.delegate.manager(user, project)) {

							subject.role.manager.projects.addToSet(project.uuid);
							subject.role.reader.clients.addToSet(project.client); // make sure can read client
							subject.markModified('role');
							subject.save(function (err, result) {
								if (err) return res.end(JSON.stringify({ error : err }));
								var message = 'Success manager!'
								return res.end(JSON.stringify({ result : message }));
							});

						} else {
							console.log('access denied: role: manager, user: ' + subject.firstName + ', project: ' + project.name);
							var message = 'Unauthorized access delegation attempt. Your IP ' + req._remoteAddress + ' has been logged.';
							return res.end(JSON.stringify({ error : message }));
						}


					}




				// revoke access
				} else {

					console.log('REVOKING ' + role + ' access to project ' + project.name + ' for user ' + subject.firstName);
					
					// read access
					if (role == 'reader') {

						// check if user is allowed to delegate read access to project
						if (api.can.delegate.reader(user, project)) {

							subject.role.reader.projects.pull(project.uuid);
							subject.markModified('role');
							subject.save(function (err, result) {
								if (err) return res.end(JSON.stringify({ error : err }));
								var message = 'Success!'
								return res.end(JSON.stringify({ result : message }));
							});

						} else {
							console.log('access denied: role: reader, user: ' + subject.firstName + ', project: ' + project.name);
							var message = 'Unauthorized access delegation attempt. Your IP ' + req._remoteAddress + ' has been logged.';
							return res.end(JSON.stringify({ error : message }));
						}


					}


					// edit access
					if (role == 'editor') {

						// check if user is allowed to delegate read access to project
						if (api.can.delegate.editor(user, project)) {

							subject.role.editor.projects.pull(project.uuid);
							subject.markModified('role');
							subject.save(function (err, result) {
								if (err) return res.end(JSON.stringify({ error : err }));
								var message = 'Success!'
								return res.end(JSON.stringify({ result : message }));
							});

						} else {
							console.log('access denied: role: editor, user: ' + subject.firstName + ', project: ' + project.name);
							var message = 'Unauthorized access delegation attempt. Your IP ' + req._remoteAddress + ' has been logged.';
							return res.end(JSON.stringify({ error : message }));
						}


					}

					// edit access
					if (role == 'manager') {

						// check if user is allowed to delegate read access to project
						if (api.can.delegate.manager(user, project)) {

							subject.role.manager.projects.pull(project.uuid);
							subject.markModified('role');
							subject.save(function (err, result) {
								if (err) return res.end(JSON.stringify({ error : err }));
								var message = 'Success!'
								return res.end(JSON.stringify({ result : message }));
							});

						} else {
							console.log('access denied: role: manager, user: ' + subject.firstName + ', project: ' + project.name);
							var message = 'Unauthorized access delegation attempt. Your IP ' + req._remoteAddress + ' has been logged.';
							return res.end(JSON.stringify({ error : message }));
						}
					}

				}	
			})
		});
	},







	// #########################################
	// ###  API: Check Unique Email          ###
	// #########################################
	checkUniqueEmail : function (req, res) {

		var user = req.user;
		var email = req.body.email;

		User.findOne({'local.email' : email}, function (err, result) {
			if (err) return res.end(JSON.stringify({
				error : 'Error checking email.'
			}));

			if (result) return res.end(JSON.stringify({
					unique : false
			}));
			

			return res.end(JSON.stringify({
				unique : true
			}));

		})

	},














	// #########################################
	// ###  API: Get Portal                  ###
	// #########################################
	// served at initalization of Portal
	getPortal : function (req, res) {
		
		var json 	= {};
		var clients 	= [{}];
		var sources 	= [{}];
		var app 	= {};
		var hotlink 	= req.session.hotlink;
		var user        = req.user;

		// var for passing in async series
		var model = {};

		// build async query
		var a = {};

		// get projects
		a.projects = function (callback) { 
			return api._getProjects(callback, user);
		}

		// get clients
		a.clients = function (callback) {
			return api._getClients(callback, user);
		}

		// get users
		a.users = function (callback) {
			api._getUsers(callback, user);
		}

		async.series(a, function (err, json) {
			
			// parse results
			var result 	= {};
			result.account 	= user;
			result.projects = json.projects;
			result.clients 	= json.clients;
			result.users 	= json.users;

			// return result gzipped
			res.writeHead(200, {'Content-Type': 'application/json', 'Content-Encoding': 'gzip'});
			zlib.gzip(JSON.stringify(result), function (err, zipped) {
				res.end(zipped);
			});
		})

	},



	_getUsers : function (callback, user) {

		var a = {};
		var createdByChildren = [];
		var createdByGrandchildren = [];

		// is superadmin, get all users
		if (superadmin(user)) {
			a.superadminUsers = function (cb) {
				User
				.find()
				.exec(function(err, result) { 
					cb(err, result); 
				});
			}
		}
		
		// get all users created by user
		a.createdBy = function (cb) {
			User
			.find({createdBy : user.uuid})
			.exec(function(err, result) { 
				result.forEach(function(r) {
					createdByChildren.push(r.uuid);
				})

				cb(err, result); 
			});
		}

		// get all users created by children, ie. created by a user that User created
		a.createdByChildren = function (cb) {
			User
			.find({createdBy : { $in : createdByChildren }})
			.exec(function(err, result) { 
				result.forEach(function(r) {
					createdByGrandchildren.push(r.uuid);
				})
				cb(err, result); 
			});
		}

		// get all users created by grandchildren
		a.createdByChildren = function (cb) {
			User
			.find({createdBy : { $in : createdByGrandchildren }})
			.exec(function(err, result) { 
				cb(err, result); 
			});
		}

		async.series(a, function (err, allUsers) {

			// return error
			if (err) return callback(err);

			// flatten into one array
			var array = [];
			for (r in allUsers) {
				array.push(allUsers[r]);
			}

			// flatten
			var flat = _.flatten(array)

			// remove duplicates
			var unique = _.unique(flat, 'uuid');

			callback(err, unique);

		});

	},


	_getProjects : function (callback, user) {
		
		// async queries
		var a = {};

		// is superadmin, get all projects
		if (superadmin(user)) {
			a.superadminProjects = function (cb) {
				Project
				.find()
				.populate('files')
				.populate('layers')
				.exec(function(err, result) { 
					cb(err, result); 
				});
			}
		}
		
		// get all projects created by user
		a.createdBy = function (cb) {
			Project
			.find({createdBy : user.uuid})
			.populate('files')
			.populate('layers')
			.exec(function(err, result) { 
				cb(err, result); 
			});
		}

		// get all projects that user is editor for
		a.editor = function (cb) {
			Project
			.find({ uuid : { $in : user.role.editor.projects } })
			.populate('files')
			.populate('layers')
			.exec(function(err, result) { 
				cb(err, result); 
			});
		}

		// get all projects user is reader for
		a.reader = function (cb) {
			Project
			.find({ uuid : { $in : user.role.reader.projects } })
			.populate('files')
			.populate('layers')
			.exec(function(err, result) { 
				cb(err, result); 
			});
		}


		// do async 
		async.parallel(a, function (err, result) {
			
			// return error
			if (err) return callback(err);

			// move into one array
			var array = [];
			for (r in result) {
				array.push(result[r]);
			}

			// flatten
			var flat = _.flatten(array)

			// remove duplicates
			var unique = _.unique(flat, 'uuid');

			callback(err, unique);
		});
		
		

	},


	_getClients : function (callback, user) {

		// async queries
		var a = {};



		// is superadmin, get all projects
		if (superadmin(user)) {
			a.superadminClients = function (cb) {
				Clientel
				.find()
				.exec(function(err, result) { 
					cb(err, result); 
				});
			}
		}
		
		// get all projects created by user
		a.createdBy = function (cb) {
			Clientel
			.find({createdBy : user.uuid})
			.exec(function(err, result) { 
				cb(err, result); 
			});
		}

		// get all projects that user is editor for
		a.editor = function (cb) {
			Clientel
			.find({ uuid : { $in : user.role.editor.clients } })
			.exec(function(err, result) { 
				cb(err, result); 
			});
		}

		// get all projects user is reader for
		a.reader = function (cb) {
			Clientel
			.find({ uuid : { $in : user.role.reader.clients } })
			.exec(function(err, result) { 
				cb(err, result); 
			});
		}


		// do async 
		async.parallel(a, function (err, result) {
			
			// return error
			if (err) return callback(err);

			// flatten into one array
			var array = [];
			for (r in result) {
				array.push(result[r]);
			}

			
			// flatten
			var flat = _.flatten(array)

			// remove duplicates
			var unique = _.unique(flat, 'uuid');

			callback(err, unique);
		});
		
		

	},























	

	getUserManagement : function (req, res) {
		// todo: access control


		var user = req.user;

		// example: 
		// when Ana creates a map, 
		// 	ADMINS:   Ana, Rob, (KO, J)		// can do everythign with project, READ, EDIT, MANAGE
		// 	MANAGERS: John and Jane			// can add READERS to project
		// 	READERS:  Dick, Jock			// can READ project
		// 	EDITORS:  Jill				// can EDIT project (but not manage)


		// what users do current User have access to?
		// 	SUPERS:   nørds only
		// 	ADMINS:   everybody connected to project
		// 	MANAGERS: everybody that have READ access to project + created by self
		// 	READERS:  only self
		// 	EDITORS:  only self
		//
		//	NB: all results are users that User can edit


		var usersList = [];
		var asyncOp = {};

		// ######################################################################
		// ##
		// ##  ADMIN projects
		// ##
		// ######################################################################
		// projects that User is ADMIN for 
		var adminProjects = user.access.projects.admin;

		// find users that have read/write/manage of  	
		asyncOp.admin = function (callback) {

			User.find()
			.where('access.projects.read').in(adminProjects)	// read
			.or().where('access.projects.write').in(adminProjects)	// write
			.or().where('access.projects.manage').in(adminProjects)	// manage
			.where('access.projects.admin').nin(adminProjects)	// not admin
			.exec(function (err, users) {
				callback(null, users);
			});
		};
		

		// ######################################################################
		// ##
		// ##  createdBy ME users
		// ##
		// ######################################################################
		// find createdBy me users
		asyncOp.createdByMe = function (callback) {
			User.find()
			.where({'createdBy' : user.uuid})
			.exec(function (err, users) {
				callback(null, users);
			});
		};


		// ######################################################################
		// ##
		// ##  MANAGER for users
		// ##
		// ######################################################################
		// projects that User is manager for
		var managerProjects = user.access.projects.manage;

		// find users that have READ access only in managerProjects
		asyncOp.manager = function (callback) {
			User.find()
			.where('access.projects.read').in(managerProjects)	// read only
			.where('access.projects.write').nin(managerProjects)
			.where('access.projects.manage').nin(managerProjects)
			.where('access.projects.admin').nin(managerProjects)
			.exec(function (err, users) {
				callback(null, users);

			});
		};

		// ######################################################################
		// ##
		// ##  me self
		// ##
		// ######################################################################
		asyncOp.self = function (callback) {
			usersList.push(user);
			callback(null, user);
		};

		// run async queries
		async.parallel(asyncOp, function (err, results) {
			console.log('async done: ', results);
			
			// return results
			res.end(JSON.stringify({
				users : results
			}));


		})

		



	},























				   

	// zip a file and send to client
	zipAndSend : function (req, res) {

		var files 	= req.body.files;
		var puuids 	= req.body.puuid;
		var pslug 	= req.body.pslug;

		// return if nothing
		if (!files || !puuids || !pslug) return res.end('nothing!');

		// create main folder
		var uuidFolder 	= uuid.v4();
		var basedir 	= '/var/www/ziptmp/' + uuidFolder;
		var maindir 	= basedir + '/' + pslug;
		
		fs.mkdirs(maindir, function (err) {		// refactor
			
			// return on error
			if (err) return console.error(err);
			
			// for each file
			var dbl = [], i = 1;
			async.each(files, function (file, callback) {

				// check for no double folder names			
				var filename = file.name;
				if (dbl.indexOf(filename) > -1) filename += '_' + i++; // add index to filename if already exists
				dbl.push(filename);

				// set paths
				var dest = maindir + '/' + filename;
				var src = '/var/www/data/geo/' + file.uuid ; // folder

				// copy
				fs.copy(src, dest, function(err){ callback(err) });	

			}, 

			// final callback
			function (err) {	// todo: err handling
				
				// execute cmd line zipping 
				var zipfile = basedir + '/' + pslug + '_download.zip';
				var cmd = 'zip -r ' + zipfile + ' *'; 
				var exec = require('child_process').exec;				
				
				// run command
				exec(cmd, { cwd : maindir }, function (err, stdout, stdin) {
					if (err) return res.end(err); // if err

					// send zip uuid
					res.end(uuidFolder);
				});
			});
		});
	},


	// handle file downloads
	downloadFile : function (req, res) {
		
		var file = req.query.file;
		
		console.log('downloadFile: ', file);
								// todo: access
								// 	 download several files (zipped)

		// send the file, simply
		// get file
		File.findOne({ 'uuid' : file }, function(err, record) {
			console.log('GOT download FIEL FILE:');
			console.log(record);

			// if more than one file, zip it up
			if (record.files.length > 1) {
				console.log('lots of files, gonna zip it up...');
				
				// todo: download several files (zipped)

			} else {
				var path = '/var/www/data/geo/' + file + '/' + record.files[0];
				res.download(path);
				return;
			}

			return res.end('alliscool');

		});

	},


	// download zip
	downloadZip : function (req, res) {
		var file = req.query.file;
		var dive = require('dive');
		var folder = '/var/www/ziptmp/' + file;
		var found = false;
		
		// find zip file
		dive(folder, 

			// each file callback
			function(err, file) {
					
				if (file.slice(-3) == 'zip') {
					found = true;
					res.download(file);
					return;				// todo: delete zip file
				}
			}, 

			// callback
			function () { 
				if (!found) return res.end('File not found.'); 
			}	
		);
	},


	// handle file download
	getFileDownload : function (req, res) {

		console.log('req: ', req);
		console.log('req.query......', req.query);
		var file = req.query.file;
		var type = req.query.type || 'file';
		console.log('type: ', type);

		console.log('file: ', file);

		// if (!file) { res.end('Please specify a file.'); return; }
		if (!file) {
			console.log('NOT FILE!');
		}
		// todo: access restrictions

		// zip file
		if (type == 'zip') return api.downloadZip(req, res);
			
		// normal file
		if (type == 'file') {
			return api.downloadFile(req, res);
			
		} else {
			console.log('not type file');
		}
		// got nothing to do
		res.end('Please specifys a file.'); return;

	},


	// update a file
	updateFile : function (req, res) {
		var fuuid = req.body.uuid;
		var userid = req.user.uuid;
		var queries = {};

		// update name
		if (req.body.hasOwnProperty('name')) {
			console.log('name!');
			queries.name = function(callback) {

				return File.update(
		    
					// conditions
					{ 'access.users' : userid, uuid : fuuid }, 

					// update objects
					{ name : req.body.name },

					// callback
					function (err, numberAffected, raw) {
						return callback(err, numberAffected);
					}
				);
			}
		}

		// update description
		if (req.body.hasOwnProperty('description')) {
			console.log('description!');
			queries.description = function(callback) {

				return File.update(
		    
					// conditions
					{ 'access.users' : userid, uuid : fuuid }, 

					// update objects
					{ description : req.body.description },

					// callback
					function (err, numberAffected, raw) {
						return callback(err, numberAffected);
					}
				);
			}
		}

		async.parallel(queries, function(err, doc) {

			// return on error
			if (err) return res.end('{ error : 0 }');
					
			// return doc
			res.end(JSON.stringify(doc));

		});

	},


	// delete a file
	deleteFiles : function (req, res) {

		var _fids  = req.body._fids;
		var puuid  = req.body.puuid;
		var userid = req.user.uuid;

		// validate
		if (!_fids || !puuid || !userid) return res.end('missing!');

		var qu = [];

			// delete file from project
			qu.push(function (callback) {
				
				return Project.findOne({uuid : puuid}, function (err, project) {

					_fids.forEach(function (f) {
						project.files.pull(f);
					})
					
					project.markModified('files');
					project.save(function (err) {
						if (err) console.error(err);
						console.log('file removed from project');
					});

					return callback(err);

				});

				
			});

	
		// run queries
		async.parallel(qu, function(err, doc) {

			if (err) {
				console.log(err);
				res.end('{ error : 0 }');
			}		

			console.log('delete done...?', doc);
			res.end(JSON.stringify(doc));
		});

	},











	// get layers and send to client
	getLayers : function (req, res) {

		var project 	= req.body.project 	|| false;
		var user 	= req.user.uuid 	|| false;

		// error if no project or user
		if (!project) return res.end("{ 'error' : 'no project id?'}"); 
		if (!user)    return res.end("{ 'error' : 'no user id?'}"); 


		// get project
		Project.find({ 'access.read' : user, 'uuid' : project }, function(err, result) { 
			if (err) { console.log('got error', err); }

			// got project
			Layers.find({ 'uuid': { $in: result.layers }}, function(err, docs){
				if (err) { console.log('got errorw', err); }
				
				// return layers
				res.end(JSON.stringify(docs));
			});
		});
	},






	// #########################################
	// ###  API: Update Layer                ###
	// #########################################
	updateLayer : function (req, res) {
		console.log('updateLayer');

		var layer 	= req.body.layer || false;
		var user 	= req.user;
		

		// error if no project or user
		if (!layer) return res.end(JSON.stringify({
			error : 'Missing layer uuid.'
		})); 



		Layers.findOne({'uuid' : layer}, function (err, layer) {
			if (err) throw err;

			console.log('found layer?', layer);
			
			// update description
			if (req.body.hasOwnProperty('description')) {

				var description = req.body.description;
				console.log('updating description: ', description);
				layer.description = description;
				layer.save(function(err) {
					if (err) throw err;
				});

			};

			res.end('save done');
		});

	},


	// get geojson
	getGeojsonFile : function (req, res) {

	
		//var file = req.body.file;	//  "ERI0.shp.geojson"
		var uuid = req.body.uuid;	// file-1091209120-0129029
		var user = req.user.uuid;	// user-1290192-adasas-1212

		console.log('uuid: ', uuid);
		console.log('user: ', user);

		// return if invalid
		if (!uuid || !user) return false;

		// get geojson file path from db
		return File.findOne({'access.users' : req.user.uuid, 'uuid' : uuid }, function(err, record) {
			console.log('found: ', record);
			return api.sendGeoJsonFile(req, res, record);
		});
	},


	// send geojson
	sendGeoJsonFile : function (req, res, record) {

		if (!record) return res.end(JSON.stringify({
			error: 'No such file...'
		}));

		console.log('preparing send of geojson...');
		var filename = '';
		record.files.forEach(function(file, i, arr) {
			if (file.slice(-8) == '.geojson') filename = file;
		}, this);

		// return if nothing
		if (!filename) return res.end('no geosjon dawg.');
			
		// read file and ship it
		var uuid = req.body.uuid;
		var path = '/var/www/data/geo/' + uuid + '/' + filename;


		fs.readJson(path, function (err, data) {

			// set filesize
			var string = JSON.stringify(data);

			string = utf8.encode(string);
			var length = string.length;//.toString();
			res.set({
				'Content-Type': 'text/json',		// todo: encoding of arabic characters, tc.
				//'Content-Length': length,		// works fine wihtout conent-length, wrong length w chars
				// 'Content-Encoding': 'utf-8'
			});
			
			res.end(string);

		});

	},


	// send geojson helper 
	_sendGeoJsonFile : function (req, res, record) {

		var geo = [];

		// for each file
		async.each(record.files, function (file, callback) {
			fs.readFile(file, function (err, data) {
				geo.push(JSON.parse(data));
				callback(err);
			})		
		}, 

		// final callback
		function (err) {

			// set filesize
			var string = JSON.stringify(geo);
			var length = string.length.toString();
			res.set({
				'Content-Type': 'text/json',
				'Content-Length': length
			});
			
			// return geojson string
			res.end(JSON.stringify(geo));
		});
		
	},

	
	// save mapbox layers to db
	saveMapboxLayers : function (userId, projectId, maps) {
		
		Project.update(
		    
			// conditions
			{ 	'access.write' 	: userId, 
				'uuid' 		: projectId 
			}, 

			// update objects
			{ $pushAll : { 'mapboxLayers' : maps }},

			// callback
			function (err, numberAffected, raw) {
				console.log('save done, ', err, numberAffected, raw);
			}
		);

	},


	






	// process wildcard paths, including hotlinks
	processWildcardPath : function (req, res) {

		console.log('processWildcardPath:');

		// get client/project
		var path 	= req.originalUrl.split('/');
		var client 	= path[1];
		var project 	= path[2];

		console.log('q: ', req.query);
		console.log('path: ', path);
		console.log('req.originalUrl.', req.originalUrl)

		var hotlink = {
			client : client,
			project : project
		}
		
		if (req.isAuthenticated()) {
			console.log('req.isAuth: hotlink:', hotlink);
			
			// send complete user block (TODO: what if not in edit mode, just consuming?)
			req.session.hotlink = hotlink;
			//helper.parseUserSchemaJSON(req, res);
			res.render('../../views/app.ejs', {
				//json : json,
				hotlink : hotlink || {}
			});
		} else {
			
			console.log('req. NOT auth: hotlink:', hotlink);
			// redirect to login with hotlink embedded
			req.session.hotlink = hotlink;
			res.redirect('/login');
		}

	},














	

	

	




	// CRUD capabilities
	can : {

		create : {
			project : function (user) {
				if (superadmin(user)) return true;
				if (user.role.admin)  return true;
				return false;
			},
			client : function (user) {
				if (superadmin(user)) return true;
				if (user.role.admin)  return true;
				return false;
			},
			
			user : function (user) {

				// can create users without any CRUD privileges
				if (superadmin(user)) return true;
				if (user.role.admin) return true;

				// if user is manager anywhere
				if (user.role.manager.projects.length > 0) return true;
				return false;
			}
		},

		delegate : {
			superadmin : function (user) {
				if (superadmin(user)) return true;
				return false;
			},
			admin : function (user) {
				if (superadmin(user)) return true;
				return false;
			},
			manager : function (user, project) {
				if (superadmin(user)) return true;

				// can add managers for own projects
				if (user.role.admin && project.createdBy == user.uuid) return true; 

				// if admin and got --U- for someone else's project
				if (user.role.admin && api.can.update.project(user, project)) return true;

				return false;
			},
			editor : function (user, project) { // project or client
				if (superadmin(user)) return true;
				
				// can create editors for own projects
				if (user.role.admin && project.createdBy == user.uuid)  return true;

				// if admin and got --U- for someone else's project
				if (user.role.admin && api.can.update.project(user, project)) return true;

				return false;
			},
			reader : function (user, project) { // project or client
				if (superadmin(user)) return true;

				// can create readers for own projects
				if (user.role.admin && project.createdBy == user.uuid)  return true;

				// if admin and got --U- for someone else's project
				if (user.role.admin && api.can.update.project(user, project)) return true;

				// managers can create readers for own projects
				if (user.role.manager.projects.indexOf(project.uuid) >= 0) return true;

				return false;
			},


		},

		read : {
			project : function (user, project) {
				if (superadmin(user)) return true;

				// admin can -R-- own projects
				if (user.role.admin && project.createdBy == user.uuid)  return true;

				// if manager, editor or reder
				// if (user.role.manager.projects.indexOf(uuid) >= 0) return true;
				// if (user.role.editor.projects.indexOf(uuid)  >= 0) return true;
				if (user.role.reader.projects.indexOf(uuid)  >= 0) return true;

				return false;
			},
			client : function (user, client) {
				if (superadmin(user)) return true;

				// admin can -R-- own clients
				if (user.role.admin && client.createdBy == user.uuid)  return true;

				// if manager, editor, reader
				// if (user.role.manager.clients.indexOf(client.uuid) >= 0) return true; 
				// if (user.role.editor.clients.indexOf(client.uuid)  >= 0) return true; 
				if (user.role.reader.clients.indexOf(client.uuid)  >= 0) return true; 

				return false;
			}
		},

		update : {
			project : function (user, project) {
				if (superadmin(user)) return true;

				// if admin and has created project oneself
				if (user.role.admin && project.createdBy == user.uuid) return true;

				// if editor of project
				if (user.role.editor.projects.indexOf(project.uuid) >= 0) return true; 

				return false;

			},
			client : function (user, client) {
				if (superadmin(user)) return true;

				// if admin and has created client oneself
				if (user.role.admin && client.createdBy == user.uuid)  return true;

				// if editor of client
				if (user.role.editor.clients.indexOf(client.uuid) >= 0) return true; // managers can create readers for own projects

				return false;
			},
			user   : function (user, subject, uuid) {  // update of user info, not adding roles
				if (superadmin(user)) return true;

				// if user is created by User (as admin, manager)
				if (subject.createdBy == user.uuid) return true; 
				
				// if is self
				if (subject.uuid == user.uuid) return true;

				return false;				
			}
		},

		remove : {
			project : function (user, project) {
				if (superadmin(user)) return true;

				// can remove own project
				if (user.role.admin && project.createdBy == user.uuid) return true;

				// if admin and editor of project
				if (user.role.admin && user.role.editor.projects.indexOf(project.uuid) >= 0) return true;
				
				// editors can not remove projects

				return false;

			},
			client : function (user, client) {
				if (superadmin(user)) return true;

				// can remove own project
				if (user.role.admin && client.createdBy == user.uuid) return true;

				// if admin and editor of project
				if (user.role.admin && user.role.editor.clients.indexOf(client.uuid) >= 0) return true;
				
				// editors can not remove projects
				return false;				
			},


			user : function (user, subject) {

				// can remove users
				if (superadmin(user)) return true;

				// can remove user if admin and created by self
				if (user.role.admin && subject.createdBy == user.uuid) return true;

				// if user is manager anywhere and created by self
				if (user.role.manager.projects.length > 0 && subject.createdBy == user.uuid) return true;
				return false;
			}
		},
	},

				

}


// helper function 
function isObject(obj) {
	return (Object.prototype.toString.call(obj) === '[object Object]' || Object.prototype.toString.call(obj) === '[object Array]');
}