// This script copies the most common card network SVGs from payment-icons to the local assets folder for use in the UI.
const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../node_modules/payment-icons/svg/flat');
const destDir = path.resolve(__dirname, '../apps/web/src/assets/payment-icons');

const files = [
  'visa.svg',
  'mastercard.svg',
  'amex.svg',
  'discover.svg',
  'jcb.svg',
  'diners.svg',
  'unionpay.svg',
  'elo.svg',
  'hipercard.svg',
  'paypal.svg',
  'default.svg'
];

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

files.forEach(file => {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file}`);
  } else {
    console.log(`Missing: ${file}`);
  }
});
