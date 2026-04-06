const config = require('../config');
const express = require('express');
const router = express.Router();
const request = require('request');
const fs = require('fs');
const path = require('path');
const util = require('../util');
const videoJson = require('./english.json');
const { exec } = require('child_process');

router.get('/', function(req, res, next) {
	res.render('index', {});
});


module.exports = router;
