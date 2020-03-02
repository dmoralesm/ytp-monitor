const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const conf = require('./conf.json');

const STORE_FILE = 'src/storage.json';

const transport = nodemailer.createTransport({
  host: conf.smtp_host,
  port: conf.smtp_port,
  auth: {
    user: conf.smtp_user,
    pass: conf.smtp_password
  }
});

const message = {
  from: conf.smtp_user,
  to: conf.to_email,
  subject: 'YTP - New requisitions',
  text: ''
};


(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto('https://www.yotepresto.com/sesion-inversionistas');

  await page.type('input#sessions_email', conf.email);
  await page.type('input#sessions_password', conf.password);
  await page.keyboard.press('Enter');

  await page.waitForNavigation();

  await page.goto('https://www.yotepresto.com/user/dashboard_widgets/in_funding');
  const html = await page.content();

  const exp = /\&gt;(\d+)&lt;/i;
  const match = html.match(exp);
  const reqCount = +match[1];

  let prev = {};
  if (fs.existsSync(STORE_FILE)) {
    const storage = fs.readFileSync(STORE_FILE);
    prev = JSON.parse(storage);
  }

  if (reqCount > prev.reqCount) {
    console.log('Notify...');
    const text = `The are ${reqCount} new requisitions.`;
    console.log(text);
    await transport.sendMail({...message, text});
  }

  fs.writeFileSync(STORE_FILE, JSON.stringify({reqCount}));
  await browser.close();
})();
