'use strict';

var Order = module.superModule;
var server = require('server');
server.extend(Order);

const spankpayEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('spankpayEnabled');

if(spankpayEnabled) {
    server.append(
        'Confirm',
        function (req, res, next) {
            //original functionality moved from ChecoutServices-PlaceOrder (which we never call when it's a SpankPay order)
            var addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');
            var OrderMgr = require('dw/order/OrderMgr');
            var order = OrderMgr.getOrder(req.querystring.ID);
            var token = req.querystring.token ? req.querystring.token : null;

            if (!order
                || !token
                || token !== order.orderToken
                || order.customer.ID !== req.currentCustomer.raw.ID
            ) {
                return next();
            }

            if (req.currentCustomer.addressBook) {
                // save all used shipping addresses to address book of the logged in customer
                var allAddresses = addressHelpers.gatherShippingAddresses(order);
                allAddresses.forEach(function (address) {
                    if (!addressHelpers.checkIfAddressStored(address, req.currentCustomer.addressBook.addresses)) {
                        addressHelpers.saveAddress(address, req.currentCustomer, addressHelpers.generateAddressName(address));
                    }
                });
            }

            // Reset usingMultiShip after successful Order placement
            req.session.privacyCache.set('usingMultiShipping', false);

            return next();
        }
    );
}

module.exports = server.exports();
