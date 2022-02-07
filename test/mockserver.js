/*jslint node: true */
/*jslint esversion: 6 */
"use strict";

const MockReq = require('mock-req');
const assert = require('assert');
const mockserver = require('./../mockserver');
const path = require('path');

let res;
let req;
const mocksDirectory = path.join('.', 'test', 'mocks');

var verbose = true; //process.env.DEBUG === 'true' || true;

/**
 * Processes request
 */
function processRequest(url, method, cb) {
  req.url = url;
  req.method = method;
  if (cb != null) res.onEnd = cb;
  
  mockserver(mocksDirectory, verbose)(req, res);
}

/**
 * Processes request within custom ENV
 */
function processRequestEnv(url, method, envs) {
  let cleanupEnv = function() {};

  for (let name in envs) {
    if (envs.hasOwnProperty(name)) {
      process.env[name] = envs[name];

      cleanupEnv = (function(name, next) {
        return function() {
          delete process.env[name];
          next();
        };
      })(name, cleanupEnv);
    }
  }

  processRequest(url, method);

  cleanupEnv();
}

describe('mockserver', function() {
  beforeEach(function() {
    mockserver.headers = [];

    res = {
      headers: null,
      status: null,
      reason: null,
      body: null,
      writeHead: function(status, reason, headers) {
        this.status = status;
        this.headers = headers;
        typeof reason === 'string'
          ? this.reason = reason
          : this.headers = reason;
      },
      end: function(body) {
        this.body = body;
        this.onEnd(this);
        
      },
      onEnd: function() {}
    };

    req = {
      url: null,
      method: null,
      headers: [],
      on: function(event, cb) {
        if (event === 'end') {
          cb();
        }
      },
    };
  });

  describe('mockserver()', function() {
    it('should return a valid response', function(done) {
      
      processRequest('/response-default', 'GET', function(res) {
        assert.equal(res.body, 'Welcome!');
        assert.equal(res.status, 200);
        assert.equal(JSON.stringify(res.headers), '{"Content-Type":"text"}');
        done();
      });

    });

    it('should return 404 if the mock does not exist', function(done) {
      processRequest('/not-there', 'GET', function(res) {
        assert.equal(res.status, 404);
        assert.equal(res.body, 'Not Mocked');
        done();
      });
    });

    it('should be able to handle trailing slashes without changing the name of the mockfile', function(done) {
     processRequest('/response-default/', 'GET', function(res) {
        assert.equal(res.status, 200);
        assert.equal(res.body, 'Welcome!');
        assert.equal(JSON.stringify(res.headers), '{"Content-Type":"text"}');
        done();
      });
    });

    it('should be able to handle multiple headers', function(done) {
      processRequest('/multiple-headers/', 'GET', function(res) {
        assert.equal(res.status, 200);
        assert.equal(
          JSON.stringify(res.headers),
          '{"Content-Type":"text/xml; charset=utf-8","Cache-Control":"public, max-age=300"}'
        );  
        done();
      });
    });

    it('should combine the identical headers names', function(done) {
      processRequest('/multiple-headers-same-name/', 'GET',function(res) {
        assert.equal(res.headers['Set-Cookie'].length, 3);        
        done();
      });
    });       

    it('should be able to handle status codes different than 200', function(done) {
      processRequest('/return-204', 'GET',function(res) {
        assert.equal(res.status, 204);  
        done();
      });
    });

    it('should be able to handle HTTP methods other than GET', function(done) {
      processRequest('/return-200', 'POST',function(res) {
        assert.equal(res.status, 200);        
        done();
      });
    });

    it('should be able to handle empty bodies', function(done) {
      processRequest('/return-empty-body', 'GET', function(res) {
        assert.equal(res.status, 204);
        assert.equal(res.body, '');        
        done();
      });
      
    });

    it('should be able to correctly map /', function(done) {
      
      processRequest('/', 'GET', function(res){
        assert.equal(res.body, 'homepage');        
        done();
      });
    });

    it('should be able to map multi-level urls', function(done) {
    
      processRequest('/multi-level-url/multi-level-url-2', 'GET', function(res){
        assert.equal(res.body, 'multi-level url');  
        done();
      });
    });

    it('should be able to handle GET parameters', function(done) {
      processRequest('/query-params?a=b', 'GET',  function(res) {
        assert.equal(res.status, 200);        
        done();
      });
      
    });

    it('should default to GET.mock if no matching parameter file is found', function(done) {
      processRequest('/query-params?a=c', 'GET', function(res) {
        assert.equal(res.status, 200);  
        done();
      });
    });






    it('should be able track custom headers, not authorized', function(done) {
      mockserver.headers = ['authorization'];

      processRequest('/request-headers', 'GET', function(res) {
        assert.equal(res.status, 401);
        assert.equal(res.body, 'not authorized');
        done();
      });

    });

    it('should be able track custom headers, authorized', function(done) {  
      mockserver.headers = ['authorization'];
      req.headers['authorization'] = '1234';
      processRequest('/request-headers', 'GET', function(res) {
        assert.equal(res.status, 200);
        assert.equal(res.body, 'authorized');
        done();
      });
   

    });
   
    it('should be able track custom headers, admin authorized', function(done) {
      mockserver.headers = ['authorization'];
      req.headers['authorization'] = '5678';
      processRequest('/request-headers', 'GET', function(res) {
        assert.equal(res.status, 200);
        assert.equal(res.body, 'admin authorized');
        done();
      });
    });

    it('should attempt to fall back to a base method if a custom header is not found in a file, not authorized', function(done) {
      mockserver.headers = ['authorization'];
      req.headers['authorization'] = 'invalid';
      processRequest('/request-headers', 'GET', function(res) {
        assert.equal(res.status, 401);
        assert.equal(res.body, 'not authorized');
        done();
      });

    });
    it('should attempt to fall back to a base method if a custom header is not found in a file, not mocked', function(done) {
      mockserver.headers = ['authorization'];
      req.headers['authorization'] = 'invalid';
      processRequest('/request-headers', 'POST', function(res) {
        assert.equal(res.status, 404);
        assert.equal(res.body, 'Not Mocked');
        done();
      });
    });

    it('should look for alternate combinations of headers if a custom header is not found', function() {
      mockserver.headers = ['authorization', 'x-foo'];

      req.headers['authorization'] = 12;
      req.headers['x-foo'] = 'Bar';
      processRequest('/request-headers', 'PUT');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'header both');

      req.headers['x-foo'] = 'Baz';
      processRequest('/request-headers', 'PUT');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'header auth only');

      req.headers['authorization'] = 78;
      processRequest('/request-headers', 'PUT');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'header both out-of-order');

      req.headers['authorization'] = 45;
      processRequest('/request-headers', 'PUT');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'header x-foo only');

      delete req.headers['authorization'];
      processRequest('/request-headers', 'PUT');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'header x-foo only');
    });

    it('should be able track custom headers with variation and query params', function() {
      mockserver.headers = ['authorization', 'x-foo'];
      req.headers['authorization'] = 12;
      req.headers['x-foo'] = 'Bar';
      processRequest('/request-headers?a=b', 'POST');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'that is a long filename');
    });

    it('should be able track custom string headers with variation and query params', function() {
      mockserver.headers = 'authorization,x-foo';

      req.headers['authorization'] = 12;
      req.headers['x-foo'] = 'Bar';

      processRequest('/request-headers?a=b', 'POST');

      assert.equal(res.status, 200);
      assert.equal(res.body, 'that is a long filename');
    });

    it('should be able track custom ENV headers with variation and query params', function() {
      req.headers['authorization'] = 12;
      req.headers['x-foo'] = 'Bar';

      processRequestEnv('/request-headers?a=b', 'POST', {
        MOCK_HEADERS: 'authorization,x-foo',
      });

      assert.equal(res.status, 200);
      assert.equal(res.body, 'that is a long filename');
    });

    it('should keep line feeds (U+000A)', function() {
      processRequest('/keep-line-feeds', 'GET');

      assert.equal(
        res.body,
        'ColumnA	ColumnB	ColumnC\n' + 'A1	B1	C1\n' + 'A2	B2	C2\n' + 'A3	B3	C3\n'
      );
      assert.equal(res.status, 200);
      assert.equal(
        JSON.stringify(res.headers),
        '{"Content-Type":"text/plain; charset=utf-8"}'
      );
    });

    it('should be able to include POST bodies in the mock location', function(done) {
      const req = new MockReq({
        method: 'POST',
        url: '/return-200',
        headers: {
          Accept: 'text/plain',
        },
      });
      req.write('Hello=123');
      req.end();

      mockserver(mocksDirectory, verbose)(req, res);

      req.on('end', function() {
        assert.equal(res.body, 'Hella');
        assert.equal(res.status, 200);
        done();
      });
    });

    it('Should default to POST.mock if no match for body is found', function(done) {
      const req = new MockReq({
        method: 'POST',
        url: '/return-200',
        headers: {
          Accept: 'text/plain',
        },
      });
      req.write('Hello=456');
      req.end();

      mockserver(mocksDirectory, verbose)(req, res);

      req.on('end', function() {
        assert.equal(res.status, 200);
        done();
      });
    });

    it('Should return 404 when no default .mock files are found', function() {
      mockserver.headers = ['authorization'];
      req.headers['authorization'] = 12;
      processRequest('/return-200?a=c', 'GET');

      assert.equal(res.status, 404);
    });

    it('should be able to handle imports', function() {
      processRequest('/import', 'GET');

      assert.equal(res.status, 200);
      assert.equal(res.body, JSON.stringify({ foo: 'bar' }, null, 4));
    });

    it('should be able to include POST json body in separate file', function(done) {
      var jsonBody = {user: {username: 'theUser', password: '123456'}};
      var req = new MockReq({
        method: 'POST',
        url: '/request-json',
        headers: {
          'Accept': 'application/json'
        }
      });
      req.write(jsonBody);
      req.end();

      mockserver(mocksDirectory, verbose)(req, res);

      req.on('end', function() {
        assert.deepEqual(JSON.parse(res.body), {token: 'longJWT'});
        assert.equal(res.status, 200);
        done();
      });
    });


    it('should be able to handle wildcards in separate file mock', function(done) {
      var jsonBody = {username: 'theUser', password: '123456'};
      var req = new MockReq({
        method: 'POST',
        url: '/request-json-wildcard',
        headers: {
          'Accept': 'application/json'
        }
      });
      req.write(jsonBody);
      req.end();

      mockserver(mocksDirectory, verbose)(req, res);

      req.on('end', function() {
        assert.equal(res.body, "WildcardMatch");
        assert.equal(res.status, 200);
        done();
      })
    });

    it('should be able to handle nested wildcards in separate file mock', function(done) {
      var jsonBody = {user: {username: 'theUser', password: '1234567', nested: {item: "MyDisregardedValue!"}}};
      var req = new MockReq({
        method: 'POST',
        url: '/request-json-wildcard',
        headers: {
          'Accept': 'application/json'
        }
      });
      req.write(jsonBody);
      req.end();

      mockserver(mocksDirectory, verbose)(req, res);

      req.on('end', function() {
        assert.equal(res.body, "NestedWildcardMatch");
        assert.equal(res.status, 200);
        done();
      })
    });


    it('should normalize JSON before comparing with separate file', function(done) {
      var jsonBody = "{\"json\": \"yesPlease\"}"; //Extra whitespace in request
      var req = new MockReq({
        method: 'POST',
        url: '/request-json',
        headers: {
          'Accept': 'application/json'
        }
      });
      req.write(jsonBody);
      req.end();

      mockserver(mocksDirectory, verbose)(req, res);

      req.on('end', function() {
        assert.equal(res.body, "spacetest");
        assert.equal(res.status, 200);
        done();
      });
    });

    it('should default to POST.mock if payload file does not match mock', function(done) {
      var jsonBody = {user: {username: 'notTheUser', password: '123456'}};
      var req = new MockReq({
        method: 'POST',
        url: '/request-json',
        headers: {
          'Accept': 'application/json'
        }
      });
      req.write(jsonBody);
      req.end();

      mockserver(mocksDirectory, verbose)(req, res);

      req.on('end', function() {
        assert.deepEqual(JSON.parse(res.body), {error: 'User not found'});
        assert.equal(res.status, 404);
        done();
      });
    });

    it('should default to POST.mock if json body not found in any files', function(done) {
      var jsonBody = {user: {username: 'notFoundUser', password: '123456'}};
      var req = new MockReq({
        method: 'POST',
        url: '/request-json',
        headers: {
          'Accept': 'application/json'
        }
      });
      req.write(jsonBody);
      req.end();

      mockserver(mocksDirectory, verbose)(req, res);

      req.on('end', function() {
        assert.deepEqual(JSON.parse(res.body), {error: 'User not found'});
        assert.equal(res.status, 404);
        done();
      });
    });

    it('Should return 404 when no default .mock files are found', function() {
        mockserver.headers = ['authorization'];
        req.headers['authorization'] = 12;
        processRequest('/return-200?a=c', 'GET');
    });

    it('should be able to handle imports with content around import', function() {
      processRequest('/import?around=true', 'GET');

      assert.equal(res.status, 200);
      assert.equal(
        res.body,
        'stuff\n' + JSON.stringify({ foo: 'bar' }, null, 4) + '\naround me'
      );
    });

    it('should be able to handle imports with js scripts', function() {
      processRequest('/importjs', 'GET');
      assert.equal(res.status, 200);
      assert.ok(Date.parse(JSON.parse(res.body).date));
    });

    it('should be able to handle imports with js scripts varying responses according to the the request - 1', function(done) {
      var req = new MockReq({
        method: 'POST',
        url: '/importjs',
        headers: {},
      });
      req.write(JSON.stringify({ foo: '123' }));
      req.end();

      mockserver(mocksDirectory, verbose)(req, res);

      req.on('end', function() {
        assert.equal(JSON.parse(res.body).prop, 'bar');
        done();
      });
    });

    it('should be able to handle imports with js scripts varying responses according to the the request - 2', function(done) {
      var req = new MockReq({
        method: 'POST',
        url: '/importjs',
        headers: {},
      });
      req.write(JSON.stringify({ boo: '123' }));
      req.end();

      mockserver(mocksDirectory, verbose)(req, res);

      req.on('end', function() {
        assert.equal(JSON.parse(res.body).prop, 'baz');
        done();
      });
    });

    it('should be able to handle dynamic header values', function() {
      processRequest('/dynamic-headers', 'GET');
      assert.equal(res.status, 200);
      assert.ok(Date.parse(res.headers['X-Subject-Token']));
      assert.equal(res.body, 'dynamic headers\n');
    });
  });

    describe('wildcard directories', function() {
      it('wildcard matches directories named __ with numeric slug', function() {
        processRequest('/wildcard/123', 'GET');

        assert.equal(res.status, 200);
        assert.equal(res.body, 'this always comes up\n');
      });

      it('wildcard matches directories named __ with string slug', function() {
        processRequest('/wildcard/abc', 'GET');

        assert.equal(res.status, 200);
        assert.equal(res.body, 'this always comes up\n');
      });

      it('wildcard matches directories named foo/__/bar with numeric slug', function() {
        processRequest('/wildcard-extended/123/foobar', 'GET');

        assert.equal(res.status, 200);
        assert.equal(res.body, 'wildcards-extended');
      });

      it('wildcard matches directories named foo/__/bar with string slug', function() {
        processRequest('/wildcard-extended/abc/foobar', 'GET');

        assert.equal(res.status, 200);
        assert.equal(res.body, 'wildcards-extended');
      });

      it('wildcard matches directories named foo/__/bar/__/fizz', function() {
        processRequest('/wildcard-extended/abc/foobar/def/fizzbuzz', 'GET');

        assert.equal(res.status, 200);
        assert.equal(res.body, 'wildcards-extended-multiple');
      });

      it('__ not used if more specific match exist', function() {
        processRequest('/wildcard/exact', 'GET');

        assert.equal(res.status, 200);
        assert.equal(res.body, 'more specific\n');
      });

      it('should not resolve with missing slug', function() {
        processRequest('/wildcard/', 'GET');

        assert.equal(res.status, 404);
      });
      
      it('works even with wildcard POST __ and query parameters', function() {
        processRequest('/wildcard/123?myquery=yes', 'POST');

        assert.equal(res.status, 200);
        assert.equal(res.body, 'this also works\n');
      });
    });

    describe('query string parameters', function() {
      it('should be able to handle GET parameters', function() {
        processRequest('/query-params?a=b', 'GET');

        assert.equal(res.status, 200);
      });

      it('should handle a file with wildcards as query params', function() {
        processRequest('/wildcard-params?foo=bar&buz=baz', 'GET');

        assert.equal(res.status, 200);
      });

      it('should handle a file with wildcards as query param values', function() {
        processRequest('/wildcard-params/extra/?foo=bar&not-exact=baz&more=andmore', 'GET');
        assert.equal(res.status, 200);
        assert.equal(res.body, 'foo=bar&__=__');
      });

      it('should prefer exact matches over wildcard matches', function () {
        processRequest('/wildcard-params?foo=bar&buz=bak', 'GET');

        assert.equal(res.status, 200);
        assert.equal(res.body, 'exact match');
      });

      it('should handle a request regardless of the order of the params in the query string', function() {
        processRequest('/wildcard-params?buz=baz&foo=bar', 'GET');
        assert.equal(res.status, 200);
      });

      it('should not handle request where params does not match', function() {
        processRequest('/wildcard-params?biz=baz&axe=bar', 'GET');
        assert.equal(res.status, 404);
      });

      it('should not handle requests with extra params in the query string, if no slugs are configured', function() {
        processRequest('/wildcard-params?buz=baz&foo=bar&biz=bak', 'POST');
        assert.equal(res.status, 404);
      });

      it('should handle extra params name and values if slug is configured', function() {
        processRequest('/wildcard-params/extra/?foo=bar&myextra=data', 'GET');
        assert.equal(res.body, 'foo=bar&__=__');
        assert.equal(res.status, 200);
      });

      it('should handle extra params value if slug is configured', function() {
        processRequest('/wildcard-params?foo=bar&buz=data', 'GET');
        assert.equal(res.body, 'foo=bar&buz=__');
        assert.equal(res.status, 200);
      });

      it('should default to GET.mock if no matching parameter file is found', function() {
        processRequest('/query-params?a=c', 'GET');

        assert.equal(res.status, 200);
      });

      it('should be able to include POST bodies and query params', function(done) {
        const req = new MockReq({
          method: 'POST',
          url: '/return-200?a=b',
          headers: {
            Accept: 'text/plain'
          }
        });
        req.write('Hello=123');
        req.end();

        mockserver(mocksDirectory, verbose)(req, res);

        req.on('end', function() {
          assert.equal(res.body, 'Hella');
          assert.equal(res.status, 200);
          done();
        });
      });

      it('should be able to include POST bodies and query params with wildcards', function(done) {
        const req = new MockReq({
          method: 'POST',
          url: '/return-200?c=d',
          headers: {
            Accept: 'text/plain'
          }
        });
        req.write('Hello=456');
        req.end();

        mockserver(mocksDirectory, verbose)(req, res);

        req.on('end', function() {
          assert.equal(res.body, 'Hello!!!');
          assert.equal(res.status, 200);
          done();
        });
      });
    });

    
    describe('.getResponseDelay', function() {
      it('should return a value greater than zero when valid', function() {
        const ownValueHeaders = [
          { 'Response-Delay': 1 },
          { 'Response-Delay': 99 },
          { 'Response-Delay': '9999' },
        ];
        ownValueHeaders.forEach(function(header) {
          const val = mockserver.getResponseDelay(header);
          assert(val > 0, `Value found was ${val}`);
        });
      });
      it('should return zero for invalid values', function() {
        const zeroValueHeaders = [
          { 'Response-Delay': 'a' },
          { 'Response-Delay': '' },
          { 'Response-Delay': '-1' },
          { 'Response-Delay': -1 },
          { 'Response-Delay': 0 },
          {},
          null,
          undefined,
        ];
        zeroValueHeaders.forEach(function(header) {
          const val = mockserver.getResponseDelay(header);
          assert.equal(val, 0, `Value found was ${val}`);
        });
      });
    });
    describe('Custom response codes', function() {
        it('response status codes depends on request case 400 Bad request', function (done) {
          var req = new MockReq({
              method: 'POST',
              url: '/headerimportjs',
              headers: {},
          });
          req.write(JSON.stringify({ baz: '123' }));
          req.end();

          mockserver(mocksDirectory, verbose)(req, res);

          req.on('end', function () {
              assert.equal(res.status, '400');
              done();
          });
      });
      it('response status codes depends on request case 200 OK', function (done) {
          var req = new MockReq({
              method: 'POST',
              url: '/headerimportjs',
              headers: {},
          });
          req.write(JSON.stringify({ foo: '123' }));
          req.end();

          mockserver(mocksDirectory, verbose)(req, res);

          req.on('end', function () {
              assert.equal(res.status, '200');
              done();
          });

        });
    });

  describe('Response reason', function() {
    it('should be a default one, if not given', function(done) {
      processRequest('/response-reason', 'GET', function(res) {
        assert.equal(res.status, 200);
        assert.equal(res.reason, null);
        assert.equal(JSON.stringify(res.headers), '{"Content-Type":"text"}');
        assert.equal(res.body, 'Welcome!');
        done();
      });
    });
    it('should be the mocked one, if given', function(done) {
      processRequest('/response-reason', 'POST', function(res) {
        assert.equal(res.status, 200);
        assert.equal(res.reason, ' Oook! ');
        assert.equal(JSON.stringify(res.headers), '{"Content-Type":"text"}');
        assert.equal(res.body, 'Welcome!');
        done();
      });
    });
  });
});
