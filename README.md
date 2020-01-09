# SpankPay

[SpankPay](https://spankpay.com) SFCC Cartridge by [SpankChain](https://www.spankchain.com)

The Salesforce Commerce Cloud [SpankPay](https://spankpay.com) Cartridge is a lightweight, Salesforce Reference App best-practice-following implementation of [SpankChain](https://www.spankchain.com)'s [SpankPay](https://spankpay.com) blockchain-payment gateway.

# SFRA version

This cartridge is built against [SFCC SFRA](https://github.com/SalesforceCommerceCloud/storefront-reference-architecture) version 4.4.1

# Installation

1. Clone this repository.

2. Run `npm install` to install all of the local dependencies (**node version 11.15 required**).

3. Edit line 15 of the included `webpack.config.js` to point to your local version of the `storefront-reference-architcture` repository to allow jQuery to be referenced correctly in the build.

4. Run `npm run compile:js` from the command line to compile all client-side JS files. Run `npm run compile:scss` to do the same for CSS.

5. Create `dw.json` file in the root of the project:
```json
{
	"hostname": "your-sandbox-hostname.demandware.net",
	"username": "yourlogin",
	"password": "yourpwd",
	"cartridge": ["app_storefront_base", "bm_app_storefront_base", "plugin_spankpay", "modules"],
	"code-version": "version_to_upload_to"
}
```

6. Run `npm run uploadCartridge`. It will upload `app_storefront_base`, `modules`, `bm_app_storefront_base`, and `plugin_spankpay` cartridges to the sandbox you specified in `dw.json` file.

7. Add the `plugin_spankpay` cartridge to your cartridge path in _Administration >  Sites >  Manage Sites > {YOURSITE} - Settings_.

8. Import `payment-methods.xml` from the `./metadata/ordering` folder with Business Manager to install the custom SPANKPAY payment method.

9. Import `system-and-custom-object-types.xml` from the `./metadata/site/meta` folder with Business Manager to install the custom SPANKPAY Site Preferences and spankPayAuth Custom Object type.

10. Navigate to the new SPANKPAY custom site preferences in Business Manager (_Merchant Tools -> Site Preferences -> Custom Preferences -> SPANKPAY_) and configure your private/public keys and other preferences. If you haven't yet signed up for a [SpankPay Merchant account](https://spankpay.com), now would be a good time!

11. Navigate to _Merchant Tools -> Ordering -> Payment Processors_ and create a new Payment Processor with ID: SPANKPAY and Description: SpankPay by SpankChain

12. Navigate to _Administration -> Organization -> Roles -> {APPROPRIATE ROLE} - Business Manager Modules_ and find the "SpankPay" modules "Dashboard" and "Preferences", and allow `write` permissions where appropriate. This will append a new SpankPay submenu under the site's _Merchant Tools_

13. [SpankPay](https://spankpay.com)!