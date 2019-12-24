'use strict';

var server = require('server');
const spankpayEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('spankpayEnabled');
const spankpayAllowAnonymous = require('dw/system/Site').getCurrent().getCustomPreferenceValue('spankpayAllowAnonymous');

if(spankpayEnabled) {
    var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

    /**
     *  Handle Ajax payment (and billing) form submit. Replaces CheckoutServices-SubmitPayment for SpankPay only
     */
    server.post(
        'SubmitPayment',
        server.middleware.https,
        csrfProtection.validateAjaxRequest,
        function (req, res, next) {
            var PaymentManager = require('dw/order/PaymentMgr');
            var HookManager = require('dw/system/HookMgr');
            var Resource = require('dw/web/Resource');
            var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

            var viewData = {};
            var paymentForm = server.forms.getForm('billing');

            var formFieldErrors = [];
            var paymentFormResult = {};

            if(!spankpayAllowAnonymous) {
                var contactInfoFormErrors = COHelpers.validateFields(paymentForm.contactInfoFields);

                if (Object.keys(contactInfoFormErrors).length) {
                    formFieldErrors.push(contactInfoFormErrors);
                } else {
                    viewData.email = { value: paymentForm.contactInfoFields.email.value };
                    viewData.phone = { value: paymentForm.contactInfoFields.phone.value };
                }
            } else {
                viewData.email = { value: paymentForm.contactInfoFields.email.value };
                viewData.phone = { value: paymentForm.contactInfoFields.phone.value };
            }

            var paymentMethodIdValue = 'SPANKPAY';
            if (!PaymentManager.getPaymentMethod(paymentMethodIdValue).paymentProcessor) {
                throw new Error(Resource.msg(
                    'error.payment.processor.missing',
                    'checkout',
                    null
                ));
            }

            var paymentProcessor = PaymentManager.getPaymentMethod(paymentMethodIdValue).getPaymentProcessor();

            if (HookManager.hasHook('app.payment.processor.' + paymentProcessor.ID.toLowerCase())) {
                paymentFormResult = HookManager.callHook('app.payment.processor.' + paymentProcessor.ID.toLowerCase(),
                    'processForm',
                    req,
                    paymentForm,
                    viewData
                );
            } else {
                paymentFormResult = HookManager.callHook('app.payment.form.processor.default_form_processor', 'processForm');
            }

            if (paymentFormResult.error && paymentFormResult.fieldErrors) {
                formFieldErrors.push(paymentFormResult.fieldErrors);
            }

            if (formFieldErrors.length || paymentFormResult.serverErrors) {
                // respond with form data and errors
                res.json({
                    form: paymentForm,
                    fieldErrors: formFieldErrors,
                    serverErrors: paymentFormResult.serverErrors ? paymentFormResult.serverErrors : [],
                    error: true
                });
                return next();
            }

            res.setViewData(paymentFormResult.viewData);

            this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
                var BasketMgr = require('dw/order/BasketMgr');
                var HookMgr = require('dw/system/HookMgr');
                var PaymentMgr = require('dw/order/PaymentMgr');
                var Transaction = require('dw/system/Transaction');
                var AccountModel = require('*/cartridge/models/account');
                var OrderModel = require('*/cartridge/models/order');
                var URLUtils = require('dw/web/URLUtils');
                var Locale = require('dw/util/Locale');
                var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
                var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
                var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');

                var currentBasket = BasketMgr.getCurrentBasket();

                var billingData = res.getViewData();

                if (!currentBasket) {
                    delete billingData.paymentInformation;

                    res.json({
                        error: true,
                        cartError: true,
                        fieldErrors: [],
                        serverErrors: [],
                        redirectUrl: URLUtils.url('Cart-Show').toString()
                    });
                    return;
                }

                var validatedProducts = validationHelpers.validateProducts(currentBasket);
                if (validatedProducts.error) {
                    delete billingData.paymentInformation;

                    res.json({
                        error: true,
                        cartError: true,
                        fieldErrors: [],
                        serverErrors: [],
                        redirectUrl: URLUtils.url('Cart-Show').toString()
                    });
                    return;
                }

                var billingAddress;
                var billingForm = server.forms.getForm('billing');
                var paymentMethodID = 'SPANKPAY';
                var result;

                Transaction.wrap(function () {
                    //OrderMgr.createOrder() has a stack overflow error if a billingAddress isn't provided.
                    billingAddress = currentBasket.createBillingAddress();
                    billingAddress.setFirstName('SPANKPAY');
                    billingAddress.setLastName('CUSTOMER');
                    billingAddress.setAddress1('200 Westminster Avenue');
                    billingAddress.setCity('Venice');
                    billingAddress.setPostalCode('90291');
                    billingAddress.setStateCode('CA');
                    billingAddress.setCountryCode('US');
                    billingAddress.setPhone(billingData.phone.value);
                    currentBasket.setCustomerEmail(billingData.email.value);
                });

                // Validate payment instrument
                var spankpayPaymentMethod = PaymentMgr.getPaymentMethod('SPANKPAY');

                var applicablePayment = spankpayPaymentMethod.isApplicable(
                    req.currentCustomer.raw,
                    req.geolocation.countryCode,
                    null
                );

                if (!applicablePayment) {
                    // Invalid Payment Method for this customer
                    var invalidPaymentMethod = Resource.msg('error.payment.not.valid', 'spankpay', null);
                    delete billingData.paymentInformation;
                    res.json({
                        form: billingForm,
                        fieldErrors: [],
                        serverErrors: [invalidPaymentMethod],
                        error: true
                    });
                    return;
                }

                // check to make sure there is a payment processor
                if (!PaymentMgr.getPaymentMethod(paymentMethodID).paymentProcessor) {
                    throw new Error(Resource.msg(
                        'error.payment.processor.missing',
                        'checkout',
                        null
                    ));
                }

                var processor = PaymentMgr.getPaymentMethod(paymentMethodID).getPaymentProcessor();

                if (HookMgr.hasHook('app.payment.processor.' + processor.ID.toLowerCase())) {
                    result = HookMgr.callHook('app.payment.processor.' + processor.ID.toLowerCase(),
                        'Handle',
                        currentBasket,
                        billingData.paymentInformation
                    );
                } else {
                    result = HookMgr.callHook('app.payment.processor.default', 'Handle');
                }

                if (result.error) { //this shouldn't happen
                    delete billingData.paymentInformation;

                    res.json({
                        form: billingForm,
                        fieldErrors: result.fieldErrors,
                        serverErrors: result.serverErrors,
                        error: true
                    });
                    return;
                }

                // Calculate the basket
                Transaction.wrap(function () {
                    basketCalculationHelpers.calculateTotals(currentBasket);
                });

                // Re-calculate the payments.
                var calculatedPaymentTransaction = COHelpers.calculatePaymentTransaction(
                    currentBasket
                );

                if (calculatedPaymentTransaction.error) {
                    res.json({
                        form: paymentForm,
                        fieldErrors: [],
                        serverErrors: [Resource.msg('error.technical', 'checkout', null)],
                        error: true
                    });
                    return;
                }

                var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');
                if (usingMultiShipping === true && currentBasket.shipments.length < 2) {
                    req.session.privacyCache.set('usingMultiShipping', false);
                    usingMultiShipping = false;
                }

                hooksHelper('app.customer.subscription', 'subscribeTo', [paymentForm.subscribe.checked, paymentForm.contactInfoFields.email.htmlValue], function () {});

                var currentLocale = Locale.getLocale(req.locale.id);

                var basketModel = new OrderModel(
                    currentBasket,
                    { usingMultiShipping: usingMultiShipping, countryCode: currentLocale.country, containerView: 'basket' }
                );

                var accountModel = new AccountModel(req.currentCustomer);
                var renderedStoredPaymentInstrument = COHelpers.getRenderedPaymentInstruments(
                    req,
                    accountModel
                );

                delete billingData.paymentInformation;

                //create the order
                var validatedProducts = validationHelpers.validateProducts(currentBasket);
                if (validatedProducts.error) {
                    res.json({
                        error: true,
                        cartError: true,
                        fieldErrors: [],
                        serverErrors: [],
                        redirectUrl: URLUtils.url('Cart-Show').toString()
                    });
                    return next();
                }

                if (req.session.privacyCache.get('fraudDetectionStatus')) {
                    res.json({
                        error: true,
                        cartError: true,
                        redirectUrl: URLUtils.url('Error-ErrorCode', 'err', '01').toString(),
                        errorMessage: Resource.msg('error.technical', 'checkout', null)
                    });

                    return next();
                }

                var validationOrderStatus = hooksHelper('app.validate.order', 'validateOrder', currentBasket, require('*/cartridge/scripts/hooks/validateOrder').validateOrder);
                if (validationOrderStatus.error) {
                    res.json({
                        error: true,
                        errorMessage: validationOrderStatus.message
                    });
                    return next();
                }

                // Check to make sure there is a shipping address
                if (currentBasket.defaultShipment.shippingAddress === null) {
                    res.json({
                        error: true,
                        errorStage: {
                            stage: 'shipping',
                            step: 'address'
                        },
                        errorMessage: Resource.msg('error.no.shipping.address', 'checkout', null)
                    });
                    return next();
                }

                // Calculate the basket
                Transaction.wrap(function () {
                    basketCalculationHelpers.calculateTotals(currentBasket);
                });

                // Re-validates existing payment instruments
                var validPayment = COHelpers.validatePayment(req, currentBasket);
                if (validPayment.error) {
                    res.json({
                        error: true,
                        errorStage: {
                            stage: 'payment',
                            step: 'paymentInstrument'
                        },
                        errorMessage: Resource.msg('error.payment.not.valid', 'checkout', null)
                    });
                    return next();
                }

                // Re-calculate the payments.
                var calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(currentBasket);
                if (calculatedPaymentTransactionTotal.error) {
                    res.json({
                        error: true,
                        errorMessage: Resource.msg('error.technical', 'checkout', null)
                    });
                    return next();
                }

                // Creates a new order.
                var order = COHelpers.createOrder(currentBasket);
                if (!order) {
                    res.json({
                        error: true,
                        errorMessage: Resource.msg('error.technical', 'checkout', null)
                    });
                    return next();
                }

                res.json({
                    renderedPaymentInstruments: renderedStoredPaymentInstrument,
                    customer: accountModel,
                    order: basketModel,
                    form: billingForm,
                    orderNo: order.getOrderNo(),
                    orderToken: order.getOrderToken(),
                    orderTotal: order.getTotalGrossPrice().value,
                    orderCurrency: order.getTotalGrossPrice().currencyCode,
                    spankpayDescription: Resource.msg('spankpay.description', 'spankpay', null),
                    error: false
                });
            });

            return next();
        }
    );
/*
    server.post(
        'CreateSignature',
        server.middleware.https,
        function (req, res, next) {
            var OrderMgr = require('dw/order/OrderMgr');
            const spankpayUtils = require('~/cartridge/scripts/spankpay');
            let secretKey = Site.getCurrent().getCustomPreferenceValue('spankpaySecretKey');

            let orderNo = req.querystring.orderNo;
            let order = OrderMgr.getOrder(orderNo);
            let orderToken = order.getOrderToken();

            let data = req.body;
            data = data.replace('ORDERNO', orderNo);
            data = data.replace('ORDERTOKEN', orderToken);

            res.json({
                orderNo: orderNo,
                token: orderToken,
                sig: spankpayUtils.signSpankPayData(secretKey, data),
                body: data
            });
            return next();
        }
    );
*/
/*
    server.get(
        'GetBankingInfo',
        server.middleware.https,
        function (req, res, next) {
            var OrderMgr = require('dw/order/OrderMgr');

            let orderNo = req.querystring.orderNo;
            let order = OrderMgr.getOrder(orderNo);

            res.json({
                orderNo: orderNo,
                bankAccountHolder: order.getPaymentInstruments('SPANKPAY')[0].getBankAccountHolder(),
                bankAccountRoutingNumber: order.getPaymentInstruments('SPANKPAY')[0].getBankRoutingNumber(),
                bankAccountNumber: order.getPaymentInstruments('SPANKPAY')[0].getBankAccountNumber()
            });
            return next();
        }
    );
*/
    server.post(
        'PlaceOrder',
        server.middleware.https,
        function (req, res, next) {
            var URLUtils = require('dw/web/URLUtils');
            var Order = require('dw/order/Order');
            var OrderMgr = require('dw/order/OrderMgr');
            var Resource = require('dw/web/Resource');
            var Site = require('dw/system/Site');
            var Transaction = require('dw/system/Transaction');
            var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
            var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
            const spankpayUtils = require('~/cartridge/scripts/spankpay');

            let sig = req.httpHeaders.get('x-spankpay-signature');
            let apiKey = req.httpHeaders.get('x-spankpay-key');
            let publicKey = Site.getCurrent().getCustomPreferenceValue('spankpayPublicKey');
            let secretKey = Site.getCurrent().getCustomPreferenceValue('spankpaySecretKey');

            if(apiKey !== publicKey) {
                res.json({
                    received: false,
                    errorMessage: Resource.msg('error.webhook.mismatch', 'spankpay', null)
                });
                return next();
            }

            let spankPayData = spankpayUtils.decodeSpankPayWebhook(secretKey, sig, req.body);
            if(spankPayData[0]) {
                let invoiceObj = spankPayData[0];
                let orderNo = invoiceObj.invoice.metadata.orderNo ? invoiceObj.invoice.metadata.orderNo : null;
                let orderToken = invoiceObj.invoice.metadata.orderToken ? invoiceObj.invoice.metadata.orderToken : null;
                let order = OrderMgr.getOrder(orderNo);

                //get the order via orderNo and orderToken and make sure it's in CREATED status
                if(!order || !orderNo || !orderToken || orderToken !== order.orderToken) {
                    res.json({
                        received: false,
                        errorMessage: Resource.msg('error.webhook.missingorder', 'spankpay', null)
                    });
                    return next();
                }

                if(order.getStatus().value !== Order.ORDER_STATUS_CREATED) {
                    res.json({
                        received: false,
                        errorMessage: Resource.msg('error.webhook.orderprocessed', 'spankpay', null)
                    });
                    return next();
                }

                //save the signature as the nonce on the order (spankpayNonces) to make sure we don't process the same request more than once
                //there should be a better way to do this, but the custom object set of string proved to be... difficult to work with
                let nonces = [];
                if(order.custom.spankpayNonces.length > 0) {
                    for(let i=0;i<order.custom.spankpayNonces.length;i++) {
                        nonces.push(order.custom.spankpayNonces[i]);
                    }
                }
                if(nonces.indexOf(sig) == -1) {
                    nonces.push(sig);
                    Transaction.wrap(function () { order.custom.spankpayNonces = nonces; });
                } else {
                    res.json({
                        received: false,
                        errorMessage: Resource.msg('error.webhook.duplicate', 'spankpay', null)
                    });
                    return next();
                }

                // Handles payment "authorization"
                var handlePaymentResult = COHelpers.handlePayments(order, invoiceObj.invoiceId);
                if (handlePaymentResult.error) {
                    res.json({
                        received: false,
                        errorMessage: Resource.msg('error.technical', 'checkout', null)
                    });
                    return next();
                }

                //fraud detection isn't really a thing for crypto yet, so this is largely useless
                var fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', order, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
                if (fraudDetectionStatus.status === 'fail') {
                    Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

                    // fraud detection failed
                    //req.session.privacyCache.set('fraudDetectionStatus', true); //not settable since this is a webhook from SpankPay

                    res.json({
                        received: false,
                        cartError: true,
                        redirectURL: URLUtils.url('Error-ErrorCode', 'err', fraudDetectionStatus.errorCode).toString(),
                        errorMessage: Resource.msg('error.technical', 'checkout', null)
                    });

                    return next();
                }

                // Places the order
                var placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus);
                if (placeOrderResult.error) {
                    res.json({
                        received: false,
                        errorMessage: Resource.msg('error.technical', 'checkout', null)
                    });
                    return next();
                }

                Transaction.wrap(function () { order.removeRemoteHost(); }); //remove the IP address for the order, if any, because crypto!

                if(!empty(order.getCustomerEmail())) {
                    COHelpers.sendConfirmationEmail(order, req.locale.id);

                    //sandbox mail is broken for some reason, but this works!
                    let content = "Congrats on your crypto order number: " + order.orderNo;
                    let mail = new dw.net.Mail();
                    mail.addTo(order.customerEmail);
                    mail.setFrom("no-reply@demandware.com");
                    mail.setSubject(Resource.msg('subject.order.confirmation.email', 'order', null));
                    mail.setContent(dw.value.MimeEncodedText(content));
                    mail.send();
                }

                res.json({
                    received: true,
                    confirmationURL: URLUtils.url('Order-Confirm','ID',orderNo,'token',orderToken).toString()
                });
            } else {
                res.json({
                    received: false,
                    reason: spankPayData[2]
                });
            }

            return next();
        }
    );
}

module.exports = server.exports();
