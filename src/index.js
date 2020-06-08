const cron = require('node-cron');
const nodemailer = require('nodemailer');
const axios = require('axios').default;
const querystring = require('querystring');
const fs = require('fs');

const conf = require('./conf.json');
const { BASE_URL, SIGN_IN, REQ_LISTING, NOT_LOGGED } = require('./constants');
const { formatNumber } = require('./helpers');

const STORE_FILE = 'src/storage.json';

// const mock = require('./mock');
// const mockApi = require('./mock.json');

const transport = nodemailer.createTransport({
  host: conf.smtp_host,
  port: conf.smtp_port,
  auth: {
    user: conf.smtp_user,
    pass: conf.smtp_password
  }
});

const message = {
  from: `"YTP monitor" <${conf.smtp_user}>`,
  bcc: conf.to_email,
  subject: 'New loan requisitions',
  text: ''
};

const instance = axios.create({
  withCredentials: true,
  baseURL: BASE_URL,
  headers: {
    'Accept': '*/*;q=0.5, text/javascript, application/javascript, application/ecmascript, application/x-ecmascript',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36'
  },
});

let ytp_client = null;
let ytp_accessToken = null;

const createTable = (reqs) => {
  let html = `
  <table cellspacing="5">
    <tr>
      <th>Id</th>
      <th>Qual.</th>
      <th>Rate</th>
      <th>Amount</th>
      <th>Term</th>
      <th>Remain</th>
      <th>Progress</th>
    </tr>
  `;
  for (const req of reqs) {
    const row = `
    <tr>
      <td>${req.id}</td>
      <td>${req.qualification}</td>
      <td>${req.rate}%</td>
      <td>${formatNumber(req.amount)}</td>
      <td>${req.term}</td>
      <td>${formatNumber(req.remain)}</td>
      <td>${req.progress}%</td>
    </tr>
    `;
    html += row;
  }
  html += '</table>';
  return html;
}

const doLogin = async () => {
  try {
    console.log('Trying to log in...');
    const loginInfo = {
      "email": conf.ytp_login,
      "password": conf.ytp_password,
    };
    const loginPayload = querystring.stringify(loginInfo);

    const login = await instance.post(SIGN_IN, loginPayload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
    });

    ytp_client = login.headers['client'];
    ytp_accessToken = login.headers['access-token'];

  } catch(error) {
    console.log("Error", error.response.status, error.response.statusText);
    if (error.response.data) {
      console.log("Login error response:", error.response.data);
    }

  }
}

const checkYtp = async () => {
  try {
    let history = {};
    if (fs.existsSync(STORE_FILE)) {
      const storage = fs.readFileSync(STORE_FILE);
      history = JSON.parse(storage);
    }

    const prevReqCount = history.reqCount || 0;
    const prevReqsHistory = history.reqsHistory || {};

    let requisitionsListRequest = await instance.get(REQ_LISTING, {
      headers: {
        "uid": conf.ytp_login,
        "client": ytp_client,
        "token-type": "Bearer",
        "access-token": ytp_accessToken,
      }
    });

    const requisitionNodes = requisitionsListRequest.data.requisitions;
    // const requisitionNodes = mockApi.requisitions;

    const activeRequisitions = [];
    const newReqsHistory = {};

    for (const requisiton of requisitionNodes) {
      const remain = requisiton.loan_detail.missing_amount;
      const id = requisiton.id;
      const qualification = requisiton.qualification;
      const rate = requisiton.rate;
      const amount = requisiton.approved_amount;
      const term = requisiton.term;

      const progress = Math.floor(100 - (remain / amount * 100));
      const isNew = !(prevReqsHistory[id]);
      const reqObj = { id, qualification, rate, amount, term, remain, progress };

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
      const text = `There are ${reqCount} requisitions. ${newRequisitionsCount} new.\n`;
      console.log(text);
      const tableHtml = createTable(newRequisitions);
      const body = text + tableHtml;
      await transport.sendMail({...message, text: text, html: body});
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
    console.log("Error", error.response.status, error.response.statusText);
    if (error.response.data && error.response.data.errors.includes(NOT_LOGGED)) {
      console.log("Error response:", error.response.data);
      doLogin();
    }
  }
};

checkYtp();

cron.schedule('*/15 * * * * *', () => {
  checkYtp();
});
