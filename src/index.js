const cron = require('node-cron');
const nodemailer = require('nodemailer');
const axios = require('axios').default;
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const querystring = require('querystring');
const fs = require('fs');

const conf = require('./conf.json');

const STORE_FILE = 'src/storage.json';

const cookieJar = new tough.CookieJar();

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

const instance = axios.create({
  withCredentials: true,
  baseURL: 'https://www.yotepresto.com/',
  headers: {
    'Accept': '*/*;q=0.5, text/javascript, application/javascript, application/ecmascript, application/x-ecmascript',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36'
  },
});

axiosCookieJarSupport(instance);
// instance.defaults.jar = cookieJar;
instance.defaults.jar = true;

const checkYtp = async () => {
  try {
    const loginPayload = {
      "uf8": "✓",
      "sessions[email]": conf.email,
      "sessions[password]": conf.password,
      "commit": "Iniciar Sesión"
    };

    const login = await instance.post('sign_in', {
      data: querystring.stringify(loginPayload),
    });

    const inFunding = await instance.get('user/dashboard_widgets/in_funding');

    // console.log(inFunding.data);

    const exp = /<span>(\d+)<\/span>/i;
    const match = inFunding.data.match(exp);
    const reqCount = +match[1];

    let prev = {};
    if (fs.existsSync(STORE_FILE)) {
      const storage = fs.readFileSync(STORE_FILE);
      prev = JSON.parse(storage);
    }
    const prevReqCount = prev.reqCount || 0;

    if (reqCount > prevReqCount) {
      console.log('Notify...');
      const text = `There are ${reqCount} new requisitions.`;
      console.log(text);
      await transport.sendMail({...message, text});
    } else {
      console.log('No new requisitions.');
    }

    fs.writeFileSync(STORE_FILE, JSON.stringify({reqCount}));

  } catch (error) {
    console.error(error);
  }
};

checkYtp();

cron.schedule('*/5 * * * *', () => {
  console.log('running a task every 5 minutes');
  checkYtp();
});
