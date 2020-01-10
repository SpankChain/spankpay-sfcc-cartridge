# SpankPay

[SpankPay](https://spankpay.com) SFCC Cartridge by [SpankChain](https://www.spankchain.com)

The Salesforce Commerce Cloud [SpankPay](https://spankpay.com) Cartridge is a lightweight Salesforce Reference App best-practice-following implementation of [SpankChain](https://www.spankchain.com)'s [SpankPay](https://spankpay.com) blockchain-payment gateway.

# SFRA version

This cartridge is built against [SFCC SFRA](https://github.com/SalesforceCommerceCloud/storefront-reference-architecture) version 4.4.1

# Installation

1. Clone this repository.

2. Modify `paths: { base: {} }` value to point to your local copy of the `storefront-reference-architecture`'s `app_storefront_base` cartridge.

3. Run `npm install` to install all of the local dependencies (**node version 11.15 required**).

4. Run `npm run compile:js` from the command line to compile all client-side JS files. Run `npm run compile:scss` to do the same for CSS.

5. Upload the `cartridges` folder to the appropriate instance with the WebDAV client of your choice.

6. Add the `plugin_spankpay` cartridge to your cartridge path in Business Manager at: _Administration >  Sites >  Manage Sites > {YOURSITE} - Settings_.

7. Import `payment-methods.xml` from the `./metadata/ordering` folder with Business Manager to install the custom SPANKPAY payment method.

8. Import `system-and-custom-object-types.xml` from the `./metadata/site/meta` folder with Business Manager to install the custom SPANKPAY Site Preferences and spankPayAuth Custom Object type.

9. Navigate to the new SPANKPAY custom site preferences in Business Manager (_Merchant Tools -> Site Preferences -> Custom Preferences -> SPANKPAY_) and configure your private/public keys and other preferences. If you haven't yet signed up for a [SpankPay Merchant account](https://spankpay.com), now would be a good time!

10. Navigate to _Merchant Tools -> Ordering -> Payment Processors_ in Business Manager and create a new Payment Processor with ID: SPANKPAY and Description: SpankPay by SpankChain

11. Navigate to _Administration -> Organization -> Roles -> {APPROPRIATE ROLE} - Business Manager Modules_ in Business Manager and find the "SpankPay" modules "Dashboard" and "Preferences", and allow `write` permissions where appropriate. This will append a new SpankPay submenu under the Business Manager's site's _Merchant Tools_

12. [SpankPay](https://spankpay.com)!
