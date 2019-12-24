'use strict';

/**
 * This is a collection of decorators for functions which performs several security checks.
 * They can be combined with each other to configure the necessary constraints for a function that is exposed to the Internet.
 *
 * @module guard
 *
 * @example
 * <caption>Example of an Account controller</caption>
 * function show() {
 *     // shows account landing page
 * }
 *
 * // allow only GET requests via HTTPS for logged in users
 * exports.Show = require('~/guard').ensure(['get','https','loggedIn'],show);
 */
var LOGGER   = dw.system.Logger.getLogger('guard');
var Pipeline = require('dw/system/Pipeline');

var CurrentSite = require('dw/system/Site').current;

/**
 * Performs a protocol switch for the URL of the current request to HTTPS. Responds with a redirect to the client.
 *
 * @return {boolean} false, if switching is not possible (for example, because its a POST request)
 */
function switchToHttps() {
    if (request.httpMethod !== 'GET') {
        // switching is not possible, send error 403 (forbidden)
        response.sendError(403);

        return false;
    }

    var url = 'https://' + request.httpHost + request.httpPath;

    if (!empty(request.httpQueryString)) {
        url += '?' + request.httpQueryString;
    }

    response.redirect(url);

    return true;
}

/**
 * The available filters for endpoints, the names of the methods can be used in {@link module:guard~ensure}
 * @namespace
 */
var Filters = {
    /** Action must be accessed via HTTPS */
    https: function() {
        return request.isHttpSecure();
    },
    /** Action must be accessed via HTTP */
    http: function() {
        return !this.https();
    },
    /** Action must be accessed via a GET request */
    get: function() {
        return request.httpMethod === 'GET';
    },
    /** Action must be accessed via a POST request */
    post: function() {
        return request.httpMethod === 'POST';
    },
    /**
     *
     * @return {boolean}
     */
    permissions: function() {
        var currentSession = session;
        var actionA = currentSession.clickStream.last.pipelineName.split('-');
        var pipeline = actionA[0];
        var startNode	= actionA[1];

        if (!empty(pipeline) && !empty(startNode))        {
            var pdict = Pipeline.execute('Prefix-Start', {
                CurrentPipelineName : pipeline, // use your extension controller name here
                CurrentStartNodeName: startNode // use your extension start node name here
            });
            // this is an indicator that the prefix pipeline went straight through
            return !empty(pdict.CurrentUserProfile);
        }
    },
    /** Action must only be used as remote include */
    include: function() {
        return request.isIncludeRequest();
    }
};

/**
 * This function should be used to secure public endpoints by applying a set of predefined filters.
 *
 * @param  {string[]} filters The filters which need to be passed to access the page
 * @param  {function} action  The action which represents the resource to show
 * @param  {Object}   params  Additional parameters which are passed to all filters and the action
 * @see module:guard~Filters
 * @see module:guard
 */
function ensure(filters, action, params) {
    return expose(function(args) {
        var error;
        var filtersPassed = true;
        var errors = [];

        params = extend(params, args);

        //Permissions always have to be checked for Business Manager requests
        if ((session.userAuthenticated || CurrentSite.ID === 'Sites-Site') && filters.indexOf('permissions') === -1) {
            filters.push('permissions');
        }

        for (var i = 0; i < filters.length; i++) {
            LOGGER.debug('Ensuring guard "{0}"...', filters[i]);

            filtersPassed = Filters[filters[i]].apply(Filters);

            if (!filtersPassed) {
                errors.push(filters[i]);

                if (filters[i] === 'https') {
                    error = switchToHttps;
                }
                break;
            }
        }

        if (!error) {
            error = function() {
                throw new Error('Guard(s) ' + errors.join('|') + ' did not match the incoming request.');
            };
        }

        if (filtersPassed) {
            LOGGER.debug('...passed.');

            return action(params);
        } else {
            LOGGER.debug('...failed. {0}', error.name);

            return error(params);
        }
    });
}

/**
 * Exposes the given action to be accessible from the web. The action gets a property which marks it as exposed. This
 * property is checked by the platform.
 */
function expose(action) {
    action.public = true;

    return action;
}

function extend(target, source) {
    var _source;

    if (!target) {
        return source;
    }

    for (var i = 1; i < arguments.length; i++) {
        _source = arguments[i];
        for (var prop in _source) {
            // recurse for non-API objects
            if (_source[prop] && 'object' === typeof _source[prop] && !_source[prop].class) {
                target[prop] = extend(target[prop], _source[prop]);
            } else {
                target[prop] = _source[prop];
            }
        }
    }

    return target;
}

/*
 * Module exports
 */
/** @see module:guard~expose */
exports.all = expose;

/**
 * Use this method to combine different filters, typically this is used to secure methods when exporting
 * them as publicly avaiblable endpoints in controllers.
 *
 * @example
 * // allow only GET requests for the bm endpoint
 * exports.bm = require('~/guard').ensure(['https'],bm);
 *
 * // allow only POST requests via HTTPS for the Find endpoint
 * exports.Find = require('~/guard').ensure(['post','https'],find);
 */
exports.ensure = ensure;