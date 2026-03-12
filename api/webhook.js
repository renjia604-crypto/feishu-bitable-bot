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
async function handleMessage(messageText, chatId) {
  const text = messageText.trim();
  
  if (!tenantAccessToken) {
    await getTenantAccessToken();
    await getBaseIdFromWiki();
  }
  
  // 添加记录
  if (text.startsWith('添加记录') || text.startsWith('新增')) {
    const parts = text.split(/\s+/);
    if (parts.length < 3) return '格式: 添加记录 [日期] [内容]';
    const timestamp = parseDate(parts[1]);
    const content = parts.slice(2).join(' ');
    try {
      const record = await addRecord({ '工作日期': timestamp, '工作内容': content });
      return `✓ 记录添加成功\nID: ${record.id}`;
    } catch (e) { return `添加失败: ${e.message}`; }
  }
  
  // 查询记录
  if (text.startsWith('查询') || text.startsWith('列表')) {
    try {
      const records = await listRecords();
      if (records.length === 0) return '暂无记录';
      const recent = records.slice(-10).reverse();
      let result = `最近 ${recent.length} 条记录:\n\n`;
      recent.forEach((r, i) => {
        const date = r.fields['工作日期'] ? new Date(r.fields['工作日期']).toLocaleDateString('zh-CN') : '无日期';
        result += `${i + 1}. [${r.id}]\n   日期: ${date}\n   内容: ${r.fields['工作内容'] || '无内容'}\n\n`;
      });
      return result;
    } catch (e) { return `查询失败: ${e.message}`; }
  }
  
  // 更新记录
  if (text.startsWith('更新') || text.startsWith('修改')) {
    const parts = text.split(/\s+/);
    if (parts.length < 4) return '格式: 更新记录 [ID] [字段] [值]';
    const recordId = parts[1];
    const fieldName = parts[2];
    const value = parts.slice(3).join(' ');
    const fields = {};
    if (fieldName === '日期' || fieldName === '工作日期') fields['工作日期'] = parseDate(value);
    else if (fieldName === '内容' || fieldName === '工作内容') fields['工作内容'] = value;
    else if (fieldName === '进度') fields['进度'] = value;
    else fields[fieldName] = value;
    try {
      await updateRecord(recordId, fields);
      return `✓ 记录更新成功\nID: ${recordId}`;
    } catch (e) { return `更新失败: ${e.message}`; }
  }
  
  // 删除记录
  if (text.startsWith('删除')) {
    const parts = text.split(/\s+/);
    if (parts.length < 2) return '格式: 删除记录 [ID]';
    try {
      await deleteRecord(parts[1]);
      return `✓ 记录删除成功\nID: ${parts[1]}`;
    } catch (e) { return `删除失败: ${e.message}`; }
  }
  
  // 帮助
  if (text === '帮助' || text === 'help') {
    return `可用指令:\n• 添加记录 [日期] [内容]\n• 查询记录\n• 更新记录 [ID] [字段] [值]\n• 删除记录 [ID]\n\n日期: 今天/昨天/前天/2024-01-01`;
  }
  
  return '未知指令，输入「帮助」查看命令';
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { challenge } = req.query;
    if (challenge) return res.json({ challenge });
    return res.json({ message: 'Feishu Bitable Bot is running' });
  }
  
  if (req.method === 'POST') {
    const { header, event } = req.body;
    if (header?.event_type === 'im.message.receive_v1') {
      const { message } = event;
      const chatId = message.chat_id;
      const content = JSON.parse(message.content);
      const reply = await handleMessage(content.text || '', chatId);
      await sendMessage(chatId, reply);
      return res.json({ code: 0 });
    }
    return res.json({ code: 0 });
  }
  
  res.status(405).json({ error: 'Method not allowed' });
};
