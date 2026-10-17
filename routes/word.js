const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = require('../config');
const dataPath = config.dataPath;
const WORD_PATH = path.join(dataPath, 'all-word.json');
const SENTENCE_PATH = path.join(dataPath, 'all-sentence.json');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return [];
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// 生成唯一 id
function genId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// 给没有 id 的词条补上 id，返回是否有改动
function ensureIds(data) {
  let changed = false;
  for (const item of data) {
    if (!item.id) {
      item.id = genId();
      changed = true;
    }
  }
  return changed;
}

// 按 id 查找数组下标
function findIndexById(data, id) {
  return data.findIndex((item) => item.id === id);
}

// 合并单词和句子
function getMergedList(keyword, type) {
  let words = readJson(WORD_PATH);
  let sentences = readJson(SENTENCE_PATH);

  if (ensureIds(words)) writeJson(WORD_PATH, words);
  if (ensureIds(sentences)) writeJson(SENTENCE_PATH, sentences);

  words = words.map((item) => ({
    id: item.id,
    title: item.title,
    trans: item.trans,
    us: item.us,
    uk: item.uk,
    remembered: !!item.remembered,
    type: 'word'
  }));

  sentences = sentences.map((item) => ({
    id: item.id,
    title: item.title,
    trans: item.trans,
    remembered: !!item.remembered,
    type: 'sentence'
  }));

  let list = [...words, ...sentences];

  if (type && type !== 'all') {
    list = list.filter((item) => item.type === type);
  }

  if (keyword) {
    const kw = String(keyword).toLowerCase();
    list = list.filter((item) => {
      const title = String(item.title || '').toLowerCase();
      const trans = String(item.trans || '').toLowerCase();
      return title.includes(kw) || trans.includes(kw);
    });
  }

  return list;
}

router.get('/', function (req, res) {
  res.render('word', {});
});

router.get('/list', function (req, res) {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const keyword = req.query.keyword || '';
  const type = req.query.type || 'all';

  let list = getMergedList(keyword, type);
  const total = list.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageList = list.slice(start, end);

  res.json({
    success: true,
    data: { list: pageList, total, page, pageSize }
  });
});

router.get('/random', function (req, res) {
  const type = req.query.type || 'all';
  const list = getMergedList('', type);
  if (list.length === 0) {
    return res.json({ success: false, message: '没有数据' });
  }
  const item = list[Math.floor(Math.random() * list.length)];
  res.json({ success: true, data: item });
});

router.post('/add', function (req, res) {
  try {
    const { title, trans, type } = req.body;
    if (!title || !String(title).trim()) {
      return res.json({ success: false, message: '标题不能为空' });
    }
    const titleStr = String(title).trim();
    const isSentence = type === 'sentence';
    const filePath = isSentence ? SENTENCE_PATH : WORD_PATH;
    const data = readJson(filePath);

    const exists = data.some((item) => String(item.title || '').trim() === titleStr);
    if (exists) {
      return res.json({ success: false, message: '已存在，无需重复添加' });
    }

    const newItem = {
      id: genId(),
      title: titleStr,
      trans: trans ? String(trans) : '',
      remembered: false
    };
    if (!isSentence) {
      newItem.us = null;
      newItem.uk = null;
    }
    data.push(newItem);
    writeJson(filePath, data);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/update/:type/:id', function (req, res) {
  try {
    const type = req.params.type;
    const id = req.params.id;
    const { title, trans } = req.body;
    const isSentence = type === 'sentence';
    const filePath = isSentence ? SENTENCE_PATH : WORD_PATH;
    const data = readJson(filePath);
    const index = findIndexById(data, id);

    if (index < 0) {
      return res.json({ success: false, message: '未找到该项' });
    }
    if (!title || !String(title).trim()) {
      return res.json({ success: false, message: '标题不能为空' });
    }

    data[index].title = String(title).trim();
    if (trans !== undefined) {
      data[index].trans = String(trans);
    }
    writeJson(filePath, data);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/delete/:type/:id', function (req, res) {
  try {
    const type = req.params.type;
    const id = req.params.id;
    const isSentence = type === 'sentence';
    const filePath = isSentence ? SENTENCE_PATH : WORD_PATH;
    const data = readJson(filePath);
    const index = findIndexById(data, id);

    if (index < 0) {
      return res.json({ success: false, message: '未找到该项' });
    }

    data.splice(index, 1);
    writeJson(filePath, data);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 更新记住状态
router.post('/remember/:type/:id', function (req, res) {
  try {
    const type = req.params.type;
    const id = req.params.id;
    const { remembered } = req.body;
    const isSentence = type === 'sentence';
    const filePath = isSentence ? SENTENCE_PATH : WORD_PATH;
    const data = readJson(filePath);
    const index = findIndexById(data, id);

    if (index < 0) {
      return res.json({ success: false, message: '未找到该项' });
    }

    data[index].remembered = !!remembered;
    writeJson(filePath, data);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
