const axios = require('axios');

const BASE_URL = 'https://open.feishu.cn/open-apis';

const CONFIG = {
  APP_ID: process.env.FEISHU_APP_ID,
  APP_SECRET: process.env.FEISHU_APP_SECRET,
  WIKI_TOKEN: process.env.WIKI_TOKEN || 'S26ZwxqbAiTROgkKAEDcQkfQnQg',
  TABLE_ID: process.env.TABLE_ID || 'tbloo0yA03kMsPCV'
};

let tenantAccessToken = null;
let baseId = null;

async function getTenantAccessToken() {
  const url = `${BASE_URL}/auth/v3/tenant_access_token/internal`;
  const resp = await axios.post(url, {
    app_id: CONFIG.APP_ID,
    app_secret: CONFIG.APP_SECRET
  });
  if (resp.data.code === 0) {
    tenantAccessToken = resp.data.tenant_access_token;
    return tenantAccessToken;
  }
  throw new Error(`获取 token 失败`);
}

async function getBaseIdFromWiki() {
  const url = `${BASE_URL}/wiki/v2/spaces/get_node`;
  const resp = await axios.get(url, {
    params: { token: CONFIG.WIKI_TOKEN },
    headers: { Authorization: `Bearer ${tenantAccessToken}` }
  });
  if (resp.data.code === 0) {
    baseId = resp.data.data.node.obj_token;
    return baseId;
  }
  throw new Error(`获取 base_id 失败`);
}

async function sendMessage(chatId, text) {
  const url = `${BASE_URL}/im/v1/messages?receive_id_type=chat_id`;
  await axios.post(url, {
    receive_id: chatId,
    msg_type: 'text',
    content: JSON.stringify({ text })
  }, {
    headers: { Authorization: `Bearer ${tenantAccessToken}` }
  });
}
