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

function getCategoryByName(categories, name) {
  return categories.find(c => c.name === name);
}

function getTagByName(tags, name) {
  return tags.find(t => t.name === name);
}

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
  const data = ensureJson(todoPath, { todos: [], categories: [], tags: [] });
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
  const data = ensureJson(todoPath, { todos: [], categories: [], tags: [] });
  const categories = (data.categories || []).sort((a, b) => b.count - a.count);
  res.json({ success: true, data: categories });
});

router.get('/tags', function(req, res) {
  const data = ensureJson(todoPath, { todos: [], categories: [], tags: [] });
  const tags = (data.tags || []).sort((a, b) => b.count - a.count);
  res.json({ success: true, data: tags });
});

router.post('/add', function(req, res) {
  try {
    const data = ensureJson(todoPath, { todos: [], categories: [], tags: [] });
    const todos = data.todos || [];
    const categories = data.categories || [];
    const tags = data.tags || [];
    
    const newCategory = req.body.category || '';
    const newTags = Array.isArray(req.body.tags) ? req.body.tags.filter(t => t) : [];
    
    if (newCategory) {
      const cat = getCategoryByName(categories, newCategory);
      if (cat) {
        cat.count++;
      } else {
        categories.push({ name: newCategory, count: 1 });
      }
    }
    
    newTags.forEach(tag => {
      const t = getTagByName(tags, tag);
      if (t) {
        t.count++;
      } else {
        tags.push({ name: tag, count: 1 });
      }
    });
    
    todos.unshift({
      id: Date.now(),
      text: req.body.text,
      category: newCategory,
      tags: newTags,
      completed: false,
      createdAt: new Date().toISOString()
    });
    
    writeFileSync(todoPath, { todos, categories, tags });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/update/:id', function(req, res) {
  try {
    const id = parseInt(req.params.id);
    const data = ensureJson(todoPath, { todos: [], categories: [], tags: [] });
    const todos = data.todos || [];
    const categories = data.categories || [];
    const tags = data.tags || [];
    
    const todo = todos.find(t => t.id === id);
    if (!todo) {
      return res.json({ success: false, message: '未找到该待办事项' });
    }
    
    const oldCategory = todo.category;
    const oldTags = todo.tags || [];
    
    if (req.body.text !== undefined) todo.text = req.body.text;
    if (req.body.completed !== undefined) todo.completed = req.body.completed;
    if (req.body.category !== undefined) todo.category = req.body.category;
    if (req.body.tags !== undefined) todo.tags = Array.isArray(req.body.tags) ? req.body.tags.filter(t => t) : [];
    
    const newCategory = todo.category;
    const newTags = todo.tags || [];
    
    if (oldCategory && oldCategory !== newCategory) {
      const cat = getCategoryByName(categories, oldCategory);
      if (cat) {
        cat.count--;
        if (cat.count <= 0) {
          const idx = categories.indexOf(cat);
          if (idx > -1) categories.splice(idx, 1);
        }
      }
    }
    
    if (newCategory && newCategory !== oldCategory) {
      const cat = getCategoryByName(categories, newCategory);
      if (cat) {
        cat.count++;
      } else {
        categories.push({ name: newCategory, count: 1 });
      }
    }
    
    oldTags.forEach(tag => {
      if (!newTags.includes(tag)) {
        const t = getTagByName(tags, tag);
        if (t) {
          t.count--;
          if (t.count <= 0) {
            const idx = tags.indexOf(t);
            if (idx > -1) tags.splice(idx, 1);
          }
        }
      }
    });
    
    newTags.forEach(tag => {
      if (!oldTags.includes(tag)) {
        const t = getTagByName(tags, tag);
        if (t) {
          t.count++;
        } else {
          tags.push({ name: tag, count: 1 });
        }
      }
    });
    
    writeFileSync(todoPath, { todos, categories, tags });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/delete/:id', function(req, res) {
  try {
    const id = parseInt(req.params.id);
    const data = ensureJson(todoPath, { todos: [], categories: [], tags: [] });
    let todos = data.todos || [];
    const categories = data.categories || [];
    const tags = data.tags || [];
    
    const todo = todos.find(t => t.id === id);
    if (!todo) {
      return res.json({ success: false, message: '未找到该待办事项' });
    }
    
    const oldCategory = todo.category;
    const oldTags = todo.tags || [];
    
    todos = todos.filter(t => t.id !== id);
    
    if (oldCategory) {
      const cat = getCategoryByName(categories, oldCategory);
      if (cat) {
        cat.count--;
        if (cat.count <= 0) {
          const idx = categories.indexOf(cat);
          if (idx > -1) categories.splice(idx, 1);
        }
      }
    }
    
    oldTags.forEach(tag => {
      const t = getTagByName(tags, tag);
      if (t) {
        t.count--;
        if (t.count <= 0) {
          const idx = tags.indexOf(t);
          if (idx > -1) tags.splice(idx, 1);
        }
      }
    });
    
    writeFileSync(todoPath, { todos, categories, tags });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;