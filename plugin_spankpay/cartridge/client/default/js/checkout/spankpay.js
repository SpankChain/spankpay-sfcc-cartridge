'use strict';

var formHelpers = require('base/checkout/formErrors');
var scrollAnimate = require('base/components/scrollAnimate');
var nextURL = false;

$('.spankpay').on('click', function (e) {
	e.preventDefault();
	$(this).attr('disabled', true);

	var defer = $.Deferred(); // eslint-disable-line

	formHelpers.clearPreviousErrors('.payment-form');

	var billingAddressForm = $('#dwfrm_billing .billing-address-block :input').serialize();

	$('body').trigger('checkout:serializeBilling', {
		form: $('#dwfrm_billing .billing-address-block'),
		data: billingAddressForm,
		callback: function (data) {
			if (data) {
				billingAddressForm = data;
			}
		}
	});

	var contactInfoForm = $('#dwfrm_billing .contact-info-block :input').serialize();

	$('body').trigger('checkout:serializeBilling', {
		form: $('#dwfrm_billing .contact-info-block'),
		data: contactInfoForm,
		callback: function (data) {
			if (data) {
				contactInfoForm = data;
			}
		}
	});

	var activeTabId = $('.tab-pane.active').attr('id');
	var paymentInfoSelector = '#dwfrm_billing .' + activeTabId + ' .payment-form-fields :input';
	var paymentInfoForm = $(paymentInfoSelector).serialize();

	$('body').trigger('checkout:serializeBilling', {
		form: $(paymentInfoSelector),
		data: paymentInfoForm,
		callback: function (data) {
			if (data) {
				paymentInfoForm = data;
			}
		}
	});

	var paymentForm = billingAddressForm + '&' + contactInfoForm + '&' + paymentInfoForm;
	$.ajax({
		url: $('.spankpay').data('submiturl'),
		method: 'POST',
		data: paymentForm,
		success: function (data) {
			if (data.error) {
				if (data.fieldErrors.length) {
					data.fieldErrors.forEach(function (error) {
						if (Object.keys(error).length) {
							formHelpers.loadFormErrors('.payment-form', error);
						}
					});
				}

				if (data.serverErrors.length) {
					data.serverErrors.forEach(function (error) {
						$('.error-message').show();
						$('.error-message-text').text(error);
						scrollAnimate($('.error-message'));
					});
				}

				if (data.cartError) {
					window.location.href = data.redirectUrl;
				}

				defer.reject();
			} else {
				scrollAnimate();
				defer.resolve(data);

				showSpankPay(data.orderNo, data.orderToken, data.orderTotal.toString(), data.orderCurrency, data.spankpayDescription);
			}
		},
		error: function (err) {
			$('.spankpay').attr('disabled', false);
			if (err.responseJSON && err.responseJSON.redirectUrl) {
				window.location.href = err.responseJSON.redirectUrl;
			}
		}
	});
});

function showSpankPay(orderNo, orderToken, orderTotal, orderCurrency, description) {
	spankpay.show({
		apiKey: $('.spankpay').data('apikey'),
		amount: orderTotal,
		currency: orderCurrency,
		description: description,
		metadata: {
			orderNo: orderNo,
			orderToken: orderToken
		},
		callbackUrl: $('.spankpay').data('callbackurl')
	});
}

//spankpay.on('open', () => { });

spankpay.on('payment', payment => {
	console.log('Payment: ' + payment.status, payment);
	let response = payment.receipt.responseBody;
	if(payment.status != 'succeeded') {
		if(response.redirectURL) {
			nextURL = response.redirectURL;
		} else {
			//close the spankpay window?
			$('.error-message').show();
			$('.error-message-text').text(response.errorMessage);
			scrollAnimate($('.error-message'));
		}
	} else {
		nextURL = response.confirmationURL;
	}
});

spankpay.on('close', () => {
	if(nextURL) { window.location.href = nextURL; }
});

/*
make the credit card images clickable and actually do something...
not sure why the SFRA functionality doesn't do this out of the box
*/
$('.payment-options .nav-item')
	.off('click') //unbind the existing event
	.on('click', function (e) {
		e.preventDefault();
		var methodID = $(this).data('method-id');
		$('.payment-information').data('payment-method-id', methodID);
		$('.credit-card-selection-new').find('.tab-pane').removeClass('active');
		if (methodID == 'CREDIT_CARD') {
			methodID = 'credit-card';
			$('.next-step-button').show();
			$('.billing-address-block').show();
			$('.contact-info-block .form-group.required label').addClass('form-control-label');
			$('.contact-info-block .form-group.required button').show();
			$('.spankpayAllowAnonymous').hide();
		}
		if (methodID == 'SPANKPAY') {
			methodID = 'spankpay';
			$('.next-step-button').hide();
			$('.billing-address-block').hide();
			if($('.spankpay').data('allowanonymous') === true) {
				$('#billingAddressSelector').val(''); //we are wiping any auto-filled values, because privacy!
				$('.billing-address input').val('');
				$('.billing-address select').val('');
				$('.contact-info-block .email').val('');
				$('.contact-info-block .phone').val('');
				$('.contact-info-block .form-group.required label').removeClass('form-control-label');
				$('.contact-info-block .form-group.required button').hide();
				$('.spankpayAllowAnonymous').show();
			}
		}
		let paymentOptionTab = $('[id=' + methodID + '-content');
		if (paymentOptionTab.length) { paymentOptionTab.addClass('active'); }
});
