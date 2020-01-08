# SpankPay

SpankPay SFCC Cartridge by [SpankChain](https://www.spankchain.com)

# SFRA version

This cartridge is built against SFCC [SFRA](https://github.com/SalesforceCommerceCloud/storefront-reference-architecture) version 4.4.1

# Getting Started

1. Clone this repository.

2. Run `npm install` to install all of the local dependencies (**node version 11.15 required**)

3. Run `npm run compile:js` from the command line to compile all client-side JS files. Run `npm run compile:scss` to do the same for CSS.

4. Create `dw.json` file in the root of the project:
```json
{
	"hostname": "your-sandbox-hostname.demandware.net",
	"username": "yourlogin",
	"password": "yourpwd",
	"cartridge": ["app_storefront_base", "bm_app_storefront_base", "plugin_spankpay", "modules"],
	"code-version": "version_to_upload_to"
}
```

5. Run `npm run uploadCartridge`. It will upload `app_storefront_base`, `modules`, `bm_app_storefront_base`, and `plugin_spankpay` cartridges to the sandbox you specified in `dw.json` file.

6. Add the `plugin_spankpay` cartridge to your cartridge path in _Administration >  Sites >  Manage Sites > RefArch - Settings_ (Note: This should already be populated by the sample data in Step 6).

7. Import `payment-methods.xml` from the `./metadata/ordering` folder with Business Manager to install the custom SPANKPAY payment method.

8. Import `system-object-types.xml` from the `./metadata/site/meta` folder with Business Manager to install the custom SPANKPAY site preferences.

9. Navigate to the new SPANKPAY custom site preferences in Business Manager (`Merchant Tools -> Site Preferences -> Custom Preferences -> SPANKPAY`) and configure your private/public keys and other preferences.

10. Navigate to `Merchant Tools -> Ordering -> Payment Processors` and create a NEW Payment Processor with ID: SPANKPAY and Description: SpankPay by SpankChain

11. Navigate to `Administration -> Organization -> Roles -> {APPROPRIATE ROLE} - Business Manager Modules` and find the "SpankPay" modules Dashboard and Prefernces, and allow `write` permissions where appropriate. This will append a new SpankPay submenu under `Merchant Tools`

12. SpankPay!
