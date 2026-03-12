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
async function addRecord(fields) {
  const url = `${BASE_URL}/bitable/v1/apps/${baseId}/tables/${CONFIG.TABLE_ID}/records`;
  const resp = await axios.post(url, { fields }, {
    headers: { Authorization: `Bearer ${tenantAccessToken}` }
  });
  if (resp.data.code === 0) return resp.data.data.record;
  throw new Error(`添加失败`);
}

async function listRecords() {
  const url = `${BASE_URL}/bitable/v1/apps/${baseId}/tables/${CONFIG.TABLE_ID}/records`;
  const allRecords = [];
  let pageToken = null;
  do {
    const params = { page_size: 500 };
    if (pageToken) params.page_token = pageToken;
    const resp = await axios.get(url, {
      params, headers: { Authorization: `Bearer ${tenantAccessToken}` }
    });
    if (resp.data.code === 0) {
      allRecords.push(...resp.data.data.items);
      pageToken = resp.data.data.page_token;
      if (!resp.data.data.has_more) break;
    }
  } while (pageToken);
  return allRecords;
}

async function updateRecord(recordId, fields) {
  const url = `${BASE_URL}/bitable/v1/apps/${baseId}/tables/${CONFIG.TABLE_ID}/records/${recordId}`;
  const resp = await axios.put(url, { fields }, {
    headers: { Authorization: `Bearer ${tenantAccessToken}` }
  });
  if (resp.data.code === 0) return resp.data.data.record;
  throw new Error(`更新失败`);
}

async function deleteRecord(recordId) {
  const url = `${BASE_URL}/bitable/v1/apps/${baseId}/tables/${CONFIG.TABLE_ID}/records/${recordId}`;
  const resp = await axios.delete(url, {
    headers: { Authorization: `Bearer ${tenantAccessToken}` }
  });
  if (resp.data.code === 0) return true;
  throw new Error(`删除失败`);
}

function parseDate(dateStr) {
  const today = new Date();
  if (dateStr === '今天') return new Date(today.setHours(0, 0, 0, 0)).getTime();
  if (dateStr === '昨天') return new Date(today.setDate(today.getDate() - 1)).setHours(0, 0, 0, 0);
  if (dateStr === '前天') return new Date(today.setDate(today.getDate() - 2)).setHours(0, 0, 0, 0);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr).getTime();
  return new Date().getTime();
}
