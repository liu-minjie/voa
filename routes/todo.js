const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const config = require('../config');
const dataPath = config.dataPath;

const todoPath = path.join(dataPath, 'todo.json');

function ensureJson(filePath, initialData = {}) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(dataPath, path.basename(filePath));
  if (!fs.existsSync(absolutePath)) {
    const dirPath = path.dirname(absolutePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(absolutePath, JSON.stringify(initialData, null, 2), 'utf8');
  } else {
    delete require.cache[require.resolve(absolutePath)];
  }
  return require(absolutePath);
}

const writeFileSync = (filePath, data) => {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(dataPath, path.basename(filePath));
  fs.writeFileSync(absolutePath, JSON.stringify(data, null, 2), 'utf8');
};

router.get('/', function(req, res, next) {
  res.render('todo', {});
});

router.get('/list', function(req, res) {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const keyword = req.query.keyword;
  const category = req.query.category;
  const tag = req.query.tag;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;
  const completed = req.query.completed;
  const data = ensureJson(todoPath, { todos: [] });
  let todos = data.todos || [];
  
  if (keyword) {
    todos = todos.filter(t => t.text.toLowerCase().includes(keyword.toLowerCase()));
  }
  
  if (category && category !== 'all') {
    todos = todos.filter(t => t.category === category);
  }
  
  if (tag) {
    todos = todos.filter(t => (t.tags || []).includes(tag));
  }
  
  if (startDate) {
    todos = todos.filter(t => new Date(t.createdAt) >= new Date(startDate));
  }
  
  if (endDate) {
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    todos = todos.filter(t => new Date(t.createdAt) < end);
  }
  
  if (completed !== undefined && completed !== '') {
    todos = todos.filter(t => t.completed === (completed === 'true'));
  }
  
  const total = todos.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const list = todos.slice(start, end);
  
  res.json({ 
    success: true, 
    data: {
      list: list,
      total: total,
      page: page,
      pageSize: pageSize
    } 
  });
});

router.get('/categories', function(req, res) {
  const data = ensureJson(todoPath, { todos: [] });
  const todos = data.todos || [];
  const categories = [...new Set(todos.map(t => t.category).filter(c => c))];
  res.json({ success: true, data: categories });
});

router.get('/tags', function(req, res) {
  const data = ensureJson(todoPath, { todos: [] });
  const todos = data.todos || [];
  const allTags = todos.flatMap(t => t.tags || []).filter(t => t);
  const tags = [...new Set(allTags)];
  res.json({ success: true, data: tags });
});

router.post('/add', function(req, res) {
  try {
    const data = ensureJson(todoPath, { todos: [] });
    const todos = data.todos || [];
    todos.unshift({
      id: Date.now(),
      text: req.body.text,
      category: req.body.category || '',
      tags: Array.isArray(req.body.tags) ? req.body.tags.filter(t => t) : [],
      completed: false,
      createdAt: new Date().toISOString()
    });
    writeFileSync(todoPath, { todos });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/update/:id', function(req, res) {
  try {
    const id = parseInt(req.params.id);
    const data = ensureJson(todoPath, { todos: [] });
    const todos = data.todos || [];
    const todo = todos.find(t => t.id === id);
    if (!todo) {
      return res.json({ success: false, message: '未找到该待办事项' });
    }
    if (req.body.text !== undefined) todo.text = req.body.text;
    if (req.body.completed !== undefined) todo.completed = req.body.completed;
    if (req.body.category !== undefined) todo.category = req.body.category;
    if (req.body.tags !== undefined) todo.tags = Array.isArray(req.body.tags) ? req.body.tags.filter(t => t) : [];
    writeFileSync(todoPath, { todos });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/delete/:id', function(req, res) {
  try {
    const id = parseInt(req.params.id);
    const data = ensureJson(todoPath, { todos: [] });
    let todos = data.todos || [];
    todos = todos.filter(t => t.id !== id);
    writeFileSync(todoPath, { todos });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;