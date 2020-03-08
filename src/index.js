const cron = require('node-cron');
const nodemailer = require('nodemailer');
const axios = require('axios').default;
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const querystring = require('querystring');
const fs = require('fs');
const parse = require('node-html-parser').parse;

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

const createTable = (reqs) => {
  let html = `
  <table cellspacing="5">
    <tr>
      <th>Id</th>
      <th>Calif</th>
      <th>Rate</th>
      <th>Amount</th>
      <th>Term</th>
    </tr>
  `;
  for (const req of reqs) {
    const row = `
    <tr>
      <td>${req.id}</td>
      <td>${req.calif}</td>
      <td>${req.rate}</td>
      <td>${req.amount}</td>
      <td>${req.term}</td>
    </tr>
    `;
    html += row;
  }
  html += '</table>';
  return html;
}

const checkYtp = async () => {
  try {
    const loginPayload = {
      "uf8": "✓",
      "sessions[email]": conf.ytp_login,
      "sessions[password]": conf.ytp_password,
      "commit": "Iniciar Sesión"
    };

    const login = await instance.post('sign_in', {
      data: querystring.stringify(loginPayload),
    });

    let history = {};
    if (fs.existsSync(STORE_FILE)) {
      const storage = fs.readFileSync(STORE_FILE);
      history = JSON.parse(storage);
    }

    const prevReqCount = history.reqCount || 0;
    const prevReqsHistory = history.reqsHistory || {};

    const requisitionsListRequest = await instance.get('user/requisitions_listings');

    // console.log(requisitionsListRequest.data);

    const _root = parse(requisitionsListRequest.data);
    const requisitionNodes = _root.querySelectorAll('tr.req-item');

    const activeRequisitions = [];
    const newReqsHistory = {};

    for (const requisiton of requisitionNodes) {
      const id = requisiton.querySelector('.id').removeWhitespace().rawText;
      const calif = requisiton.querySelector('.calif').removeWhitespace().rawText;
      const rate = requisiton.querySelector('.rate').removeWhitespace().rawText;
      const amount = requisiton.querySelector('.amount').removeWhitespace().rawText;
      const term = requisiton.querySelector('.term').removeWhitespace().rawText;
      const isNew = !(prevReqsHistory[id]);

      const reqObj = { calif, rate, amount, term };

      if (isNew) {
        newReqsHistory[id] = reqObj;
      }

      const reqObjWithNewFlag = { id, ...reqObj, new: isNew };
      activeRequisitions.push(reqObjWithNewFlag);

    }

    const reqCount = activeRequisitions.length;
    const newRequisitions = activeRequisitions.filter(r => r.new);
    const newRequisitionsCount = newRequisitions.length;

    if (newRequisitionsCount > 0) {
      console.log('Notify...');
      let text = `There are ${reqCount} requisitions. ${newRequisitionsCount} new.\n`;
      console.log(text);
      const tableHtml = createTable(newRequisitions);
      text += tableHtml;
      await transport.sendMail({...message, html: text});
    } else {
      console.log(`${reqCount} requisitions. No new requisitions.`);
    }

    history = {
      reqCount,
      reqsHistory: {
        ...prevReqsHistory,
        ...newReqsHistory
      }
    };

    fs.writeFileSync(STORE_FILE, JSON.stringify(history, null, 1));

  } catch (error) {
    console.error(error);
  }
};

checkYtp();

cron.schedule('*/5 * * * *', () => {
  checkYtp();
});
