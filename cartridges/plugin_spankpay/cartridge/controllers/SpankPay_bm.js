'use strict';

const boguard = require('~/cartridge/scripts/boguard');

function Dashboard() { //business manager merchant dashboard
    let pdict = {};
    let template = '/spankpay/dashboard';
    const ISML = require('dw/template/ISML');
    ISML.renderTemplate(template, pdict);
}

function Prefs() {
    var URLUtils = require('dw/web/URLUtils');
    var csrfProtection = require('dw/web/CSRFProtection');
    let url = URLUtils.url('ViewApplication-BM','csrf_token',csrfProtection.generateToken());
    response.redirect(url+'#/?preference#site_preference_group_attributes!id!SPANKPAY');
}

module.exports = {
    Dashboard: boguard.ensure(['https'], Dashboard),
    Prefs: boguard.ensure(['https'], Prefs)
};
