'use strict';

const { HttpsProxyAgent } = require('https-proxy-agent');
const config = require('../config');

const { host, port, username, password } = config.suborbit;
const enabled = Boolean(host && port && username && password);

const url = enabled ? `http://${username}:${password}@${host}:${port}` : null;
const agent = enabled ? new HttpsProxyAgent(url) : null;

module.exports = { enabled, agent, url };
