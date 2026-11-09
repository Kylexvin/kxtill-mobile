Split payments — server already supports payments[]. UI is additive.

Unit picker — multi-unit products (bottle vs crate). Cart line already carries unitId; needs a small picker modal.

Backend 500→400 mapping for stock errors — cosmetic now, but nicer API hygiene.

Idempotency-Key / clientSaleId on the online path — the client already sends clientSaleId. Two-line server check makes retries safe.

Bigger, later:

Barcode scanning — UI placeholder is there; wire it to the camera or the existing BarcodeScannerScreen.

Voice search — placeholder only.

Share receipt — currently Alert.alert('Coming soon'). Wire to Share from react-native with the receipt payload as text.

Quick-add favorites / recent products — for the bus-station case, showing the last 5 products sold is huge. One endpoint (/dashboard/top-products or a new "recent" endpoint) + a chip strip above the search bar.

Cash tendered / change — for CASH, take tendered and show change. The payment modal currently sends the exact total.