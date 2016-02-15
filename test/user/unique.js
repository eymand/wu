var supertest = require('supertest');
var chai = require('chai');
var expect = chai.expect;
var api = supertest('https://' + process.env.SYSTEMAPIC_DOMAIN);
var helpers = require('../helpers');
var token = helpers.token;
var httpStatus = require('http-status');
var Layer = require('../../models/layer');
var expected = require('../../shared/errors');


module.exports = function () {

    describe('/api/user/unique', function () {

        it('should respond with status code 401 when not authenticated', function (done) {
            api.post('/api/user/unique')
                .send({})
                .expect(httpStatus.UNAUTHORIZED)
                .end(done);
        });

        it('should respond with status code 401 and error if email doesn\'t exist in request body', function (done) {
            token(function (err, access_token) {
                if (err) {
                    return done(err);
                }
                
				api.post('/api/user/unique')
	                .send({
                        access_token: access_token
                    })
	                .expect(httpStatus.UNAUTHORIZED)
	                .end(function (err, res) {
	                	if (err) {
	                		return done(err);
	                	}

                        var result = helpers.parse(res.text);

                        expect(result.error.code).to.be.equal(httpStatus.UNAUTHORIZED);
                        expect(result.error.errors.missingRequiredFields).to.include('email');
                        
                        done();
	                });
            });
        });

        it('should respond with status code 200 and unique true if user with such email doesn\'t exist', function (done) {
            token(function (err, access_token) {
                if (err) {
                    return done(err);
                }
                
				api.post('/api/user/unique')
	                .send({
                        access_token: access_token,
                        email: "unique12345678901233@gmail.com"
                    })
	                .expect(httpStatus.OK)
	                .end(function (err, res) {
	                	if (err) {
	                		return done(err);
	                	}

                        var result = helpers.parse(res.text);

                        expect(result.unique).to.be.true;
                        
                        done();
	                });
            });
        });

        it('should respond with status code 200 and unique false if user with such email alredy exist', function (done) {
            token(function (err, access_token) {
                if (err) {
                    return done(err);
                }
                
				api.post('/api/user/unique')
	                .send({
                        access_token: access_token,
                        email: helpers.test_user.email
                    })
	                .expect(httpStatus.OK)
	                .end(function (err, res) {
	                	if (err) {
	                		return done(err);
	                	}

                        var result = helpers.parse(res.text);

                        expect(result.unique).to.be.false;
                        
                        done();
	                });
            });
        });

    });

};